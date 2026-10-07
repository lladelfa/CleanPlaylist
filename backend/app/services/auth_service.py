from typing import Optional, Dict, Any
import os
import json
from pathlib import Path
from ytmusicapi.auth.oauth.credentials import OAuthCredentials

# Default TV app client ID/Secret for ytmusicapi if we were to use the internal one,
# but ytmusicapi removed defaults recently. We will use the common YT on TV client id.
OAUTH_CLIENT_ID = "861556708454-d6dlm3lhchptglgc5n2scloflh112h2v.apps.googleusercontent.com" # YT TV client ID
OAUTH_CLIENT_SECRET = "qr8ZUSpzuzamSqGYkS82I4-2"

# File to store the token locally
OAUTH_FILEPATH = Path(__file__).parent.parent.parent / "oauth.json"


class AuthService:
    def __init__(self):
        self.credentials = OAuthCredentials(client_id=OAUTH_CLIENT_ID, client_secret=OAUTH_CLIENT_SECRET)
        self._pending_auths = {}

    def is_authenticated(self) -> bool:
        return OAUTH_FILEPATH.exists()

    def start_oauth_flow(self) -> Dict[str, Any]:
        """Gets a device code and verification URL for the user."""
        code = self.credentials.get_code()
        # Save device_code in memory so we can check it later
        user_code = code['user_code']
        self._pending_auths[user_code] = code
        return {
            "verification_url": code['verification_url'],
            "user_code": user_code,
            "expires_in": code['expires_in'],
            "interval": code['interval']
        }

    def check_oauth_status(self, user_code: str) -> Dict[str, Any]:
        """Polls to see if the user has completed the flow."""
        if user_code not in self._pending_auths:
            return {"status": "error", "message": "Invalid or expired session"}

        code_data = self._pending_auths[user_code]
        try:
            raw_token = self.credentials.token_from_code(code_data["device_code"])

            # If successful, save to file
            refresh_token_expires_in = raw_token.get("refresh_token_expires_in", raw_token["expires_in"])

            # Format expected by YTMusic
            token_data = {
                "access_token": raw_token["access_token"],
                "refresh_token": raw_token["refresh_token"],
                "scope": raw_token["scope"],
                "token_type": raw_token["token_type"],
                "expires_in": refresh_token_expires_in,
                "client_id": OAUTH_CLIENT_ID,
                "client_secret": OAUTH_CLIENT_SECRET
            }

            with open(OAUTH_FILEPATH, "w") as f:
                json.dump(token_data, f)

            del self._pending_auths[user_code]
            return {"status": "success", "message": "Authentication successful"}

        except Exception as e:
            err_msg = str(e)
            if "authorization_pending" in err_msg:
                return {"status": "pending", "message": "Waiting for user authorization"}
            elif "expired_token" in err_msg:
                del self._pending_auths[user_code]
                return {"status": "error", "message": "Verification code expired"}
            else:
                return {"status": "error", "message": f"Auth error: {err_msg}"}

auth_service = AuthService()
