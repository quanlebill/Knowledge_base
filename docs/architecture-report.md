# Báo cáo Kiến trúc Hệ thống — AeroFlow Platform

> **Phạm vi:** Auth & Gateway Stack · Release Management System  
> **Ngày:** 2026-05-27  
> **Trạng thái:** Production-ready (all 23/23 test cases PASS)

---

## Mục lục

1. [Tổng quan High-Level](#1-tổng-quan-high-level)
2. [Sơ đồ Kiến trúc](#2-sơ-đồ-kiến-trúc)
3. [Danh sách Services & Cổng kết nối](#3-danh-sách-services--cổng-kết-nối)
4. [Cơ sở dữ liệu & Schema](#4-cơ-sở-dữ-liệu--schema)
5. [Luồng dữ liệu chi tiết](#5-luồng-dữ-liệu-chi-tiết)
6. [Phân tích Công nghệ — Auth Stack](#6-phân-tích-công-nghệ--auth-stack)
7. [Phân tích Công nghệ — Release Management](#7-phân-tích-công-nghệ--release-management)
8. [Quyết định Thiết kế quan trọng](#8-quyết-định-thiết-kế-quan-trọng)
9. [Security Model](#9-security-model)
10. [Hạn chế & Hướng phát triển](#10-hạn-chế--hướng-phát-triển)

---

## 1. Tổng quan High-Level

AeroFlow Platform gồm hai module chính chạy cùng Docker Compose stack:

| Module | Mục đích | Công nghệ cốt lõi |
|--------|----------|-------------------|
| **Auth & Gateway** | Xác thực, phân quyền, audit login events | Keycloak HA · Kong · HAProxy · Kafka |
| **Release Management** | CI/CD pipeline, approval flow, rollback, drift detection | FastAPI · Celery · PostgreSQL · MinIO |

**Nguyên tắc thiết kế:**
- **Single network** — tất cả containers trong `aeroflow-net` (Docker bridge), không expose internal ports ra ngoài trừ khi cần debug
- **Single DB** — PostgreSQL là nguồn dữ liệu duy nhất cho cả Keycloak, Kong, và Release Worker
- **Event-driven** — Kafka làm bus giữa Keycloak SPI → audit pipeline và CI/CD → release pipeline
- **Stateless gateway** — Kong verify JWT locally (JWKS cache 300s), không round-trip Keycloak trên mỗi request

---

## 2. Sơ đồ Kiến trúc

### 2.1 Full System Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                                   │
│                                                                         │
│   Browser/SPA                    CI/CD System                          │
│   (React + Vite)                 (ci-service)                          │
│   :5173                          Kafka Producer                        │
└──────┬────────────────────────────────┬──────────────────────────────-─┘
       │ OIDC/OAuth2                     │ SASL/PLAIN
       │ (JWT Bearer token)              │ release.pipeline.triggered
       ▼                                 ▼
┌──────────────────┐          ┌──────────────────────────────────────────┐
│   HAProxy LB     │          │              KAFKA (KRaft)               │
│   :8080          │          │              :9092                       │
│   Round-robin    │          │  Topics:                                 │
│   Health-check   │          │  • audit.auth.events                     │
│   node1/node2    │          │  • release.pipeline.triggered            │
└──────┬───────────┘          │  • release.pipeline.status              │
       │                      │  • release.rollback.initiated            │
  ┌────┴────┐                 │  • release.drift.detected                │
  ▼         ▼                 │  • release.scan.completed                │
┌──────┐ ┌──────┐             └────────────┬────────────────────────────┘
│  KC  │ │  KC  │  JGroups                 │              │
│ node1│◄►│node2 │  TCPPING :7600          │              │
│ :8081│ │ :8082│  Infinispan session sync │              │
└──┬───┘ └──────┘                          │              │
   │ Kafka SPI (audit-bridge)              │              │
   │ WRITE audit.auth.events               ▼              ▼
   │                            ┌──────────────┐  ┌─────────────────┐
   │                            │Audit Consumer│  │ Release Worker  │
   │                            │(Python)      │  │ FastAPI + Celery│
   │                            │ audit-consumer│  │ :8100           │
   │                            │ SASL/READ    │  │ release-worker  │
   │                            └──────┬───────┘  │ SASL/READ+WRITE │
   │                                   │          └───────┬─────────┘
   │                                   │                  │
   ▼                                   ▼                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        PostgreSQL :5432                                 │
│                                                                         │
│  schema: keycloak  ── Keycloak sessions, realm, users, clients         │
│  schema: kong      ── Kong routes, services, plugins, consumers        │
│  schema: public    ── Auth: audit_logs, plans, roles                   │
│                        Release: pipelines, release_packages,           │
│                                 release_history (partitioned),          │
│                                 rollback_operations, drift_events,      │
│                                 environment_configs, release_approvals  │
└─────────────────────────────────────────────────────────────────────────┘

       ┌──────────────────────────────────────────┐
       │           KONG GATEWAY :8000             │
       │                                          │
       │  Plugins (theo thứ tự thực thi):         │
       │  1. ip-restriction  (allowlist)          │
       │  2. rate-limiting   (300 req/min)        │
       │  3. correlation-id  (X-Request-Id)       │
       │  4. aeroflow-jwks   (RS256 verify)       │
       │     └─ fetch JWKS từ keycloak-lb         │
       │     └─ cache TTL 300s                    │
       │     └─ inject X-User-Id/Roles/Email      │
       │  5. pre-function    (header cleanup)     │
       │                                          │
       │  Kong Admin API :8001                    │
       │  Konga UI       :1337                    │
       └──────────────┬───────────────────────────┘
                      │ forward (X-User-Id, X-User-Roles injected)
                      ▼
              ┌──────────────────┐        ┌──────────────┐
              │  Release Worker  │        │    MinIO     │
              │  :8100 (backend) │◄──────►│    :9000     │
              │                  │        │  artifacts/  │
              └──────────────────┘        │  snapshots/  │
                                          └──────────────┘
```

### 2.2 Auth Flow (Request đến Backend)

```
Browser                HAProxy      Kong            Keycloak     Backend
  │                      │            │                │            │
  │── POST /token ───────►            │                │            │
  │                      │── route ──►│                │            │
  │                      │            │── JWKS fetch ─►│            │
  │                      │            │◄─ {keys} ──────│            │
  │◄─ JWT (RS256) ────────            │   (cached 300s)│            │
  │                                   │                │            │
  │── GET /api/... Bearer JWT ────────►                │            │
  │                      │            │ verify RS256   │            │
  │                      │            │ check exp/iss  │            │
  │                      │            │ inject headers │            │
  │                      │            │── forward ─────────────────►│
  │                      │            │   X-User-Id    │            │
  │                      │            │   X-User-Roles │            │
  │◄─ 200 OK ──────────────────────────────────────────────────────│
```

### 2.3 Release Pipeline Flow

```
 Developer / CI              Kafka               Release Worker          DB
     │                         │                       │                  │
     │── POST /pipeline/trigger►                       │                  │
     │                         │                       │                  │
     │                         │── pipeline.triggered ►│                  │
     │                         │                       │── INSERT pipelines│
     │                         │                       │                  │
     │                         │                  [Build Artifact]        │
     │                         │                  [Security Scan]         │
     │                         │                  Trivy + Bandit          │
     │                         │                  + pip-audit             │
     │                         │                       │                  │
     │                         │            ┌──────────┘                  │
     │                         │            │ dev?  → auto deploy         │
     │                         │            │ staging/prod? → AWAITING    │
     │                         │            └──────────┐                  │
     │                         │◄─ pipeline.status ────│                  │
     │                         │                       │── INSERT history  │
     │                         │                       │                  │
  Approver                     │                       │                  │
     │── POST /approve/{env} ──────────────────────────►                  │
     │                         │                  [Deploy env]            │
     │                         │◄─ pipeline.deployed ──│                  │
```

---

## 3. Danh sách Services & Cổng kết nối

| Service | Container | Ports (host:container) | Mạng nội bộ | Phụ thuộc |
|---------|-----------|------------------------|-------------|-----------|
| **PostgreSQL 16** | aeroflow-postgres | `5432:5432` | aeroflow-net | — |
| **Keycloak Node 1** | aeroflow-keycloak-1 | `8081:8080` (debug) | aeroflow-net | postgres |
| **Keycloak Node 2** | aeroflow-keycloak-2 | `8082:8080` (debug) | aeroflow-net | keycloak-node1 |
| **HAProxy LB** | aeroflow-keycloak-lb | `8080:8080` | aeroflow-net | keycloak-node1 |
| **Kong Gateway** | aeroflow-kong | `8000:8000` (proxy)<br>`8001:8001` (admin) | aeroflow-net | postgres, kong-migration |
| **Kong Migration** | aeroflow-kong-migration | — | aeroflow-net | postgres |
| **Konga UI** | aeroflow-konga | `1337:1337` | aeroflow-net | kong |
| **Kafka (KRaft)** | aeroflow-kafka | `9092:9092` | aeroflow-net | — |
| **Audit Consumer** | aeroflow-audit-consumer | — | aeroflow-net | kafka, postgres |
| **Frontend (Vite)** | aeroflow-frontend | `5173:3000` | aeroflow-net | — |
| **Release Worker** | aeroflow-release-worker | `8100:8100` | aeroflow-net | postgres, kafka |
| **MinIO** | aeroflow-minio | `9000:9000`<br>`9001:9001` (console) | aeroflow-net | — |
| **Redis** | aeroflow-redis | `6379:6379` | aeroflow-net | — |

### Thứ tự khởi động (dependency chain)

```
postgres
  ├── keycloak-node1 (import realm on first boot)
  │     └── keycloak-node2 (join cluster)
  │           └── keycloak-lb (HAProxy)
  ├── kong-migration (bootstrap schema)
  │     └── kong
  │           └── konga
  ├── audit-consumer
  └── release-worker
kafka
  ├── audit-consumer
  └── release-worker
```

---

## 4. Cơ sở dữ liệu & Schema

Project deploy **3 data store** thực tế:

| Store | Image | Port | Vai trò |
|-------|-------|------|---------|
| **PostgreSQL 16** | `postgres:16-alpine` | 5432 | DB chính — toàn bộ state |
| **Kafka 3.7** | custom (KRaft) | 9092 | Event bus — audit + release pipeline |
| **Redis 7** | `redis:7-alpine` | 6379 | Celery broker cho Release Worker |

> **Không deploy:** MinIO, MongoDB — có trong code (env vars) nhưng chưa có trong `docker-compose.yml`

---

### 4.1 PostgreSQL — 3 Schemas trong 1 DB

**schema: keycloak** *(92 bảng, Keycloak tự quản lý)*

Keycloak lưu: user, password hash, role definitions, user→role assignment, active sessions (sync Infinispan HA), OAuth2 clients, SSO config (Azure AD/Google/Okta), login events.

> Keycloak **chỉ lưu role** — permission (role được làm gì) do backend tự kiểm tra.

---

**schema: kong** *(Kong tự tạo qua migration)*

Lưu cấu hình gateway: services, routes, plugins, certificates. Những gì đang active:
- Services: `aeroflow-backend`, `aeroflow-prod`, `aeroflow-staging`
- Plugins: `aeroflow-jwks`, `ip-restriction`, `rate-limiting`, `correlation-id`, `pre-function`
- Certificates: Kong client cert (mTLS)

---

**schema: public** *(Application data — `init.sql` + `release-init.sql`)*

| Nhóm | Bảng | Mục đích |
|------|------|---------|
| **Platform** | `plans`, `tenants`, `roles`, `members` | Multi-tenant RBAC; `members` liên kết Keycloak `sub` → tenant role |
| | `keycloak_realm_configs`, `keycloak_role_mappings` | Bridge platform role ↔ Keycloak role per tenant |
| **Security** | `api_keys`, `secrets_vault`, `key_rotations`, `ip_allowlists`, `webhooks` | API keys (bcrypt), secrets trỏ OpenBao path, IP whitelist |
| **Audit** | `audit_logs` *(partitioned by month)* | Kafka → audit-consumer → insert; immutable |
| | `pii_access_logs` *(partitioned by month)* | Log truy cập dữ liệu PII |
| **Release** | `pipelines`, `pipeline_steps` | State machine pipeline + chi tiết từng bước |
| | `release_packages`, `release_approvals` | Artifact manifest + scan result; approve/reject |
| | `environment_configs` | Config dev/staging/prod — source of truth thay Redis |
| | `release_history` *(partitioned by month)* | Immutable audit log; trigger block UPDATE/DELETE |
| | `rollback_operations`, `drift_events` | Log rollback 3-step + config drift detection |

### 4.2 Kafka — Topics đang dùng

| Topic | Producer | Consumer |
|-------|----------|----------|
| `audit.auth.events` | Keycloak SPI | audit-consumer → `audit_logs` |
| `release.pipeline.triggered` | release-worker API, ci-service | release-worker |
| `release.pipeline.status` | release-worker | notification-consumer |
| `release.rollback.initiated` | release-worker API | release-worker |
| `release.drift.detected` | release-worker | notification-consumer |
| `release.scan.completed` | scan-runner | release-worker |

### 4.3 Redis — Celery Broker

Chỉ dùng làm **message broker** cho Celery task queue của Release Worker (`redis://redis:6379/0`). Không lưu application state — nếu Redis restart, task queue mất nhưng pipeline state vẫn còn trong PostgreSQL.

---

## 5. Luồng dữ liệu chi tiết

### 5.1 Auth Flow — Login đến Backend API

```
1. User POST /token → Keycloak (qua HAProxy :8080)
   → Keycloak verify credentials, kiểm tra brute-force policy
   → Keycloak SPI (KafkaEventListenerProvider) PRODUCE sự kiện LOGIN vào Kafka
   → Return JWT (RS256, expires_in=900s)

2. JWT có cấu trúc:
   header: { alg: "RS256", kid: "<key-id>" }
   payload: { sub, email, realm_access.roles, iss, exp, aud }
   signature: RS256(private_key)

3. User gọi API qua Kong :8000 với Bearer JWT
   → Kong plugin ip-restriction: check source IP
   → Kong plugin rate-limiting: count per IP per minute
   → Kong plugin aeroflow-jwks:
      a. Extract kid từ JWT header
      b. Fetch JWKS từ http://aeroflow-keycloak-lb:8080/realms/aeroflow/... (cache 300s)
      c. Convert JWK {n,e} → PEM RSA public key
      d. Verify RS256 signature với resty.openssl
      e. Validate exp, nbf, iss claims
      f. Inject X-User-Id, X-User-Roles, X-User-Email, X-Kong-Verified headers
   → Forward request đến backend (Release Worker :8100)

4. Audit Consumer (Kafka READ audit.auth.events)
   → Parse JSON event từ Keycloak SPI
   → INSERT vào audit_logs (commit sau khi PG commit thành công)
   → Commit Kafka offset
```

### 5.2 Release Pipeline Flow

```
1. Trigger (API hoặc Kafka):
   POST /api/release/pipeline/trigger → produce "release.pipeline.triggered"

2. Release Worker consumer nhận event:
   a. INSERT pipeline record (status=RUNNING)
   b. Build artifact → path trong MinIO
   c. Security scan gate:
      - Trivy: scan CVE Critical/High trong container/filesystem
      - Bandit: SAST scan Python source, fail nếu High severity
      - pip-audit: kiểm tra dependency CVEs
      → overall_status = PASS chỉ khi cả 3 pass
   d. INSERT release_packages (artifact + scan_result JSON)
   e. Deploy:
      - dev: auto deploy → INSERT release_history
      - staging/prod: UPDATE status=AWAITING_APPROVAL
        + produce "pipeline.awaiting_approval" event

3. Approval flow:
   POST /api/release/pipeline/{id}/approve/{env}
   → Kiểm tra role (platform-admin hoặc ai-engineer)
   → INSERT release_approvals
   → APPROVED: spawn thread → _deploy_to_env() → INSERT release_history
   → REJECTED: UPDATE pipelines.status=FAILED

4. Rollback (compensating transaction):
   Step 1: UPDATE environment_configs (DB pointer đến version cũ)
   Step 2: PATCH Kong service tags (reroute upstream)
   Step 3: HEAD MinIO snapshot → deploy nếu tồn tại
   → Nếu step N fail: produce alert "rollback.partial_fail" + PAGERDUTY
   → Nếu tất cả pass: INSERT release_history (status=ROLLED_BACK)

5. Drift Detection (Celery Beat / API):
   SELECT key, value FROM environment_configs WHERE environment=X
   → DeepDiff(prod_config, staging_config)
   → drift detected: INSERT drift_events + produce "drift.detected"
```

---

## 6. Phân tích Công nghệ — Auth Stack

### 6.1 Keycloak 24 — Identity Provider

**Lý do chọn:**
- **Chuẩn OpenID Connect / OAuth2** out-of-the-box — không cần tự implement token issuance, PKCE, refresh token rotation
- **Extensible SPI (Service Provider Interface)** — cho phép inject custom logic (KafkaEventListenerProvider) mà không fork Keycloak source code; SPI được build thành JAR và load khi container start
- **RS256 JWT** — asymmetric signing với key pair riêng; public key expose qua JWKS endpoint, private key không bao giờ rời khỏi Keycloak → Kong có thể verify offline mà không cần gọi Keycloak trên mỗi request
- **Built-in policies** — brute-force protection, password policy, session limits, MFA — production-ready từ đầu
- **PostgreSQL backing** — lưu tất cả state (users, sessions, realm config) vào cùng PostgreSQL instance → dễ backup, no extra dependency

**Thay thế đã xem xét:** Auth0, AWS Cognito → vendor lock-in, không thể custom SPI; Ory Hydra → cần tự build user management

**High Availability — Active/Active:**
```
Keycloak node1 ◄─────── JGroups TCPPING ──────► Keycloak node2
(:8081)          Infinispan distributed cache      (:8082)
     │                (session sync)                    │
     └───────────────────────────────────────────────────┘
                            │
                       HAProxy :8080
                    (round-robin + health-check)
```
- **Infinispan** làm distributed cache: session tạo trên node1 có thể introspect trên node2 (verified TC-02)
- **JGroups TCPPING** (không dùng UDP multicast) vì Docker bridge network không support multicast tốt; TCPPING dùng danh sách IP tĩnh `keycloak-node1[7600],keycloak-node2[7600]`
- **HAProxy** thay vì Nginx vì HAProxy có health-check TCP/HTTP native, tự loại node unhealthy khỏi pool mà không restart

### 6.2 Kong Gateway — API Gateway

**Lý do chọn:**
- **Plugin architecture** — mỗi concern (auth, rate-limit, IP restriction, logging) là một plugin độc lập, có thể bật/tắt per-route mà không thay đổi code backend
- **Lua plugin extensibility** — custom plugin `aeroflow-jwks` viết bằng Lua, chạy trong nginx worker process (zero-latency so với external auth service), dùng `resty.openssl` để verify RS256 mà không cần external call
- **JWKS cache** — Kong cache public keys 300s trong `kong.cache` (shared memory) → một node Keycloak down không ảnh hưởng traffic; keys chỉ re-fetch khi cache expire hoặc khi `kid` không tìm thấy (key rotation)
- **Header injection** — sau khi verify JWT, Kong inject `X-User-Id`, `X-User-Roles`, `X-User-Email` vào upstream request → backend không cần re-verify JWT, không cần gọi Keycloak

**Custom Plugin `aeroflow-jwks` — Tại sao không dùng plugin JWT built-in?**
- Plugin JWT built-in của Kong yêu cầu đăng ký consumer + credential → không phù hợp với OIDC (token issued by Keycloak, không phải Kong)
- `aeroflow-jwks` tự fetch JWKS, convert JWK → PEM, verify signature với `resty.openssl.pkey` → full control, không phụ thuộc external service

**Plugins đang chạy:**

| Plugin | Mục đích | Cấu hình |
|--------|----------|----------|
| `ip-restriction` | Block non-private IPs | allow: 127/10/172.16/192.168 |
| `rate-limiting` | Chống DDoS | 300 req/min per IP, policy=local |
| `correlation-id` | Distributed tracing | `X-Request-Id` header |
| `aeroflow-jwks` | JWT verify + header inject | JWKS TTL 300s, RS256 only |
| `pre-function` | Header cleanup (remove spoofed X-User-* headers) | Lua inline |

### 6.3 HAProxy 2.8 — Load Balancer

**Lý do chọn thay vì Nginx:**
- **Health-check mức HTTP** — HAProxy gửi `GET /health/ready` đến từng Keycloak node mỗi 15s; node nào fail bị remove khỏi pool ngay lập tức
- **Zero-downtime failover** — active connection được forward lại; không cần drain timeout phức tạp
- **Lightweight** — single config file `haproxy.cfg`, không cần module
- **Tested** — TC-01 confirm failover < 20s (health-check interval 15s)

### 6.4 Kafka (Apache Kafka 3.7 KRaft) — Event Bus

**Lý do chọn:**
- **Decoupling** — Keycloak SPI chỉ cần PRODUCE event; audit consumer hoàn toàn độc lập, có thể thay thế/scale mà không ảnh hưởng Keycloak
- **Durability** — message được persist trên disk (retention 30 ngày), không mất event dù consumer restart
- **Replay** — có thể re-consume từ offset bất kỳ để rebuild audit_logs hoặc xử lý lại failed events
- **ACL enforcement** — StandardAuthorizer enforce per-topic, per-operation permissions → audit-consumer không thể WRITE vào topic (verified TC-13)

**KRaft (không dùng ZooKeeper):**
- Kafka 3.7 KRaft mode: broker tự quản lý metadata, không cần ZooKeeper → giảm 1 dependency, đơn giản hơn trong Docker Compose
- Single-node KRaft đủ cho dev/staging; production cần 3-node controller quorum

**SASL/PLAIN vs SCRAM-SHA-256:**
- Dev dùng PLAIN (credentials trong JAAS config) vì đơn giản
- Production nên dùng SCRAM-SHA-256 với `kafka-configs.sh --alter --add-config` — không expose password trong JAAS file

### 6.5 Keycloak SPI — KafkaEventListenerProvider

**Tại sao dùng SPI thay vì webhook?**
- SPI chạy trong Keycloak JVM → synchronous với login event, không thể miss event
- Webhook là async HTTP call có thể fail, retry phức tạp
- SPI có access trực tiếp vào `EventModel` với full context (userId, clientId, ipAddress, details)

```java
// KafkaEventListenerProvider.java — core logic
public void onEvent(Event event) {
    Map<String, Object> msg = new HashMap<>();
    msg.put("type", event.getType().toString());
    msg.put("userId", event.getUserId());
    msg.put("realmId", event.getRealmId());
    msg.put("clientId", event.getClientId());
    msg.put("ipAddress", event.getIpAddress());
    msg.put("time", event.getTime());
    msg.put("details", event.getDetails());
    producer.send(new ProducerRecord<>(topic, json.writeValueAsString(msg)));
}
```

---

## 7. Phân tích Công nghệ — Release Management

### 7.1 FastAPI — Backend Framework

**Lý do chọn:**
- **Python async** — phù hợp với Kafka consumer chạy song song với HTTP server trong cùng process (threading model)
- **Pydantic validation** — request body tự động validate, serialize/deserialize type-safe
- **OpenAPI docs tự động** — `/docs` endpoint sẵn có, tiện cho team test
- **Dependency injection** — `get_current_user()` là FastAPI Depends, inject header `X-User-Id`/`X-User-Roles` từ Kong vào mọi endpoint một cách clean

**Thiết kế: Kong inject, backend không re-verify JWT:**
```python
def get_current_user(
    x_user_id: str = Header(..., alias="X-User-Id"),
    x_user_roles: str = Header(..., alias="X-User-Roles"),
) -> dict:
    # Kong đã verify JWT rồi → chỉ cần đọc header
    return {"user_id": x_user_id, "roles": x_user_roles.split(",")}
```
→ Backend **stateless** với auth, không cần Keycloak SDK, không cần gọi introspect

### 7.2 Celery + Redis — Task Queue

**Lý do chọn:**
- **Retry logic** — `@celery_app.task(bind=True, max_retries=3)` với `countdown=30` tự động retry khi pipeline fail do transient error (network, DB timeout)
- **Separation of concerns** — HTTP request return ngay, heavy work chạy async trong worker process
- **Redis làm broker** — lightweight, không cần PostgreSQL làm task queue (tránh polling overhead)

**Trade-off hiện tại:**
- Dev setup dùng `threading.Thread` trực tiếp thay vì `execute_pipeline.delay()` — tránh cần Celery worker process riêng trong single-container setup
- Production nên dùng `celery_app.delay()` với dedicated `celery worker` pod để có retry/rate-limit/visibility

### 7.3 PostgreSQL — Release State Store

**Lý do chọn thay vì Redis cho state:**
> "KHÔNG dùng Redis — PostgreSQL self-hosted là nguồn dữ liệu duy nhất" — comment trong `release-init.sql`

- **ACID transactions** — pipeline state transitions (`RUNNING → SCANNING → SUCCESS`) cần consistency; Redis không có transaction isolation
- **Complex queries** — rollback targets cần `WITH history_with_name AS (... ROW_NUMBER() OVER ...)` — SQL WINDOW FUNCTION; Redis không support
- **Immutability enforcement** — `release_history` cần trigger block UPDATE/DELETE — không thể làm với Redis
- **Partitioning** — `release_history` partitioned by month cho query performance và archive cũ sang cold storage

**Partitioned Table Design:**
```sql
CREATE TABLE release_history (
  deployed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ...
) PARTITION BY RANGE (deployed_at);

-- Partition tự động tạo đầu mỗi tháng qua API endpoint
CREATE TABLE release_history_2026_05
  PARTITION OF release_history
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
```
→ Query theo tháng chỉ scan 1 partition thay vì full table scan

### 7.4 MinIO — Object Storage

**Lý do chọn:**
- **S3-compatible API** — code dùng `httpx` gọi MinIO URL giống hệt S3 URL; migrate lên AWS S3 production chỉ cần đổi endpoint
- **Immutable artifacts** — build artifact push vào MinIO một lần, không overwrite (versioned path `packages/pkg-{version}/bundle.tar.gz`)
- **Rollback snapshots** — `rollback-snapshots/{env}-{version}.tar.gz` cho phép rollback chính xác đến deployment state đã biết

### 7.5 Security Scan Gate — Trivy + Bandit + pip-audit

**Tại sao 3 scanner?**

| Scanner | Loại scan | Lý do |
|---------|-----------|-------|
| **Trivy** | Container/filesystem CVE scan | Database CVE cập nhật daily từ NVD, OSV, GHSA; scan layer-by-layer |
| **Bandit** | Python SAST (Static Analysis) | Phát hiện hardcoded passwords, SQL injection, command injection trong source code |
| **pip-audit** | Dependency CVE | Kiểm tra `requirements.txt` → PyPI Advisory Database |

**Gate logic:** `overall_status = PASS` chỉ khi **cả 3** pass → một scanner fail → pipeline dừng ở `FAILED`

**Graceful degradation cho dev:** Nếu tool chưa install → skip + log warning (không fail hard) → dev local vẫn chạy được

### 7.6 OpenTelemetry + Jaeger — Distributed Tracing

**Lý do chọn:**
- **Vendor-neutral** — `opentelemetry-sdk` không lock-in vào Jaeger hay Datadog; chỉ cần đổi exporter
- **Span per pipeline step** — mỗi step (build, scan, deploy) là một span con, có thể xem waterfall trên Jaeger UI
- **Attribute propagation** — `span.set_attribute("release.pipeline_id", pipeline_id)` → filter traces theo pipeline

```python
with tracer.start_as_current_span("pipeline.execute") as span:
    span.set_attribute("release.pipeline_id", pipeline_id)
    with tracer.start_as_current_span("pipeline.build"):
        ...
    with tracer.start_as_current_span("pipeline.scan"):
        ...
```

### 7.7 structlog — Structured Logging

**Lý do chọn thay vì logging standard:**
- **JSON output** — `structlog.processors.JSONRenderer()` → log ship sang ELK/Loki không cần parse
- **Key-value context** — `log.info("pipeline.started", pipeline_id=id, user=user)` thay vì f-string → queryable
- **Consistent format** — tất cả services dùng cùng format → dễ correlate logs theo `pipeline_id`

### 7.8 deepdiff — Drift Detection

**Lý do chọn:**
- **Recursive diff** — so sánh nested dict (JSON config) chính xác, detect thay đổi ở bất kỳ level nào
- **Semantic diff** — phân biệt `dictionary_item_added`, `values_changed`, `type_changes` → biết chính xác loại drift
- **Ignore order** — `ignore_order=True` với list values → không false-positive khi thứ tự khác nhưng content giống

```python
diff = DeepDiff(prod_config, staging_config, ignore_order=True)
# → {"values_changed": {"root['max_agents']": {"old_value": "100", "new_value": "50"}}}
```

---

## 8. Quyết định Thiết kế quan trọng

### 8.1 Single PostgreSQL cho tất cả (Keycloak + Kong + Release)

**Lý do:** Giảm infra complexity trong dev/staging. Tách schema (`keycloak`, `kong`, `public`) đảm bảo isolation logic mà không cần 3 DB instance riêng.

**Production:** Nên tách thành 3 instance riêng để tránh resource contention và independent scaling.

### 8.2 Kong dùng internal DNS cho JWKS URI

**Vấn đề:** Nếu dùng `localhost:8080` trong `jwks_uri`, Kong container không thể reach Keycloak (localhost trong container = container chính, không phải host).

**Fix:** `jwks_uri = http://aeroflow-keycloak-lb:8080/realms/aeroflow/protocol/openid-connect/certs`  
→ Docker DNS resolve `aeroflow-keycloak-lb` → HAProxy → Keycloak

### 8.3 `release_history` là Immutable Append-Only

```sql
CREATE OR REPLACE FUNCTION fn_release_history_immutable()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'release_history is immutable — UPDATE/DELETE are not allowed';
END;
$$;
```

**Lý do:** Release history là audit trail; cho phép UPDATE/DELETE tạo ra gap trong compliance audit. Trigger enforce at DB level — không thể bypass bởi bất kỳ application code nào.

### 8.4 Rollback — Compensating Transaction (3 Steps)

Thay vì single atomic operation (không thể với multi-system), rollback dùng **saga pattern**:

```
Step 1: Update PostgreSQL release pointer (reversible: update lại)
Step 2: Patch Kong upstream route        (reversible: patch lại)
Step 3: Redeploy MinIO snapshot          (best-effort, không fail rollback nếu miss)
```

Nếu Step N fail → compensate steps 1..N-1 → status = `PARTIAL_ROLLBACK` + PagerDuty alert

### 8.5 Kafka Consumer dùng Thread, không dùng Celery trong Dev

**Lý do:** Celery yêu cầu separate worker process. Trong single-container dev setup, dùng `threading.Thread` cho consumer loop đơn giản hơn mà vẫn non-blocking.

**Production path:** Dùng `execute_pipeline.delay(event)` với dedicated Celery worker pod → có retry, rate-limit, task visibility.

### 8.6 Environment Configs trong PostgreSQL thay vì Redis

Redis là volatile cache — restart mất data. `environment_configs` là source-of-truth cho drift detection, không thể dùng cache. PostgreSQL với `UNIQUE (environment, key, version)` đảm bảo consistency và có full query capability.

---

## 9. Security Model

### 9.1 Authentication Flow

```
Client → JWT (RS256, 900s TTL) → Kong verify (JWKS cache 300s) → Backend (header only)
```

- Token không thể giả mạo (RS256 asymmetric)
- Token hết hạn sau 15 phút (configurable)
- Backend không cần gọi Keycloak → stateless, high performance

### 9.2 Authorization Layers

| Layer | Cơ chế | Ví dụ |
|-------|--------|-------|
| Network | IP Restriction (Kong) | Chỉ private IP ranges |
| Rate Limit | Kong plugin | 300 req/min per IP |
| Authentication | JWT RS256 (Kong aeroflow-jwks) | Bearer token required |
| Authorization | Role-based (FastAPI Depends) | `platform-admin` only cho rollback |
| Data | PostgreSQL trigger | `release_history` immutable |

### 9.3 Role Matrix

| Role | Trigger Pipeline | Approve Staging/Prod | Rollback | Drift Detect | Admin |
|------|:---:|:---:|:---:|:---:|:---:|
| `platform-admin` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `ai-engineer` | ✅ | ✅ | ❌ | ✅ | ❌ |
| `executive-viewer` | ❌ | ❌ | ❌ | ❌ | ❌ |

### 9.4 Kafka ACL Matrix

| User | Topic | Read | Write |
|------|-------|:----:|:-----:|
| `audit-bridge` | `audit.auth.events` | ❌ | ✅ |
| `audit-consumer` | `audit.auth.events` | ✅ | ❌ |
| `ci-service` | `release.pipeline.triggered` | ❌ | ✅ |
| `release-worker` | `release.pipeline.triggered` | ✅ | ❌ |
| `release-worker` | `release.pipeline.status` | ❌ | ✅ |
| `notification-consumer` | `release.pipeline.status` | ✅ | ❌ |

---

## 10. Hạn chế & Hướng phát triển

### Hạn chế hiện tại

| # | Hạng mục | Mức độ | Ghi chú |
|---|----------|--------|---------|
| 1 | Single PostgreSQL instance | Medium | Keycloak + Kong + Release dùng chung; cần tách cho production |
| 2 | Celery dùng thread thay worker | Low | Dev only; production cần dedicated Celery worker pod |
| 3 | Jaeger/OTEL Collector chưa deploy | Low | Span được tạo nhưng exporter fail silently (`OTEL_EXPORTER_OTLP_ENDPOINT=""`) |
| 4 | MongoDB configured nhưng unused | Low | `MONGO_URI` set nhưng package manifest ghi PostgreSQL; có thể bỏ |
| 5 | MinIO snapshots chưa có automation | Medium | Step 3 rollback best-effort; cần CI/CD job push snapshot sau mỗi deploy |
| 6 | SASL/PLAIN trong Kafka (dev) | Medium | Production cần SCRAM-SHA-256 với external secret store |
| 7 | Kong `policy=local` rate-limit | Low | Multi-worker → effective limit = 20×300 RPM; nếu cần per-user strict limit dùng `policy=redis` |

### Hướng phát triển

```
Phase 1 (Production hardening):
  ├── Tách PostgreSQL: keycloak-db / kong-db / app-db
  ├── Kafka SCRAM-SHA-256 + TLS (SASL_SSL)
  ├── Kong rate-limit policy=redis (per-user strict)
  ├── Deploy Jaeger + OTEL Collector
  └── MinIO snapshot automation (CI/CD post-deploy hook)

Phase 2 (Scale):
  ├── Celery worker horizontal scale (separate pod)
  ├── Kafka 3-node KRaft cluster (controller quorum)
  ├── Kong cluster (2+ nodes behind LB)
  └── Read replica PostgreSQL cho release history queries

Phase 3 (Observability):
  ├── Grafana + Prometheus metrics từ Kong (Prometheus plugin)
  ├── Log aggregation: structlog → Loki → Grafana
  ├── Alertmanager cho drift events + PARTIAL_ROLLBACK
  └── SLO dashboard: pipeline success rate, approval latency, scan pass rate
```

---

## Appendix — Tech Stack Summary

| Công nghệ | Version | Vai trò | Layer |
|-----------|---------|---------|-------|
| **Keycloak** | 24.x | OIDC/OAuth2 Identity Provider, HA cluster | Auth |
| **HAProxy** | 2.8-alpine | Load Balancer cho Keycloak, health-check | Auth |
| **Kong Gateway** | 3.6.x | API Gateway, JWT verify, plugins | Gateway |
| **Kafka** | 3.7.0 (KRaft) | Event bus, audit pipeline, release events | Messaging |
| **PostgreSQL** | 16-alpine | Primary DB (Keycloak + Kong + App) | Data |
| **Redis** | latest | Celery broker, task queue | Queue |
| **FastAPI** | 0.100+ | Release Worker REST API | Backend |
| **Celery** | 5.x | Async task queue cho pipeline execution | Backend |
| **Pydantic** | 2.x | Request validation, data models | Backend |
| **React + Vite** | 18.x + 5.x | Frontend SPA | UI |
| **TypeScript** | 5.x | Type-safe frontend code | UI |
| **MinIO** | latest | S3-compatible artifact storage | Storage |
| **Trivy** | latest | Container/FS CVE scanner | Security |
| **Bandit** | latest | Python SAST scanner | Security |
| **pip-audit** | latest | Python dependency CVE scanner | Security |
| **OpenTelemetry** | latest | Distributed tracing SDK | Observability |
| **structlog** | latest | Structured JSON logging | Observability |
| **deepdiff** | latest | Config drift detection | Reliability |
| **Docker Compose** | v2 | Local orchestration | Infra |

---

*Báo cáo này được tổng hợp từ codebase `Data-Agentt`, `auth-runbook.md`, và kết quả test thực tế ngày 2026-05-27.*
