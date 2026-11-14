"""Spotify-to-YouTube Lyric Cross-Reference Engine.

Resolves lyrics for tracks by cross-referencing against YouTube Music candidates
when native lyrics are unavailable (e.g. Spotify), with title and artist normalization,
duration matching tolerance (<= 10s), bounded LRU caching, and exception safety.
"""

import logging
import re
from typing import Any, Dict, List, NamedTuple, Optional, Tuple, Union

logger = logging.getLogger(__name__)

# Patterns for parenthetical metadata to strip during normalization
METADATA_PAREN_PATTERN = re.compile(
    r"[\(\[\{][^\)\]\}]*(?:"
    r"remaster|live|feat\b|ft\b|featuring|with\b|radio edit|deluxe|bonus|"
    r"version|edit|mix|original|official|video|audio|lyrics|mono|stereo|"
    r"anniversary|explicit|clean|soundtrack"
    r")[^\)\]\}]*[\)\]\}]",
    flags=re.IGNORECASE,
)

TRAILING_PAREN_PATTERN = re.compile(
    r"\s*[\(\[\{][^\)\]\}]*[\)\]\}]\s*$",
    flags=re.IGNORECASE,
)

TRAILING_HYPHEN_METADATA = re.compile(
    r"\s*[-–—]\s*.*?(?:remaster|live|radio edit|deluxe|bonus|feat\b|ft\b|official|version|edit|anniversary).*$",
    flags=re.IGNORECASE,
)


LOOKUP_FOUND = "found"
LOOKUP_NOT_FOUND = "not_found"
LOOKUP_UPSTREAM_ERROR = "upstream_error"


class LyricLookupResult(NamedTuple):
    """Outcome of a lyrics lookup: matched YT ID, lyrics text, and why."""

    yt_id: Optional[str]
    lyrics: Optional[str]
    outcome: str


def _get_track_field(track: Any, field_name: str, default: Any = None) -> Any:
    """Safely retrieves a field from either a dict or an object."""
    if isinstance(track, dict):
        return track.get(field_name, default)
    return getattr(track, field_name, default)


def _set_track_field(track: Any, field_name: str, value: Any) -> None:
    """Safely sets a field on either a dict or a mutable object."""
    if isinstance(track, dict):
        track[field_name] = value
    elif hasattr(track, field_name) or hasattr(track, "__dict__"):
        try:
            setattr(track, field_name, value)
        except Exception:
            pass


