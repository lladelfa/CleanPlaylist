"""Tests for multi-source stitcher service and POST /api/stitch endpoint."""

import pytest
from app.main import app, StitchRequest, stitch_playlists_endpoint
from app.services.stitcher_service import stitcher_service


def test_stitch_route_registered():
    """Verify /api/stitch is registered with POST method."""
    paths = {getattr(r, "path", None): getattr(r, "methods", set()) for r in app.routes}
    assert "/api/stitch" in paths
    assert "POST" in paths["/api/stitch"]


def test_order_modes():
    """Verify sequential, interleave, title_asc, and artist_asc ordering."""
    p1 = {
        "title": "Rock",
        "tracks": [
            {"id": "r1", "title": "Zebra", "artist": "Beta"},
            {"id": "r2", "title": "Apple", "artist": "Alpha"},
        ],
    }
    p2 = {
        "title": "Jazz",
        "tracks": [
            {"id": "j1", "title": "Mango", "artist": "Delta"},
            {"id": "j2", "title": "Berry", "artist": "Charlie"},
        ],
    }

    # Sequential
    res_seq = stitcher_service.stitch_playlists(
        playlists=[p1, p2],
        order_mode="sequential",
        deduplication_mode="none",
        clean_mode="keep_all",
    )
    assert [t["id"] for t in res_seq["tracks"]] == ["r1", "r2", "j1", "j2"]
    assert res_seq["tracks"][0]["source_playlist_title"] == "Rock"
    assert res_seq["tracks"][2]["source_playlist_title"] == "Jazz"
    assert [t["stitched_index"] for t in res_seq["tracks"]] == [1, 2, 3, 4]

    # Interleave
    res_int = stitcher_service.stitch_playlists(
        playlists=[p1, p2],
        order_mode="interleave",
        deduplication_mode="none",
        clean_mode="keep_all",
    )
    assert [t["id"] for t in res_int["tracks"]] == ["r1", "j1", "r2", "j2"]

    # Title ASC
    res_title = stitcher_service.stitch_playlists(
        playlists=[p1, p2],
        order_mode="title_asc",
        deduplication_mode="none",
        clean_mode="keep_all",
    )
    assert [t["title"] for t in res_title["tracks"]] == ["Apple", "Berry", "Mango", "Zebra"]

    # Artist ASC
    res_artist = stitcher_service.stitch_playlists(
        playlists=[p1, p2],
        order_mode="artist_asc",
        deduplication_mode="none",
        clean_mode="keep_all",
    )
    assert [t["artist"] for t in res_artist["tracks"]] == ["Alpha", "Beta", "Charlie", "Delta"]


def test_deduplication_modes():
    """Verify exact_id, title_artist, and none deduplication."""
    tracks = [
        {"id": "t1", "title": "Song One", "artist": "Artist A"},
        {"id": "t1", "title": "Song One (Remastered)", "artist": "Artist A"},  # exact id dupe
        {"id": "t2", "title": "Song Two", "artist": "Artist B"},
        {"id": "t3", "title": "Song Two [Clean]", "artist": "Artist B"},  # title_artist dupe
    ]
    p = {"title": "Mix", "tracks": tracks}

    # exact_id
    res_exact = stitcher_service.stitch_playlists(
        playlists=[p],
        order_mode="sequential",
        deduplication_mode="exact_id",
        clean_mode="keep_all",
    )
    assert len(res_exact["tracks"]) == 3
    assert [t["id"] for t in res_exact["tracks"]] == ["t1", "t2", "t3"]
    assert res_exact["summary"]["duplicates_removed"] == 1

    # title_artist
    res_norm = stitcher_service.stitch_playlists(
        playlists=[p],
        order_mode="sequential",
        deduplication_mode="title_artist",
        clean_mode="keep_all",
    )
    assert len(res_norm["tracks"]) == 2
    assert [t["id"] for t in res_norm["tracks"]] == ["t1", "t2"]
    assert res_norm["summary"]["duplicates_removed"] == 2

    # none
    res_none = stitcher_service.stitch_playlists(
        playlists=[p],
        order_mode="sequential",
        deduplication_mode="none",
        clean_mode="keep_all",
    )
    assert len(res_none["tracks"]) == 4
    assert res_none["summary"]["duplicates_removed"] == 0


