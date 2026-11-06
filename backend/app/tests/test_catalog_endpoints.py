"""Unit tests for Dual-Catalog Backend Search, Album Loading, and Sliced Playlist Fetch."""

import pytest
from unittest.mock import MagicMock, patch
from fastapi import HTTPException, Request, Response
from app.main import (
    app,
    TrackScanItem,
    AlbumSummary,
    CatalogSearchRequest,
    CatalogAlbumRequest,
    PlaylistFetchRequest,
    search_catalog,
    get_catalog_album,
    fetch_playlist,
)
from app.services.spotify_service import SpotifyService, spotify_service
from app.services.ytmusic_service import YTMusicService, ytmusic_service


# -----------------------------------------------------------------------------
# 1. Route Registration Checks
# -----------------------------------------------------------------------------

def test_catalog_routes_registered():
    paths = {getattr(r, "path", None): getattr(r, "methods", set()) for r in app.routes}
    assert "/api/catalog/search" in paths
    assert "POST" in paths["/api/catalog/search"]
    assert "/api/catalog/album" in paths
    assert "POST" in paths["/api/catalog/album"]


# -----------------------------------------------------------------------------
# 2. Spotify Catalog Client Credentials & Service Tests
# -----------------------------------------------------------------------------

def test_spotify_catalog_client_caching_and_isolation(monkeypatch):
    monkeypatch.setenv("SPOTIFY_CLIENT_ID", "mock_client_id")
    monkeypatch.setenv("SPOTIFY_CLIENT_SECRET", "mock_client_secret")

    service = SpotifyService()

    with patch("app.services.spotify_service.SpotifyClientCredentials") as mock_cred_cls, \
         patch("app.services.spotify_service.spotipy.Spotify") as mock_spotipy:
        mock_cred_instance = MagicMock()
        mock_cred_cls.return_value = mock_cred_instance
        mock_sp_instance = MagicMock()
        mock_spotipy.return_value = mock_sp_instance

        # First call creates client
        client1 = service.get_catalog_client()
        assert client1 == mock_sp_instance
        mock_cred_cls.assert_called_once()
        mock_spotipy.assert_called_once_with(client_credentials_manager=mock_cred_instance)

        # Second call returns process-cached instance
        client2 = service.get_catalog_client()
        assert client2 == client1
        assert mock_spotipy.call_count == 1


def test_spotify_catalog_client_missing_credentials(monkeypatch):
    monkeypatch.delenv("SPOTIFY_CLIENT_ID", raising=False)
    monkeypatch.delenv("SPOTIFY_CLIENT_SECRET", raising=False)

    service = SpotifyService()
    with pytest.raises(HTTPException) as exc_info:
        service.get_catalog_client()
    assert exc_info.value.status_code == 500


def test_spotify_get_client_backward_compatibility():
    service = SpotifyService()
    # Without request or oauth session, get_client() raises 401 as before
    with pytest.raises(HTTPException) as exc_info:
        service.get_client()
    assert exc_info.value.status_code == 401


# -----------------------------------------------------------------------------
# 3. TrackScanItem Canonical 12-Key Contract
# -----------------------------------------------------------------------------

def test_track_scan_item_12_key_contract():
    data = {
        "id": "trk_123",
        "title": "Clean Track",
        "artist": "Clean Artist",
        "artists_list": ["Clean Artist"],
        "album": "Clean Album",
        "duration": "3:45",
        "duration_seconds": 225,
        "is_explicit": False,
        "thumbnail": "https://img.example.com/cover.jpg",
        "video_url": "https://music.example.com/track/123",
        "verification_status": "unscanned",
        "source_platform": "spotify",
        "extra_random_field": "should_be_ignored",
    }
    item = TrackScanItem(**data)
    d = item.model_dump()
    assert d["id"] == "trk_123"
    assert d["title"] == "Clean Track"
    assert d["artist"] == "Clean Artist"
    assert d["artists_list"] == ["Clean Artist"]
    assert d["album"] == "Clean Album"
    assert d["duration"] == "3:45"
    assert d["duration_seconds"] == 225
    assert d["is_explicit"] is False
    assert d["thumbnail"] == "https://img.example.com/cover.jpg"
    assert d["video_url"] == "https://music.example.com/track/123"
    assert d["verification_status"] == "unscanned"
    assert d["source_platform"] == "spotify"
    assert "extra_random_field" not in d


# -----------------------------------------------------------------------------
# 4. POST /api/catalog/search (Spotify & YouTube Music)
# -----------------------------------------------------------------------------