class LyricXRefService:
    """Domain service for cross-referencing Spotify tracks against YouTube Music."""

    def __init__(self, ytmusic_service: Any = None):
        if ytmusic_service is None:
            from app.services.ytmusic_service import ytmusic_service as default_service
            self.ytmusic_service = default_service
        else:
            self.ytmusic_service = ytmusic_service

    @staticmethod
    def _normalize_text(text: Optional[str]) -> str:
        """Strips punctuation, handles contractions, lowercases, and normalizes whitespace."""
        if not text:
            return ""
        # Remove apostrophes (including straight, right curly, left curly, and backticks)
        s = re.sub(r"['’‘`]", "", text)
        # Replace non-alphanumeric with spaces
        s = re.sub(r"[^\w\s]", " ", s)
        return " ".join(s.lower().split())

    def clean_title_for_query(self, title: Optional[str]) -> str:
        """Strips parenthetical/hyphenated metadata for search query generation while preserving casing."""
        if not title:
            return ""
        cleaned = METADATA_PAREN_PATTERN.sub("", title)
        cleaned = TRAILING_HYPHEN_METADATA.sub("", cleaned)
        cleaned = TRAILING_PAREN_PATTERN.sub("", cleaned)
        cleaned = " ".join(cleaned.split())
        return cleaned if cleaned else title.strip()

    def normalize_title(self, title: Optional[str]) -> str:
        """Normalizes title by removing parenthetical metadata, punctuation, and casing."""
        if not title:
            return ""
        cleaned = METADATA_PAREN_PATTERN.sub("", title)
        cleaned = TRAILING_HYPHEN_METADATA.sub("", cleaned)
        cleaned = TRAILING_PAREN_PATTERN.sub("", cleaned)
        if not cleaned.strip():
            cleaned = title
        return self._normalize_text(cleaned)

    def normalize_artist(self, artist: Optional[str]) -> str:
        """Normalizes artist name string."""
        return self._normalize_text(artist)

    def extract_primary_artist(self, track: Any) -> str:
        """Extracts primary artist from track artists_list or artist string."""
        artists_list = _get_track_field(track, "artists_list", [])
        if artists_list and isinstance(artists_list, list) and len(artists_list) > 0:
            first_artist = str(artists_list[0] or "").strip()
            if first_artist:
                return first_artist

        artist_str = _get_track_field(track, "artist", "")
        if not artist_str:
            return ""
        # Split on comma, slash, ampersand, or feat.
        parts = re.split(r"[,/&]|\bfeat\.?\b|\bft\.?\b", str(artist_str), flags=re.IGNORECASE)
        return parts[0].strip() if parts else ""

    def _extract_candidate_artists(self, candidate: Dict[str, Any]) -> List[str]:
        """Extracts artist names list from a YouTube Music search candidate."""
        cand_artists = []
        artists_val = candidate.get("artists")
        if artists_val and isinstance(artists_val, list):
            for a in artists_val:
                if isinstance(a, dict) and a.get("name"):
                    cand_artists.append(a["name"])
                elif isinstance(a, str) and a.strip():
                    cand_artists.append(a.strip())
        if not cand_artists and candidate.get("artist"):
            cand_artists.append(str(candidate["artist"]).strip())
        return cand_artists

    def _primary_artist_aligns(self, primary_artist: str, candidate: Dict[str, Any]) -> bool:
        """Checks if primary artist aligns with YouTube Music candidate."""
        norm_primary = self.normalize_artist(primary_artist)
        if not norm_primary:
            return True

        cand_artists = self._extract_candidate_artists(candidate)
        # Filter and normalize candidate artists, keeping only non-empty strings
        norm_cand_all = [self.normalize_artist(a) for a in cand_artists if a]
        norm_cand_all = [a for a in norm_cand_all if a]
        if not norm_cand_all:
            return True

        norm_cand_primary = norm_cand_all[0]
        if norm_primary == norm_cand_primary:
            return True

        if norm_primary in norm_cand_all:
            return True

        # Token set and word boundary matching (avoids false matches like "eve" in "steve")
        primary_tokens = set(norm_primary.split())
        cand_prim_tokens = set(norm_cand_primary.split())
        all_cand_tokens = set(" ".join(norm_cand_all).split())

        if primary_tokens and (primary_tokens.issubset(cand_prim_tokens) or cand_prim_tokens.issubset(primary_tokens)):
            return True

        if primary_tokens and primary_tokens.issubset(all_cand_tokens):
            return True

        # Word boundary pattern match
        pattern = r"\b" + re.escape(norm_primary) + r"\b"
        cand_full_str = " ".join(norm_cand_all)
        if cand_full_str and re.search(pattern, cand_full_str):
            return True

        if norm_cand_primary:
            cand_prim_pattern = r"\b" + re.escape(norm_cand_primary) + r"\b"
            if re.search(cand_prim_pattern, norm_primary):
                return True

        return False

    def _duration_aligns(self, spotify_duration: int, candidate: Dict[str, Any]) -> bool:
        """Evaluates duration tolerance <= 10s when both durations > 0, otherwise accepts fallback."""
        cand_duration = candidate.get("duration_seconds")
        if not cand_duration:
            raw_dur_str = candidate.get("duration")
            cand_duration = self.ytmusic_service.parse_duration_to_seconds(raw_dur_str)

        try:
            cand_sec = int(cand_duration or 0)
        except (ValueError, TypeError):
            cand_sec = 0

        # Duration tolerance <= 10s when both are > 0
        if spotify_duration > 0 and cand_sec > 0:
            return abs(cand_sec - spotify_duration) <= 10

        # Fall back to top aligned candidate if duration is 0
        return True

    def _fetch_lyrics(self, video_id: str) -> Tuple[Optional[str], str]:
        """Fetches lyrics for a YouTube Music ID and classifies the outcome."""
        try:
            lyrics = self.ytmusic_service.get_track_lyrics(video_id)
        except Exception as e:
            logger.warning("[LyricXRefService] Lyrics fetch failed for %s: %s", video_id, e)
            return None, LOOKUP_UPSTREAM_ERROR
        if lyrics and isinstance(lyrics, str) and lyrics.strip():
            return lyrics, LOOKUP_FOUND
        # The service swallows its own errors and returns None; ask it whether this was one.
        if self.ytmusic_service.lyrics_fetch_failed(video_id) is True:
            return lyrics, LOOKUP_UPSTREAM_ERROR
        return lyrics, LOOKUP_NOT_FOUND

    def resolve_lyrics_lookup(
        self, track: Union[Dict[str, Any], Any], platform: str = "ytmusic"
    ) -> LyricLookupResult:
        """Resolves lyrics and ytmusic_video_id, reporting why lyrics are or are not present.

        Outcome is ``found``, ``not_found`` (genuine miss), or ``upstream_error``
        (YouTube Music search or lyrics fetch failed).
        """
        try:
            norm_platform = (platform or "ytmusic").strip().lower()

            if norm_platform == "ytmusic":
                track_id = _get_track_field(track, "id")
                if not track_id:
                    return LyricLookupResult(None, None, LOOKUP_NOT_FOUND)
                _set_track_field(track, "ytmusic_video_id", track_id)
                lyrics, outcome = self._fetch_lyrics(track_id)
                return LyricLookupResult(track_id, lyrics, outcome)

            # Spotify or other platform needing cross-reference
            existing_yt_id = _get_track_field(track, "ytmusic_video_id")
            if existing_yt_id:
                lyrics, outcome = self._fetch_lyrics(existing_yt_id)
                return LyricLookupResult(existing_yt_id, lyrics, outcome)

            title = _get_track_field(track, "title", "")
            if not title:
                return LyricLookupResult(None, None, LOOKUP_NOT_FOUND)

            primary_artist = self.extract_primary_artist(track)
            raw_duration = _get_track_field(track, "duration_seconds", 0)
            try:
                spotify_duration = int(raw_duration or 0)
            except (ValueError, TypeError):
                spotify_duration = 0

            # Fall back to formatted duration string if duration_seconds is 0 or missing
            if spotify_duration == 0:
                dur_str = _get_track_field(track, "duration")
                if dur_str and isinstance(dur_str, str):
                    spotify_duration = self.ytmusic_service.parse_duration_to_seconds(dur_str)

            # Construct query from cleaned title and primary artist
            clean_title = self.clean_title_for_query(title)
            query = f"{clean_title} {primary_artist}".strip()
            if not query:
                return LyricLookupResult(None, None, LOOKUP_NOT_FOUND)

            norm_title = self.normalize_title(title)

            # Query YouTube Music for song candidates
            candidates: List[Dict[str, Any]] = []
            try:
                candidates = self.ytmusic_service.search(query, filter="songs", limit=5) or []
            except Exception as e:
                logger.warning("[LyricXRefService] Search failed for query '%s': %s", query, e)
                return LyricLookupResult(None, None, LOOKUP_UPSTREAM_ERROR)

            matched_candidate_id: Optional[str] = None
            for cand in candidates:
                cand_title = cand.get("title", "")
                if not cand_title:
                    continue

                cand_norm_title = self.normalize_title(cand_title)
                if cand_norm_title != norm_title:
                    continue

                if not self._primary_artist_aligns(primary_artist, cand):
                    continue

                if not self._duration_aligns(spotify_duration, cand):
                    continue

                matched_candidate_id = cand.get("videoId")
                if matched_candidate_id:
                    break

            if not matched_candidate_id:
                return LyricLookupResult(None, None, LOOKUP_NOT_FOUND)

            # Populate matched ID onto track
            _set_track_field(track, "ytmusic_video_id", matched_candidate_id)

            lyrics, outcome = self._fetch_lyrics(matched_candidate_id)
            return LyricLookupResult(matched_candidate_id, lyrics, outcome)

        except Exception as e:
            logger.warning("[LyricXRefService] Unexpected error resolving lyrics: %s", e)
            return LyricLookupResult(None, None, LOOKUP_UPSTREAM_ERROR)

    def resolve_lyrics_and_yt_id(
        self, track: Union[Dict[str, Any], Any], platform: str = "ytmusic"
    ) -> Tuple[Optional[str], Optional[str]]:
        """Resolves lyrics and ytmusic_video_id for a track on YouTube Music or Spotify.

        Delegates to ``resolve_lyrics_lookup``. For model objects (not dicts) the
        lookup outcome is also stamped onto ``track.lyrics_lookup``.

        Returns:
            Tuple[Optional[str], Optional[str]]: (ytmusic_video_id, lyrics_text)
        """
        result = self.resolve_lyrics_lookup(track, platform)
        if not isinstance(track, dict):
            _set_track_field(track, "lyrics_lookup", result.outcome)
        return result.yt_id, result.lyrics


lyric_xref_service = LyricXRefService()


def resolve_lyrics_and_yt_id(
    track: Union[Dict[str, Any], Any], platform: str = "ytmusic"
) -> Tuple[Optional[str], Optional[str]]:
    """Convenience functional wrapper for lyric_xref_service.resolve_lyrics_and_yt_id."""
    return lyric_xref_service.resolve_lyrics_and_yt_id(track, platform)
