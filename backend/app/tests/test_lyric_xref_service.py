"""Unit tests for lyric_xref_service, BoundedLyricsCache, and cross-reference logic."""

from concurrent.futures import ThreadPoolExecutor
from unittest.mock import MagicMock, patch
import pytest

from app.main import TrackScanItem
from app.services.ytmusic_service import BoundedLyricsCache, YTMusicService
from app.services.lyric_xref_service import (
    LyricXRefService,
    lyric_xref_service,
    resolve_lyrics_and_yt_id,
)


class TestBoundedLyricsCache:
    def test_default_maxsize(self):
        cache = BoundedLyricsCache()
        assert cache.maxsize == 512
        assert len(cache) == 0

    def test_eviction_when_exceeding_maxsize(self):
        cache = BoundedLyricsCache(maxsize=3)
        cache["v1"] = "lyrics 1"
        cache["v2"] = "lyrics 2"
        cache["v3"] = "lyrics 3"
        assert len(cache) == 3

        # Adding 4th item evicts oldest (v1)
        cache["v4"] = "lyrics 4"
        assert len(cache) == 3
        assert "v1" not in cache
        assert cache["v2"] == "lyrics 2"
        assert cache["v3"] == "lyrics 3"
        assert cache["v4"] == "lyrics 4"

    def test_access_updates_recency(self):
        cache = BoundedLyricsCache(maxsize=3)
        cache["v1"] = "lyrics 1"
        cache["v2"] = "lyrics 2"
        cache["v3"] = "lyrics 3"

        # Access v1 via __getitem__, making v2 the oldest
        _ = cache["v1"]
        cache["v4"] = "lyrics 4"

        assert "v2" not in cache
        assert "v1" in cache
        assert "v3" in cache
        assert "v4" in cache

    def test_get_updates_recency(self):
        cache = BoundedLyricsCache(maxsize=3)
        cache["v1"] = "lyrics 1"
        cache["v2"] = "lyrics 2"
        cache["v3"] = "lyrics 3"

        # Access v1 via get(), making v2 the oldest
        assert cache.get("v1") == "lyrics 1"
        cache["v4"] = "lyrics 4"

        assert "v2" not in cache
        assert "v1" in cache

    def test_updating_existing_key_does_not_grow_cache(self):
        cache = BoundedLyricsCache(maxsize=2)
        cache["v1"] = "lyrics 1"
        cache["v2"] = "lyrics 2"
        cache["v1"] = "updated 1"

        assert len(cache) == 2
        cache["v3"] = "lyrics 3"  # should evict v2 since v1 was refreshed
        assert "v2" not in cache
        assert cache["v1"] == "updated 1"
        assert cache["v3"] == "lyrics 3"

    def test_caches_none_values(self):
        cache = BoundedLyricsCache(maxsize=5)
        cache["no_lyrics"] = None
        assert "no_lyrics" in cache
        assert cache["no_lyrics"] is None
        assert cache.get("no_lyrics") is None

    def test_clear(self):
        cache = BoundedLyricsCache(maxsize=5)
        cache["v1"] = "lyrics 1"
        cache.clear()
        assert len(cache) == 0
        assert "v1" not in cache

    def test_thread_safety_under_concurrent_load(self):
        cache = BoundedLyricsCache(maxsize=50)

        def worker(idx: int):
            for i in range(100):
                key = f"key_{idx}_{i % 20}"
                cache[key] = f"val_{i}"
                _ = cache.get(key)
                _ = key in cache

        with ThreadPoolExecutor(max_workers=8) as executor:
            futures = [executor.submit(worker, i) for i in range(8)]
            for f in futures:
                f.result()

        assert len(cache) <= 50


