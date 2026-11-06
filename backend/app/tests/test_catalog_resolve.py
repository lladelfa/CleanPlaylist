"""Unit tests for Catalog Batch Resolution & Cross-Platform URL Guard (Story 1.5)."""

import pytest
from unittest.mock import MagicMock, patch
from fastapi import HTTPException
from app.main import (
    app,
    TrackScanItem,
    CatalogResolveRequest,
    CatalogResolveResponse,
    UnresolvedLineItem,
    resolve_catalog_lines,
)
from app.services.spotify_service import SpotifyService, spotify_service
from app.services.ytmusic_service import YTMusicService, ytmusic_service


# -----------------------------------------------------------------------------
# 1. Route Registration Checks
# -----------------------------------------------------------------------------

def test_catalog_resolve_route_registered():
    paths = {getattr(r, "path", None): getattr(r, "methods", set()) for r in app.routes}
    assert "/api/catalog/resolve" in paths
    assert "POST" in paths["/api/catalog/resolve"]


# -----------------------------------------------------------------------------
# 2. SpotifyService extract_track_id and resolve_track
# -----------------------------------------------------------------------------

def test_spotify_service_extract_track_id():
    service = SpotifyService()
    assert service.extract_track_id("https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT?si=abc123") == "4cOdK2wGLETKBW3PvgPWqT"
    assert service.extract_track_id("https://open.spotify.com/intl-en/track/4cOdK2wGLETKBW3PvgPWqT?si=abc123") == "4cOdK2wGLETKBW3PvgPWqT"
    assert service.extract_track_id("https://open.spotify.com/intl-es/track/4cOdK2wGLETKBW3PvgPWqT") == "4cOdK2wGLETKBW3PvgPWqT"
    assert service.extract_track_id("http://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT") == "4cOdK2wGLETKBW3PvgPWqT"
    assert service.extract_track_id("spotify:track:4cOdK2wGLETKBW3PvgPWqT") == "4cOdK2wGLETKBW3PvgPWqT"
    assert service.extract_track_id("4cOdK2wGLETKBW3PvgPWqT") == "4cOdK2wGLETKBW3PvgPWqT"


def test_spotify_service_resolve_track_success():
    service = SpotifyService()
    mock_client = MagicMock()
    service._catalog_client = mock_client

    mock_client.track.return_value = {
        "id": "sp_123",
        "name": "Viva La Vida",
        "artists": [{"name": "Coldplay"}],
        "album": {
            "name": "Viva La Vida or Death and All His Friends",
            "images": [{"url": "https://img.spotify.com/viva.jpg"}],
        },
        "duration_ms": 242000,
        "explicit": False,
        "external_urls": {"spotify": "https://open.spotify.com/track/sp_123"},
    }

    track = service.resolve_track("https://open.spotify.com/track/sp_123")
    mock_client.track.assert_called_once_with("sp_123")

    assert track["id"] == "sp_123"
    assert track["title"] == "Viva La Vida"
    assert track["artist"] == "Coldplay"
    assert track["artists_list"] == ["Coldplay"]
    assert track["album"] == "Viva La Vida or Death and All His Friends"
    assert track["duration"] == "4:02"
    assert track["duration_seconds"] == 242
    assert track["is_explicit"] is False
    assert track["thumbnail"] == "https://img.spotify.com/viva.jpg"
    assert track["video_url"] == "https://open.spotify.com/track/sp_123"
    assert track["verification_status"] == "unscanned"
    assert track["source_platform"] == "spotify"


def test_spotify_service_resolve_track_failure():
    service = SpotifyService()
    mock_client = MagicMock()
    service._catalog_client = mock_client
    mock_client.track.side_effect = Exception("Track not found")

    with pytest.raises(ValueError, match="Could not load Spotify track"):
        service.resolve_track("invalid_id")


# -----------------------------------------------------------------------------
# 3. YTMusicService extract_track_id and resolve_track
# -----------------------------------------------------------------------------

def test_ytmusic_service_extract_track_id():
    service = YTMusicService()
    assert service.extract_track_id("https://music.youtube.com/watch?v=dQw4w9WgXcQ") == "dQw4w9WgXcQ"
    assert service.extract_track_id("https://music.youtube.com/watch?v=dQw4w9WgXcQ&list=RDAMVM") == "dQw4w9WgXcQ"
    assert service.extract_track_id("https://www.youtube.com/watch?v=dQw4w9WgXcQ") == "dQw4w9WgXcQ"
    assert service.extract_track_id("https://youtu.be/dQw4w9WgXcQ?t=10") == "dQw4w9WgXcQ"
    assert service.extract_track_id("dQw4w9WgXcQ") == "dQw4w9WgXcQ"


