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

    with patch.object(spotify_service, "search_clean_replacements", side_effect=Exception("Unexpected boom")):
        resp = find_clean_replacement(req, mock_request, mock_response)
        assert resp["found"] is False
        assert resp["clean_candidate"] is None
        assert resp["clean_alternatives"] == []
        assert resp["lyrics_by_id"] == {}


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
        with patch.object(spotify_service, "search_clean_replacements") as mock_search:
            mock_search.return_value = [{"id": "clean_candidate_2"}]
            with patch.object(lyric_xref_service, "resolve_lyrics_and_yt_id", return_value=("yt_res_1", None)):
                resp = find_clean_replacement(req, mock_request, mock_response)
                mock_search.assert_called_once()
                _, kwargs = mock_search.call_args
                assert kwargs.get("exclude_track_id") == "flagged_sp_1"
                assert resp["clean_candidate"]["ytmusic_video_id"] == "yt_res_1"
                assert len(resp["clean_alternatives"]) == 1


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

    def mock_clean_search(title, artist, duration_seconds=0, sp_client=None, exclude_track_id=None, max_results=5):
        if "Track 1" in title:
            return [{
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
            }]
        return []

    def mock_xref(candidate, platform="spotify"):
        if candidate.get("id") == "sp_clean_1":
            return "yt_vid_clean_1", "These are the clean lyrics for track 1"
        return None, None

    with patch.object(spotify_service, "get_catalog_client"):
        with patch.object(spotify_service, "search_clean_replacements", side_effect=mock_clean_search):
            with patch.object(lyric_xref_service, "resolve_lyrics_and_yt_id", side_effect=mock_xref):
                response = find_batch_clean_replacements(req, mock_request, mock_response)

    assert "results" in response
    assert "alternatives" in response
    assert "lyrics_by_id" in response
    # Input order preserved
    assert list(response["results"].keys()) == ["sp_orig_1", "sp_orig_2"]
    assert list(response["alternatives"].keys()) == ["sp_orig_1", "sp_orig_2"]
    assert response["results"]["sp_orig_1"] is not None
    assert response["results"]["sp_orig_1"]["id"] == "sp_clean_1"
    assert response["results"]["sp_orig_1"]["ytmusic_video_id"] == "yt_vid_clean_1"
    assert response["results"]["sp_orig_2"] is None
    assert len(response["alternatives"]["sp_orig_1"]) == 1
    assert response["alternatives"]["sp_orig_2"] == []
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

    def mock_yt_clean(title, artist, duration_seconds=0, exclude_track_id=None, max_results=5):
        return [{
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
        }]

    with patch.object(ytmusic_service, "search_clean_replacements", side_effect=mock_yt_clean):
        with patch.object(lyric_xref_service, "resolve_lyrics_and_yt_id", return_value=("yt_clean_1", "Clean lyrics")):
            response = find_batch_clean_replacements(req, mock_request, mock_response)

    assert response["results"]["yt_orig_1"] is not None
    assert response["results"]["yt_orig_1"]["id"] == "yt_clean_1"
    assert len(response["alternatives"]["yt_orig_1"]) == 1
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


def test_endpoint_find_clean_replacement_returns_lyrics_by_id():
    mock_request = MagicMock(spec=Request)
    mock_response = MagicMock(spec=Response)

    req_sp = FindCleanReplacementRequest(
        title="Song",
        artist="Artist",
        duration_seconds=180,
        platform="spotify",
        track_id="flagged_sp_1",
    )

    with patch.object(spotify_service, "get_catalog_client"):
        with patch.object(spotify_service, "search_clean_replacements") as mock_search:
            mock_search.return_value = [{"id": "clean_candidate_2"}]
            with patch.object(lyric_xref_service, "resolve_lyrics_and_yt_id", return_value=("yt_res_1", "Clean lyrics text")):
                resp = find_clean_replacement(req_sp, mock_request, mock_response)
                assert resp["clean_candidate"]["ytmusic_video_id"] == "yt_res_1"
                assert resp["lyrics_by_id"] == {"clean_candidate_2": "Clean lyrics text"}

    req_yt = FindCleanReplacementRequest(
        title="Song",
        artist="Artist",
        duration_seconds=180,
        platform="ytmusic",
        track_id="flagged_yt_1",
    )

    with patch.object(ytmusic_service, "search_clean_replacements") as mock_search:
        mock_search.return_value = [{"id": "yt_clean_candidate_9"}]
        with patch.object(lyric_xref_service, "resolve_lyrics_and_yt_id", return_value=("yt_clean_candidate_9", "Clean YT lyrics")):
            resp = find_clean_replacement(req_yt, mock_request, mock_response)
            assert resp["found"] is True
            assert resp["clean_candidate"]["id"] == "yt_clean_candidate_9"
            assert resp["lyrics_by_id"] == {"yt_clean_candidate_9": "Clean YT lyrics"}