class TestYTMusicServiceDelegate:
    def test_search_delegates_to_yt_client(self):
        service = YTMusicService()
        mock_yt = MagicMock()
        mock_yt.search.return_value = [{"videoId": "abc", "title": "Song"}]
        service.yt = mock_yt

        results = service.search("In the End", filter="songs", limit=5)
        mock_yt.search.assert_called_once_with("In the End", filter="songs", limit=5)
        assert results == [{"videoId": "abc", "title": "Song"}]

    def test_get_track_lyrics_caches_in_bounded_cache(self):
        service = YTMusicService()
        mock_yt = MagicMock()
        mock_yt.get_watch_playlist.return_value = {"lyrics": "browse_lyrics_123"}
        mock_yt.get_lyrics.return_value = {"lyrics": "La la la test lyrics"}
        service.yt = mock_yt

        # First call fetches from yt client
        lyrics1 = service.get_track_lyrics("vid_123")
        assert lyrics1 == "La la la test lyrics"
        assert service._lyrics_cache.get("vid_123") == "La la la test lyrics"
        mock_yt.get_watch_playlist.assert_called_once_with("vid_123")
        mock_yt.get_lyrics.assert_called_once_with("browse_lyrics_123")

        # Second call returns from cache without calling yt client again
        mock_yt.get_watch_playlist.reset_mock()
        mock_yt.get_lyrics.reset_mock()
        lyrics2 = service.get_track_lyrics("vid_123")
        assert lyrics2 == "La la la test lyrics"
        mock_yt.get_watch_playlist.assert_not_called()
        mock_yt.get_lyrics.assert_not_called()

    def test_get_track_lyrics_caches_none_when_unavailable(self):
        service = YTMusicService()
        mock_yt = MagicMock()
        mock_yt.get_watch_playlist.return_value = {"lyrics": None}
        service.yt = mock_yt

        lyrics1 = service.get_track_lyrics("vid_no_lyrics")
        assert lyrics1 is None
        assert "vid_no_lyrics" in service._lyrics_cache
        assert service._lyrics_cache["vid_no_lyrics"] is None

        # Second call should not hit get_watch_playlist
        mock_yt.get_watch_playlist.reset_mock()
        lyrics2 = service.get_track_lyrics("vid_no_lyrics")
        assert lyrics2 is None
        mock_yt.get_watch_playlist.assert_not_called()


class TestTrackScanItemSchema:
    def test_ytmusic_video_id_field_defaults_none(self):
        item = TrackScanItem(id="sp_123", title="Numb", artist="Linkin Park")
        assert item.ytmusic_video_id is None
        data = item.model_dump()
        assert "ytmusic_video_id" in data
        assert data["ytmusic_video_id"] is None

    def test_ytmusic_video_id_population(self):
        item = TrackScanItem(
            id="sp_123",
            title="Numb",
            artist="Linkin Park",
            ytmusic_video_id="yt_456"
        )
        assert item.ytmusic_video_id == "yt_456"
        assert item.model_dump()["ytmusic_video_id"] == "yt_456"


class TestNormalizationLogic:
    def setup_method(self):
        self.service = LyricXRefService()

    def test_title_strips_parenthetical_remaster(self):
        norm = self.service.normalize_title("In the End (Remastered)")
        assert norm == "in the end"

    def test_title_strips_parenthetical_feat(self):
        norm = self.service.normalize_title("Stan (feat. Dido)")
        assert norm == "stan"

    def test_title_strips_bracketed_live(self):
        norm = self.service.normalize_title("One Step Closer [Live at Milton Keynes]")
        assert norm == "one step closer"

    def test_title_strips_trailing_hyphen_metadata(self):
        norm = self.service.normalize_title("In the End - 2020 Remaster")
        assert norm == "in the end"

    def test_title_preserves_integral_parentheses(self):
        norm = self.service.normalize_title("(Don't Fear) The Reaper")
        assert norm == "dont fear the reaper"

    def test_title_ignores_punctuation_and_casing(self):
        norm = self.service.normalize_title("Don't Stop Believin'!")
        assert norm == "dont stop believin"

    def test_normalize_text_handles_left_single_curly_quote(self):
        norm = self.service.normalize_title("‘Cause I Love You")
        assert norm == "cause i love you"

    def test_query_cleaning_preserves_core_title(self):
        cleaned = self.service.clean_title_for_query("In the End (Remastered)")
        assert cleaned == "In the End"

    def test_extract_primary_artist_whitespace_fallback(self):
        track = {
            "artists_list": ["   "],
            "artist": "Linkin Park",
        }
        artist = self.service.extract_primary_artist(track)
        assert artist == "Linkin Park"

    def test_primary_artist_aligns_word_boundaries_rejects_substring(self):
        # "eve" should not align with "steve"
        cand = {"artists": [{"name": "Steve"}]}
        assert not self.service._primary_artist_aligns("Eve", cand)

    def test_primary_artist_aligns_token_subset(self):
        # "Linkin Park" should align with "Linkin Park feat. Jay-Z"
        cand = {"artists": [{"name": "Linkin Park"}, {"name": "Jay-Z"}]}
        assert self.service._primary_artist_aligns("Linkin Park", cand)


