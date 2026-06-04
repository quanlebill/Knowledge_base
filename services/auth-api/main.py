"""
Auth API — AeroFlow Platform
=============================
Manages IP allowlists, API keys, and Secrets Vault (backed by OpenBao KV v2 + Transit).
Kong injects X-User-Id, X-User-Roles, X-Tenant-Id from validated JWT.

Secret storage model:
  SIGNING_KEY, ENCRYPTION_KEY, HMAC_KEY  → OpenBao Transit engine (key never leaves vault)
  BEARER_TOKEN, MCP_TOKEN, KB_API_KEY    → OpenBao KV v2 (raw value stored)
"""
import asyncio
import ipaddress
import os
import secrets
import string
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import httpx
import hvac
import psycopg2
import psycopg2.extras
import structlog
from fastapi import Depends, FastAPI, Header, HTTPException, Path, Query
from shared.auth import get_current_user, require_role
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

structlog.configure(processors=[structlog.processors.JSONRenderer()])
log = structlog.get_logger()

PG_DSN       = os.environ.get("DATABASE_URL",   "postgresql://aeroflow:aeroflow_secret@postgres:5432/aeroflow")
KONG_ADMIN   = os.environ.get("KONG_ADMIN_URL", "http://kong:8001")
OPENBAO_ADDR = os.environ.get("OPENBAO_ADDR",  "http://openbao:8200")

_TOKEN_FILE = "/openbao/data/.root-token"

def _load_openbao_token() -> str:
    if os.path.exists(_TOKEN_FILE):
        try:
            token = open(_TOKEN_FILE).read().strip()
            if token:
                return token
        except OSError:
            pass
    return os.environ.get("OPENBAO_TOKEN", "aeroflow-dev-token")

OPENBAO_TOKEN = _load_openbao_token()


def get_vault() -> hvac.Client:
    # Re-read token file each call so rotated tokens are picked up without restart
    token = _load_openbao_token()
    return hvac.Client(url=OPENBAO_ADDR, token=token)

