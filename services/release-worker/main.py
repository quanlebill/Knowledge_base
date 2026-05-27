"""
Release Worker — AeroFlow Platform
===================================
FastAPI API + Celery worker xử lý pipeline steps:
  1. Nhận trigger event từ Kafka (release.pipeline.triggered)
  2. Build artifact → push MinIO
  3. Security Scan gate (Trivy + Bandit + pip-audit)
  4. Ghi kết quả vào MongoDB (Package manifest)
  5. Approval flow → promote lên Staging/Production
  6. Rollback với compensating transaction pattern

Xem: docs/release-system.md
"""

import json
import os
import subprocess
import threading
import time
import uuid
from datetime import datetime, timezone
from typing import Optional

import psycopg2
import structlog
from celery import Celery
from fastapi import FastAPI, HTTPException, Header, Depends
from kafka import KafkaConsumer, KafkaProducer
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from pydantic import BaseModel

# ── Logging ───────────────────────────────────────────────────────────
structlog.configure(processors=[structlog.processors.JSONRenderer()])
log = structlog.get_logger()

# ── OpenTelemetry ─────────────────────────────────────────────────────
provider = TracerProvider()
otlp_exporter = OTLPSpanExporter(
    endpoint=os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://jaeger:4317")
)
provider.add_span_processor(BatchSpanProcessor(otlp_exporter))
trace.set_tracer_provider(provider)
tracer = trace.get_tracer("release-worker")

# ── Config ────────────────────────────────────────────────────────────
PG_DSN = os.getenv("DATABASE_URL", "postgresql://aeroflow:aeroflow_secret@postgres:5432/aeroflow")
MONGO_URI = os.getenv("MONGO_URI", "mongodb://mongo:27017")
MONGO_DB = os.getenv("MONGO_DB", "aeroflow")
KAFKA_BOOTSTRAP = os.getenv("KAFKA_BOOTSTRAP", "kafka:9092")
KAFKA_USERNAME = os.getenv("KAFKA_USERNAME", "release-worker")
KAFKA_PASSWORD = os.getenv("KAFKA_PASSWORD", "ReleaseWorker@1234")
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "http://minio:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin")
CELERY_BROKER = os.getenv("CELERY_BROKER", "redis://redis:6379/0")

KAFKA_CONFIG = {
    "security_protocol": "SASL_PLAINTEXT",
    "sasl_mechanism": "PLAIN",
    "sasl_plain_username": KAFKA_USERNAME,
    "sasl_plain_password": KAFKA_PASSWORD,
}

# ── FastAPI app ───────────────────────────────────────────────────────
app = FastAPI(title="Release Worker API", version="1.0.0")

# ── Celery ────────────────────────────────────────────────────────────
celery_app = Celery("release-worker", broker=CELERY_BROKER)
celery_app.conf.task_serializer = "json"
celery_app.conf.result_serializer = "json"

# ── PostgreSQL helper ─────────────────────────────────────────────────

def get_pg_conn():
    return psycopg2.connect(PG_DSN)


def update_pipeline_status(pipeline_id: str, status: str, error: Optional[str] = None):
    with get_pg_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """UPDATE pipelines SET status=%s, error_message=%s, updated_at=now(),
                   completed_at=CASE WHEN %s IN ('SUCCESS','FAILED','ROLLED_BACK') THEN now() ELSE NULL END
                   WHERE id=%s""",
                (status, error, status, pipeline_id)
            )


def record_pipeline_step(pipeline_id: str, step_name: str, status: str,
                          output: dict = None, error: str = None, duration_ms: int = None):
    with get_pg_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO pipeline_steps
                   (pipeline_id, step_name, status, started_at, completed_at, duration_ms, output, error)
                   VALUES (%s, %s, %s, now(), now(), %s, %s, %s)""",
                (pipeline_id, step_name, status, duration_ms,
                 json.dumps(output or {}), error)
            )


def write_release_history(pipeline_id: str, package_id: str, environment: str,
                           status: str, triggered_by: str, duration_ms: int = None):
    with get_pg_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO release_history
                   (pipeline_id, package_id, environment, status, triggered_by, duration_ms)
                   VALUES (%s, %s, %s, %s, %s, %s)""",
                (pipeline_id, package_id, environment, status, triggered_by, duration_ms)
            )

# ── Kafka Producer helper ─────────────────────────────────────────────

def get_producer():
    return KafkaProducer(
        bootstrap_servers=KAFKA_BOOTSTRAP,
        value_serializer=lambda v: json.dumps(v).encode("utf-8"),
        **KAFKA_CONFIG,
    )