def test_ytmusic_service_resolve_track_success():
    service = YTMusicService()
    mock_yt = MagicMock()
    service.yt = mock_yt

    mock_yt.get_song.return_value = {
        "playabilityStatus": {"status": "OK"},
        "videoDetails": {
            "videoId": "dQw4w9WgXcQ",
            "title": "Never Gonna Give You Up",
            "author": "Rick Astley",
            "lengthSeconds": "213",
            "thumbnail": {
                "thumbnails": [{"url": "https://img.yt.com/thumb.jpg"}]
            },
        },
    }

    track = service.resolve_track("https://music.youtube.com/watch?v=dQw4w9WgXcQ")
    mock_yt.get_song.assert_called_once_with("dQw4w9WgXcQ")

    assert track["id"] == "dQw4w9WgXcQ"
    assert track["title"] == "Never Gonna Give You Up"
    assert track["artist"] == "Rick Astley"
    assert track["artists_list"] == ["Rick Astley"]
    assert track["album"] == ""
    assert track["duration"] == "3:33"
    assert track["duration_seconds"] == 213
    assert track["is_explicit"] is False
    assert track["thumbnail"] == "https://img.yt.com/thumb.jpg"
    assert track["video_url"] == "https://music.youtube.com/watch?v=dQw4w9WgXcQ"
    assert track["verification_status"] == "unscanned"
    assert track["source_platform"] == "ytmusic"


def test_ytmusic_service_resolve_track_failure():
    service = YTMusicService()
    mock_yt = MagicMock()
    service.yt = mock_yt
    mock_yt.get_song.side_effect = Exception("Video unavailable")

    with pytest.raises(ValueError, match="Could not load YouTube Music song"):
        service.resolve_track("bad_id")


# -----------------------------------------------------------------------------
# 4. /api/catalog/resolve Endpoint Logic & Guard Tests
# -----------------------------------------------------------------------------

def test_resolve_catalog_lines_matching_spotify_url():
    with patch.object(spotify_service, "resolve_track") as mock_resolve:
        mock_resolve.return_value = {
            "id": "sp_abc",
            "title": "Track Abc",
            "artist": "Artist Abc",
            "artists_list": ["Artist Abc"],
            "album": "Album Abc",
            "duration": "3:00",
            "duration_seconds": 180,
            "is_explicit": False,
            "thumbnail": "https://thumb.jpg",
            "video_url": "https://open.spotify.com/track/sp_abc",
            "verification_status": "unscanned",
            "source_platform": "spotify",
        }

        req = CatalogResolveRequest(
            lines=["https://open.spotify.com/track/sp_abc"],
            platform="spotify",
        )
        resp = resolve_catalog_lines(req)

        assert len(resp["resolved"]) == 1
        assert len(resp["unresolved"]) == 0
        assert resp["resolved"][0].id == "sp_abc"
        assert resp["resolved"][0].source_platform == "spotify"


def test_resolve_catalog_lines_cross_platform_detection():
    # YTM URL on Spotify platform
    req_spotify = CatalogResolveRequest(
        lines=[
            "https://music.youtube.com/watch?v=dQw4w9WgXcQ",
            "https://youtu.be/dQw4w9WgXcQ",
        ],
        platform="spotify",
    )
    resp_spotify = resolve_catalog_lines(req_spotify)
    assert len(resp_spotify["resolved"]) == 0
    assert len(resp_spotify["unresolved"]) == 2
    for item in resp_spotify["unresolved"]:
        assert item.reason == "wrong_platform"
        assert item.target_platform == "ytmusic"

    # Spotify URL on YTM platform
    req_ytm = CatalogResolveRequest(
        lines=[
            "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT",
            "spotify:track:4cOdK2wGLETKBW3PvgPWqT",
        ],
        platform="ytmusic",
    )
    resp_ytm = resolve_catalog_lines(req_ytm)
    assert len(resp_ytm["resolved"]) == 0
    assert len(resp_ytm["unresolved"]) == 2
    for item in resp_ytm["unresolved"]:
        assert item.reason == "wrong_platform"
        assert item.target_platform == "spotify"


def test_resolve_catalog_lines_plain_text_search_fallback():
    with patch.object(spotify_service, "search_catalog") as mock_search:
        mock_search.return_value = {
            "songs": [
                {
                    "id": "sp_brightside",
                    "title": "Mr. Brightside",
                    "artist": "The Killers",
                    "artists_list": ["The Killers"],
                    "album": "Hot Fuss",
                    "duration": "3:42",
                    "duration_seconds": 222,
                    "is_explicit": False,
                    "thumbnail": "https://img/hf.jpg",
                    "video_url": "https://open.spotify.com/track/sp_brightside",
                    "verification_status": "unscanned",
                    "source_platform": "spotify",
                }
            ],
            "albums": [],
        }

        req = CatalogResolveRequest(
            lines=["The Killers - Mr. Brightside"],
            platform="spotify",
        )
        resp = resolve_catalog_lines(req)

        assert len(resp["resolved"]) == 1
        assert len(resp["unresolved"]) == 0
        assert resp["resolved"][0].title == "Mr. Brightside"
        assert resp["resolved"][0].id == "sp_brightside"


