"""Unit tests for Spotify Playlist Save & Overwrite Endpoint (Story 5.3)."""

import pytest
from unittest.mock import MagicMock, patch
from fastapi import HTTPException, Request, Response
from app.spotify_endpoints import SpotifySaveRequest, save_playlist


def test_spotify_save_request_model_defaults():
    # Model defaults: create_new=False, is_public=False, original_playlist_id=None
    req = SpotifySaveRequest(
        playlist_title="My Clean List",
        final_track_ids=["t1", "t2"]
    )
    assert req.create_new is False
    assert req.is_public is False
    assert req.original_playlist_id is None
    assert req.playlist_title == "My Clean List"
    assert req.final_track_ids == ["t1", "t2"]


@patch("app.spotify_endpoints.spotify_service.get_client")
def test_save_playlist_create_new_default_success(mock_get_client):
    mock_sp = MagicMock()
    mock_get_client.return_value = mock_sp
    mock_sp.current_user_playlist_create.return_value = {"id": "new_pl_123"}

    req = SpotifySaveRequest(
        playlist_title="Summer Hits (Clean)",
        final_track_ids=["track1", "track2"],
        create_new=True,
        is_public=False
    )
    mock_request = MagicMock(spec=Request)
    mock_response = MagicMock(spec=Response)

    result = save_playlist(req=req, request=mock_request, response=mock_response)
    assert result["status"] == "success"
    assert result["message"] == "Created new playlist"
    assert result["playlist_id"] == "new_pl_123"

    mock_sp.current_user_playlist_create.assert_called_once_with(
        name="Summer Hits (Clean)",
        public=False,
        description="Clean version created by CleanPlaylist"
    )
    if hasattr(mock_sp, "user_playlist_create"):
        mock_sp.user_playlist_create.assert_not_called()
    mock_sp.playlist_add_items.assert_called_once_with(
        "new_pl_123",
        ["spotify:track:track1", "spotify:track:track2"]
    )


@patch("app.spotify_endpoints.spotify_service.get_client")
def test_save_playlist_create_new_chunking(mock_get_client):
    mock_sp = MagicMock()
    mock_get_client.return_value = mock_sp
    mock_sp.current_user_playlist_create.return_value = {"id": "new_pl_chunk"}

    track_ids = [f"track_{i}" for i in range(150)]
    req = SpotifySaveRequest(
        playlist_title="Long Playlist (Clean)",
        final_track_ids=track_ids,
        create_new=True,
        is_public=False
    )
    mock_request = MagicMock(spec=Request)
    mock_response = MagicMock(spec=Response)

    result = save_playlist(req=req, request=mock_request, response=mock_response)
    assert result["playlist_id"] == "new_pl_chunk"

    assert mock_sp.playlist_add_items.call_count == 2
    first_call_uris = mock_sp.playlist_add_items.call_args_list[0][0][1]
    second_call_uris = mock_sp.playlist_add_items.call_args_list[1][0][1]
    assert len(first_call_uris) == 100
    assert len(second_call_uris) == 50
    assert first_call_uris[0] == "spotify:track:track_0"
    assert second_call_uris[-1] == "spotify:track:track_149"


@patch("app.spotify_endpoints.spotify_service.get_client")
def test_save_playlist_create_new_empty_tracks(mock_get_client):
    mock_sp = MagicMock()
    mock_get_client.return_value = mock_sp
    mock_sp.current_user_playlist_create.return_value = {"id": "new_pl_empty"}

    req = SpotifySaveRequest(
        playlist_title="Empty Playlist (Clean)",
        final_track_ids=[],
        create_new=True,
        is_public=False
    )
    mock_request = MagicMock(spec=Request)
    mock_response = MagicMock(spec=Response)

    result = save_playlist(req=req, request=mock_request, response=mock_response)
    assert result["status"] == "success"
    assert result["playlist_id"] == "new_pl_empty"

    mock_sp.current_user_playlist_create.assert_called_once_with(
        name="Empty Playlist (Clean)",
        public=False,
        description="Clean version created by CleanPlaylist"
    )
    mock_sp.playlist_add_items.assert_not_called()


@patch("app.spotify_endpoints.spotify_service.get_client")
def test_save_playlist_create_new_public(mock_get_client):
    mock_sp = MagicMock()
    mock_get_client.return_value = mock_sp
    mock_sp.current_user_playlist_create.return_value = {"id": "new_pl_pub"}

    req = SpotifySaveRequest(
        playlist_title="Public Playlist (Clean)",
        final_track_ids=["t1"],
        create_new=True,
        is_public=True
    )
    mock_request = MagicMock(spec=Request)
    mock_response = MagicMock(spec=Response)

    save_playlist(req=req, request=mock_request, response=mock_response)
    mock_sp.current_user_playlist_create.assert_called_once_with(
        name="Public Playlist (Clean)",
        public=True,
        description="Clean version created by CleanPlaylist"
    )


