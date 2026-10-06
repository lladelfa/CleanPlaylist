"""One-click launcher for CleanPlaylist."""

import os
import sys
import webbrowser
from pathlib import Path

# Ensure UTF-8 output encoding on Windows consoles
if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Add backend directory to sys.path
BASE_DIR = Path(__file__).resolve().parent
BACKEND_DIR = BASE_DIR / "backend"
sys.path.insert(0, str(BACKEND_DIR))

if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "127.0.0.1")
    url = f"http://{host}:{port}"

    print("=" * 60)
    print("CleanPlaylist Web Application Starting...")
    print(f"Accessible at: {url}")
    print("=" * 60)

    # Open browser automatically if running locally
    if host in ("127.0.0.1", "localhost") and not os.environ.get("NO_BROWSER"):
        try:
            webbrowser.open(url)
        except Exception:
            pass

    uvicorn.run("app.main:app", host=host, port=port, reload=False)
