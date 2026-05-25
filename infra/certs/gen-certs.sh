#!/usr/bin/env bash
# ─── mTLS Certificate Generator ──────────────────────────────────────
# Generates a self-signed CA + Kong client cert for Kong → Backend mTLS.
# Kong presents this client cert on every upstream request.
# Backend validates it against ca.crt to ensure requests come from Kong.
#
# Usage:
#   bash infra/certs/gen-certs.sh
#
# Output (git-ignored):
#   infra/certs/ca.crt          ← CA cert (share with backend)
#   infra/certs/kong-client.crt ← Kong's client cert
#   infra/certs/kong-client.key ← Kong's client key (keep secret)
#   infra/certs/backend.crt     ← Placeholder backend server cert
#   infra/certs/backend.key     ← Placeholder backend server key

set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

command -v openssl > /dev/null || { echo "❌ openssl not found"; exit 1; }

echo "🔑 Generating mTLS certificates for AeroFlow..."

# ── CA ─────────────────────────────────────────────────────────────────
openssl genrsa -out ca.key 4096 2>/dev/null
openssl req -new -x509 -days 3650 -key ca.key -out ca.crt \
  -subj "/CN=AeroFlow-CA/O=AeroFlow/C=VN" 2>/dev/null
echo "  → CA:            ca.crt (valid 10 years)"

# ── Kong client cert ───────────────────────────────────────────────────
openssl genrsa -out kong-client.key 2048 2>/dev/null
openssl req -new -key kong-client.key -out kong-client.csr \
  -subj "/CN=kong-gateway/O=AeroFlow/C=VN" 2>/dev/null
openssl x509 -req -days 825 -in kong-client.csr \
  -CA ca.crt -CAkey ca.key -CAcreateserial \
  -out kong-client.crt 2>/dev/null
rm -f kong-client.csr ca.srl
echo "  → Kong client:   kong-client.crt / kong-client.key"

# ── Backend server cert (placeholder for when backend service exists) ──
openssl genrsa -out backend.key 2048 2>/dev/null
openssl req -new -key backend.key -out backend.csr \
  -subj "/CN=aeroflow-backend/O=AeroFlow/C=VN" 2>/dev/null
openssl x509 -req -days 825 -in backend.csr \
  -CA ca.crt -CAkey ca.key -CAcreateserial \
  -out backend.crt 2>/dev/null
rm -f backend.csr ca.srl 2>/dev/null || true
echo "  → Backend server: backend.crt / backend.key (placeholder)"

# ── Verify chain ───────────────────────────────────────────────────────
openssl verify -CAfile ca.crt kong-client.crt > /dev/null && \
  echo "  → Chain verified: kong-client.crt ✓"
openssl verify -CAfile ca.crt backend.crt > /dev/null && \
  echo "  → Chain verified: backend.crt ✓"

echo ""
echo "✅ Certificates generated in infra/certs/"
echo ""
echo "Next step — register Kong client cert with Kong Admin API:"
echo "  bash infra/kong/kong-setup.sh"
echo "(kong-setup.sh will pick up infra/certs/kong-client.crt automatically)"
echo ""
echo "⚠️  Keep ca.key and kong-client.key secret — never commit to git."