# Private-network fallback when allowlist is empty — prevents lockout
_PRIVATE_FALLBACK = ["127.0.0.1/32", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"]

app = FastAPI(title="auth-api", docs_url="/api/auth/docs")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


# ── DB helpers ────────────────────────────────────────────────────────────────

def get_db():
    conn = psycopg2.connect(PG_DSN)
    conn.autocommit = False
    return conn


def _ensure_settings_table():
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS platform_settings (
                    key        varchar(100) PRIMARY KEY,
                    value      text NOT NULL,
                    updated_at timestamptz DEFAULT now()
                )
            """)
            # Add REVEAL to triggered_by constraint (idempotent)
            cur.execute("ALTER TABLE key_rotations DROP CONSTRAINT IF EXISTS key_rotations_triggered_by_check")
            cur.execute("""
                ALTER TABLE key_rotations ADD CONSTRAINT key_rotations_triggered_by_check
                  CHECK (triggered_by IN ('SCHEDULED','MANUAL','PANIC','REVEAL'))
            """)
            # Seed default: allow_all so fresh deployments are not locked out
            cur.execute("""
                INSERT INTO platform_settings (key, value, updated_at)
                VALUES ('ip_allowlist_mode', 'allow_all', now())
                ON CONFLICT (key) DO NOTHING
            """)
            # Add access_reason column to key_rotations (idempotent)
            cur.execute("ALTER TABLE key_rotations ADD COLUMN IF NOT EXISTS access_reason text")
        conn.commit()
    except Exception as e:
        log.warning("schema_migration_failed", error=str(e))
    finally:
        conn.close()


# ── Panic mode guard ──────────────────────────────────────────────────────────

def _vault_panic_check():
    conn = get_db()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            if _get_gov_setting(cur, "vault_panic_mode"):
                raise HTTPException(
                    status_code=503,
                    detail="Vault is in PANIC MODE — all secret access suspended. Disable via governance settings.",
                )
    finally:
        conn.close()


# ── Auto-rotation background task ─────────────────────────────────────────────

def _run_auto_rotation():
    conn = get_db()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            if not _get_gov_setting(cur, "vault_auto_rotation"):
                return
            cur.execute(
                "SELECT id, tenant_id, key_name, key_type, version "
                "FROM secrets_vault WHERE is_active = true AND rotation_due_at < now()"
            )
            overdue = cur.fetchall()
    finally:
        conn.close()

    if not overdue:
        return

    vault = get_vault()
    for row in overdue:
        conn2 = get_db()
        try:
            with conn2.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                if row["key_type"] in _TRANSIT_TYPES:
                    t_key = _transit_key_name(row["tenant_id"], row["key_name"])
                    try:
                        vault.secrets.transit.rotate_key(name=t_key, mount_point=_TRANSIT_MOUNT)
                        status, error = "SUCCESS", None
                    except Exception as e:
                        status, error = "FAILED", str(e)
                    new_version = row["version"] + 1
                    rotation_due = datetime.now(timezone.utc) + timedelta(days=90)
                    cur.execute(
                        "UPDATE secrets_vault SET version=%s, rotation_due_at=%s, last_rotated_at=now() WHERE id=%s",
                        (new_version, rotation_due, row["id"]),
                    )
                    cur.execute(
                        "INSERT INTO key_rotations (secret_id, triggered_by, actor_id, old_version, new_version, status, error) "
                        "VALUES (%s,'SCHEDULED','system',%s,%s,%s,%s)",
                        (row["id"], row["version"], new_version, status, error),
                    )
                    log.info("auto_rotation", key=row["key_name"], status=status)
                else:
                    # KV secrets cannot be auto-rotated without a new value — log a warning entry
                    cur.execute(
                        "INSERT INTO key_rotations (secret_id, triggered_by, actor_id, old_version, new_version, status, error) "
                        "VALUES (%s,'SCHEDULED','system',%s,%s,'FAILED',%s)",
                        (row["id"], row["version"], row["version"],
                         "Manual rotation required — KV secrets need a new value"),
                    )
                    log.warning("auto_rotation_skipped_kv", key=row["key_name"])
            conn2.commit()
        except Exception as e:
            conn2.rollback()
            log.error("auto_rotation_error", key=row["key_name"], error=str(e))
        finally:
            conn2.close()


async def _auto_rotation_loop():
    await asyncio.sleep(60)  # wait for startup to settle
    while True:
        try:
            _run_auto_rotation()
        except Exception as e:
            log.error("auto_rotation_loop_error", error=str(e))
        await asyncio.sleep(86400)  # run every 24 hours


async def _sync_kong_on_startup():
    # Wait for Kong to finish setup before syncing
    await asyncio.sleep(15)
    try:
        _sync_kong("")
        log.info("startup_kong_sync_done")
    except Exception as e:
        log.warning("startup_kong_sync_failed", error=str(e))


@app.on_event("startup")
async def startup():
    _ensure_settings_table()
    asyncio.create_task(_auto_rotation_loop())
    asyncio.create_task(_sync_kong_on_startup())



# ── Kong sync ─────────────────────────────────────────────────────────────────

def _get_ip_mode() -> str:
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT value FROM platform_settings WHERE key = 'ip_allowlist_mode'")
            row = cur.fetchone()
            return row[0] if row else "allow_all"
    finally:
        conn.close()


def _get_active_cidrs(tenant_id: str) -> list[str]:
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT cidr FROM ip_allowlists WHERE tenant_id = %s AND is_active = true",
                (tenant_id,),
            )
            return [r[0] for r in cur.fetchall()]
    finally:
        conn.close()


# Services and routes that enforce IP restriction.
# auth-api service itself is NOT listed — only the api-keys route is, so
# ip-allowlist management routes remain accessible from any IP.
_IP_PROTECTED_SERVICES = ["aeroflow-backend", "release-worker"]
_IP_PROTECTED_ROUTES   = ["auth-api-keys-route", "auth-api-secrets-route"]


def _upsert_ip_plugin(scope_url: str, payload: dict):
    res = httpx.get(scope_url, timeout=5)
    existing = [p for p in res.json().get("data", []) if p.get("name") == "ip-restriction"]
    if existing:
        httpx.patch(f"{KONG_ADMIN}/plugins/{existing[0]['id']}", json=payload, timeout=5)
    else:
        httpx.post(scope_url, json=payload, timeout=5)


def _sync_kong(tenant_id: str):
    mode = _get_ip_mode()
    if mode == "allow_all":
        allow = ["0.0.0.0/0", "::/0"]
    else:
        user_cidrs = _get_active_cidrs(tenant_id)
        allow = user_cidrs if user_cidrs else _PRIVATE_FALLBACK

    payload = {"name": "ip-restriction", "config": {"allow": allow}}
    try:
        for svc in _IP_PROTECTED_SERVICES:
            _upsert_ip_plugin(f"{KONG_ADMIN}/services/{svc}/plugins", payload)
        for route in _IP_PROTECTED_ROUTES:
            _upsert_ip_plugin(f"{KONG_ADMIN}/routes/{route}/plugins", payload)
        log.info("kong_sync", mode=mode, cidr_count=len(allow))
    except Exception as e:
        log.warning("kong_sync_failed", error=str(e))


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/api/auth/health")
def health():
    return {"status": "ok"}


# ═══════════════════════════════════════════════════════════════════════════════
# IP ALLOWLIST CONFIG (allow_all toggle)
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/auth/ip-allowlist/config")
def get_ip_config(
    user: dict = Depends(require_role("platform-admin")),
):
    return {"mode": _get_ip_mode()}


@app.put("/api/auth/ip-allowlist/config")
def set_ip_config(
    body: dict,
    x_tenant_id: str = Header(..., alias="X-Tenant-Id"),
    user: dict = Depends(require_role("platform-admin")),
):
    mode = body.get("mode", "allowlist")
    if mode not in ("allowlist", "allow_all"):
        raise HTTPException(status_code=422, detail="mode must be 'allowlist' or 'allow_all'")

    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO platform_settings (key, value, updated_at)
                VALUES ('ip_allowlist_mode', %s, now())
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
            """, (mode,))
        conn.commit()
    finally:
        conn.close()

    _sync_kong(x_tenant_id)
    return {"mode": mode}


# ═══════════════════════════════════════════════════════════════════════════════
# IP ALLOWLIST CRUD
# ═══════════════════════════════════════════════════════════════════════════════

class IPRuleIn(BaseModel):
    cidr: str
    label: str = ""
    is_active: bool = True


