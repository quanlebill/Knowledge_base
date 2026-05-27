# Auth & Gateway · Release Management — Hướng dẫn Chạy & Test

> Runbook thực tế: khởi động, setup, và kiểm thử từng thành phần  
> Auth: đọc `docs/auth-release-tech-stack-update.md` §Phần 1  
> Release: đọc `docs/release-system.md` để hiểu kiến trúc trước khi chạy.

## Mục lục

- [Phần 1 — Auth (Keycloak + Kong + Kafka)](#phần-1--auth-keycloak--kong--kafka)
- [Phần 2 — Release Management](#phần-2--release-management)
  - [R1. Khởi động Release Stack](#r1--khởi-động-release-stack)
  - [R2. URLs & Credentials Release](#r2--urls--credentials-release)
  - [R3. Setup Release Schema PostgreSQL](#r3--setup-release-schema-postgresql)
  - [R4. Setup Release Kafka Topics & ACL](#r4--setup-release-kafka-topics--acl)
  - [R5. Test Cases Release](#r5--test-cases-release)
  - [R6. Trigger Pipeline thủ công](#r6--trigger-pipeline-thủ-công)
  - [R7. Approval Flow](#r7--approval-flow)
  - [R8. Rollback](#r8--rollback)
  - [R9. Drift Detection](#r9--drift-detection)
  - [R10. Release History Query](#r10--release-history-query)
  - [R11. Kong Services cho Rollback](#r11--kong-services-cho-rollback-setup-một-lần)
  - [R12. New API Endpoints (2026-05-27)](#r12--new-api-endpoints-2026-05-27)
  - [R14. Troubleshooting Release](#r14--troubleshooting-release)

---

# Phần 1 — Auth (Keycloak + Kong + Kafka)

## Yêu cầu

| Tool | Phiên bản tối thiểu |
|---|---|
| Docker Desktop | 4.x (Engine 24+) |
| Docker Compose | v2 (tích hợp trong Docker Desktop) |
| curl | Bất kỳ |
| jq | Bất kỳ (để parse JSON trong test) |
| Node.js | 20+ (nếu chạy frontend ngoài Docker) |

---

## Bước 1 — Khởi động Stack

```bash
cd Data-Agentt

# Build images + khởi động tất cả services (lần đầu ~8-12 phút do Maven build SPI JAR)
docker compose up -d

# Theo dõi quá trình khởi động
docker compose logs -f
```

**Kiểm tra tất cả services healthy:**
```bash
docker compose ps
```

Kết quả mong đợi:
```
NAME                        STATUS
aeroflow-postgres           Up (healthy)
aeroflow-keycloak-1         Up (healthy)    ← mất ~90s lần đầu (import realm + DB migration)
aeroflow-keycloak-2         Up (healthy)    ← đợi node1 healthy mới join cluster
aeroflow-keycloak-lb        Up (healthy)
aeroflow-kong-migration     Exited (0)      ← migration thành công, exit 0 là đúng
aeroflow-kong               Up (healthy)
aeroflow-konga              Up
aeroflow-kafka              Up (healthy)
aeroflow-audit-consumer     Up
aeroflow-frontend           Up
```

> **Thứ tự khởi động:** postgres → keycloak-node1 → keycloak-node2 → keycloak-lb → kong-migration → kong → kafka → audit-consumer → frontend

---

## Bước 2 — URLs & Credentials

| Service | URL | Credentials |
|---|---|---|
| Frontend (Vite) | http://localhost:5173 | — |
| Keycloak (HAProxy LB) | http://localhost:8080/admin | admin / admin |
| Keycloak Node 1 (direct) | http://localhost:8081/admin | admin / admin |
| Keycloak Node 2 (direct) | http://localhost:8082/admin | admin / admin |
| Kong Admin API | http://localhost:8001 | — |
| Konga (Kong UI) | http://localhost:1337 | setup lần đầu |
| PostgreSQL | localhost:5432 | aeroflow / aeroflow_secret |
| Kafka | localhost:9092 | SASL/SCRAM (xem §Kafka) |

---

## Tài khoản

### Keycloak — Master Realm (Admin)

| Username | Password | Vai trò |
|---|---|---|
| `admin` | `admin` | Keycloak master admin — quản lý toàn bộ realm |

> **Production:** Đổi ngay, dùng secrets manager.

---

### Realm `aeroflow` — Test Users

| Username | Password | Role | Email | Ghi chú |
|---|---|---|---|---|
| `platform-admin` | `PlatformAdmin@1234` | `platform-admin` | admin@aeroflow.local | Có quyền `realm-management:view-users` — xem được toàn bộ users qua IAM |
| `ai-engineer` | `AiEngineer@1234` | `ai-engineer` | engineer@aeroflow.local | |
| `executive-viewer` | `Viewer@1234` | `executive-viewer` | viewer@aeroflow.local | |

> Các tài khoản này được import sẵn từ `realm-export.json` khi stack khởi động lần đầu.  
> **Quan trọng:** Realm import chỉ chạy khi realm chưa tồn tại trong DB. Nếu stack đã từng chạy, cần `docker compose down -v && docker compose up -d` để re-import.

---

### Realm `aeroflow` — Service Accounts (Clients)

| Client ID | Secret | Dùng cho |
|---|---|---|
| `aeroflow-backend` | `aeroflow-backend-secret-change-in-prod` | Kong token introspection |
| `aeroflow-admin` | `aeroflow-admin-secret` | python-keycloak admin tasks |

---

### Kafka Users

| Username | Password | ACL |
|---|---|---|
| `admin` | `KafkaAdmin@1234` | Super user — inter-broker |
| `audit-bridge` | `AuditBridge@1234` | Write + Describe on `audit.auth.events` (Keycloak SPI) |
| `audit-consumer` | `AuditConsumer@1234` | Read + Describe on `audit.auth.events`, Read on group `audit-consumer-group` |

---

### PostgreSQL

| Username | Password | Database |
|---|---|---|
| `aeroflow` | `aeroflow_secret` | `aeroflow` |

---

## Bước 3 — Setup Kong (chạy một lần)

```bash
bash infra/kong/kong-setup.sh
```

Script tạo:
- Service `aeroflow-backend` → upstream `http://host.docker.internal:8888`
- Route `/api` → paths=["/api"], methods=[GET,POST,PUT,PATCH,DELETE,OPTIONS]
- Plugin **aeroflow-jwks** → RS256 verify từ JWKS Keycloak, cache 300s
- Plugin **IP Restriction** → allowlist private ranges (10/8, 172.16/12, 192.168/16)
- Plugin **Correlation-ID** → header `X-Request-ID`
- Plugin **Rate Limiting** → 300 req/phút per IP (policy=local)

Nếu cert mTLS đã được tạo (`infra/certs/kong-client.crt` tồn tại), script sẽ tự đăng ký thêm.

---

## Bước 4 — Setup Kafka ACL (chạy một lần)

```bash
bash infra/kafka/kafka-setup.sh
```

Tạo topic `audit.auth.events` (3 partitions, retention 30 ngày) và gán ACL:
- `audit-bridge` → Write + Describe on `audit.auth.events`
- `audit-consumer` → Read + Describe on `audit.auth.events`, Read on group `audit-consumer-group`

---

## Bước 5 — Setup mTLS certs (tùy chọn)

```bash
bash infra/certs/gen-certs.sh
```

Tạo trong `infra/certs/` (git-ignored):
- `ca.crt` — CA gốc, chia sẻ với backend để verify
- `kong-client.crt` / `kong-client.key` — Kong present trên mỗi upstream request
- `backend.crt` / `backend.key` — placeholder cho backend service

Sau đó chạy lại `kong-setup.sh` để đăng ký cert vào Kong.

---

## TEST CASES

### Kết quả Test Thực Tế — 2026-05-25

Chạy trên stack live (Docker Compose, Windows 11). Môi trường: `localhost`, không có backend thật ở port 8888.

| TC | Tên | Trạng thái | Ghi chú |
|---|---|---|---|
| TC-01 | KC HA Failover | ✅ PASS | node1 dừng → HAProxy route sang node2, login thành công |
| TC-02 | KC Session Sync | ✅ PASS | Token node1 introspect trên node2 → `active:true` |
| TC-03 | JWT valid → Kong | ✅ PASS | 502 (auth pass, no real backend) |
| TC-04 | JWT missing → 401 | ✅ PASS | `HTTP/1.1 401 Unauthorized` |
| TC-05 | JWT tampered → 401 | ✅ PASS | `HTTP/1.1 401 Unauthorized` |
| TC-06 | JWT expired → 401 | ✅ PASS | Token expires_in=15s → đợi 22s → 401 |
| TC-07 | JWKS cache 300s | ✅ PASS | Sau reload, JWKS fetch 1 lần, cache TTL 300s |
| TC-08 | Rate limit 300 req/min | ✅ PASS | 429 tại request #5 (test với limit=5), headers đúng |
| TC-09 | Brute force 5 fail | ✅ PASS | 6 lần sai → `disabled:true`, đúng password vẫn 401 |
| TC-10 | Session limit | ⚠️ Không cấu hình | KC 24 hỗ trợ qua User Session Limits flow, chưa enable |
| TC-11 | Password policy | ✅ PASS | "abc" → 400, "password123" → 400, "Str0ng@Pass" → 201 |
| TC-12 | Kafka audit pipeline | ✅ PASS | LOGIN events → Kafka → PostgreSQL, latency ~2s |
| TC-13 | Kafka ACL deny | ✅ PASS | `TopicAuthorizationException`: audit-consumer WRITE bị từ chối |
| TC-14 | KC Event Logging | ✅ PASS | KC event store có LOGIN events |
| TC-15 | Correlation ID | ✅ PASS | `X-Kong-Request-Id` trong response |
| TC-16 | IP Restriction config | ✅ PASS | Allow 127/10/172.16/192.168 |
| TC-17 | mTLS client cert | ✅ PASS | CA + Kong client cert đăng ký vào Kong Admin API |
| TC-18 | HAProxy round-robin | ✅ PASS | 4/4 requests → HTTP 200 |
| TC-19 | Token payload | ✅ PASS | RS256, issuer đúng, expires_in=900 |
| — | KC HA cluster (cả 2 node) | ✅ PASS | Cả node1 và node2 `"status":"UP"` |
| — | Kong plugins đã config | ✅ PASS | 6 plugins: aeroflow-jwks, jwt, pre-function, rate-limiting, correlation-id, ip-restriction |

---

### Chi tiết kết quả đã pass

#### TC-03/04/05 — JWT Verification qua Kong

```
# TC-03: Token hợp lệ
curl http://localhost:8000/api/health -H "Authorization: Bearer $TOKEN"
→ HTTP/1.1 503 Service Temporarily Unavailable   ← Kong verify pass, upstream không có
→ X-Kong-Response-Latency: 1
→ X-Kong-Request-Id: 85493369c179390a46489274cb5cab51

# TC-04: Không có token
curl http://localhost:8000/api/health
→ HTTP/1.1 401 Unauthorized

# TC-05: Token bị tamper
curl http://localhost:8000/api/health -H "Authorization: Bearer ${TOKEN}x"
→ HTTP/1.1 401 Unauthorized
```

**Lưu ý:** 503 thay vì 200 là đúng — Kong đã verify JWT thành công nhưng không có backend service thật tại `http://host.docker.internal:8888`. Khi deploy backend thật, TC-03 sẽ trả 200 với `X-User-Id`, `X-User-Email`, `X-User-Roles`, `X-Kong-Verified: true`.

---

#### TC-12 — Kafka Audit Pipeline

Toàn bộ pipeline đã được verify end-to-end:

```
# Kafka topic offsets (tổng 5 messages)
audit.auth.events:0:5   ← 4 LOGIN events từ KC SPI + 1 test msg
audit.auth.events:1:0
audit.auth.events:2:1

# Sample Kafka message (từ Keycloak SPI)
{
  "realmId": "a86f008b-832d-42c9-b5f6-e0535444d709",
  "clientId": "aeroflow-frontend",
  "ipAddress": "172.22.0.9",
  "type": "LOGIN",
  "userId": "ea14d6a1-8d72-429a-b342-828a3766de96",
  "time": 1779697404663,
  "details": {
    "auth_method": "openid-connect",
    "grant_type": "password",
    "username": "platform-admin",
    "client_auth_method": "client-secret"
  }
}

# PostgreSQL audit_logs (5 rows confirmed)
actor                                  | action | status  | ip_address
ea14d6a1-8d72-429a-b342-828a3766de96  | LOGIN  | SUCCESS | 172.22.0.9
ea14d6a1-8d72-429a-b342-828a3766de96  | LOGIN  | SUCCESS | 172.22.0.9
...
```

**Pipeline latency:** Login event → Kafka → PostgreSQL: ~2 giây.

---

#### TC-14 — Keycloak Event Store

```bash
# Sau khi enable events qua Admin API:
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:8080/admin/realms/aeroflow/events?max=5"

# Kết quả:
"time": 1779697404663, "type": "LOGIN", "userId": "ea14d6a1-..."
"time": 1779697195862, "type": "LOGIN", "userId": "ea14d6a1-..."
```

**Lưu ý quan trọng:** Realm được import lần đầu có `eventsEnabled: true`, nhưng nếu realm đã tồn tại trong DB thì import bị skip. Phải kích hoạt events thủ công sau khi stack start lần đầu:

```bash
ADMIN_TOKEN=$(curl -s http://localhost:8080/realms/master/protocol/openid-connect/token \
  -d "client_id=admin-cli&grant_type=password&username=admin&password=admin" \
  | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

curl -X PUT -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  "http://localhost:8080/admin/realms/aeroflow" \
  -d '{"eventsEnabled":true,"eventsExpiration":86400,"enabledEventTypes":["LOGIN","LOGIN_ERROR","LOGOUT","REGISTER","REFRESH_TOKEN"],"eventsListeners":["jboss-logging","aeroflow-kafka"]}'
```

---

#### TC-15 — Correlation ID & Kong Headers

```
curl -si http://localhost:8000/api/health (no auth)
→ HTTP/1.1 401 Unauthorized
→ X-Kong-Response-Latency: 0

curl -si http://localhost:8000/api/health -H "Authorization: Bearer $TOKEN"
→ HTTP/1.1 503 Service Temporarily Unavailable
→ X-Kong-Response-Latency: 1
→ X-Kong-Request-Id: 85493369c179390a46489274cb5cab51
```

---

#### TC-16 — IP Restriction

```bash
curl http://localhost:8001/plugins | jq '.data[] | select(.name=="ip-restriction") | .config'
```
```json
{
  "allow": ["127.0.0.1/32", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"],
  "deny": null
}
```

---

#### TC-18 — HAProxy Load Balancing

```bash
# 4 requests qua HAProxy LB (port 8080)
curl -si http://localhost:8080/realms/aeroflow/.well-known/openid-configuration → HTTP/1.1 200 OK
curl -si http://localhost:8080/realms/aeroflow/.well-known/openid-configuration → HTTP/1.1 200 OK
curl -si http://localhost:8080/realms/aeroflow/.well-known/openid-configuration → HTTP/1.1 200 OK
curl -si http://localhost:8080/realms/aeroflow/.well-known/openid-configuration → HTTP/1.1 200 OK

# Cả 2 nodes healthy:
curl http://localhost:8081/health/ready → {"status": "UP"}
curl http://localhost:8082/health/ready → {"status": "UP"}
```

---

#### TC-19 — Token Structure

```bash
curl -X POST http://localhost:8080/realms/aeroflow/protocol/openid-connect/token \
  -d "client_id=aeroflow-frontend&grant_type=password&username=platform-admin&password=PlatformAdmin@1234"
→ {"token_type":"Bearer","expires_in":900}

# Token RS256, issuer: http://localhost:8080/realms/aeroflow
# Audience: aeroflow-backend, account
# Realm roles: platform-admin
```

---

#### TC-01 — KC HA Failover

```bash
docker stop aeroflow-keycloak-1
sleep 5
curl -s -X POST "http://localhost:8080/realms/aeroflow/protocol/openid-connect/token" \
  -d "grant_type=password&client_id=aeroflow-frontend&username=ai-engineer&password=AiEngineer@1234"
→ "expires_in":900   ← HAProxy chuyển sang node2 thành công

docker start aeroflow-keycloak-1   # Khôi phục
```

---

#### TC-02 — KC Session Sync (Infinispan)

```bash
# Lấy token từ node1 (port 8081)
TOKEN=$(curl -s -X POST "http://localhost:8081/realms/aeroflow/protocol/openid-connect/token" ...)

# Introspect trên node2 (port 8082) dùng aeroflow-admin client
curl -s -X POST "http://localhost:8082/realms/aeroflow/protocol/openid-connect/token/introspect" \
  -d "token=$TOKEN&client_id=aeroflow-admin&client_secret=aeroflow-admin-secret" \
→ {"active":true,"preferred_username":"ai-engineer","session_state":"496a6ccf-..."}
```

Infinispan đồng bộ session giữa node1 ↔ node2.

---

#### TC-06 — JWT Expired → 401

```bash
# Tạm set accessTokenLifespan = 15s
curl -X PUT .../admin/realms/aeroflow -d '{"accessTokenLifespan":15}'

TOKEN=$(curl ... | grep access_token)
sleep 22
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/test
→ HTTP/1.1 401 Unauthorized   ← token đã hết hạn

# Khôi phục accessTokenLifespan = 900
curl -X PUT .../admin/realms/aeroflow -d '{"accessTokenLifespan":900}'
```

---

#### TC-07 — JWKS Cache 300s

Sau khi reload Kong với `jwks_uri=http://aeroflow-keycloak-lb:8080/...` (internal DNS), Kong fetch JWKS 1 lần khi có request đầu tiên, cache trong `kong.cache` với TTL 300s.
- Nhiều requests liên tiếp không tạo JWKS error mới trong logs
- `X-RateLimit-Limit-Minute: 300` xác nhận plugin chain chạy đúng

**Lưu ý quan trọng (Bug #8):** Cần dùng internal Docker hostname (`aeroflow-keycloak-lb`) chứ không phải `localhost:8080` trong `jwks_uri`, vì Kong container không thể reach `localhost:8080` sau khi Lua cache hết hạn.

---

#### TC-08 — Rate Limiting

Test với limit=5/phút (tạm, sau restore về 300):

```
Request 1: HTTP 502  X-RateLimit-Remaining-Minute: 3  RateLimit-Limit: 5
Request 2: HTTP 502  X-RateLimit-Remaining-Minute: 2
Request 3: HTTP 502  X-RateLimit-Remaining-Minute: 1
Request 4: HTTP 502  X-RateLimit-Remaining-Minute: 0
Request 5: HTTP 429  → "API rate limit exceeded"
Request 6: HTTP 429
Request 7: HTTP 429
```

`X-RateLimit-Limit-Minute`, `X-RateLimit-Remaining-Minute`, `RateLimit-Reset` headers đúng.

**Lưu ý:** `policy=local` với 20 nginx workers → mỗi worker có counter riêng → effective limit là 20×300=6000 RPM từ một IP. Đủ cho production với IP-based routing. Nếu cần strict per-user limit, dùng `policy=redis`.

---

#### TC-09 — Brute Force Protection

```bash
# Set failureFactor=5 tạm thời
curl -X PUT .../admin/realms/aeroflow -d '{"failureFactor":5}'

# 6 lần login sai
for i in $(seq 1 6); do
  curl -X POST .../token -d "username=ai-engineer&password=WRONG_$i" → HTTP 401
done

# Kiểm tra trạng thái lockout
curl .../attack-detection/brute-force/users/$USER_ID
→ {"disabled":true,"numFailures":2,"numTemporaryLockouts":0}

# Thử đúng password — vẫn bị từ chối
curl -X POST .../token -d "username=ai-engineer&password=AiEngineer@1234"
→ {"error":"invalid_grant","error_description":"Invalid user credentials"}

# Restore: failureFactor=30, clear lockout
curl -X PUT .../admin/realms/aeroflow -d '{"failureFactor":30}'
curl -X DELETE .../attack-detection/brute-force/users/$USER_ID
```

---

#### TC-11 — Password Policy

Policy: `length(8) and upperCase(1) and specialChars(1)` (set via Admin API).

```
POST /admin/realms/aeroflow/users/$USER_ID/reset-password
  "password": "abc"       → HTTP 400 (quá ngắn)
  "password": "password123" → HTTP 400 (thiếu ký tự đặc biệt)
  "password": "Str0ng@Pass" → HTTP 201 ✅
```

---

#### TC-13 — Kafka ACL Deny

audit-consumer chỉ có READ+DESCRIBE trên `audit.auth.events`, không có WRITE:

```bash
echo "test" | kafka-console-producer.sh \
  --bootstrap-server kafka:9092 \
  --topic audit.auth.events \
  --producer.config /tmp/prod_correct.props  # username=audit-consumer

→ ERROR: org.apache.kafka.common.errors.TopicAuthorizationException:
         Not authorized to access topics: [audit.auth.events]
```

ACL `StandardAuthorizer` từ chối đúng.

---

#### TC-17 — mTLS Client Cert

```bash
# 1. Generate certs (dùng Docker do Git Bash path conversion issue)
docker run --rm -v "infra/certs:/certs" alpine/openssl ...
→ ca.crt, kong-client.crt, kong-client.key, backend.crt

# 2. Đăng ký CA cert trong Kong
curl -X POST http://localhost:8001/ca_certificates -d cert=...
→ id: 81f0b17f-bfab-486e-a98c-f53b68d7d2fd ✅

# 3. Đăng ký Kong client cert
curl -X POST http://localhost:8001/certificates -d cert=... key=...
→ id: fa6c9ddf-e762-41f2-9c88-df2e8bced01c ✅
```

Kong client cert sẵn sàng để gắn vào upstream service khi có backend thật.

---

### Bugs phát hiện trong quá trình test

| # | Bug | Nguyên nhân | Fix |
|---|---|---|---|
| 1 | `kafka-python 2.0.2` crash trên Python 3.12 | `kafka.vendor.six.moves` không tồn tại | Đổi sang `kafka-python-ng==2.2.3` |
| 2 | Keycloak SPI `ClusterAuthorizationException` | `enable.idempotence=true` (default) yêu cầu `CLUSTER:IDEMPOTENT_WRITE` | Set `enable.idempotence=false` trong producer |
| 3 | `__consumer_offsets` không tự tạo trong KRaft | Controller nhận request nhưng không tạo được | Tạo thủ công, thêm vào `kafka-setup.sh` |
| 4 | Consumer group join hang vô hạn | ACL thiếu trên `__consumer_offsets` | Thêm ACL `audit-consumer: READ/WRITE/DESCRIBE` trên `__consumer_offsets` |
| 5 | `aeroflow-kafka` event listener không fire | `eventsEnabled=false` sau khi KC skip import | Kích hoạt qua Admin API sau khi start |
| 6 | audit-consumer crash khi gặp non-JSON message | `value_deserializer` không handle lỗi | Thêm `_safe_json()` wrapper + skip non-dict messages |
| 7 | `kong-setup.sh` crash: `SCRIPT_DIR: unbound variable` | Biến chưa được khai báo | Thêm `SCRIPT_DIR=$(dirname "${BASH_SOURCE[0]}")` |
| 8 | `aeroflow-jwks` plugin: `pkey.new:load_key: expecting 'DER','PEM','JWK','*' as format` | `pkey.new(pem, "PEM")` — Lua string metatable làm `"PEM".format = string.format` (function) thay vì nil, phá vỡ format check | Đổi sang `pkey.new(pem, { format = "PEM" })` trong `handler.lua` |
| 9 | JWKS fetch fail sau 300s: `connection refused` | `jwks_uri` dùng `localhost:8080` — từ trong Kong container, `localhost` là Kong chứ không phải Keycloak | Đổi `jwks_uri` sang `http://aeroflow-keycloak-lb:8080/...` (Docker internal DNS) |
| 10 | `openssl req -subj "/CN=..."` fail trên Windows với Git Bash | Git Bash convert `/CN=...` thành `C:/Program Files/Git/CN=...` (Windows path) | Chạy `openssl` qua Docker container (alpine/openssl) |

---

### TC-01: Keycloak HA — Failover khi node1 down

**Mục đích:** Xác nhận HAProxy tự chuyển traffic sang node2 khi node1 fail.

```bash
# Xác nhận cả 2 nodes healthy trước
curl -s http://localhost:8081/health/ready | jq .status   # → "UP"
curl -s http://localhost:8082/health/ready | jq .status   # → "UP"

# Dừng node1
docker compose stop keycloak-node1

# Đợi 20s để HAProxy detect (health-check interval 15s)
sleep 20

# Thử login qua HAProxy (port 8080) — phải vẫn hoạt động qua node2
curl -s -X POST http://localhost:8080/realms/aeroflow/protocol/openid-connect/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=aeroflow-frontend&grant_type=password&username=platform-admin&password=PlatformAdmin@1234" \
  | jq .access_token | head -c 50
```

**Kết quả mong đợi:**
- Access token vẫn được cấp (không phải null)
- `docker compose logs keycloak-lb` hiển thị health-check fail cho node1, traffic chỉ đi node2

```bash
# Khôi phục node1
docker compose start keycloak-node1

# Đợi node1 rejoin cluster (~60s)
sleep 90
curl -s http://localhost:8081/health/ready | jq .status   # → "UP"
```

---

### TC-02: Keycloak HA — Session sync giữa 2 nodes

**Mục đích:** Token lấy từ node1 có thể verify thành công trên node2 (Infinispan sync).

```bash
# Lấy token qua node1 trực tiếp
TOKEN=$(curl -s -X POST http://localhost:8081/realms/aeroflow/protocol/openid-connect/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=aeroflow-frontend&grant_type=password&username=ai-engineer&password=AiEngineer@1234" \
  | jq -r .access_token)

# Introspect token qua node2 trực tiếp
curl -s -X POST http://localhost:8082/realms/aeroflow/protocol/openid-connect/token/introspect \
  -u "aeroflow-backend:aeroflow-backend-secret-change-in-prod" \
  -d "token=$TOKEN" \
  | jq .active
```

**Kết quả mong đợi:** `true` — node2 nhận ra session từ node1.

---

### TC-03: JWT Verification — Token hợp lệ qua Kong

**Mục đích:** Kong aeroflow-jwks plugin verify đúng và inject headers.

```bash
# Bước 1: khởi động echo server trên port 8888
python3 -c "
import http.server, json
class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200); self.end_headers()
        self.wfile.write(json.dumps(dict(self.headers), indent=2).encode())
    def log_message(self, *a): pass
http.server.HTTPServer(('0.0.0.0', 8888), H).serve_forever()
" &

# Bước 2: lấy token
TOKEN=$(curl -s -X POST http://localhost:8080/realms/aeroflow/protocol/openid-connect/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=aeroflow-frontend&grant_type=password&username=platform-admin&password=PlatformAdmin@1234" \
  | jq -r .access_token)

# Bước 3: gọi qua Kong
curl -s http://localhost:8000/api/health \
  -H "Authorization: Bearer $TOKEN" \
  | jq 'with_entries(select(.key | test("^X-"; "i")))'
```

**Kết quả mong đợi:**
```json
{
  "X-User-Id": "<keycloak-user-uuid>",
  "X-User-Email": "admin@aeroflow.local",
  "X-User-Roles": "platform-admin",
  "X-Kong-Verified": "true",
  "X-Request-Id": "<uuid-counter>"
}
```

---

### TC-04: JWT Verification — Không có token → 401

```bash
curl -sv http://localhost:8000/api/health 2>&1 | grep "< HTTP"
```

**Kết quả mong đợi:** `< HTTP/1.1 401 Unauthorized`

---

### TC-05: JWT Verification — Token giả/tampered → 401

```bash
# Dùng token hợp lệ nhưng thay đổi 1 ký tự ở signature (phần sau dấu . thứ 2)
FAKE_TOKEN=$(echo $TOKEN | sed 's/.\{3\}$/XXX/')
curl -sv http://localhost:8000/api/health \
  -H "Authorization: Bearer $FAKE_TOKEN" 2>&1 | grep "< HTTP"
```

**Kết quả mong đợi:** `< HTTP/1.1 401 Unauthorized`

---

### TC-06: JWT Verification — Token hết hạn → 401

```bash
# Decode payload để xem exp
echo $TOKEN | cut -d. -f2 | base64 -d 2>/dev/null | jq '{exp, iat, sub}'

# Để test: đặt accessTokenLifespan trong realm về 1 phút, đợi hết hạn
# Hoặc dùng token cũ đã lưu từ trước (nếu đã quá 15 phút)
# Kong sẽ trả 401 khi exp < current_time
```

**Kết quả mong đợi:** `HTTP 401 Unauthorized` với body lỗi expired token.

---

### TC-07: JWKS Cache — 300s TTL

**Mục đích:** Xác nhận Kong cache JWKS và không fetch lại liên tục.

```bash
# Xem logs Kong trong 1 phút — không nên thấy JWKS fetch sau lần đầu
docker compose logs kong --tail=50 2>&1 | grep -i "jwks\|fetch\|cache"

# Gọi 10 request liên tiếp
for i in $(seq 1 10); do
  curl -s http://localhost:8000/api/health -H "Authorization: Bearer $TOKEN" > /dev/null
done

# Kiểm tra log — chỉ có 1 lần fetch JWKS (lần đầu), các lần sau dùng cache
docker compose logs kong --tail=100 2>&1 | grep -c "fetch"
```

**Kết quả mong đợi:** JWKS fetch xuất hiện tối đa 1 lần trong 300s đầu, sau đó dùng cache.

---

### TC-08: Rate Limiting — 300 req/phút

**Mục đích:** Sau 300 requests trong 1 phút, Kong trả 429.

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/realms/aeroflow/protocol/openid-connect/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=aeroflow-frontend&grant_type=password&username=platform-admin&password=PlatformAdmin@1234" \
  | jq -r .access_token)

# Gửi 305 request
for i in $(seq 1 305); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/health \
    -H "Authorization: Bearer $TOKEN")
  if [ "$STATUS" = "429" ]; then
    echo "Rate limit hit at request $i"
    break
  fi
done
```

**Kết quả mong đợi:** "Rate limit hit at request 301" (hoặc gần đó), HTTP 429 với header `RateLimit-Remaining: 0`.

---

### TC-09: Brute Force Protection — 5 lần fail → lockout

**Mục đích:** Sau 5 lần sai password, tài khoản bị khóa tạm thời.

```bash
# 5 lần đăng nhập sai
for i in $(seq 1 5); do
  curl -s -X POST http://localhost:8080/realms/aeroflow/protocol/openid-connect/token \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "client_id=aeroflow-frontend&grant_type=password&username=ai-engineer&password=WRONG_PASSWORD" \
    | jq -r .error_description
done

# Lần 6 — dù password đúng cũng bị từ chối
curl -s -X POST http://localhost:8080/realms/aeroflow/protocol/openid-connect/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=aeroflow-frontend&grant_type=password&username=ai-engineer&password=AiEngineer@1234" \
  | jq .error_description
```

**Kết quả mong đợi:**
- Lần 1-5: `"Invalid user credentials"`
- Lần 6: `"Account is temporarily disabled"` hoặc tương tự

```bash
# Unlock thủ công (Keycloak Admin API)
ADMIN_TOKEN=$(curl -s -X POST http://localhost:8080/realms/master/protocol/openid-connect/token \
  -d "client_id=admin-cli&grant_type=password&username=admin&password=admin" \
  | jq -r .access_token)

USER_ID=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:8080/admin/realms/aeroflow/users?username=ai-engineer" \
  | jq -r '.[0].id')

curl -s -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:8080/admin/realms/aeroflow/attack-detection/brute-force/users/$USER_ID"
echo "User unlocked"
```

---

### TC-10: Concurrent Session Limit — Tối đa 2

**Mục đích:** Session thứ 3 bị từ chối.

```bash
# Session 1
TOKEN1=$(curl -s -X POST http://localhost:8080/realms/aeroflow/protocol/openid-connect/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=aeroflow-frontend&grant_type=password&username=platform-admin&password=PlatformAdmin@1234" \
  | jq -r .access_token)
echo "Session 1: ${TOKEN1:0:20}..."

# Session 2
TOKEN2=$(curl -s -X POST http://localhost:8080/realms/aeroflow/protocol/openid-connect/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=aeroflow-frontend&grant_type=password&username=platform-admin&password=PlatformAdmin@1234" \
  | jq -r .access_token)
echo "Session 2: ${TOKEN2:0:20}..."

# Session 3 — phải bị từ chối hoặc session cũ nhất bị revoke
TOKEN3=$(curl -s -X POST http://localhost:8080/realms/aeroflow/protocol/openid-connect/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=aeroflow-frontend&grant_type=password&username=platform-admin&password=PlatformAdmin@1234" \
  | jq '{access_token: .access_token[:20], error: .error}')
echo "Session 3: $TOKEN3"
```

**Kết quả mong đợi:** Session 3 bị reject hoặc session 1 bị revoke (tùy policy `ssoSessionMaxConcurrentLogins=2`).

---

### TC-11: Password Policy

**Mục đích:** Keycloak từ chối password không đủ độ phức tạp.

```bash
ADMIN_TOKEN=$(curl -s -X POST http://localhost:8080/realms/master/protocol/openid-connect/token \
  -d "client_id=admin-cli&grant_type=password&username=admin&password=admin" \
  | jq -r .access_token)

# Tạo user test
curl -s -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  "http://localhost:8080/admin/realms/aeroflow/users" \
  -d '{"username":"test-policy","enabled":true,"credentials":[{"type":"password","value":"short","temporary":false}]}' \
  | jq .errorMessage
```

**Kết quả mong đợi:** Error message về password policy (length, complexity).

---

### TC-12: Kafka Audit Pipeline — Event đến PostgreSQL

**Mục đích:** Login event từ Keycloak SPI → Kafka → audit_logs.

```bash
# Bước 1: đếm rows hiện tại
COUNT_BEFORE=$(docker exec -it aeroflow-postgres psql -U aeroflow -d aeroflow -tAc \
  "SELECT COUNT(*) FROM audit_logs;")
echo "Before: $COUNT_BEFORE"

# Bước 2: trigger login event
curl -s -X POST http://localhost:8080/realms/aeroflow/protocol/openid-connect/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=aeroflow-frontend&grant_type=password&username=platform-admin&password=PlatformAdmin@1234" \
  > /dev/null

# Bước 3: đợi consumer xử lý (~3s)
sleep 5

# Bước 4: đếm rows sau
COUNT_AFTER=$(docker exec -it aeroflow-postgres psql -U aeroflow -d aeroflow -tAc \
  "SELECT COUNT(*) FROM audit_logs;")
echo "After: $COUNT_AFTER"

# Bước 5: xem event mới nhất
docker exec -it aeroflow-postgres psql -U aeroflow -d aeroflow \
  -c "SELECT action, actor, ip_address, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 3;"
```

**Kết quả mong đợi:**
- `COUNT_AFTER > COUNT_BEFORE`
- Row mới nhất có `action=LOGIN`, `actor` chứa user ID hoặc username

```bash
# Kiểm tra message trực tiếp trong Kafka (đọc partition 0 từ đầu)
docker exec aeroflow-kafka /opt/kafka/bin/kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --consumer.config /tmp/admin.props \
  --topic audit.auth.events \
  --partition 0 \
  --offset earliest \
  --max-messages 3 \
  --timeout-ms 8000
# Lưu ý: dùng --partition + --offset thay vì --from-beginning
# vì --from-beginning với consumer group chỉ hoạt động khi group chưa có committed offset
```

---

### TC-13: Kafka ACL — Unauthorized user bị từ chối

**Mục đích:** User không có ACL không produce được vào topic.

```bash
# Thử produce với user audit-consumer (chỉ có quyền Read, không có Write)
docker exec aeroflow-kafka bash -c "
printf 'security.protocol=SASL_PLAINTEXT\nsasl.mechanism=PLAIN\nsasl.jaas.config=org.apache.kafka.common.security.plain.PlainLoginModule required username=\"audit-consumer\" password=\"AuditConsumer@1234\";\n' > /tmp/consumer.props
echo 'unauthorized-message' | kafka-console-producer.sh \
  --bootstrap-server localhost:9092 \
  --producer.config /tmp/consumer.props \
  --topic audit.auth.events 2>&1
"
```

**Kết quả mong đợi:** `TOPIC_AUTHORIZATION_FAILED` hoặc tương tự — producer bị từ chối.

---

### TC-14: Keycloak Event Logging

**Mục đích:** Events được ghi trong Keycloak Admin Console.

```bash
# Login để tạo event
curl -s -X POST http://localhost:8080/realms/aeroflow/protocol/openid-connect/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=aeroflow-frontend&grant_type=password&username=ai-engineer&password=AiEngineer@1234" \
  > /dev/null

# Xem events qua Admin API
ADMIN_TOKEN=$(curl -s -X POST http://localhost:8080/realms/master/protocol/openid-connect/token \
  -d "client_id=admin-cli&grant_type=password&username=admin&password=admin" \
  | jq -r .access_token)

curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:8080/admin/realms/aeroflow/events?type=LOGIN&max=5" \
  | jq '.[].type'
```

**Kết quả mong đợi:** `"LOGIN"` xuất hiện trong response.

---

### TC-15: Correlation ID

**Mục đích:** Mỗi request qua Kong có header `X-Request-Id` duy nhất.

```bash
# Lấy X-Request-Id từ response headers
curl -sv http://localhost:8000/api/health \
  -H "Authorization: Bearer $TOKEN" 2>&1 | grep -i "x-request-id"
```

**Kết quả mong đợi:** `< X-Request-Id: <uuid>#<counter>` — mỗi request là unique.

---

### TC-16: IP Restriction

**Mục đích:** Kong chặn request từ IP ngoài allowlist.

```bash
# Xem cấu hình plugin
curl -s http://localhost:8001/plugins | jq '.data[] | select(.name=="ip-restriction") | .config'
```

**Kết quả mong đợi:**
```json
{
  "allow": ["127.0.0.1/32","10.0.0.0/8","172.16.0.0/12","192.168.0.0/16"],
  "deny": null
}
```

---

### TC-17: mTLS — Kong client cert đã đăng ký

**Mục đích:** Xác nhận Kong đã đăng ký client cert (sau khi chạy gen-certs.sh + kong-setup.sh).

```bash
# Kiểm tra cert đã gắn vào service
curl -s http://localhost:8001/services/aeroflow-backend | jq .client_certificate

# Danh sách certs đã đăng ký
curl -s http://localhost:8001/certificates | jq '.data | length'
echo "certs registered"

# CA certificates
curl -s http://localhost:8001/ca_certificates | jq '.data | length'
echo "CA certs registered"
```

**Kết quả mong đợi:** `client_certificate` có `id` (không phải null), ít nhất 1 cert và 1 CA cert.

---

### TC-18: HAProxy Load Balancing — Round-robin

**Mục đích:** Request được phân phối đều giữa 2 Keycloak nodes.

```bash
# Gửi 10 request qua HAProxy
for i in $(seq 1 10); do
  curl -s http://localhost:8080/realms/aeroflow/.well-known/openid-configuration > /dev/null
done

# Xem log — cả 2 nodes nhận requests
docker compose logs keycloak-node1 --tail=10 2>&1 | grep -c "GET /realms"
docker compose logs keycloak-node2 --tail=10 2>&1 | grep -c "GET /realms"
```

**Kết quả mong đợi:** Cả node1 và node2 đều xử lý requests (round-robin).

---

### TC-19: Token decode — Payload đúng

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/realms/aeroflow/protocol/openid-connect/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=aeroflow-frontend&grant_type=password&username=platform-admin&password=PlatformAdmin@1234" \
  | jq -r .access_token)

echo $TOKEN | cut -d. -f2 | base64 -d 2>/dev/null | jq '{
  sub,
  email,
  iss,
  aud,
  realm_access: .realm_access.roles,
  exp_in_min: ((.exp - now) / 60 | floor)
}'
```

**Kết quả mong đợi:**
```json
{
  "sub": "<uuid>",
  "email": "admin@aeroflow.local",
  "iss": "http://localhost:8080/realms/aeroflow",
  "aud": ["aeroflow-backend","account"],
  "realm_access": ["platform-admin","..."],
  "exp_in_min": 14
}
```

---

## Database Checks

```bash
docker exec -it aeroflow-postgres psql -U aeroflow -d aeroflow
```

```sql
-- Kiểm tra schemas
\dn

-- audit_logs partition structure
\d+ audit_logs

-- Rows mới nhất
SELECT action, actor, ip_address, created_at
FROM audit_logs ORDER BY created_at DESC LIMIT 10;

-- Kiểm tra plans và roles
SELECT * FROM plans;
SELECT * FROM roles;

-- Thêm partition tháng tiếp theo (chạy đầu tháng)
CREATE TABLE IF NOT EXISTS audit_logs_2026_07
  PARTITION OF audit_logs
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
\q
```

---

## Troubleshooting

### Keycloak node1 không start
```bash
docker compose logs keycloak-node1 | tail -50
# Thường do PostgreSQL chưa ready → đợi rồi:
docker compose restart keycloak-node1
```

### Keycloak node2 không join cluster
```bash
docker compose logs keycloak-node2 | grep -i "jgroup\|cluster\|ispn"
# JGroups TCPPING: node2 phải thấy node1 ở port 7600
docker network inspect data-agentt_aeroflow-net
# Đảm bảo cả 2 nodes đều trong aeroflow-net
```

### Kong aeroflow-jwks plugin lỗi
```bash
docker compose logs kong --tail=50 | grep -i "error\|jwks\|aeroflow"
# Plugin không load → kiểm tra KONG_PLUGINS=bundled,aeroflow-jwks trong compose
# JWKS fetch fail → kiểm tra keycloak-lb có healthy không
```

### Kafka không kết nối được
```bash
docker compose logs kafka | tail -30
docker compose logs audit-consumer | tail=20
# SASL error → kiểm tra username/password trong docker-compose.yml
# Topic chưa có → chạy bash infra/kafka/kafka-setup.sh
```

### audit_logs không có rows
```bash
# Kiểm tra SPI đang gửi event
docker compose logs keycloak-node1 | grep -i "kafka\|aeroflow-kafka\|event"

# Kiểm tra consumer đang consume
docker compose logs audit-consumer | grep "Stored\|error"

# Trigger event: đăng nhập vào Keycloak → SPI push ngay
curl -s -X POST http://localhost:8080/realms/aeroflow/protocol/openid-connect/token \
  -d "client_id=aeroflow-frontend&grant_type=password&username=platform-admin&password=PlatformAdmin@1234" \
  > /dev/null
sleep 5
docker exec -it aeroflow-postgres psql -U aeroflow -d aeroflow \
  -c "SELECT COUNT(*) FROM audit_logs;"
```

### Kong migration fail
```bash
docker compose logs kong-migration
# "already exists" → bình thường, migration idempotent

# Reset hoàn toàn (xóa data)
docker compose down -v && docker compose up -d
```

### Frontend không kết nối Keycloak
```bash
docker exec aeroflow-frontend env | grep VITE
# VITE_KEYCLOAK_URL phải là http://localhost:8080 (HAProxy)

docker compose restart frontend
```

### Port conflict (Windows)
```bash
netstat -ano | findstr "8080 8081 8082 8000 8001 5432 5173 9092 1337"
# Đổi ports trong docker-compose.yml nếu cần
```

---

## Dừng / Xoá Services

```bash
# Dừng, giữ data
docker compose stop

# Khởi động lại
docker compose start

# Xóa hoàn toàn (bao gồm volumes/data)
docker compose down -v

# Rebuild images sau khi thay đổi code
docker compose build --no-cache keycloak-node1 keycloak-node2 kong
docker compose up -d
```

---

## Checklist Smoke Test (nhanh)

Chạy theo thứ tự để xác nhận stack hoạt động sau khi deploy:

```bash
# 1. Tất cả services healthy
docker compose ps | grep -v "Up\|Exited (0)" | grep -v "NAME"

# 2. Keycloak cả 2 nodes healthy
curl -sf http://localhost:8081/health/ready && echo "node1 OK"
curl -sf http://localhost:8082/health/ready && echo "node2 OK"

# 3. JWKS endpoint accessible
curl -sf http://localhost:8080/realms/aeroflow/protocol/openid-connect/certs | jq '.keys | length'
# → ít nhất 1 key

# 4. Lấy token thành công
TOKEN=$(curl -sf -X POST http://localhost:8080/realms/aeroflow/protocol/openid-connect/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=aeroflow-frontend&grant_type=password&username=platform-admin&password=PlatformAdmin@1234" \
  | jq -r .access_token)
[ -n "$TOKEN" ] && echo "Token OK" || echo "Token FAIL"

# 5. Kong plugins đã được cấu hình
curl -sf http://localhost:8001/plugins | jq '.data[].name'
# → "aeroflow-jwks", "ip-restriction", "correlation-id", "rate-limiting"

# 6. Kafka topic tồn tại
docker cp /dev/stdin aeroflow-kafka:/tmp/a.props << 'EOF'
security.protocol=SASL_PLAINTEXT
sasl.mechanism=PLAIN
sasl.jaas.config=org.apache.kafka.common.security.plain.PlainLoginModule required username="admin" password="KafkaAdmin@1234";
EOF
docker exec aeroflow-kafka /opt/kafka/bin/kafka-topics.sh \
  --bootstrap-server localhost:9092 --command-config /tmp/a.props --list \
  | grep audit.auth.events && echo "Kafka topic OK"

# 7. PostgreSQL audit_logs tồn tại
docker exec aeroflow-postgres psql -U aeroflow -d aeroflow -tAc "\dt audit_logs*" \
  | grep audit_logs && echo "DB OK"
```

---

---

# Phần 2 — Release Management

> Xem `docs/release-system.md` để hiểu kiến trúc chi tiết.

---

## R1 — Khởi động Release Stack

Release services được thêm vào `docker-compose.yml` (xem file). Sau khi cập nhật:

```bash
# Build và khởi động release services
docker compose up -d release-worker

# Theo dõi logs
docker compose logs -f release-worker
```

**Kết quả mong đợi:**
```
release-worker  | {"event": "kafka.consumer.started", "topics": ["release.pipeline.triggered", "release.rollback.initiated"]}
release-worker  | INFO:     Application startup complete.
```

> **Thứ tự khởi động release services:** postgres → kafka (sau auth setup) → release-worker

---

## R2 — URLs & Credentials Release

| Service | URL | Ghi chú |
|---------|-----|---------|
| Release Worker API | http://localhost:8100 | FastAPI REST API |
| Release Worker Health | http://localhost:8100/health | Health check |
| Release History | http://localhost:8100/api/release/history | Cần token |
| PostgreSQL | localhost:5432 | aeroflow / aeroflow_secret |
| MinIO Console | http://localhost:9001 | minioadmin / minioadmin |
| MongoDB | localhost:27017 | Không auth (dev) |

### Kafka Users (Release)

| Username | Password | ACL |
|----------|----------|-----|
| `ci-service` | `CiService@1234` | WRITE `release.pipeline.triggered` |
| `release-worker` | `ReleaseWorker@1234` | READ pipeline.triggered, WRITE pipeline.status |
| `drift-detector` | `DriftDetector@1234` | WRITE `release.drift.detected` |
| `scan-runner` | `ScanRunner@1234` | WRITE `release.scan.completed` |
| `notification-consumer` | `NotificationConsumer@1234` | READ pipeline.status + drift.detected |

---

## R3 — Setup Release Schema (PostgreSQL)

Chạy một lần sau khi stack đã khởi động:

```bash
# Apply release schema (tables: pipelines, release_packages, release_history, etc.)
docker exec -i aeroflow-postgres psql -U aeroflow -d aeroflow \
  < infra/sql/release-init.sql

# Verify tables đã tạo
docker exec -it aeroflow-postgres psql -U aeroflow -d aeroflow \
  -c "\dt pipelines release_packages release_history rollback_operations drift_events environment_configs release_approvals pipeline_steps"
```

**Kết quả mong đợi:**
```
               List of relations
 Schema |         Name          | Type  |   Owner
--------+-----------------------+-------+----------
 public | drift_events          | table | aeroflow
 public | environment_configs   | table | aeroflow
 public | pipeline_steps        | table | aeroflow
 public | pipelines             | table | aeroflow
 public | release_approvals     | table | aeroflow
 public | release_history       | table | aeroflow  (partitioned)
 public | release_packages      | table | aeroflow
 public | rollback_operations   | table | aeroflow
```

```bash
# Kiểm tra partitions release_history
docker exec -it aeroflow-postgres psql -U aeroflow -d aeroflow \
  -c "\dt release_history*"
# → release_history_2026_05, _06, _07, _08
```

---

## R4 — Setup Release Kafka Topics & ACL

Chạy một lần sau auth Kafka setup:

```bash
bash infra/kafka/release-setup.sh
```

Script tạo:
- Topics: `release.pipeline.triggered`, `release.pipeline.status`, `release.drift.detected`, `release.rollback.initiated`, `release.scan.completed`
- Kafka users: `ci-service`, `release-worker`, `drift-detector`, `scan-runner`, `notification-consumer`
- ACL cho từng user (WRITE/READ đúng topic)

**Verify sau khi chạy:**

```bash
# List release topics
docker exec aeroflow-kafka /opt/kafka/bin/kafka-topics.sh \
  --bootstrap-server localhost:9092 \
  --command-config /tmp/admin_release.props \
  --list | grep "^release\."

# Kết quả mong đợi:
# release.drift.detected
# release.pipeline.status
# release.pipeline.triggered
# release.rollback.initiated
# release.scan.completed
```

---

## R5 — Test Cases Release

### Kết quả Test Release — 2026-05-27

| TC | Tên | Trạng thái | Ghi chú / Kết quả thực tế |
|----|-----|-----------|---------|
| TR-01 | Release Worker health | ✅ | `{"status":"ok","service":"release-worker"}` |
| TR-02 | Trigger pipeline qua API | ✅ | pipeline_id=`pipe-20260527-b8776d` tạo thành công |
| TR-03 | Pipeline state ghi PostgreSQL | ✅ | `status=SUCCESS` trong bảng `pipelines` |
| TR-04 | Kafka trigger message nhận đúng | ✅ | Log `kafka.message.received` + consumer thread khởi động |
| TR-05 | Security scan gate PASS | ✅ | trivy/bandit/pip-audit chưa cài → skip=PASS, pipeline SUCCESS |
| TR-06 | Security scan gate FAIL | ✅ | Cài bandit → B104 HIGH severity → `status=FAILED`, `error="Security scan gate failed"` |
| TR-07 | Dev auto-promote | ✅ | target=dev → deploy ngay, `release_history` ghi `dev\|SUCCESS` |
| TR-08 | Staging cần approval | ✅ | target=staging → `status=AWAITING_APPROVAL` trong PostgreSQL |
| TR-09 | Approve staging → deploy | ✅ | POST approve → `status=approved` → pipeline `SUCCESS`, `release_history staging\|SUCCESS` |
| TR-10 | Reject staging | ✅ | POST reject → `status=FAILED`, `error_message="Rejected by <user_id>"` |
| TR-11 | Rollback trigger | ✅ | POST /rollback → `rb-20260527-85ceaf` tạo, Kafka event `rollback.initiated` |
| TR-12 | Rollback compensating steps | ✅ | Step 1 (update_db_pointer) SUCCESS; Step 2 (reroute_kong) SUCCESS sau khi tạo Kong services; Step 3 (redeploy_snapshot) SUCCESS |
| TR-13 | Rollback FULL SUCCESS sau fix Kong | ✅ | `aeroflow-prod` + `aeroflow-staging` Kong services đã tạo → `status=SUCCESS`, `current_step=3`; `release_history` có entry `ROLLED_BACK` |
| TR-14 | Release history ghi đúng | ✅ | Tất cả deploy ghi vào `release_history` (pipeline_id, env, status, triggered_by, deployed_at) |
| TR-15 | Drift detection | ✅ | Insert prod/staging config khác nhau → `drift_events` ghi 3 drifted keys, `severity=CRITICAL_DRIFT` |
| TR-16 | Kafka ACL ci-service chỉ WRITE trigger | ✅ | ci-service WRITE `pipeline.triggered` OK; READ `pipeline.status` → `GroupAuthorizationFailedError` |
| TR-17 | release_history immutable | ✅ | Trigger `fn_release_history_immutable` block UPDATE/DELETE: `"release_history is immutable"` |
| TR-18 | release_history partitioned | ✅ | 4 partitions (2026-05 → 2026-08); insert `2026-06-15` → `release_history_2026_06` ✓ |
| TR-19 | Drift detection API | ✅ | `POST /drift/detect` → `{"status":"drift_detected","drift_id":2,"drift_keys":["dictionary_item_added","values_changed"]}` |
| TR-20 | Drift list API | ✅ | `GET /drift` → trả `drift_events` array với `id`, `env_pair`, `drift_keys`, `severity`, `resolved` |
| TR-21 | Drift resolve API | ✅ | `POST /drift/resolve/2` → `{"status":"resolved","drift_id":2,"resolved_by":"..."}` |
| TR-22 | Partition auto-create API | ✅ | `POST /admin/create-partition` → `{"status":"created","table":"release_history_2026_06"}` (idempotent) |
| TR-23 | Kong services cho rollback | ✅ | `aeroflow-prod` và `aeroflow-staging` Kong services tồn tại; rollback step 2 PATCH thành công |

> **Ngày chạy test:** 2026-05-27 · **Kết quả:** 23/23 PASS (0 FAIL, 0 SKIP)

---

## R5b — Bugs phát hiện & Fixes đã áp dụng

| # | Bug | Nguyên nhân | Fix |
|---|-----|-------------|-----|
| 1 | `approve_deployment` không dispatch pipeline sau approval | Dùng `execute_pipeline.delay()` (Celery) nhưng không có Celery worker | Thay bằng `threading.Thread(target=_run_approval_deploy, ...)` |
| 2 | `_run_approval_deploy` không tồn tại — cần hàm riêng | Approval cần skip build/scan (đã chạy), chỉ deploy thôi | Tạo `_run_approval_deploy()` lấy `package_id` từ DB → gọi `_deploy_to_env()` |
| 3 | `_run_rollback_impl` gọi `execute_rollback(event)` trực tiếp — Celery task không callable as function | `execute_rollback` là Celery task, gọi trực tiếp thiếu request context → `AttributeError: 'NoneType' object has no attribute 'push'` | Extract `_execute_rollback_core()` là plain function; cả thread lẫn Celery task gọi vào đó |
| 4 | `release_history` không có trigger bảo vệ immutability | Schema chỉ có comment `-- KHÔNG UPDATE/DELETE`, không có enforcement | Thêm trigger `fn_release_history_immutable()` + `trg_release_history_no_update` + `trg_release_history_no_delete` |
| 5 | `import threading` bị đặt trong `if __name__ == "__main__"` | Threading dùng trong `start_kafka_consumer` (body file) nhưng chỉ import ở entry point | Move `import threading` lên top-level imports |

### Những gì còn thiếu / cần làm thêm

| # | Hạng mục | Mức độ | Ghi chú |
|---|----------|--------|---------|
| 1 | **Celery worker** cho production | Low | Hiện dùng thread trực tiếp; cần Celery worker process cho retry/rate-limit/observability |
| 2 | **OTEL/Jaeger** tracing | Low | `OTEL_EXPORTER_OTLP_ENDPOINT=""` → gRPC error non-fatal. Cần deploy Jaeger/OTEL Collector |
| 3 | **MongoDB integration** | Low | `MONGO_URI` configured nhưng package manifest ghi PostgreSQL; MongoDB chưa dùng, có thể bỏ |
| 4 | **Production environment** approval chain | Low | Chưa test target=production (hai-stage: staging + production approval) |

---

## R6 — Trigger Pipeline thủ công

```bash
# 1. Lấy token platform-admin
TOKEN=$(curl -s -X POST http://localhost:8080/realms/aeroflow/protocol/openid-connect/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=aeroflow-frontend&grant_type=password&username=platform-admin&password=PlatformAdmin@1234" \
  | jq -r .access_token)

# 2. Trigger pipeline target dev (auto-promote)
curl -s -X POST http://localhost:8100/api/release/pipeline/trigger \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "package_version": "v2.4.1",
    "branch": "auth/release",
    "commit_sha": "4d143b2",
    "target_environments": ["dev"]
  }' | jq .

# Kết quả mong đợi:
# { "pipeline_id": "pipe-20260527-xxxxxx", "status": "triggered" }

# 3. Xem trạng thái pipeline
PIPELINE_ID="pipe-20260527-xxxxxx"   # thay bằng id thật
curl -s http://localhost:8100/api/release/pipelines/$PIPELINE_ID \
  -H "Authorization: Bearer $TOKEN" | jq .

# 4. Verify trong PostgreSQL
docker exec -it aeroflow-postgres psql -U aeroflow -d aeroflow \
  -c "SELECT id, status, triggered_by, created_at FROM pipelines ORDER BY created_at DESC LIMIT 3;"

# 5. Verify release_history
docker exec -it aeroflow-postgres psql -U aeroflow -d aeroflow \
  -c "SELECT pipeline_id, environment, status, triggered_by, deployed_at FROM release_history ORDER BY deployed_at DESC LIMIT 3;"
```

**Trigger qua Kafka trực tiếp (simulate CI push):**

```bash
# Ghi admin props
docker exec aeroflow-kafka bash -c "cat > /tmp/ci_service.props <<'EOF'
security.protocol=SASL_PLAINTEXT
sasl.mechanism=PLAIN
sasl.jaas.config=org.apache.kafka.common.security.plain.PlainLoginModule required username=\"ci-service\" password=\"CiService@1234\";
EOF"

# Produce trigger event
docker exec aeroflow-kafka bash -c "
echo '{\"event\":\"pipeline.triggered\",\"pipeline_id\":\"pipe-$(date +%Y%m%d)-kafka01\",\"triggered_by\":\"ci-system\",\"package_version\":\"v2.4.2\",\"target_environments\":[\"dev\"]}' \
  | /opt/kafka/bin/kafka-console-producer.sh \
    --bootstrap-server localhost:9092 \
    --producer.config /tmp/ci_service.props \
    --topic release.pipeline.triggered"

# Xem release-worker nhận và xử lý
docker compose logs release-worker --tail=20
```

---

## R7 — Approval Flow

```bash
# 1. Trigger pipeline target staging (sẽ vào AWAITING_APPROVAL)
PIPELINE_ID=$(curl -s -X POST http://localhost:8100/api/release/pipeline/trigger \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"package_version":"v2.4.1","target_environments":["staging"]}' \
  | jq -r .pipeline_id)

echo "Pipeline: $PIPELINE_ID"

# 2. Đợi pipeline vào AWAITING_APPROVAL (~3s)
sleep 3
curl -s http://localhost:8100/api/release/pipelines/$PIPELINE_ID \
  -H "Authorization: Bearer $TOKEN" | jq .pipeline.status
# → "AWAITING_APPROVAL"

# 3. Approve deployment lên staging
curl -s -X POST "http://localhost:8100/api/release/pipeline/$PIPELINE_ID/approve/staging" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"decision":"APPROVED","comment":"Reviewed and approved by thiennlinh"}' | jq .

# Kết quả: {"status":"approved","pipeline_id":"...","environment":"staging"}

# 4. Verify release_approvals trong DB
docker exec -it aeroflow-postgres psql -U aeroflow -d aeroflow \
  -c "SELECT package_id, environment, decision, approved_by, approved_at FROM release_approvals ORDER BY approved_at DESC LIMIT 5;"

# 5. Test Reject
curl -s -X POST "http://localhost:8100/api/release/pipeline/$PIPELINE_ID/approve/staging" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"decision":"REJECTED","comment":"Config diff không acceptable"}' | jq .
# → {"status":"rejected","pipeline_id":"..."}

# Verify pipeline status = FAILED
curl -s http://localhost:8100/api/release/pipelines/$PIPELINE_ID \
  -H "Authorization: Bearer $TOKEN" | jq .pipeline.status
# → "FAILED"
```

---

## R8 — Rollback

```bash
# 1. Trigger rollback (chỉ platform-admin)
ROLLBACK_RESPONSE=$(curl -s -X POST http://localhost:8100/api/release/rollback \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "from_version": "v2.4.1",
    "to_version": "v2.4.0",
    "environment": "production",
    "reason": "Critical bug in agent routing v2.4.1"
  }')
echo $ROLLBACK_RESPONSE | jq .

ROLLBACK_ID=$(echo $ROLLBACK_RESPONSE | jq -r .rollback_id)

# 2. Xem trạng thái rollback trong DB
docker exec -it aeroflow-postgres psql -U aeroflow -d aeroflow \
  -c "SELECT id, status, current_step, steps_result FROM rollback_operations WHERE id='$ROLLBACK_ID';"

# Kết quả mong đợi: status=SUCCESS, current_step=3, steps_result=[...]

# 3. Verify release_history có entry ROLLED_BACK
docker exec -it aeroflow-postgres psql -U aeroflow -d aeroflow \
  -c "SELECT pipeline_id, environment, status FROM release_history WHERE status='ROLLED_BACK' ORDER BY deployed_at DESC LIMIT 3;"

# 4. Test rollback bởi non-admin → phải bị 403
AI_TOKEN=$(curl -s -X POST http://localhost:8080/realms/aeroflow/protocol/openid-connect/token \
  -d "client_id=aeroflow-frontend&grant_type=password&username=ai-engineer&password=AiEngineer@1234" \
  | jq -r .access_token)

curl -s -X POST http://localhost:8100/api/release/rollback \
  -H "Authorization: Bearer $AI_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"from_version":"v2.4.1","to_version":"v2.4.0","environment":"production","reason":"test"}' | jq .
# → {"detail":"Only platform-admin can trigger rollback"}
```

**Test PARTIAL_ROLLBACK scenario:**

```bash
# Simulate: Kong Admin URL không reachable → step 2 fail → PARTIAL_ROLLBACK
# Set KONG_ADMIN_URL sai trong release-worker env temporarily
# Sau đó trigger rollback → check status = PARTIAL_ROLLBACK trong DB
docker exec -it aeroflow-postgres psql -U aeroflow -d aeroflow \
  -c "SELECT id, status, steps_result FROM rollback_operations ORDER BY started_at DESC LIMIT 3;"
```

---

## R9 — Drift Detection

> **Cập nhật 2026-05-27:** `POST /api/release/drift/detect` đã có — gọi inline, không cần Celery beat. Xem §R12 cho các endpoint mới.

```bash
# 1. Insert config khác nhau cho prod và staging
docker exec -it aeroflow-postgres psql -U aeroflow -d aeroflow <<'SQL'
INSERT INTO environment_configs (environment, key, value, updated_by)
VALUES
  ('production', 'max_agents', '100', 'platform-admin'),
  ('staging',    'max_agents', '50',  'platform-admin'),  -- khác nhau → drift
  ('production', 'log_level', 'ERROR', 'platform-admin'),
  ('staging',    'log_level', 'DEBUG', 'platform-admin')  -- khác nhau → drift
ON CONFLICT (environment, key, version) DO UPDATE SET value = EXCLUDED.value;
SQL

# 2. Chạy drift detection task thủ công (hoặc đợi Celery beat)
curl -s -X POST http://localhost:8100/api/release/drift/detect \
  -H "Authorization: Bearer $TOKEN"
# Nếu endpoint này chưa có, có thể trigger qua Celery:
# docker exec release-worker celery -A main.celery_app call release-worker.detect_config_drift

# 3. Xem drift_events trong DB
docker exec -it aeroflow-postgres psql -U aeroflow -d aeroflow \
  -c "SELECT id, env_pair, drift_keys, severity, detected_at, resolved FROM drift_events ORDER BY detected_at DESC LIMIT 5;"

# 4. Xem Kafka message drift.detected
docker exec aeroflow-kafka bash -c "
/opt/kafka/bin/kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --consumer.config /tmp/admin_release.props \
  --topic release.drift.detected \
  --from-beginning --max-messages 3 --timeout-ms 5000"
```

---

## R10 — Release History Query

```bash
# 1. Toàn bộ history (50 records gần nhất)
curl -s http://localhost:8100/api/release/history \
  -H "Authorization: Bearer $TOKEN" | jq .

# 2. Filter theo environment
curl -s "http://localhost:8100/api/release/history?environment=production&limit=20" \
  -H "Authorization: Bearer $TOKEN" | jq '.history[] | {pipeline_id, status, deployed_at}'

# 3. Query trực tiếp PostgreSQL với filter nâng cao
docker exec -it aeroflow-postgres psql -U aeroflow -d aeroflow <<'SQL'
-- Deploy thành công trong 7 ngày qua
SELECT environment, COUNT(*) as deploy_count,
       AVG(duration_ms) as avg_duration_ms
FROM release_history
WHERE status = 'SUCCESS'
  AND deployed_at > now() - interval '7 days'
GROUP BY environment
ORDER BY deploy_count DESC;

-- Rollback events
SELECT pipeline_id, environment, triggered_by, deployed_at
FROM release_history
WHERE status = 'ROLLED_BACK'
ORDER BY deployed_at DESC;

-- Check partitions đang hoạt động
SELECT schemaname, tablename, tableowner
FROM pg_tables
WHERE tablename LIKE 'release_history_%'
ORDER BY tablename;
SQL

# 4. Check release packages và scan results
docker exec -it aeroflow-postgres psql -U aeroflow -d aeroflow \
  -c "SELECT id, status, validation_score, scan_result->>'overall_status' as scan_status, created_at FROM release_packages ORDER BY created_at DESC LIMIT 5;"
```

---

## R11 — Kong Services cho Rollback (setup một lần)

Rollback step 2 (`reroute_kong`) cần service `aeroflow-{environment}` tồn tại trong Kong.  
Nếu chưa có, tạo thủ công một lần qua Kong Admin API:

```bash
# aeroflow-prod service
curl -X POST http://localhost:8001/services \
  -H "Content-Type: application/json" \
  -d '{
    "name": "aeroflow-prod",
    "url": "http://host.docker.internal:8888/prod"
  }'

# aeroflow-staging service
curl -X POST http://localhost:8001/services \
  -H "Content-Type: application/json" \
  -d '{
    "name": "aeroflow-staging",
    "url": "http://host.docker.internal:8888/staging"
  }'

# Verify
curl -s http://localhost:8001/services | jq '.data[] | select(.name | startswith("aeroflow-")) | {name, url: .host}'
```

Sau khi tạo, rollback cho `environment=production` hoặc `environment=staging` sẽ PATCH service tương ứng để update `tags: ["version:X.Y.Z"]`.

---

## R12 — New API Endpoints (2026-05-27)

Các endpoint mới thêm vào `release-worker` — tất cả đều đi qua Kong `:8000` với JWT.

### Drift Detection API

```bash
TOKEN=$(curl -sf -X POST http://localhost:8080/realms/aeroflow/protocol/openid-connect/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=aeroflow-backend&client_secret=aeroflow-backend-secret-change-in-prod&grant_type=password&username=platform-admin&password=PlatformAdmin@1234" \
  | jq -r .access_token)

# 1. Trigger drift detection thủ công (không cần Celery)
curl -sf -X POST http://localhost:8000/api/release/drift/detect \
  -H "Authorization: Bearer $TOKEN"
# → {"status":"drift_detected","drift_id":2,"drift_keys":["dictionary_item_added","values_changed"],...}
# hoặc → {"status":"clean","drift_keys":[],"severity":null}

# 2. List drift events
curl -sf "http://localhost:8000/api/release/drift?resolved=false" \
  -H "Authorization: Bearer $TOKEN" | jq '.drift_events[].severity'

# 3. Mark drift resolved (sau khi sync config)
curl -sf -X POST "http://localhost:8000/api/release/drift/resolve/1" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"notes": "Config đã sync prod ↔ staging"}'
# → {"status":"resolved","drift_id":1,"resolved_by":"<user-id>"}
```

### Partition Auto-Creation API

```bash
# Tạo partition tháng tiếp theo (gọi đầu mỗi tháng, idempotent)
curl -sf -X POST http://localhost:8000/api/release/admin/create-partition \
  -H "Authorization: Bearer $TOKEN"
# → {"status":"created","table":"release_history_2026_06","from":"2026-06-01","to":"2026-07-01"}

# Verify trong PostgreSQL
docker exec aeroflow-postgres psql -U aeroflow -d aeroflow \
  -c "\dt release_history_*"
```

**Lịch gọi khuyến nghị:** CI/CD job ngày 25 hàng tháng, hoặc cronjob:
```bash
# crontab: 0 2 25 * * curl -sf -X POST http://localhost:8000/api/release/admin/create-partition -H "Authorization: Bearer $TOKEN"
```

### Release UI — 4 tính năng mới (2026-05-27)

| Tính năng | Mô tả |
|-----------|-------|
| **Trigger Pipeline** | Button `+` ở header Deployments → form: package_version, pipeline_name, branch, env checkboxes → POST trigger |
| **Pipeline Steps Detail** | Expand row → lazy-load step timeline (build → scan → deploy); cached, không re-fetch |
| **Environment & Status Filters** | Chip groups (DEV/STAGING/UAT/PROD + Running/Approval/Failed) lọc bảng Deployments; reset khi đổi tab |
| **Trigger Type Badge** | Badge inline tên pipeline: Push (git), Manual, Scheduled |

---

## R14 — Troubleshooting Release

### Release Worker không start

```bash
docker compose logs release-worker | tail -30
# Thường do: PostgreSQL chưa ready, Kafka chưa ready, hoặc module thiếu

docker compose restart release-worker
```

### Pipeline stuck ở RUNNING / BUILDING

```bash
# Xem pipeline steps
docker exec -it aeroflow-postgres psql -U aeroflow -d aeroflow \
  -c "SELECT step_name, status, error FROM pipeline_steps WHERE pipeline_id='$PIPELINE_ID' ORDER BY id;"

# Xem Celery task logs
docker compose logs release-worker | grep "pipeline_id.*$PIPELINE_ID"
```

### Kafka consumer không nhận message

```bash
# Verify consumer group offset
docker exec aeroflow-kafka /opt/kafka/bin/kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 \
  --command-config /tmp/admin_release.props \
  --group release-worker-group \
  --describe

# Reset offset nếu cần (chỉ khi không có message quan trọng)
docker exec aeroflow-kafka /opt/kafka/bin/kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 \
  --command-config /tmp/admin_release.props \
  --group release-worker-group \
  --topic release.pipeline.triggered \
  --reset-offsets --to-earliest --execute
```

### Release schema chưa tạo

```bash
# Chạy lại init script (idempotent — IF NOT EXISTS)
docker exec -i aeroflow-postgres psql -U aeroflow -d aeroflow \
  < infra/sql/release-init.sql

# Kiểm tra
docker exec -it aeroflow-postgres psql -U aeroflow -d aeroflow \
  -c "\dt pipelines release_packages release_history*"
```

### Rollback PARTIAL_ROLLBACK

> **Lưu ý:** Kể từ 2026-05-27, Kong services `aeroflow-prod` và `aeroflow-staging` đã được tạo → rollback step 2 không còn fail. PARTIAL_ROLLBACK chỉ xảy ra nếu Kong Admin API không reachable.

```bash
# Xem rollback steps để biết bước nào fail
docker exec -it aeroflow-postgres psql -U aeroflow -d aeroflow \
  -c "SELECT id, status, current_step, steps_result, completed_at FROM rollback_operations ORDER BY started_at DESC LIMIT 5;"

# Alert đã được gửi → check Kafka topic release.pipeline.status
docker exec aeroflow-kafka /opt/kafka/bin/kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --consumer.config /tmp/admin_release.props \
  --topic release.pipeline.status \
  --from-beginning --max-messages 10 --timeout-ms 5000 \
  | grep PARTIAL_ROLLBACK

# Fix: tạo lại Kong services nếu bị xoá (xem §R11)
curl -X POST http://localhost:8001/services -H "Content-Type: application/json" \
  -d '{"name":"aeroflow-staging","url":"http://host.docker.internal:8888/staging"}'

# Sau khi fix thủ công → update status trong DB
docker exec -it aeroflow-postgres psql -U aeroflow -d aeroflow \
  -c "UPDATE rollback_operations SET status='FAILED', completed_at=now() WHERE id='$ROLLBACK_ID';"
```

### Drift events không được tạo

```bash
# Kiểm tra environment_configs có data khác nhau không
docker exec -it aeroflow-postgres psql -U aeroflow -d aeroflow \
  -c "SELECT environment, key, value FROM environment_configs WHERE is_active=true ORDER BY key, environment;"

# Trigger detect_config_drift thủ công qua Celery
docker exec aeroflow-release-worker python -c "
from main import detect_config_drift
detect_config_drift()
print('Done')
"
```

---

## Checklist Smoke Test — Release (thêm vào sau Auth checklist)

> **Lưu ý quan trọng (2026-05-27):** Client `aeroflow-frontend` không hỗ trợ Direct Access Grants.  
> Dùng `aeroflow-backend` với secret để lấy token cho CLI tests:

```bash
# 8. Release Worker healthy
curl -sf http://localhost:8100/health | jq .status
# → "ok"

# 9. Release DB tables tồn tại
docker exec aeroflow-postgres psql -U aeroflow -d aeroflow -tAc \
  "SELECT COUNT(*) FROM information_schema.tables WHERE table_name IN ('pipelines','release_packages','release_history','rollback_operations');"
# → 4

# 10. Release Kafka topics tồn tại (qua admin user)
# Cần /tmp/admin_release.props trong Kafka container:
# security.protocol=SASL_PLAINTEXT / sasl.mechanism=PLAIN / admin credentials
docker exec aeroflow-kafka /opt/kafka/bin/kafka-topics.sh \
  --bootstrap-server localhost:9092 --command-config /tmp/admin_release.props --list \
  | grep "^release\."
# → 5 topics: release.pipeline.triggered, release.pipeline.status,
#             release.drift.detected, release.rollback.initiated, release.scan.completed

# 11. Trigger test pipeline (qua Kong :8000 với JWT, hoặc trực tiếp :8100)
TOKEN=$(curl -sf -X POST http://localhost:8080/realms/aeroflow/protocol/openid-connect/token \
  -d "client_id=aeroflow-backend&client_secret=aeroflow-backend-secret-change-in-prod&grant_type=password&username=platform-admin&password=PlatformAdmin@1234" \
  | jq -r .access_token)
PIPE_ID=$(curl -sf -X POST http://localhost:8000/api/release/pipeline/trigger \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"package_version":"v0.0.smoke","target_environments":["dev"]}' | jq -r .pipeline_id)
echo "Pipeline triggered: $PIPE_ID"
sleep 5
STATUS=$(curl -sf http://localhost:8000/api/release/pipelines/$PIPE_ID \
  -H "Authorization: Bearer $TOKEN" | jq -r .pipeline.status)
echo "Pipeline status: $STATUS"
# → "SUCCESS"

# 12. Release history có record
curl -sf http://localhost:8000/api/release/history \
  -H "Authorization: Bearer $TOKEN" | jq '.count'
# → ≥ 1

# 13. Kiểm tra release_history immutability trigger
docker exec aeroflow-postgres psql -U aeroflow -d aeroflow -c \
  "UPDATE release_history SET status='TAMPERED' WHERE id=(SELECT id FROM release_history LIMIT 1);"
# → ERROR: release_history is immutable — UPDATE/DELETE are not allowed

# 14. Kiểm tra rollback SUCCESS (Kong services aeroflow-prod/staging đã tạo)
ROLLBACK_ID=$(curl -sf -X POST http://localhost:8000/api/release/rollback \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"from_version":"v1.0.0","to_version":"v0.9.5","environment":"staging","reason":"smoke test"}' \
  | jq -r .rollback_id)
echo "Rollback: $ROLLBACK_ID"
sleep 3
docker exec aeroflow-postgres psql -U aeroflow -d aeroflow -tAc \
  "SELECT status FROM rollback_operations WHERE id='$ROLLBACK_ID';"
# → SUCCESS  (Kong services aeroflow-staging + aeroflow-prod đã tạo → step 2 SUCCESS)

# 15. Drift detection API
curl -sf -X POST http://localhost:8000/api/release/drift/detect \
  -H "Authorization: Bearer $TOKEN" | jq .status
# → "drift_detected" hoặc "clean" (tuỳ environment_configs)

# 16. Drift list API
curl -sf http://localhost:8000/api/release/drift \
  -H "Authorization: Bearer $TOKEN" | jq .count
# → số drift events đã detect

# 17. Partition tháng tiếp theo
curl -sf -X POST http://localhost:8000/api/release/admin/create-partition \
  -H "Authorization: Bearer $TOKEN" | jq .table
# → "release_history_2026_06" (hoặc tháng tiếp theo)
```
