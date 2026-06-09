#!/usr/bin/env bash
# Bootstrap dev env files. Idempotent — safe to re-run.
#
# What it does:
#   1. Copies .env.example → .env (skips if .env exists)
#   2. Copies infra/kafka/kafka-broker-jaas.config.example → kafka-broker-jaas.config
#   3. Generates one random Kafka password and substitutes it into BOTH files
#      so KafkaServer JAAS and service env stay in sync (mismatched = auth fails)
#   4. Fills CHANGE_ME / blank required vars with dev defaults
#
# NOT for prod. Prod must use a secrets manager + force-fail on missing vars.
#
# Usage:
#   bash infra/scripts/bootstrap-dev-env.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

GREEN='\033[0;32m'
DGRAY='\033[1;30m'
CYAN='\033[0;36m'
YELLOW='\033[0;33m'
RESET='\033[0m'

rand_pw() { LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 24; }

# ─── 1. .env ───────────────────────────────────────────────────────────────
if [ -f .env ]; then
    echo -e "${GREEN}✓${RESET} .env already exists (left untouched)"
else
    cp .env.example .env
    echo -e "${GREEN}✓${RESET} Created .env from .env.example"
fi

# ─── 2. Kafka JAAS config ──────────────────────────────────────────────────
JAAS=infra/kafka/kafka-broker-jaas.config
if [ -f "$JAAS" ]; then
    echo -e "${GREEN}✓${RESET} kafka-broker-jaas.config already exists (left untouched)"
else
    cp "${JAAS}.example" "$JAAS"
    echo -e "${GREEN}✓${RESET} Created kafka-broker-jaas.config from example"
fi

# ─── 3. Sync Kafka passwords across both files ─────────────────────────────
KAFKA_PW=$(rand_pw)
KAFKA_PLACEHOLDERS=(
    REPLACE_WITH_KAFKA_ADMIN_PASSWORD
    REPLACE_WITH_AUDIT_BRIDGE_PASSWORD
    REPLACE_WITH_AUDIT_CONSUMER_PASSWORD
    REPLACE_WITH_CI_SERVICE_PASSWORD
    REPLACE_WITH_RELEASE_WORKER_PASSWORD
    REPLACE_WITH_DRIFT_DETECTOR_PASSWORD
    REPLACE_WITH_SCAN_RUNNER_PASSWORD
    REPLACE_WITH_NOTIFICATION_CONSUMER_PASSWORD
)
jaas_updated=0
for ph in "${KAFKA_PLACEHOLDERS[@]}"; do
    if grep -q "$ph" "$JAAS"; then
        sed -i.bak "s/$ph/$KAFKA_PW/g" "$JAAS"
        jaas_updated=1
    fi
done
rm -f "${JAAS}.bak"
if [ "$jaas_updated" = "1" ]; then
    echo -e "${GREEN}✓${RESET} Substituted Kafka passwords in kafka-broker-jaas.config"
else
    echo -e "${DGRAY}↷${RESET} Kafka JAAS already has real passwords (no placeholders found)"
fi

# ─── 4. Fill .env required vars with dev defaults ──────────────────────────
LANGFUSE_SECRET=$(rand_pw)
LANGFUSE_SALT=$(rand_pw)

declare -A DEFAULTS=(
    [POSTGRES_PASSWORD]=dev123
    [RUNTIME_DB_PASSWORD]=runtime_dev_pw
    [KEYCLOAK_ADMIN_PASSWORD]=admin
    [MINIO_ROOT_PASSWORD]=minio_secret
    [KAFKA_ADMIN_PASSWORD]=$KAFKA_PW
    [AUDIT_BRIDGE_KAFKA_PASSWORD]=$KAFKA_PW
    [AUDIT_CONSUMER_KAFKA_PASSWORD]=$KAFKA_PW
    [RELEASE_WORKER_KAFKA_PASSWORD]=$KAFKA_PW
    [CI_SERVICE_KAFKA_PASSWORD]=$KAFKA_PW
    [DRIFT_DETECTOR_KAFKA_PASSWORD]=$KAFKA_PW
    [SCAN_RUNNER_KAFKA_PASSWORD]=$KAFKA_PW
    [NOTIFICATION_CONSUMER_KAFKA_PASSWORD]=$KAFKA_PW
    [LANGFUSE_NEXTAUTH_SECRET]=$LANGFUSE_SECRET
    [LANGFUSE_SALT]=$LANGFUSE_SALT
    [LANGFUSE_INIT_PASSWORD]=admin123
)

count=0
for key in "${!DEFAULTS[@]}"; do
    if grep -qE "^${key}=(CHANGE_ME)?$" .env || grep -qE "^${key}=$" .env; then
        sed -i.bak "s|^${key}=.*|${key}=${DEFAULTS[$key]}|" .env
        count=$((count + 1))
    fi
done
rm -f .env.bak
if [ "$count" -gt 0 ]; then
    echo -e "${GREEN}✓${RESET} Filled $count required env vars in .env with dev defaults"
else
    echo -e "${DGRAY}↷${RESET} All required env vars in .env already set"
fi

echo
echo -e "${CYAN}── Dev env ready ──${RESET}"
echo "Next: docker compose -f docker/docker-compose.yml -f docker/docker-compose.local.yml up -d --build"
echo
echo -e "${YELLOW}Optional LLM keys (must be added by hand if you want LiteLLM-backed agents):${RESET}"
echo "  OPENAI_API_KEY, GEMINI_API_KEY, LLM_API_KEY"
