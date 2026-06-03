# Auth & Security — Database Design
> OperationsCenter Platform | 2026-05-19

---

## Tổng quan

Auth & Security được tổ chức thành 2 nhóm:

- **Platform Core** — quản lý tenant, user, role, SSO (Keycloak)
- **Auth & Security** — API key, secrets, IP whitelist, audit, PII compliance

---

## Platform Core

### `plans`
Định nghĩa gói dịch vụ, kiểm soát quota toàn tenant.

| Field | Type | Ghi chú |
|---|---|---|
| `id` | smallint PK | auto-increment |
| `name` | varchar UNIQUE | `STARTER` / `PROFESSIONAL` / `ENTERPRISE` |
| `max_users` | integer | |
| `max_envs` | smallint | |
| `max_secrets` | integer | |
| `max_deploy_daily` | integer | |
| `max_api_keys` | integer | |
| `features` | jsonb | `{"sso":true,"audit":true,"mcp_gateway":true}` |

---

### `tenants`
Đơn vị tổ chức cao nhất. Mọi resource đều thuộc 1 tenant.

| Field | Type | Ghi chú |
|---|---|---|
| `id` | uuid PK | |
| `name` | varchar | |
| `slug` | varchar UNIQUE | |
| `plan_id` | smallint FK | → `plans.id` |
| `data_residency` | varchar | `Asia-SE1` / `US-East-1` / `EU-West-3` |
| `is_active` | boolean | default `true` |
| `created_at` | timestamp | |
| `deleted_at` | timestamp NULL | soft delete |

**Quan hệ:** 1 tenant thuộc 1 plan. 1 plan có nhiều tenants.

---

### `roles`
Role hệ thống, định nghĩa sẵn, không phải per-tenant.

| Field | Type | Ghi chú |
|---|---|---|
| `id` | smallint PK | auto-increment |
| `name` | varchar UNIQUE | `PLATFORM_ADMIN` / `AI_ENGINEER` / `BUSINESS_OPERATOR` / `EXECUTIVE` |
| `description` | text | |
| `is_system` | boolean | default `true` |
| `created_at` | timestamp | |

---

### `members`
User thuộc một tenant cụ thể. Bridge giữa Keycloak identity và platform role.

| Field | Type | Ghi chú |
|---|---|---|
| `id` | uuid PK | |
| `tenant_id` | uuid FK | → `tenants.id` |
| `user_id` | varchar | Keycloak `sub` claim |
| `role_id` | smallint FK | → `roles.id` |
| `tenant_role` | varchar | `admin` / `editor` / `viewer` |
| `is_active` | boolean | default `true` |
| `joined_at` | timestamp | |
| `deleted_at` | timestamp NULL | soft delete |

**Index:** `(tenant_id, user_id)` UNIQUE — 1 user chỉ xuất hiện 1 lần trong 1 tenant.

**Quan hệ:**
- `members` → `tenants` (nhiều member thuộc 1 tenant)
- `members` → `roles` (nhiều member có cùng role)

---

### `keycloak_realm_configs`
Cấu hình SSO per-tenant. Lưu thông tin kết nối đến Keycloak realm.

| Field | Type | Ghi chú |
|---|---|---|
| `tenant_id` | uuid PK FK | → `tenants.id` (quan hệ 1-1) |
| `realm_name` | varchar UNIQUE | |
| `keycloak_base_url` | text | |
| `client_id` | varchar | |
| `client_secret_ref` | text | **OpenBao path** — không lưu secret trực tiếp |
| `jwks_url` | text | |
| `token_endpoint` | text | |
| `token_ttl_seconds` | integer | default `900` |
| `is_active` | boolean | |
| `created_at` / `updated_at` | timestamp | |

**Quan hệ:** 1-1 với `tenants`.

---

### `keycloak_role_mappings`
Map Keycloak role → platform role. Cho phép nhiều Keycloak role ánh xạ vào cùng 1 platform role.

| Field | Type | Ghi chú |
|---|---|---|
| `id` | uuid PK | |
| `role_id` | smallint FK | → `roles.id` |
| `keycloak_role` | varchar | tên role bên Keycloak |
| `keycloak_client` | varchar | client Keycloak chứa role |
| `description` | text | |
| `created_at` | timestamp | |

**Index:** `(role_id, keycloak_role)` UNIQUE.

**Quan hệ:** nhiều Keycloak roles → 1 platform role.

---

## Auth & Security

### `ip_allowlists`
Whitelist IP/CIDR per-tenant, kiểm soát truy cập theo network.

| Field | Type | Ghi chú |
|---|---|---|
| `id` | uuid PK | |
| `tenant_id` | uuid FK | → `tenants.id` |
| `cidr` | varchar | vd: `10.0.0.0/24` |
| `label` | varchar | tên mô tả |
| `is_active` | boolean | |
| `created_by` | uuid FK | → `members.id` |
| `created_at` | timestamp | |

---

### `api_keys`
API key cho programmatic access. Hỗ trợ rotation và revoke.

| Field | Type | Ghi chú |
|---|---|---|
| `id` | uuid PK | |
| `tenant_id` | uuid FK | → `tenants.id` |
| `created_by` | uuid FK | → `members.id` |
| `name` | varchar | |
| `key_hash` | varchar UNIQUE | `bcrypt(key)` — không lưu raw key |
| `key_prefix` | varchar | hiển thị để user nhận diện |
| `scope` | varchar | `full_access` / `read_only` / `admin_platform` |
| `last_used_at` | timestamp | |
| `expires_at` | timestamp | |
| `revoked_at` | timestamp | |
| `created_at` | timestamp | |
| `rotated_from` | uuid FK | → `api_keys.id` (self-ref, audit rotation chain) |