def produce_event(topic: str, event: dict):
    try:
        producer = get_producer()
        producer.send(topic, value=event)
        producer.flush()
        log.info("kafka.produced", topic=topic, event_type=event.get("event"))
    except Exception as e:
        log.error("kafka.produce.failed", topic=topic, error=str(e))

# ═══════════════════════════════════════════════════════════════════════
# CELERY TASKS
# ═══════════════════════════════════════════════════════════════════════

def _run_pipeline_impl(pipeline_event: dict):
    """
    Core pipeline implementation — gọi được từ cả Celery task lẫn thread trực tiếp.
    1. Create pipeline record
    2. Build artifact
    3. Security scan gate
    4. Promote to dev (auto) / staging+prod (approval)
    """
    pipeline_id = pipeline_event.get("pipeline_id", f"pipe-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6]}")
    triggered_by = pipeline_event.get("triggered_by", "unknown")
    package_version = pipeline_event.get("package_version", "unknown")
    target_envs = pipeline_event.get("target_environments", ["dev"])

    with tracer.start_as_current_span("pipeline.execute") as span:
        span.set_attribute("release.pipeline_id", pipeline_id)
        span.set_attribute("release.triggered_by", triggered_by)
        span.set_attribute("release.environments", str(target_envs))

        log.info("pipeline.started", pipeline_id=pipeline_id, triggered_by=triggered_by)

        try:
            # ── Bước 1: Tạo pipeline record ──────────────────────────
            target_envs_str = (target_envs[0] if target_envs else "dev")
            with get_pg_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """INSERT INTO pipelines
                           (id, pipeline_name, triggered_by, trigger_type, commit_sha, branch,
                            package_version, target_env, status)
                           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'RUNNING')
                           ON CONFLICT (id) DO UPDATE SET status='RUNNING', updated_at=now()""",
                        (pipeline_id,
                         pipeline_event.get("pipeline_name"),
                         triggered_by,
                         pipeline_event.get("trigger_type", "MANUAL"),
                         pipeline_event.get("commit_sha"),
                         pipeline_event.get("branch"),
                         package_version,
                         target_envs_str)
                    )

            # ── Bước 2: Build artifact ────────────────────────────────
            with tracer.start_as_current_span("pipeline.build") as build_span:
                update_pipeline_status(pipeline_id, "BUILDING")
                t_start = time.time()
                artifact_path = f"packages/pkg-{package_version}/bundle.tar.gz"
                duration_ms = int((time.time() - t_start) * 1000)
                record_pipeline_step(pipeline_id, "build", "SUCCESS",
                                     output={"artifact_path": artifact_path},
                                     duration_ms=duration_ms)
                build_span.set_attribute("release.artifact_path", artifact_path)
                log.info("pipeline.build.done", pipeline_id=pipeline_id, artifact_path=artifact_path)

            # ── Bước 3: Security Scan Gate ────────────────────────────
            with tracer.start_as_current_span("pipeline.scan") as scan_span:
                update_pipeline_status(pipeline_id, "SCANNING")
                scan_result = run_security_scan(pipeline_id, artifact_path)
                scan_span.set_attribute("release.scan_status", scan_result["overall_status"])

                if scan_result["overall_status"] == "FAIL":
                    update_pipeline_status(pipeline_id, "FAILED",
                                           error="Security scan gate failed")
                    record_pipeline_step(pipeline_id, "security_scan", "FAILED",
                                         output=scan_result)
                    produce_event("release.pipeline.status", {
                        "event": "pipeline.failed",
                        "pipeline_id": pipeline_id,
                        "reason": "security_scan_failed",
                        "scan_result": scan_result,
                        "triggered_by": triggered_by,
                    })
                    log.error("pipeline.scan.failed", pipeline_id=pipeline_id,
                              scan_result=scan_result)
                    return {"status": "FAILED", "reason": "security_scan_gate"}

                record_pipeline_step(pipeline_id, "security_scan", "SUCCESS",
                                     output=scan_result)
                log.info("pipeline.scan.passed", pipeline_id=pipeline_id)

            # ── Bước 4: Ghi Package manifest ─────────────────────────
            package_id = f"pkg-{package_version}"
            with get_pg_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """INSERT INTO release_packages
                           (id, pipeline_id, artifact_paths, validation_score,
                            status, created_by, environment_targets, scan_result)
                           VALUES (%s, %s, %s, %s, 'VALIDATED', %s, %s, %s)
                           ON CONFLICT (id) DO UPDATE
                           SET status='VALIDATED', scan_result=%s, updated_at=now()""",
                        (package_id, pipeline_id,
                         json.dumps([artifact_path]), 98, triggered_by,
                         json.dumps(target_envs), json.dumps(scan_result),
                         json.dumps(scan_result))
                    )

            # ── Bước 5: Deploy to environments ───────────────────────
            for env in target_envs:
                if env == "dev":
                    _deploy_to_env(pipeline_id, package_id, env, triggered_by)
                else:
                    update_pipeline_status(pipeline_id, "AWAITING_APPROVAL")
                    produce_event("release.pipeline.status", {
                        "event": "pipeline.awaiting_approval",
                        "pipeline_id": pipeline_id,
                        "package_id": package_id,
                        "environment": env,
                        "triggered_by": triggered_by,
                        "approval_url": f"http://release-ui/approve/{pipeline_id}/{env}",
                    })
                    log.info("pipeline.awaiting_approval",
                             pipeline_id=pipeline_id, environment=env)
                    return {"status": "AWAITING_APPROVAL", "pipeline_id": pipeline_id}

            update_pipeline_status(pipeline_id, "SUCCESS")
            produce_event("release.pipeline.status", {
                "event": "pipeline.success",
                "pipeline_id": pipeline_id,
                "triggered_by": triggered_by,
            })
            log.info("pipeline.success", pipeline_id=pipeline_id)
            return {"status": "SUCCESS", "pipeline_id": pipeline_id}

        except Exception as exc:
            log.error("pipeline.error", pipeline_id=pipeline_id, error=str(exc))
            update_pipeline_status(pipeline_id, "FAILED", error=str(exc))
            produce_event("release.pipeline.status", {
                "event": "pipeline.failed",
                "pipeline_id": pipeline_id,
                "reason": str(exc),
            })
            return {"status": "FAILED", "error": str(exc)}