def test_resolve_catalog_lines_not_found_handling():
    with patch.object(spotify_service, "resolve_track", side_effect=ValueError("Deleted")), \
         patch.object(spotify_service, "search_catalog", return_value={"songs": [], "albums": []}):

        req = CatalogResolveRequest(
            lines=[
                "https://open.spotify.com/track/deleted_id",
                "Nonexistent Track By Unknown Nobody 99999",
            ],
            platform="spotify",
        )
        resp = resolve_catalog_lines(req)

        assert len(resp["resolved"]) == 0
        assert len(resp["unresolved"]) == 2
        assert resp["unresolved"][0].reason == "not_found"
        assert resp["unresolved"][1].reason == "not_found"


def test_resolve_catalog_lines_batch_mixed_and_empty_lines():
    with patch.object(ytmusic_service, "resolve_track") as mock_yt_resolve, \
         patch.object(ytmusic_service, "search_catalog") as mock_yt_search:

        mock_yt_resolve.return_value = {
            "id": "yt_exact",
            "title": "Exact Song",
            "artist": "Exact Artist",
            "artists_list": ["Exact Artist"],
            "album": "",
            "duration": "2:30",
            "duration_seconds": 150,
            "is_explicit": False,
            "thumbnail": "https://img/exact.jpg",
            "video_url": "https://music.youtube.com/watch?v=yt_exact",
            "verification_status": "unscanned",
            "source_platform": "ytmusic",
        }

        mock_yt_search.side_effect = [
            # First search: found
            {
                "songs": [
                    {
                        "id": "yt_searched",
                        "title": "Searched Song",
                        "artist": "Search Artist",
                        "artists_list": ["Search Artist"],
                        "album": "",
                        "duration": "3:10",
                        "duration_seconds": 190,
                        "is_explicit": False,
                        "thumbnail": "https://img/search.jpg",
                        "video_url": "https://music.youtube.com/watch?v=yt_searched",
                        "verification_status": "unscanned",
                        "source_platform": "ytmusic",
                    }
                ],
                "albums": [],
            },
            # Second search: not found
            {"songs": [], "albums": []},
        ]

        req = CatalogResolveRequest(
            lines=[
                "   ",  # blank line: should be ignored
                "https://music.youtube.com/watch?v=yt_exact",  # matching URL
                "https://open.spotify.com/track/sp_other",  # cross-platform URL
                "Valid Search Query",  # found text search
                "Bogus Search Query",  # not found text search
                "",  # empty line: should be ignored
            ],
            platform="ytmusic",
        )
        resp = resolve_catalog_lines(req)

        # 2 resolved: exact URL and valid search query
        assert len(resp["resolved"]) == 2
        assert resp["resolved"][0].id == "yt_exact"
        assert resp["resolved"][1].id == "yt_searched"

        # 2 unresolved: cross-platform URL and bogus search query
        assert len(resp["unresolved"]) == 2
        assert resp["unresolved"][0].reason == "wrong_platform"
        assert resp["unresolved"][0].target_platform == "spotify"
        assert resp["unresolved"][1].reason == "not_found"


def test_resolve_catalog_lines_regional_spotify_url():
    with patch.object(spotify_service, "resolve_track") as mock_resolve:
        mock_resolve.return_value = {
            "id": "sp_intl_1",
            "title": "International Hit",
            "artist": "Artist",
            "artists_list": ["Artist"],
            "album": "Album",
            "duration": "3:10",
            "duration_seconds": 190,
            "is_explicit": False,
            "thumbnail": "https://thumb.jpg",
            "video_url": "https://open.spotify.com/intl-fr/track/sp_intl_1",
            "verification_status": "unscanned",
            "source_platform": "spotify",
        }

        req = CatalogResolveRequest(
            lines=["https://open.spotify.com/intl-fr/track/sp_intl_1"],
            platform="spotify",
        )
        resp = resolve_catalog_lines(req)

        assert len(resp["resolved"]) == 1
        assert resp["resolved"][0].id == "sp_intl_1"


def test_resolve_catalog_lines_unbounded_limit():
    # Model validation / endpoint check when > 50 lines
    too_many = [f"Song {i}" for i in range(51)]
    with pytest.raises((HTTPException, ValueError)):
        req = CatalogResolveRequest(lines=too_many, platform="spotify")
        resolve_catalog_lines(req)