@app.get("/api/auth/ip-allowlists")
def list_ip_allowlists(
    x_tenant_id: str = Header(..., alias="X-Tenant-Id"),
    user: dict = Depends(require_role("platform-admin")),
):
    conn = get_db()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT id, cidr, label, is_active, created_by, created_at FROM ip_allowlists WHERE tenant_id = %s ORDER BY created_at DESC",
                (x_tenant_id,),
            )
            rows = cur.fetchall()
        return [_fmt_ip(r) for r in rows]
    finally:
        conn.close()


@app.post("/api/auth/ip-allowlists", status_code=201)
def create_ip_rule(
    body: IPRuleIn,
    x_tenant_id: str = Header(..., alias="X-Tenant-Id"),
    user: dict = Depends(require_role("platform-admin")),
):
    try:
        ipaddress.ip_network(body.cidr, strict=False)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Invalid CIDR: {body.cidr}")

    conn = get_db()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "INSERT INTO ip_allowlists (tenant_id, cidr, label, is_active, created_by) VALUES (%s,%s,%s,%s,%s) RETURNING id, cidr, label, is_active, created_by, created_at",
                (x_tenant_id, body.cidr, body.label, body.is_active, user["user_id"]),
            )
            row = cur.fetchone()
        conn.commit()
    except psycopg2.errors.UniqueViolation:
        conn.rollback()
        raise HTTPException(status_code=409, detail="CIDR already exists for this tenant")
    finally:
        conn.close()

    _sync_kong(x_tenant_id)
    return _fmt_ip(row)


@app.patch("/api/auth/ip-allowlists/{rule_id}/toggle")
def toggle_ip_rule(
    rule_id: str = Path(...),
    x_tenant_id: str = Header(..., alias="X-Tenant-Id"),
    user: dict = Depends(require_role("platform-admin")),
):
    conn = get_db()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "UPDATE ip_allowlists SET is_active = NOT is_active WHERE id = %s AND tenant_id = %s RETURNING id, cidr, label, is_active, created_by, created_at",
                (rule_id, x_tenant_id),
            )
            row = cur.fetchone()
        if not row:
            conn.rollback()
            raise HTTPException(status_code=404, detail="Rule not found")
        conn.commit()
    finally:
        conn.close()

    _sync_kong(x_tenant_id)
    return _fmt_ip(row)


@app.delete("/api/auth/ip-allowlists/{rule_id}", status_code=204)
def delete_ip_rule(
    rule_id: str = Path(...),
    x_tenant_id: str = Header(..., alias="X-Tenant-Id"),
    user: dict = Depends(require_role("platform-admin")),
):
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM ip_allowlists WHERE id = %s AND tenant_id = %s", (rule_id, x_tenant_id))
            if cur.rowcount == 0:
                conn.rollback()
                raise HTTPException(status_code=404, detail="Rule not found")
        conn.commit()
    finally:
        conn.close()

    _sync_kong(x_tenant_id)


def _fmt_ip(r: dict) -> dict:
    return {
        "id":         str(r["id"]),
        "cidr":       r["cidr"],
        "label":      r["label"] or "",
        "is_active":  r["is_active"],
        "created_by": r["created_by"],
        "created_at": r["created_at"].isoformat() if r["created_at"] else None,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# API KEYS
# ═══════════════════════════════════════════════════════════════════════════════

SCOPE_PREFIX = {"full_access": "prod", "read_only": "ro", "admin_platform": "adm"}
VALID_SCOPES = set(SCOPE_PREFIX.keys())


def _gen_key(scope: str) -> tuple[str, str]:
    suffix = "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(32))
    prefix = f"sk-{SCOPE_PREFIX.get(scope, 'key')}-{''.join(secrets.choice(string.ascii_letters) for _ in range(4))}"
    return f"{prefix}{suffix}", prefix


def _hash_key(raw: str) -> str:
    return bcrypt.hashpw(raw.encode(), bcrypt.gensalt(rounds=12)).decode()


class APIKeyIn(BaseModel):
    name: str
    scope: str = "read_only"
    expires_at: Optional[str] = None


@app.get("/api/auth/api-keys")
def list_api_keys(
    x_tenant_id: str = Header(..., alias="X-Tenant-Id"),
    user: dict = Depends(require_role("platform-admin")),
):
    conn = get_db()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT id, name, key_prefix, scope, created_by, last_used_at, expires_at, revoked_at, rotated_from, created_at FROM api_keys WHERE tenant_id = %s ORDER BY created_at DESC",
                (x_tenant_id,),
            )
            return [_fmt_key(r) for r in cur.fetchall()]
    finally:
        conn.close()


@app.post("/api/auth/api-keys", status_code=201)
def create_api_key(
    body: APIKeyIn,
    x_tenant_id: str = Header(..., alias="X-Tenant-Id"),
    user: dict = Depends(require_role("platform-admin")),
):
    if body.scope not in VALID_SCOPES:
        raise HTTPException(status_code=422, detail=f"Invalid scope: {body.scope}")

    raw_key, prefix = _gen_key(body.scope)
    key_hash = _hash_key(raw_key)
    expires_at = None
    if body.expires_at:
        try:
            expires_at = datetime.fromisoformat(body.expires_at).replace(tzinfo=timezone.utc)
        except ValueError:
            raise HTTPException(status_code=422, detail="Invalid expires_at format")

    conn = get_db()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "INSERT INTO api_keys (tenant_id, created_by, name, key_hash, key_prefix, scope, expires_at) VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING id, name, key_prefix, scope, created_by, last_used_at, expires_at, revoked_at, rotated_from, created_at",
                (x_tenant_id, user["user_id"], body.name, key_hash, prefix, body.scope, expires_at),
            )
            row = cur.fetchone()
        conn.commit()
        return {**_fmt_key(row), "raw_key": raw_key}
    finally:
        conn.close()