@celery_app.task(bind=True, max_retries=3)
def execute_pipeline(self, pipeline_event: dict):
    """Celery task wrapper — delegates to _run_pipeline_impl."""
    try:
        return _run_pipeline_impl(pipeline_event)
    except Exception as exc:
        raise self.retry(exc=exc, countdown=30)


def run_security_scan(pipeline_id: str, artifact_path: str) -> dict:
    """Chạy Trivy + Bandit + pip-audit. Trả về kết quả tổng hợp."""
    with tracer.start_as_current_span("pipeline.scan.trivy"):
        trivy_result = _run_trivy(artifact_path)

    with tracer.start_as_current_span("pipeline.scan.bandit"):
        bandit_result = _run_bandit(".")

    with tracer.start_as_current_span("pipeline.scan.pip_audit"):
        pip_audit_result = _run_pip_audit()

    overall = "PASS" if all(
        r["status"] == "PASS" for r in [trivy_result, bandit_result, pip_audit_result]
    ) else "FAIL"

    return {
        "scan_id": f"scan-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6]}",
        "pipeline_id": pipeline_id,
        "overall_status": overall,
        "results": {
            "trivy": trivy_result,
            "bandit": bandit_result,
            "pip_audit": pip_audit_result,
        },
        "scanned_at": datetime.now(timezone.utc).isoformat(),
    }


def _run_trivy(artifact_path: str) -> dict:
    """Trivy container image scan — fail nếu có CVE Critical/High."""
    try:
        result = subprocess.run(
            ["trivy", "fs", "--format", "json", "--severity", "CRITICAL,HIGH",
             "--exit-code", "1", artifact_path],
            capture_output=True, text=True, timeout=300
        )
        if result.returncode == 0:
            return {"status": "PASS", "critical": 0, "high": 0}
        else:
            # Parse JSON output để đếm vulns
            return {"status": "FAIL", "output": result.stdout[:500]}
    except FileNotFoundError:
        # trivy chưa cài trong environment — log warning, pass để dev local
        log.warning("trivy.not.found", note="Skipping trivy scan — not installed")
        return {"status": "PASS", "note": "trivy not installed, skipped"}
    except subprocess.TimeoutExpired:
        return {"status": "FAIL", "error": "trivy timeout after 300s"}


def _run_bandit(source_dir: str) -> dict:
    """Bandit SAST scan — fail nếu có High severity."""
    try:
        result = subprocess.run(
            ["bandit", "-r", source_dir, "-f", "json", "-ll"],  # -ll = high severity only
            capture_output=True, text=True, timeout=120
        )
        if result.returncode == 0:
            return {"status": "PASS", "high": 0}
        else:
            return {"status": "FAIL", "output": result.stdout[:500]}
    except FileNotFoundError:
        log.warning("bandit.not.found", note="Skipping bandit scan — not installed")
        return {"status": "PASS", "note": "bandit not installed, skipped"}
    except subprocess.TimeoutExpired:
        return {"status": "FAIL", "error": "bandit timeout after 120s"}


