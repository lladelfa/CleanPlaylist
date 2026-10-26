import pytest
from unittest.mock import MagicMock, patch
import app.services.spotify_service as spotify_service_module
from app.services.spotify_service import SpotifyService


@pytest.fixture(autouse=True)
def isolate_spotify_cache(monkeypatch, tmp_path):
    """Ensure tests use an isolated temp directory instead of real backend/.spotify_caches/token.json."""
    monkeypatch.setattr(spotify_service_module, "SPOTIFY_TOKEN_CACHE", tmp_path)


def test_extract_playlist_id():
    # standard URL
    assert SpotifyService.extract_playlist_id("https://open.spotify.com/playlist/75ykVn9fVZWHn20oXxaFJt") == "75ykVn9fVZWHn20oXxaFJt"

    # URL with query parameters
    assert SpotifyService.extract_playlist_id("https://open.spotify.com/playlist/75ykVn9fVZWHn20oXxaFJt?si=99ba6bed219143e7") == "75ykVn9fVZWHn20oXxaFJt"

    # Spotify URI
    assert SpotifyService.extract_playlist_id("spotify:playlist:75ykVn9fVZWHn20oXxaFJt") == "75ykVn9fVZWHn20oXxaFJt"

    # Just the ID
    assert SpotifyService.extract_playlist_id("75ykVn9fVZWHn20oXxaFJt") == "75ykVn9fVZWHn20oXxaFJt"


def test_missing_credentials_initialization(monkeypatch):
    # Ensure missing credentials does not crash the app, but sets sp_oauth to None
    monkeypatch.delenv("SPOTIFY_CLIENT_ID", raising=False)
    monkeypatch.delenv("SPOTIFY_CLIENT_SECRET", raising=False)

    service = SpotifyService()
    assert service.sp_oauth is None
    assert service.is_authenticated() is False


def test_valid_credentials_initialization(monkeypatch):
    monkeypatch.setenv("SPOTIFY_CLIENT_ID", "mock_id")
    monkeypatch.setenv("SPOTIFY_CLIENT_SECRET", "mock_secret")
    monkeypatch.setenv("SPOTIFY_REDIRECT_URI", "http://127.0.0.1:8000")

    service = SpotifyService()
    assert service.sp_oauth is not None
    # Still false because we haven't exchanged a code for a token
    assert service.is_authenticated() is False


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
