-- ─── Release Management Schema ──────────────────────────────────────
-- Tất cả state cho pipeline, packages, environments, rollbacks, history.
-- KHÔNG dùng Redis — PostgreSQL self-hosted là nguồn dữ liệu duy nhất.
-- Xem docs/release-system.md để biết thiết kế chi tiết.

-- ─── Pipelines ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pipelines (
  id              TEXT PRIMARY KEY,                     -- pipe-YYYYMMDD-xxxxxx
  pipeline_name   TEXT,                                 -- human-readable name. VD: "GlobalCorp_Agent Promotion"
  triggered_by    TEXT NOT NULL,                        -- Keycloak sub (X-User-Id)
  trigger_type    TEXT NOT NULL DEFAULT 'MANUAL'
                    CHECK (trigger_type IN ('MANUAL','GIT_PUSH','SCHEDULED')),
  commit_sha      TEXT,
  branch          TEXT,
  package_version TEXT,
  target_env      TEXT,                                 -- primary deploy target: dev / staging / prod / uat
  status          TEXT NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING','RUNNING','BUILDING','SCANNING',
                                      'AWAITING_APPROVAL','DEPLOYING','SUCCESS',
                                      'FAILED','ROLLED_BACK')),
  risk_score      SMALLINT,                             -- 0–100: tính từ CVE count, environment, change scope
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS pipeline_steps (
  id           BIGSERIAL PRIMARY KEY,
  pipeline_id  TEXT NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  step_name    TEXT NOT NULL,                           -- build / scan_trivy / scan_bandit /
                                                        -- scan_pip_audit / approval / deploy
  status       TEXT NOT NULL DEFAULT 'PENDING'
                 CHECK (status IN ('PENDING','RUNNING','SUCCESS','FAILED','SKIPPED')),
  started_at   TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms  INTEGER,
  output       JSONB DEFAULT '{}',
  error        TEXT
);

