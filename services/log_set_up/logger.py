from pathlib import Path
import logging
import os
_LOG_DIR = Path(__file__).resolve().parent.parent.parent / "logs"
_LOG_DIR.mkdir(parents=True, exist_ok=True)

def create_logger(logger_name: str, file_name: str) -> logging.Logger:
    log = logging.getLogger(logger_name)
    log.setLevel(logging.INFO)

    if not log.handlers:
        _fmt = logging.Formatter(
            fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        _file_handler = logging.FileHandler(_LOG_DIR / f"{file_name}.log")
        _file_handler.setFormatter(_fmt)
        _stream_handler = logging.StreamHandler()
        _stream_handler.setFormatter(_fmt)
        log.addHandler(_file_handler)
        log.addHandler(_stream_handler)
        log.propagate = False

    return log