"""Unit tests for Resilient Clean Replacement Search Engine & Batch Endpoints (Story 3.1)."""

import pytest
from unittest.mock import MagicMock, patch
from fastapi import HTTPException, Request, Response
from spotipy import SpotifyException

from app.main import (
    app,
    TrackScanItem,
    FindCleanReplacementRequest,
    FindBatchCleanReplacementRequest,
    find_clean_replacement,
    find_batch_clean_replacements,
)
from app.services.spotify_service import SpotifyService, spotify_service, extract_primary_artist
from app.services.ytmusic_service import YTMusicService, ytmusic_service
from app.services.lyric_xref_service import lyric_xref_service


# -----------------------------------------------------------------------------
# 1. Route Registration Checks
# -----------------------------------------------------------------------------

def test_replacement_routes_registered():
    paths = {getattr(r, "path", None): getattr(r, "methods", set()) for r in app.routes}
    assert "/api/replacements/find" in paths
    assert "POST" in paths["/api/replacements/find"]
    assert "/api/replacements/find-batch" in paths
    assert "POST" in paths["/api/replacements/find-batch"]


# -----------------------------------------------------------------------------
# 2. Scenario 1: Long Metadata & Guest List Query Normalization
# -----------------------------------------------------------------------------

def test_spotify_query_sanitization_and_artist_extraction():
    service = SpotifyService()
    mock_sp = MagicMock()

    long_title = "Triumph (feat. Ol' Dirty Bastard, Inspectah Deck, Method Man, Cappadonna, U-God, RZA, GZA, Masta Killa, Ghostface Killah & Raekwon)"
    long_artist = "Wu-Tang Clan, Ol' Dirty Bastard, Inspectah Deck, Method Man, Cappadonna, U-God, RZA, GZA, Masta Killa, Ghostface Killah, Raekwon"

    # Mock empty track list so all cascade tiers are queried
    mock_sp.search.return_value = {"tracks": {"items": []}}

    service.search_clean_replacement(
        title=long_title,
        artist=long_artist,
        duration_seconds=326,
        sp_client=mock_sp,
    )

    queries = [
        call_args.kwargs.get("q") or (call_args.args[0] if call_args.args else "")
        for call_args in mock_sp.search.call_args_list
    ]
    assert len(queries) == 4
    # All queries are <= 200 chars
    for q in queries:
        assert len(q) <= 200, f"Query '{q}' exceeds 200 character ceiling ({len(q)} chars)"
        assert "Inspectah Deck" not in q

    # Tiers 1-3 contain primary artist and clean title
    for q in queries[:3]:
        assert "Wu-Tang Clan" in q
        assert "Triumph" in q

    # Tier 4 is title only
    assert queries[3] == 'track:"Triumph"'


def test_spotify_hard_200_character_bound_on_extraordinary_title():
    service = SpotifyService()
    mock_sp = MagicMock()

    # Extreme title > 250 characters with no parentheticals
    giant_title = "A" * 240
    mock_sp.search.return_value = {"tracks": {"items": []}}

    service.search_clean_replacement(
        title=giant_title,
        artist="Artist",
        duration_seconds=180,
        sp_client=mock_sp,
    )

    for call_args in mock_sp.search.call_args_list:
        q = call_args.kwargs.get("q") or (call_args.args[0] if call_args.args else "")
        assert len(q) <= 200


def test_artist_extraction_preserves_bands_with_delimiters():
    assert extract_primary_artist("AC/DC, Bon Scott") == "AC/DC"
    assert extract_primary_artist("Simon & Garfunkel, Dave") == "Simon & Garfunkel"
    assert extract_primary_artist("Eminem feat. Rihanna") == "Eminem"
    assert extract_primary_artist("Drake ft. Future") == "Drake"


# -----------------------------------------------------------------------------
# 3. Scenario 2: Multi-Tier Search Cascade
# -----------------------------------------------------------------------------