@app.post("/api/auth/api-keys/{key_id}/revoke")
def revoke_api_key(
    key_id: str = Path(...),
    x_tenant_id: str = Header(..., alias="X-Tenant-Id"),
    user: dict = Depends(require_role("platform-admin")),
):
    conn = get_db()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "UPDATE api_keys SET revoked_at = now() WHERE id = %s AND tenant_id = %s AND revoked_at IS NULL RETURNING id, name, key_prefix, scope, created_by, last_used_at, expires_at, revoked_at, rotated_from, created_at",
                (key_id, x_tenant_id),
            )
            row = cur.fetchone()
        if not row:
            conn.rollback()
            raise HTTPException(status_code=404, detail="Key not found or already revoked")
        conn.commit()
        return _fmt_key(row)
    finally:
        conn.close()


@app.post("/api/auth/api-keys/{key_id}/rotate", status_code=201)
def rotate_api_key(
    key_id: str = Path(...),
    x_tenant_id: str = Header(..., alias="X-Tenant-Id"),
    user: dict = Depends(require_role("platform-admin")),
):
    conn = get_db()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT id, scope, name, expires_at FROM api_keys WHERE id = %s AND tenant_id = %s AND revoked_at IS NULL",
                (key_id, x_tenant_id),
            )
            old = cur.fetchone()
            if not old:
                raise HTTPException(status_code=404, detail="Key not found or already revoked")
            cur.execute("UPDATE api_keys SET revoked_at = now() WHERE id = %s", (old["id"],))
            raw_key, prefix = _gen_key(old["scope"])
            cur.execute(
                "INSERT INTO api_keys (tenant_id, created_by, name, key_hash, key_prefix, scope, expires_at, rotated_from) VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id, name, key_prefix, scope, created_by, last_used_at, expires_at, revoked_at, rotated_from, created_at",
                (x_tenant_id, user["user_id"], old["name"], _hash_key(raw_key), prefix, old["scope"], old["expires_at"], old["id"]),
            )
            new_row = cur.fetchone()
        conn.commit()
        return {**_fmt_key(new_row), "raw_key": raw_key}
    finally:
        conn.close()


def _fmt_key(r: dict) -> dict:
    def _iso(v): return v.isoformat() if v else None
    return {
        "id":           str(r["id"]),
        "name":         r["name"],
        "key_prefix":   r["key_prefix"],
        "scope":        r["scope"],
        "created_by":   r["created_by"],
        "last_used_at": _iso(r["last_used_at"]),
        "expires_at":   _iso(r["expires_at"]),
        "revoked_at":   _iso(r["revoked_at"]),
        "rotated_from": str(r["rotated_from"]) if r["rotated_from"] else None,
        "created_at":   _iso(r["created_at"]),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# SECRETS VAULT (backed by OpenBao KV v2)
# ═══════════════════════════════════════════════════════════════════════════════

VALID_KEY_TYPES = {"ENCRYPTION_KEY", "SIGNING_KEY", "HMAC_KEY", "BEARER_TOKEN", "MCP_TOKEN", "KB_API_KEY"}
_VAULT_MOUNT   = "secret"
_TRANSIT_MOUNT = "transit"
_GOV_KEYS = ["vault_auto_rotation", "vault_panic_mode", "vault_pii_access_log"]

# Key types managed by Transit engine — private key never leaves OpenBao
_TRANSIT_TYPES = {"SIGNING_KEY", "ENCRYPTION_KEY", "HMAC_KEY"}

# Map algorithm name (UI/DB) → OpenBao Transit key type
_ALGO_TO_TRANSIT: dict[str, str] = {
    "RSA-4096":    "rsa-4096",
    "RSA-2048":    "rsa-2048",
    "EC-P256":     "ecdsa-p256",
    "HMAC-SHA256": "aes256-gcm96",  # OpenBao Transit: hmac ops use aes256-gcm96 key type
    "AES-256":     "aes256-gcm96",
    "ChaCha20":    "chacha20-poly1305",
}


def _vault_path(tenant_id: str, key_name: str) -> str:
    return f"tenants/{tenant_id}/{key_name}"


def _transit_key_name(tenant_id: str, key_name: str) -> str:
    # Transit key names: alphanumeric + dash only, max 63 chars
    safe = key_name.lower().replace("_", "-").replace(" ", "-")
    return f"{tenant_id[:8]}-{safe}"[:63]


def _get_gov_setting(cur, key: str) -> bool:
    cur.execute("SELECT value FROM platform_settings WHERE key = %s", (key,))
    row = cur.fetchone()
    return row["value"].lower() == "true" if row else False


def _fmt_secret(r: dict) -> dict:
    def _iso(v): return v.isoformat() if v else None
    return {
        "id":              str(r["id"]),
        "key_name":        r["key_name"],
        "key_type":        r["key_type"],
        "algorithm":       r["algorithm"] or "",
        "realm":           r["realm"] or "",
        "version":         r["version"],
        "is_active":       r["is_active"],
        "rotation_due_at": _iso(r["rotation_due_at"]),
        "last_rotated_at": _iso(r["last_rotated_at"]),
        "created_by":      r["created_by"] or "",
        "created_at":      _iso(r["created_at"]),
    }


class SecretIn(BaseModel):
    key_name: str
    key_type: str
    algorithm: str = ""
    realm: str = ""
    value: str = ""      # ignored for Transit-managed types (SIGNING_KEY, ENCRYPTION_KEY, HMAC_KEY)
    rotation_days: int = 90


@app.get("/api/auth/secrets")
def list_secrets(
    x_tenant_id:  str = Header(..., alias="X-Tenant-Id"),
    user: dict = Depends(require_role("platform-admin")),
    _panic: None = Depends(_vault_panic_check),
):
    conn = get_db()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT id, key_name, key_type, algorithm, realm, version, is_active, "
                "rotation_due_at, last_rotated_at, created_by, created_at "
                "FROM secrets_vault WHERE tenant_id = %s ORDER BY created_at DESC",
                (x_tenant_id,),
            )
            return [_fmt_secret(r) for r in cur.fetchall()]
    finally:
        conn.close()


