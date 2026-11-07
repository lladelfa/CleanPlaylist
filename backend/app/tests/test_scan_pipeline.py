"""Unit tests for progressive categorized lyric scan and verification status state machine (Story 2.2)."""

import pytest
from unittest.mock import patch

from app.main import (
    app,
    ScannedTrackItem,
    PlaylistScanResponse,
    TrackScanItem,
    PlaylistScanRequest,
    scan_playlist,
)
from app.services.scanner_service import scanner_service


def test_routes_registered():
    """Verify POST /api/scan/playlist route is registered."""
    paths = {getattr(r, "path", None): getattr(r, "methods", set()) for r in app.routes}
    assert "/api/scan/playlist" in paths
    assert "POST" in paths["/api/scan/playlist"]


def test_scanned_track_item_schema():
    """Verify ScannedTrackItem schema extends TrackScanItem with required scan fields."""
    track_data = {
        "id": "trk_123",
        "title": "Song Title",
        "artist": "Artist Name",
        "artists_list": ["Artist Name"],
        "album": "Album Name",
        "duration": "3:45",
        "duration_seconds": 225,
        "is_explicit": False,
        "is_flagged": True,
        "reasons": ["Found 1 Strong Profanity instance(s)"],
        "snippets": [{"line_number": 1, "text": "bad word", "matched_terms": ["bad"]}],
        "detected_terms": [{"word": "bad", "category": "strong_profanity", "count": 1, "occurrences": [1]}],
        "total_flagged_count": 1,
        "has_lyrics": True,
        "verification_status": "flagged",
    }
    item = ScannedTrackItem(**track_data)
    assert item.id == "trk_123"
    assert item.is_flagged is True
    assert item.has_lyrics is True
    assert item.total_flagged_count == 1
    assert item.verification_status == "flagged"
    assert len(item.snippets) == 1
    assert len(item.detected_terms) == 1


def test_scanner_service_untruncated_snippets():
    """Verify scanner_service preserves all snippets without truncating at 20."""
    # Create lyrics with 25 lines containing flagged profanity
    lines = [f"Line {i} has shit profanity" for i in range(1, 26)]
    lyrics = "\n".join(lines)

    result = scanner_service.scan_lyrics(lyrics, preset="moderate")
    assert result["has_lyrics"] is True
    assert result["is_flagged"] is True
    assert len(result["snippets"]) == 25, f"Expected 25 snippets, got {len(result['snippets'])}"


def test_scanner_service_platform_name_metadata():
    """Verify scanner_service dynamically formats platform name in explicit metadata reason."""
    res_spotify = scanner_service.scan_lyrics(
        lyrics="",
        preset="moderate",
        is_metadata_explicit=True,
        platform="spotify",
    )
    assert res_spotify["is_flagged"] is True
    assert any("Marked Explicit by Spotify" in r for r in res_spotify["reasons"])
    assert "Lyrics Unavailable" in res_spotify["reasons"]

    res_ytmusic = scanner_service.scan_lyrics(
        lyrics="",
        preset="moderate",
        is_metadata_explicit=True,
        platform="ytmusic",
    )
    assert res_ytmusic["is_flagged"] is True
    assert any("Marked Explicit by YouTube Music" in r for r in res_ytmusic["reasons"])
    assert "Lyrics Unavailable" in res_ytmusic["reasons"]


def test_scan_playlist_clean_track_with_lyrics():
    """Scenario 1: Clean track with lyrics resolves to verified_clean and populates lyrics_by_id."""
    req = PlaylistScanRequest(
        tracks=[
            TrackScanItem(
                id="clean_1",
                title="Sunny Day",
                artist="Good Vibes",
                artists_list=["Good Vibes"],
                duration_seconds=180,
                is_explicit=False,
            )
        ],
        preset="moderate",
        platform="ytmusic",
    )

    with patch("app.main.lyric_xref_service.resolve_lyrics_and_yt_id", return_value=("clean_1", "Walking on sunshine, everything is beautiful")):
        resp = scan_playlist(req)

    data = resp.model_dump() if hasattr(resp, "model_dump") else resp
    assert len(data["tracks"]) == 1
    track = data["tracks"][0]
    track_dict = track.model_dump() if hasattr(track, "model_dump") else track
    assert track_dict["verification_status"] == "verified_clean"
    assert track_dict["is_flagged"] is False
    assert track_dict["has_lyrics"] is True
    assert track_dict["total_flagged_count"] == 0
    assert data["lyrics_by_id"].get("clean_1") == "Walking on sunshine, everything is beautiful"
    assert data["summary"]["flagged_tracks"] == 0
    assert data["summary"]["clean_tracks"] == 1


