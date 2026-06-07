"""
Idempotent Keycloak post-start setup.
- Assigns realm-management client roles to platform-admin user
- Creates 'Browser MFA' authentication flow (TOTP required) and sets it as browserFlow
- Resets platform-admin password and ensures CONFIGURE_TOTP is set when no OTP exists
"""
import os, sys, time, urllib.request, urllib.parse, json

KC       = os.environ.get("KC_URL",           "http://keycloak-lb:8080")
REALM    = os.environ.get("KC_REALM",         "aeroflow")
ADMIN    = os.environ.get("KC_ADMIN_USER",    "admin")
PASSWORD = os.environ.get("KC_ADMIN_PASSWORD","admin")

REQUIRED_ROLES         = ["view-events", "view-users", "query-users", "query-groups"]
MFA_FLOW               = "Browser MFA"
MFA_SUBFLOW            = "Browser MFA - forms"
PLATFORM_ADMIN_PASSWORD = os.environ.get("PLATFORM_ADMIN_PASSWORD", "Admin@123456")


def get(url, token):
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


def post(url, token, body):
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        url, data=data,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req) as r:
        return r.status


def put(url, token, body):
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        url, data=data,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="PUT",
    )
    with urllib.request.urlopen(req) as r:
        return r.status


def wait_for_keycloak():
    url = f"{KC}/realms/master"
    for attempt in range(40):
        try:
            urllib.request.urlopen(url, timeout=5)
            print("[keycloak-setup] Keycloak ready.")
            return
        except Exception:
            print(f"[keycloak-setup] Waiting... ({attempt+1}/40)")
            time.sleep(5)
    sys.exit("Keycloak did not become ready in time.")


def get_token():
    data = urllib.parse.urlencode({
        "client_id":  "admin-cli",
        "username":   ADMIN,
        "password":   PASSWORD,
        "grant_type": "password",
    }).encode()
    req = urllib.request.Request(
        f"{KC}/realms/master/protocol/openid-connect/token", data=data
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())["access_token"]


def ensure_platform_admin_ready(token, user_id):
    """
    Idempotent: reset platform-admin password and ensure CONFIGURE_TOTP is set
    when the user has no OTP credential (e.g. after a fresh volume wipe).
    Password reset may be rejected by passwordHistory policy on non-fresh starts —
    that is safe to ignore since the imported password is already correct.
    """
    # Reset password — may fail with 400 if passwordHistory policy blocks reuse.
    # Safe to skip: realm-export.json already sets the correct password on fresh import.
    try:
        put(
            f"{KC}/admin/realms/{REALM}/users/{user_id}/reset-password",
            token,
            {"type": "password", "value": PLATFORM_ADMIN_PASSWORD, "temporary": False},
        )
        print("[keycloak-setup] platform-admin password set to canonical value.")
    except Exception as e:
        print(f"[keycloak-setup] Password reset skipped (policy or unchanged): {e}")

    # Check whether the user already has an OTP credential configured
    credentials = get(f"{KC}/admin/realms/{REALM}/users/{user_id}/credentials", token)
    has_otp = any(c.get("type") == "otp" for c in credentials)

    user_rep = get(f"{KC}/admin/realms/{REALM}/users/{user_id}", token)
    current_actions = user_rep.get("requiredActions") or []

    if has_otp:
        # OTP configured — clear CONFIGURE_TOTP from requiredActions if present
        if "CONFIGURE_TOTP" in current_actions:
            user_rep["requiredActions"] = [a for a in current_actions if a != "CONFIGURE_TOTP"]
            put(f"{KC}/admin/realms/{REALM}/users/{user_id}", token, user_rep)
            print("[keycloak-setup] OTP credential exists — removed CONFIGURE_TOTP from requiredActions.")
        else:
            print("[keycloak-setup] OTP credential exists — no action needed.")
    else:
        # No OTP — ensure user is prompted to configure TOTP on next login
        if "CONFIGURE_TOTP" not in current_actions:
            user_rep["requiredActions"] = current_actions + ["CONFIGURE_TOTP"]
            put(f"{KC}/admin/realms/{REALM}/users/{user_id}", token, user_rep)
            print("[keycloak-setup] No OTP credential — set CONFIGURE_TOTP as requiredAction.")
        else:
            print("[keycloak-setup] No OTP credential — CONFIGURE_TOTP already in requiredActions.")


