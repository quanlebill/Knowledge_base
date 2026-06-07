# Reset the dev stack to a known-clean state.
#
# When to use:
#   - "migrate" service fails with "DuplicateTable" / "relation already exists"
#     (Postgres volume has partial schema from a prior failed run)
#   - JAAS or other config files changed and you want a clean re-bootstrap
#   - Generally any time the stack is in an inconsistent state and you want
#     to start over without debugging
#
# What it does:
#   1. `docker compose down -v --remove-orphans` — stops everything, wipes
#      ALL named volumes (postgres_data, postgres_backups, redis_data, etc.)
#      and removes orphan containers (e.g. services no longer in compose)
#   2. Re-runs the bootstrap script to refresh .env + JAAS
#   3. `docker compose up -d --build`
#
# WARNING: destroys all dev data — Postgres rows, Keycloak realm changes
# made via the admin UI, OpenBao secrets, MinIO buckets, etc. Realm + seed
# data re-imports on next boot, but any post-boot edits are lost.

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "../..")
Set-Location $repoRoot

$ComposeArgs = @(
    "-f", "docker/docker-compose.yml",
    "-f", "docker/docker-compose.local.yml"
)

Write-Host "── Resetting dev stack ──" -ForegroundColor Cyan
Write-Host "This destroys all dev data. Press Ctrl+C in the next 5s to abort."
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "[1/3] Stopping containers + wiping volumes + removing orphans..." -ForegroundColor Yellow
& docker compose @ComposeArgs down -v --remove-orphans

Write-Host ""
Write-Host "[2/3] Re-bootstrapping .env + JAAS..." -ForegroundColor Yellow
& powershell -ExecutionPolicy Bypass -File infra/scripts/bootstrap-dev-env.ps1

Write-Host ""
Write-Host "[3/3] Bringing stack back up..." -ForegroundColor Yellow
& docker compose @ComposeArgs up -d --build

Write-Host ""
Write-Host "── Dev stack reset ──" -ForegroundColor Cyan
Write-Host "Wait ~2-3 min for all healthchecks, then:"
Write-Host "  docker compose @ComposeArgs ps"
