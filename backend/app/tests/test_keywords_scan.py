import pytest
from unittest.mock import patch
from fastapi import HTTPException
from app.main import (
    app,
    KeywordSearchRequest,
    TrackScanItem,
    search_keywords_in_playlist,
)

def test_keywords_scan_route_registered():
    paths = {getattr(r, "path", None): getattr(r, "methods", set()) for r in app.routes}
    assert "/api/scan/keywords" in paths
    assert "POST" in paths["/api/scan/keywords"]

def test_empty_keywords_raises_400():
    req = KeywordSearchRequest(
        tracks=[TrackScanItem(id="t1", title="Song 1", artist="Artist 1")],
        target_keywords=[],
        platform="ytmusic"
    )
    with pytest.raises(HTTPException) as exc_info:
        search_keywords_in_playlist(req)
    assert exc_info.value.status_code == 400
    assert "empty" in exc_info.value.detail.lower()

def test_whitespace_keywords_raises_400():
    req = KeywordSearchRequest(
        tracks=[TrackScanItem(id="t1", title="Song 1", artist="Artist 1")],
        target_keywords=["   ", ""],
        platform="ytmusic"
    )
    with pytest.raises(HTTPException) as exc_info:
        search_keywords_in_playlist(req)
    assert exc_info.value.status_code == 400
    assert "valid" in exc_info.value.detail.lower()

@patch("app.main.lyric_xref_service.resolve_lyrics_and_yt_id")
def test_keywords_scan_ytmusic_success(mock_resolve):
    mock_resolve.side_effect = [
        ("yt1", "Line 1: I got money in the bank\nLine 2: Tonight we party hard"),
        ("yt2", "Line 1: Clean morning sunshine\nLine 2: Driving down the highway")
    ]

    tracks = [
        TrackScanItem(id="t1", title="Party Song", artist="Artist A", thumbnail="https://img.com/1"),
        TrackScanItem(id="t2", title="Clean Song", artist="Artist B", thumbnail="https://img.com/2")
    ]
    req = KeywordSearchRequest(
        tracks=tracks,
        target_keywords=["money", "party"],
        platform="ytmusic"
    )

    data = search_keywords_in_playlist(req)

    # Verify summary
    summary = data["summary"]
    assert summary["keywords_searched"] == ["money", "party"]
    assert summary["scanned_tracks_count"] == 2
    assert summary["tracks_with_matches"] == 1
    assert summary["total_keyword_occurrences"] == 2
    assert summary["lyrics_unavailable_count"] == 0

    # Verify lyrics_by_id caching map
    assert "lyrics_by_id" in data
    assert data["lyrics_by_id"]["t1"] == "Line 1: I got money in the bank\nLine 2: Tonight we party hard"
    assert data["lyrics_by_id"]["t2"] == "Line 1: Clean morning sunshine\nLine 2: Driving down the highway"

    # Verify results
    results = data["results"]
    assert len(results) == 2
    assert results[0]["id"] == "t1"
    assert results[0]["matched"] is True
    assert results[0]["total_matches"] == 2
    assert len(results[0]["snippets"]) == 2
    assert results[1]["id"] == "t2"
    assert results[1]["matched"] is False

@patch("app.main.lyric_xref_service.resolve_lyrics_and_yt_id")
def test_keywords_scan_spotify_uses_xref(mock_resolve):
    mock_resolve.return_value = ("yt_matched", "Gun shots in the night\nRun away")

    tracks = [
        TrackScanItem(id="sp1", title="Action", artist="Band", duration_seconds=210)
    ]
    req = KeywordSearchRequest(
        tracks=tracks,
        target_keywords=["gun"],
        platform="spotify"
    )

    data = search_keywords_in_playlist(req)
    assert data["summary"]["tracks_with_matches"] == 1
    assert data["summary"]["total_keyword_occurrences"] == 1
    assert data["lyrics_by_id"]["sp1"] == "Gun shots in the night\nRun away"
    assert data["results"][0]["ytmusic_video_id"] == "yt_matched"
    assert mock_resolve.call_count == 1
    call_args = mock_resolve.call_args[0]
    assert call_args[1] == "spotify"

@patch("app.main.lyric_xref_service.resolve_lyrics_and_yt_id")
def test_keywords_scan_lyrics_unavailable(mock_resolve):
    mock_resolve.return_value = (None, None)

    tracks = [
        TrackScanItem(id="sp_missing", title="Instrumental", artist="Composer")
    ]
    req = KeywordSearchRequest(
        tracks=tracks,
        target_keywords=["drugs"],
        platform="spotify"
    )

    data = search_keywords_in_playlist(req)
    assert data["summary"]["lyrics_unavailable_count"] == 1
    assert data["summary"]["tracks_with_matches"] == 0
    assert data["lyrics_by_id"]["sp_missing"] == ""
    assert data["results"][0]["has_lyrics"] is False
    assert data["results"][0]["matched"] is False
    assert "ytmusic_video_id" in data["results"][0]