class TestLyricXRefServiceSpotify:
    def setup_method(self):
        self.mock_yt = MagicMock()
        self.mock_yt._lyrics_cache = BoundedLyricsCache(maxsize=512)
        self.mock_yt.parse_duration_to_seconds = YTMusicService.parse_duration_to_seconds
        self.xref = LyricXRefService(ytmusic_service=self.mock_yt)

    def test_exact_duration_match(self):
        track = {
            "id": "sp_1",
            "title": "In the End (Remastered)",
            "artist": "Linkin Park",
            "artists_list": ["Linkin Park"],
            "duration_seconds": 216,
        }
        self.mock_yt.search.return_value = [
            {
                "videoId": "yt_linkin_1",
                "title": "In the End",
                "artists": [{"name": "Linkin Park"}],
                "duration": "3:36",
                "duration_seconds": 216,
            }
        ]
        self.mock_yt.get_track_lyrics.return_value = "It starts with one thing..."

        yt_id, lyrics = self.xref.resolve_lyrics_and_yt_id(track, platform="spotify")

        assert yt_id == "yt_linkin_1"
        assert lyrics == "It starts with one thing..."
        assert track["ytmusic_video_id"] == "yt_linkin_1"
        self.mock_yt.search.assert_called_once_with("In the End Linkin Park", filter="songs", limit=5)
        self.mock_yt.get_track_lyrics.assert_called_once_with("yt_linkin_1")

    def test_duration_within_10_seconds_tolerance(self):
        track = {
            "id": "sp_2",
            "title": "Numb",
            "artist": "Linkin Park",
            "duration_seconds": 187,
        }
        self.mock_yt.search.return_value = [
            {
                "videoId": "yt_numb",
                "title": "Numb (Official Video)",
                "artists": [{"name": "Linkin Park"}],
                "duration_seconds": 195,  # diff is 8s <= 10s
            }
        ]
        self.mock_yt.get_track_lyrics.return_value = "I'm tired of being what you want me to be"

        yt_id, lyrics = self.xref.resolve_lyrics_and_yt_id(track, platform="spotify")
        assert yt_id == "yt_numb"
        assert lyrics is not None
        assert track["ytmusic_video_id"] == "yt_numb"

    def test_candidate_artist_mismatch_rejected(self):
        track = {
            "id": "sp_mismatch_artist",
            "title": "In the End",
            "artist": "Linkin Park",
            "duration_seconds": 216,
        }
        self.mock_yt.search.return_value = [
            {
                "videoId": "yt_other_artist",
                "title": "In the End",
                "artists": [{"name": "Steve"}],
                "duration_seconds": 216,
            }
        ]

        yt_id, lyrics = self.xref.resolve_lyrics_and_yt_id(track, platform="spotify")
        assert yt_id is None
        assert lyrics is None
        assert track.get("ytmusic_video_id") is None

    def test_candidate_title_mismatch_rejected(self):
        track = {
            "id": "sp_mismatch_title",
            "title": "In the End",
            "artist": "Linkin Park",
            "duration_seconds": 216,
        }
        self.mock_yt.search.return_value = [
            {
                "videoId": "yt_diff_song",
                "title": "Numb",
                "artists": [{"name": "Linkin Park"}],
                "duration_seconds": 216,
            }
        ]

        yt_id, lyrics = self.xref.resolve_lyrics_and_yt_id(track, platform="spotify")
        assert yt_id is None
        assert lyrics is None
        assert track.get("ytmusic_video_id") is None

    def test_formatted_duration_fallback_when_duration_seconds_zero(self):
        track = {
            "id": "sp_dur_str",
            "title": "Faint",
            "artist": "Linkin Park",
            "duration_seconds": 0,
            "duration": "2:42",  # 162 seconds
        }
        self.mock_yt.search.return_value = [
            {
                "videoId": "yt_faint_long",
                "title": "Faint",
                "artists": [{"name": "Linkin Park"}],
                "duration_seconds": 240,  # diff 78s > 10s
            },
            {
                "videoId": "yt_faint_match",
                "title": "Faint",
                "artists": [{"name": "Linkin Park"}],
                "duration_seconds": 165,  # diff 3s <= 10s
            }
        ]
        self.mock_yt.get_track_lyrics.return_value = "I am a little bit of loneliness"

        yt_id, lyrics = self.xref.resolve_lyrics_and_yt_id(track, platform="spotify")
        assert yt_id == "yt_faint_match"
        assert lyrics == "I am a little bit of loneliness"
        assert track["ytmusic_video_id"] == "yt_faint_match"

    def test_duration_exceeds_10_seconds_tolerance_skips_candidate(self):
        track = {
            "id": "sp_3",
            "title": "In the End",
            "artist": "Linkin Park",
            "duration_seconds": 216,
        }
        self.mock_yt.search.return_value = [
            {
                "videoId": "yt_live_long",
                "title": "In the End",
                "artists": [{"name": "Linkin Park"}],
                "duration_seconds": 280,  # diff is 64s > 10s
            },
            {
                "videoId": "yt_studio",
                "title": "In the End",
                "artists": [{"name": "Linkin Park"}],
                "duration_seconds": 218,  # diff is 2s <= 10s
            }
        ]
        self.mock_yt.get_track_lyrics.return_value = "It starts with one thing"

        yt_id, lyrics = self.xref.resolve_lyrics_and_yt_id(track, platform="spotify")
        assert yt_id == "yt_studio"
        assert track["ytmusic_video_id"] == "yt_studio"

    def test_all_candidates_exceed_duration_returns_none(self):
        track = {
            "id": "sp_4",
            "title": "In the End",
            "artist": "Linkin Park",
            "duration_seconds": 216,
        }
        self.mock_yt.search.return_value = [
            {
                "videoId": "yt_live",
                "title": "In the End",
                "artists": [{"name": "Linkin Park"}],
                "duration_seconds": 350,
            }
        ]

        yt_id, lyrics = self.xref.resolve_lyrics_and_yt_id(track, platform="spotify")
        assert yt_id is None
        assert lyrics is None
        assert track.get("ytmusic_video_id") is None

    def test_zero_duration_fallback_matches_top_aligned_candidate(self):
        track = {
            "id": "sp_5",
            "title": "Crawling",
            "artist": "Linkin Park",
            "duration_seconds": 0,
        }
        self.mock_yt.search.return_value = [
            {
                "videoId": "yt_crawling",
                "title": "Crawling",
                "artists": [{"name": "Linkin Park"}],
                "duration_seconds": 210,
            }
        ]
        self.mock_yt.get_track_lyrics.return_value = "Crawling in my skin..."

        yt_id, lyrics = self.xref.resolve_lyrics_and_yt_id(track, platform="spotify")
        assert yt_id == "yt_crawling"
        assert lyrics == "Crawling in my skin..."
        assert track["ytmusic_video_id"] == "yt_crawling"

    def test_candidate_found_but_no_lyrics(self):
        track = {
            "id": "sp_6",
            "title": "Faint",
            "artist": "Linkin Park",
            "duration_seconds": 162,
        }
        self.mock_yt.search.return_value = [
            {
                "videoId": "yt_faint",
                "title": "Faint",
                "artists": [{"name": "Linkin Park"}],
                "duration_seconds": 162,
            }
        ]
        self.mock_yt.get_track_lyrics.return_value = None

        yt_id, lyrics = self.xref.resolve_lyrics_and_yt_id(track, platform="spotify")
        assert yt_id == "yt_faint"
        assert lyrics is None
        assert track["ytmusic_video_id"] == "yt_faint"

    def test_no_candidate_found(self):
        track = {
            "id": "sp_7",
            "title": "Nonexistent Song 123456789",
            "artist": "Unknown Artist 987654321",
            "duration_seconds": 200,
        }
        self.mock_yt.search.return_value = []

        yt_id, lyrics = self.xref.resolve_lyrics_and_yt_id(track, platform="spotify")
        assert yt_id is None
        assert lyrics is None
        assert track.get("ytmusic_video_id") is None

    def test_reuses_prepopulated_ytmusic_video_id(self):
        track = {
            "id": "sp_8",
            "title": "Numb",
            "artist": "Linkin Park",
            "ytmusic_video_id": "already_set_123",
        }
        self.mock_yt.get_track_lyrics.return_value = "Cached lyrics"

        yt_id, lyrics = self.xref.resolve_lyrics_and_yt_id(track, platform="spotify")
        assert yt_id == "already_set_123"
        assert lyrics == "Cached lyrics"
        self.mock_yt.search.assert_not_called()
        self.mock_yt.get_track_lyrics.assert_called_once_with("already_set_123")

    def test_supports_pydantic_track_scan_item(self):
        item = TrackScanItem(
            id="sp_pydantic",
            title="In the End (Remastered)",
            artist="Linkin Park",
            duration_seconds=216,
        )
        self.mock_yt.search.return_value = [
            {
                "videoId": "yt_pydantic",
                "title": "In the End",
                "artists": [{"name": "Linkin Park"}],
                "duration_seconds": 216,
            }
        ]
        self.mock_yt.get_track_lyrics.return_value = "Pydantic item lyrics"

        yt_id, lyrics = self.xref.resolve_lyrics_and_yt_id(item, platform="spotify")
        assert yt_id == "yt_pydantic"
        assert lyrics == "Pydantic item lyrics"
        assert item.ytmusic_video_id == "yt_pydantic"


