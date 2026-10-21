from typing import Optional, Dict, Any
import os
import json
from pathlib import Path
import ytmusicapi

OAUTH_FILEPATH = Path(__file__).parent.parent.parent / "browser.json"

class AuthService:
    def is_authenticated(self) -> bool:
        return OAUTH_FILEPATH.exists()

    def process_headers(self, headers_raw: str) -> Dict[str, Any]:
        """Takes raw headers from the browser and generates a valid browser.json"""
        try:
            # ytmusicapi 1.12.3 has a bug where if the `authorization` header is omitted by the user,
            # `determine_auth_type` incorrectly defaults to OAUTH_CUSTOM_CLIENT instead of BROWSER,
            # causing the client to crash on initialization. We inject a dummy SAPISIDHASH header
            # to force AuthType.BROWSER. (YTMusic will overwrite this with the real hash from cookies later).
            if "authorization:" not in headers_raw.lower():
                headers_raw += "\nauthorization: SAPISIDHASH dummy"

            # ytmusicapi.setup parses the raw headers string into the json format it expects
            # and returns the JSON string. If filepath is provided, it saves it.
            ytmusicapi.setup(filepath=str(OAUTH_FILEPATH), headers_raw=headers_raw)
            return {"status": "success", "message": "Successfully authenticated with browser headers."}
        except Exception as e:
            return {"status": "error", "message": f"Failed to parse headers: {str(e)}"}

    def logout(self) -> Dict[str, str]:
        if OAUTH_FILEPATH.exists():
            OAUTH_FILEPATH.unlink()
        return {"status": "success", "message": "Logged out successfully"}

auth_service = AuthService()
