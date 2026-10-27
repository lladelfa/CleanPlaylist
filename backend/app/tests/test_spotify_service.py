import pytest
from unittest.mock import MagicMock, patch
import app.services.spotify_service as spotify_service_module
from app.services.spotify_service import (
    SpotifyService,
    SPOTIFY_SESSION_COOKIE,
    encode_session_token,
    decode_session_token,
)


def test_extract_playlist_id():
    # standard URL
    assert SpotifyService.extract_playlist_id("https://open.spotify.com/playlist/75ykVn9fVZWHn20oXxaFJt") == "75ykVn9fVZWHn20oXxaFJt"

    # URL with query parameters
    assert SpotifyService.extract_playlist_id("https://open.spotify.com/playlist/75ykVn9fVZWHn20oXxaFJt?si=99ba6bed219143e7") == "75ykVn9fVZWHn20oXxaFJt"

    # Spotify URI
    assert SpotifyService.extract_playlist_id("spotify:playlist:75ykVn9fVZWHn20oXxaFJt") == "75ykVn9fVZWHn20oXxaFJt"

    # Just the ID
    assert SpotifyService.extract_playlist_id("75ykVn9fVZWHn20oXxaFJt") == "75ykVn9fVZWHn20oXxaFJt"


def test_missing_credentials_initialization(monkeypatch, tmp_path):
    # Ensure missing credentials does not crash the app, but sets sp_oauth to None
    monkeypatch.setattr(spotify_service_module, "SPOTIFY_TOKEN_CACHE", tmp_path)
    monkeypatch.delenv("SPOTIFY_CLIENT_ID", raising=False)
    monkeypatch.delenv("SPOTIFY_CLIENT_SECRET", raising=False)

    service = SpotifyService()
    assert service.sp_oauth is None
    assert service.is_authenticated() is False


def test_valid_credentials_initialization(monkeypatch, tmp_path):
    monkeypatch.setattr(spotify_service_module, "SPOTIFY_TOKEN_CACHE", tmp_path)
    monkeypatch.setenv("SPOTIFY_CLIENT_ID", "mock_id")
    monkeypatch.setenv("SPOTIFY_CLIENT_SECRET", "mock_secret")
    monkeypatch.setenv("SPOTIFY_REDIRECT_URI", "http://127.0.0.1:8000")

    service = SpotifyService()
    assert service.sp_oauth is not None
    # Still false because we haven't exchanged a code for a token in this clean cache dir
    assert service.is_authenticated() is False


def test_session_cookie_encode_decode_and_tamper_protection(monkeypatch):
    monkeypatch.setenv("SESSION_SECRET_KEY", "test-secret-key-123")
    token_data = {
        "access_token": "acc_user_1",
        "refresh_token": "ref_user_1",
        "expires_at": 9999999999,
    }
    cookie_val = encode_session_token(token_data)
    decoded = decode_session_token(cookie_val)
    assert decoded is not None
    assert decoded["access_token"] == "acc_user_1"
    assert decoded["refresh_token"] == "ref_user_1"

    # Tampered signature must be rejected
    tampered = cookie_val[:-4] + "0000"
    assert decode_session_token(tampered) is None


def test_multi_user_session_isolation(monkeypatch):
    monkeypatch.setenv("SPOTIFY_CLIENT_ID", "mock_id")
    monkeypatch.setenv("SPOTIFY_CLIENT_SECRET", "mock_secret")
    monkeypatch.setenv("SESSION_SECRET_KEY", "multi-user-secret")

    service = SpotifyService()

    user_a_cookie = encode_session_token({
        "access_token": "token_user_a",
        "refresh_token": "refresh_a",
        "expires_at": 9999999999,
    })

    req_user_a = MagicMock()
    req_user_a.cookies = {SPOTIFY_SESSION_COOKIE: user_a_cookie}
    req_user_a.headers = {"host": "cleanplaylist.vercel.app", "x-forwarded-proto": "https"}

    req_user_b = MagicMock()
    req_user_b.cookies = {}
    req_user_b.headers = {"host": "cleanplaylist.vercel.app", "x-forwarded-proto": "https"}

    assert service.is_authenticated(request=req_user_a) is True
    assert service.is_authenticated(request=req_user_b) is False

    # User B must get 401 even while User A is authenticated
    with pytest.raises(Exception) as exc_info:
        service.get_client(request=req_user_b)
    assert exc_info.value.status_code == 401


def test_resolve_redirect_uri_for_vercel(monkeypatch):
    monkeypatch.setenv("SPOTIFY_REDIRECT_URI", "http://127.0.0.1:8000/api/spotify/callback")
    mock_req = MagicMock()
    mock_req.headers = {
        "x-forwarded-host": "clean-playlist.vercel.app",
        "x-forwarded-proto": "https",
    }
    resolved = SpotifyService.resolve_redirect_uri(mock_req)
    assert resolved == "https://clean-playlist.vercel.app/api/spotify/callback"


def test_get_playlist_unauthenticated():
    service = SpotifyService()
    service.sp = None
    with pytest.raises(Exception) as exc_info:
        service.get_playlist("75ykVn9fVZWHn20oXxaFJt")
    assert exc_info.value.status_code == 401
    assert "log in to Spotify" in exc_info.value.detail