def test_catalog_search_spotify():
    mock_search_results = {
        "songs": [
            {
                "id": "sp_t1",
                "title": "Song One",
                "artist": "Artist A",
                "artists_list": ["Artist A"],
                "album": "Album One",
                "duration": "3:00",
                "duration_seconds": 180,
                "is_explicit": False,
                "thumbnail": "https://img.example/sp_t1.jpg",
                "video_url": "https://open.spotify.com/track/sp_t1",
                "verification_status": "unscanned",
                "source_platform": "spotify",
            }
        ],
        "albums": [
            {
                "id": "sp_a1",
                "title": "Album One",
                "artist": "Artist A",
                "thumbnail": "https://img.example/sp_a1.jpg",
                "track_count": 12,
                "year": "2024",
                "source_platform": "spotify",
            }
        ],
    }

    req = CatalogSearchRequest(query="Song One", platform="spotify", limit=5)
    with patch.object(spotify_service, "search_catalog", return_value=mock_search_results) as mock_search:
        resp = search_catalog(req)
        mock_search.assert_called_once_with(query="Song One", limit=5)
        assert "songs" in resp
        assert "albums" in resp
        assert len(resp["songs"]) == 1
        assert len(resp["albums"]) == 1

        song = resp["songs"][0]
        assert song.id == "sp_t1"
        assert song.title == "Song One"
        assert song.artist == "Artist A"
        assert song.artists_list == ["Artist A"]
        assert song.album == "Album One"
        assert song.verification_status == "unscanned"
        assert song.source_platform == "spotify"

        album = resp["albums"][0]
        assert album.id == "sp_a1"
        assert album.track_count == 12
        assert album.source_platform == "spotify"


def test_catalog_search_ytmusic():
    mock_search_results = {
        "songs": [
            {
                "id": "yt_v1",
                "title": "YT Song",
                "artist": "YT Artist",
                "artists_list": ["YT Artist"],
                "album": "YT Album",
                "duration": "2:30",
                "duration_seconds": 150,
                "is_explicit": True,
                "thumbnail": "https://img.example/yt_v1.jpg",
                "video_url": "https://music.youtube.com/watch?v=yt_v1",
                "verification_status": "unscanned",
                "source_platform": "ytmusic",
            }
        ],
        "albums": [
            {
                "id": "yt_a1",
                "title": "YT Album",
                "artist": "YT Artist",
                "thumbnail": "https://img.example/yt_a1.jpg",
                "track_count": 8,
                "year": "2023",
                "source_platform": "ytmusic",
            }
        ],
    }

    req = CatalogSearchRequest(query="YT Song", platform="ytmusic", limit=10)
    with patch.object(ytmusic_service, "search_catalog", return_value=mock_search_results) as mock_search:
        resp = search_catalog(req)
        mock_search.assert_called_once_with(query="YT Song", limit=10)
        assert len(resp["songs"]) == 1
        assert len(resp["albums"]) == 1
        assert resp["songs"][0].source_platform == "ytmusic"
        assert resp["albums"][0].source_platform == "ytmusic"


def test_catalog_search_limit_capped_at_10():
    req = CatalogSearchRequest(query="Test", platform="spotify", limit=50)
    with patch.object(spotify_service, "search_catalog", return_value={"songs": [], "albums": []}) as mock_search:
        search_catalog(req)
        mock_search.assert_called_once_with(query="Test", limit=10)


# -----------------------------------------------------------------------------
# 5. POST /api/catalog/album (Spotify & YouTube Music)
# -----------------------------------------------------------------------------

def test_catalog_album_spotify():
    mock_album_result = {
        "id": "alb_sp_1",
        "title": "Full Album",
        "artist": "Lead Artist",
        "thumbnail": "https://img.example/album.jpg",
        "track_count": 2,
        "tracks": [
            {
                "id": "trk_1",
                "title": "Track One",
                "artist": "Lead Artist",
                "artists_list": ["Lead Artist"],
                "album": "Full Album",
                "duration": "2:00",
                "duration_seconds": 120,
                "is_explicit": False,
                "thumbnail": "https://img.example/album.jpg",
                "video_url": "https://open.spotify.com/track/trk_1",
                "verification_status": "unscanned",
                "source_platform": "spotify",
            },
            {
                "id": "trk_2",
                "title": "Track Two",
                "artist": "Lead Artist, Featured",
                "artists_list": ["Lead Artist", "Featured"],
                "album": "Full Album",
                "duration": "3:00",
                "duration_seconds": 180,
                "is_explicit": True,
                "thumbnail": "https://img.example/album.jpg",
                "video_url": "https://open.spotify.com/track/trk_2",
                "verification_status": "unscanned",
                "source_platform": "spotify",
            },
        ],
    }

    req = CatalogAlbumRequest(album_id="alb_sp_1", platform="spotify")
    with patch.object(spotify_service, "get_album", return_value=mock_album_result) as mock_get_album:
        resp = get_catalog_album(req)
        mock_get_album.assert_called_once_with(album_id="alb_sp_1")
        assert resp["id"] == "alb_sp_1"
        assert resp["title"] == "Full Album"
        assert resp["artist"] == "Lead Artist"
        assert resp["track_count"] == 2
        assert len(resp["tracks"]) == 2
        assert resp["tracks"][0].id == "trk_1"
        assert resp["tracks"][0].source_platform == "spotify"