@app.post("/api/auth/secrets", status_code=201)
def create_secret(
    body: SecretIn,
    x_tenant_id:  str = Header(..., alias="X-Tenant-Id"),
    user: dict = Depends(require_role("platform-admin")),
    _panic: None = Depends(_vault_panic_check),
):
    if body.key_type not in VALID_KEY_TYPES:
        raise HTTPException(status_code=422, detail=f"Invalid key_type: {body.key_type}")
    if body.key_type not in _TRANSIT_TYPES and not body.value:
        raise HTTPException(status_code=422, detail="value is required for this key type")

    vault = get_vault()
    path  = _vault_path(x_tenant_id, body.key_name)

    if body.key_type in _TRANSIT_TYPES:
        # Key is generated inside OpenBao Transit — private key never leaves the vault
        t_key  = _transit_key_name(x_tenant_id, body.key_name)
        t_type = _ALGO_TO_TRANSIT.get(body.algorithm, "rsa-4096")
        try:
            vault.secrets.transit.create_key(name=t_key, key_type=t_type, exportable=False, mount_point=_TRANSIT_MOUNT)
        except Exception as e:
            err = str(e)
            if "already exists" not in err.lower():
                log.warning("transit_create_failed", error=err)
                raise HTTPException(status_code=502, detail="Failed to create Transit key")
        # KV v2 entry stores metadata only (no raw key value)
        try:
            vault.secrets.kv.v2.create_or_update_secret(
                mount_point=_VAULT_MOUNT, path=path,
                secret={"transit_key": t_key, "managed": "transit", "key_type": body.key_type, "algorithm": body.algorithm},
            )
        except Exception as e:
            log.warning("openbao_write_failed", error=str(e))
            raise HTTPException(status_code=502, detail="Failed to store secret metadata in vault")
        openbao_path = f"transit/keys/{t_key}"
    else:
        # KV v2 — raw value stored in vault
        try:
            vault.secrets.kv.v2.create_or_update_secret(
                mount_point=_VAULT_MOUNT, path=path,
                secret={"value": body.value, "key_type": body.key_type, "algorithm": body.algorithm},
            )
        except Exception as e:
            log.warning("openbao_write_failed", error=str(e))
            raise HTTPException(status_code=502, detail="Failed to store secret in vault")
        openbao_path = f"{_VAULT_MOUNT}/data/{path}"

    rotation_due = datetime.now(timezone.utc) + timedelta(days=body.rotation_days)

    conn = get_db()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "INSERT INTO secrets_vault (tenant_id, key_name, key_type, algorithm, realm, "
                "openbao_path, version, rotation_due_at, created_by) "
                "VALUES (%s,%s,%s,%s,%s,%s,1,%s,%s) "
                "RETURNING id, key_name, key_type, algorithm, realm, version, is_active, "
                "rotation_due_at, last_rotated_at, created_by, created_at",
                (x_tenant_id, body.key_name, body.key_type, body.algorithm,
                 body.realm, openbao_path, rotation_due, user["user_id"]),
            )
            row = cur.fetchone()
        conn.commit()
        return _fmt_secret(row)
    except psycopg2.errors.UniqueViolation:
        conn.rollback()
        raise HTTPException(status_code=409, detail="Secret with this name already exists")
    finally:
        conn.close()


@app.delete("/api/auth/secrets/{secret_id}", status_code=204)
def delete_secret(
    secret_id:    str = Path(...),
    x_tenant_id:  str = Header(..., alias="X-Tenant-Id"),
    user: dict = Depends(require_role("platform-admin")),
    _panic: None = Depends(_vault_panic_check),
):
    conn = get_db()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "UPDATE secrets_vault SET is_active = false WHERE id = %s AND tenant_id = %s "
                "RETURNING key_name, key_type, version",
                (secret_id, x_tenant_id),
            )
            row = cur.fetchone()
        if not row:
            conn.rollback()
            raise HTTPException(status_code=404, detail="Secret not found")
        conn.commit()
    finally:
        conn.close()

    vault = get_vault()
    if row["key_type"] in _TRANSIT_TYPES:
        try:
            t_key = _transit_key_name(x_tenant_id, row["key_name"])
            vault.secrets.transit.delete_key(name=t_key, mount_point=_TRANSIT_MOUNT)
        except Exception as e:
            log.warning("transit_delete_failed", error=str(e))
    else:
        try:
            path = _vault_path(x_tenant_id, row["key_name"])
            vault.secrets.kv.v2.destroy_secret_versions(
                mount_point=_VAULT_MOUNT, path=path, versions=[row["version"]],
            )
        except Exception as e:
            log.warning("openbao_destroy_failed", error=str(e))


