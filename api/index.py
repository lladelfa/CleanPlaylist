"""Vercel Serverless Function entrypoint for the CleanPlaylist FastAPI backend."""

import sys
from pathlib import Path

# Add the backend directory to sys.path so `app.*` imports resolve cleanly
BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.main import app  # noqa: E402, F401