@patch("app.spotify_endpoints.spotify_service.get_client")
def test_save_playlist_create_new_spotify_error(mock_get_client):
    mock_sp = MagicMock()
    mock_get_client.return_value = mock_sp
    mock_sp.current_user_playlist_create.side_effect = Exception("Spotify API 403 Forbidden")

    req = SpotifySaveRequest(
        playlist_title="Error Playlist",
        final_track_ids=["t1"],
        create_new=True
    )
    mock_request = MagicMock(spec=Request)
    mock_response = MagicMock(spec=Response)

    with pytest.raises(HTTPException) as exc_info:
        save_playlist(req=req, request=mock_request, response=mock_response)
    assert exc_info.value.status_code == 500
    assert "Spotify API 403 Forbidden" in str(exc_info.value.detail)


@patch("app.spotify_endpoints.spotify_service.get_client")
def test_save_playlist_update_existing_success(mock_get_client):
    mock_sp = MagicMock()
    mock_get_client.return_value = mock_sp

    req = SpotifySaveRequest(
        original_playlist_id="pl_orig_123",
        playlist_title="Existing Playlist",
        final_track_ids=["t1", "t2"],
        create_new=False
    )
    mock_request = MagicMock(spec=Request)
    mock_response = MagicMock(spec=Response)

    result = save_playlist(req=req, request=mock_request, response=mock_response)
    assert result["status"] == "success"
    assert result["message"] == "Playlist updated"
    assert result["playlist_id"] == "pl_orig_123"

    mock_sp.playlist_replace_items.assert_called_once_with(
        "pl_orig_123",
        ["spotify:track:t1", "spotify:track:t2"]
    )
    mock_sp.playlist_add_items.assert_not_called()
    mock_sp.current_user_playlist_create.assert_not_called()


@patch("app.spotify_endpoints.spotify_service.get_client")
def test_save_playlist_update_existing_chunking(mock_get_client):
    mock_sp = MagicMock()
    mock_get_client.return_value = mock_sp

    track_ids = [f"trk_{i}" for i in range(120)]
    req = SpotifySaveRequest(
        original_playlist_id="pl_orig_chunk",
        playlist_title="Existing Large Playlist",
        final_track_ids=track_ids,
        create_new=False
    )
    mock_request = MagicMock(spec=Request)
    mock_response = MagicMock(spec=Response)

    result = save_playlist(req=req, request=mock_request, response=mock_response)
    assert result["playlist_id"] == "pl_orig_chunk"

    expected_replace_uris = [f"spotify:track:trk_{i}" for i in range(100)]
    expected_add_uris = [f"spotify:track:trk_{i}" for i in range(100, 120)]

    mock_sp.playlist_replace_items.assert_called_once_with(
        "pl_orig_chunk",
        expected_replace_uris
    )
    mock_sp.playlist_add_items.assert_called_once_with(
        "pl_orig_chunk",
        expected_add_uris
    )


@patch("app.spotify_endpoints.spotify_service.get_client")
def test_save_playlist_update_existing_empty_tracks(mock_get_client):
    mock_sp = MagicMock()
    mock_get_client.return_value = mock_sp

    req = SpotifySaveRequest(
        original_playlist_id="pl_orig_empty",
        playlist_title="Existing Playlist",
        final_track_ids=[],
        create_new=False
    )
    mock_request = MagicMock(spec=Request)
    mock_response = MagicMock(spec=Response)

    result = save_playlist(req=req, request=mock_request, response=mock_response)
    assert result["status"] == "success"
    mock_sp.playlist_replace_items.assert_called_once_with("pl_orig_empty", [])
    mock_sp.playlist_add_items.assert_not_called()


@patch("app.spotify_endpoints.spotify_service.get_client")
def test_save_playlist_update_missing_original_id(mock_get_client):
    mock_sp = MagicMock()
    mock_get_client.return_value = mock_sp

    req = SpotifySaveRequest(
        playlist_title="Existing Playlist",
        final_track_ids=["t1"],
        create_new=False,
        original_playlist_id=None
    )
    mock_request = MagicMock(spec=Request)
    mock_response = MagicMock(spec=Response)

    with pytest.raises(HTTPException) as exc_info:
        save_playlist(req=req, request=mock_request, response=mock_response)
    assert exc_info.value.status_code == 400
    assert "original_playlist_id required when create_new is False" in str(exc_info.value.detail)


@patch("app.spotify_endpoints.spotify_service.get_client")
def test_save_playlist_update_error_no_silent_fallback(mock_get_client):
    mock_sp = MagicMock()
    mock_get_client.return_value = mock_sp
    mock_sp.playlist_replace_items.side_effect = Exception("User cannot modify playlist owned by another user")

    req = SpotifySaveRequest(
        original_playlist_id="pl_not_mine",
        playlist_title="Not Mine",
        final_track_ids=["t1"],
        create_new=False
    )
    mock_request = MagicMock(spec=Request)
    mock_response = MagicMock(spec=Response)

    with pytest.raises(HTTPException) as exc_info:
        save_playlist(req=req, request=mock_request, response=mock_response)
    assert exc_info.value.status_code == 500
    assert "User cannot modify playlist owned by another user" in str(exc_info.value.detail)

    # CRITICAL: Verify NO silent fallback to create a new playlist
    mock_sp.current_user_playlist_create.assert_not_called()
    if hasattr(mock_sp, "user_playlist_create"):
        mock_sp.user_playlist_create.assert_not_called()
