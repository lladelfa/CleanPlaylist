"""Story 7.6: lyric lookup outcome signal (found / not_found / upstream_error).

All YouTube Music access is mocked; no live network calls.
"""

from unittest.mock import MagicMock, patch

import pytest

from app.main import (
    KeywordSearchRequest,
    PlaylistScanRequest,
    TrackScanItem,
    scan_playlist,
    search_keywords_in_playlist,
)
from app.services.lyric_xref_service import LyricXRefService
from app.services.ytmusic_service import YTMusicService

RESOLVE = "app.main.lyric_xref_service.resolve_lyrics_and_yt_id"


def _make_xref():
    mock_yt = MagicMock()
    mock_yt.parse_duration_to_seconds = YTMusicService.parse_duration_to_seconds
    mock_yt.lyrics_fetch_failed.return_value = False
    return LyricXRefService(ytmusic_service=mock_yt), mock_yt


def _spotify_track():
    return {
        "id": "sp_1",
        "title": "Papercut",
        "artist": "Linkin Park",
        "artists_list": ["Linkin Park"],
        "duration_seconds": 184,
    }


def _candidate():
    return [
        {
            "videoId": "yt_papercut",
            "title": "Papercut",
            "artists": [{"name": "Linkin Park"}],
            "duration_seconds": 184,
        }
    ]


class TestYTMusicServiceFailureTracking:
    def test_exception_is_flagged_and_not_cached(self):
        service = YTMusicService()
        mock_yt = MagicMock()
        mock_yt.get_watch_playlist.side_effect = ConnectionError("down")
        service.yt = mock_yt

        assert service.get_track_lyrics("vid_err") is None
        assert service.lyrics_fetch_failed("vid_err") is True
        assert "vid_err" not in service._lyrics_cache

    def test_genuine_miss_is_not_flagged(self):
        service = YTMusicService()
        mock_yt = MagicMock()
        mock_yt.get_watch_playlist.return_value = {"lyrics": None}
        service.yt = mock_yt

        assert service.get_track_lyrics("vid_none") is None
        assert service.lyrics_fetch_failed("vid_none") is False

    def test_successful_retry_clears_flag(self):
        service = YTMusicService()
        mock_yt = MagicMock()
        mock_yt.get_watch_playlist.side_effect = ConnectionError("down")
        service.yt = mock_yt
        service.get_track_lyrics("vid_retry")
        assert service.lyrics_fetch_failed("vid_retry") is True

        mock_yt.get_watch_playlist.side_effect = None
        mock_yt.get_watch_playlist.return_value = {"lyrics": "browse"}
        mock_yt.get_lyrics.return_value = {"lyrics": "la la"}
        assert service.get_track_lyrics("vid_retry") == "la la"
        assert service.lyrics_fetch_failed("vid_retry") is False


class TestResolveLyricsLookupYTMusic:
    def test_found(self):
        xref, yt = _make_xref()
        yt.get_track_lyrics.return_value = "some lyrics"
        result = xref.resolve_lyrics_lookup({"id": "v1"}, "ytmusic")
        assert (result.yt_id, result.lyrics, result.outcome) == ("v1", "some lyrics", "found")

    def test_no_lyrics_is_not_found(self):
        xref, yt = _make_xref()
        yt.get_track_lyrics.return_value = None
        assert xref.resolve_lyrics_lookup({"id": "v1"}, "ytmusic").outcome == "not_found"

    def test_blank_lyrics_is_not_found(self):
        xref, yt = _make_xref()
        yt.get_track_lyrics.return_value = "   "
        assert xref.resolve_lyrics_lookup({"id": "v1"}, "ytmusic").outcome == "not_found"

    def test_raised_exception_is_upstream_error(self):
        xref, yt = _make_xref()
        yt.get_track_lyrics.side_effect = ConnectionError("down")
        result = xref.resolve_lyrics_lookup({"id": "v1"}, "ytmusic")
        assert result.outcome == "upstream_error"
        assert result.lyrics is None

    def test_swallowed_service_failure_is_upstream_error(self):
        xref, yt = _make_xref()
        yt.get_track_lyrics.return_value = None
        yt.lyrics_fetch_failed.return_value = True
        assert xref.resolve_lyrics_lookup({"id": "v1"}, "ytmusic").outcome == "upstream_error"

    def test_missing_id_is_not_found(self):
        xref, _ = _make_xref()
        assert xref.resolve_lyrics_lookup({}, "ytmusic").outcome == "not_found"