def test_multi_tier_fallback_cascade_hits_secondary_tier():
    service = SpotifyService()
    mock_sp = MagicMock()

    # Tier 1 (Fielded): 0 results
    # Tier 2 (Unfielded Keyword): clean track candidate found
    tier1_response = {"tracks": {"items": []}}
    clean_candidate_raw = {
        "id": "clean_track_1",
        "name": "Clean Song",
        "explicit": False,
        "duration_ms": 182000,  # 3:02 (diff 2s from 180s)
        "artists": [{"name": "Lead Artist"}],
        "album": {"name": "Clean Album", "images": [{"url": "http://img.jpg"}]},
        "external_urls": {"spotify": "https://open.spotify.com/track/clean_track_1"},
    }
    tier2_response = {"tracks": {"items": [clean_candidate_raw]}}

    mock_sp.search.side_effect = [tier1_response, tier2_response]

    res = service.search_clean_replacement(
        title="Explicit Song (feat. Extra)",
        artist="Lead Artist, Extra",
        duration_seconds=180,
        sp_client=mock_sp,
    )

    assert mock_sp.search.call_count == 2
    assert res is not None
    assert res["id"] == "clean_track_1"
    assert res["is_explicit"] is False
    assert res["duration_seconds"] == 182
    assert res["album"] == "Clean Album"
    assert res["artists_list"] == ["Lead Artist"]
    assert res["source_platform"] == "spotify"
    assert res["verification_status"] == "clean"


def test_candidate_scoring_and_duration_threshold():
    service = SpotifyService()
    mock_sp = MagicMock()

    # Two clean candidates: one normal, one with "Radio Edit" tag (+20 score bonus)
    # Target duration: 200s
    candidate_far_duration = {
        "id": "far_track",
        "name": "Some Song",
        "explicit": False,
        "duration_ms": 250000,  # diff 50s > 35s limit -> should be excluded
        "artists": [{"name": "Artist"}],
        "album": {"name": "Album", "images": []},
        "external_urls": {},
    }
    candidate_radio_edit = {
        "id": "radio_track",
        "name": "Some Song (Radio Edit)",
        "explicit": False,
        "duration_ms": 202000,  # diff 2s -> score = 100 - 2 + 20 = 118
        "artists": [{"name": "Artist"}],
        "album": {"name": "Album", "images": []},
        "external_urls": {},
    }
    candidate_standard = {
        "id": "standard_track",
        "name": "Some Song",
        "explicit": False,
        "duration_ms": 200000,  # diff 0s -> score = 100
        "artists": [{"name": "Artist"}],
        "album": {"name": "Album", "images": []},
        "external_urls": {},
    }

    mock_sp.search.return_value = {
        "tracks": {"items": [candidate_far_duration, candidate_standard, candidate_radio_edit]}
    }

    res = service.search_clean_replacement(
        title="Some Song",
        artist="Artist",
        duration_seconds=200,
        sp_client=mock_sp,
    )

    assert res is not None
    assert res["id"] == "radio_track"
    assert res["confidence_score"] == 118


def test_tier_4_validates_artist_alignment():
    service = SpotifyService()
    mock_sp = MagicMock()

    # Tiers 1-3 empty
    empty = {"tracks": {"items": []}}
    # Tier 4 returns track with same title but completely different artist
    wrong_artist_track = {
        "id": "wrong_artist",
        "name": "Hello",
        "explicit": False,
        "duration_ms": 200000,
        "artists": [{"name": "Completely Different Artist"}],
        "album": {"name": "Album", "images": []},
        "external_urls": {},
    }
    mock_sp.search.side_effect = [empty, empty, empty, {"tracks": {"items": [wrong_artist_track]}}]

    res = service.search_clean_replacement(
        title="Hello",
        artist="Adele",
        duration_seconds=200,
        sp_client=mock_sp,
    )
    # Rejected because artist does not align
    assert res is None


# -----------------------------------------------------------------------------
# 4. Scenario 3: Defensive Error Isolation
# -----------------------------------------------------------------------------

def test_defensive_error_isolation_tier_spotify_exception():
    service = SpotifyService()
    mock_sp = MagicMock()

    # Tier 1 throws SpotifyException 400
    # Tier 2 succeeds
    clean_track = {
        "id": "clean_recovery",
        "name": "Recovery",
        "explicit": False,
        "duration_ms": 200000,
        "artists": [{"name": "Artist"}],
        "album": {"name": "Album", "images": []},
        "external_urls": {},
    }

    spotify_400 = SpotifyException(http_status=400, code=-1, msg="Query exceeds maximum length")
    mock_sp.search.side_effect = [spotify_400, {"tracks": {"items": [clean_track]}}]

    res = service.search_clean_replacement(
        title="Recovery",
        artist="Artist",
        duration_seconds=200,
        sp_client=mock_sp,
    )

    assert res is not None
    assert res["id"] == "clean_recovery"


