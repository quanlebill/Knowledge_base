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
#   powershell -ExecutionPolicy Bypass -File infra/scripts/bootstrap-dev-env.ps1
# or, if execution policy already allows scripts:
#   .\infra\scripts\bootstrap-dev-env.ps1

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "../..")
Set-Location $repoRoot

function New-RandomPassword {
    -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 24 | ForEach-Object { [char]$_ })
}

# UTF-8 without BOM. PS 5.1's `Set-Content -Encoding utf8` writes WITH BOM,
# which breaks parsers that don't expect it (Java JAAS, some Linux tools).
# Always go through these helpers for files non-PowerShell tools will read.
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Read-Utf8File($path) {
    $bytes = [System.IO.File]::ReadAllBytes((Resolve-Path $path).Path)
    $content = $Utf8NoBom.GetString($bytes)
    # Strip UTF-8 BOM if present. UTF8Encoding($false) only controls BOM on
    # WRITE; decoding bytes that contain a BOM leaves the U+FEFF char in
    # the string. docker compose, .env parsers, etc. don't recognize it and
    # treat the BOM line as garbage — every env var loaded from that .env
    # ends up "not set". Bit me on the dev session 2026-06-07.
    if ($content.Length -gt 0 -and $content[0] -eq [char]0xFEFF) {
        $content = $content.Substring(1)
    }
    return $content
}

function Write-Utf8FileNoBom($path, $content) {
    $resolved = if (Test-Path $path) { (Resolve-Path $path).Path } else {
        Join-Path (Resolve-Path (Split-Path -Parent $path)).Path (Split-Path -Leaf $path)
    }
    [System.IO.File]::WriteAllText($resolved, $content, $Utf8NoBom)
}

# ─── 1. .env ───────────────────────────────────────────────────────────────
$envFile = ".env"
if (Test-Path $envFile) {
    Write-Host "[OK].env already exists (left untouched)" -ForegroundColor Green
} else {
    Copy-Item ".env.example" $envFile
    Write-Host "[OK]Created .env from .env.example" -ForegroundColor Green
}

# ─── 2. Kafka JAAS config ──────────────────────────────────────────────────
$jaasFile = "infra/kafka/kafka-broker-jaas.config"
$jaasExample = "infra/kafka/kafka-broker-jaas.config.example"
if (Test-Path $jaasFile) {
    Write-Host "[OK]kafka-broker-jaas.config already exists (left untouched)" -ForegroundColor Green
} else {
    Copy-Item $jaasExample $jaasFile
    Write-Host "[OK]Created kafka-broker-jaas.config from example" -ForegroundColor Green
}

# ─── 3. Sync Kafka passwords across both files ─────────────────────────────
# All services share one password in dev. Prod must give each its own.
$kafkaPw = New-RandomPassword
$kafkaPlaceholders = @(
    "REPLACE_WITH_KAFKA_ADMIN_PASSWORD",
    "REPLACE_WITH_AUDIT_BRIDGE_PASSWORD",
    "REPLACE_WITH_AUDIT_CONSUMER_PASSWORD",
    "REPLACE_WITH_CI_SERVICE_PASSWORD",
    "REPLACE_WITH_RELEASE_WORKER_PASSWORD",
    "REPLACE_WITH_DRIFT_DETECTOR_PASSWORD",
    "REPLACE_WITH_SCAN_RUNNER_PASSWORD",
    "REPLACE_WITH_NOTIFICATION_CONSUMER_PASSWORD"
)

$jaasContent = Read-Utf8File $jaasFile
$jaasUpdated = $false
foreach ($placeholder in $kafkaPlaceholders) {
    if ($jaasContent -match $placeholder) {
        $jaasContent = $jaasContent -replace $placeholder, $kafkaPw
        $jaasUpdated = $true
    }
}
if ($jaasUpdated) {
    Write-Utf8FileNoBom $jaasFile $jaasContent
    Write-Host "[OK]Substituted Kafka passwords in kafka-broker-jaas.config" -ForegroundColor Green
} else {
    Write-Host "[--]Kafka JAAS already has real passwords (no placeholders found)" -ForegroundColor DarkGray
}

# ─── 4. Fill .env required vars with dev defaults ──────────────────────────
$envVars = @{
    "POSTGRES_PASSWORD"                  = "dev123"
    "RUNTIME_DB_PASSWORD"                = "runtime_dev_pw"
    "KEYCLOAK_ADMIN_PASSWORD"            = "admin"
    "MINIO_ROOT_PASSWORD"                = "minio_secret"
    "KAFKA_ADMIN_PASSWORD"               = $kafkaPw
    "AUDIT_BRIDGE_KAFKA_PASSWORD"        = $kafkaPw
    "AUDIT_CONSUMER_KAFKA_PASSWORD"      = $kafkaPw
    "RELEASE_WORKER_KAFKA_PASSWORD"      = $kafkaPw
    "CI_SERVICE_KAFKA_PASSWORD"          = $kafkaPw
    "DRIFT_DETECTOR_KAFKA_PASSWORD"      = $kafkaPw
    "SCAN_RUNNER_KAFKA_PASSWORD"         = $kafkaPw
    "NOTIFICATION_CONSUMER_KAFKA_PASSWORD" = $kafkaPw
    "LANGFUSE_NEXTAUTH_SECRET"           = (New-RandomPassword)
    "LANGFUSE_SALT"                      = (New-RandomPassword)
    "LANGFUSE_INIT_PASSWORD"             = "admin123"
}

$envContent = (Read-Utf8File $envFile) -split "`r?`n"
$envOutput = @()
$replacedKeys = @{}

foreach ($line in $envContent) {
    $replaced = $false
    foreach ($key in $envVars.Keys) {
        # Match KEY= (blank value) or KEY=CHANGE_ME or KEY=
        if ($line -match "^$key=(CHANGE_ME)?\s*$") {
            $envOutput += "$key=$($envVars[$key])"
            $replacedKeys[$key] = $true
            $replaced = $true
            break
        }
    }
    if (-not $replaced) {
        $envOutput += $line
    }
}

Write-Utf8FileNoBom $envFile ($envOutput -join "`n")
$count = $replacedKeys.Keys.Count
if ($count -gt 0) {
    Write-Host "[OK]Filled $count required env vars in .env with dev defaults" -ForegroundColor Green
} else {
    Write-Host "[--]All required env vars in .env already set" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "--- Dev env ready ---" -ForegroundColor Cyan
Write-Host "Next: docker compose -f docker/docker-compose.yml -f docker/docker-compose.local.yml up -d --build"
Write-Host ""
Write-Host "Optional LLM keys (must be added by hand if you want LiteLLM-backed agents):" -ForegroundColor DarkYellow
Write-Host "  OPENAI_API_KEY, GEMINI_API_KEY, LLM_API_KEY"
