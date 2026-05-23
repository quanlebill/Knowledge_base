# Auth & Gateway — Setup Guide

> Keycloak + Kong + PostgreSQL trên Docker Desktop  
> Ngày: 2026-05-23

---

## Yêu cầu

| Tool | Phiên bản tối thiểu |
|---|---|
| Docker Desktop | 4.x (Engine 24+) |
| Docker Compose | v2 (tích hợp sẵn trong Docker Desktop) |
| curl | Bất kỳ (để test) |
| Node.js | 20+ (nếu chạy frontend ngoài Docker) |

---

## Kiến trúc tổng thể

```
Browser
  │  (1) Login → Keycloak (port 8080)
  │  (2) nhận JWT RS256
  │
  ▼
Kong Gateway (port 8000)
  │  (3) verify JWT bằng JWKS từ Keycloak
  │  (4) inject headers: X-User-Id, X-User-Roles, X-User-Email
  ▼
Backend FastAPI  ←  chỉ đọc headers, KHÔNG verify JWT lại
  │
  ▼
PostgreSQL (port 5432)
  ├── schema public   → platform tables (tenants, members, api_keys, ...)
  ├── schema keycloak → Keycloak internal storage
  └── schema kong     → Kong config storage
```

---

## Bước 1 — Khởi động tất cả services

```bash
# Clone hoặc ở thư mục dự án
cd Data-Agentt

# Kéo images và khởi động (lần đầu mất ~3-5 phút)
docker compose up -d

# Xem logs real-time
docker compose logs -f
```

**Kiểm tra health:**
```bash
docker compose ps
```

Kết quả mong đợi:
```
NAME                    STATUS
aeroflow-postgres       Up (healthy)
aeroflow-keycloak       Up (healthy)
aeroflow-kong-migration Exited (0)      ← migration thành công
aeroflow-kong           Up (healthy)
aeroflow-konga          Up
aeroflow-frontend       Up
```

---

## Bước 2 — Truy cập các service

| Service | URL | Credentials |
|---|---|---|
| Frontend (Vite) | http://localhost:5173 | — |
| Keycloak Admin | http://localhost:8080/admin | admin / admin |
| Kong Admin API | http://localhost:8001 | — |
| Konga (Kong UI) | http://localhost:1337 | setup khi vào lần đầu |
| PostgreSQL | localhost:5432 | aeroflow / aeroflow_secret |

---

## Bước 3 — Cấu hình Kong (chạy một lần)

```bash
# Chạy script setup Kong
bash infra/kong/kong-setup.sh
```

Script này sẽ tạo:
- Service `aeroflow-backend` → upstream backend
- Route `/api` → proxy tới backend
- Plugin **OIDC** → verify JWT từ Keycloak JWKS
- Plugin **IP Restriction** → allowlist private ranges
- Plugin **Correlation-ID** → tracing header `X-Request-ID`

---

## Bước 4 — Kiểm tra Keycloak

### 4.1 Đăng nhập Keycloak Admin
Mở http://localhost:8080/admin → đăng nhập `admin / admin`

### 4.2 Chọn realm `aeroflow`
Realm đã được import tự động từ `infra/keycloak/realm-export.json` với:
- 2 clients: `aeroflow-frontend`, `aeroflow-backend`, `aeroflow-admin`
- 4 realm roles: `platform-admin`, `ai-engineer`, `business-operator`, `executive-viewer`
- 2 test users

### 4.3 Kiểm tra JWKS endpoint
```bash
curl http://localhost:8080/realms/aeroflow/.well-known/openid-configuration | jq .jwks_uri
# → "http://localhost:8080/realms/aeroflow/protocol/openid-connect/certs"
```

---

## Bước 5 — Test luồng Auth

### 5.1 Lấy access token (Resource Owner Password — chỉ dùng cho test)
```bash
curl -s -X POST \
  http://localhost:8080/realms/aeroflow/protocol/openid-connect/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=aeroflow-frontend" \
  -d "grant_type=password" \
  -d "username=platform-admin" \
  -d "password=Admin@1234" \
  | jq -r .access_token
```

Lưu token:
```bash
TOKEN=$(curl -s -X POST \
  http://localhost:8080/realms/aeroflow/protocol/openid-connect/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=aeroflow-frontend" \
  -d "grant_type=password" \
  -d "username=platform-admin" \
  -d "password=Admin@1234" \
  | jq -r .access_token)

echo "Token: ${TOKEN:0:50}..."
```

### 5.2 Decode token (xem claims)
```bash
echo $TOKEN | cut -d. -f2 | base64 -d 2>/dev/null | jq .
# Xem: sub, realm_access.roles, email, name
```

### 5.3 Gọi qua Kong Gateway

> **Lưu ý:** `X-User-*` headers được Kong inject vào **request gửi lên backend** (không phải response trả về client).  
> Cần chạy echo server để thấy headers — mở 2 terminal:

**Terminal 1 — start echo server trên port 8888:**
```bash
python3 -c "
import http.server, json
class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(json.dumps(dict(self.headers), indent=2).encode())
    def log_message(self, *a): pass
http.server.HTTPServer(('0.0.0.0', 8888), H).serve_forever()
"
```

**Terminal 2 — gọi qua Kong và xem headers:**
```bash
curl -s http://localhost:8000/api/health \
  -H "Authorization: Bearer $TOKEN" \
  | jq 'with_entries(select(.key | startswith("X-")))'
```