def test_catalog_album_ytmusic():
    mock_album_result = {
        "id": "alb_yt_1",
        "title": "YT Album Title",
        "artist": "YT Band",
        "thumbnail": "https://img.example/yt_album.jpg",
        "track_count": 1,
        "tracks": [
            {
                "id": "yt_t1",
                "title": "Song 1",
                "artist": "YT Band",
                "artists_list": ["YT Band"],
                "album": "YT Album Title",
                "duration": "4:00",
                "duration_seconds": 240,
                "is_explicit": False,
                "thumbnail": "https://img.example/yt_album.jpg",
                "video_url": "https://music.youtube.com/watch?v=yt_t1",
                "verification_status": "unscanned",
                "source_platform": "ytmusic",
            }
        ]
    }

    req = CatalogAlbumRequest(album_id="alb_yt_1", platform="ytmusic")
    with patch.object(ytmusic_service, "get_album", return_value=mock_album_result) as mock_get_album:
        resp = get_catalog_album(req)
        mock_get_album.assert_called_once_with(album_id="alb_yt_1")
        assert resp["id"] == "alb_yt_1"
        assert resp["track_count"] == 1
        assert len(resp["tracks"]) == 1
        assert resp["tracks"][0].id == "yt_t1"


# -----------------------------------------------------------------------------
# 6. Sliced YouTube Music Playlist Fetch POST /api/playlist/fetch
# -----------------------------------------------------------------------------

def test_ytmusic_playlist_fetch_slicing_and_truncation_flag():
    with patch.object(ytmusic_service.yt, "get_playlist") as mock_yt_pl:
        mock_yt_pl.return_value = {
            "id": "PL_mock_large",
            "title": "Large Playlist",
            "thumbnails": [],
            "tracks": [
                {
                    "videoId": f"vid_{i}",
                    "title": f"Track {i}",
                    "artists": [{"name": "Artist"}],
                    "duration": "3:00",
                    "duration_seconds": 180,
                    "isExplicit": False,
                }
                for i in range(60)
            ],
        }

        req = PlaylistFetchRequest(
            url_or_id="https://music.youtube.com/playlist?list=PL_mock_large",
            limit=50,
            platform="ytmusic"
        )
        mock_request = MagicMock(spec=Request)
        mock_response = MagicMock(spec=Response)
        resp = fetch_playlist(req, mock_request, mock_response)

        assert len(resp["tracks"]) == 50
        assert resp["source_track_count"] == 60
        assert resp["truncated"] is True


def test_ytmusic_playlist_fetch_not_truncated_when_under_limit():
    with patch.object(ytmusic_service.yt, "get_playlist") as mock_yt_pl:
        mock_yt_pl.return_value = {
            "id": "PL_mock_small",
            "title": "Small Playlist",
            "thumbnails": [],
            "tracks": [
                {
                    "videoId": f"vid_{i}",
                    "title": f"Track {i}",
                    "artists": [{"name": "Artist"}],
                    "duration": "3:00",
                    "duration_seconds": 180,
                    "isExplicit": False,
                }
                for i in range(25)
            ],
        }

        req = PlaylistFetchRequest(
            url_or_id="https://music.youtube.com/playlist?list=PL_mock_small",
            limit=50,
            platform="ytmusic"
        )
        mock_request = MagicMock(spec=Request)
        mock_response = MagicMock(spec=Response)
        resp = fetch_playlist(req, mock_request, mock_response)

        assert len(resp["tracks"]) == 25
        assert resp["source_track_count"] == 25
        assert resp["truncated"] is False


# -----------------------------------------------------------------------------
# 7. Service Implementation Parsing Tests (Spotify & YouTube Music)
# -----------------------------------------------------------------------------