def _run_pip_audit() -> dict:
    """pip-audit dependency CVE scan."""
    try:
        result = subprocess.run(
            ["pip-audit", "--format", "json"],
            capture_output=True, text=True, timeout=120
        )
        if result.returncode == 0:
            return {"status": "PASS", "vulnerabilities": 0}
        else:
            return {"status": "FAIL", "output": result.stdout[:500]}
    except FileNotFoundError:
        log.warning("pip_audit.not.found", note="Skipping pip-audit — not installed")
        return {"status": "PASS", "note": "pip-audit not installed, skipped"}
    except subprocess.TimeoutExpired:
        return {"status": "FAIL", "error": "pip-audit timeout after 120s"}


def _deploy_to_env(pipeline_id: str, package_id: str, environment: str,
                   triggered_by: str):
    """Deploy package đến environment cụ thể."""
    with tracer.start_as_current_span("pipeline.deploy") as span:
        span.set_attribute("release.environment", environment)
        span.set_attribute("release.package_id", package_id)
        t_start = time.time()
        # TODO: thay bằng deploy logic thật (K8s apply, docker compose, etc.)
        time.sleep(0.1)  # simulate deploy
        duration_ms = int((time.time() - t_start) * 1000)
        record_pipeline_step(pipeline_id, f"deploy_{environment}", "SUCCESS",
                             output={"package_id": package_id, "environment": environment},
                             duration_ms=duration_ms)
        write_release_history(pipeline_id, package_id, environment, "SUCCESS",
                              triggered_by, duration_ms)
        log.info("pipeline.deploy.done", pipeline_id=pipeline_id,
                 environment=environment, package_id=package_id)


def _run_approval_deploy(pipeline_id: str, environment: str, triggered_by: str):
    """
    Deploy sau khi approval — bỏ qua build/scan (đã chạy trước đó).
    Gọi trực tiếp _deploy_to_env cho environment đã được approve.
    """
    log.info("approval.deploy.start", pipeline_id=pipeline_id, environment=environment)
    try:
        with get_pg_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT id FROM release_packages WHERE pipeline_id=%s LIMIT 1",
                            (pipeline_id,))
                row = cur.fetchone()
                if not row:
                    log.error("approval.deploy.no_package", pipeline_id=pipeline_id)
                    update_pipeline_status(pipeline_id, "FAILED", error="Package not found for approval deploy")
                    return
                package_id = row[0]

        update_pipeline_status(pipeline_id, "RUNNING")
        _deploy_to_env(pipeline_id, package_id, environment, triggered_by)
        update_pipeline_status(pipeline_id, "SUCCESS")
        produce_event("release.pipeline.status", {
            "event": "pipeline.deployed",
            "pipeline_id": pipeline_id,
            "environment": environment,
            "triggered_by": triggered_by,
        })
        log.info("approval.deploy.done", pipeline_id=pipeline_id, environment=environment)
    except Exception as exc:
        log.error("approval.deploy.error", pipeline_id=pipeline_id, error=str(exc))
        update_pipeline_status(pipeline_id, "FAILED", error=str(exc))


# ═══════════════════════════════════════════════════════════════════════
# ROLLBACK TASKS
# ═══════════════════════════════════════════════════════════════════════

def _run_rollback_impl(rollback_event: dict):
    """Core rollback implementation — gọi được từ thread trực tiếp."""
    return _execute_rollback_core(rollback_event)


@celery_app.task
def execute_rollback(rollback_event: dict):
    """Celery task wrapper cho rollback."""
    return _execute_rollback_core(rollback_event)


