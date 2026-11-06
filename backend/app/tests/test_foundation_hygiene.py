"""Tests for project foundation and dependency hygiene (Story 1.1)."""

from pathlib import Path
import sys
import app.services.scanner_service as scanner_module
from app.services.scanner_service import ScannerService


REPO_ROOT = Path(__file__).resolve().parents[3]


def test_python_version_pinned_to_3_13():
    python_version_file = REPO_ROOT / ".python-version"
    assert python_version_file.exists(), ".python-version file must exist at repo root"
    content = python_version_file.read_text(encoding="utf-8").strip()
    assert content.startswith("3.13"), f"Expected 3.13 in .python-version, got '{content}'"


def test_requirements_hygiene_and_sync():
    root_req_path = REPO_ROOT / "requirements.txt"
    backend_req_path = REPO_ROOT / "backend" / "requirements.txt"

    assert root_req_path.exists(), "Root requirements.txt must exist"
    assert backend_req_path.exists(), "backend/requirements.txt must exist"

    root_reqs = [
        line.strip()
        for line in root_req_path.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.strip().startswith("#")
    ]
    backend_reqs = [
        line.strip()
        for line in backend_req_path.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.strip().startswith("#")
    ]

    # better-profanity must be pruned from both
    assert not any("better-profanity" in r for r in root_reqs), "better-profanity found in root requirements.txt"
    assert not any("better-profanity" in r for r in backend_reqs), "better-profanity found in backend/requirements.txt"

    # pytest>=8.0.2 in backend requirements
    assert any(r.startswith("pytest>=8.0.2") for r in backend_reqs), "backend/requirements.txt must specify pytest>=8.0.2"

    # All root requirements (runtime packages) must be present in backend/requirements.txt
    for req in root_reqs:
        assert req in backend_reqs, f"Runtime requirement '{req}' missing from backend/requirements.txt"


def test_scanner_service_no_better_profanity():
    # Verify module does not import profanity
    assert not hasattr(scanner_module, "profanity"), "profanity should not be imported in scanner_service"

    # Verify ScannerService functions
    service = ScannerService()
    clean_result = service.scan_lyrics("clean text here", preset="moderate")
    assert clean_result["is_flagged"] is False
    assert clean_result["total_flagged_count"] == 0

    flagged_result = service.scan_lyrics("This has fuck in it", preset="moderate")
    assert flagged_result["is_flagged"] is True
    assert flagged_result["total_flagged_count"] >= 1
