#!/usr/bin/env python3
"""Multi-tenant isolation test suite.

Tests that Tenant 1 (AeroFlow Dev) and Tenant 2 (Helios Corp) are completely
isolated from each other across: secrets, API keys, IP allowlists, HSM/Transit
keys, and audit logs.
"""
import requests
import sys

KEYCLOAK = "http://localhost:8080"
KONG = "http://localhost:8000/api/auth"

PASS = "PASS"
FAIL = "FAIL"


def get_token(username, password):
    r = requests.post(
        f"{KEYCLOAK}/realms/aeroflow/protocol/openid-connect/token",
        data={"grant_type": "password", "client_id": "aeroflow-frontend",
              "username": username, "password": password},
    )
    d = r.json()
    if "access_token" not in d:
        raise RuntimeError(f"Login failed for {username}: {d}")
    return d["access_token"]


def api(token, method, path, **kw):
    h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    return getattr(requests, method)(f"{KONG}{path}", headers=h, **kw)


def run():
    print("Logging in...")
    t1_tok = get_token("platform-admin", "Admin123456!")
    t2_tok = get_token("helios-admin", "H3lios@Admin01!")
    print("  T1 (AeroFlow Dev) - platform-admin: OK")
    print("  T2 (Helios Corp)  - helios-admin:   OK")
    print()

    # ── Fetch data ─────────────────────────────────────────────────────────────
    t1_secrets = api(t1_tok, "get", "/secrets").json()
    t2_secrets = api(t2_tok, "get", "/secrets").json()
    t1_keys    = api(t1_tok, "get", "/api-keys").json()
    t2_keys    = api(t2_tok, "get", "/api-keys").json()
    t1_ips     = api(t1_tok, "get", "/ip-allowlists").json()
    t2_ips     = api(t2_tok, "get", "/ip-allowlists").json()
    t1_hsm     = api(t1_tok, "get", "/secrets/hsm/status").json()
    t2_hsm     = api(t2_tok, "get", "/secrets/hsm/status").json()
    t1_audit   = api(t1_tok, "get", "/secrets/audit-log").json()
    t2_audit   = api(t2_tok, "get", "/secrets/audit-log").json()

    t1_secret_ids = {s["id"] for s in t1_secrets}
    t2_secret_ids = {s["id"] for s in t2_secrets}
    t1_key_ids    = {k["id"] for k in t1_keys}
    t2_key_ids    = {k["id"] for k in t2_keys}
    t1_ip_ids     = {r["id"] for r in t1_ips}
    t2_ip_ids     = {r["id"] for r in t2_ips}
    t1_transit    = {k["name"] for k in t1_hsm.get("transit_keys", [])}
    t2_transit    = {k["name"] for k in t2_hsm.get("transit_keys", [])}

    results = []

    def check(verdict, desc, detail=None):
        results.append((verdict, desc, detail))

    # ── 1. Secrets list isolation ───────────────────────────────────────────
    overlap = t1_secret_ids & t2_secret_ids
    check(
        PASS if not overlap else FAIL,
        f"[Secrets] No ID overlap between T1({len(t1_secrets)}) and T2({len(t2_secrets)})",
        f"overlap={overlap}" if overlap else None,
    )

    t1_helios = [s["key_name"] for s in t1_secrets if "HELIOS" in s["key_name"]]
    check(
        PASS if not t1_helios else FAIL,
        "[Secrets] T1 list contains no HELIOS keys",
        f"found: {t1_helios}" if t1_helios else None,
    )

    t2_non_helios = [
        s["key_name"] for s in t2_secrets
        if "HELIOS" not in s["key_name"]
    ]
    check(
        PASS if not t2_non_helios else FAIL,
        "[Secrets] T2 list contains only HELIOS keys",
        f"non-helios found: {t2_non_helios}" if t2_non_helios else None,
    )

    # ── 2. Cross-tenant reveal by UUID ──────────────────────────────────────
    t2_kv_id = next(
        (s["id"] for s in t2_secrets if s["key_type"] == "BEARER_TOKEN" and s["is_active"]),
        None,
    )
    if t2_kv_id:
        r = api(t1_tok, "get", f"/secrets/{t2_kv_id}/reveal")
        check(
            PASS if r.status_code == 404 else FAIL,
            f"[Secrets] T1 cannot reveal T2 secret by UUID -> HTTP {r.status_code} (want 404)",
        )

    t1_kv_id = next(
        (s["id"] for s in t1_secrets if s["key_type"] == "BEARER_TOKEN" and s["is_active"]),
        None,
    )
    if t1_kv_id:
        r = api(t2_tok, "get", f"/secrets/{t1_kv_id}/reveal")
        check(
            PASS if r.status_code == 404 else FAIL,
            f"[Secrets] T2 cannot reveal T1 secret by UUID -> HTTP {r.status_code} (want 404)",
        )

    # ── 3. Cross-tenant Transit sign ────────────────────────────────────────
    t2_sign_id = next(
        (s["id"] for s in t2_secrets if s["key_type"] == "SIGNING_KEY" and s["is_active"]),
        None,
    )
    if t2_sign_id:
        r = api(t1_tok, "post", f"/secrets/{t2_sign_id}/sign",
                json={"data": "aGVsbG8="})
        check(
            PASS if r.status_code == 404 else FAIL,
            f"[Transit] T1 cannot sign with T2 signing key -> HTTP {r.status_code} (want 404)",
        )

    t1_sign_id = next(
        (s["id"] for s in t1_secrets if s["key_type"] == "SIGNING_KEY" and s["is_active"]),
        None,
    )
    if t1_sign_id:
        r = api(t2_tok, "post", f"/secrets/{t1_sign_id}/sign",
                json={"data": "aGVsbG8="})
        check(
            PASS if r.status_code == 404 else FAIL,
            f"[Transit] T2 cannot sign with T1 signing key -> HTTP {r.status_code} (want 404)",
        )

    # ── 4. Cross-tenant delete ──────────────────────────────────────────────
    if t2_kv_id:
        r = api(t1_tok, "delete", f"/secrets/{t2_kv_id}")
        check(
            PASS if r.status_code == 404 else FAIL,
            f"[Secrets] T1 cannot delete T2 secret -> HTTP {r.status_code} (want 404)",
        )

    # ── 5. API key isolation ────────────────────────────────────────────────
    overlap_keys = t1_key_ids & t2_key_ids
    check(
        PASS if not overlap_keys else FAIL,
        f"[API Keys] No ID overlap T1({len(t1_keys)}) vs T2({len(t2_keys)})",
        f"overlap={overlap_keys}" if overlap_keys else None,
    )

    if t2_key_ids:
        t2_kid = next(iter(t2_key_ids))
        r = api(t1_tok, "post", f"/api-keys/{t2_kid}/revoke")
        check(
            PASS if r.status_code == 404 else FAIL,
            f"[API Keys] T1 cannot revoke T2 key -> HTTP {r.status_code} (want 404)",
        )

    if t1_key_ids:
        t1_kid = next(iter(t1_key_ids))
        r = api(t2_tok, "post", f"/api-keys/{t1_kid}/revoke")
        check(
            PASS if r.status_code == 404 else FAIL,
            f"[API Keys] T2 cannot revoke T1 key -> HTTP {r.status_code} (want 404)",
        )

    if t1_key_ids:
        t1_kid = next(iter(t1_key_ids))
        r = api(t2_tok, "post", f"/api-keys/{t1_kid}/rotate")
        check(
            PASS if r.status_code == 404 else FAIL,
            f"[API Keys] T2 cannot rotate T1 key -> HTTP {r.status_code} (want 404)",
        )

    # ── 6. IP allowlist isolation ───────────────────────────────────────────
    overlap_ips = t1_ip_ids & t2_ip_ids
    check(
        PASS if not overlap_ips else FAIL,
        f"[IP Rules] No ID overlap T1({len(t1_ips)}) vs T2({len(t2_ips)})",
        f"overlap={overlap_ips}" if overlap_ips else None,
    )

    if t2_ip_ids:
        t2_ipid = next(iter(t2_ip_ids))
        r = api(t1_tok, "patch", f"/ip-allowlists/{t2_ipid}/toggle")
        check(
            PASS if r.status_code == 404 else FAIL,
            f"[IP Rules] T1 cannot toggle T2 IP rule -> HTTP {r.status_code} (want 404)",
        )
        r = api(t1_tok, "delete", f"/ip-allowlists/{t2_ipid}")
        check(
            PASS if r.status_code == 404 else FAIL,
            f"[IP Rules] T1 cannot delete T2 IP rule -> HTTP {r.status_code} (want 404)",
        )

    if t1_ip_ids:
        t1_ipid = next(iter(t1_ip_ids))
        r = api(t2_tok, "patch", f"/ip-allowlists/{t1_ipid}/toggle")
        check(
            PASS if r.status_code == 404 else FAIL,
            f"[IP Rules] T2 cannot toggle T1 IP rule -> HTTP {r.status_code} (want 404)",
        )

    # ── 7. HSM / Transit key isolation ─────────────────────────────────────
    overlap_transit = t1_transit & t2_transit
    check(
        PASS if not overlap_transit else FAIL,
        f"[HSM] Transit keys: T1({len(t1_transit)}) and T2({len(t2_transit)}) non-overlapping",
        f"overlap={overlap_transit}" if overlap_transit else None,
    )

    t1_helios_transit = [n for n in t1_transit if n.startswith("b0000000")]
    t2_aeroflow_transit = [n for n in t2_transit if n.startswith("a0000000")]
    check(
        PASS if not t1_helios_transit else FAIL,
        "[HSM] T1 HSM status shows no Helios transit keys",
        f"found: {t1_helios_transit}" if t1_helios_transit else None,
    )
    check(
        PASS if not t2_aeroflow_transit else FAIL,
        "[HSM] T2 HSM status shows no AeroFlow transit keys",
        f"found: {t2_aeroflow_transit}" if t2_aeroflow_transit else None,
    )

    # ── 8. Audit log isolation ──────────────────────────────────────────────
    t1_helios_audit = [e for e in t1_audit if "HELIOS" in e.get("key_name", "")]
    t2_aeroflow_audit = [
        e for e in t2_audit
        if "HELIOS" not in e.get("key_name", "") and e.get("key_name", "")
    ]
    check(
        PASS if not t1_helios_audit else FAIL,
        f"[Audit] T1 audit log({len(t1_audit)} entries) contains no Helios entries",
        f"found: {[e['key_name'] for e in t1_helios_audit]}" if t1_helios_audit else None,
    )
    check(
        PASS if not t2_aeroflow_audit else FAIL,
        f"[Audit] T2 audit log({len(t2_audit)} entries) contains no AeroFlow entries",
        f"found: {[e['key_name'] for e in t2_aeroflow_audit[:5]]}" if t2_aeroflow_audit else None,
    )

    # ── 9. T2 own data accessible ───────────────────────────────────────────
    t2_active_kv = next(
        (s for s in t2_secrets if s["key_type"] == "BEARER_TOKEN" and s["is_active"]),
        None,
    )
    if t2_active_kv:
        r = api(t2_tok, "get", f"/secrets/{t2_active_kv['id']}/reveal")
        check(
            PASS if r.status_code == 200 else FAIL,
            f"[Own Data] T2 can reveal own secret '{t2_active_kv['key_name']}' -> HTTP {r.status_code}",
            r.text[:80] if r.status_code != 200 else None,
        )

    t2_own_sign = next(
        (s for s in t2_secrets if s["key_type"] == "SIGNING_KEY" and s["is_active"]),
        None,
    )
    if t2_own_sign:
        r = api(t2_tok, "post", f"/secrets/{t2_own_sign['id']}/sign",
                json={"data": "aGVsbG8gd29ybGQ="})
        check(
            PASS if r.status_code == 200 else FAIL,
            f"[Own Data] T2 can sign with own key '{t2_own_sign['key_name']}' -> HTTP {r.status_code}",
            r.text[:80] if r.status_code != 200 else None,
        )

    # ── Print results ────────────────────────────────────────────────────────
    print("=" * 68)
    print("  TENANT ISOLATION TEST RESULTS")
    print("=" * 68)
    passed = failed = 0
    for verdict, desc, detail in results:
        icon = "OK" if verdict == PASS else "XX"
        print(f"  [{icon}] {desc}")
        if detail:
            print(f"        -> {detail}")
        if verdict == PASS:
            passed += 1
        else:
            failed += 1
    print("=" * 68)
    print(f"  {passed} PASSED  |  {failed} FAILED  |  {passed + failed} TOTAL")
    print("=" * 68)

    # Inventory summary
    print()
    print("  DATA INVENTORY")
    print(f"  T1 AeroFlow Dev  : {len(t1_secrets)} secrets | {len(t1_keys)} API keys | {len(t1_ips)} IP rules | {len(t1_transit)} transit keys")
    print(f"  T2 Helios Corp   : {len(t2_secrets)} secrets | {len(t2_keys)} API keys | {len(t2_ips)} IP rules | {len(t2_transit)} transit keys")
    print()

    return failed == 0


if __name__ == "__main__":
    ok = run()
    sys.exit(0 if ok else 1)