def test_endpoint_find_clean_replacement_empty_lyrics_by_id_when_unresolved():
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
        with patch.object(spotify_service, "search_clean_replacements") as mock_search:
            mock_search.return_value = [{"id": "clean_candidate_2"}]
            with patch.object(lyric_xref_service, "resolve_lyrics_and_yt_id", return_value=(None, None)):
                resp = find_clean_replacement(req, mock_request, mock_response)
                assert resp["found"] is True
                assert resp["lyrics_by_id"] == {}


# -----------------------------------------------------------------------------
# 7. Instrumental / Cover Penalty & Multi-Candidate Ranking
# -----------------------------------------------------------------------------

NORMALIZED_TRACK_KEYS = {
    "id",
    "title",
    "artist",
    "artists_list",
    "album",
    "duration",
    "duration_seconds",
    "is_explicit",
    "thumbnail",
    "video_url",
}


def _make_spotify_raw_track(track_id, name, duration_ms=200000, artist="Travis Scott", explicit=False):
    return {
        "id": track_id,
        "name": name,
        "explicit": explicit,
        "duration_ms": duration_ms,
        "artists": [{"name": artist}],
        "album": {"name": "Album", "images": [{"url": f"https://img/{track_id}.jpg"}]},
        "external_urls": {"spotify": f"https://open.spotify.com/track/{track_id}"},
    }


def _make_yt_raw_track(video_id, title, duration="3:20", artist="Travis Scott", explicit=False):
    return {
        "videoId": video_id,
        "title": title,
        "isExplicit": explicit,
        "duration": duration,
        "artists": [{"name": artist}],
        "album": {"name": "Album"},
        "thumbnails": [{"url": f"https://img/{video_id}.jpg"}],
    }


def test_spotify_instrumental_penalty_clean_outranks_cover():
    service = SpotifyService()
    mock_sp = MagicMock()

    instrumental = _make_spotify_raw_track("sp_inst", "SICKO MODE (Instrumental)", duration_ms=312000)
    clean_vocal = _make_spotify_raw_track("sp_clean", "SICKO MODE - Clean", duration_ms=314000)  # 2s diff
    karaoke = _make_spotify_raw_track("sp_kar", "SICKO MODE (Karaoke Version)", duration_ms=312000)
    tribute = _make_spotify_raw_track("sp_trib", "SICKO MODE (Tribute)", duration_ms=312000)
    lullaby = _make_spotify_raw_track("sp_lull", "SICKO MODE (Lullaby)", duration_ms=312000)
    eight_bit = _make_spotify_raw_track("sp_8bit", "SICKO MODE (8-Bit)", duration_ms=312000)

    mock_sp.search.return_value = {
        "tracks": {"items": [instrumental, karaoke, tribute, lullaby, eight_bit, clean_vocal]}
    }

    candidates = service.search_clean_replacements(
        title="SICKO MODE",
        artist="Travis Scott",
        duration_seconds=312,
        sp_client=mock_sp,
        max_results=5,
    )

    assert len(candidates) == 5
    assert candidates[0]["id"] == "sp_clean"
    assert candidates[0]["confidence_score"] == 118  # 100 - 2 + 20
    # All penalized candidates have -45 applied (100 - 0 - 45 = 55)
    for c in candidates[1:]:
        assert c["confidence_score"] == 55


