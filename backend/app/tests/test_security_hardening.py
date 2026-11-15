"""Security hardening: OAuth state (CSRF), request caps, API rate limiting, CORS."""

import importlib

import pytest
from fastapi import HTTPException, Request, Response
from pydantic import ValidationError
from unittest.mock import MagicMock, patch

from app import main as main_module
from app.main import (
    ExportRequest,
    KeywordSearchRequest,
    PlaylistFetchRequest,
    PlaylistScanRequest,
    StitchRequest,
)
from app.services import rate_limiter
from app.services.spotify_service import OAUTH_STATE_COOKIE
from app.spotify_endpoints import auth_callback, login, SpotifySaveRequest


def _track(i=0):
    return {"id": f"t{i}", "title": "T", "artist": "A"}


def _request(cookies=None, headers=None, host="1.2.3.4"):
    req = MagicMock(spec=Request)
    req.cookies = cookies or {}
    req.headers = headers or {}
    req.client = MagicMock(host=host)
    return req


# ---------- OAuth state ----------

@patch("app.spotify_endpoints.spotify_service.get_login_url")
def test_login_sets_state_cookie_and_passes_state(mock_url):
    mock_url.return_value = "https://accounts.spotify.com/authorize?x=1"
    resp = Response()
    out = login(request=_request(), response=resp)
    assert out["status"] == "success"
    state = mock_url.call_args.kwargs["state"]
    assert len(state) >= 32
    cookie = resp.headers["set-cookie"]
    assert OAUTH_STATE_COOKIE in cookie and state in cookie
    assert "HttpOnly" in cookie


@patch("app.spotify_endpoints.spotify_service.exchange_code")
def test_callback_rejects_missing_state(mock_exchange):
    resp = auth_callback(request=_request(cookies={OAUTH_STATE_COOKIE: "abc"}), code="c")
    assert "auth_error=invalid_state" in resp.headers["location"]
    mock_exchange.assert_not_called()


@patch("app.spotify_endpoints.spotify_service.exchange_code")
def test_callback_rejects_mismatched_state(mock_exchange):
    req = _request(cookies={OAUTH_STATE_COOKIE: "abc"})
    resp = auth_callback(request=req, code="c", state="different")
    assert "auth_error=invalid_state" in resp.headers["location"]
    mock_exchange.assert_not_called()


@patch("app.spotify_endpoints.spotify_service.exchange_code")
def test_callback_rejects_missing_state_cookie(mock_exchange):
    resp = auth_callback(request=_request(), code="c", state="abc")
    assert "auth_error=invalid_state" in resp.headers["location"]
    mock_exchange.assert_not_called()


@patch("app.spotify_endpoints.spotipy.Spotify")
@patch("app.spotify_endpoints.spotify_service.set_session_cookie")
@patch("app.spotify_endpoints.spotify_service.exchange_code")
def test_callback_accepts_matching_state_and_clears_it(mock_exchange, mock_set, mock_sp):
    mock_exchange.return_value = {"access_token": "tok"}
    req = _request(cookies={OAUTH_STATE_COOKIE: "abc"})
    resp = auth_callback(request=req, code="c", state="abc")
    assert resp.headers["location"] == "/?auth_success=true&platform=spotify"
    mock_exchange.assert_called_once()
    cleared = [v for k, v in resp.raw_headers if k == b"set-cookie" and OAUTH_STATE_COOKIE.encode() in v]
    assert cleared, "state cookie must be cleared after use"


# ---------- request caps ----------

def test_scan_request_caps_tracks():
    PlaylistScanRequest(tracks=[_track(i) for i in range(300)])
    with pytest.raises(ValidationError):
        PlaylistScanRequest(tracks=[_track(i) for i in range(301)])


def test_scan_request_caps_blocklist():
    with pytest.raises(ValidationError):
        PlaylistScanRequest(tracks=[], custom_blocklist=["x"] * 201)


def test_keyword_request_caps():
    with pytest.raises(ValidationError):
        KeywordSearchRequest(tracks=[_track(i) for i in range(301)], target_keywords=["a"])
    with pytest.raises(ValidationError):
        KeywordSearchRequest(tracks=[], target_keywords=["a"] * 51)


def test_stitch_and_export_caps():
    with pytest.raises(ValidationError):
        StitchRequest(playlists=[{}] * 21)
    with pytest.raises(ValidationError):
        ExportRequest(format="csv", tracks=[{}] * 2001)
    with pytest.raises(ValidationError):
        ExportRequest(format="csv", tracks=[], playlist_title="x" * 201)


def test_spotify_save_caps():
    with pytest.raises(ValidationError):
        SpotifySaveRequest(playlist_title="x" * 101, final_track_ids=[])
    with pytest.raises(ValidationError):
        SpotifySaveRequest(playlist_title="ok", final_track_ids=["a"] * 10001)


@patch("app.main.ytmusic_service")
def test_playlist_fetch_clamps_limit(mock_yt):
    mock_yt.get_playlist.return_value = {}
    req = PlaylistFetchRequest(url_or_id="PLabc", limit=10_000_000, platform="ytmusic")
    main_module.fetch_playlist(req, MagicMock(spec=Request), Response())
    assert mock_yt.get_playlist.call_args.kwargs["limit"] == 200


# ---------- API rate limiting ----------

def test_enforce_api_rate_limit_blocks_after_limit(monkeypatch):
    monkeypatch.setenv("API_RATE_LIMIT", "2")
    monkeypatch.setenv("API_RATE_WINDOW_SECONDS", "60")
    rate_limiter.api_rate_limiter.reset()
    req = _request(host="9.9.9.9")
    rate_limiter.enforce_api_rate_limit(req)
    rate_limiter.enforce_api_rate_limit(req)
    with pytest.raises(HTTPException) as exc:
        rate_limiter.enforce_api_rate_limit(req)
    assert exc.value.status_code == 429
    assert int(exc.value.headers["Retry-After"]) >= 1
    rate_limiter.api_rate_limiter.reset()


def test_expensive_routes_use_rate_limit_dependency():
    guarded = {
        "/api/catalog/search", "/api/catalog/album", "/api/catalog/resolve",
        "/api/playlist/fetch", "/api/scan/playlist", "/api/scan/track-lyrics",
        "/api/scan/keywords", "/api/replacements/find", "/api/replacements/find-batch",
    }
    found = set()
    for route in main_module.app.routes:
        path = getattr(route, "path", None)
        if path in guarded:
            deps = [d.call for d in route.dependant.dependencies]
            assert rate_limiter.enforce_api_rate_limit in deps, path
            found.add(path)
    assert found == guarded


# ---------- CORS ----------

def test_no_wildcard_cors_with_credentials(monkeypatch):
    monkeypatch.delenv("CORS_ALLOWED_ORIGINS", raising=False)
    assert main_module.build_cors_origins() == []
    for mw in main_module.app.user_middleware:
        if mw.cls.__name__ == "CORSMiddleware":
            assert mw.kwargs.get("allow_origins") != ["*"]


def test_cors_origins_parsed_from_env(monkeypatch):
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", "https://a.example, https://b.example ,*")
    assert main_module.build_cors_origins() == ["https://a.example", "https://b.example"]