CREATE INDEX IF NOT EXISTS idx_pipeline_steps_pipeline ON pipeline_steps(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_pipelines_status ON pipelines(status, created_at);

-- ─── Release Packages ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS release_packages (
  id                TEXT PRIMARY KEY,                   -- pkg-vX.Y.Z
  pipeline_id       TEXT REFERENCES pipelines(id),
  artifact_paths    JSONB NOT NULL DEFAULT '[]',        -- MinIO / S3 paths
  validation_score  SMALLINT,                           -- 0–100
  status            TEXT NOT NULL DEFAULT 'BUILDING'
                      CHECK (status IN ('BUILDING','SCAN_PENDING','SCAN_FAILED',
                                        'VALIDATED','PROMOTING','PROMOTED','REJECTED')),
  created_by        TEXT NOT NULL,
  environment_targets JSONB NOT NULL DEFAULT '[]',      -- ["dev","staging","production"]
  scan_result       JSONB NOT NULL DEFAULT '{}',        -- trivy, bandit, pip_audit results
  promoted_to_s3_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_release_packages_status ON release_packages(status, created_at);

-- ─── Release Approvals ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS release_approvals (
  id           BIGSERIAL PRIMARY KEY,
  package_id   TEXT NOT NULL REFERENCES release_packages(id),
  environment  TEXT NOT NULL,                           -- staging / production
  decision     TEXT NOT NULL,                           -- APPROVED / REJECTED
  approved_by  TEXT NOT NULL,                           -- username
  approved_at  TIMESTAMPTZ DEFAULT now(),
  comment      TEXT,
  UNIQUE (package_id, environment, approved_by)
);

-- ─── Environment Configs ─────────────────────────────────────────────
-- Thay Redis (volatile) — PostgreSQL làm single source of truth cho tất cả env configs.

CREATE TABLE IF NOT EXISTS environment_configs (
  id           BIGSERIAL PRIMARY KEY,
  environment  TEXT NOT NULL,                           -- dev / staging / production
  key          TEXT NOT NULL,
  value        TEXT NOT NULL,                           -- bí mật → lưu OpenBao path, không raw
  is_secret    BOOLEAN DEFAULT false,
  version      SMALLINT DEFAULT 1,
  is_active    BOOLEAN DEFAULT true,
  updated_by   TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (environment, key, version)
);

CREATE INDEX IF NOT EXISTS idx_env_configs_env ON environment_configs(environment, is_active);

-- ─── Release History (Immutable) ─────────────────────────────────────
-- KHÔNG có UPDATE / DELETE — chỉ INSERT.
-- Partitioned by month; records > 12 tháng → MinIO/S3 cold storage.

CREATE TABLE IF NOT EXISTS release_history (
  id            BIGSERIAL NOT NULL,
  pipeline_id   TEXT NOT NULL,
  package_id    TEXT,
  environment   TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('SUCCESS','FAILED','ROLLED_BACK')),
  triggered_by  TEXT NOT NULL,
  deployed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_ms   INTEGER,
  metadata      JSONB NOT NULL DEFAULT '{}',
  PRIMARY KEY (id, deployed_at)
) PARTITION BY RANGE (deployed_at);

-- Monthly partitions — thêm partition mới đầu mỗi tháng
CREATE TABLE IF NOT EXISTS release_history_2026_05
  PARTITION OF release_history
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

CREATE TABLE IF NOT EXISTS release_history_2026_06
  PARTITION OF release_history
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

CREATE TABLE IF NOT EXISTS release_history_2026_07
  PARTITION OF release_history
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');

CREATE TABLE IF NOT EXISTS release_history_2026_08
  PARTITION OF release_history
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
-- Catch-all for rows outside defined monthly ranges.
CREATE TABLE IF NOT EXISTS release_history_default PARTITION OF release_history DEFAULT;

CREATE INDEX IF NOT EXISTS idx_release_history_env ON release_history(environment, deployed_at);
CREATE INDEX IF NOT EXISTS idx_release_history_pipeline ON release_history(pipeline_id);

-- Immutability enforcement: block UPDATE and DELETE on release_history
CREATE OR REPLACE FUNCTION fn_release_history_immutable()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'release_history is immutable — UPDATE/DELETE are not allowed (audit trail cannot be altered)';
END;
$$;

DROP TRIGGER IF EXISTS trg_release_history_no_update ON release_history;
CREATE TRIGGER trg_release_history_no_update
  BEFORE UPDATE ON release_history
  FOR EACH ROW EXECUTE FUNCTION fn_release_history_immutable();

DROP TRIGGER IF EXISTS trg_release_history_no_delete ON release_history;
CREATE TRIGGER trg_release_history_no_delete
  BEFORE DELETE ON release_history
  FOR EACH ROW EXECUTE FUNCTION fn_release_history_immutable();

-- ─── Rollback Operations ─────────────────────────────────────────────
-- Compensating transaction pattern — ghi trạng thái từng bước rollback.

CREATE TABLE IF NOT EXISTS rollback_operations (
  id              TEXT PRIMARY KEY,                     -- rb-YYYYMMDD-xxxxxx
  pipeline_id     TEXT REFERENCES pipelines(id),
  from_version    TEXT NOT NULL,
  to_version      TEXT NOT NULL,
  environment     TEXT NOT NULL,
  triggered_by    TEXT NOT NULL,
  reason          TEXT,
  status          TEXT NOT NULL DEFAULT 'INITIATED'
                    CHECK (status IN ('INITIATED','STEP1_DB','STEP2_KONG',
                                      'STEP3_DEPLOY','SUCCESS','PARTIAL_ROLLBACK','FAILED')),
  current_step    SMALLINT DEFAULT 0,
  steps_result    JSONB DEFAULT '[]',                   -- [{step, status, error, ts}]
  started_at      TIMESTAMPTZ DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  alert_sent      BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_rollback_ops_env ON rollback_operations(environment, started_at);

-- ─── Drift Events ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS drift_events (
  id             BIGSERIAL PRIMARY KEY,
  detected_at    TIMESTAMPTZ DEFAULT now(),
  env_pair       TEXT NOT NULL,                         -- e.g. "production vs staging"
  drift_keys     JSONB DEFAULT '[]',                    -- list of differing keys
  severity       TEXT DEFAULT 'CRITICAL_DRIFT',
  resolved       BOOLEAN DEFAULT false,
  resolved_by    TEXT,
  resolved_at    TIMESTAMPTZ,
  resolution     TEXT                                   -- "APPROVED_AS_INTENTIONAL" / "SYNCED_FROM_UAT"
);

CREATE INDEX IF NOT EXISTS idx_drift_events_resolved ON drift_events(resolved, detected_at);

-- ─── Kafka Users cho Release System ─────────────────────────────────
-- Thêm vào reference: user này cần được tạo trong Kafka SCRAM credentials.
-- ci-service: WRITE release.pipeline.triggered
-- release-worker: READ release.pipeline.triggered + WRITE release.pipeline.status
-- drift-detector: WRITE release.drift.detected
-- notification-consumer: READ release.pipeline.status + release.drift.detected

COMMENT ON TABLE pipelines IS 'Pipeline state machine — từ PENDING đến SUCCESS/FAILED';
COMMENT ON TABLE release_packages IS 'Package manifest + security scan results từ Trivy/Bandit/pip-audit';
COMMENT ON TABLE environment_configs IS 'Thay Redis — PostgreSQL là config store cho Dev/Staging/Prod';
COMMENT ON TABLE release_history IS 'Immutable audit log partitioned by month — không UPDATE/DELETE';
COMMENT ON TABLE rollback_operations IS 'Compensating transaction rollback — ghi trạng thái từng bước';
COMMENT ON TABLE drift_events IS 'Drift detection log khi prod config # staging config';
