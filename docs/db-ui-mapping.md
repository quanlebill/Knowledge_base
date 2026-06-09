# DB Table → UI Feature Mapping

| DB Table | Mô tả ngắn | Columns chính | UI Feature / Screen |
|---|---|---|---|
| `tenants` | Registry tenant, slug, data residency | `id`, `name`, `slug`, `plan_id`, `data_residency`, `is_active` | Tenant settings page, org switcher, onboarding wizard |
| `plans` | Gói dịch vụ và giới hạn quota | `name`, `max_users`, `max_envs`, `max_deploy_daily`, `features` | Plan & billing page, upgrade prompt, quota warning banner |
| `roles` | Lookup role nghiệp vụ (không dùng ENUM) | `name`, `is_system` | Role selector dropdown, member invite form, role badge |
| `keycloak_realm_configs` | Keycloak realm config cho từng tenant — 1 tenant = 1 realm | `realm_name`, `keycloak_base_url`, `client_id`, `client_secret_ref`, `jwks_url`, `is_active` | SSO / Auth settings page, realm provisioning status, token config panel |
| `keycloak_role_mappings` | Map platform role ↔ Keycloak realm role | `role_id`, `keycloak_role`, `keycloak_client` | Role mapping editor (admin UI), JWT claim → permission debug panel |
| `members` | User trong tenant — Keycloak subject + role nghiệp vụ | `user_id` *(Keycloak sub)*, `role_id`, `tenant_role` | Members list table, invite modal, role change dropdown |
| `ip_allowlists` | Danh sách IP/CIDR được phép truy cập | `cidr`, `label`, `is_active` | IP allowlist manager, add/remove CIDR form, active toggle |
| `api_keys` | API key hash, scope, expiry, rotation chain | `key_hash`, `key_prefix`, `scope`, `expires_at`, `revoked_at`, `rotated_from` | API keys list, create key modal, revoke button, key prefix display |
| `secrets_vault` | Metadata secret — giá trị thực ở OpenBao | `key_name`, `key_type`, `openbao_path`, `version`, `rotation_due_at` | Secrets list, rotation status badge, rotation due alert, version history |
| `key_rotations` | Audit trail rotation key kể cả Panic Mode | `triggered_by`, `old_version`, `new_version`, `status`, `error` | Key rotation history log, triggered-by badge (SCHEDULED / MANUAL / PANIC) |
| `webhooks` | Endpoint URL, JSONB events, failure count | `url`, `events`, `failure_count`, `is_active`, `secret_ref` | Webhooks list, event filter checkboxes, failure count badge, active toggle |
| `audit_logs` | Append-only log — `actor` là string (GDPR safe), partition theo tháng | `actor`, `actor_type`, `action`, `resource_type`, `status`, `metadata` | Audit log viewer, actor/action filter, date range picker, export CSV |
| `pii_access_logs` | Log truy cập PII, scrubbed status, partition theo tháng | `accessor_id`, `field_accessed`, `access_reason`, `scrubbed`, `status` | PII access report, scrubbed indicator, compliance export |
| `environments` | DEV/SIT/UAT/STAGING/PROD — 3 version component độc lập | `name`, `status`, `agent_runtime_version`, `mcp_runtime_version`, `policy_version` | Environment dashboard, version chips (Agent / MCP / Policy), status badge |
| `deployments` | Release pipeline, state machine, risk score, wizard draft | `type`, `status`, `risk_score`, `wizard_state`, `owner_id`, `approver_id` | Deployments list, pipeline wizard, status stepper, approval request card |
| `pipeline_stages` | Từng stage của deployment — ghi khi stage kết thúc, log ở MinIO | `stage_name`, `status`, `duration_ms`, `log_url`, `metadata` | Pipeline progress drawer, stage timeline, log viewer (link MinIO) |
| `release_history` | Immutable record: approval + drift snapshot + 3 version tại thời điểm release | `approval_decision`, `drift_count`, `critical_drift_count`, `snapshot_url`, `env_agent_version`, `env_mcp_version`, `env_policy_version` | Release history table, approval decision panel, drift summary, rollback button |