def test_defensive_error_isolation_all_tiers_fail_returns_none():
    service = SpotifyService()
    mock_sp = MagicMock()

    spotify_500 = SpotifyException(http_status=500, code=-1, msg="Server Error")
    mock_sp.search.side_effect = spotify_500

    res = service.search_clean_replacement(
        title="Song",
        artist="Artist",
        duration_seconds=200,
        sp_client=mock_sp,
    )

    assert res is None


def test_endpoint_defensive_isolation_returns_found_false():
    mock_request = MagicMock(spec=Request)
    mock_response = MagicMock(spec=Response)

    req = FindCleanReplacementRequest(
        title="Problem Song",
        artist="Artist",
        duration_seconds=180,
        platform="spotify",
    )

    with patch.object(spotify_service, "search_clean_replacement", side_effect=Exception("Unexpected boom")):
        resp = find_clean_replacement(req, mock_request, mock_response)
        assert resp["found"] is False
        assert resp["clean_candidate"] is None


# -----------------------------------------------------------------------------
# 5. Scenario 4: Self-Swap Prevention (`exclude_track_id`)
# -----------------------------------------------------------------------------

def test_spotify_self_swap_prevention():
    service = SpotifyService()
    mock_sp = MagicMock()

    # Candidate 1 has the same track ID as the original flagged track
    # Candidate 2 is an alternate clean release
    self_track = {
        "id": "flagged_track_999",
        "name": "Vulgar But Marked Clean In Catalog",
        "explicit": False,
        "duration_ms": 200000,
        "artists": [{"name": "Artist"}],
        "album": {"name": "Explicit Album", "images": []},
        "external_urls": {},
    }
    alternate_clean = {
        "id": "alternate_clean_888",
        "name": "Clean Version",
        "explicit": False,
        "duration_ms": 200000,
        "artists": [{"name": "Artist"}],
        "album": {"name": "Clean Album", "images": []},
        "external_urls": {},
    }

    mock_sp.search.return_value = {"tracks": {"items": [self_track, alternate_clean]}}

    res = service.search_clean_replacement(
        title="Vulgar Song",
        artist="Artist",
        duration_seconds=200,
        sp_client=mock_sp,
        exclude_track_id="flagged_track_999",
    )

    assert res is not None
    assert res["id"] == "alternate_clean_888"
    assert res["id"] != "flagged_track_999"


def test_ytmusic_self_swap_prevention():
    service = YTMusicService()
    service.yt = MagicMock()

    self_track = {
        "videoId": "yt_flagged_1",
        "title": "Vulgar Song",
        "isExplicit": False,
        "duration": "3:20",
        "artists": [{"name": "Artist"}],
        "thumbnails": [{"url": "http://img.jpg"}],
    }
    clean_track = {
        "videoId": "yt_clean_2",
        "title": "Vulgar Song (Clean)",
        "isExplicit": False,
        "duration": "3:20",
        "artists": [{"name": "Artist"}],
        "thumbnails": [{"url": "http://img.jpg"}],
    }

    service.yt.search.return_value = [self_track, clean_track]

    res = service.search_clean_replacement(
        title="Vulgar Song",
        artist="Artist",
        duration_seconds=200,
        exclude_track_id="yt_flagged_1",
    )

    assert res is not None
    assert res["id"] == "yt_clean_2"
    assert res["id"] != "yt_flagged_1"
    assert res["source_platform"] == "ytmusic"
    assert res["verification_status"] == "clean"
    assert res["ytmusic_video_id"] == "yt_clean_2"


def test_endpoint_find_clean_replacement_passes_exclude_id():
    mock_request = MagicMock(spec=Request)
    mock_response = MagicMock(spec=Response)

    req = FindCleanReplacementRequest(
        title="Song",
        artist="Artist",
        duration_seconds=180,
        platform="spotify",
        track_id="flagged_sp_1",
    )

    with patch.object(spotify_service, "get_catalog_client"):
        with patch.object(spotify_service, "search_clean_replacement") as mock_search:
            mock_search.return_value = {"id": "clean_candidate_2"}
            with patch.object(lyric_xref_service, "resolve_lyrics_and_yt_id", return_value=("yt_res_1", None)):
                resp = find_clean_replacement(req, mock_request, mock_response)
                mock_search.assert_called_once()
                _, kwargs = mock_search.call_args
                assert kwargs.get("exclude_track_id") == "flagged_sp_1"
                assert resp["clean_candidate"]["ytmusic_video_id"] == "yt_res_1"


# -----------------------------------------------------------------------------
# 6. Scenario 5: Batch Replacement Endpoint (`POST /api/replacements/find-batch`)
# -----------------------------------------------------------------------------

