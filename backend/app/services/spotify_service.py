import os
import json
import time
import hmac
import hashlib
import base64
import zlib
from typing import Dict, List, Optional
from pathlib import Path
import spotipy
from spotipy.oauth2 import SpotifyOAuth
from spotipy.cache_handler import MemoryCacheHandler
from fastapi import HTTPException, Request, Response

SPOTIFY_TOKEN_CACHE = Path(__file__).parent.parent.parent / ".spotify_caches"
SPOTIFY_SESSION_COOKIE = "cp_spotify_session"
SPOTIFY_SCOPES = "playlist-modify-public playlist-modify-private playlist-read-private playlist-read-collaborative"


def _get_signing_secret() -> bytes:
    """Returns a deterministic secret key across serverless instances."""
    secret = (
        os.environ.get("SESSION_SECRET_KEY")
        or os.environ.get("SPOTIFY_CLIENT_SECRET")
        or "cleanplaylist-local-dev-secret-key"
    )
    return hashlib.sha256(secret.encode("utf-8")).digest()


def encode_session_token(token_info: Dict) -> str:
    """Serializes, compresses, and HMAC-signs minimal Spotify token fields for a cookie."""
    minimal = {
        "access_token": token_info.get("access_token"),
        "refresh_token": token_info.get("refresh_token"),
        "expires_at": token_info.get("expires_at"),
        "scope": token_info.get("scope", SPOTIFY_SCOPES),
        "token_type": token_info.get("token_type", "Bearer"),
    }
    raw_bytes = json.dumps(minimal, separators=(",", ":")).encode("utf-8")
    compressed = zlib.compress(raw_bytes)
    b64_payload = base64.urlsafe_b64encode(compressed).decode("ascii").rstrip("=")
    sig = hmac.new(_get_signing_secret(), b64_payload.encode("ascii"), hashlib.sha256).hexdigest()
    return f"{b64_payload}.{sig}"


def decode_session_token(cookie_value: Optional[str]) -> Optional[Dict]:
    """Verifies the HMAC signature and decodes the Spotify token dictionary."""
    if not cookie_value or "." not in cookie_value:
        return None
    try:
        b64_payload, sig = cookie_value.rsplit(".", 1)
        expected_sig = hmac.new(_get_signing_secret(), b64_payload.encode("ascii"), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected_sig):
            return None
        padding = "=" * (-len(b64_payload) % 4)
        compressed = base64.urlsafe_b64decode(b64_payload + padding)
        raw_bytes = zlib.decompress(compressed)
        data = json.loads(raw_bytes.decode("utf-8"))
        if not isinstance(data, dict) or not data.get("access_token"):
            return None
        return data
    except Exception:
        return None