def test_verification_status_priority_and_clean_modes():
    """Verify verification_status priority over raw metadata and clean replacement stamping."""
    clean_replacement_track = {
        "id": "clean_rep_1",
        "title": "Explicit Track (Clean Edit)",
        "artist": "Artist E",
        "is_explicit": False,
    }

    tracks = [
        # 1. Flagged via verification_status (even if is_flagged / is_explicit is False)
        {
            "id": "t_flagged",
            "title": "Explicit Track",
            "artist": "Artist E",
            "verification_status": "flagged",
            "is_flagged": False,
            "is_explicit": False,
        },
        # 2. Verified clean via verification_status (even if is_explicit is True in metadata)
        {
            "id": "t_clean",
            "title": "Clean Track",
            "artist": "Artist C",
            "verification_status": "verified_clean",
            "is_explicit": True,
        },
        # 3. Unswappable flagged track (verification_status unset, fallback to is_explicit)
        {
            "id": "t_unswappable",
            "title": "Unswappable Vulgar",
            "artist": "Artist V",
            "is_explicit": True,
        },
    ]

    playlist = {"title": "Pre-Screened", "tracks": tracks}
    manual_replacements = {"t_flagged": clean_replacement_track}

    # replace_clean_or_drop:
    # t_flagged has clean replacement -> replaced with clean_swapped & is_flagged=False
    # t_clean is verified_clean -> kept
    # t_unswappable is flagged with no replacement -> dropped
    res_rcd = stitcher_service.stitch_playlists(
        playlists=[playlist],
        clean_mode="replace_clean_or_drop",
        manual_replacements=manual_replacements,
    )
    assert len(res_rcd["tracks"]) == 2
    swapped = res_rcd["tracks"][0]
    assert swapped["id"] == "clean_rep_1"
    assert swapped["verification_status"] == "clean_swapped"
    assert swapped["is_flagged"] is False
    assert swapped["replaced_original"]["id"] == "t_flagged"
    assert swapped["source_playlist_title"] == "Pre-Screened"
    assert res_rcd["tracks"][1]["id"] == "t_clean"
    assert res_rcd["summary"]["tracks_replaced"] == 1
    assert res_rcd["summary"]["tracks_dropped"] == 1

    # replace_clean_or_keep:
    # t_unswappable should be retained
    res_rck = stitcher_service.stitch_playlists(
        playlists=[playlist],
        clean_mode="replace_clean_or_keep",
        manual_replacements=manual_replacements,
    )
    assert len(res_rck["tracks"]) == 3
    assert res_rck["tracks"][0]["id"] == "clean_rep_1"
    assert res_rck["tracks"][0]["verification_status"] == "clean_swapped"
    assert res_rck["tracks"][1]["id"] == "t_clean"
    assert res_rck["tracks"][2]["id"] == "t_unswappable"
    assert res_rck["summary"]["tracks_replaced"] == 1
    assert res_rck["summary"]["tracks_dropped"] == 0

    # exclude_flagged:
    # both t_flagged and t_unswappable dropped
    res_exc = stitcher_service.stitch_playlists(
        playlists=[playlist],
        clean_mode="exclude_flagged",
        manual_replacements=manual_replacements,
    )
    assert len(res_exc["tracks"]) == 1
    assert res_exc["tracks"][0]["id"] == "t_clean"
    assert res_exc["summary"]["tracks_dropped"] == 2
    assert res_exc["summary"]["tracks_replaced"] == 0

    # keep_all:
    # all 3 preserved
    res_all = stitcher_service.stitch_playlists(
        playlists=[playlist],
        clean_mode="keep_all",
        manual_replacements=manual_replacements,
    )
    assert len(res_all["tracks"]) == 3
    assert res_all["summary"]["tracks_dropped"] == 0
    assert res_all["summary"]["tracks_replaced"] == 0


def test_manual_actions_override():
    """Verify manual_actions ('drop', 'replace', 'keep') override clean mode."""
    tracks = [
        {"id": "t1", "title": "Track 1", "artist": "Artist 1", "verification_status": "flagged"},
        {"id": "t2", "title": "Track 2", "artist": "Artist 2", "verification_status": "verified_clean"},
        {"id": "t3", "title": "Track 3", "artist": "Artist 3", "verification_status": "flagged"},
    ]
    playlist = {"title": "Overrides", "tracks": tracks}
    manual_replacements = {
        "t1": {"id": "c1", "title": "Clean 1", "artist": "Artist 1"}
    }
    manual_actions = {
        "t1": "replace",
        "t2": "drop",  # manual drop on clean track
        "t3": "keep",  # manual keep on flagged track
    }

    res = stitcher_service.stitch_playlists(
        playlists=[playlist],
        clean_mode="exclude_flagged",  # would normally drop t1 and t3
        manual_replacements=manual_replacements,
        manual_actions=manual_actions,
    )
    assert len(res["tracks"]) == 2
    assert res["tracks"][0]["id"] == "c1"
    assert res["tracks"][0]["verification_status"] == "clean_swapped"
    assert res["tracks"][0]["is_flagged"] is False
    assert res["tracks"][1]["id"] == "t3"
    assert res["summary"]["tracks_replaced"] == 1
    assert res["summary"]["tracks_dropped"] == 1