---

### `secrets_vault`
Registry metadata của secrets lưu trong OpenBao. **Không lưu secret value.**

| Field | Type | Ghi chú |
|---|---|---|
| `id` | uuid PK | |
| `tenant_id` | uuid FK | → `tenants.id` |
| `key_name` | varchar | |
| `key_type` | varchar | `ENCRYPTION_KEY` / `SIGNING_KEY` / `HMAC_KEY` / `BEARER_TOKEN` / `MCP_TOKEN` / `KB_API_KEY` |
| `algorithm` | varchar | |
| `openbao_path` | text | pointer vào OpenBao |
| `version` | smallint | default `1` |
| `is_active` | boolean | |
| `rotation_due_at` | timestamp | |
| `last_rotated_at` | timestamp | |
| `created_at` | timestamp | |

**Index:** `(tenant_id, key_name, version)` UNIQUE.

---

### `key_rotations`
Audit log mỗi lần rotate secret.

| Field | Type | Ghi chú |
|---|---|---|
| `id` | uuid PK | |
| `secret_id` | uuid FK | → `secrets_vault.id` |
| `triggered_by` | varchar | `SCHEDULED` / `MANUAL` / `PANIC` |
| `actor_id` | uuid FK | → `members.id` |
| `old_version` | smallint | |
| `new_version` | smallint | |
| `status` | varchar | `SUCCESS` / `FAILED` |
| `error` | text | |
| `rotated_at` | timestamp | |

**Quan hệ:** 1 secret có nhiều rotation events.

---

### `webhooks`
Outbound webhook per-tenant, push events ra external system.

| Field | Type | Ghi chú |
|---|---|---|
| `id` | uuid PK | |
| `tenant_id` | uuid FK | → `tenants.id` |
| `created_by` | uuid FK | → `members.id` |
| `url` | text | |
| `secret_ref` | varchar | HMAC signing secret (OpenBao ref) |
| `events` | jsonb | danh sách event subscribe |
| `is_active` | boolean | |
| `failure_count` | smallint | tự increment khi call thất bại |
| `created_at` | timestamp | |

---

### `audit_logs`
Append-only. Ghi mọi hành động trên platform. **Không có FK đến `members`** — giữ log ngay cả khi user bị xoá.

| Field | Type | Ghi chú |
|---|---|---|
| `id` | uuid PK | |
| `tenant_id` | uuid FK | → `tenants.id` |
| `actor` | varchar | string tự do, **không FK** |
| `actor_type` | varchar | `USER` / `AGENT` / `SERVICE_ACCOUNT` / `SYSTEM` |
| `action` | varchar | |
| `resource_type` | varchar | |
| `resource_id` | varchar | |
| `status` | varchar | `SUCCESS` / `WARNING` / `FAILED` |
| `metadata` | jsonb | |
| `ip_address` | varchar | |
| `created_at` | timestamp | **Partition key** — range partition theo tháng |

---

### `pii_access_logs`
Log mỗi lần truy cập dữ liệu PII. Phục vụ compliance (GDPR/...).

| Field | Type | Ghi chú |
|---|---|---|
| `id` | uuid PK | |
| `tenant_id` | uuid FK | → `tenants.id` |
| `accessor_id` | uuid FK | → `members.id` |
| `accessor_type` | varchar | `USER` / `AGENT` / `SYSTEM` |
| `data_subject` | varchar | chủ thể dữ liệu |
| `field_accessed` | varchar | field cụ thể bị truy cập |
| `access_reason` | text | |
| `scrubbed` | boolean | đã ẩn danh hoá chưa |
| `status` | varchar | `GRANTED` / `DENIED` / `REDACTED` |
| `created_at` | timestamp | **Partition key** — range partition theo tháng |

---

## Sơ đồ quan hệ

```
plans ◄──────────────── tenants ─────────────────────────────────┐
                           │                                      │
              ┌────────────┼────────────┐                         │
              ▼            ▼            ▼                         │
           members   keycloak_realm   ip_allowlists               │
           /  │  \   _configs (1-1)                               │
          /   │   \                                               │
       roles  │  api_keys ──(rotated_from)──► api_keys           │
              │                                                   │
              ▼                                                   │
       key_rotations                                              │
                                                                  │
       secrets_vault ◄────────────────────────────────────────────┘
              │
       key_rotations

audit_logs    ──► tenants  (actor = string, không FK members)
pii_access_logs ─► tenants + members
webhooks      ──► tenants + members
```

---

## Security Patterns

| Pattern | Bảng áp dụng |
|---|---|
| Không lưu secret value | `secrets_vault`, `api_keys`, `keycloak_realm_configs` — chỉ lưu OpenBao path hoặc hash |
| Append-only + partition tháng | `audit_logs`, `pii_access_logs` |
| Soft delete | `tenants`, `members` |
| Self-ref rotation chain | `api_keys.rotated_from → api_keys.id` |
| Actor string thay vì FK | `audit_logs.actor` — bảo toàn log khi user bị xoá |
| Quota enforcement | `plans.max_api_keys`, `max_secrets` kiểm soát tạo resource |
| 1-1 SSO config per tenant | `keycloak_realm_configs.tenant_id` là PK |
| Unique user per tenant | `members (tenant_id, user_id)` UNIQUE index |
