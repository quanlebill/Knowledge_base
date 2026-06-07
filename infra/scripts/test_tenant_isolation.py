#!/usr/bin/env python3
"""DEPRECATED — moved to tests/integration/test_tenant_isolation.py.

Run via pytest instead:

    docker compose -f docker/docker-compose.yml -f docker/docker-compose.local.yml up -d
    LIVE_STACK=1 pytest -m e2e tests/integration/test_tenant_isolation.py -v

This shim stays so existing runbooks/CI hooks don't break — it delegates to
the pytest module and preserves the old exit-code contract.
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]


def main() -> int:
    env = os.environ.copy()
    env.setdefault("LIVE_STACK", "1")
    cmd = [
        sys.executable,
        "-m",
        "pytest",
        "-m",
        "e2e",
        "tests/integration/test_tenant_isolation.py",
        "-v",
    ]
    return subprocess.call(cmd, cwd=REPO_ROOT, env=env)


if __name__ == "__main__":
    sys.exit(main())