def test_post_api_stitch_endpoint():
    """Verify POST /api/stitch handles StitchRequest and returns StitchResult envelope."""
    req = StitchRequest(
        playlists=[
            {
                "title": "Source Alpha",
                "tracks": [
                    {"id": "a1", "title": "Track A", "artist": "Artist A", "verification_status": "verified_clean"},
                    {"id": "a2", "title": "Track B", "artist": "Artist B", "verification_status": "flagged"},
                ],
            },
            {
                "title": "Source Beta",
                "tracks": [
                    {"id": "a1", "title": "Track A", "artist": "Artist A", "verification_status": "verified_clean"},
                ],
            },
        ],
        order_mode="sequential",
        deduplication_mode="exact_id",
        clean_mode="replace_clean_or_drop",
        manual_replacements={
            "a2": {"id": "a2_clean", "title": "Track B (Clean)", "artist": "Artist B"}
        },
        manual_actions={},
        platform="spotify",
    )

    data = stitch_playlists_endpoint(req)

    assert "tracks" in data
    assert "summary" in data
    assert "stats" in data
    assert data["summary"]["total_input_tracks"] == 3
    assert data["summary"]["duplicates_removed"] == 1
    assert data["summary"]["tracks_replaced"] == 1
    assert data["summary"]["tracks_dropped"] == 0
    assert data["summary"]["final_track_count"] == 2

    tracks = data["tracks"]
    assert tracks[0]["id"] == "a1"
    assert tracks[0]["source_playlist_title"] == "Source Alpha"
    assert tracks[1]["id"] == "a2_clean"
    assert tracks[1]["verification_status"] == "clean_swapped"
    assert tracks[1]["is_flagged"] is False
    assert tracks[1]["is_explicit"] is False
    assert tracks[1]["source_playlist_title"] == "Source Alpha"


def test_embedded_track_clean_replacement():
    """Verify track['clean_replacement'] is used when manual_replacements is omitted."""
    tracks = [
        {
            "id": "exp1",
            "title": "Song With Profanity",
            "artist": "Rapper",
            "verification_status": "flagged",
            "clean_replacement": {
                "id": "clean1",
                "title": "Song (Clean Version)",
                "artist": "Rapper",
                "is_explicit": False,
            },
        }
    ]
    playlist = {"title": "Embedded Clean", "tracks": tracks}

    res = stitcher_service.stitch_playlists(
        playlists=[playlist],
        clean_mode="replace_clean_or_drop",
        manual_replacements=None,
    )
    assert len(res["tracks"]) == 1
    assert res["tracks"][0]["id"] == "clean1"
    assert res["tracks"][0]["verification_status"] == "clean_swapped"
    assert res["tracks"][0]["is_flagged"] is False
    assert res["tracks"][0]["is_explicit"] is False
    assert res["summary"]["tracks_replaced"] == 1


def test_none_id_and_none_titles_handling():
    """Verify tracks with None id or None title/artist are handled without crashing or dropping valid tracks."""
    tracks = [
        {"id": None, "title": None, "artist": "Band 1"},
        {"id": None, "title": "Untitled", "artist": None},
        {"id": "t1", "title": "Alpha", "artist": "Artist A"},
    ]
    playlist = {"title": None, "tracks": tracks}  # falsy title triggers fallback

    res = stitcher_service.stitch_playlists(
        playlists=[playlist],
        order_mode="title_asc",
        deduplication_mode="exact_id",
        clean_mode="keep_all",
    )
    # Both None-id tracks are preserved rather than collapsed
    assert len(res["tracks"]) == 3
    assert res["summary"]["duplicates_removed"] == 0
    assert res["tracks"][0]["source_playlist_title"] == "Playlist 1"


def test_empty_inputs_boundary():
    """Verify empty playlist list and empty track lists execute cleanly."""
    res_empty = stitcher_service.stitch_playlists(playlists=[])
    assert res_empty["tracks"] == []
    assert res_empty["summary"]["total_input_tracks"] == 0
    assert res_empty["summary"]["final_track_count"] == 0

    res_empty_tracks = stitcher_service.stitch_playlists(
        playlists=[{"title": "P1", "tracks": []}, {"title": "P2", "tracks": None}]
    )
    assert res_empty_tracks["tracks"] == []
    assert res_empty_tracks["summary"]["total_input_tracks"] == 0
