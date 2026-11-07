"""Unit tests for POST /api/scan/track-lyrics single track scan endpoint."""

import pytest
from unittest.mock import MagicMock, patch

from app.main import (
    app,
    SingleTrackScanRequest,
    scan_single_track_lyrics,
)


def test_track_lyrics_route_registered():
    """Verify POST /api/scan/track-lyrics is registered."""
    paths = {getattr(r, "path", None): getattr(r, "methods", set()) for r in app.routes}
    assert "/api/scan/track-lyrics" in paths
    assert "POST" in paths["/api/scan/track-lyrics"]


def test_single_track_scan_request_schema():
    """Verify SingleTrackScanRequest schema supports metadata fields."""
    req = SingleTrackScanRequest(
        video_id="spot_123",
        title="Test Track",
        artist="Test Artist",
        duration="3:30",
        duration_seconds=210,
        ytmusic_video_id="yt_456",
        preset="moderate",
        custom_blocklist=["forbidden"],
        is_explicit=True,
        platform="spotify",
    )
    assert req.video_id == "spot_123"
    assert req.title == "Test Track"
    assert req.artist == "Test Artist"
    assert req.duration == "3:30"
    assert req.duration_seconds == 210
    assert req.ytmusic_video_id == "yt_456"
    assert req.preset == "moderate"
    assert req.custom_blocklist == ["forbidden"]
    assert req.is_explicit is True
    assert req.platform == "spotify"


def test_scan_single_track_lyrics_ytmusic_success():
    """Verify YouTube Music calls ytmusic_service and scans lyrics."""
    lyrics_text = "I love programming in Python\nIt is truly awesome"
    with patch("app.main.ytmusic_service.get_track_lyrics", return_value=lyrics_text) as mock_lyrics:
        req = SingleTrackScanRequest(
            video_id="yt_123",
            platform="ytmusic",
            preset="moderate",
        )
        res = scan_single_track_lyrics(req)
        mock_lyrics.assert_called_once_with("yt_123")
        assert res["has_lyrics"] is True
        assert res["lyrics"] == lyrics_text
        assert res["ytmusic_video_id"] == "yt_123"
        assert res["scan_result"]["is_flagged"] is False


def test_scan_single_track_lyrics_ytmusic_no_lyrics():
    """Verify YouTube Music with no lyrics returns graceful empty result."""
    with patch("app.main.ytmusic_service.get_track_lyrics", return_value=None):
        req = SingleTrackScanRequest(
            video_id="yt_no_lyr",
            platform="ytmusic",
            is_explicit=True,
        )
        res = scan_single_track_lyrics(req)
        assert res["has_lyrics"] is False
        assert res["lyrics"] is None
        assert res["scan_result"]["is_flagged"] is True
        assert "Marked Explicit by Provider" in res["scan_result"]["reasons"]


def test_scan_single_track_lyrics_spotify_cross_reference_success():
    """Verify Spotify tracks cross-reference lyrics via lyric_xref_service."""
    lyrics_text = "Line one with shit profanity\nLine two is clean"
    with patch("app.main.lyric_xref_service.resolve_lyrics_and_yt_id", return_value=("yt_resolved_999", lyrics_text)) as mock_xref:
        req = SingleTrackScanRequest(
            video_id="spotify_trk_1",
            title="Song With Bad Words",
            artist="Explicit Artist",
            duration="3:45",
            duration_seconds=225,
            ytmusic_video_id="yt_pre_cached",
            preset="moderate",
            platform="spotify",
        )
        res = scan_single_track_lyrics(req)
        mock_xref.assert_called_once()
        call_args, _ = mock_xref.call_args
        track_arg, platform_arg = call_args
        assert platform_arg == "spotify"
        assert track_arg["id"] == "spotify_trk_1"
        assert track_arg["title"] == "Song With Bad Words"
        assert track_arg["artist"] == "Explicit Artist"
        assert track_arg["duration_seconds"] == 225
        assert track_arg["ytmusic_video_id"] == "yt_pre_cached"

        assert res["has_lyrics"] is True
        assert res["lyrics"] == lyrics_text
        assert res["ytmusic_video_id"] == "yt_resolved_999"
        assert res["scan_result"]["is_flagged"] is True
        assert res["scan_result"]["total_flagged_count"] >= 1


def test_scan_single_track_lyrics_spotify_no_lyrics():
    """Verify Spotify track when cross-reference finds no lyrics."""
    with patch("app.main.lyric_xref_service.resolve_lyrics_and_yt_id", return_value=(None, None)):
        req = SingleTrackScanRequest(
            video_id="spotify_trk_2",
            title="Instrumental Song",
            artist="Quiet Band",
            platform="spotify",
            is_explicit=False,
        )
        res = scan_single_track_lyrics(req)
        assert res["has_lyrics"] is False
        assert res["lyrics"] is None
        assert res["scan_result"]["is_flagged"] is False
