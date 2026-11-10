import pytest
from unittest.mock import MagicMock, patch
from fastapi import Request, Response
from spotipy.exceptions import SpotifyException
from app.spotify_endpoints import auth_callback, get_auth_status, logout


def test_auth_callback_with_error():
    mock_request = MagicMock(spec=Request)
    resp = auth_callback(request=mock_request, error="access_denied")
    assert resp.status_code == 307
    assert resp.headers["location"] == "/?auth_error=access_denied&platform=spotify"


def test_auth_callback_missing_code():
    mock_request = MagicMock(spec=Request)
    resp = auth_callback(request=mock_request)
    assert resp.status_code == 307
    assert resp.headers["location"] == "/?auth_error=missing_code&platform=spotify"


@patch("app.spotify_endpoints.spotipy.Spotify")
@patch("app.spotify_endpoints.spotify_service.set_session_cookie")
@patch("app.spotify_endpoints.spotify_service.exchange_code")
def test_auth_callback_success(mock_exchange, mock_set_cookie, mock_spotify_cls):
    mock_request = MagicMock(spec=Request)
    token_info = {"access_token": "valid_token_123"}
    mock_exchange.return_value = token_info

    mock_sp_instance = MagicMock()
    mock_spotify_cls.return_value = mock_sp_instance
    mock_sp_instance.current_user.return_value = {"id": "test_user", "display_name": "Test User"}

    resp = auth_callback(request=mock_request, code="test_code_xyz")
    assert resp.status_code == 307
    assert resp.headers["location"] == "/?auth_success=true&platform=spotify"

    mock_exchange.assert_called_once_with("test_code_xyz", request=mock_request)
    mock_spotify_cls.assert_called_once_with(auth="valid_token_123")
    mock_sp_instance.current_user.assert_called_once()
    mock_set_cookie.assert_called_once_with(resp, token_info, request=mock_request)


@patch("app.spotify_endpoints.spotify_service.clear_session_cookie")
@patch("app.spotify_endpoints.spotipy.Spotify")
@patch("app.spotify_endpoints.spotify_service.set_session_cookie")
@patch("app.spotify_endpoints.spotify_service.exchange_code")
def test_auth_callback_allowlist_blocked_403(mock_exchange, mock_set_cookie, mock_spotify_cls, mock_clear_cookie):
    mock_request = MagicMock(spec=Request)
    token_info = {"access_token": "blocked_token_456"}
    mock_exchange.return_value = token_info

    mock_sp_instance = MagicMock()
    mock_spotify_cls.return_value = mock_sp_instance
    # Simulate Spotify 403 Developer Mode allowlist restriction
    mock_sp_instance.current_user.side_effect = SpotifyException(
        http_status=403,
        code=-1,
        msg="User not registered in the Developer Dashboard"
    )

    resp = auth_callback(request=mock_request, code="blocked_code")
    assert resp.status_code == 307
    assert resp.headers["location"] == "/?auth_error=allowlist_blocked&platform=spotify"

    mock_set_cookie.assert_not_called()
    mock_clear_cookie.assert_called_once_with(resp)


@patch("app.spotify_endpoints.spotify_service.clear_session_cookie")
@patch("app.spotify_endpoints.spotipy.Spotify")
@patch("app.spotify_endpoints.spotify_service.set_session_cookie")
@patch("app.spotify_endpoints.spotify_service.exchange_code")
def test_auth_callback_non_403_spotify_exception(
    mock_exchange, mock_set_cookie, mock_spotify_cls, mock_clear_cookie
):
    mock_request = MagicMock(spec=Request)
    token_info = {"access_token": "token_with_multiline_err"}
    mock_exchange.return_value = token_info

    mock_sp_instance = MagicMock()
    mock_spotify_cls.return_value = mock_sp_instance
    mock_sp_instance.current_user.side_effect = SpotifyException(
        http_status=500,
        code=-1,
        msg="Internal Spotify Error\nLine 2 with special & characters"
    )

    resp = auth_callback(request=mock_request, code="err_code")
    assert resp.status_code == 307
    assert "\n" not in resp.headers["location"]
    assert "platform=spotify" in resp.headers["location"]
    # Check that it's URL quoted
    assert " " not in resp.headers["location"]

    mock_set_cookie.assert_not_called()
    mock_clear_cookie.assert_called_once_with(resp)


@patch("app.spotify_endpoints.spotify_service.is_authenticated")
def test_get_auth_status(mock_is_auth):
    mock_request = MagicMock(spec=Request)
    mock_response = MagicMock(spec=Response)

    mock_is_auth.return_value = True
    assert get_auth_status(mock_request, mock_response) == {"authenticated": True}

    mock_is_auth.return_value = False
    assert get_auth_status(mock_request, mock_response) == {"authenticated": False}


@patch("app.spotify_endpoints.spotify_service.logout")
def test_logout(mock_logout):
    mock_response = MagicMock(spec=Response)
    res = logout(mock_response)
    assert res == {"status": "success", "message": "Logged out of Spotify"}
    mock_logout.assert_called_once_with(response=mock_response)