class SpotifyService:
    def __init__(self):
        self._lyrics_cache = {}
        self.sp_oauth: Optional[SpotifyOAuth] = None
        self.sp: Optional[spotipy.Spotify] = None
        self._init_oauth()

    @staticmethod
    def resolve_redirect_uri(request: Optional[Request] = None) -> str:
        """Resolves the Spotify OAuth Redirect URI for local or cloud/Vercel environments."""
        configured = os.environ.get("SPOTIFY_REDIRECT_URI")
        if request is not None:
            forwarded_host = request.headers.get("x-forwarded-host") or request.headers.get("host")
            forwarded_proto = request.headers.get("x-forwarded-proto") or request.url.scheme or "http"
            is_remote_host = forwarded_host and not any(
                local in forwarded_host for local in ("127.0.0.1", "localhost")
            )
            # If deployed to a remote host (like Vercel) and SPOTIFY_REDIRECT_URI is unset or left as localhost
            if is_remote_host and (
                not configured or "127.0.0.1" in configured or "localhost" in configured
            ):
                return f"{forwarded_proto}://{forwarded_host}/api/spotify/callback"
            if not configured and forwarded_host:
                return f"{forwarded_proto}://{forwarded_host}/api/spotify/callback"

        return configured or "http://127.0.0.1:8000/api/spotify/callback"

    def _create_oauth(self, redirect_uri: Optional[str] = None, token_info: Optional[Dict] = None) -> Optional[SpotifyOAuth]:
        client_id = os.environ.get("SPOTIFY_CLIENT_ID")
        client_secret = os.environ.get("SPOTIFY_CLIENT_SECRET")
        resolved_uri = redirect_uri or self.resolve_redirect_uri()

        if client_id and client_secret:
            return SpotifyOAuth(
                client_id=client_id,
                client_secret=client_secret,
                redirect_uri=resolved_uri,
                scope=SPOTIFY_SCOPES,
                cache_handler=MemoryCacheHandler(token_info=token_info),
                show_dialog=True,
                open_browser=False,
            )
        return None

    def _init_oauth(self):
        self.sp_oauth = self._create_oauth()

    def set_session_cookie(self, response: Response, token_info: Dict, request: Optional[Request] = None) -> None:
        is_https = False
        if request is not None:
            proto = request.headers.get("x-forwarded-proto") or request.url.scheme
            is_https = proto == "https"
        encoded = encode_session_token(token_info)
        response.set_cookie(
            key=SPOTIFY_SESSION_COOKIE,
            value=encoded,
            httponly=True,
            secure=is_https,
            samesite="lax",
            max_age=60 * 60 * 24 * 30,  # 30 days
            path="/",
        )

    def clear_session_cookie(self, response: Response) -> None:
        response.delete_cookie(key=SPOTIFY_SESSION_COOKIE, path="/")

    def get_session_token(
        self, request: Optional[Request] = None, response: Optional[Response] = None
    ) -> Optional[Dict]:
        """Reads the user's Spotify token from the signed session cookie and refreshes if expired."""
        if request is None:
            if not self.sp_oauth:
                return None
            return self.sp_oauth.cache_handler.get_cached_token()

        raw_cookie = request.cookies.get(SPOTIFY_SESSION_COOKIE)
        token_info = decode_session_token(raw_cookie)
        if not token_info:
            return None

        oauth = self._create_oauth(
            redirect_uri=self.resolve_redirect_uri(request),
            token_info=token_info,
        )
        if oauth and oauth.is_token_expired(token_info):
            refresh_token = token_info.get("refresh_token")
            if not refresh_token:
                return None
            try:
                token_info = oauth.refresh_access_token(refresh_token)
                if response is not None and token_info:
                    self.set_session_cookie(response, token_info, request)
            except Exception:
                return None

        return token_info

    def is_authenticated(self, request: Optional[Request] = None, response: Optional[Response] = None) -> bool:
        if request is not None:
            return self.get_session_token(request, response) is not None
        if self.sp is not None:
            return True
        if not self.sp_oauth:
            return False
        token_info = self.sp_oauth.cache_handler.get_cached_token()
        return token_info is not None

    def get_login_url(self, request: Optional[Request] = None) -> str:
        redirect_uri = self.resolve_redirect_uri(request)
        oauth = self._create_oauth(redirect_uri=redirect_uri)
        if not oauth:
            raise ValueError("MISSING_CREDENTIALS")
        self.sp_oauth = oauth
        return oauth.get_authorize_url()

    def exchange_code(self, code: str, request: Optional[Request] = None) -> Dict:
        redirect_uri = self.resolve_redirect_uri(request)
        oauth = self._create_oauth(redirect_uri=redirect_uri) or self.sp_oauth
        if not oauth:
            raise ValueError("OAuth not initialized")
        token_info = oauth.get_access_token(code, as_dict=True, check_cache=False)
        if not token_info or not token_info.get("access_token"):
            raise ValueError("Failed to get token from code")
        return token_info

    def logout(self, response: Optional[Response] = None) -> None:
        if response is not None:
            self.clear_session_cookie(response)
        self.sp = None

    @staticmethod
    def extract_playlist_id(url: str) -> str:
        if "spotify.com" in url:
            return url.split("/")[-1].split("?")[0]
        if url.startswith("spotify:playlist:"):
            return url.split(":")[-1]
        return url

    def get_client(
        self, request: Optional[Request] = None, response: Optional[Response] = None
    ) -> spotipy.Spotify:
        if request is not None:
            token_info = self.get_session_token(request, response)
            if token_info and token_info.get("access_token"):
                return spotipy.Spotify(auth=token_info["access_token"])
        if self.sp is not None:
            return self.sp
        raise HTTPException(status_code=401, detail="You must log in to Spotify to perform this action.")

    def _get_client(
        self, request: Optional[Request] = None, response: Optional[Response] = None
    ) -> spotipy.Spotify:
        return self.get_client(request=request, response=response)

    def get_user_playlists(
        self, limit: int = 20, offset: int = 0, sp_client: Optional[spotipy.Spotify] = None
    ) -> Dict:
        sp = sp_client or self._get_client()
        try:
            results = sp.current_user_playlists(limit=limit, offset=offset)
            items = []
            for pl in results.get("items", []):
                if not pl:
                    continue
                images = pl.get("images") or []
                thumbnail = images[0].get("url") if images and isinstance(images[0], dict) else None
                tracks_info = pl.get("tracks") or {}
                external_urls = pl.get("external_urls") or {}
                playlist_id = pl.get("id", "")
                url = external_urls.get("spotify") or f"https://open.spotify.com/playlist/{playlist_id}"

                items.append({
                    "id": playlist_id,
                    "name": pl.get("name", "Untitled Playlist"),
                    "tracks_total": tracks_info.get("total", 0),
                    "thumbnail": thumbnail,
                    "owner": (pl.get("owner") or {}).get("display_name", "Unknown"),
                    "url": url,
                })

            total = results.get("total", len(items))
            return {
                "items": items,
                "total": total,
                "limit": limit,
                "offset": offset,
                "has_next": results.get("next") is not None or (offset + limit < total),
                "has_prev": offset > 0,
            }
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to fetch Spotify playlists: {e}")

    def get_playlist(self, url_or_id: str, sp_client: Optional[spotipy.Spotify] = None) -> Dict:
        sp = sp_client or self._get_client()
        playlist_id = self.extract_playlist_id(url_or_id)

        try:
            pl = sp.playlist(playlist_id)
            tracks_raw = []

            # Try getting tracks explicitly using playlist_items
            results = sp.playlist_items(playlist_id)
            if results and 'items' in results:
                tracks_raw.extend(results.get('items', []))
                while results.get('next'):
                    results = sp.next(results)
                    if not results:
                        break
                    tracks_raw.extend(results.get('items', []))
            else:
                # Fallback to older pl tracks object
                results = pl.get('tracks', {})
                tracks_raw.extend(results.get('items', []))
                while results.get('next'):
                    results = sp.next(results)
                    if not results:
                        break
                    tracks_raw.extend(results.get('items', []))

            tracks = []

            for idx, item in enumerate(tracks_raw):
                if not item:
                    continue

                track = None

                if isinstance(item, dict):
                    # Check standard playlist wrapper
                    if 'track' in item and isinstance(item['track'], dict):
                        track = item['track']
                    # Check algorithmic playlist wrapper
                    elif 'item' in item and isinstance(item['item'], dict):
                        track = item['item']
                    # Check if the item itself is a track
                    elif 'id' in item and 'name' in item:
                        track = item
                else:
                    track = None

                if not track or not isinstance(track, dict) or 'id' not in track:
                    continue

                artists = [a.get('name', 'Unknown') for a in track.get('artists', []) if isinstance(a, dict)]

                # Get largest thumbnail
                images = track.get('album', {}).get('images', [])
                thumbnail = images[0]['url'] if images else None

                duration_ms = track.get('duration_ms', 0)
                duration_sec = duration_ms // 1000
                m, s = divmod(duration_sec, 60)

                tracks.append({
                    "id": track['id'],
                    "index": idx + 1,
                    "title": track.get('name', 'Unknown'),
                    "artist": ", ".join(artists),
                    "artists_list": artists,
                    "album": track.get('album', {}).get('name', ''),
                    "duration": f"{m}:{s:02d}",
                    "duration_seconds": duration_sec,
                    "is_explicit": track.get('explicit', False),
                    "thumbnail": thumbnail,
                    "video_url": track.get('external_urls', {}).get('spotify', ''),
                })

            cover_image = pl.get('images', [{}])[0].get('url') if pl.get('images') else None

            return {
                "id": playlist_id,
                "title": pl.get('name', 'Spotify Playlist'),
                "description": pl.get('description', ''),
                "author": pl.get('owner', {}).get('display_name', 'Unknown'),
                "track_count": len(tracks),
                "thumbnail": cover_image,
                "tracks": tracks,
            }
        except Exception as e:
            raise ValueError(f"Could not load Spotify playlist '{playlist_id}': {e}")

    def get_track_lyrics(self, track_id: str) -> Optional[str]:
        return None

    def search_clean_replacement(
        self, title: str, artist: str, duration_seconds: int = 0, sp_client: Optional[spotipy.Spotify] = None
    ) -> Optional[Dict]:
        sp = sp_client or self._get_client()
        query = f"track:{title} artist:{artist}"
        try:
            results = sp.search(q=query, type='track', limit=10)
            candidates = []
            for track in results['tracks']['items']:
                if track.get('explicit', True):
                    continue

                dur_ms = track.get('duration_ms', 0)
                dur_sec = dur_ms // 1000
                diff = abs(dur_sec - duration_seconds) if duration_seconds > 0 else 0

                if duration_seconds > 0 and diff > 35:
                    continue

                score = 100 - min(30, diff)
                track_name = track.get('name', '').lower()
                if any(term in track_name for term in ["clean", "radio edit"]):
                    score += 20

                images = track.get('album', {}).get('images', [])
                thumbnail = images[0]['url'] if images else None
                m, s = divmod(dur_sec, 60)
                artists = [a['name'] for a in track.get('artists', [])]

                candidates.append({
                    "id": track['id'],
                    "title": track.get('name'),
                    "artist": ", ".join(artists),
                    "duration": f"{m}:{s:02d}",
                    "duration_seconds": dur_sec,
                    "is_explicit": False,
                    "thumbnail": thumbnail,
                    "video_url": track.get('external_urls', {}).get('spotify', ''),
                    "confidence_score": score
                })

            if candidates:
                candidates.sort(key=lambda x: x["confidence_score"], reverse=True)
                return candidates[0]
        except Exception as e:
            print(f"Spotify search error: {e}")
        return None

spotify_service = SpotifyService()
