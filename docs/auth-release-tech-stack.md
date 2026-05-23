# Auth & Release Management — Technology Stack



## Phần 1 — Auth (IAM Service với Keycloak)

### Phân chia trách nhiệm rõ ràng

| Việc | Ai xử lý | Ghi chú |
|---|---|---|
| Session management | **Keycloak** | idle timeout, concurrent limit, SSO session |
| Token revocation | **Keycloak** | `/revoke` endpoint, backchannel-logout |
| JWKS public key | **Keycloak** | serve endpoint `/openid-connect/certs` |
| JWT verify (external request) | **Kong** | fetch JWKS từ Keycloak, cache trong Kong |
| User identity & roles | **Keycloak** | user store, realm roles, group membership |
| SSO federation (SAML/OIDC) | **Keycloak** | Identity Broker |
| MFA (TOTP, WebAuthn) | **Keycloak** | Required Actions |
| Audit log auth events | **Keycloak → PostgreSQL** | Event Listener forward sang PostgreSQL |
| Backend JWT verify | **Không cần** | Kong đã verify, backend chỉ đọc header |



---

### Kiến trúc flow

```
User ──► Keycloak (login / SSO / MFA)
              │
              └─► JWT (RS256) trả về frontend
                        │
Frontend ──────────────► Kong Gateway
                              │ verify JWT với Keycloak JWKS (Kong tự cache)
                              │ inject header: X-User-Id, X-User-Roles
                              ▼
                        Microservices (FastAPI)
                              │ đọc header — KHÔNG verify JWT lại
                              ▼
                        Business logic
```

---

### Frontend (React + Vite)

```bash
npm install keycloak-js @react-keycloak/web
```

**File `.env`:**
```env
VITE_KEYCLOAK_URL=https://auth.yourdomain.com
VITE_KEYCLOAK_REALM=aeroflow
VITE_KEYCLOAK_CLIENT=aeroflow-frontend
```

**Khởi tạo instance:**
```tsx
// src/keycloak.ts
import Keycloak from 'keycloak-js';

export default new Keycloak({
  url: import.meta.env.VITE_KEYCLOAK_URL,
  realm: import.meta.env.VITE_KEYCLOAK_REALM,
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT,
});
```

**Wrap app:**
```tsx
// src/main.tsx
import { ReactKeycloakProvider } from '@react-keycloak/web';
import keycloak from './keycloak';

<ReactKeycloakProvider
  authClient={keycloak}
  initOptions={{ onLoad: 'login-required', checkLoginIframe: false }}
>
  <App />
</ReactKeycloakProvider>
```

**Dùng trong component (TopBar):**
```tsx
import { useKeycloak } from '@react-keycloak/web';

const TopBar = () => {
  const { keycloak } = useKeycloak();
  return (
    <header>
      <span>{keycloak.tokenParsed?.name}</span>
      <button onClick={() => keycloak.logout()}>Sign out</button>
    </header>
  );
};
```

**Gọi API — token tự refresh nếu hết hạn:**
```tsx
const { keycloak } = useKeycloak();

const callApi = async () => {
  await keycloak.updateToken(30); // refresh nếu còn < 30s
  await fetch('/api/agents', {
    headers: { Authorization: `Bearer ${keycloak.token}` },
  });
};
```

---

### API Gateway (Kong) — Điểm verify JWT duy nhất

```yaml
plugins:
  - name: oidc
    config:
      discovery: https://auth.yourdomain.com/realms/aeroflow/.well-known/openid-configuration
      # Kong tự fetch và cache JWKS từ Keycloak
      # Sau khi verify xong, inject header cho backend:
      header_names: ["X-User-Id", "X-User-Roles", "X-User-Email"]
```

Backend **không cần verify JWT** — chỉ đọc các header Kong đã inject.

---

### Backend — Python/FastAPI

Backend tin tưởng Kong, **không verify JWT lại**. Chỉ dùng `python-keycloak` cho các thao tác quản trị qua Admin API.

```bash
pip install python-keycloak
```

```python
from fastapi import Header, HTTPException

# Đọc user info từ header Kong inject — không cần jwt.decode
def get_current_user(
    user_id: str    = Header(..., alias="X-User-Id"),
    user_roles: str = Header(..., alias="X-User-Roles"),
):
    return {"user_id": user_id, "roles": user_roles.split(",")}

# Admin operations (quản lý user, role) dùng Keycloak Admin API
from keycloak import KeycloakAdmin

kc_admin = KeycloakAdmin(
    server_url=os.environ["KEYCLOAK_URL"],
    realm_name=os.environ["KEYCLOAK_REALM"],
    client_id=os.environ["KEYCLOAK_ADMIN_CLIENT"],
    client_secret_key=os.environ["KEYCLOAK_ADMIN_SECRET"],
)
```

---

### Database 

| Tech | Lưu gì | Không lưu gì |
|---|---|---|
| **Keycloak** (internal DB) | User identity, roles, groups, sessions, credentials, SSO config | Platform business data |
| **PostgreSQL** | Audit log forward từ Keycloak Event Listener | User credentials |