def test_find_batch_replacements_spotify_success():
    tracks = [
        TrackScanItem(
            id="sp_orig_1",
            title="Explicit Track 1",
            artist="Artist 1",
            duration_seconds=200,
            is_explicit=True,
        ),
        TrackScanItem(
            id="sp_orig_2",
            title="Explicit Track 2",
            artist="Artist 2",
            duration_seconds=180,
            is_explicit=True,
        ),
    ]

    req = FindBatchCleanReplacementRequest(tracks=tracks, platform="spotify")
    mock_request = MagicMock(spec=Request)
    mock_response = MagicMock(spec=Response)

    def mock_clean_search(title, artist, duration_seconds=0, sp_client=None, exclude_track_id=None):
        if "Track 1" in title:
            return {
                "id": "sp_clean_1",
                "title": "Clean Track 1",
                "artist": "Artist 1",
                "artists_list": ["Artist 1"],
                "album": "Clean Album 1",
                "duration": "3:20",
                "duration_seconds": 200,
                "is_explicit": False,
                "thumbnail": "http://img1.jpg",
                "video_url": "https://open.spotify.com/track/sp_clean_1",
                "confidence_score": 100,
            }
        return None

    def mock_xref(candidate, platform="spotify"):
        if candidate.get("id") == "sp_clean_1":
            return "yt_vid_clean_1", "These are the clean lyrics for track 1"
        return None, None

    with patch.object(spotify_service, "get_catalog_client"):
        with patch.object(spotify_service, "search_clean_replacement", side_effect=mock_clean_search):
            with patch.object(lyric_xref_service, "resolve_lyrics_and_yt_id", side_effect=mock_xref):
                response = find_batch_clean_replacements(req, mock_request, mock_response)

    assert "results" in response
    assert "lyrics_by_id" in response
    # Input order preserved
    assert list(response["results"].keys()) == ["sp_orig_1", "sp_orig_2"]
    assert response["results"]["sp_orig_1"] is not None
    assert response["results"]["sp_orig_1"]["id"] == "sp_clean_1"
    assert response["results"]["sp_orig_1"]["ytmusic_video_id"] == "yt_vid_clean_1"
    assert response["results"]["sp_orig_2"] is None
    assert response["lyrics_by_id"]["sp_clean_1"] == "These are the clean lyrics for track 1"


def test_find_batch_replacements_ytmusic_success():
    tracks = [
        TrackScanItem(
            id="yt_orig_1",
            title="Explicit YT 1",
            artist="Artist YT",
            duration_seconds=190,
            is_explicit=True,
        ),
    ]

    req = FindBatchCleanReplacementRequest(tracks=tracks, platform="ytmusic")
    mock_request = MagicMock(spec=Request)
    mock_response = MagicMock(spec=Response)

    def mock_yt_clean(title, artist, duration_seconds=0, exclude_track_id=None):
        return {
            "id": "yt_clean_1",
            "title": "Clean YT 1",
            "artist": "Artist YT",
            "duration": "3:10",
            "duration_seconds": 190,
            "is_explicit": False,
            "thumbnail": "http://yt.jpg",
            "video_url": "https://music.youtube.com/watch?v=yt_clean_1",
            "confidence_score": 100,
            "source_platform": "ytmusic",
            "verification_status": "clean",
            "ytmusic_video_id": "yt_clean_1",
        }

    with patch.object(ytmusic_service, "search_clean_replacement", side_effect=mock_yt_clean):
        with patch.object(lyric_xref_service, "resolve_lyrics_and_yt_id", return_value=("yt_clean_1", "Clean lyrics")):
            response = find_batch_clean_replacements(req, mock_request, mock_response)

    assert response["results"]["yt_orig_1"] is not None
    assert response["results"]["yt_orig_1"]["id"] == "yt_clean_1"
    assert response["lyrics_by_id"]["yt_clean_1"] == "Clean lyrics"


def test_find_batch_replacements_over_10_tracks_rejected():
    tracks = [
        TrackScanItem(id=f"t_{i}", title=f"Track {i}", artist="Artist")
        for i in range(11)
    ]
    req = FindBatchCleanReplacementRequest(tracks=tracks, platform="spotify")
    mock_request = MagicMock(spec=Request)
    mock_response = MagicMock(spec=Response)

    with pytest.raises(HTTPException) as exc_info:
        find_batch_clean_replacements(req, mock_request, mock_response)

    assert exc_info.value.status_code == 400
    assert "10" in exc_info.value.detail
