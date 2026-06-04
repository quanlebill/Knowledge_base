# Release Management System — Kiến trúc & Thiết kế

> **AeroFlow Platform · 2026** · *Confidential*
>
> Tài liệu này mô tả kiến trúc Release Management System — cách pipeline được trigger, package được build, deploy qua môi trường, và rollback khi cần.
> Đọc `docs/auth-release-tech-stack-update.md` để xem toàn bộ tech stack và review comments.

---

## Mục lục

- [1. Tổng quan kiến trúc](#1-tổng-quan-kiến-trúc)
- [2. Pipeline (CI/CD)](#2-pipeline-cicd)
- [3. Package Builder](#3-package-builder)
- [4. Environment Management](#4-environment-management)
- [5. Rollback — Compensating Transaction Pattern](#5-rollback--compensating-transaction-pattern)
- [6. Release History & Audit](#6-release-history--audit)
- [7. Security Scanning Gate](#7-security-scanning-gate)
- [8. Observability](#8-observability)
- [9. Database Schema](#9-database-schema)
- [10. Kafka Topics](#10-kafka-topics)
- [11. Services](#11-services)

---

## 1. Tổng quan kiến trúc

```
CI/CD Trigger (Git push / Manual)
        │
        ▼
Kafka topic: release.pipeline.triggered  ──(SASL/SCRAM ACL)──►  Release Worker (Celery)
                                                                        │
                                                             ┌──────────┼──────────────┐
                                                             ▼          ▼              ▼
                                                        Build         Security      Package
                                                        Artifact      Scan Gate     Manifest
                                                        (MinIO)   Trivy+Bandit  (MongoDB)
                                                             │          │
                                                             └──── PASS ┘
                                                                    │
                                                           ┌────────┼────────┐
                                                           ▼        ▼        ▼
                                                          Dev    Staging  Production
                                                       (auto)  (Manual   (Dual approval
                                                                approval)  + score ≥95%)
                                                                    │
                                                    PostgreSQL self-hosted (state)
                                                    OpenBao (Prod secrets)
```

**Nguyên tắc thiết kế:**
- **Event-driven:** Kafka làm trục giao tiếp giữa các services
- **Immutable artifacts:** MinIO/S3 snapshot — không bao giờ overwrite
- **Gate-based promotion:** Security scan PASS → Manual approval → promote
- **Compensating rollback:** Mỗi bước có undo action tương ứng
- **PostgreSQL self-hosted:** Tất cả state — không dùng managed/volatile Redis

---

## 2. Pipeline (CI/CD)

### 2.1 Flow

```
1. Developer push → CI trigger event
2. CI service produce Kafka message → topic: release.pipeline.triggered
3. Release Worker (Celery) nhận task:
   a. Build artifact (Docker image / Python package)
   b. Push artifact → MinIO (internal) / S3 (prod)
   c. Security Scan gate (Trivy + Bandit + pip-audit)
   d. Nếu FAIL → pipeline BLOCKED, alert Slack/email
   e. Nếu PASS → ghi kết quả vào Package manifest (MongoDB)
   f. Auto-promote lên Dev (nếu tests pass)
   g. Manual approval flow → Staging / Production
4. Pipeline state ghi vào PostgreSQL: PENDING → RUNNING → SUCCESS / FAILED
5. Notification: RabbitMQ → Notification service → Slack/email
```

### 2.2 Kafka Message Schema

```json
{
  "event": "pipeline.triggered",
  "pipeline_id": "pipe-20260527-abc123",
  "triggered_by": "longth",
  "commit_sha": "4d143b2",
  "branch": "auth/release",
  "package_version": "v2.4.1",
  "target_environments": ["dev", "staging"],
  "timestamp": "2026-05-27T10:00:00Z"
}
```

### 2.3 Kafka Security

```
Topic: release.pipeline.triggered
Auth: SASL/SCRAM-SHA-512
ACL:
  - ci-service: WRITE + DESCRIBE
  - release-worker: READ + DESCRIBE + ConsumerGroup
  - (mọi user khác): DENIED
```

### 2.4 Pipeline States

```
PENDING → RUNNING → BUILDING → SCANNING → AWAITING_APPROVAL → DEPLOYING → SUCCESS
                                                                         → FAILED
                                                                         → ROLLED_BACK
```

---

## 3. Package Builder

### 3.1 Artifact Storage

```
MinIO (internal)  ── Artifact bundles trong quá trình build/staging
       │
       └─► S3 (production)  ── Promoted artifacts, immutable, versioned
```

**MinIO bucket structure:**
```
aeroflow-artifacts/
  ├── packages/
  │   ├── pkg-v2.4.1/
  │   │   ├── agent-configs.tar.gz
  │   │   ├── kb-snapshots.tar.gz
  │   │   └── workflow-logic.tar.gz
  │   └── pkg-v2.4.0/ (previous, immutable)
  └── rollback-snapshots/
      └── prod-snapshot-20260527-104500/
```

### 3.2 Package Manifest (MongoDB)

```json
{
  "package_id": "pkg-v2.4.1",
  "pipeline_id": "pipe-20260527-abc123",
  "artifacts": [
    "GlobalCorp_Agent_v2.4",
    "refund_policy_gold_index"
  ],
  "validation_score": 98,
  "status": "VALIDATED",
  "created_at": "2026-05-27T10:05:00Z",
  "created_by": "longth",
  "environment_targets": ["staging", "production"],
  "security_scan": {
    "trivy": { "status": "PASS", "critical": 0, "high": 0, "scanned_at": "2026-05-27T10:03:00Z" },
    "bandit": { "status": "PASS", "high_severity": 0, "scanned_at": "2026-05-27T10:03:30Z" },
    "pip_audit": { "status": "PASS", "vulnerabilities": 0, "scanned_at": "2026-05-27T10:04:00Z" }
  },
  "approvals": [
    { "env": "staging", "approved_by": "thiennlinh", "approved_at": "2026-05-27T11:00:00Z" }
  ]
}
```

### 3.3 Promotion Flow

```
MinIO (internal) ──[scan PASS + approval]──► S3 (production)
                                              │
                                     PostgreSQL: release_packages
                                     status: PROMOTED_TO_PROD
```

---

## 4. Environment Management

### 4.1 Config Store — PostgreSQL self-hosted

> ⚡ Thay Redis (volatile khi restart) bằng PostgreSQL self-hosted cho tất cả môi trường.

| Environment | Config Store | Secret Store | Promotion Gate |
|-------------|-------------|--------------|----------------|
| Dev | PostgreSQL (public schema) | ENV vars | Auto-promote khi tests pass |
| Staging / UAT | PostgreSQL (public schema) | ENV vars | Manual approval qua UI Dashboard |
| Production | PostgreSQL (public schema) | OpenBao | Dual approval + validation score ≥ 95% |

### 4.2 Approval Flow (UI Dashboard)

```
Reviewer nhận notification (Slack/email)
        │
        ▼
Vào UI Dashboard → xem diff (current vs target config)
        │
        ├─► Approve → Kong Admin API backend → deploy tiếp
        └─► Reject  → pipeline REJECTED, notify requester
```

### 4.3 Drift Detection

```python
# Chạy định kỳ (Celery beat) để so sánh production vs UAT config
diff = DeepDiff(prod_config, uat_config)
if diff:
    kafka.produce("release.drift.detected", {
        "detected_at": datetime.utcnow().isoformat(),
        "environment_pair": ["production", "staging"],
        "keys": list(diff.keys()),
        "severity": "CRITICAL_DRIFT"
    })
```

**Action plan khi phát hiện drift:**
1. `release.drift.detected` → Notification Service → alert Lead Dev + Release Manager (Slack/email)
2. **Block** auto-promotion lên Production cho đến khi drift được resolve
3. Reviewer xác nhận diff là intentional → approve, hoặc trigger sync lại từ UAT snapshot

---

## 5. Rollback — Compensating Transaction Pattern

### 5.1 Rollback Trigger

```
Kafka topic: release.rollback.initiated
{
  "rollback_id": "rb-20260527-001",
  "from_version": "v2.4.1",
  "to_version": "v2.4.0",
  "environment": "production",
  "triggered_by": "longth",
  "reason": "Critical bug in agent routing"
}
```

### 5.2 Compensating Steps

| Bước | Action | Compensating Action | Nếu fail |
|------|--------|---------------------|----------|
| 1 | Update release pointer PostgreSQL → v2.4.0 | Revert pointer về v2.4.1 | STOP, trạng thái `PARTIAL_ROLLBACK` |
| 2 | Reroute Kong upstream → v2.4.0 snapshot | Restore Kong route về v2.4.1 | STOP, trạng thái `PARTIAL_ROLLBACK` |
| 3 | Redeploy snapshot từ MinIO/S3 | — (MinIO immutable) | STOP, ghi lỗi |

**Quy tắc:**
- Nếu bất kỳ bước nào fail → **dừng ngay**, ghi `PARTIAL_ROLLBACK` vào PostgreSQL, gửi PagerDuty alert
- Không tự động retry rollback — cần human intervention
- Rollback event được ghi vào audit_logs

---

## 6. Release History & Audit

### 6.1 Storage

```
Primary store   : PostgreSQL release_history (immutable rows — no UPDATE/DELETE)
Full-text search: Elasticsearch (filter env, status, agent, date)
Audit export    : PostgreSQL → CSV/PDF via FastAPI endpoint
Archival        : Records > 12 tháng → MinIO/S3 cold storage
```

### 6.2 Table Partitioning

```sql
-- release_history partitioned by month
CREATE TABLE release_history (
  id            BIGSERIAL,
  pipeline_id   TEXT NOT NULL,
  package_id    TEXT,
  environment   TEXT NOT NULL,
  status        TEXT NOT NULL,  -- SUCCESS / FAILED / ROLLED_BACK
  triggered_by  TEXT NOT NULL,
  deployed_at   TIMESTAMPTZ NOT NULL,
  metadata      JSONB DEFAULT '{}'
) PARTITION BY RANGE (deployed_at);
```

---

## 7. Security Scanning Gate

### 7.1 Tools

| Tool | Loại scan | Điều kiện fail | Timeout |
|------|-----------|---------------|---------|
| **Trivy** | Container image CVE scan | Bất kỳ CVE Critical/High | 5 phút |
| **Bandit** | SAST — Python source code | High severity issue | 2 phút |
| **pip-audit** | Dependency vulnerability | Known CVE trong dependencies | 2 phút |

### 7.2 Pipeline Gate Flow

```
Build artifact
     │
     ▼
┌─────────────────────────────────────────┐
│ Security Scan Gate (parallel)           │
│   ┌─────────┐ ┌────────┐ ┌───────────┐ │
│   │ Trivy   │ │ Bandit │ │ pip-audit │ │
│   └────┬────┘ └───┬────┘ └─────┬─────┘ │
└────────┼──────────┼────────────┼────────┘
         │          │            │
         └──────────┴─── All PASS?
                             │
              ┌──────────────┴──────────────┐
              ▼ FAIL                        ▼ PASS
    Pipeline BLOCKED              Ghi kết quả vào
    Alert Slack/email             Package manifest MongoDB
                                          │
                                          ▼
                                  Promote lên Staging/Production
```

### 7.3 Scan Result Schema

```json
{
  "scan_id": "scan-20260527-abc",
  "pipeline_id": "pipe-20260527-abc123",
  "overall_status": "PASS",
  "results": {
    "trivy": { "status": "PASS", "critical": 0, "high": 0, "medium": 3 },
    "bandit": { "status": "PASS", "high": 0, "medium": 1, "low": 5 },
    "pip_audit": { "status": "PASS", "vulnerabilities": 0 }
  },
  "scanned_at": "2026-05-27T10:03:00Z"
}
```

---

## 8. Observability

### 8.1 Distributed Tracing (OpenTelemetry → Jaeger)

```python
from opentelemetry import trace

tracer = trace.get_tracer("release-service")

with tracer.start_as_current_span("pipeline.execute") as span:
    span.set_attribute("release.package_id", package_id)
    span.set_attribute("release.environment", env)
    span.set_attribute("release.validation_score", score)
    span.set_attribute("release.triggered_by", triggered_by)
```

**Trace coverage:**
- `pipeline.trigger` → nhận Kafka message
- `pipeline.build` → build artifact, push MinIO
- `pipeline.scan` → security scan gate
- `pipeline.approve` → approval flow
- `pipeline.deploy` → deploy to environment
- `pipeline.rollback` → rollback steps

### 8.2 Metrics (DataDog — DORA Metrics)

| Metric | Description |
|--------|-------------|
| `release.deployment_frequency` | Số lần deploy / ngày / service |
| `release.lead_time_minutes` | Từ commit đến production |
| `release.mttr_minutes` | Mean Time To Recovery |
| `release.change_failure_rate` | % deploy dẫn đến rollback |
| `release.scan_pass_rate` | % packages vượt security gate |

### 8.3 Logs (Grafana/Loki)

```python
import structlog

log = structlog.get_logger()
log.info("pipeline.step.completed",
    pipeline_id=pipeline_id,
    step="security_scan",
    duration_ms=duration,
    status="PASS"
)
```

---

## 9. Database Schema

### Các bảng chính (xem `infra/sql/release-init.sql`)

| Table | Lưu gì |
|-------|--------|
| `pipelines` | Pipeline state: PENDING → SUCCESS/FAILED |
| `pipeline_steps` | Từng bước trong pipeline với trạng thái riêng |
| `release_packages` | Package manifest, security scan results |
| `environment_configs` | Config cho từng môi trường (Dev/Staging/Prod) |
| `release_approvals` | Approval records (ai approve, khi nào) |
| `release_history` | Immutable release log (partitioned by month) |
| `rollback_operations` | Rollback attempts với compensating steps |
| `drift_events` | Drift detection log |

---

## 10. Kafka Topics

| Topic | Producer | Consumer | Auth |
|-------|----------|----------|------|
| `release.pipeline.triggered` | ci-service | release-worker | SASL/SCRAM ACL |
| `release.pipeline.status` | release-worker | notification-service | SASL/SCRAM ACL |
| `release.drift.detected` | drift-detector | notification-service | SASL/SCRAM ACL |
| `release.rollback.initiated` | release-worker / human | release-worker | SASL/SCRAM ACL |
| `release.scan.completed` | scan-runner | release-worker | SASL/SCRAM ACL |

---

## 11. Services

| Service | Tech | Vai trò |
|---------|------|---------|
| `release-worker` | Python + FastAPI + Celery | Xử lý pipeline steps async |
| `scan-runner` | Python | Chạy Trivy/Bandit/pip-audit, report kết quả |
| `drift-detector` | Python + Celery beat | Định kỳ so sánh config giữa môi trường |
| `approval-service` | Python + FastAPI | API backend cho UI Dashboard approval |
| `notification-service` | Python | Consume Kafka → gửi Slack/email alerts |
| `release-api` | FastAPI | REST API: query history, export CSV/PDF |
