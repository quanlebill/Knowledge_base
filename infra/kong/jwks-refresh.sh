#!/usr/bin/env bash
# ─── Kong JWKS Key Refresh ─────────────────────────────────────────────
# Run this script after Keycloak rotates its signing key to keep Kong in sync.
#
# Design doc §1.4: Kong should use OIDC plugin with jwks_uri_refresh_interval=300
# for automatic refresh. Current setup uses the built-in JWT plugin (community edition)
# which requires manual key refresh on rotation.
#
# Usage:
#   bash infra/kong/jwks-refresh.sh
#
# Can be triggered automatically via Keycloak Event Listener SPI:
#   Keycloak Admin → Realm Settings → Events → Event Listeners → key-rotation-hook
#   → calls this script (or Kong Admin API directly) when KEY_ROTATION event fires

set -uo pipefail

KONG_ADMIN="${KONG_ADMIN_URL:-http://localhost:8001}"
KC_BASE="${KEYCLOAK_URL:-http://localhost:8080}"
REALM="${KEYCLOAK_REALM:-aeroflow}"

echo "🔄 Refreshing Kong JWKS from Keycloak after key rotation..."
echo "   Kong Admin : $KONG_ADMIN"
echo "   Keycloak   : $KC_BASE/realms/$REALM"

# ── Verify services reachable ──────────────────────────────────────────
curl -sf "$KONG_ADMIN/status" > /dev/null || { echo "❌ Kong not reachable at $KONG_ADMIN"; exit 1; }
curl -sf "$KC_BASE/realms/$REALM/.well-known/openid-configuration" > /dev/null \
  || { echo "❌ Keycloak not reachable at $KC_BASE"; exit 1; }

# ── Fetch new public key from JWKS ─────────────────────────────────────
echo "🔑 Fetching new JWKS from Keycloak..."
JWKS_URL="$KC_BASE/realms/$REALM/protocol/openid-connect/certs"

PYTHON=$(command -v python3 2>/dev/null || command -v python 2>/dev/null || echo "")
[ -z "$PYTHON" ] && { echo "❌ Python not found. Install python3 or run via Docker."; exit 1; }

PEM_KEY=$("$PYTHON" -c "
import base64, json, urllib.request
with urllib.request.urlopen('$JWKS_URL') as r:
    data = json.load(r)
rsa_keys = [k for k in data['keys'] if k['kty'] == 'RSA']
sig_keys  = [k for k in rsa_keys if k.get('use') == 'sig']
rsa_key   = sig_keys[-1] if sig_keys else rsa_keys[-1]
import sys
print('kid=' + rsa_key['kid'], file=sys.stderr)
def b64url_to_int(s):
    s += '=' * (-len(s) % 4); return int.from_bytes(base64.urlsafe_b64decode(s), 'big')
n = b64url_to_int(rsa_key['n']); e = b64url_to_int(rsa_key['e'])
def enc_len(l): return bytes([l]) if l<128 else bytes([0x81,l]) if l<256 else bytes([0x82,l>>8,l&0xFF])
def enc_int(n):
    b=n.to_bytes((n.bit_length()+7)//8,'big'); b=(b'\x00'+b if b[0]&0x80 else b)
    return b'\x02'+enc_len(len(b))+b
rsa=b'\x30'+enc_len(len(enc_int(n)+enc_int(e)))+enc_int(n)+enc_int(e)
oid=b'\x30\x0d\x06\x09\x2a\x86\x48\x86\xf7\x0d\x01\x01\x01\x05\x00'
bs=b'\x03'+enc_len(len(rsa)+1)+b'\x00'+rsa; spki=b'\x30'+enc_len(len(oid)+len(bs))+oid+bs
b64=base64.b64encode(spki).decode()
print('-----BEGIN PUBLIC KEY-----\n'+'\n'.join(b64[i:i+64]for i in range(0,len(b64),64))+'\n-----END PUBLIC KEY-----')
" 2>/dev/null)

[ -z "$PEM_KEY" ] && { echo "❌ Could not fetch new public key from Keycloak JWKS"; exit 1; }
echo "  → New public key extracted (${#PEM_KEY} chars)"

# ── Delete old JWT credentials, register new key ───────────────────────
ISSUER="$KC_BASE/realms/$REALM"
echo "🔁 Rotating JWT credential on Kong consumer 'keycloak-users'..."

EXISTING_IDS=$(curl -sf "$KONG_ADMIN/consumers/keycloak-users/jwt" \
  | grep -o '"id":"[^"]*"' | cut -d'"' -f4 || true)
for cid in $EXISTING_IDS; do
  curl -sf -X DELETE "$KONG_ADMIN/consumers/keycloak-users/jwt/$cid" \
    && echo "  → deleted old credential $cid"
done

PEM_JSON=$("$PYTHON" -c 'import json,sys; print(json.dumps(sys.stdin.read()))' <<< "$PEM_KEY")
curl -sf -X POST "$KONG_ADMIN/consumers/keycloak-users/jwt" \
  -H "Content-Type: application/json" \
  -d "{\"algorithm\":\"RS256\",\"key\":\"$ISSUER\",\"rsa_public_key\":$PEM_JSON}" \
  | grep -o '"id":"[^"]*"' | head -1 | xargs -I{} echo "  → new credential: {}"

echo ""
echo "✅ JWKS rotation complete. Kong is now using the new Keycloak signing key."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  NOTE: To automate this, configure a Keycloak Event Listener SPI"
echo "  that fires on KEY_ROTATION events and calls this script."
echo "  See: docs/auth-release-tech-stack-update.md §1.4"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
