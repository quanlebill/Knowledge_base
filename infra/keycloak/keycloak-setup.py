"""
Idempotent Keycloak post-start setup.
Assigns required realm-management client roles to platform-admin.
"""
import os, sys, time, urllib.request, urllib.parse, json

KC       = os.environ.get("KC_URL",           "http://keycloak-lb:8080")
REALM    = os.environ.get("KC_REALM",         "aeroflow")
ADMIN    = os.environ.get("KC_ADMIN_USER",    "admin")
PASSWORD = os.environ.get("KC_ADMIN_PASSWORD","admin")

REQUIRED_ROLES = ["view-events", "view-users", "query-users", "query-groups"]


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


def main():
    wait_for_keycloak()
    token = get_token()

    # Resolve platform-admin user
    users = get(f"{KC}/admin/realms/{REALM}/users?username=platform-admin&exact=true", token)
    if not users:
        sys.exit("[keycloak-setup] ERROR: platform-admin user not found.")
    user_id = users[0]["id"]
    print(f"[keycloak-setup] platform-admin id: {user_id}")

    # Resolve realm-management client
    clients = get(f"{KC}/admin/realms/{REALM}/clients?clientId=realm-management&search=false", token)
    if not clients:
        sys.exit("[keycloak-setup] ERROR: realm-management client not found.")
    client_id = clients[0]["id"]
    print(f"[keycloak-setup] realm-management id: {client_id}")

    # All available roles on realm-management
    all_roles = {r["name"]: r for r in get(
        f"{KC}/admin/realms/{REALM}/clients/{client_id}/roles", token
    )}

    # Already-assigned roles
    assigned = {r["name"] for r in get(
        f"{KC}/admin/realms/{REALM}/users/{user_id}/role-mappings/clients/{client_id}", token
    )}

    to_assign = [
        all_roles[name] for name in REQUIRED_ROLES
        if name in all_roles and name not in assigned
    ]

    if not to_assign:
        print("[keycloak-setup] All required roles already assigned.")
        return

    post(
        f"{KC}/admin/realms/{REALM}/users/{user_id}/role-mappings/clients/{client_id}",
        token, to_assign,
    )
    for r in to_assign:
        print(f"[keycloak-setup] Assigned: {r['name']}")

    print("[keycloak-setup] Done.")


if __name__ == "__main__":
    main()