@app.post("/api/auth/secrets/{secret_id}/rotate", status_code=201)
def rotate_secret(
    secret_id:    str = Path(...),
    x_tenant_id:  str = Header(..., alias="X-Tenant-Id"),
    user: dict = Depends(require_role("platform-admin")),
    body: dict = None,
    _panic: None = Depends(_vault_panic_check),
):
    new_value = (body or {}).get("value", "")

    conn = get_db()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT id, key_name, key_type, algorithm, realm, version, rotation_due_at "
                "FROM secrets_vault WHERE id = %s AND tenant_id = %s AND is_active = true",
                (secret_id, x_tenant_id),
            )
            old = cur.fetchone()
            if not old:
                raise HTTPException(status_code=404, detail="Secret not found or already inactive")

            new_version = old["version"] + 1
            vault = get_vault()

            if old["key_type"] in _TRANSIT_TYPES:
                # Transit rotation: new key version generated inside vault
                t_key = _transit_key_name(x_tenant_id, old["key_name"])
                try:
                    vault.secrets.transit.rotate_key(name=t_key, mount_point=_TRANSIT_MOUNT)
                except Exception as e:
                    log.warning("transit_rotate_failed", error=str(e))
                    raise HTTPException(status_code=502, detail="Failed to rotate Transit key")
                openbao_path = f"transit/keys/{t_key}"
            else:
                if not new_value:
                    raise HTTPException(status_code=422, detail="New secret value required for rotation")
                path = _vault_path(x_tenant_id, old["key_name"])
                try:
                    vault.secrets.kv.v2.create_or_update_secret(
                        mount_point=_VAULT_MOUNT, path=path,
                        secret={"value": new_value, "key_type": old["key_type"], "algorithm": old["algorithm"] or ""},
                    )
                except Exception as e:
                    log.warning("openbao_rotate_failed", error=str(e))
                    raise HTTPException(status_code=502, detail="Failed to write rotated secret to vault")
                openbao_path = f"{_VAULT_MOUNT}/data/{path}"

            rotation_due = datetime.now(timezone.utc) + timedelta(days=90)

            cur.execute("UPDATE secrets_vault SET is_active = false WHERE id = %s", (old["id"],))
            cur.execute(
                "INSERT INTO secrets_vault (tenant_id, key_name, key_type, algorithm, realm, "
                "openbao_path, version, rotation_due_at, last_rotated_at, created_by) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,now(),%s) "
                "RETURNING id, key_name, key_type, algorithm, realm, version, is_active, "
                "rotation_due_at, last_rotated_at, created_by, created_at",
                (x_tenant_id, old["key_name"], old["key_type"], old["algorithm"],
                 old["realm"], openbao_path, new_version, rotation_due, user["user_id"]),
            )
            new_row = cur.fetchone()

            cur.execute(
                "INSERT INTO key_rotations (secret_id, triggered_by, actor_id, old_version, new_version, status) "
                "VALUES (%s,'MANUAL',%s,%s,%s,'SUCCESS')",
                (new_row["id"], user["user_id"], old["version"], new_version),
            )
        conn.commit()
        return _fmt_secret(new_row)
    finally:
        conn.close()


@app.get("/api/auth/secrets/{secret_id}/reveal")
def reveal_secret(
    secret_id:     str = Path(...),
    access_reason: str | None = Query(None),
    x_tenant_id:   str = Header(..., alias="X-Tenant-Id"),
    user: dict = Depends(require_role("platform-admin")),
    _panic: None = Depends(_vault_panic_check),
):
    conn = get_db()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT key_name, key_type, version, is_active FROM secrets_vault "
                "WHERE id = %s AND tenant_id = %s",
                (secret_id, x_tenant_id),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Secret not found")

            pii_log = _get_gov_setting(cur, "vault_pii_access_log")

        if pii_log:
            if not access_reason or not access_reason.strip():
                raise HTTPException(
                    status_code=422,
                    detail="access_reason is required when PII Access Log is enabled",
                )
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO key_rotations "
                    "(secret_id, triggered_by, actor_id, old_version, new_version, status, access_reason) "
                    "VALUES (%s,'REVEAL',%s,%s,%s,'SUCCESS',%s)",
                    (secret_id, user["user_id"], row["version"], row["version"], access_reason.strip()),
                )
            conn.commit()
    finally:
        conn.close()

    vault = get_vault()
    if row["key_type"] in _TRANSIT_TYPES:
        # Return public key (for asymmetric types) or a note (for symmetric)
        t_key = _transit_key_name(x_tenant_id, row["key_name"])
        try:
            key_info = vault.secrets.transit.read_key(name=t_key, mount_point=_TRANSIT_MOUNT)
            keys_data = key_info["data"]["keys"]
            latest_v  = str(key_info["data"]["latest_version"])
            pub_key   = keys_data.get(latest_v, {}).get("public_key", "")
            value = pub_key if pub_key else "(symmetric key — private key never exported from vault)"
        except Exception as e:
            log.warning("transit_read_failed", error=str(e))
            if not row["is_active"]:
                raise HTTPException(status_code=410, detail="Transit key was deleted — not recoverable")
            raise HTTPException(status_code=502, detail="Failed to read Transit key info")
    else:
        try:
            path = _vault_path(x_tenant_id, row["key_name"])
            resp  = vault.secrets.kv.v2.read_secret_version(mount_point=_VAULT_MOUNT, path=path, raise_on_deleted_version=True)
            value = resp["data"]["data"].get("value", "")
        except Exception as e:
            log.warning("openbao_read_failed", error=str(e))
            if not row["is_active"]:
                raise HTTPException(status_code=410, detail="Secret was permanently deleted — value is not recoverable")
            raise HTTPException(status_code=502, detail="Failed to read secret from vault")

    return {"id": secret_id, "key_name": row["key_name"], "value": value, "is_active": row["is_active"]}