class TestLyricXRefServiceYTMusic:
    def setup_method(self):
        self.mock_yt = MagicMock()
        self.mock_yt._lyrics_cache = BoundedLyricsCache(maxsize=512)
        self.xref = LyricXRefService(ytmusic_service=self.mock_yt)

    def test_ytmusic_platform_direct_resolution(self):
        track = {
            "id": "abc123xyz",
            "title": "Some YT Track",
            "artist": "Some Artist",
        }
        self.mock_yt.get_track_lyrics.return_value = "YT lyrics text"

        yt_id, lyrics = self.xref.resolve_lyrics_and_yt_id(track, platform="ytmusic")
        assert yt_id == "abc123xyz"
        assert lyrics == "YT lyrics text"
        assert track["ytmusic_video_id"] == "abc123xyz"
        self.mock_yt.search.assert_not_called()
        self.mock_yt.get_track_lyrics.assert_called_once_with("abc123xyz")

    def test_ytmusic_platform_lyrics_unavailable(self):
        track = {
            "id": "abc123xyz",
            "title": "Some YT Track",
            "artist": "Some Artist",
        }
        self.mock_yt.get_track_lyrics.return_value = None

        yt_id, lyrics = self.xref.resolve_lyrics_and_yt_id(track, platform="ytmusic")
        assert yt_id == "abc123xyz"
        assert lyrics is None
        assert track["ytmusic_video_id"] == "abc123xyz"