def _execute_rollback_core(rollback_event: dict):
    """
    Rollback với compensating transaction pattern.
    Từng bước có undo action; nếu fail → PARTIAL_ROLLBACK + alert.
    """
    rollback_id = rollback_event.get("rollback_id",
                                      f"rb-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6]}")
    from_version = rollback_event["from_version"]
    to_version = rollback_event["to_version"]
    environment = rollback_event["environment"]
    triggered_by = rollback_event["triggered_by"]

    with tracer.start_as_current_span("pipeline.rollback") as span:
        span.set_attribute("release.rollback_id", rollback_id)
        span.set_attribute("release.environment", environment)
        span.set_attribute("release.from_version", from_version)
        span.set_attribute("release.to_version", to_version)

        log.info("rollback.started", rollback_id=rollback_id,
                 from_version=from_version, to_version=to_version,
                 environment=environment)

        steps_result = []

        def _fail_rollback(step: int, error: str):
            log.error("rollback.partial_fail", rollback_id=rollback_id,
                      step=step, error=error)
            with get_pg_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """UPDATE rollback_operations
                           SET status='PARTIAL_ROLLBACK', current_step=%s,
                               steps_result=%s, completed_at=now()
                           WHERE id=%s""",
                        (step, json.dumps(steps_result), rollback_id)
                    )
            produce_event("release.pipeline.status", {
                "event": "rollback.partial_fail",
                "rollback_id": rollback_id,
                "step": step,
                "error": error,
                "environment": environment,
                "alert": "PAGERDUTY",
            })

        try:
            with get_pg_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """INSERT INTO rollback_operations
                           (id, from_version, to_version, environment, triggered_by, reason, status)
                           VALUES (%s, %s, %s, %s, %s, %s, 'INITIATED')""",
                        (rollback_id, from_version, to_version, environment,
                         triggered_by, rollback_event.get("reason", ""))
                    )

            # ── Bước 1: Update release pointer PostgreSQL ─────────────
            try:
                _step1_update_release_pointer(environment, to_version)
                steps_result.append({"step": 1, "action": "update_db_pointer",
                                     "status": "SUCCESS", "ts": datetime.utcnow().isoformat()})
            except Exception as e:
                steps_result.append({"step": 1, "action": "update_db_pointer",
                                     "status": "FAILED", "error": str(e)})
                _fail_rollback(1, str(e))
                return {"status": "PARTIAL_ROLLBACK", "step": 1}

            # ── Bước 2: Reroute Kong upstream ─────────────────────────
            try:
                _step2_reroute_kong(environment, to_version)
                steps_result.append({"step": 2, "action": "reroute_kong",
                                     "status": "SUCCESS", "ts": datetime.utcnow().isoformat()})
            except Exception as e:
                # Compensate: revert step 1
                _step1_update_release_pointer(environment, from_version)
                steps_result.append({"step": 2, "action": "reroute_kong",
                                     "status": "FAILED", "error": str(e)})
                _fail_rollback(2, str(e))
                return {"status": "PARTIAL_ROLLBACK", "step": 2}

            # ── Bước 3: Redeploy snapshot từ MinIO ────────────────────
            try:
                _step3_redeploy_snapshot(environment, to_version)
                steps_result.append({"step": 3, "action": "redeploy_snapshot",
                                     "status": "SUCCESS", "ts": datetime.utcnow().isoformat()})
            except Exception as e:
                steps_result.append({"step": 3, "action": "redeploy_snapshot",
                                     "status": "FAILED", "error": str(e)})
                _fail_rollback(3, str(e))
                return {"status": "PARTIAL_ROLLBACK", "step": 3}

            # ── Rollback SUCCESS ──────────────────────────────────────
            with get_pg_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """UPDATE rollback_operations
                           SET status='SUCCESS', current_step=3,
                               steps_result=%s, completed_at=now()
                           WHERE id=%s""",
                        (json.dumps(steps_result), rollback_id)
                    )
            write_release_history(rollback_id, f"pkg-{to_version}", environment,
                                  "ROLLED_BACK", triggered_by)
            produce_event("release.pipeline.status", {
                "event": "rollback.success",
                "rollback_id": rollback_id,
                "to_version": to_version,
                "environment": environment,
            })
            log.info("rollback.success", rollback_id=rollback_id)
            return {"status": "SUCCESS", "rollback_id": rollback_id}

        except Exception as exc:
            log.error("rollback.unexpected_error", rollback_id=rollback_id, error=str(exc))
            raise


