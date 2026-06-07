#!/usr/bin/env bash
# Verify Kong admin API is no longer reachable from places it shouldn't be.
#
# Run AFTER `docker compose up -d` and `bash infra/kong/kong-setup.sh`.
# Expected exit code: 0 if hardened correctly, non-zero if any check fails.
#
# Checks:
#   1. Host cannot reach admin on the removed port 8900           → CONNECT FAIL
#   2. A container on default network (workflow-runtime) cannot
#      reach kong-admin-net IP                                    → CONNECT FAIL
#   3. A container on kong-admin-net (auth-api) CAN reach admin   → 200
#
# Failure of (1) or (2) = security regression. Failure of (3) = stack broken,
# admin is unreachable even to the services that need it.

set -u

GREEN='\033[0;32m'
RED='\033[0;31m'
RESET='\033[0m'
PASS=0
FAIL=0

check_fail() {
    local label="$1"
    shift
    if "$@" > /dev/null 2>&1; then
        echo -e "${RED}✗${RESET} $label — admin REACHABLE (regression)"
        FAIL=$((FAIL + 1))
    else
        echo -e "${GREEN}✓${RESET} $label — connection refused (expected)"
        PASS=$((PASS + 1))
    fi
}

check_pass() {
    local label="$1"
    shift
    if "$@" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${RESET} $label — admin reachable (expected)"
        PASS=$((PASS + 1))
    else
        echo -e "${RED}✗${RESET} $label — admin UNREACHABLE (stack broken)"
        FAIL=$((FAIL + 1))
    fi
}

echo "── Kong admin API isolation verification ──"
echo

# 1. From host: the old port 8900 must NOT respond.
check_fail \
    "Host cannot reach legacy admin port :8900" \
    curl -sf --max-time 3 "http://localhost:8900/status"

# 2. From a default-net container that should NOT have admin access.
#    workflow-runtime is on default net only; admin-net IP 172.30.0.10 must
#    be unrouteable from it.
if docker ps --format '{{.Names}}' | grep -q '^dataagent-workflow-runtime$'; then
    check_fail \
        "workflow-runtime (default net only) cannot reach 172.30.0.10:8001" \
        docker exec dataagent-workflow-runtime \
            curl -sf --max-time 3 "http://172.30.0.10:8001/status"
else
    echo "  ↷ workflow-runtime not running; skipped default-net check"
fi

# 3. From auth-api (admin-net) the admin MUST be reachable.
if docker ps --format '{{.Names}}' | grep -q '^dataagent-auth-api$'; then
    check_pass \
        "auth-api (admin-net) can reach 172.30.0.10:8001/status" \
        docker exec dataagent-auth-api \
            curl -sf --max-time 3 "http://172.30.0.10:8001/status"
else
    echo "  ↷ auth-api not running; skipped admin-net check"
fi

echo
echo "── Result: $PASS passed, $FAIL failed ──"
exit $FAIL