# ── Governance ────────────────────────────────────────────────────────────────

@app.get("/api/auth/secrets/governance")
def get_governance(
    user: dict = Depends(require_role("platform-admin")),
):
    conn = get_db()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            result = {}
            for key in _GOV_KEYS:
                result[key] = _get_gov_setting(cur, key)
        return result
    finally:
        conn.close()


@app.put("/api/auth/secrets/governance")
def set_governance(
    body: dict,
    user: dict = Depends(require_role("platform-admin")),
):
    conn = get_db()
    try:
        with conn.cursor() as cur:
            for key in _GOV_KEYS:
                if key in body:
                    val = "true" if body[key] else "false"
                    cur.execute(
                        "INSERT INTO platform_settings (key, value, updated_at) VALUES (%s,%s,now()) "
                        "ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=now()",
                        (key, val),
                    )
        conn.commit()
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            result = {key: _get_gov_setting(cur, key) for key in _GOV_KEYS}
        return result
    finally:
        conn.close()


@app.post("/api/auth/secrets/panic", status_code=200)
def trigger_panic(
    x_tenant_id:  str = Header(..., alias="X-Tenant-Id"),
    user: dict = Depends(require_role("platform-admin")),
):
    conn = get_db()
    revoked = []
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "UPDATE secrets_vault SET is_active = false "
                "WHERE tenant_id = %s AND is_active = true "
                "RETURNING id, key_name, version",
                (x_tenant_id,),
            )
            rows = cur.fetchall()
            for r in rows:
                cur.execute(
                    "INSERT INTO key_rotations (secret_id, triggered_by, actor_id, old_version, new_version, status) "
                    "VALUES (%s,'PANIC',%s,%s,%s,'SUCCESS')",
                    (r["id"], user["user_id"], r["version"], r["version"]),
                )
                revoked.append(r["key_name"])
        conn.commit()
    finally:
        conn.close()

    # Enable panic mode in governance settings
    conn2 = get_db()
    try:
        with conn2.cursor() as cur:
            cur.execute(
                "INSERT INTO platform_settings (key, value, updated_at) VALUES ('vault_panic_mode','true',now()) "
                "ON CONFLICT (key) DO UPDATE SET value='true', updated_at=now()",
            )
        conn2.commit()
    finally:
        conn2.close()

    log.warning("vault_panic_triggered", actor=user["user_id"], revoked_count=len(revoked))
    return {"revoked": revoked, "count": len(revoked)}


@app.get("/api/auth/secrets/hsm/status")
def hsm_status(
    x_tenant_id:  str = Header(..., alias="X-Tenant-Id"),
    user: dict = Depends(require_role("platform-admin")),
    _panic: None = Depends(_vault_panic_check),
):
    vault = get_vault()
    keys_out = []
    try:
        list_resp = vault.secrets.transit.list_keys(mount_point=_TRANSIT_MOUNT)
        key_names = (list_resp or {}).get("data", {}).get("keys", [])
        prefix = x_tenant_id[:8] + "-"
        for name in key_names:
            if not name.startswith(prefix):
                continue
            try:
                info = vault.secrets.transit.read_key(name=name, mount_point=_TRANSIT_MOUNT)
                d = info["data"]
                keys_out.append({
                    "name":           name,
                    "type":           d.get("type", "unknown"),
                    "latest_version": d.get("latest_version", 1),
                    "min_version":    d.get("min_decryption_version", 1),
                })
            except Exception:
                pass
    except Exception as e:
        # 404 = no keys yet, not a real error
        if "404" not in str(e) and "no keys" not in str(e).lower():
            log.warning("transit_list_failed", error=str(e))

    try:
        health = vault.sys.read_health_status(method="GET")
        sealed = health.get("sealed", False) if isinstance(health, dict) else False
    except Exception:
        sealed = False

    return {
        "transit_keys":  keys_out,
        "key_count":     len(keys_out),
        "openbao_sealed": sealed,
        "mount":         f"{_TRANSIT_MOUNT}/",
    }


class SignIn(BaseModel):
    data: str  # base64-encoded bytes to sign


