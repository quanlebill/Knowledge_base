from __future__ import annotations

import logging
import os
from pathlib import Path

_LOG_DIR = Path(__file__).resolve().parent / "logs"
_LOG_DIR.mkdir(parents=True, exist_ok=True)

_FMT = logging.Formatter(
    fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)


def get_logger(name: str) -> logging.Logger:
    log = logging.getLogger(name)
    if log.handlers:
        return log
    log.setLevel(logging.DEBUG if os.getenv("VERBOSE", "false").lower() == "true" else logging.INFO)
    sh = logging.StreamHandler()
    sh.setFormatter(_FMT)
    fh = logging.FileHandler(_LOG_DIR / f"{name}.log")
    fh.setFormatter(_FMT)
    log.addHandler(sh)
    log.addHandler(fh)
    log.propagate = False
    return log