def test_spotify_service_search_catalog():
    service = SpotifyService()
    mock_client = MagicMock()
    service._catalog_client = mock_client

    mock_client.search.return_value = {
        "tracks": {
            "items": [
                {
                    "id": "t100",
                    "name": "Track Name",
                    "artists": [{"name": "A1"}, {"name": "A2"}],
                    "album": {
                        "name": "Album Name",
                        "images": [{"url": "http://img/t100.png"}],
                    },
                    "duration_ms": 210000,
                    "explicit": True,
                    "external_urls": {"spotify": "https://spotify/t100"},
                }
            ]
        },
        "albums": {
            "items": [
                {
                    "id": "a200",
                    "name": "Album Name",
                    "artists": [{"name": "A1"}],
                    "images": [{"url": "http://img/a200.png"}],
                    "total_tracks": 10,
                    "release_date": "2024-05-10",
                }
            ]
        }
    }

    res = service.search_catalog("query", limit=5)
    mock_client.search.assert_called_once_with(q="query", type="track,album", limit=5)
    assert len(res["songs"]) == 1
    assert len(res["albums"]) == 1
    assert res["songs"][0]["id"] == "t100"
    assert res["songs"][0]["artists_list"] == ["A1", "A2"]
    assert res["songs"][0]["verification_status"] == "unscanned"
    assert res["songs"][0]["source_platform"] == "spotify"
    assert res["albums"][0]["id"] == "a200"
    assert res["albums"][0]["track_count"] == 10
    assert res["albums"][0]["source_platform"] == "spotify"


def test_spotify_service_get_album():
    service = SpotifyService()
    mock_client = MagicMock()
    service._catalog_client = mock_client

    mock_client.album.return_value = {
        "id": "a1",
        "name": "Great Album",
        "artists": [{"name": "Star"}],
        "images": [{"url": "http://img/a1.png"}],
        "total_tracks": 1,
        "tracks": {
            "items": [
                {
                    "id": "t1",
                    "name": "Single",
                    "artists": [{"name": "Star"}],
                    "duration_ms": 150000,
                    "explicit": False,
                    "external_urls": {"spotify": "https://spotify/t1"},
                }
            ]
        }
    }

    res = service.get_album("a1")
    assert res["id"] == "a1"
    assert res["title"] == "Great Album"
    assert res["artist"] == "Star"
    assert res["thumbnail"] == "http://img/a1.png"
    assert res["track_count"] == 1
    assert len(res["tracks"]) == 1
    track = res["tracks"][0]
    assert track["id"] == "t1"
    assert track["album"] == "Great Album"
    assert track["thumbnail"] == "http://img/a1.png"
    assert track["verification_status"] == "unscanned"
    assert track["source_platform"] == "spotify"


def test_ytmusic_service_search_catalog():
    service = YTMusicService()
    mock_yt = MagicMock()
    service.yt = mock_yt

    def mock_search_dispatch(query, filter, limit):
        if filter == "songs":
            return [
                {
                    "videoId": "yt1",
                    "title": "Song Title",
                    "artists": [{"name": "Artist 1"}],
                    "album": {"name": "Album 1"},
                    "duration": "3:15",
                    "duration_seconds": 195,
                    "isExplicit": False,
                    "thumbnails": [{"url": "http://img/yt1.png"}],
                }
            ]
        elif filter == "albums":
            return [
                {
                    "browseId": "alb1",
                    "title": "Album Title",
                    "artists": [{"name": "Artist 1"}],
                    "thumbnails": [{"url": "http://img/alb1.png"}],
                    "year": "2022",
                }
            ]
        return []

    mock_yt.search.side_effect = mock_search_dispatch

    res = service.search_catalog("Song Title", limit=5)
    assert len(res["songs"]) == 1
    assert len(res["albums"]) == 1
    assert res["songs"][0]["id"] == "yt1"
    assert res["songs"][0]["title"] == "Song Title"
    assert res["songs"][0]["verification_status"] == "unscanned"
    assert res["songs"][0]["source_platform"] == "ytmusic"
    assert res["albums"][0]["id"] == "alb1"
    assert res["albums"][0]["title"] == "Album Title"
    assert res["albums"][0]["source_platform"] == "ytmusic"