class TestExceptionSafety:
    def setup_method(self):
        self.mock_yt = MagicMock()
        self.mock_yt._lyrics_cache = BoundedLyricsCache(maxsize=512)
        self.xref = LyricXRefService(ytmusic_service=self.mock_yt)

    def test_search_timeout_returns_none_none(self):
        track = {
            "id": "sp_timeout",
            "title": "Papercut",
            "artist": "Linkin Park",
            "duration_seconds": 184,
        }
        self.mock_yt.search.side_effect = TimeoutError("YouTube timed out")

        yt_id, lyrics = self.xref.resolve_lyrics_and_yt_id(track, platform="spotify")
        assert yt_id is None
        assert lyrics is None

    def test_lyrics_fetch_error_returns_candidate_none(self):
        track = {
            "id": "sp_err",
            "title": "Papercut",
            "artist": "Linkin Park",
            "duration_seconds": 184,
        }
        self.mock_yt.search.return_value = [
            {
                "videoId": "yt_papercut",
                "title": "Papercut",
                "artists": [{"name": "Linkin Park"}],
                "duration_seconds": 184,
            }
        ]
        self.mock_yt.get_track_lyrics.side_effect = ConnectionError("Lyrics network down")

        yt_id, lyrics = self.xref.resolve_lyrics_and_yt_id(track, platform="spotify")
        assert yt_id == "yt_papercut"
        assert lyrics is None
        assert track["ytmusic_video_id"] == "yt_papercut"

    def test_malformed_track_payload_does_not_crash(self):
        yt_id, lyrics = self.xref.resolve_lyrics_and_yt_id({}, platform="spotify")
        assert yt_id is None
        assert lyrics is None

        yt_id, lyrics = self.xref.resolve_lyrics_and_yt_id(
            {"title": None, "artist": None, "duration_seconds": "not_an_int"},
            platform="spotify"
        )
        assert yt_id is None
        assert lyrics is None


class TestNoDirectImportsRule:
    def test_lyric_xref_service_does_not_import_third_party_libraries(self):
        import app.services.lyric_xref_service as mod
        mod_src = open(mod.__file__, "r", encoding="utf-8").read()
        assert "import ytmusicapi" not in mod_src
        assert "from ytmusicapi" not in mod_src
        assert "import spotipy" not in mod_src
        assert "from spotipy" not in mod_src
