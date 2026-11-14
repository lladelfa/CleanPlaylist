"""YouTube Music API service wrapper using ytmusicapi."""

import re
import threading
from collections import OrderedDict
from typing import Any, Dict, List, Optional
from ytmusicapi import YTMusic

class BoundedLyricsCache(OrderedDict):
    """LRU cache bounded by maxsize, thread-safe under concurrent requests."""

    def __init__(self, maxsize: int = 512, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.maxsize = maxsize
        self._lock = threading.RLock()

    def __getitem__(self, key: str) -> Optional[str]:
        with self._lock:
            val = super().__getitem__(key)
            self.move_to_end(key)
            return val

    def __setitem__(self, key: str, value: Optional[str]) -> None:
        with self._lock:
            if key in self:
                self.move_to_end(key)
            super().__setitem__(key, value)
            if len(self) > self.maxsize:
                self.popitem(last=False)

    def get(self, key: str, default: Optional[str] = None) -> Optional[str]:
        with self._lock:
            if key in self:
                self.move_to_end(key)
                return super().__getitem__(key)
            return default

    def __contains__(self, key: object) -> bool:
        with self._lock:
            return super().__contains__(key)

    def __len__(self) -> int:
        with self._lock:
            return super().__len__()

    def clear(self) -> None:
        with self._lock:
            super().clear()

class YTMusicService:
    def __init__(self):
        # YTM is now strictly a read-only unauthenticated utility.
        self.yt = YTMusic()
        self._lyrics_cache: BoundedLyricsCache = BoundedLyricsCache(maxsize=512)
        # Video IDs whose most recent lyrics fetch raised (an upstream failure, not
        # a genuine "no lyrics" answer). Failures are never cached as misses.
        self._lyrics_failed_ids: set = set()

    @staticmethod
    def extract_track_id(url_or_id: str) -> str:
        raw = (url_or_id or "").strip()
        match_short = re.search(r"youtu\.be/([a-zA-Z0-9_-]+)", raw)
        if match_short:
            return match_short.group(1).split("?")[0]
        match_watch = re.search(r"[?&]v=([a-zA-Z0-9_-]+)", raw)
        if match_watch:
            return match_watch.group(1)
        return raw

    @staticmethod
    def extract_album_id(url_or_id: str) -> str:
        raw = url_or_id.strip()
        match = re.search(r"[?&]list=([a-zA-Z0-9_-]+)", raw)
        if match:
            return match.group(1)
        if "music.youtube.com/browse/" in raw:
            return raw.split("music.youtube.com/browse/")[-1].split("?")[0].split("/")[0]
        return raw

    @staticmethod
    def extract_playlist_id(url_or_id: str) -> str:
        """Extracts the clean playlist ID from a URL or raw ID."""
        raw = url_or_id.strip()
        match = re.search(r"[?&]list=([a-zA-Z0-9_-]+)", raw)
        if match:
            return match.group(1)
        if raw.startswith("VL"):
            return raw[2:]
        return raw

    def search(self, query: str, filter: str = "songs", limit: int = 5) -> List[Dict[str, Any]]:
        """Delegate search to internal YTMusic client."""
        return self.yt.search(query, filter=filter, limit=limit)

    @staticmethod
    def parse_duration_to_seconds(duration_str: Optional[str]) -> int:
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
            raw_playlist = self.yt.get_playlist(playlist_id, limit=limit)
        except Exception as e:
            try:
                raw_playlist = self.yt.get_playlist(f"VL{playlist_id}", limit=limit)
            except Exception:
                if "contents" in str(e) or "private" in str(e).lower() or "not found" in str(e).lower():
                     raise ValueError(f"Could not load playlist. Ensure it is public or unlisted.")
                raise ValueError(f"Could not load playlist '{playlist_id}': {str(e)}")

        thumbnails = raw_playlist.get("thumbnails", [])
        cover_image = thumbnails[-1]["url"] if thumbnails else None

        tracks = []
        raw_tracks = raw_playlist.get("tracks", [])

        for idx, item in enumerate(raw_tracks):
            if not item:
                continue

            video_id = item.get("videoId")
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
                "setVideoId": item.get("setVideoId"),
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

        raw_tc = raw_playlist.get("trackCount")
        try:
            source_track_count = int(raw_tc) if raw_tc is not None else len(tracks)
        except (ValueError, TypeError):
            source_track_count = len(tracks)

        truncated = source_track_count > len(tracks)
        if limit and len(tracks) > limit:
            tracks = tracks[:limit]
            truncated = True

        return {
            "id": playlist_id,
            "title": raw_playlist.get("title", "YouTube Music Playlist"),
            "description": raw_playlist.get("description", ""),
            "author": (raw_playlist.get("author") or {}).get("name", "Unknown"),
            "track_count": len(tracks),
            "source_track_count": source_track_count,
            "truncated": truncated,
            "thumbnail": cover_image,
            "tracks": tracks,
        }

    def get_track_lyrics(self, video_id: str) -> Optional[str]:
        if video_id in self._lyrics_cache:
            self._lyrics_failed_ids.discard(video_id)
            return self._lyrics_cache[video_id]

        try:
            watch_playlist = self.yt.get_watch_playlist(video_id)
            lyrics_browse_id = watch_playlist.get("lyrics")
            if not lyrics_browse_id:
                self._lyrics_cache[video_id] = None
                self._lyrics_failed_ids.discard(video_id)
                return None

            lyrics_obj = self.yt.get_lyrics(lyrics_browse_id)
            lyrics_text = lyrics_obj.get("lyrics") if lyrics_obj else None
            self._lyrics_cache[video_id] = lyrics_text
            self._lyrics_failed_ids.discard(video_id)
            return lyrics_text
        except Exception as e:
            print(f"[YTMusicService] Lyrics fetch error for {video_id}: {e}")
            if len(self._lyrics_failed_ids) >= 512:
                self._lyrics_failed_ids.clear()
            self._lyrics_failed_ids.add(video_id)
            return None

    def lyrics_fetch_failed(self, video_id: str) -> bool:
        """True when the latest get_track_lyrics call for this ID hit an upstream error."""
        return video_id in self._lyrics_failed_ids

    def search_clean_replacement(
        self,
        title: str,
        artist: str,
        duration_seconds: int = 0,
        exclude_track_id: Optional[str] = None,
    ) -> Optional[Dict]:
        from app.services.lyric_xref_service import LyricXRefService
        clean_title = LyricXRefService().clean_title_for_query(title) or title.strip()
        clean_queries = [
            f"{clean_title} {artist} clean",
            f"{clean_title} {artist} radio edit",
            f"{clean_title} {artist}",
        ]

        candidates = []

        for q in clean_queries:
            try:
                results = self.yt.search(q, filter="songs", limit=5)
                for res in results:
                    if res.get("isExplicit", False):
                        continue

                    cand_video_id = res.get("videoId")
                    if not cand_video_id:
                        continue

                    if exclude_track_id and cand_video_id == exclude_track_id:
                        continue

                    cand_title = res.get("title", "")
                    cand_artists = [a.get("name", "") for a in res.get("artists", []) if a.get("name")]
                    cand_artist_str = ", ".join(cand_artists)
                    cand_album = res.get("album", {}).get("name", "") if isinstance(res.get("album"), dict) else ""

                    cand_duration_str = res.get("duration", "")
                    cand_duration_sec = self.parse_duration_to_seconds(cand_duration_str)

                    duration_diff = abs(cand_duration_sec - duration_seconds) if duration_seconds > 0 else 0
                    if duration_seconds > 0 and duration_diff > 35:
                        continue

                    score = 100
                    score -= min(30, duration_diff)
                    if any(term in cand_title.lower() for term in ["clean", "radio edit", "clean version"]):
                        score += 20

                    thumb_list = res.get("thumbnails", [])
                    thumb = thumb_list[-1]["url"] if thumb_list else None

                    candidates.append({
                        "id": cand_video_id,
                        "title": cand_title,
                        "artist": cand_artist_str,
                        "artists_list": cand_artists,
                        "album": cand_album,
                        "duration": cand_duration_str,
                        "duration_seconds": cand_duration_sec,
                        "is_explicit": False,
                        "thumbnail": thumb,
                        "video_url": f"https://music.youtube.com/watch?v={cand_video_id}",
                        "confidence_score": score,
                        "source_platform": "ytmusic",
                        "verification_status": "clean",
                        "ytmusic_video_id": cand_video_id,
                    })

                if candidates:
                    break
            except Exception as e:
                print(f"[YTMusicService] Search error for query '{q}': {e}")
                continue

        if not candidates:
            return None

        candidates.sort(key=lambda x: x["confidence_score"], reverse=True)
        return candidates[0]

    def search_catalog(self, query: str, limit: int = 10) -> Dict[str, Any]:
        capped_limit = min(max(1, limit), 10)
        songs = []
        try:
            song_results = self.yt.search(query, filter="songs", limit=capped_limit)
            for item in song_results:
                video_id = item.get("videoId")
                if not video_id:
                    continue
                artists = [a.get("name", "") for a in item.get("artists", []) if a.get("name")]
                artist_name = ", ".join(artists) if artists else "Unknown Artist"
                duration_text = item.get("duration", "")
                duration_sec = item.get("duration_seconds") or self.parse_duration_to_seconds(duration_text)
                track_thumbs = item.get("thumbnails", [])
                thumb = track_thumbs[-1]["url"] if track_thumbs else None

                songs.append({
                    "id": video_id,
                    "title": item.get("title", "Untitled Track"),
                    "artist": artist_name,
                    "artists_list": artists,
                    "album": (item.get("album") or {}).get("name", ""),
                    "duration": duration_text,
                    "duration_seconds": duration_sec,
                    "is_explicit": bool(item.get("isExplicit", False)),
                    "thumbnail": thumb,
                    "video_url": f"https://music.youtube.com/watch?v={video_id}",
                    "verification_status": "unscanned",
                    "source_platform": "ytmusic",
                })
        except Exception as e:
            print(f"[YTMusicService] Song search error for '{query}': {e}")

        albums = []
        try:
            album_results = self.yt.search(query, filter="albums", limit=capped_limit)
            for item in album_results:
                browse_id = item.get("browseId")
                if not browse_id:
                    continue
                artists = [a.get("name", "") for a in item.get("artists", []) if a.get("name")]
                artist_name = ", ".join(artists) if artists else "Unknown Artist"
                thumb_list = item.get("thumbnails", [])
                thumb = thumb_list[-1]["url"] if thumb_list else None
                year = str(item.get("year", "")) if item.get("year") else None

                raw_tc = item.get("track_count") or item.get("trackCount")
                parsed_tc = None
                if raw_tc is not None:
                    try:
                        if isinstance(raw_tc, str):
                            digits = re.findall(r"\d+", raw_tc)
                            parsed_tc = int(digits[0]) if digits else None
                        else:
                            parsed_tc = int(raw_tc)
                    except Exception:
                        parsed_tc = None

                albums.append({
                    "id": browse_id,
                    "title": item.get("title", "Untitled Album"),
                    "artist": artist_name,
                    "thumbnail": thumb,
                    "track_count": parsed_tc,
                    "year": year,
                    "source_platform": "ytmusic",
                })
        except Exception as e:
            print(f"[YTMusicService] Album search error for '{query}': {e}")

        return {"songs": songs, "albums": albums}

    def get_album(self, album_id: str) -> Dict[str, Any]:
        clean_id = self.extract_album_id(album_id)
        try:
            raw = self.yt.get_album(clean_id)
        except Exception as e:
            raise ValueError(f"Could not load YouTube Music album '{album_id}': {e}")

        artists = [a.get("name", "") for a in raw.get("artists", []) if a.get("name")]
        artist_str = ", ".join(artists) if artists else "Unknown Artist"
        thumb_list = raw.get("thumbnails", [])
        cover_image = thumb_list[-1]["url"] if thumb_list else None
        album_title = raw.get("title", "YouTube Music Album")

        tracks = []
        for idx, item in enumerate(raw.get("tracks", [])):
            if not item:
                continue
            video_id = item.get("videoId")
            if not video_id:
                continue
            t_artists = [a.get("name", "") for a in item.get("artists", []) if a.get("name")]
            t_artist_str = ", ".join(t_artists) if t_artists else artist_str
            duration_text = item.get("duration", "")
            duration_sec = item.get("duration_seconds") or self.parse_duration_to_seconds(duration_text)
            t_thumbs = item.get("thumbnails", [])
            thumb = t_thumbs[-1]["url"] if t_thumbs else cover_image

            tracks.append({
                "id": video_id,
                "index": idx + 1,
                "title": item.get("title", "Untitled Track"),
                "artist": t_artist_str,
                "artists_list": t_artists or artists,
                "album": album_title,
                "duration": duration_text,
                "duration_seconds": duration_sec,
                "is_explicit": bool(item.get("isExplicit", False)),
                "thumbnail": thumb,
                "video_url": f"https://music.youtube.com/watch?v={video_id}",
                "verification_status": "unscanned",
                "source_platform": "ytmusic",
            })

        track_count = raw.get("trackCount")
        if track_count is None:
            track_count = len(tracks)
        else:
            try:
                track_count = int(track_count)
            except (ValueError, TypeError):
                track_count = len(tracks)

        return {
            "id": album_id,
            "title": album_title,
            "artist": artist_str,
            "thumbnail": cover_image,
            "track_count": track_count,
            "tracks": tracks,
        }

    def resolve_track(self, video_id: str) -> Dict[str, Any]:
        clean_id = self.extract_track_id(video_id)
        if not clean_id:
            raise ValueError("Invalid YouTube Music track ID.")
        try:
            raw = self.yt.get_song(clean_id)
        except Exception as e:
            raise ValueError(f"Could not load YouTube Music song '{clean_id}': {e}")

        status = (raw.get("playabilityStatus") or {}).get("status")
        if status and status != "OK":
            raise ValueError(f"YouTube Music track '{clean_id}' is not playable: {status}")

        details = raw.get("videoDetails") or {}
        if not details or not details.get("title"):
            raise ValueError(f"No metadata found for YouTube Music song '{clean_id}'")

        author = details.get("author") or "Unknown Artist"
        try:
            duration_sec = int(details.get("lengthSeconds") or 0)
        except (ValueError, TypeError):
            duration_sec = 0
        m, s = divmod(duration_sec, 60)
        duration_text = f"{m}:{s:02d}"

        thumbs = (details.get("thumbnail") or {}).get("thumbnails", [])
        thumb = thumbs[-1]["url"] if thumbs else None

        return {
            "id": clean_id,
            "title": details.get("title", "Untitled Track"),
            "artist": author,
            "artists_list": [author],
            "album": "",
            "duration": duration_text,
            "duration_seconds": duration_sec,
            "is_explicit": False,
            "thumbnail": thumb,
            "video_url": f"https://music.youtube.com/watch?v={clean_id}",
            "verification_status": "unscanned",
            "source_platform": "ytmusic",
        }

ytmusic_service = YTMusicService()