def test_spotify_instrumental_exemption_when_original_is_instrumental():
    service = SpotifyService()
    mock_sp = MagicMock()

    cand = _make_spotify_raw_track(
        "sp_clair", "Clair de Lune (Instrumental)", duration_ms=300000, artist="Debussy"
    )
    mock_sp.search.return_value = {"tracks": {"items": [cand]}}

    candidates = service.search_clean_replacements(
        title="Clair de Lune (Instrumental)",
        artist="Debussy",
        duration_seconds=300,
        sp_client=mock_sp,
        max_results=5,
    )

    assert len(candidates) == 1
    assert candidates[0]["id"] == "sp_clair"
    assert candidates[0]["confidence_score"] == 100


def test_ytmusic_instrumental_penalty_and_exemption():
    service = YTMusicService()
    service.yt = MagicMock()

    inst = _make_yt_raw_track("yt_inst", "SICKO MODE (Instrumental)", duration="5:12")
    clean = _make_yt_raw_track("yt_clean", "SICKO MODE - Clean", duration="5:14")
    service.yt.search.return_value = [inst, clean]

    candidates = service.search_clean_replacements(
        title="SICKO MODE",
        artist="Travis Scott",
        duration_seconds=312,
        max_results=5,
    )
    assert candidates[0]["id"] == "yt_clean"
    assert candidates[0]["confidence_score"] == 118
    assert candidates[1]["id"] == "yt_inst"
    assert candidates[1]["confidence_score"] == 55

    # Exemption when original title contains instrumental
    clair = _make_yt_raw_track("yt_clair", "Clair de Lune (Instrumental)", duration="5:00", artist="Debussy")
    service.yt.search.return_value = [clair]
    exempt_cands = service.search_clean_replacements(
        title="Clair de Lune (Instrumental)",
        artist="Debussy",
        duration_seconds=300,
        max_results=5,
    )
    assert len(exempt_cands) == 1
    assert exempt_cands[0]["confidence_score"] == 100


def test_spotify_search_clean_replacements_cross_tier_dedupe_top_5():
    service = SpotifyService()
    mock_sp = MagicMock()

    t1 = [_make_spotify_raw_track("c1", "Song (Clean)", 200000), _make_spotify_raw_track("c2", "Song", 205000)]
    t2 = [
        _make_spotify_raw_track("c2", "Song", 205000),  # duplicate
        _make_spotify_raw_track("c3", "Song (Radio Edit)", 201000),
        _make_spotify_raw_track("c4", "Song (Edited)", 202000),
    ]
    t3 = [
        _make_spotify_raw_track("c5", "Song (Album Version)", 203000),
        _make_spotify_raw_track("c6", "Song (Instrumental)", 200000),
    ]
    mock_sp.search.side_effect = [
        {"tracks": {"items": t1}},
        {"tracks": {"items": t2}},
        {"tracks": {"items": t3}},
    ]

    candidates = service.search_clean_replacements(
        title="Song",
        artist="Travis Scott",
        duration_seconds=200,
        sp_client=mock_sp,
        max_results=5,
    )

    assert len(candidates) == 5
    ids = [c["id"] for c in candidates]
    assert len(set(ids)) == 5
    # Highest scored first: c1 (120), c3 (119), c4 (98), c5 (97), c2 (95) — c6 (55) dropped
    assert ids == ["c1", "c3", "c4", "c5", "c2"]
    for c in candidates:
        assert NORMALIZED_TRACK_KEYS.issubset(c.keys())


def test_ytmusic_search_clean_replacements_cross_tier_dedupe_top_5():
    service = YTMusicService()
    service.yt = MagicMock()

    q1 = [_make_yt_raw_track("y1", "Song (Clean)", "3:20"), _make_yt_raw_track("y2", "Song", "3:25")]
    q2 = [
        _make_yt_raw_track("y2", "Song", "3:25"),  # duplicate
        _make_yt_raw_track("y3", "Song (Radio Edit)", "3:21"),
        _make_yt_raw_track("y4", "Song (Edited)", "3:22"),
    ]
    q3 = [
        _make_yt_raw_track("y5", "Song (Acoustic)", "3:23"),
        _make_yt_raw_track("y6", "Song (Karaoke)", "3:20"),
    ]
    service.yt.search.side_effect = [q1, q2, q3]

    candidates = service.search_clean_replacements(
        title="Song",
        artist="Travis Scott",
        duration_seconds=200,
        max_results=5,
    )

    assert len(candidates) == 5
    ids = [c["id"] for c in candidates]
    assert len(set(ids)) == 5
    assert ids == ["y1", "y3", "y4", "y5", "y2"]
    for c in candidates:
        assert NORMALIZED_TRACK_KEYS.issubset(c.keys())