def test_scan_playlist_flagged_track_with_lyrics():
    """Scenario 2: Flagged track with lyrics resolves to flagged with reasons and full snippets."""
    req = PlaylistScanRequest(
        tracks=[
            TrackScanItem(
                id="flagged_1",
                title="Explicit Rap",
                artist="Rapper",
                artists_list=["Rapper"],
                duration_seconds=200,
                is_explicit=False,
            )
        ],
        preset="moderate",
        platform="spotify",
    )

    flagged_lyrics = "Intro line\nFuck this and shit that\nOutro line"
    with patch("app.main.lyric_xref_service.resolve_lyrics_and_yt_id", return_value=("yt_vid_1", flagged_lyrics)):
        resp = scan_playlist(req)

    data = resp.model_dump() if hasattr(resp, "model_dump") else resp
    track = data["tracks"][0]
    track_dict = track.model_dump() if hasattr(track, "model_dump") else track
    assert track_dict["verification_status"] == "flagged"
    assert track_dict["is_flagged"] is True
    assert track_dict["has_lyrics"] is True
    assert track_dict["total_flagged_count"] >= 2
    assert len(track_dict["snippets"]) >= 1
    assert track_dict["ytmusic_video_id"] == "yt_vid_1"
    assert data["lyrics_by_id"].get("flagged_1") == flagged_lyrics
    assert data["summary"]["flagged_tracks"] == 1
    assert data["summary"]["clean_tracks"] == 0


def test_scan_playlist_missing_lyrics_explicit_metadata():
    """Scenario 3: Missing lyrics with is_explicit True resolves to flagged with both reasons."""
    req = PlaylistScanRequest(
        tracks=[
            TrackScanItem(
                id="exp_no_lyr",
                title="Explicit Track No Lyrics",
                artist="Artist",
                artists_list=["Artist"],
                duration_seconds=150,
                is_explicit=True,
            )
        ],
        preset="moderate",
        platform="spotify",
    )

    with patch("app.main.lyric_xref_service.resolve_lyrics_and_yt_id", return_value=(None, None)):
        resp = scan_playlist(req)

    data = resp.model_dump() if hasattr(resp, "model_dump") else resp
    track = data["tracks"][0]
    track_dict = track.model_dump() if hasattr(track, "model_dump") else track
    assert track_dict["verification_status"] == "flagged"
    assert track_dict["is_flagged"] is True
    assert track_dict["has_lyrics"] is False
    assert any("Marked Explicit by Spotify" in r for r in track_dict["reasons"])
    assert any("Lyrics Unavailable" in r for r in track_dict["reasons"])
    assert "exp_no_lyr" not in data["lyrics_by_id"]


def test_scan_playlist_missing_lyrics_clean_metadata():
    """Scenario 4: Missing lyrics with clean metadata resolves to lyrics_unavailable and NOT verified_clean."""
    req = PlaylistScanRequest(
        tracks=[
            TrackScanItem(
                id="clean_no_lyr",
                title="Instrumental Track",
                artist="Orchestra",
                artists_list=["Orchestra"],
                duration_seconds=300,
                is_explicit=False,
            )
        ],
        preset="moderate",
        platform="ytmusic",
    )

    with patch("app.main.lyric_xref_service.resolve_lyrics_and_yt_id", return_value=(None, None)):
        resp = scan_playlist(req)

    data = resp.model_dump() if hasattr(resp, "model_dump") else resp
    track = data["tracks"][0]
    track_dict = track.model_dump() if hasattr(track, "model_dump") else track
    assert track_dict["verification_status"] == "lyrics_unavailable"
    assert track_dict["verification_status"] != "verified_clean"
    assert track_dict["is_flagged"] is False
    assert track_dict["has_lyrics"] is False
    assert "clean_no_lyr" not in data["lyrics_by_id"]


def test_zero_false_clean_invariant_enforcement():
    """Zero False-Clean Invariant: track without verified lyrics can never be verified_clean."""
    req = PlaylistScanRequest(
        tracks=[
            TrackScanItem(
                id="no_lyr_1",
                title="Ambiguous Song",
                artist="Indie Band",
                artists_list=["Indie Band"],
                duration_seconds=120,
                is_explicit=False,
            )
        ],
        preset="clean",  # Preset without metadata checking
        platform="ytmusic",
    )

    with patch("app.main.lyric_xref_service.resolve_lyrics_and_yt_id", return_value=(None, "")):
        resp = scan_playlist(req)

    data = resp.model_dump() if hasattr(resp, "model_dump") else resp
    track = data["tracks"][0]
    track_dict = track.model_dump() if hasattr(track, "model_dump") else track
    assert track_dict["verification_status"] != "verified_clean"
    assert track_dict["verification_status"] == "lyrics_unavailable"


def test_scan_playlist_error_handling():
    """Unhandled failure during lyric resolution sets status to scan_error."""
    req = PlaylistScanRequest(
        tracks=[
            TrackScanItem(
                id="err_trk",
                title="Broken Song",
                artist="Crash",
                artists_list=["Crash"],
                duration_seconds=120,
                is_explicit=False,
            )
        ],
        preset="moderate",
        platform="ytmusic",
    )

    with patch("app.main.lyric_xref_service.resolve_lyrics_and_yt_id", side_effect=RuntimeError("Connection exploded")):
        resp = scan_playlist(req)

    data = resp.model_dump() if hasattr(resp, "model_dump") else resp
    track = data["tracks"][0]
    track_dict = track.model_dump() if hasattr(track, "model_dump") else track
    assert track_dict["verification_status"] == "scan_error"
    assert track_dict["is_flagged"] is False
    assert "err_trk" not in data["lyrics_by_id"]