def test_ytmusic_service_get_album():
    service = YTMusicService()
    mock_yt = MagicMock()
    service.yt = mock_yt

    mock_yt.get_album.return_value = {
        "title": "Album Title",
        "artists": [{"name": "Artist 1"}],
        "thumbnails": [{"url": "http://img/alb_thumb.png"}],
        "trackCount": 1,
        "tracks": [
            {
                "videoId": "v1",
                "title": "Track 1",
                "artists": [{"name": "Artist 1"}],
                "duration": "2:45",
                "duration_seconds": 165,
                "isExplicit": True,
                "thumbnails": [{"url": "http://img/v1.png"}],
            }
        ]
    }

    res = service.get_album("MPREb_123")
    assert res["id"] == "MPREb_123"
    assert res["title"] == "Album Title"
    assert res["artist"] == "Artist 1"
    assert res["thumbnail"] == "http://img/alb_thumb.png"
    assert res["track_count"] == 1
    assert len(res["tracks"]) == 1
    t = res["tracks"][0]
    assert t["id"] == "v1"
    assert t["album"] == "Album Title"
    assert t["is_explicit"] is True
    assert t["verification_status"] == "unscanned"
    assert t["source_platform"] == "ytmusic"


# -----------------------------------------------------------------------------
# 8. Edge Case & Hardening Tests (Blind-Hunter Findings)
# -----------------------------------------------------------------------------

def test_catalog_search_empty_and_whitespace_query():
    req1 = CatalogSearchRequest(query="", platform="spotify")
    req2 = CatalogSearchRequest(query="   ", platform="ytmusic")
    assert search_catalog(req1) == {"songs": [], "albums": []}
    assert search_catalog(req2) == {"songs": [], "albums": []}


def test_spotify_album_id_extraction():
    # URL with query
    assert SpotifyService.extract_album_id("https://open.spotify.com/album/4aawyAB9vmqN3uQFRjYTkN?si=123") == "4aawyAB9vmqN3uQFRjYTkN"
    # URI
    assert SpotifyService.extract_album_id("spotify:album:4aawyAB9vmqN3uQFRjYTkN") == "4aawyAB9vmqN3uQFRjYTkN"
    # Raw ID
    assert SpotifyService.extract_album_id("4aawyAB9vmqN3uQFRjYTkN") == "4aawyAB9vmqN3uQFRjYTkN"


def test_ytmusic_album_id_extraction():
    assert YTMusicService.extract_album_id("https://music.youtube.com/playlist?list=OLAK5uy_123") == "OLAK5uy_123"
    assert YTMusicService.extract_album_id("https://music.youtube.com/browse/MPREb_456?si=789") == "MPREb_456"
    assert YTMusicService.extract_album_id("MPREb_456") == "MPREb_456"


def test_spotify_playlist_fetch_slicing_and_envelope_fields():
    service = SpotifyService()
    mock_sp = MagicMock()

    mock_sp.playlist.return_value = {
        "id": "sp_pl_1",
        "name": "Spotify Large",
        "owner": {"display_name": "Curator"},
        "images": [{"url": "http://img.com/pl.jpg"}],
        "tracks": {"items": []},
    }
    mock_sp.playlist_items.return_value = {
        "items": [
            {
                "track": {
                    "id": f"sp_trk_{i}",
                    "name": f"Track {i}",
                    "artists": [{"name": "Artist"}],
                    "album": {"name": "Album", "images": []},
                    "duration_ms": 120000,
                    "explicit": False,
                    "external_urls": {"spotify": f"https://spotify/sp_trk_{i}"},
                }
            }
            for i in range(30)
        ],
        "next": None,
    }

    res = service.get_playlist("sp_pl_1", sp_client=mock_sp, limit=20)
    assert len(res["tracks"]) == 20
    assert res["source_track_count"] == 30
    assert res["truncated"] is True


def test_track_scan_item_index_preservation():
    track = TrackScanItem(
        id="t1",
        index=3,
        title="Indexed Track",
        artist="Artist",
    )
    assert track.index == 3
    assert track.model_dump()["index"] == 3


def test_spotify_artist_none_name_safe_fallback():
    service = SpotifyService()
    mock_client = MagicMock()
    service._catalog_client = mock_client

    mock_client.search.return_value = {
        "tracks": {
            "items": [
                {
                    "id": "t_none",
                    "name": "Track None Artist",
                    "artists": [{"name": None}],
                    "album": {"name": "Album", "images": []},
                    "duration_ms": 120000,
                    "explicit": False,
                    "external_urls": None,
                }
            ]
        },
        "albums": {"items": []}
    }

    res = service.search_catalog("query", limit=5)
    assert len(res["songs"]) == 1
    assert res["songs"][0]["artist"] == "Unknown"
    assert res["songs"][0]["artists_list"] == ["Unknown"]
    assert res["songs"][0]["video_url"] == ""