class TestResolveLyricsLookupSpotify:
    def test_found(self):
        xref, yt = _make_xref()
        yt.search.return_value = _candidate()
        yt.get_track_lyrics.return_value = "lyrics here"
        result = xref.resolve_lyrics_lookup(_spotify_track(), "spotify")
        assert (result.yt_id, result.outcome) == ("yt_papercut", "found")

    def test_no_candidate_match_is_not_found(self):
        xref, yt = _make_xref()
        yt.search.return_value = []
        assert xref.resolve_lyrics_lookup(_spotify_track(), "spotify").outcome == "not_found"

    def test_matched_track_without_lyrics_is_not_found(self):
        xref, yt = _make_xref()
        yt.search.return_value = _candidate()
        yt.get_track_lyrics.return_value = None
        result = xref.resolve_lyrics_lookup(_spotify_track(), "spotify")
        assert (result.yt_id, result.outcome) == ("yt_papercut", "not_found")

    def test_search_exception_is_upstream_error(self):
        xref, yt = _make_xref()
        yt.search.side_effect = ConnectionError("search down")
        result = xref.resolve_lyrics_lookup(_spotify_track(), "spotify")
        assert (result.yt_id, result.lyrics, result.outcome) == (None, None, "upstream_error")

    def test_lyrics_exception_is_upstream_error_keeping_id(self):
        xref, yt = _make_xref()
        yt.search.return_value = _candidate()
        yt.get_track_lyrics.side_effect = ConnectionError("lyrics down")
        result = xref.resolve_lyrics_lookup(_spotify_track(), "spotify")
        assert (result.yt_id, result.outcome) == ("yt_papercut", "upstream_error")

    def test_cached_id_lyrics_exception_is_upstream_error(self):
        xref, yt = _make_xref()
        track = _spotify_track()
        track["ytmusic_video_id"] = "cached_id"
        yt.get_track_lyrics.side_effect = ConnectionError("down")
        result = xref.resolve_lyrics_lookup(track, "spotify")
        assert (result.yt_id, result.outcome) == ("cached_id", "upstream_error")

    def test_cached_id_found(self):
        xref, yt = _make_xref()
        track = _spotify_track()
        track["ytmusic_video_id"] = "cached_id"
        yt.get_track_lyrics.return_value = "text"
        assert xref.resolve_lyrics_lookup(track, "spotify").outcome == "found"

    def test_missing_title_is_not_found(self):
        xref, _ = _make_xref()
        assert xref.resolve_lyrics_lookup({"id": "x"}, "spotify").outcome == "not_found"


class TestTupleMethodCompatibility:
    def test_tuple_method_unchanged_and_stamps_track_object(self):
        xref, yt = _make_xref()
        yt.search.return_value = _candidate()
        yt.get_track_lyrics.side_effect = ConnectionError("down")
        track = TrackScanItem(**_spotify_track())

        assert xref.resolve_lyrics_and_yt_id(track, "spotify") == ("yt_papercut", None)
        assert track.lyrics_lookup == "upstream_error"

    def test_tuple_method_does_not_add_key_to_dict_tracks(self):
        xref, yt = _make_xref()
        yt.get_track_lyrics.return_value = "text"
        track = {"id": "v1"}
        assert xref.resolve_lyrics_and_yt_id(track, "ytmusic") == ("v1", "text")
        assert "lyrics_lookup" not in track


def _scan_req(n, platform="ytmusic", deep=True):
    return PlaylistScanRequest(
        tracks=[
            TrackScanItem(id=f"t{i}", title=f"Song {i}", artist="A", artists_list=["A"], duration_seconds=100)
            for i in range(n)
        ],
        preset="moderate",
        platform=platform,
        deep_scan_lyrics=deep,
    )


def _stamping(outcomes, lyrics_by_idx=None):
    """Fake tuple method that stamps lyrics_lookup like the real service."""
    lyrics_by_idx = lyrics_by_idx or {}

    def fake(track, platform="ytmusic"):
        idx = int(track.id[1:])
        track.lyrics_lookup = outcomes[idx]
        return (track.id, lyrics_by_idx.get(idx))

    return fake