Kết quả mong đợi:
```json
{
  "X-User-Id": "<keycloak-user-uuid>",
  "X-User-Email": "admin@aeroflow.local",
  "X-User-Roles": "platform-admin",
  "X-Kong-Verified": "true",
  "X-Request-ID": "<uuid>"
}
```

> Nếu không chạy echo server → Kong trả `502 Bad Gateway` (JWT hợp lệ, không có backend) — đây là hành vi **đúng**.

### 5.4 Kiểm tra token bị thiếu → Kong reject
```bash
curl -s http://localhost:8000/api/health
# → HTTP 401 Unauthorized
```

---

## Bước 6 — Test Database Schema

### Kết nối PostgreSQL
```bash
docker exec -it aeroflow-postgres psql -U aeroflow -d aeroflow
```

### Kiểm tra tables đã tạo
```sql
\dt public.*
-- plans, tenants, roles, members, keycloak_realm_configs,
-- keycloak_role_mappings, ip_allowlists, api_keys,
-- secrets_vault, key_rotations, webhooks, audit_logs, pii_access_logs

SELECT * FROM plans;
SELECT * FROM roles;

\q
```

### Insert tenant test
```sql
INSERT INTO tenants (name, slug, plan_id, data_residency)
VALUES ('GlobalCorp', 'globalcorp', 3, 'Asia-SE1');

SELECT id, name, slug FROM tenants;
```

---

## Bước 7 — Test Frontend

Mở http://localhost:5173

Frontend sẽ redirect đến Keycloak login page. Đăng nhập với:
- `platform-admin / Admin@1234`
- `ai-engineer / Engineer@1234`

Sau đăng nhập, ứng dụng load với user đã được authenticate.

**Lưu ý:** Nếu frontend không redirect, kiểm tra biến môi trường:
```bash
docker compose logs frontend | grep VITE
```

---

## Bước 8 — Konga (Kong Admin UI)

Mở http://localhost:1337

1. Tạo account admin lần đầu
2. Kết nối vào Kong Admin: `http://kong:8001`
3. Xem Services, Routes, Plugins đã được cài

---

## Cấu trúc files

```
Data-Agentt/
├── docker-compose.yml          ← Tất cả services
├── Dockerfile.dev              ← Frontend dev container
├── infra/
│   ├── sql/
│   │   └── init.sql           ← Schema DB đầy đủ (auth-db-design.md)
│   ├── keycloak/
│   │   └── realm-export.json  ← Realm config tự động import
│   └── kong/
│       └── kong-setup.sh      ← OIDC + IP restriction setup
└── src/components/Settings/
    ├── AuthSection.tsx         ← Tab-based auth management UI
    └── Auth/
        ├── AuthOverviewPanel.tsx  ← Health metrics + tech stack
        ├── KeycloakPanel.tsx      ← Realm configs + SSO bridges + MFA
        ├── KongGatewayPanel.tsx   ← JWT verify + JWKS + headers
        ├── IPAllowlistPanel.tsx   ← CIDR whitelist
        └── APIKeysPanel.tsx       ← API key management
```

---

## Troubleshooting

### Keycloak không start

```bash
docker compose logs keycloak | tail -50
```

Thường do:
- PostgreSQL chưa sẵn sàng → đợi thêm 30s rồi `docker compose restart keycloak`
- Port 8080 bị chiếm → đổi port trong `docker-compose.yml`

### Kong migration fail

```bash
docker compose logs kong-migration
# Nếu thấy "already exists" → bình thường, migration đã chạy rồi

# Reset hoàn toàn nếu cần
docker compose down -v
docker compose up -d
```

### Kong OIDC plugin không có

Kong base image không có OIDC plugin. Cần build custom image:

```bash
# Tạo file Dockerfile.kong
cat > Dockerfile.kong << 'EOF'
FROM kong:3.6-ubuntu
RUN luarocks install lua-resty-openidc
EOF

# Đổi image trong docker-compose.yml
# kong:
#   build:
#     context: .
#     dockerfile: Dockerfile.kong
```

Hoặc dùng image đã có plugin:
```yaml
# trong docker-compose.yml, đổi image kong thành:
image: mashape/kong-oidc:latest
```

### Frontend không kết nối Keycloak

```bash
# Kiểm tra env vars trong container
docker exec aeroflow-frontend env | grep VITE

# Nếu sai → sửa .env hoặc docker-compose.yml rồi restart
docker compose restart frontend
```

### Port conflict

```bash
# Kiểm tra port đang dùng
netstat -ano | findstr "8080 8000 5432 5173"

# Đổi port trong docker-compose.yml nếu cần
```

---

## Dừng / Xoá services

```bash
# Dừng (giữ data)
docker compose stop

# Khởi động lại
docker compose start

# Xoá hoàn toàn (bao gồm volumes/data)
docker compose down -v
```

---

## Security notes cho Production

- Thay tất cả password/secret trong `docker-compose.yml` bằng Docker Secrets hoặc Vault
- Bật HTTPS cho Keycloak (`KC_HOSTNAME_STRICT_HTTPS: "true"`)
- Đổi `start-dev` thành `start` trong Keycloak command
- Client secrets của backend → lưu vào OpenBao, không hardcode
- Kong Admin API (8001) → KHÔNG expose ra internet
- Thêm rate limiting plugin vào Kong