**Keycloak → PostgreSQL audit forward (Keycloak Event Listener SPI):**
```
Keycloak Admin → Events → Event Listeners → thêm "jboss-logging" + custom SPI ghi vào PostgreSQL
```
Không ghi audit log từ service — Keycloak là nguồn duy nhất.

---

### Keycloak — Security Policies

| Policy UI | Keycloak Setting |
|---|---|
| Enforce MFA (TOTP / WebAuthn) | Authentication → Required Actions: `CONFIGURE_TOTP` / `webauthn-register` |
| Session revocation (8h inactivity) | Realm Settings → Sessions → SSO Session Idle: `8 hours` |
| Concurrent session limit (max 2) | Authentication → Session Limits policy |
| IP Allowlisting | Kong IP restriction plugin (không phải Keycloak) |

---

### Federated Identity Bridges

| Provider | Protocol | Keycloak Config |
|---|---|---|
| Azure AD (Entra ID) | OIDC / SAML 2.0 | Identity Provider → OIDC broker |
| Okta Enterprise | SAML 2.0 | Identity Provider → SAML broker |
| Google Workspace | OIDC | Identity Provider → Google social |
| WebAuthn / Passkey | WebAuthn | Keycloak WebAuthn Authenticator |
| TOTP/OTP | TOTP | Keycloak OTP Policy |

---

---

## Phần 2 — Release Management



### Stack theo từng sub-tab

#### Pipeline (CI/CD)

| Layer | Tech | Vai trò |
|---|---|---|
| Pipeline trigger | Kafka `release.pipeline.triggered` | Event-driven giữa services |
| Pipeline state | AWS PostgreSQL | PENDING → RUNNING → SUCCESS/FAILED |
| Pipeline worker | Python/FastAPI + Celery | Execute steps async |
| Build artifacts | MinIO (internal) → S3 (production) | Lưu deployment packages |
| Notifications | RabbitMQ → Notification service | Alert khi pipeline xong |



#### Package Builder

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
  "environment_targets": ["staging", "production"]
}
```

#### Environment Management

| Environment | Config Store | Promotion Gate |
|---|---|---|
| Dev | AWS Redis (volatile env config) | Auto-promote khi tests pass |
| Staging/UAT | AWS PostgreSQL | Manual approval qua Kong Admin API |
| Production | AWS PostgreSQL + OpenBao | Dual approval + validation score ≥ 95% |



**Drift Detection:**
```python
diff = DeepDiff(prod_config, uat_config)
kafka.produce("release.drift.detected", {"keys": list(diff.keys()), "severity": "CRITICAL_DRIFT"})
```

#### Rollback

```
Strategy : Immutable snapshots trong MinIO (version tag)
Rollback  : update release pointer PostgreSQL + Kong upstream route
Event     : release.rollback.initiated → Kafka → worker redeploy snapshot
```

#### Release History & Audit

```
Primary store   : AWS PostgreSQL (structured, queryable)
Full-text search: Elastic ES (filter env, status, agent, date)
Audit export    : PostgreSQL → CSV/PDF via FastAPI
Compliance      : Immutable rows — no UPDATE/DELETE
```

#### Observability (OpenTelemetry → Jaeger → DataDog)

```python
from opentelemetry import trace
tracer = trace.get_tracer("release-service")

with tracer.start_as_current_span("pipeline.execute") as span:
    span.set_attribute("release.package_id", package_id)
    span.set_attribute("release.environment", env)
    span.set_attribute("release.validation_score", score)
```

Jaeger: trace pipeline execution end-to-end
DataDog: release frequency, MTTR, lead time (DORA metrics)
Grafana/Loki: structured logs từ Python workers

---

## Tóm tắt — Technology Map (không chồng lấp)

```
AUTH
├── Frontend    : keycloak-js + @react-keycloak/web
├── Session     : Keycloak (idle timeout, revocation, concurrent limit)
├── JWT verify  : Kong duy nhất — inject X-User-Id / X-User-Roles header
├── Backend     : đọc header từ Kong, KHÔNG verify JWT
├── Admin ops   : python-keycloak (FastAPI) cho quản lý user/role
├── SSO/SAML    : Keycloak Identity Broker (Azure AD, Okta, Google)
├── MFA         : Keycloak TOTP + WebAuthn Authenticator
├── User store  : Keycloak internal DB
├── Audit log   : Keycloak Event Listener → PostgreSQL
└── Monitor     : Keycloak events → Grafana/Loki

RELEASE MANAGEMENT
├── Pipeline    : Kafka (events), Celery workers (Python)
├── Package     : MinIO → S3, MongoDB (manifest)
├── Env Config  : Redis (volatile Dev config), PostgreSQL (Staging/Prod)
├── Validation  : Pytest, Elastic ES
├── Rollback    : MinIO snapshots, Kong Admin API
├── History     : PostgreSQL + Elastic ES
└── Observe     : OTel → Jaeger → DataDog (DORA metrics)
```

---

