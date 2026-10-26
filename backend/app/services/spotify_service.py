import os
import json
import time
from typing import Dict, List, Optional
from pathlib import Path
import spotipy
from spotipy.oauth2 import SpotifyOAuth
from fastapi import HTTPException

SPOTIFY_TOKEN_CACHE = Path(__file__).parent.parent.parent / ".spotify_caches"

class SpotifyService:
    def __init__(self):
        self._lyrics_cache = {}
        # We store token caches in a folder
        SPOTIFY_TOKEN_CACHE.mkdir(exist_ok=True)
        # For single user prototyping we'll just use a fixed cache file
        self.cache_path = str(SPOTIFY_TOKEN_CACHE / "token.json")
        self.sp_oauth = None
        self.sp = None
        self._init_oauth()

    def _init_oauth(self):
        client_id = os.environ.get("SPOTIFY_CLIENT_ID")
        client_secret = os.environ.get("SPOTIFY_CLIENT_SECRET")
        redirect_uri = os.environ.get("SPOTIFY_REDIRECT_URI", "http://localhost:8000/api/spotify/callback")

        if client_id and client_secret:
            self.sp_oauth = SpotifyOAuth(
                client_id=client_id,
                client_secret=client_secret,
                redirect_uri=redirect_uri,
                scope="playlist-modify-public playlist-modify-private playlist-read-private playlist-read-collaborative",
                cache_path=self.cache_path,
                show_dialog=True
            )

            # If we already have a cached token, initialize the client
            token_info = self.sp_oauth.get_cached_token()
            if token_info:
                self.sp = spotipy.Spotify(auth=token_info['access_token'])

    def is_authenticated(self) -> bool:
        if not self.sp_oauth:
            return False
        token_info = self.sp_oauth.get_cached_token()
        return token_info is not None

    def get_login_url(self) -> str:
        if not self.sp_oauth:
            self._init_oauth()
            if not self.sp_oauth:
                raise ValueError("MISSING_CREDENTIALS")
        return self.sp_oauth.get_authorize_url()

    def exchange_code(self, code: str) -> None:
        if not self.sp_oauth:
            raise ValueError("OAuth not initialized")
        token_info = self.sp_oauth.get_access_token(code)
        if token_info:
            self.sp = spotipy.Spotify(auth=token_info['access_token'])
        else:
            raise ValueError("Failed to get token from code")

    def logout(self) -> None:
        if Path(self.cache_path).exists():
            Path(self.cache_path).unlink()
        self.sp = None

    @staticmethod
    def extract_playlist_id(url: str) -> str:
        if "spotify.com" in url:
            return url.split("/")[-1].split("?")[0]
        if url.startswith("spotify:playlist:"):
            return url.split(":")[-1]
        return url

    def _get_client(self):
        if not self.sp:
            raise HTTPException(status_code=401, detail="You must log in to Spotify to perform this action.")
        return self.sp

    def get_playlist(self, url_or_id: str) -> Dict:
        sp = self._get_client()
        playlist_id = self.extract_playlist_id(url_or_id)

        try:
            pl = sp.playlist(playlist_id)
            tracks_raw = []

            # Handle pagination
            results = pl['tracks']
            tracks_raw.extend(results['items'])
            while results['next']:
                results = sp.next(results)
                tracks_raw.extend(results['items'])

            tracks = []
            for idx, item in enumerate(tracks_raw):
                if not item:
                    continue
                track = item.get('track')
                if not track or not isinstance(track, dict):
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
        # Spotify API does not provide lyrics.
        # We could try to scrape or just return None for now, relying on external services or just falling back
        # For now, return None. Deep lyric scan won't work perfectly on Spotify tracks without an external API.
        return None

    def search_clean_replacement(self, title: str, artist: str, duration_seconds: int = 0) -> Optional[Dict]:
        sp = self._get_client()
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