def test_get_playlist_mocked_responses():
    service = SpotifyService()

    # Mock the spotipy client
    mock_sp = MagicMock()
    service.sp = mock_sp

    # Setup mock playlist metadata
    mock_sp.playlist.return_value = {
        "name": "Test Playlist",
        "description": "A test description",
        "owner": {"display_name": "Test User"},
        "images": [{"url": "http://example.com/image.png"}],
    }

    # Setup mock tracks pagination - handling flat tracks, wrapped tracks, and algorithmic items
    mock_sp.playlist_items.return_value = {
        "items": [
            {
                "track": {
                    "id": "t1",
                    "name": "Track 1",
                    "artists": [{"name": "Artist A"}],
                    "duration_ms": 120000,
                    "explicit": False,
                    "external_urls": {"spotify": "http://sp/t1"}
                }
            },
            {
                "item": {
                    "id": "t2",
                    "name": "Track 2",
                    "artists": [{"name": "Artist B"}],
                    "duration_ms": 180000,
                    "explicit": True
                }
            }
        ],
        "next": "http://next_page"
    }

    mock_sp.next.return_value = {
        "items": [
            {
                "id": "t3",
                "name": "Track 3",
                "artists": [{"name": "Artist C"}],
                "duration_ms": 240000,
                "explicit": False
            }
        ],
        "next": None
    }

    result = service.get_playlist("test_id")

    # Verify metadata
    assert result["id"] == "test_id"
    assert result["title"] == "Test Playlist"
    assert result["author"] == "Test User"
    assert result["thumbnail"] == "http://example.com/image.png"

    # Verify tracks
    assert result["track_count"] == 3
    assert len(result["tracks"]) == 3

    # Standard track
    assert result["tracks"][0]["id"] == "t1"
    assert result["tracks"][0]["title"] == "Track 1"
    assert result["tracks"][0]["artist"] == "Artist A"
    assert result["tracks"][0]["duration"] == "2:00"

    # Algorithmic item track
    assert result["tracks"][1]["id"] == "t2"
    assert result["tracks"][1]["title"] == "Track 2"
    assert result["tracks"][1]["is_explicit"] is True
    assert result["tracks"][1]["duration"] == "3:00"

    # Flat track
    assert result["tracks"][2]["id"] == "t3"
    assert result["tracks"][2]["title"] == "Track 3"
    assert result["tracks"][2]["duration"] == "4:00"


def test_get_user_playlists_unauthenticated():
    service = SpotifyService()
    service.sp = None
    with pytest.raises(Exception) as exc_info:
        service.get_user_playlists(limit=20, offset=0)
    assert exc_info.value.status_code == 401
    assert "log in to Spotify" in exc_info.value.detail


def test_get_user_playlists_pagination():
    service = SpotifyService()
    mock_sp = MagicMock()
    service.sp = mock_sp

    mock_sp.current_user_playlists.return_value = {
        "items": [
            {
                "id": "pl_1",
                "name": "Workout Mix",
                "tracks": {"total": 42},
                "images": [{"url": "http://example.com/pl1.jpg"}],
                "owner": {"display_name": "DJ Test"},
                "external_urls": {"spotify": "https://open.spotify.com/playlist/pl_1"},
            },
            {
                "id": "pl_2",
                "name": "Chill Vibes",
                "tracks": {"total": 15},
                "images": [],
                "owner": {"display_name": "DJ Test"},
                "external_urls": {},
            },
        ],
        "total": 45,
        "limit": 20,
        "offset": 20,
        "next": "https://api.spotify.com/v1/me/playlists?offset=40&limit=20",
        "previous": "https://api.spotify.com/v1/me/playlists?offset=0&limit=20",
    }

    result = service.get_user_playlists(limit=20, offset=20)

    mock_sp.current_user_playlists.assert_called_once_with(limit=20, offset=20)
    assert result["total"] == 45
    assert result["limit"] == 20
    assert result["offset"] == 20
    assert result["has_next"] is True
    assert result["has_prev"] is True
    assert len(result["items"]) == 2

    assert result["items"][0] == {
        "id": "pl_1",
        "name": "Workout Mix",
        "tracks_total": 42,
        "thumbnail": "http://example.com/pl1.jpg",
        "owner": "DJ Test",
        "url": "https://open.spotify.com/playlist/pl_1",
    }
    assert result["items"][1] == {
        "id": "pl_2",
        "name": "Chill Vibes",
        "tracks_total": 15,
        "thumbnail": None,
        "owner": "DJ Test",
        "url": "https://open.spotify.com/playlist/pl_2",
    }


def test_spotify_playlists_endpoint():
    from app.spotify_endpoints import router, get_user_playlists
    from app.services.spotify_service import spotify_service

    # Verify route registration
    routes = [r for r in router.routes if getattr(r, "path", None) == "/api/spotify/playlists"]
    assert len(routes) == 1
    assert "GET" in routes[0].methods

    mock_payload = {
        "items": [
            {
                "id": "pl_100",
                "name": "Road Trip",
                "tracks_total": 12,
                "thumbnail": "http://example.com/road.jpg",
                "owner": "Alice",
                "url": "https://open.spotify.com/playlist/pl_100",
            }
        ],
        "total": 1,
        "limit": 20,
        "offset": 0,
        "has_next": False,
        "has_prev": False,
    }

    with patch.object(spotify_service, "get_user_playlists", return_value=mock_payload) as mock_method:
        response = get_user_playlists(limit=20, offset=0)
        assert response == mock_payload
        mock_method.assert_called_once_with(limit=20, offset=0, sp_client=None)
