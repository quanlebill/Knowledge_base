# Auth & Release Management — Technology Stack

> **AeroFlow Platform · 2026** · *Confidential*
>
> Tài liệu này phản ánh bản thiết kế đã được cập nhật sau review của **Linh Thien (thiennlinh)** ngày 23/05/2026.
> Các mục đánh dấu ⚡ là giải pháp bổ sung để address các comments trong review.

---

## Mục lục

- [Phần 1 — Auth (IAM Service với Keycloak)](#phần-1--auth-iam-service-với-keycloak)
  - [1.1 Phân chia trách nhiệm](#11-phân-chia-trách-nhiệm)
  - [1.2 Kiến trúc Flow](#12-kiến-trúc-flow)
  - [1.3 Frontend (React + Vite)](#13-frontend-react--vite)
  - [1.4 API Gateway — Kong](#14-api-gateway--kong-điểm-verify-jwt-duy-nhất)
  - [1.5 Backend — Python / FastAPI](#15-backend--python--fastapi)
  - [1.6 Database](#16-database)
  - [1.7 Security Policies](#17-keycloak--security-policies)
  - [1.8 Federated Identity Bridges](#18-federated-identity-bridges)
  - [1.9 Keycloak High Availability *(mới)*](#19-keycloak-high-availability-ha--mới)
- [Phần 2 — Release Management](#phần-2--release-management)
  - [2.1 Pipeline (CI/CD)](#21-pipeline-cicd)
  - [2.2 Package Builder](#22-package-builder)
  - [2.3 Environment Management](#23-environment-management)
  - [2.4 Rollback](#24-rollback)
  - [2.5 Release History & Audit](#25-release-history--audit)
  - [2.6 Observability](#26-observability-opentelemetry--jaeger--datadog)
  - [2.7 Security Scanning *(mới)*](#27-security-scanning--mới)
- [Tóm tắt — Technology Map](#tóm-tắt--technology-map)
- [Review Comments & Giải pháp](#review-comments--giải-pháp)

---

# Phần 1 — Auth (IAM Service với Keycloak)

## 1.1 Phân chia trách nhiệm

| Việc | Ai xử lý | Ghi chú |
|------|----------|---------|
| Session management | Keycloak | idle timeout, concurrent limit, SSO session |
| Token revocation | Keycloak | `/revoke` endpoint, backchannel-logout |
| JWKS public key | Keycloak | serve endpoint `/openid-connect/certs` |
| JWT verify (external request) | Kong | fetch JWKS từ Keycloak, cache trong Kong — **TTL 300s; force-refresh khi Keycloak rotate key** |
| User identity & roles | Keycloak | user store, realm roles, group membership |
| SSO federation (SAML/OIDC) | Keycloak | Identity Broker |
| MFA (TOTP, WebAuthn) | Keycloak | Required Actions |
| Audit log auth events | Keycloak → Kafka → PostgreSQL | Event Listener → Kafka topic → Consumer ghi DB |
| Backend JWT verify | Không cần | Kong đã verify, backend chỉ đọc header |

---

## 1.2 Kiến trúc Flow

```
User ──► Keycloak (login / SSO / MFA)
              │
              └─► JWT (RS256) trả về frontend
                        │
Frontend ──────────────► Kong Gateway
                              │  verify JWT với Keycloak JWKS (Kong tự cache)
                              │  inject header: X-User-Id, X-User-Roles
                              ▼
                        Microservices (FastAPI)
                              │  đọc header — KHÔNG verify JWT lại
                              ▼
                        Business logic
```

> *Backend không cần verify JWT — chỉ đọc các header Kong đã inject.*

> ⚡ **Giải pháp (Comment #1):** Bổ sung Network Segmentation — backend chỉ nhận request từ Kong (IP allowlist hoặc mTLS client cert). Ngăn giả mạo `X-User-Id`/`X-User-Roles` bằng cách bỏ qua Kong.

---

## 1.3 Frontend (React + Vite)

**Cài đặt:**

```bash
npm install keycloak-js @react-keycloak/web
```

**File `.env`:**

```env
VITE_KEYCLOAK_URL=https://auth.yourdomain.com
VITE_KEYCLOAK_REALM=aeroflow
VITE_KEYCLOAK_CLIENT=aeroflow-frontend
```

**Khởi tạo Keycloak instance** (`src/keycloak.ts`):

```typescript
import Keycloak from 'keycloak-js';

export default new Keycloak({
  url:      import.meta.env.VITE_KEYCLOAK_URL,
  realm:    import.meta.env.VITE_KEYCLOAK_REALM,
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT,
});
```

**Wrap app** (`src/main.tsx`):

```tsx
<ReactKeycloakProvider
  authClient={keycloak}
  initOptions={{ onLoad: 'login-required', checkLoginIframe: false }}
>
  <App />
</ReactKeycloakProvider>
```

**Gọi API — token tự refresh nếu hết hạn:**

```typescript
const { keycloak } = useKeycloak();

const callApi = async () => {
  await keycloak.updateToken(30); // refresh nếu còn < 30s
  await fetch('/api/agents', {
    headers: { Authorization: `Bearer ${keycloak.token}` },
  });
};
```

---

## 1.4 API Gateway — Kong (điểm verify JWT duy nhất)

**Triển khai thực tế:** Custom Lua plugin `aeroflow-jwks` (thay thế built-in JWT + OIDC plugin). Source: `infra/kong/plugins/aeroflow-jwks/handler.lua`.

```yaml
plugins:
  - name: aeroflow-jwks          # custom Kong plugin
    config:
      jwks_uri: http://aeroflow-keycloak-lb:8080/realms/aeroflow/protocol/openid-connect/certs
      issuer:   http://localhost:8080/realms/aeroflow
      jwks_refresh_interval: 300   # cache TTL seconds; force-refresh on unknown kid
```

**Plugin chạy trên 2 services:**
- `aeroflow-backend` (route `/api`) → backend FastAPI tại port 8888
- `release-worker` (route `/api/release`) → Release Worker FastAPI tại port 8100

**Sau khi verify RS256 thành công, inject vào upstream request:**

| Header | Nguồn | Ghi chú |
|--------|-------|---------|
| `X-User-Id` | JWT `sub` claim | Keycloak user UUID |
| `X-User-Email` | JWT `email` claim | |
| `X-User-Name` | JWT `preferred_username` | |
| `X-User-Roles` | `realm_access.roles` (lọc system roles) | comma-separated, e.g. `platform-admin` |
| `X-Tenant-Id` | JWT `tenant_id` claim | custom attribute |
| `X-Role-Id` | JWT `role_id` claim | custom attribute |
| `X-Kong-Verified` | `true` (hardcoded) | Backend verify header này |

> *Backend không cần verify JWT — chỉ đọc các header Kong đã inject. Header được clear trước khi plugin chạy để chặn spoofing.*

> ⚡ **Giải pháp (Comment #0):** `kong.cache` TTL 300s. Khi Keycloak rotate key (kid mới), plugin tự invalidate cache và re-fetch JWKS trong cùng request — không cần event hook.

---

## 1.5 Backend — Python / FastAPI

**Cài đặt:**

```bash
pip install python-keycloak
```

**Đọc user info từ header Kong inject:**

```python
from fastapi import Header

def get_current_user(
    user_id:    str = Header(..., alias='X-User-Id'),
    user_roles: str = Header(..., alias='X-User-Roles'),
):
    return {'user_id': user_id, 'roles': user_roles.split(',')}
```

**Admin operations** (quản lý user, role) dùng Keycloak Admin API:

```python
from keycloak import KeycloakAdmin

kc_admin = KeycloakAdmin(
    server_url=os.environ["KEYCLOAK_URL"],
    realm_name=os.environ["KEYCLOAK_REALM"],
    client_id=os.environ["KEYCLOAK_ADMIN_CLIENT"],
    client_secret_key=os.environ["KEYCLOAK_ADMIN_SECRET"],
)
```

---

## 1.6 Database

| Tech | Lưu gì | Không lưu gì |
|------|--------|--------------|
| Keycloak (internal DB) | User identity, roles, groups, sessions, credentials, SSO config | Platform business data |
| PostgreSQL | Audit log forward từ Keycloak Event Listener | User credentials |

**Keycloak → Kafka → PostgreSQL audit flow:**

```
Keycloak Admin → Events → Event Listeners
  → custom SPI publish vào Kafka topic: audit.auth.events
  → Consumer subscribe topic → ghi vào PostgreSQL
```

> *Không ghi audit log từ service — Keycloak là nguồn duy nhất.*

> ⚡ **Giải pháp (Comment #2 & #3):** Đổi sang Keycloak → **Kafka** (topic `audit.auth.events`) → Consumer ghi PostgreSQL. Kafka đảm bảo at-least-once delivery; consumer có retry — không mất audit event khi DB tạm down.

---

## 1.7 Keycloak — Security Policies

| Policy UI | Keycloak Setting |
|-----------|-----------------|
| Enforce MFA (TOTP / WebAuthn) | Authentication → Required Actions: `CONFIGURE_TOTP` / `webauthn-register` |
| Session revocation (8h inactivity) | Realm Settings → Sessions → SSO Session Idle: 8 hours |
| Concurrent session limit (max 2) | Authentication → Session Limits policy |
| IP Allowlisting | Kong IP restriction plugin (không phải Keycloak) |

---

## 1.8 Federated Identity Bridges

| Provider | Protocol | Keycloak Config |
|----------|----------|-----------------|
| Azure AD (Entra ID) | OIDC / SAML 2.0 | Identity Provider → OIDC broker |
| Okta Enterprise | SAML 2.0 | Identity Provider → SAML broker |
| Google Workspace | OIDC | Identity Provider → Google social |
| WebAuthn / Passkey | WebAuthn | Keycloak WebAuthn Authenticator |
| TOTP / OTP | TOTP | Keycloak OTP Policy |

---

## 1.9 Keycloak High Availability (HA) — *mới*

> ⚡ **Bổ sung (Comment #12)**

Keycloak single node là **Single Point of Failure** — auth service down thì toàn platform không login được. Cần deploy Keycloak HA cluster.

**Thiết kế HA:**

1. **Tối thiểu 2 Keycloak nodes** (Active/Active) đứng sau Load Balancer (HAProxy)
2. **Shared PostgreSQL self-hosted** làm backing store chung cho cả cluster
3. **Infinispan distributed cache** (built-in Keycloak) đồng bộ session giữa các nodes
4. **Health check** endpoint `/health/ready` để LB tự failover khi 1 node down
5. **Kong JWKS cache grace period 60s** — tiếp tục dùng cached key khi Keycloak tạm unreachable

```
                    ┌─── Load Balancer ───┐
                    │                     │
             Keycloak Node 1       Keycloak Node 2
                    │                     │
                    └─────┬───────────────┘
                          │  Infinispan cluster sync
                    PostgreSQL (self-hosted)
```

---

# Phần 2 — Release Management

## 2.1 Pipeline (CI/CD)

| Layer | Tech | Vai trò |
|-------|------|---------|
| Pipeline trigger | Kafka `release.pipeline.triggered` | Event-driven giữa services |
| Pipeline state | **PostgreSQL (self-hosted)** | PENDING → RUNNING → SUCCESS/FAILED |
| Pipeline worker | Python/FastAPI + Celery | Execute steps async |
| Build artifacts | MinIO (internal) → S3 (production) | Lưu deployment packages |
| Notifications | RabbitMQ → Notification service | Alert khi pipeline xong |

> ⚡ **Giải pháp (Comment #4):** Kafka topic `release.pipeline.triggered` cần **SASL/PLAIN auth** (hoặc mTLS). Chỉ CI/CD service được phép produce vào topic này — ngăn trigger release trái phép.

---

## 2.2 Package Builder

```
MinIO         — Artifact bundles (Agent configs, KB snapshots, Workflow logic)
Atlas MongoDB — Package manifest (version, artifacts, validation score)
S3            — Promotion lên production artifact store
```

**Package manifest (MongoDB):**

```json
{
  "package_id": "pkg-v2.4.1",
  "artifacts": ["GlobalCorp_Agent_v2.4", "refund_policy_gold_index"],
  "validation_score": 98,
  "status": "VALIDATED",
  "created_at": "2026-05-21T...",
  "environment_targets": ["staging", "production"],
  "security_scan": {
    "trivy": "PASS",
    "bandit": "PASS",
    "pip_audit": "PASS"
  }
}
```

---

## 2.3 Environment Management

| Environment | Config Store | Promotion Gate |
|-------------|-------------|----------------|
| Dev | **PostgreSQL self-hosted** *(thay Redis — tránh mất config khi restart)* | Auto-promote khi tests pass |
| Staging / UAT | PostgreSQL (self-hosted) | Manual approval qua UI dashboard |
| Production | PostgreSQL (self-hosted) + OpenBao | Dual approval + validation score ≥ 95% |

> ⚡ **Giải pháp (Comment #5):** Thay `AWS Redis` (volatile) bằng **PostgreSQL self-hosted** cho Dev config. Redis sẽ mất toàn bộ config khi restart — không phù hợp để lưu environment config.

> ⚡ **Giải pháp (Comment #7):** Manual approval cần có **UI dashboard** (không chỉ Kong Admin API). Reviewer nhận notification → vào dashboard xem diff → click Approve/Reject. Kong Admin API chỉ là backend của approval flow.

**Drift Detection:**

```python
diff = DeepDiff(prod_config, uat_config)
kafka.produce("release.drift.detected", {
    "keys": list(diff.keys()), "severity": "CRITICAL_DRIFT"
})
```

> ⚡ **Giải pháp (Comment #8):** Drift action plan sau khi phát hiện:
> 1. `release.drift.detected` → **Notification Service** → alert Lead Dev + Release Manager (Slack/email)
> 2. **Block** auto-promotion lên Production cho đến khi drift được resolve
> 3. Reviewer xác nhận sự khác biệt là intentional → approve, hoặc trigger sync lại từ UAT snapshot

---

## 2.4 Rollback

```
Strategy : Immutable snapshots trong MinIO (version tag)
Rollback  : update release pointer PostgreSQL + Kong upstream route
Event     : release.rollback.initiated → Kafka → worker redeploy snapshot
```

> ⚡ **Giải pháp (Comment #9):** Rollback cần **compensating transaction pattern** — mỗi bước trong rollback có undo action tương ứng:
>
> | Bước | Action | Compensating action |
> |------|--------|---------------------|
> | 1 | Update release pointer PostgreSQL | Revert pointer về version cũ |
> | 2 | Reroute Kong upstream | Restore Kong route cũ |
> | 3 | Redeploy snapshot MinIO | — |
>
> Nếu bất kỳ bước nào fail → **dừng ngay**, ghi trạng thái `PARTIAL_ROLLBACK` vào PostgreSQL, gửi alert. Không để hệ thống ở trạng thái inconsistent.

---

## 2.5 Release History & Audit

```
Primary store   : PostgreSQL (self-hosted, structured, queryable)
Full-text search: Elastic ES (filter env, status, agent, date)
Audit export    : PostgreSQL → CSV/PDF via FastAPI
Compliance      : Immutable rows — no UPDATE/DELETE
```

> ⚡ **Giải pháp (Comment #10):** Bổ sung **PostgreSQL table partitioning** (RANGE by month/quarter) cho audit log table. Archival policy: records > 12 tháng → chuyển sang cold storage (MinIO/S3). Giữ query performance khi bảng tích lũy hàng triệu rows.

```sql
-- Ví dụ partition by month
CREATE TABLE audit_log (
  id          BIGSERIAL,
  event_time  TIMESTAMPTZ NOT NULL,
  event_type  TEXT,
  user_id     TEXT,
  payload     JSONB
) PARTITION BY RANGE (event_time);

CREATE TABLE audit_log_2026_05
  PARTITION OF audit_log
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
```

---

## 2.6 Observability (OpenTelemetry → Jaeger → DataDog)

```python
from opentelemetry import trace

tracer = trace.get_tracer("release-service")

with tracer.start_as_current_span("pipeline.execute") as span:
    span.set_attribute("release.package_id", package_id)
    span.set_attribute("release.environment", env)
    span.set_attribute("release.validation_score", score)
```

- **Jaeger:** trace pipeline execution end-to-end
- **DataDog:** release frequency, MTTR, lead time (DORA metrics)
- **Grafana/Loki:** structured logs từ Python workers

---

## 2.7 Security Scanning — *mới*

> ⚡ **Bổ sung (Comment #11)**

Thêm bước scan bắt buộc vào pipeline **trước khi promote artifact** lên Staging/Production:

| Tool | Loại scan | Điều kiện fail |
|------|-----------|---------------|
| **Trivy** | Container image CVE scan | Bất kỳ CVE critical/high |
| **Bandit** | SAST — Python source code | High severity issue |
| **pip-audit** | Dependency vulnerability | Known CVE trong dependencies |

**Pipeline flow với security gate:**

```
Build artifact
     │
     ▼
Security Scan (Trivy + Bandit + pip-audit)
     │
     ├─ FAIL → Pipeline blocked, alert team
     │
     └─ PASS → Kết quả ghi vào Package manifest MongoDB
                     │
                     ▼
              Promote lên Staging/Production
```

Kết quả scan được lưu vào Package manifest cùng `validation_score`.

---

# Tóm tắt — Technology Map

Toàn bộ stack được phân tách rõ ràng, không chồng lấp trách nhiệm giữa các layer.

### AUTH

| Layer | Technology |
|-------|-----------|
| Frontend | `keycloak-js` + `@react-keycloak/web` |
| Session | Keycloak (idle timeout, revocation, concurrent limit) |
| JWT verify | Kong duy nhất — inject `X-User-Id` / `X-User-Roles` header |
| Backend | Đọc header từ Kong, KHÔNG verify JWT |
| Network security | mTLS / IP allowlist — chỉ nhận request từ Kong |
| Admin ops | `python-keycloak` (FastAPI) cho quản lý user/role |
| SSO/SAML | Keycloak Identity Broker (Azure AD, Okta, Google) |
| MFA | Keycloak TOTP + WebAuthn Authenticator |
| User store | Keycloak internal DB |
| Audit log | Keycloak → Kafka `audit.auth.events` → PostgreSQL |
| High Availability | Keycloak cluster Active/Active + shared PostgreSQL |
| Monitor | Keycloak events → Grafana/Loki |

### SECRETS VAULT (OpenBao)

| Feature | Technology |
|---------|-----------|
| KV storage | OpenBao KV v2 — `secret/data/tenants/{tenant_id}/{key_name}` |
| Cryptographic keys | OpenBao Transit engine — RSA-4096/2048, EC-P256, AES-256, HMAC-SHA256 |
| Key types (KV) | `BEARER_TOKEN`, `MCP_TOKEN`, `KB_API_KEY` — raw value in vault |
| Key types (Transit) | `SIGNING_KEY`, `ENCRYPTION_KEY`, `HMAC_KEY` — key generated & stays inside vault |
| Sign/Verify | `POST /secrets/{id}/sign` + `POST /secrets/{id}/verify` — Transit never exports private key |
| Rotation | Transit: `transit.rotate_key()`, no value needed; KV: requires new value |
| Governance | Panic Mode (503 all ops), Auto-Rotation (24h background task), PII Access Log |
| PII Log | Every `reveal` recorded to `key_rotations` (`triggered_by='REVEAL'`) + `/pii-log` endpoint |
| UI | Settings → Auth & SSO → Secrets Vault (TRANSIT badge, HSM status, PII log panel) |

### RELEASE MANAGEMENT

| Module | Technology |
|--------|-----------|
| Pipeline | Kafka (events + SASL/PLAIN + StandardAuthorizer ACL), Celery workers (Python) |
| Package | MinIO → S3, MongoDB (manifest + scan results) |
| Env Config | PostgreSQL self-hosted (Dev/Staging/Prod) |
| Secret | OpenBao (Production) |
| Validation | Pytest, Elastic ES |
| Security scan | Trivy + Bandit + pip-audit (gate trước promote) |
| Approval | UI Dashboard + Kong Admin API backend |
| Rollback | MinIO snapshots + compensating transaction pattern |
| History | PostgreSQL (partitioned) + Elastic ES |
| Archival | Records > 12 tháng → MinIO/S3 cold storage |
| Observe | OTel → Jaeger → DataDog (DORA metrics) |

---

# Review Comments & Giải pháp

> Reviewer: **Linh Thien (thiennlinh)** — 23/05/2026

| # | Vị trí | Comment | Giải pháp |
|---|--------|---------|-----------|
| 0 | Kong JWKS cache | Cache trong Kong chưa có giải pháp khi Keycloak rotate key | Cấu hình `jwks_uri_refresh_interval: 300s` + force-refresh khi rotate key → xem §1.4 |
| 1 | Kong → Backend header | Rất dễ bị giả mạo header nếu không có Network Segmentation | Bổ sung IP allowlist / mTLS service-to-service → xem §1.2 |
| 2 | Audit log Event Listener | Cần retry mechanism — không để mất event quan trọng | Đổi sang Kafka at-least-once → Consumer ghi DB → xem §1.6 |
| 3 | Audit log (tiếp) | Nên bắn qua Kafka | Đã áp dụng Kafka topic `audit.auth.events` → xem §1.6 |
| 4 | Kafka pipeline trigger | Cần Auth cho Kafka message — ngăn release trái phép | Thêm SASL/PLAIN ACL cho topic → xem §2.1 |
| 5 | AWS PostgreSQL | Dùng PostgreSQL local, không triển khai trên AWS | Đổi sang PostgreSQL self-hosted toàn bộ → xem §2.1, §2.3 |
| 6 | AWS Redis (Dev config) | Redis mất dữ liệu khi restart | Thay bằng PostgreSQL self-hosted → xem §2.3 |
| 7 | Manual approval | Không tự động hoá được trên giao diện | Cần UI dashboard cho approval flow → xem §2.3 |
| 8 | Drift Detection | Chưa rõ action plan sau khi phát hiện drift | Bổ sung: alert → block promotion → reviewer confirm/sync → xem §2.3 |
| 9 | Rollback | Quá phức tạp, dễ bị partial fail | Compensating transaction pattern + trạng thái `PARTIAL_ROLLBACK` → xem §2.4 |
| 10 | Audit log table | Sẽ phát sinh nhiều bản ghi, ảnh hưởng query | Partition by month + archival > 12 tháng → xem §2.5 |
| 11 | Security scanning | Cần kiểm thử security trước khi publish | Thêm security gate: Trivy + Bandit + pip-audit → xem §2.7 |
| 12 | Keycloak HA | Cần Keycloak HA để đảm bảo hoạt động | Thiết kế cluster Active/Active + shared PostgreSQL → xem §1.9 |