@pytest.mark.parametrize("platform", ["ytmusic", "spotify"])
class TestScanPlaylistLyricsLookup:
    def test_each_track_carries_outcome(self, platform):
        outcomes = ["found", "not_found", "upstream_error"]
        with patch(RESOLVE, side_effect=_stamping(outcomes, {0: "clean words"})):
            resp = scan_playlist(_scan_req(3, platform))
        assert [t.lyrics_lookup for t in resp.tracks] == outcomes

    def test_status_unchanged_on_upstream_error(self, platform):
        with patch(RESOLVE, side_effect=_stamping(["upstream_error"])):
            resp = scan_playlist(_scan_req(1, platform))
        assert resp.tracks[0].verification_status == "lyrics_unavailable"

    def test_explicit_still_flagged_on_upstream_error(self, platform):
        req = _scan_req(1, platform)
        req.tracks[0].is_explicit = True
        with patch(RESOLVE, side_effect=_stamping(["upstream_error"])):
            resp = scan_playlist(req)
        assert resp.tracks[0].verification_status == "flagged"

    def test_degraded_when_more_than_half_upstream_error(self, platform):
        with patch(RESOLVE, side_effect=_stamping(["upstream_error", "upstream_error", "found"], {2: "ok"})):
            resp = scan_playlist(_scan_req(3, platform))
        assert resp.summary.lyrics_service_degraded is True

    def test_not_degraded_at_exactly_half(self, platform):
        with patch(RESOLVE, side_effect=_stamping(["upstream_error", "found"], {1: "ok"})):
            resp = scan_playlist(_scan_req(2, platform))
        assert resp.summary.lyrics_service_degraded is False

    def test_not_found_never_counts_as_degraded(self, platform):
        with patch(RESOLVE, side_effect=_stamping(["not_found"] * 3)):
            resp = scan_playlist(_scan_req(3, platform))
        assert resp.summary.lyrics_service_degraded is False


class TestScanPlaylistEdgeCases:
    def test_resolution_exception_marks_upstream_error(self):
        with patch(RESOLVE, side_effect=RuntimeError("boom")):
            resp = scan_playlist(_scan_req(1))
        assert resp.tracks[0].verification_status == "scan_error"
        assert resp.tracks[0].lyrics_lookup == "upstream_error"
        assert resp.summary.lyrics_service_degraded is True

    def test_unstamped_result_falls_back_to_lyrics_presence(self):
        with patch(RESOLVE, side_effect=[("t0", "words here"), (None, None)]):
            resp = scan_playlist(_scan_req(2))
        assert [t.lyrics_lookup for t in resp.tracks] == ["found", "not_found"]

    def test_client_supplied_value_is_ignored(self):
        req = _scan_req(1)
        req.tracks[0].lyrics_lookup = "found"
        with patch(RESOLVE, return_value=(None, None)):
            resp = scan_playlist(req)
        assert resp.tracks[0].lyrics_lookup == "not_found"

    def test_no_deep_scan_means_no_signal(self):
        resp = scan_playlist(_scan_req(2, deep=False))
        assert all(t.lyrics_lookup is None for t in resp.tracks)
        assert resp.summary.lyrics_service_degraded is False


class TestKeywordsScanLyricsLookup:
    def _req(self, n):
        return KeywordSearchRequest(
            tracks=[TrackScanItem(id=f"t{i}", title=f"S{i}", artist="A") for i in range(n)],
            target_keywords=["love"],
            platform="ytmusic",
        )

    def test_outcomes_and_degraded_flag(self):
        with patch(RESOLVE, side_effect=_stamping(["upstream_error", "upstream_error", "found"], {2: "love me"})):
            data = search_keywords_in_playlist(self._req(3))
        assert [r["lyrics_lookup"] for r in data["results"]] == ["upstream_error", "upstream_error", "found"]
        assert data["summary"]["lyrics_service_degraded"] is True
        assert data["summary"]["lyrics_unavailable_count"] == 2

    def test_exception_counts_as_upstream_error(self):
        with patch(RESOLVE, side_effect=RuntimeError("boom")):
            data = search_keywords_in_playlist(self._req(1))
        assert data["results"][0]["lyrics_lookup"] == "upstream_error"
        assert data["summary"]["lyrics_unavailable_count"] == 1

    def test_not_found_is_not_degraded(self):
        with patch(RESOLVE, side_effect=_stamping(["not_found", "not_found"])):
            data = search_keywords_in_playlist(self._req(2))
        assert data["summary"]["lyrics_service_degraded"] is False
