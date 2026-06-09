"""Sanity check — verifies pytest, marker enforcement, and import path work.

Delete this file once the first real unit test lands.
"""
import pytest


@pytest.mark.unit
def test_imports_repo_root() -> None:
    """The repo root must be importable so tests can reach `services/`, `app/`, etc."""
    import pathlib
    repo_root = pathlib.Path(__file__).resolve().parents[2]
    assert (repo_root / "pyproject.toml").exists(), "Test runner lost repo root"


@pytest.mark.unit
def test_marker_required_pattern_works() -> None:
    """If this passes, the unit marker is being recognized."""
    assert True
