import os
import json
import time
import requests
from typing import Dict, Any, Optional
from pathlib import Path
from urllib.parse import urlencode
from ytmusicapi.auth.oauth.credentials import OAuthCredentials

OAUTH_FILEPATH = Path(__file__).parent.parent.parent / "oauth.json"

class AuthService:
    def __init__(self):
        # We assume local development for now, but this should be configurable
        self.redirect_uri = os.environ.get("OAUTH_REDIRECT_URI", "http://localhost:8000/api/auth/callback")

    def is_authenticated(self) -> bool:
        return OAUTH_FILEPATH.exists()

    def get_login_url(self) -> str:
        client_id = os.environ.get("YOUTUBE_CLIENT_ID")
        if not client_id:
            raise ValueError("MISSING_CREDENTIALS")

        params = {
            "client_id": client_id,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
            "scope": "https://www.googleapis.com/auth/youtube",
            "access_type": "offline",
            "prompt": "consent" # Force consent to ensure we get a refresh token
        }

        url = f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"
        return url

    def exchange_code(self, code: str) -> Dict[str, Any]:
        client_id = os.environ.get("YOUTUBE_CLIENT_ID")
        client_secret = os.environ.get("YOUTUBE_CLIENT_SECRET")

        if not client_id or not client_secret:
            raise ValueError("MISSING_CREDENTIALS")

        token_url = "https://oauth2.googleapis.com/token"
        data = {
            "code": code,
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": self.redirect_uri,
            "grant_type": "authorization_code"
        }

        res = requests.post(token_url, data=data)
        if not res.ok:
            raise ValueError(f"Token exchange failed: {res.text}")

        token_data = res.json()

        # Format for ytmusicapi
        expires_in = token_data.get("expires_in", 3599)
        yt_token_data = {
            "access_token": token_data["access_token"],
            "refresh_token": token_data.get("refresh_token", ""), # If they already authorized, Google might omit this without prompt=consent
            "expires_in": expires_in,
            "expires_at": int(time.time()) + expires_in,
            "token_type": token_data.get("token_type", "Bearer"),
            "client_id": client_id,
            "client_secret": client_secret
        }

        with open(OAUTH_FILEPATH, "w") as f:
            json.dump(yt_token_data, f)

        return yt_token_data

    def logout(self) -> Dict[str, str]:
        if OAUTH_FILEPATH.exists():
            OAUTH_FILEPATH.unlink()
        return {"status": "success", "message": "Logged out successfully"}

auth_service = AuthService()
