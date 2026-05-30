#!/usr/bin/env sh
# Idempotent post-start configuration for Keycloak.
# Runs as a one-shot container after keycloak-lb is healthy.
# Assigns required realm-management client roles to platform-admin.

set -e

KC="${KC_URL:-http://keycloak-lb:8080}"
REALM="${KC_REALM:-aeroflow}"
ADMIN_USER="${KC_ADMIN_USER:-admin}"
ADMIN_PASS="${KC_ADMIN_PASSWORD:-admin}"

echo "[keycloak-setup] Waiting for Keycloak..."
until curl -sf "${KC}/realms/master" > /dev/null; do sleep 3; done
echo "[keycloak-setup] Keycloak ready."

# ── Get master admin token ──────────────────────────────────────────────────
TOKEN=$(curl -sf -X POST "${KC}/realms/master/protocol/openid-connect/token" \
  -d "client_id=admin-cli" \
  -d "username=${ADMIN_USER}" \
  -d "password=${ADMIN_PASS}" \
  -d "grant_type=password" | sed 's/.*"access_token":"\([^"]*\)".*/\1/')

AUTH="Authorization: Bearer ${TOKEN}"

# ── Resolve platform-admin user ID ─────────────────────────────────────────
USER_ID=$(curl -sf -H "${AUTH}" \
  "${KC}/admin/realms/${REALM}/users?username=platform-admin&exact=true" \
  | sed 's/.*"id":"\([^"]*\)".*/\1/' | head -1)

echo "[keycloak-setup] platform-admin user id: ${USER_ID}"

# ── Resolve realm-management client ID ─────────────────────────────────────
CLIENT_ID=$(curl -sf -H "${AUTH}" \
  "${KC}/admin/realms/${REALM}/clients?clientId=realm-management&search=false" \
  | sed 's/.*"id":"\([^"]*\)".*/\1/' | head -1)

echo "[keycloak-setup] realm-management client id: ${CLIENT_ID}"

# ── Fetch all available roles for realm-management ─────────────────────────
ALL_ROLES=$(curl -sf -H "${AUTH}" \
  "${KC}/admin/realms/${REALM}/clients/${CLIENT_ID}/roles")

# ── Fetch already-assigned client roles for the user ───────────────────────
ASSIGNED=$(curl -sf -H "${AUTH}" \
  "${KC}/admin/realms/${REALM}/users/${USER_ID}/role-mappings/clients/${CLIENT_ID}")

assign_role_if_missing() {
  ROLE_NAME="$1"
  if echo "${ASSIGNED}" | grep -q "\"${ROLE_NAME}\""; then
    echo "[keycloak-setup] ${ROLE_NAME} already assigned, skipping."
    return
  fi
  ROLE_JSON=$(echo "${ALL_ROLES}" | grep -o "{[^}]*\"name\":\"${ROLE_NAME}\"[^}]*}")
  if [ -z "${ROLE_JSON}" ]; then
    echo "[keycloak-setup] WARNING: role ${ROLE_NAME} not found in realm-management."
    return
  fi
  curl -sf -X POST -H "${AUTH}" -H "Content-Type: application/json" \
    "${KC}/admin/realms/${REALM}/users/${USER_ID}/role-mappings/clients/${CLIENT_ID}" \
    -d "[${ROLE_JSON}]"
  echo "[keycloak-setup] Assigned ${ROLE_NAME} to platform-admin."
}

assign_role_if_missing "view-events"
assign_role_if_missing "view-users"
assign_role_if_missing "query-users"
assign_role_if_missing "query-groups"

# ── User Profile: enable unmanagedAttributePolicy so tenant_id/role_id persist ──
# Without this, Keycloak 22+ declarative UP drops unknown attributes on write.
PROFILE=$(curl -sf -H "${AUTH}" "${KC}/admin/realms/${REALM}/users/profile")
if echo "${PROFILE}" | grep -q '"unmanagedAttributePolicy":"ENABLED"'; then
  echo "[keycloak-setup] unmanagedAttributePolicy already ENABLED, skipping."
else
  UPDATED=$(echo "${PROFILE}" | sed 's/"unmanagedAttributePolicy":"[^"]*"/"unmanagedAttributePolicy":"ENABLED"/; t; s/^\({.*\)$/\1/' | \
    python3 -c "
import sys, json
profile = json.load(sys.stdin)
profile['unmanagedAttributePolicy'] = 'ENABLED'
# Ensure tenant_id and role_id are declared
existing = {a['name'] for a in profile.get('attributes', [])}
for attr in [
    {'name': 'tenant_id', 'displayName': 'Tenant ID', 'permissions': {'view': ['admin'], 'edit': ['admin']}},
    {'name': 'role_id',   'displayName': 'Role ID',   'permissions': {'view': ['admin'], 'edit': ['admin']}},
]:
    if attr['name'] not in existing:
        profile.setdefault('attributes', []).append(attr)
print(json.dumps(profile))
")
  curl -sf -X PUT -H "${AUTH}" -H "Content-Type: application/json" \
    "${KC}/admin/realms/${REALM}/users/profile" \
    -d "${UPDATED}" > /dev/null
  echo "[keycloak-setup] unmanagedAttributePolicy set to ENABLED, tenant_id/role_id declared."
fi

echo "[keycloak-setup] Done."