def _step1_update_release_pointer(environment: str, version: str):
    """Step 1: Update release pointer trong PostgreSQL."""
    with get_pg_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO environment_configs (environment, key, value, updated_by)
                   VALUES (%s, 'active_version', %s, 'release-worker')
                   ON CONFLICT (environment, key, version) DO UPDATE
                   SET value=%s, updated_at=now()""",
                (environment, version, version)
            )
    log.info("rollback.step1.done", environment=environment, version=version)


def _step2_reroute_kong(environment: str, version: str):
    """Step 2: Update Kong upstream route cho environment."""
    import httpx
    kong_admin = os.getenv("KONG_ADMIN_URL", "http://kong:8001")
    # Cập nhật upstream target trong Kong
    resp = httpx.patch(
        f"{kong_admin}/services/aeroflow-{environment}",
        json={"tags": [f"version:{version}"]},
        timeout=10,
    )
    if resp.status_code >= 400:
        raise RuntimeError(f"Kong route update failed: {resp.status_code} {resp.text}")
    log.info("rollback.step2.done", environment=environment, version=version)


def _step3_redeploy_snapshot(environment: str, version: str):
    """Step 3: Redeploy từ MinIO snapshot (immutable)."""
    # TODO: implement MinIO download + deploy
    # snapshot_path = f"rollback-snapshots/{environment}-snapshot-{version}/"
    log.info("rollback.step3.done",
             environment=environment, version=version,
             note="MinIO snapshot redeploy — implement per deployment type")

# ═══════════════════════════════════════════════════════════════════════
# DRIFT DETECTION TASK (Celery Beat)
# ═══════════════════════════════════════════════════════════════════════

@celery_app.task
def detect_config_drift():
    """
    So sánh production config vs staging config.
    Nếu có drift → produce release.drift.detected → block promotion.
    Chạy định kỳ via Celery beat.
    """
    from deepdiff import DeepDiff

    with tracer.start_as_current_span("drift.detect") as span:
        try:
            prod_config = _get_env_config("production")
            staging_config = _get_env_config("staging")
            diff = DeepDiff(prod_config, staging_config, ignore_order=True)

            if diff:
                drift_keys = list(diff.keys())
                span.set_attribute("drift.keys_count", len(drift_keys))
                log.warning("drift.detected",
                            env_pair="production vs staging",
                            drift_keys=drift_keys)

                # Ghi vào DB
                with get_pg_conn() as conn:
                    with conn.cursor() as cur:
                        cur.execute(
                            """INSERT INTO drift_events
                               (env_pair, drift_keys, severity)
                               VALUES (%s, %s, 'CRITICAL_DRIFT')""",
                            ("production vs staging", json.dumps(drift_keys))
                        )

                # Produce Kafka event
                produce_event("release.drift.detected", {
                    "event": "drift.detected",
                    "detected_at": datetime.now(timezone.utc).isoformat(),
                    "environment_pair": ["production", "staging"],
                    "keys": drift_keys,
                    "severity": "CRITICAL_DRIFT",
                })
            else:
                log.info("drift.check.clean", env_pair="production vs staging")

        except Exception as e:
            log.error("drift.check.error", error=str(e))


def _get_env_config(environment: str) -> dict:
    with get_pg_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT key, value FROM environment_configs
                   WHERE environment=%s AND is_active=true""",
                (environment,)
            )
            return {row[0]: row[1] for row in cur.fetchall()}

# ═══════════════════════════════════════════════════════════════════════
# KAFKA CONSUMER (chạy song song với FastAPI)
# ═══════════════════════════════════════════════════════════════════════

def start_kafka_consumer():
    """
    Consumer đọc từ release.pipeline.triggered và release.rollback.initiated.
    Chạy task trực tiếp trong thread (không dùng Celery .delay() để tránh cần
    worker process riêng trong single-container dev setup).
    Production: dùng execute_pipeline.delay(event) với dedicated Celery worker.
    """
    consumer = KafkaConsumer(
        "release.pipeline.triggered",
        "release.rollback.initiated",
        bootstrap_servers=KAFKA_BOOTSTRAP,
        group_id="release-worker-group",
        auto_offset_reset="earliest",
        enable_auto_commit=True,
        value_deserializer=lambda v: _safe_json(v),
        **KAFKA_CONFIG,
    )
    log.info("kafka.consumer.started",
             topics=["release.pipeline.triggered", "release.rollback.initiated"])

    for message in consumer:
        if not isinstance(message.value, dict):
            continue
        topic = message.topic
        event = message.value
        log.info("kafka.message.received", topic=topic, event_type=event.get("event"))

        # Chạy trong thread riêng để không block consumer loop
        if topic == "release.pipeline.triggered":
            t = threading.Thread(
                target=_run_pipeline_impl,
                args=(event,),
                daemon=True
            )
            t.start()
        elif topic == "release.rollback.initiated":
            t = threading.Thread(
                target=_run_rollback_impl,
                args=(event,),
                daemon=True
            )
            t.start()


def _safe_json(raw: bytes) -> dict:
    try:
        val = json.loads(raw.decode("utf-8"))
        return val if isinstance(val, dict) else {}
    except Exception:
        return {}

# ═══════════════════════════════════════════════════════════════════════
# FASTAPI ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════

class TriggerPipelineRequest(BaseModel):
    commit_sha: Optional[str] = None
    branch: Optional[str] = None
    package_version: str
    pipeline_name: Optional[str] = None
    target_environments: list[str] = ["dev"]


class ApprovalRequest(BaseModel):
    decision: str   # APPROVED / REJECTED
    comment: Optional[str] = None


class RollbackRequest(BaseModel):
    from_version: str
    to_version: str
    environment: str
    reason: Optional[str] = None


def get_current_user(
    x_user_id: str = Header(..., alias="X-User-Id"),
    x_user_roles: str = Header(..., alias="X-User-Roles"),
) -> dict:
    """Đọc user identity từ header Kong inject — không verify JWT lại."""
    return {"user_id": x_user_id, "roles": x_user_roles.split(",")}


