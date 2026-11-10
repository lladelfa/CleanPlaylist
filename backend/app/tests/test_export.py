import pytest
from fastapi import HTTPException
from app.main import app, ExportRequest, export_playlist_file
from app.services.stitcher_service import stitcher_service

SAMPLE_TRACKS = [
    {
        "id": "track_1",
        "title": "Clean Song",
        "artist": "Good Artist",
        "duration": "3:30",
        "duration_seconds": 210,
        "is_explicit": False,
        "video_url": "https://open.spotify.com/track/track_1",
        "source_playlist_title": "My Playlist"
    },
    {
        "id": "track_2",
        "title": "Clean Swapped Song",
        "artist": "Another Artist",
        "duration": "2:45",
        "duration_seconds": 165,
        "is_explicit": False,
        "video_url": "https://music.youtube.com/watch?v=track_2",
        "source_playlist_title": "My Playlist"
    }
]

def test_export_route_registered():
    paths = {getattr(r, "path", None): getattr(r, "methods", set()) for r in app.routes}
    assert "/api/export" in paths
    assert "POST" in paths["/api/export"]

def test_export_csv_has_track_link_header():
    """Verify CSV export uses platform-neutral 'Track Link' column header."""
    csv_output = stitcher_service.export_as_csv(SAMPLE_TRACKS)
    first_line = csv_output.splitlines()[0]
    headers = [h.strip() for h in first_line.split(",")]
    assert "Track Link" in headers
    assert "YouTube Music Link" not in headers

def test_api_export_csv_endpoint():
    """Test POST /api/export with format=csv."""
    req = ExportRequest(
        format="csv",
        tracks=SAMPLE_TRACKS,
        playlist_title="Summer Vibes / Clean: 2026",
        platform="spotify"
    )
    res = export_playlist_file(req)
    assert res.status_code == 200
    assert "text/csv" in res.media_type
    assert 'filename="Summer Vibes  Clean 2026.csv"' in res.headers["Content-Disposition"]
    body = res.body.decode("utf-8")
    assert "Track Link" in body.splitlines()[0]
    assert "Clean Song" in body
    assert "https://open.spotify.com/track/track_1" in body

def test_api_export_m3u8_endpoint():
    """Test POST /api/export with format=m3u8."""
    req = ExportRequest(
        format="m3u8",
        tracks=SAMPLE_TRACKS,
        playlist_title="Party Clean!",
        platform="ytmusic"
    )
    res = export_playlist_file(req)
    assert res.status_code == 200
    assert "audio/x-mpegurl" in res.media_type
    assert 'filename="Party Clean.m3u8"' in res.headers["Content-Disposition"]
    lines = res.body.decode("utf-8").splitlines()
    assert lines[0] == "#EXTM3U"
    assert lines[1] == "#PLAYLIST:Party Clean!"
    assert any("#EXTINF:210,Good Artist - Clean Song" in l for l in lines)
    assert any("https://open.spotify.com/track/track_1" in l for l in lines)

def test_api_export_m3u8_spotify_fallback():
    """Test M3U8 exports canonical open.spotify.com link when video_url is empty in spotify mode."""
    spotify_track_no_url = [{
        "id": "spotify123",
        "title": "Solo Track",
        "artist": "Solo Artist",
        "duration_seconds": 180,
    }]
    req = ExportRequest(
        format="m3u8",
        tracks=spotify_track_no_url,
        playlist_title="Spotify M3U",
        platform="spotify"
    )
    res = export_playlist_file(req)
    assert res.status_code == 200
    lines = res.body.decode("utf-8").splitlines()
    assert any("https://open.spotify.com/track/spotify123" in l for l in lines)

def test_api_export_json_endpoint():
    """Test POST /api/export with format=json."""
    import json
    req = ExportRequest(
        format="json",
        tracks=SAMPLE_TRACKS,
        playlist_title="JSON Playlist"
    )
    res = export_playlist_file(req)
    assert res.status_code == 200
    assert "application/json" in res.media_type
    data = json.loads(res.body.decode("utf-8"))
    assert data["title"] == "JSON Playlist"
    assert data["track_count"] == 2
    assert len(data["tracks"]) == 2
    assert data["tracks"][0]["title"] == "Clean Song"

def test_api_export_invalid_format():
    """Test POST /api/export with invalid format returns 400."""
    req = ExportRequest(
        format="flac",
        tracks=SAMPLE_TRACKS
    )
    with pytest.raises(HTTPException) as exc_info:
        export_playlist_file(req)
    assert exc_info.value.status_code == 400
    assert "Unsupported export format" in exc_info.value.detail

def test_api_export_handles_none_and_empty_id():
    """Test export handles None id and empty string id safely."""
    tracks = [
        {"id": None, "title": "Track with None ID", "artist": "Artist"},
        {"id": "", "title": "Track with empty ID", "artist": "Artist"}
    ]
    req = ExportRequest(format="csv", tracks=tracks, platform="spotify")
    res = export_playlist_file(req)
    assert res.status_code == 200

def test_api_export_empty_sanitized_filename():
    """Test export with title having only non-alphanumeric chars falls back to CleanPlaylist."""
    req = ExportRequest(format="csv", tracks=SAMPLE_TRACKS, playlist_title="??? 🔥 !!!")
    res = export_playlist_file(req)
    assert res.status_code == 200
    assert 'filename="CleanPlaylist.csv"' in res.headers["Content-Disposition"]