def test_endpoint_find_returns_clean_alternatives_and_resolves_lyrics_for_top_only():
    mock_request = MagicMock(spec=Request)
    mock_response = MagicMock(spec=Response)

    req = FindCleanReplacementRequest(
        title="Song",
        artist="Artist",
        duration_seconds=180,
        platform="spotify",
        track_id="orig_1",
    )

    cands = [
        {"id": "c0", "title": "Song (Clean)"},
        {"id": "c1", "title": "Song (Radio Edit)"},
        {"id": "c2", "title": "Song (Edited)"},
        {"id": "c3", "title": "Song (Instrumental)"},
    ]

    with patch.object(spotify_service, "get_catalog_client"):
        with patch.object(spotify_service, "search_clean_replacements", return_value=cands):
            with patch.object(
                lyric_xref_service, "resolve_lyrics_and_yt_id", return_value=("yt_c0", "Clean lyrics")
            ) as mock_xref:
                resp = find_clean_replacement(req, mock_request, mock_response)

    assert resp["found"] is True
    assert resp["clean_candidate"]["id"] == "c0"
    assert [c["id"] for c in resp["clean_alternatives"]] == ["c0", "c1", "c2", "c3"]
    assert resp["lyrics_by_id"] == {"c0": "Clean lyrics"}
    # Lyrics resolved ONLY for candidate #1
    mock_xref.assert_called_once()
    assert mock_xref.call_args.args[0]["id"] == "c0"


def test_endpoint_find_batch_returns_alternatives_and_isolates_per_track_errors():
    tracks = [
        TrackScanItem(id="t1", title="Track 1", artist="Artist", duration_seconds=200, is_explicit=True),
        TrackScanItem(id="t2", title="Track 2", artist="Artist", duration_seconds=200, is_explicit=True),
        TrackScanItem(id="t3", title="Track 3", artist="Artist", duration_seconds=200, is_explicit=True),
    ]
    req = FindBatchCleanReplacementRequest(tracks=tracks, platform="spotify")
    mock_request = MagicMock(spec=Request)
    mock_response = MagicMock(spec=Response)

    def mock_search(title, artist, duration_seconds=0, sp_client=None, exclude_track_id=None, max_results=5):
        if title == "Track 1":
            return [
                {"id": "t1_c0", "title": "Track 1 (Clean)"},
                {"id": "t1_c1", "title": "Track 1 (Radio Edit)"},
                {"id": "t1_c2", "title": "Track 1 (Instrumental)"},
            ]
        if title == "Track 2":
            return []
        raise RuntimeError("Upstream boom for Track 3")

    with patch.object(spotify_service, "get_catalog_client"):
        with patch.object(spotify_service, "search_clean_replacements", side_effect=mock_search):
            with patch.object(
                lyric_xref_service, "resolve_lyrics_and_yt_id", return_value=("yt_t1_c0", "T1 clean lyrics")
            ) as mock_xref:
                resp = find_batch_clean_replacements(req, mock_request, mock_response)

    assert list(resp["results"].keys()) == ["t1", "t2", "t3"]
    assert list(resp["alternatives"].keys()) == ["t1", "t2", "t3"]
    assert resp["results"]["t1"]["id"] == "t1_c0"
    assert [c["id"] for c in resp["alternatives"]["t1"]] == ["t1_c0", "t1_c1", "t1_c2"]
    assert resp["results"]["t2"] is None
    assert resp["alternatives"]["t2"] == []
    assert resp["results"]["t3"] is None
    assert resp["alternatives"]["t3"] == []
    assert resp["lyrics_by_id"] == {"t1_c0": "T1 clean lyrics"}
    # Lyrics resolved ONLY for top candidate of t1
    mock_xref.assert_called_once()
    assert mock_xref.call_args.args[0]["id"] == "t1_c0"


