from typing import Optional, Dict, Any
import os
import json
from pathlib import Path
from ytmusicapi.auth.oauth.credentials import OAuthCredentials

# File to store the token locally
OAUTH_FILEPATH = Path(__file__).parent.parent.parent / "oauth.json"

class AuthService:
    def __init__(self):
        self._pending_auths = {}

    def is_authenticated(self) -> bool:
        return OAUTH_FILEPATH.exists()

    def _get_credentials(self):
        # ytmusicapi requires users to provide their own client ID and secret now
        client_id = os.environ.get("YOUTUBE_CLIENT_ID")
        client_secret = os.environ.get("YOUTUBE_CLIENT_SECRET")

        if not client_id or not client_secret:
            raise ValueError("MISSING_CREDENTIALS")

        return OAuthCredentials(client_id=client_id, client_secret=client_secret)

    def start_oauth_flow(self) -> Dict[str, Any]:
        """Gets a device code and verification URL for the user."""
        try:
            creds = self._get_credentials()
            code = creds.get_code()
        except ValueError as ve:
            if str(ve) == "MISSING_CREDENTIALS":
                return {"status": "error", "code": "MISSING_CREDENTIALS", "message": "Please configure your Google Cloud OAuth credentials in the .env file."}
            raise ve

        # Save device_code in memory so we can check it later
        user_code = code['user_code']
        self._pending_auths[user_code] = {
            "device_code": code["device_code"],
            "client_id": os.environ.get("YOUTUBE_CLIENT_ID"),
            "client_secret": os.environ.get("YOUTUBE_CLIENT_SECRET")
        }

        return {
            "status": "success",
            "verification_url": code['verification_url'],
            "user_code": user_code,
            "expires_in": code['expires_in'],
            "interval": code['interval']
        }

    def check_oauth_status(self, user_code: str) -> Dict[str, Any]:
        """Polls to see if the user has completed the flow."""
        if user_code not in self._pending_auths:
            return {"status": "error", "message": "Invalid or expired session"}

        auth_data = self._pending_auths[user_code]
        creds = OAuthCredentials(client_id=auth_data["client_id"], client_secret=auth_data["client_secret"])

        try:
            raw_token = creds.token_from_code(auth_data["device_code"])

            # If successful, save to file
            refresh_token_expires_in = raw_token.get("refresh_token_expires_in", raw_token["expires_in"])

            # Format expected by YTMusic
            token_data = {
                "access_token": raw_token["access_token"],
                "refresh_token": raw_token["refresh_token"],
                "scope": raw_token["scope"],
                "token_type": raw_token["token_type"],
                "expires_in": refresh_token_expires_in,
                "client_id": auth_data["client_id"],
                "client_secret": auth_data["client_secret"]
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
