import sys
import os
import logging
from pathlib import Path
from pprint import pprint

# Ensure we can import app modules
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

from app.services.auth_service import auth_service, OAUTH_FILEPATH
from app.services.ytmusic_service import ytmusic_service
from ytmusicapi import YTMusic
from ytmusicapi.auth.oauth.credentials import OAuthCredentials

def run_diagnostics():
    print("="*60)
    print("CleanPlaylist YTMusic Diagnostics Tool")
    print("="*60)

    if not auth_service.is_authenticated():
        print("ERROR: Not authenticated. Please complete the OAuth flow in the browser first.")
        print(f"Looked for oauth.json at: {OAUTH_FILEPATH}")
        return

    print(f"1. Loading credentials from {OAUTH_FILEPATH}...")
    try:
        # Initialize YTMusic exactly as the backend does
        client_id = os.environ.get("YOUTUBE_CLIENT_ID")
        client_secret = os.environ.get("YOUTUBE_CLIENT_SECRET")
        creds = OAuthCredentials(client_id=client_id, client_secret=client_secret)
        yt = YTMusic(str(OAUTH_FILEPATH), oauth_credentials=creds)
        print("   ✅ YTMusic instantiated successfully.")
    except Exception as e:
        print(f"   ❌ FAILED to initialize YTMusic: {e}")
        return

    print("\n2. Checking Account Information...")
    try:
        # Try to fetch standard library info to see if auth works at all
        playlists = yt.get_library_playlists(limit=2)
        print("   ✅ Fetched library playlists. You are authenticated as an account with playlists:")
        for p in playlists:
            print(f"      - {p.get('title')} (ID: {p.get('playlistId')})")
    except Exception as e:
        print(f"   ❌ FAILED to fetch library. OAuth token might be invalid or missing scopes: {e}")

    print("\n3. Attempting to fetch the target playlist (PL_Ww9laJ7MAyx7BqI_QIgEhA4iuHJ1wIl)...")
    try:
        # We want to catch the specific 400 Bad Request and print the ytmusicapi request payload
        # To do this cleanly, we'll patch the _send_request method temporarily
        original_send_request = yt._send_request

        def patched_send_request(endpoint, body, additionalParams=""):
            print(f"   [API Request] Endpoint: {endpoint}")
            print(f"   [API Request] Body: {body}")
            try:
                response = original_send_request(endpoint, body, additionalParams)
                print(f"   ✅ [API Response] Success. Keys returned: {list(response.keys())}")
                return response
            except Exception as inner_e:
                print(f"   ❌ [API Error]: {inner_e}")
                raise inner_e

        yt._send_request = patched_send_request

        playlist_data = yt.get_playlist("PL_Ww9laJ7MAyx7BqI_QIgEhA4iuHJ1wIl")
        print(f"   ✅ Successfully loaded playlist: {playlist_data.get('title')}")

    except Exception as e:
        print("\n=== DIAGNOSTIC FAILURE ===")
        print(f"Failed to fetch playlist: {e}")
        print("Please copy this entire output and send it back to me!")

if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv(BASE_DIR / ".env")
    run_diagnostics()