class VerifyIn(BaseModel):
    data:      str  # base64-encoded bytes
    signature: str  # vault:v1:... signature


@app.post("/api/auth/secrets/{secret_id}/sign")
def sign_data(
    secret_id:    str = Path(...),
    body:         SignIn = None,
    x_tenant_id:  str = Header(..., alias="X-Tenant-Id"),
    user: dict = Depends(require_role("platform-admin")),
    _panic: None = Depends(_vault_panic_check),
):
    if not body or not body.data:
        raise HTTPException(status_code=422, detail="data (base64) is required")

    conn = get_db()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT key_name, key_type FROM secrets_vault WHERE id = %s AND tenant_id = %s AND is_active = true",
                (secret_id, x_tenant_id),
            )
            row = cur.fetchone()
    finally:
        conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Secret not found or inactive")
    if row["key_type"] not in _TRANSIT_TYPES:
        raise HTTPException(status_code=422, detail="sign is only available for Transit-managed key types")

    t_key = _transit_key_name(x_tenant_id, row["key_name"])
    try:
        vault = get_vault()
        resp  = vault.secrets.transit.sign_data(
            name=t_key, hash_input=body.data, hash_algorithm="sha2-256",
            mount_point=_TRANSIT_MOUNT,
        )
        sig = resp["data"]["signature"]
        ver = resp["data"].get("key_version", 1)
    except Exception as e:
        log.warning("transit_sign_failed", error=str(e))
        raise HTTPException(status_code=502, detail="Transit sign operation failed")

    return {"signature": sig, "key_version": ver, "key_name": row["key_name"]}


@app.post("/api/auth/secrets/{secret_id}/verify")
def verify_data(
    secret_id:    str = Path(...),
    body:         VerifyIn = None,
    x_tenant_id:  str = Header(..., alias="X-Tenant-Id"),
    user: dict = Depends(require_role("platform-admin")),
    _panic: None = Depends(_vault_panic_check),
):
    if not body or not body.data or not body.signature:
        raise HTTPException(status_code=422, detail="data and signature are required")

    conn = get_db()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT key_name, key_type FROM secrets_vault WHERE id = %s AND tenant_id = %s",
                (secret_id, x_tenant_id),
            )
            row = cur.fetchone()
    finally:
        conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Secret not found")
    if row["key_type"] not in _TRANSIT_TYPES:
        raise HTTPException(status_code=422, detail="verify is only available for Transit-managed key types")

    t_key = _transit_key_name(x_tenant_id, row["key_name"])
    try:
        vault = get_vault()
        resp  = vault.secrets.transit.verify_signed_data(
            name=t_key, hash_input=body.data, signature=body.signature,
            hash_algorithm="sha2-256", mount_point=_TRANSIT_MOUNT,
        )
        valid = resp["data"]["valid"]
    except Exception as e:
        log.warning("transit_verify_failed", error=str(e))
        raise HTTPException(status_code=502, detail="Transit verify operation failed")

    return {"valid": valid, "key_name": row["key_name"]}


@app.get("/api/auth/secrets/pii-log")
def secrets_pii_log(
    x_tenant_id:  str = Header(..., alias="X-Tenant-Id"),
    user: dict = Depends(require_role("platform-admin")),
):
    conn = get_db()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT kr.id, kr.actor_id, kr.old_version, kr.rotated_at, "
                "       kr.access_reason, sv.key_name, sv.key_type "
                "FROM key_rotations kr "
                "JOIN secrets_vault sv ON sv.id = kr.secret_id "
                "WHERE sv.tenant_id = %s AND kr.triggered_by = 'REVEAL' "
                "ORDER BY kr.rotated_at DESC LIMIT 50",
                (x_tenant_id,),
            )
            rows = cur.fetchall()
        return [
            {
                "id":            str(r["id"]),
                "key_name":      r["key_name"],
                "key_type":      r["key_type"],
                "actor_id":      r["actor_id"],
                "version":       r["old_version"],
                "access_reason": r["access_reason"],
                "time":          r["rotated_at"].isoformat() if r["rotated_at"] else None,
            }
            for r in rows
        ]
    finally:
        conn.close()


@app.get("/api/auth/secrets/audit-log")
def secrets_audit_log(
    x_tenant_id:  str = Header(..., alias="X-Tenant-Id"),
    user: dict = Depends(require_role("platform-admin")),
):
    conn = get_db()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT kr.id, kr.triggered_by, kr.actor_id, kr.old_version, kr.new_version, "
                "kr.status, kr.error, kr.rotated_at, sv.key_name "
                "FROM key_rotations kr "
                "JOIN secrets_vault sv ON sv.id = kr.secret_id "
                "WHERE sv.tenant_id = %s "
                "ORDER BY kr.rotated_at DESC LIMIT 20",
                (x_tenant_id,),
            )
            rows = cur.fetchall()
        return [
            {
                "id":           str(r["id"]),
                "event":        r["triggered_by"],
                "key_name":     r["key_name"],
                "actor_id":     r["actor_id"],
                "old_version":  r["old_version"],
                "new_version":  r["new_version"],
                "status":       r["status"],
                "error":        r["error"],
                "time":         r["rotated_at"].isoformat() if r["rotated_at"] else None,
            }
            for r in rows
        ]
    finally:
        conn.close()