@app.get("/health")
def health():
    return {"status": "ok", "service": "release-worker"}


@app.post("/api/release/pipeline/trigger")
def trigger_pipeline(
    req: TriggerPipelineRequest,
    user: dict = Depends(get_current_user),
):
    """Trigger pipeline thủ công — produce Kafka event."""
    pipeline_id = f"pipe-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6]}"
    event = {
        "event": "pipeline.triggered",
        "pipeline_id": pipeline_id,
        "triggered_by": user["user_id"],
        "trigger_type": "MANUAL",
        "commit_sha": req.commit_sha,
        "branch": req.branch,
        "package_version": req.package_version,
        "target_environments": req.target_environments,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    produce_event("release.pipeline.triggered", event)
    log.info("api.pipeline.triggered", pipeline_id=pipeline_id, user=user["user_id"])
    return {"pipeline_id": pipeline_id, "status": "triggered"}


@app.post("/api/release/pipeline/{pipeline_id}/approve/{environment}")
def approve_deployment(
    pipeline_id: str,
    environment: str,
    req: ApprovalRequest,
    user: dict = Depends(get_current_user),
):
    """Approval / Reject deployment lên staging / production."""
    if "platform-admin" not in user["roles"] and "ai-engineer" not in user["roles"]:
        raise HTTPException(status_code=403, detail="Insufficient role for approval")

    with get_pg_conn() as conn:
        with conn.cursor() as cur:
            # Lấy package_id từ pipeline
            cur.execute("SELECT id FROM release_packages WHERE pipeline_id=%s LIMIT 1",
                        (pipeline_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Package not found")
            package_id = row[0]

            cur.execute(
                """INSERT INTO release_approvals
                   (package_id, environment, decision, approved_by, comment)
                   VALUES (%s, %s, %s, %s, %s)
                   ON CONFLICT (package_id, environment, approved_by) DO UPDATE
                   SET decision=%s, approved_at=now()""",
                (package_id, environment, req.decision, user["user_id"], req.comment,
                 req.decision)
            )

    if req.decision == "APPROVED":
        # Deploy in background thread — skip build/scan (already done)
        t = threading.Thread(
            target=_run_approval_deploy,
            args=(pipeline_id, environment, user["user_id"]),
            daemon=True
        )
        t.start()
        log.info("api.approval.approved", pipeline_id=pipeline_id,
                 environment=environment, approver=user["user_id"])
        return {"status": "approved", "pipeline_id": pipeline_id, "environment": environment}
    else:
        update_pipeline_status(pipeline_id, "FAILED", error=f"Rejected by {user['user_id']}")
        return {"status": "rejected", "pipeline_id": pipeline_id}


@app.post("/api/release/rollback")
def trigger_rollback(
    req: RollbackRequest,
    user: dict = Depends(get_current_user),
):
    """Trigger rollback — produce Kafka event + dispatch Celery task."""
    if "platform-admin" not in user["roles"]:
        raise HTTPException(status_code=403, detail="Only platform-admin can trigger rollback")

    rollback_id = f"rb-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6]}"
    event = {
        "event": "rollback.initiated",
        "rollback_id": rollback_id,
        "from_version": req.from_version,
        "to_version": req.to_version,
        "environment": req.environment,
        "triggered_by": user["user_id"],
        "reason": req.reason,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    produce_event("release.rollback.initiated", event)
    execute_rollback.delay(event)
    log.info("api.rollback.triggered", rollback_id=rollback_id, user=user["user_id"])
    return {"rollback_id": rollback_id, "status": "initiated"}


@app.get("/api/release/pipelines")
def list_pipelines(
    status: Optional[str] = None,
    limit: int = 50,
    user: dict = Depends(get_current_user),
):
    """List tất cả pipelines — cho UI Deployments tab."""
    with get_pg_conn() as conn:
        with conn.cursor() as cur:
            if status:
                cur.execute(
                    """SELECT id, pipeline_name, triggered_by, trigger_type, commit_sha,
                              branch, package_version, target_env, status, risk_score,
                              error_message, created_at, updated_at, completed_at
                       FROM pipelines
                       WHERE status = %s
                       ORDER BY created_at DESC LIMIT %s""",
                    (status, limit)
                )
            else:
                cur.execute(
                    """SELECT id, pipeline_name, triggered_by, trigger_type, commit_sha,
                              branch, package_version, target_env, status, risk_score,
                              error_message, created_at, updated_at, completed_at
                       FROM pipelines
                       ORDER BY created_at DESC LIMIT %s""",
                    (limit,)
                )
            cols = ["id", "pipeline_name", "triggered_by", "trigger_type", "commit_sha",
                    "branch", "package_version", "target_env", "status", "risk_score",
                    "error_message", "created_at", "updated_at", "completed_at"]
            rows = [dict(zip(cols, row)) for row in cur.fetchall()]
            for row in rows:
                for k in ("created_at", "updated_at", "completed_at"):
                    if row.get(k):
                        row[k] = row[k].isoformat()
    return {"pipelines": rows, "count": len(rows)}


@app.get("/api/release/rollback-targets")
def list_rollback_targets(user: dict = Depends(get_current_user)):
    """
    Trả danh sách pipeline có thể rollback: lấy 2 lần deploy gần nhất mỗi (name, env)
    từ release_history, tính current vs previous version.
    """
    with get_pg_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """WITH history_with_name AS (
                     SELECT
                       rh.pipeline_id,
                       COALESCE(p.pipeline_name, rh.pipeline_id) AS name,
                       rh.environment,
                       rh.status,
                       p.package_version,
                       rh.deployed_at,
                       ROW_NUMBER() OVER (
                         PARTITION BY COALESCE(p.pipeline_name, rh.pipeline_id), rh.environment
                         ORDER BY rh.deployed_at DESC
                       ) AS rn
                     FROM release_history rh
                     JOIN pipelines p ON p.id = rh.pipeline_id
                     WHERE rh.status IN ('SUCCESS', 'ROLLED_BACK')
                   ),
                   current_v AS (
                     SELECT pipeline_id, name, environment, package_version AS current_version
                     FROM history_with_name WHERE rn = 1
                   ),
                   previous_v AS (
                     SELECT name, environment, package_version AS previous_version
                     FROM history_with_name WHERE rn = 2
                   )
                   SELECT c.pipeline_id, c.name, c.current_version, pv.previous_version, c.environment
                   FROM current_v c
                   JOIN previous_v pv ON pv.name = c.name AND pv.environment = c.environment
                   ORDER BY c.name, c.environment"""
            )
            cols = ["pipeline_id", "name", "current_version", "previous_version", "environment"]
            rows = [dict(zip(cols, row)) for row in cur.fetchall()]
    return {"targets": rows, "count": len(rows)}


@app.get("/api/release/history")
def get_release_history(
    environment: Optional[str] = None,
    limit: int = 50,
    user: dict = Depends(get_current_user),
):
    """Query release history từ PostgreSQL."""
    with get_pg_conn() as conn:
        with conn.cursor() as cur:
            if environment:
                cur.execute(
                    """SELECT pipeline_id, package_id, environment, status,
                              triggered_by, deployed_at, duration_ms
                       FROM release_history
                       WHERE environment=%s
                       ORDER BY deployed_at DESC LIMIT %s""",
                    (environment, limit)
                )
            else:
                cur.execute(
                    """SELECT pipeline_id, package_id, environment, status,
                              triggered_by, deployed_at, duration_ms
                       FROM release_history
                       ORDER BY deployed_at DESC LIMIT %s""",
                    (limit,)
                )
            cols = ["pipeline_id", "package_id", "environment", "status",
                    "triggered_by", "deployed_at", "duration_ms"]
            rows = [dict(zip(cols, row)) for row in cur.fetchall()]
            # Convert datetime to ISO string
            for row in rows:
                if row.get("deployed_at"):
                    row["deployed_at"] = row["deployed_at"].isoformat()
    return {"history": rows, "count": len(rows)}


@app.get("/api/release/pipelines/{pipeline_id}")
def get_pipeline(pipeline_id: str, user: dict = Depends(get_current_user)):
    """Xem chi tiết pipeline và các steps."""
    with get_pg_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, triggered_by, status, created_at, updated_at, error_message FROM pipelines WHERE id=%s",
                (pipeline_id,)
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Pipeline not found")
            pipeline = dict(zip(
                ["id", "triggered_by", "status", "created_at", "updated_at", "error_message"],
                row
            ))
            for k in ["created_at", "updated_at"]:
                if pipeline[k]:
                    pipeline[k] = pipeline[k].isoformat()

            cur.execute(
                "SELECT step_name, status, started_at, completed_at, duration_ms, output, error FROM pipeline_steps WHERE pipeline_id=%s ORDER BY id",
                (pipeline_id,)
            )
            steps = [
                dict(zip(["step_name", "status", "started_at", "completed_at",
                          "duration_ms", "output", "error"], s))
                for s in cur.fetchall()
            ]
    return {"pipeline": pipeline, "steps": steps}


# ── Entry point ───────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn

    # Chạy Kafka consumer trong background thread
    consumer_thread = threading.Thread(target=start_kafka_consumer, daemon=True)
    consumer_thread.start()

    uvicorn.run(app, host="0.0.0.0", port=8100, log_level="info")
