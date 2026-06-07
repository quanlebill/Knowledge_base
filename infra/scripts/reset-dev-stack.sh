#!/usr/bin/env bash
# Reset the dev stack to a known-clean state.
#
# When to use:
#   - "migrate" service fails with "DuplicateTable" / "relation already exists"
#     (Postgres volume has partial schema from a prior failed run)
#   - JAAS or other config files changed and you want a clean re-bootstrap
#   - Generally any time the stack is in an inconsistent state and you want
#     to start over without debugging
#
# WARNING: destroys all dev data — Postgres rows, Keycloak realm changes,
# OpenBao secrets, MinIO buckets, etc. Realm + seed data re-imports on next
# boot, but any post-boot edits are lost.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

CYAN='\033[0;36m'
YELLOW='\033[0;33m'
RESET='\033[0m'

COMPOSE=(docker compose -f docker/docker-compose.yml -f docker/docker-compose.local.yml)

echo -e "${CYAN}── Resetting dev stack ──${RESET}"
echo "This destroys all dev data. Press Ctrl+C in the next 5s to abort."
sleep 5

echo
echo -e "${YELLOW}[1/3] Stopping containers + wiping volumes + removing orphans...${RESET}"
"${COMPOSE[@]}" down -v --remove-orphans

echo
echo -e "${YELLOW}[2/3] Re-bootstrapping .env + JAAS...${RESET}"
bash infra/scripts/bootstrap-dev-env.sh

echo
echo -e "${YELLOW}[3/3] Bringing stack back up...${RESET}"
"${COMPOSE[@]}" up -d --build

echo
echo -e "${CYAN}── Dev stack reset ──${RESET}"
echo "Wait ~2-3 min for all healthchecks, then:"
echo "  ${COMPOSE[*]} ps"
