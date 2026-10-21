"""YouTube Music API service wrapper using ytmusicapi."""

import re
from typing import Dict, List, Optional
from ytmusicapi import YTMusic


class YTMusicService:
    def __init__(self, auth_filepath: Optional[str] = None):
        self.auth_filepath = auth_filepath
        try:
            if auth_filepath:
                self.yt = YTMusic(auth_filepath)
            else:
                self.yt = YTMusic()
        except Exception as e:
            print(f"[YTMusicService] Warning initializing YTMusic: {e}. Falling back to default client.")
            self.yt = YTMusic()

        self._lyrics_cache: Dict[str, Optional[str]] = {}

    @staticmethod
    def extract_playlist_id(url_or_id: str) -> str:
        """Extracts the clean playlist ID from a URL or raw ID."""
        raw = url_or_id.strip()
        # Check for ?list= parameter
        match = re.search(r"[?&]list=([a-zA-Z0-9_-]+)", raw)
        if match:
            return match.group(1)
        # If it starts with VLPL or PL or RD
        if raw.startswith("VL"):
            return raw[2:]
        return raw

    @staticmethod
    def parse_duration_to_seconds(duration_str: Optional[str]) -> int:
        """Parses '3:45' or '1:02:15' string into total seconds."""
        if not duration_str or not isinstance(duration_str, str):
            return 0
        parts = duration_str.split(":")
        try:
            if len(parts) == 2:
                return int(parts[0]) * 60 + int(parts[1])
            elif len(parts) == 3:
                return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
            return int(parts[0])
        except (ValueError, TypeError):
            return 0

    def get_playlist(self, playlist_url_or_id: str, limit: int = 150) -> Dict:
        """Fetches public or accessible playlist details and tracks."""
        playlist_id = self.extract_playlist_id(playlist_url_or_id)
        if not playlist_id:
            raise ValueError("Invalid YouTube Music playlist link or ID provided.")

        try:
            # ytmusicapi get_playlist accepts playlistId
            raw_playlist = self.yt.get_playlist(playlist_id, limit=limit)
        except Exception as e:
            # Try with VL prefix if not already present
            try:
                raw_playlist = self.yt.get_playlist(f"VL{playlist_id}", limit=limit)
            except Exception:
                raise ValueError(f"Could not load playlist '{playlist_id}': {str(e)}")

        # Extract thumbnails
        thumbnails = raw_playlist.get("thumbnails", [])
        cover_image = thumbnails[-1]["url"] if thumbnails else None

        tracks = []
        raw_tracks = raw_playlist.get("tracks", [])

        for idx, item in enumerate(raw_tracks):
            if not item:
                continue

            video_id = item.get("videoId")
            # In some cases tracks are unplayable/deleted with no videoId
            if not video_id:
                continue

            artists = [a.get("name", "") for a in item.get("artists", []) if a.get("name")]
            artist_name = ", ".join(artists) if artists else "Unknown Artist"

            duration_text = item.get("duration", "")
            duration_sec = item.get("duration_seconds") or self.parse_duration_to_seconds(duration_text)

            track_thumbs = item.get("thumbnails", [])
            thumb = track_thumbs[-1]["url"] if track_thumbs else cover_image

            tracks.append({
                "id": video_id,
                "setVideoId": item.get("setVideoId"),  # Needed to remove tracks from existing playlists
                "index": idx + 1,
                "title": item.get("title", "Untitled Track"),
                "artist": artist_name,
                "artists_list": artists,
                "album": (item.get("album") or {}).get("name", ""),
                "duration": duration_text,
                "duration_seconds": duration_sec,
                "is_explicit": bool(item.get("isExplicit", False)),
                "thumbnail": thumb,
                "video_url": f"https://music.youtube.com/watch?v={video_id}",
            })

        return {
            "id": playlist_id,
            "title": raw_playlist.get("title", "YouTube Music Playlist"),
            "description": raw_playlist.get("description", ""),
            "author": (raw_playlist.get("author") or {}).get("name", "Unknown"),
            "track_count": len(tracks),
            "thumbnail": cover_image,
            "tracks": tracks,
        }

    def get_track_lyrics(self, video_id: str) -> Optional[str]:
        """Fetches lyrics for a given track via watch playlist."""
        if video_id in self._lyrics_cache:
            return self._lyrics_cache[video_id]

        try:
            watch_playlist = self.yt.get_watch_playlist(video_id)
            lyrics_browse_id = watch_playlist.get("lyrics")
            if not lyrics_browse_id:
                self._lyrics_cache[video_id] = None
                return None

            lyrics_obj = self.yt.get_lyrics(lyrics_browse_id)
            lyrics_text = lyrics_obj.get("lyrics") if lyrics_obj else None
            self._lyrics_cache[video_id] = lyrics_text
            return lyrics_text
        except Exception as e:
            print(f"[YTMusicService] Lyrics fetch error for {video_id}: {e}")
            self._lyrics_cache[video_id] = None
            return None

    def search_clean_replacement(
        self,
        title: str,
        artist: str,
        duration_seconds: int = 0
    ) -> Optional[Dict]:
        """
        Searches YouTube Music for a non-explicit clean/radio edit version of a song.
        """
        clean_queries = [
            f"{title} {artist} clean",
            f"{title} {artist} radio edit",
            f"{title} {artist}",
        ]

        candidates = []

        for q in clean_queries:
            try:
                results = self.yt.search(q, filter="songs", limit=5)
                for res in results:
                    # Must NOT be explicit
                    if res.get("isExplicit", False):
                        continue

                    cand_video_id = res.get("videoId")
                    if not cand_video_id:
                        continue

                    cand_title = res.get("title", "")
                    cand_artists = [a.get("name", "") for a in res.get("artists", []) if a.get("name")]
                    cand_artist_str = ", ".join(cand_artists)

                    cand_duration_str = res.get("duration", "")
                    cand_duration_sec = self.parse_duration_to_seconds(cand_duration_str)

                    # Duration delta check
                    duration_diff = abs(cand_duration_sec - duration_seconds) if duration_seconds > 0 else 0
                    if duration_seconds > 0 and duration_diff > 35:
                        # Skip if duration differs significantly (e.g. extended mix or live)
                        continue

                    # Score similarity
                    score = 100
                    # Penalize duration differences
                    score -= min(30, duration_diff)

                    # Boost if "clean" or "radio" in title
                    if any(term in cand_title.lower() for term in ["clean", "radio edit", "clean version"]):
                        score += 20

                    thumb_list = res.get("thumbnails", [])
                    thumb = thumb_list[-1]["url"] if thumb_list else None

                    candidates.append({
                        "id": cand_video_id,
                        "title": cand_title,
                        "artist": cand_artist_str,
                        "duration": cand_duration_str,
                        "duration_seconds": cand_duration_sec,
                        "is_explicit": False,
                        "thumbnail": thumb,
                        "video_url": f"https://music.youtube.com/watch?v={cand_video_id}",
                        "confidence_score": score,
                    })

                if candidates:
                    break
            except Exception as e:
                print(f"[YTMusicService] Search error for query '{q}': {e}")
                continue

        if not candidates:
            return None

        # Return candidate with highest confidence score
        candidates.sort(key=lambda x: x["confidence_score"], reverse=True)
        return candidates[0]


ytmusic_service = YTMusicService()