def test_spotify_penalized_covers_in_tier1_fall_through_to_tier2():
    service = SpotifyService()
    mock_sp = MagicMock()

    tier1_covers = [
        _make_spotify_raw_track(f"cov_{i}", f"SICKO MODE (Instrumental {i})", duration_ms=312000)
        for i in range(5)
    ]
    tier2_clean = [_make_spotify_raw_track("real_clean", "SICKO MODE - Clean", duration_ms=312000)]

    mock_sp.search.side_effect = [
        {"tracks": {"items": tier1_covers}},
        {"tracks": {"items": tier2_clean}},
        {"tracks": {"items": []}},
        {"tracks": {"items": []}},
    ]

    candidates = service.search_clean_replacements(
        title="SICKO MODE",
        artist="Travis Scott",
        duration_seconds=312,
        sp_client=mock_sp,
        max_results=5,
    )

    assert mock_sp.search.call_count >= 2
    assert candidates[0]["id"] == "real_clean"
    assert candidates[0]["confidence_score"] == 120


def test_word_boundary_non_penalty_and_album_name_penalty():
    sp_service = SpotifyService()
    mock_sp = MagicMock()

    retribution = _make_spotify_raw_track("sp_retrib", "Retribution", duration_ms=200000, artist="Artist")
    tribute_album = _make_spotify_raw_track("sp_trib_alb", "Hit Song", duration_ms=200000, artist="Artist")
    tribute_album["album"]["name"] = "Artist Tribute Collection"
    mock_sp.search.return_value = {"tracks": {"items": [retribution, tribute_album]}}

    sp_cands = sp_service.search_clean_replacements(
        title="Retribution",
        artist="Artist",
        duration_seconds=200,
        sp_client=mock_sp,
        max_results=5,
    )
    by_id = {c["id"]: c for c in sp_cands}
    # "Retribution" contains substring "tribute" but NOT word-boundary "tribute" -> no penalty
    assert by_id["sp_retrib"]["confidence_score"] == 100
    # Album name contains word "Tribute" -> -45 penalty
    assert by_id["sp_trib_alb"]["confidence_score"] == 55

    # YTMusic word-boundary & album-name parity
    yt_service = YTMusicService()
    yt_service.yt = MagicMock()
    yt_retrib = _make_yt_raw_track("yt_retrib", "Retribution", duration="3:20", artist="Artist")
    yt_trib_alb = _make_yt_raw_track("yt_trib_alb", "Hit Song", duration="3:20", artist="Artist")
    yt_trib_alb["album"] = {"name": "Artist Tribute Collection"}
    yt_service.yt.search.return_value = [yt_retrib, yt_trib_alb]

    yt_cands = yt_service.search_clean_replacements(
        title="Retribution",
        artist="Artist",
        duration_seconds=200,
        max_results=5,
    )
    yt_by_id = {c["id"]: c for c in yt_cands}
    assert yt_by_id["yt_retrib"]["confidence_score"] == 100
    assert yt_by_id["yt_trib_alb"]["confidence_score"] == 55


def test_max_results_zero_clamps_to_one():
    sp_service = SpotifyService()
    mock_sp = MagicMock()
    mock_sp.search.return_value = {
        "tracks": {
            "items": [
                _make_spotify_raw_track("s1", "Song (Clean)", 200000),
                _make_spotify_raw_track("s2", "Song (Radio Edit)", 200000),
            ]
        }
    }
    res_sp = sp_service.search_clean_replacements(
        title="Song", artist="Artist", duration_seconds=200, sp_client=mock_sp, max_results=0
    )
    assert len(res_sp) == 1

    yt_service = YTMusicService()
    yt_service.yt = MagicMock()
    yt_service.yt.search.return_value = [
        _make_yt_raw_track("y1", "Song (Clean)", "3:20"),
        _make_yt_raw_track("y2", "Song (Radio Edit)", "3:20"),
    ]
    res_yt = yt_service.search_clean_replacements(
        title="Song", artist="Artist", duration_seconds=200, max_results=0
    )
    assert len(res_yt) == 1