def ensure_mfa_browser_flow(token):
    """Create 'Browser MFA' flow (TOTP REQUIRED at every login) and wire it as realm browserFlow."""
    flows = get(f"{KC}/admin/realms/{REALM}/authentication/flows", token)
    if not any(f["alias"] == MFA_FLOW for f in flows):
        base        = f"{KC}/admin/realms/{REALM}/authentication/flows"
        enc_flow    = urllib.parse.quote(MFA_FLOW,    safe="")
        enc_subflow = urllib.parse.quote(MFA_SUBFLOW, safe="")

        # Create top-level flow
        post(base, token, {
            "alias": MFA_FLOW,
            "description": "Browser flow enforcing TOTP on every login",
            "providerId": "basic-flow",
            "topLevel": True,
            "builtIn": False,
        })
        # Add cookie and idp-redirector executions, then sub-flow
        for provider in ("auth-cookie", "identity-provider-redirector"):
            post(f"{base}/{enc_flow}/executions/execution", token, {"provider": provider})
        post(f"{base}/{enc_flow}/executions/flow", token, {
            "alias": MFA_SUBFLOW, "type": "basic-flow", "description": "Username + password + OTP",
        })
        # Set requirements on top-level executions
        for ex in get(f"{base}/{enc_flow}/executions", token):
            pid  = ex.get("providerId", "")
            name = ex.get("displayName", ex.get("alias", ""))
            if pid in ("auth-cookie", "identity-provider-redirector") or name == MFA_SUBFLOW:
                ex["requirement"] = "ALTERNATIVE"
            elif pid == "auth-spnego":
                ex["requirement"] = "DISABLED"
            put(f"{base}/{enc_flow}/executions", token, ex)
        # Add executions to sub-flow and set both to REQUIRED
        for provider in ("auth-username-password-form", "auth-otp-form"):
            post(f"{base}/{enc_subflow}/executions/execution", token, {"provider": provider})
        for ex in get(f"{base}/{enc_subflow}/executions", token):
            ex["requirement"] = "REQUIRED"
            put(f"{base}/{enc_subflow}/executions", token, ex)
        print(f"[keycloak-setup] Auth flow '{MFA_FLOW}' created.")
    else:
        print(f"[keycloak-setup] Auth flow '{MFA_FLOW}' already exists, skipping.")

    # Wire browserFlow → MFA_FLOW
    realm_info = get(f"{KC}/admin/realms/{REALM}", token)
    if realm_info.get("browserFlow") == MFA_FLOW:
        print(f"[keycloak-setup] browserFlow already '{MFA_FLOW}'.")
    else:
        realm_info["browserFlow"] = MFA_FLOW
        put(f"{KC}/admin/realms/{REALM}", token, realm_info)
        print(f"[keycloak-setup] browserFlow → '{MFA_FLOW}'.")


def main():
    wait_for_keycloak()
    token = get_token()

    # ── Resolve platform-admin user ────────────────────────────────────────
    users = get(f"{KC}/admin/realms/{REALM}/users?username=platform-admin&exact=true", token)
    if not users:
        sys.exit("[keycloak-setup] ERROR: platform-admin user not found.")
    user_id = users[0]["id"]
    print(f"[keycloak-setup] platform-admin id: {user_id}")

    # ── Resolve realm-management client ───────────────────────────────────
    clients = get(f"{KC}/admin/realms/{REALM}/clients?clientId=realm-management&search=false", token)
    if not clients:
        sys.exit("[keycloak-setup] ERROR: realm-management client not found.")
    client_id = clients[0]["id"]
    print(f"[keycloak-setup] realm-management id: {client_id}")

    # ── Assign required roles to platform-admin ────────────────────────────
    all_roles = {r["name"]: r for r in get(
        f"{KC}/admin/realms/{REALM}/clients/{client_id}/roles", token
    )}
    assigned = {r["name"] for r in get(
        f"{KC}/admin/realms/{REALM}/users/{user_id}/role-mappings/clients/{client_id}", token
    )}
    to_assign = [
        all_roles[name] for name in REQUIRED_ROLES
        if name in all_roles and name not in assigned
    ]
    if not to_assign:
        print("[keycloak-setup] All required roles already assigned.")
    else:
        post(
            f"{KC}/admin/realms/{REALM}/users/{user_id}/role-mappings/clients/{client_id}",
            token, to_assign,
        )
        for r in to_assign:
            print(f"[keycloak-setup] Assigned: {r['name']}")

    # ── Ensure platform-admin password + TOTP action are consistent ──────
    ensure_platform_admin_ready(token, user_id)

    # ── Ensure MFA browser flow is active ─────────────────────────────────
    ensure_mfa_browser_flow(token)

    print("[keycloak-setup] Done.")


if __name__ == "__main__":
    main()
