"""Unit tests for TelemetryService and POST /api/telemetry/event endpoint."""

import os
import json
import uuid
import hashlib
import asyncio
import pytest
from unittest.mock import patch, MagicMock

from app.main import app
from app.services.telemetry_service import (
    telemetry_service,
    InputLoadedEvent,
    ScanCompletedEvent,
    CleanSwapAppliedEvent,
    StitchCompletedEvent,
    FinishActionClickedEvent,
)

from app.services.rate_limiter import telemetry_rate_limiter, get_telemetry_limits

VALID_UUID = str(uuid.uuid4())

TELEMETRY_PATH = "/api/telemetry/event"


@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    """Give every test a fresh limiter window so tests stay independent."""
    telemetry_rate_limiter.reset()
    yield
    telemetry_rate_limiter.reset()


_UNSET = object()


def call_api_full(
    method: str,
    path: str,
    json_data=None,
    *,
    raw_body: bytes | None = None,
    headers: dict | None = None,
    chunks: list[bytes] | None = None,
    content_length=_UNSET,
    disconnect_mid_stream: bool = False,
) -> tuple[int, bytes, dict]:
    """Invoke the ASGI app directly and return (status, body, response headers).

    - ``raw_body`` sends bytes verbatim instead of JSON-encoding ``json_data``.
    - ``chunks`` streams the body as multiple ``http.request`` messages.
    - ``content_length`` overrides the header value (``None`` omits it).
    - ``disconnect_mid_stream`` marks the last chunk ``more_body=True`` and then
      sends ``http.disconnect``.
    """
    if chunks is None:
        body = raw_body if raw_body is not None else json.dumps(json_data).encode("utf-8")
        chunks = [body]
    total_len = sum(len(c) for c in chunks)

    status_code = None
    response_body = []
    response_headers: dict = {}
    pending = list(chunks)
    receive_calls = {"count": 0}

    async def receive():
        receive_calls["count"] += 1
        if pending:
            chunk = pending.pop(0)
            more = bool(pending) or disconnect_mid_stream
            return {"type": "http.request", "body": chunk, "more_body": more}
        return {"type": "http.disconnect"}

    async def send(message):
        nonlocal status_code
        if message["type"] == "http.response.start":
            status_code = message["status"]
            for k, v in message.get("headers", []):
                response_headers[k.decode("latin-1").lower()] = v.decode("latin-1")
        elif message["type"] == "http.response.body":
            response_body.append(message.get("body", b""))

    raw_headers = [(b"content-type", b"application/json")]
    if content_length is _UNSET:
        raw_headers.append((b"content-length", str(total_len).encode("ascii")))
    elif content_length is not None:
        raw_headers.append((b"content-length", str(content_length).encode("ascii")))
    for k, v in (headers or {}).items():
        raw_headers.append((k.lower().encode("latin-1"), v.encode("latin-1")))

    scope = {
        "type": "http",
        "method": method,
        "path": path,
        "headers": raw_headers,
        "query_string": b"",
    }
    asyncio.run(app(scope, receive, send))
    response_headers["_receive_calls"] = receive_calls["count"]
    return status_code, b"".join(response_body), response_headers


def call_api(method: str, path: str, json_data: dict) -> tuple[int, bytes]:
    """Invoke ASGI application directly without requiring third-party test clients."""
    status_code, body, _ = call_api_full(method, path, json_data)
    return status_code, body


def test_telemetry_route_registered():
    """Verify POST /api/telemetry/event is registered in FastAPI routes."""
    paths = {getattr(r, "path", None): getattr(r, "methods", set()) for r in app.routes}
    assert "/api/telemetry/event" in paths
    assert "POST" in paths["/api/telemetry/event"]


def test_valid_input_loaded_event(capsys):
    """Verify input_loaded event returns HTTP 204 and logs structured JSON."""
    payload = {
        "event": "input_loaded",
        "platform": "spotify",
        "viewport_class": "desktop",
        "vip_mode": False,
        "session_anon_id": VALID_UUID,
        "input_type": "song_search",
        "track_count_bucket": "1-10",
    }
    status_code, body = call_api("POST", "/api/telemetry/event", payload)
    assert status_code == 204
    assert body == b""

    captured = capsys.readouterr().out
    assert "[cp_telemetry] " in captured
    for line in captured.splitlines():
        if line.startswith("[cp_telemetry] "):
            log_json = json.loads(line.replace("[cp_telemetry] ", "", 1))
            assert log_json["channel"] == "cp_telemetry"
            assert log_json["schema_version"] == 1
            assert "timestamp" in log_json
            assert log_json["data"]["event"] == "input_loaded"
            assert log_json["data"]["input_type"] == "song_search"
            assert log_json["data"]["track_count_bucket"] == "1-10"


def test_valid_scan_completed_event(capsys):
    """Verify scan_completed event returns HTTP 204 and logs structured JSON."""
    payload = {
        "event": "scan_completed",
        "platform": "ytmusic",
        "viewport_class": "mobile",
        "vip_mode": True,
        "session_anon_id": VALID_UUID,
        "preset_id": "kid_safe",
        "track_count": 25,
        "flagged_count": 3,
        "lyrics_unavailable_count": 2,
    }
    status_code, _ = call_api("POST", "/api/telemetry/event", payload)
    assert status_code == 204

    captured = capsys.readouterr().out
    assert "[cp_telemetry] " in captured
    for line in captured.splitlines():
        if line.startswith("[cp_telemetry] "):
            log_json = json.loads(line.replace("[cp_telemetry] ", "", 1))
            assert log_json["data"]["event"] == "scan_completed"
            assert log_json["data"]["preset_id"] == "kid_safe"
            assert log_json["data"]["track_count"] == 25
            assert log_json["data"]["flagged_count"] == 3
            assert log_json["data"]["lyrics_unavailable_count"] == 2


def test_valid_clean_swap_applied_event(capsys):
    """Verify clean_swap_applied event returns HTTP 204."""
    payload = {
        "event": "clean_swap_applied",
        "platform": "spotify",
        "viewport_class": "desktop",
        "vip_mode": False,
        "session_anon_id": VALID_UUID,
        "mode": "bulk",
        "swapped_count": 4,
        "unfound_count": 1,
    }
    status_code, _ = call_api("POST", "/api/telemetry/event", payload)
    assert status_code == 204

    captured = capsys.readouterr().out
    assert "[cp_telemetry] " in captured
    for line in captured.splitlines():
        if line.startswith("[cp_telemetry] "):
            log_json = json.loads(line.replace("[cp_telemetry] ", "", 1))
            assert log_json["data"]["event"] == "clean_swap_applied"
            assert log_json["data"]["mode"] == "bulk"
            assert log_json["data"]["swapped_count"] == 4
            assert log_json["data"]["unfound_count"] == 1


def test_valid_stitch_completed_event(capsys):
    """Verify stitch_completed event returns HTTP 204."""
    payload = {
        "event": "stitch_completed",
        "platform": "ytmusic",
        "viewport_class": "desktop",
        "vip_mode": False,
        "session_anon_id": VALID_UUID,
        "source_count": 3,
        "clean_rule": "replace_clean_or_drop",
        "output_count": 42,
    }
    status_code, _ = call_api("POST", "/api/telemetry/event", payload)
    assert status_code == 204

    captured = capsys.readouterr().out
    assert "[cp_telemetry] " in captured
    for line in captured.splitlines():
        if line.startswith("[cp_telemetry] "):
            log_json = json.loads(line.replace("[cp_telemetry] ", "", 1))
            assert log_json["data"]["event"] == "stitch_completed"
            assert log_json["data"]["source_count"] == 3
            assert log_json["data"]["clean_rule"] == "replace_clean_or_drop"
            assert log_json["data"]["output_count"] == 42


def test_valid_finish_action_clicked_event(capsys):
    """Verify finish_action_clicked event returns HTTP 204."""
    for action in [
        "play_clean_queue",
        "copy_clean_links",
        "open_track_link",
        "file_export",
        "vip_spotify_save",
    ]:
        payload = {
            "event": "finish_action_clicked",
            "platform": "spotify",
            "viewport_class": "desktop",
            "vip_mode": True,
            "session_anon_id": VALID_UUID,
            "action": action,
        }
        status_code, _ = call_api("POST", "/api/telemetry/event", payload)
        assert status_code == 204


def test_reject_extra_forbidden_fields():
    """Verify payload with unknown extra fields is rejected with HTTP 422."""
    payload = {
        "event": "input_loaded",
        "platform": "spotify",
        "viewport_class": "desktop",
        "vip_mode": False,
        "session_anon_id": VALID_UUID,
        "input_type": "song_search",
        "track_count_bucket": "1-10",
        "extra_field": "foo",
    }
    status_code, _ = call_api("POST", "/api/telemetry/event", payload)
    assert status_code == 422


def test_reject_pii_url_in_session_anon_id():
    """Verify URL and URI injection in session_anon_id is rejected with HTTP 422."""
    for bad_id in [
        "https://open.spotify.com/playlist/xyz",
        "http://evil.com",
        "//open.spotify.com/track/123",
        "spotify:track:4cOdK2wGLETKBW3PvgPWqT",
        "mailto:test@example.com",
    ]:
        payload = {
            "event": "input_loaded",
            "platform": "spotify",
            "viewport_class": "desktop",
            "vip_mode": False,
            "session_anon_id": bad_id,
            "input_type": "song_search",
            "track_count_bucket": "1-10",
        }
        status_code, _ = call_api("POST", "/api/telemetry/event", payload)
        assert status_code == 422


def test_reject_pii_email_in_session_anon_id():
    """Verify email address injection is rejected with HTTP 422."""
    payload = {
        "event": "finish_action_clicked",
        "platform": "spotify",
        "viewport_class": "desktop",
        "vip_mode": True,
        "session_anon_id": "user@example.com",
        "action": "vip_spotify_save",
    }
    status_code, _ = call_api("POST", "/api/telemetry/event", payload)
    assert status_code == 422


def test_reject_pii_ip_in_session_anon_id():
    """Verify IP address injection is rejected with HTTP 422."""
    payload = {
        "event": "finish_action_clicked",
        "platform": "spotify",
        "viewport_class": "desktop",
        "vip_mode": True,
        "session_anon_id": "192.168.1.100",
        "action": "play_clean_queue",
    }
    status_code, _ = call_api("POST", "/api/telemetry/event", payload)
    assert status_code == 422


def test_reject_unknown_event_type():
    """Verify unsupported event discriminator is rejected with HTTP 422."""
    payload = {
        "event": "custom_unsupported_event",
        "platform": "spotify",
        "viewport_class": "desktop",
        "vip_mode": False,
        "session_anon_id": VALID_UUID,
    }
    status_code, _ = call_api("POST", "/api/telemetry/event", payload)
    assert status_code == 422


def test_reject_invalid_platform_or_viewport():
    """Verify invalid literal values are rejected with HTTP 422."""
    payload = {
        "event": "input_loaded",
        "platform": "apple_music",
        "viewport_class": "desktop",
        "vip_mode": False,
        "session_anon_id": VALID_UUID,
        "input_type": "song_search",
        "track_count_bucket": "1-10",
    }
    status_code, _ = call_api("POST", "/api/telemetry/event", payload)
    assert status_code == 422

    payload["platform"] = "spotify"
    payload["viewport_class"] = "smart_watch"
    status_code2, _ = call_api("POST", "/api/telemetry/event", payload)
    assert status_code2 == 422


def test_reject_negative_integer_counts():
    """Verify negative integer counts are rejected with HTTP 422."""
    payload = {
        "event": "scan_completed",
        "platform": "ytmusic",
        "viewport_class": "mobile",
        "vip_mode": False,
        "session_anon_id": VALID_UUID,
        "preset_id": "moderate",
        "track_count": -5,
        "flagged_count": 0,
        "lyrics_unavailable_count": 0,
    }
    status_code, _ = call_api("POST", "/api/telemetry/event", payload)
    assert status_code == 422


def test_async_forwarding_when_env_set():
    """Verify telemetry forwards asynchronously when TELEMETRY_INGEST_URL is configured."""
    payload = {
        "event": "finish_action_clicked",
        "platform": "ytmusic",
        "viewport_class": "desktop",
        "vip_mode": False,
        "session_anon_id": VALID_UUID,
        "action": "play_clean_queue",
    }
    with patch.dict(os.environ, {"TELEMETRY_INGEST_URL": "https://telemetry.example.com/ingest"}):
        with patch("requests.post") as mock_post:
            # Service uses threadpool; call record_event and wait for pool
            event = FinishActionClickedEvent(**payload)
            telemetry_service.record_event(event)

            # Wait briefly for threadpool task to execute
            import time
            time.sleep(0.1)

            mock_post.assert_called_once()
            args, kwargs = mock_post.call_args
            assert args[0] == "https://telemetry.example.com/ingest"
            assert kwargs["json"]["channel"] == "cp_telemetry"
            assert kwargs["json"]["data"]["action"] == "play_clean_queue"


# ---------------------------------------------------------------------------
# Story 7.1: rate limiting and payload bounds
# ---------------------------------------------------------------------------

def _finish_payload() -> dict:
    return {
        "event": "finish_action_clicked",
        "platform": "spotify",
        "viewport_class": "desktop",
        "vip_mode": False,
        "session_anon_id": VALID_UUID,
        "action": "play_clean_queue",
    }


def _telemetry_lines(out: str) -> list[str]:
    return [line for line in out.splitlines() if line.startswith("[cp_telemetry] ")]


def test_rate_limit_exceeded_returns_429_with_retry_after(capsys):
    """The (limit+1)th request from one key gets 429 + Retry-After and no log line."""
    headers = {"x-real-ip": "203.0.113.7"}
    with patch.dict(os.environ, {"TELEMETRY_RATE_LIMIT": "2", "TELEMETRY_RATE_WINDOW_SECONDS": "60"}):
        for _ in range(2):
            status, _, _ = call_api_full("POST", TELEMETRY_PATH, _finish_payload(), headers=headers)
            assert status == 204
        capsys.readouterr()

        with patch.object(telemetry_service, "record_event") as mock_record:
            status, body, resp_headers = call_api_full("POST", TELEMETRY_PATH, _finish_payload(), headers=headers)
            mock_record.assert_not_called()

    assert status == 429
    retry_after = int(resp_headers["retry-after"])
    assert 1 <= retry_after <= 60
    out = capsys.readouterr().out
    assert _telemetry_lines(out) == []
    assert "203.0.113.7" not in out


def test_rate_limit_window_expiry_allows_again():
    """After the window ends the same client is allowed again (fake clock, no sleeps)."""
    now = {"t": 5000.0}
    headers = {"x-real-ip": "203.0.113.8"}
    with patch.object(telemetry_rate_limiter, "_clock", lambda: now["t"]), \
         patch.dict(os.environ, {"TELEMETRY_RATE_LIMIT": "1", "TELEMETRY_RATE_WINDOW_SECONDS": "60"}):
        assert call_api_full("POST", TELEMETRY_PATH, _finish_payload(), headers=headers)[0] == 204
        assert call_api_full("POST", TELEMETRY_PATH, _finish_payload(), headers=headers)[0] == 429
        now["t"] += 60
        assert call_api_full("POST", TELEMETRY_PATH, _finish_payload(), headers=headers)[0] == 204


def test_rate_limit_separate_clients_counted_independently():
    """Different x-real-ip / x-forwarded-for clients do not share a window."""
    with patch.dict(os.environ, {"TELEMETRY_RATE_LIMIT": "1"}):
        a = {"x-real-ip": "198.51.100.1"}
        b = {"x-forwarded-for": "198.51.100.2, 10.0.0.1"}
        assert call_api_full("POST", TELEMETRY_PATH, _finish_payload(), headers=a)[0] == 204
        assert call_api_full("POST", TELEMETRY_PATH, _finish_payload(), headers=a)[0] == 429
        assert call_api_full("POST", TELEMETRY_PATH, _finish_payload(), headers=b)[0] == 204
        assert call_api_full("POST", TELEMETRY_PATH, _finish_payload(), headers=b)[0] == 429


def test_invalid_payloads_still_count_toward_limit():
    """Size-valid but schema-invalid requests are counted, so floods of junk are limited."""
    headers = {"x-real-ip": "198.51.100.9"}
    with patch.dict(os.environ, {"TELEMETRY_RATE_LIMIT": "1"}):
        assert call_api_full("POST", TELEMETRY_PATH, raw_body=b"{not json", headers=headers)[0] == 422
        assert call_api_full("POST", TELEMETRY_PATH, _finish_payload(), headers=headers)[0] == 429


def test_oversized_content_length_returns_413_without_reading_body(capsys):
    """A content-length above the max is rejected before the body is read."""
    with patch.dict(os.environ, {"TELEMETRY_MAX_BODY_BYTES": "100"}), \
         patch.object(telemetry_service, "record_event") as mock_record:
        status, _, resp = call_api_full(
            "POST", TELEMETRY_PATH, raw_body=b"x" * 50, content_length=101,
        )
        mock_record.assert_not_called()
    assert status == 413
    assert resp["_receive_calls"] == 0
    assert _telemetry_lines(capsys.readouterr().out) == []


def test_oversized_default_limit_by_header():
    """The default 2048-byte cap applies when no env override is set."""
    env = {k: v for k, v in os.environ.items() if k != "TELEMETRY_MAX_BODY_BYTES"}
    with patch.dict(os.environ, env, clear=True):
        status, _, _ = call_api_full("POST", TELEMETRY_PATH, raw_body=b"x" * 2049)
    assert status == 413


def test_oversized_streamed_body_without_content_length_returns_413(capsys):
    """A chunked body with no content-length is cut off once the cap is crossed."""
    with patch.dict(os.environ, {"TELEMETRY_MAX_BODY_BYTES": "100"}), \
         patch.object(telemetry_service, "record_event") as mock_record:
        status, _, _ = call_api_full(
            "POST", TELEMETRY_PATH, chunks=[b"a" * 60, b"b" * 60, b"c" * 60], content_length=None,
        )
        mock_record.assert_not_called()
    assert status == 413
    assert _telemetry_lines(capsys.readouterr().out) == []


def test_oversized_streamed_body_with_false_small_content_length_returns_413():
    """A lying (too small) content-length does not bypass the streaming cap."""
    with patch.dict(os.environ, {"TELEMETRY_MAX_BODY_BYTES": "100"}):
        status, _, _ = call_api_full(
            "POST", TELEMETRY_PATH, chunks=[b"a" * 80, b"b" * 80], content_length=10,
        )
    assert status == 413


def test_oversized_request_does_not_count_toward_rate_limit():
    """Size check runs first: a 413 does not consume a slot in the window."""
    headers = {"x-real-ip": "198.51.100.20"}
    with patch.dict(os.environ, {"TELEMETRY_RATE_LIMIT": "1", "TELEMETRY_MAX_BODY_BYTES": "1024"}):
        assert call_api_full("POST", TELEMETRY_PATH, raw_body=b"x" * 2000, headers=headers)[0] == 413
        assert call_api_full("POST", TELEMETRY_PATH, _finish_payload(), headers=headers)[0] == 204


def test_valid_chunked_body_under_limit_is_accepted(capsys):
    """A valid event streamed in several chunks without content-length is still accepted."""
    body = json.dumps(_finish_payload()).encode("utf-8")
    mid = len(body) // 2
    status, _, _ = call_api_full(
        "POST", TELEMETRY_PATH, chunks=[body[:mid], body[mid:]], content_length=None,
    )
    assert status == 204
    assert len(_telemetry_lines(capsys.readouterr().out)) == 1


def test_malformed_json_returns_422_without_log_line(capsys):
    """Malformed JSON yields a FastAPI-style 422 and nothing is emitted."""
    with patch.object(telemetry_service, "record_event") as mock_record:
        status, body, _ = call_api_full("POST", TELEMETRY_PATH, raw_body=b'{"event": "input_loaded",')
        mock_record.assert_not_called()
    assert status == 422
    assert "detail" in json.loads(body)
    assert _telemetry_lines(capsys.readouterr().out) == []


def test_schema_violation_returns_fastapi_422_shape(capsys):
    """Schema violations keep the FastAPI {'detail': [...]} error shape and emit nothing."""
    payload = _finish_payload()
    payload["extra_field"] = "nope"
    status, body, _ = call_api_full("POST", TELEMETRY_PATH, payload)
    assert status == 422
    detail = json.loads(body)["detail"]
    assert isinstance(detail, list) and detail
    assert {"loc", "msg", "type"} <= set(detail[0])
    assert _telemetry_lines(capsys.readouterr().out) == []


def test_bad_env_values_apply_defaults():
    """Non-integer / zero limits fall back to defaults (60/min) instead of blocking everything."""
    with patch.dict(os.environ, {"TELEMETRY_RATE_LIMIT": "abc", "TELEMETRY_MAX_BODY_BYTES": "0"}):
        assert get_telemetry_limits()[0] == 60
        assert call_api_full("POST", TELEMETRY_PATH, _finish_payload())[0] == 204
    with patch.dict(os.environ, {"TELEMETRY_RATE_LIMIT": "0"}):
        assert get_telemetry_limits()[0] == 60
        assert call_api_full("POST", TELEMETRY_PATH, _finish_payload())[0] == 204


def test_non_utf8_body_returns_422_not_500(capsys):
    """A size-valid body that is not UTF-8 must yield 422 (no crash in the error handler)."""
    with patch.object(telemetry_service, "record_event") as mock_record:
        status, body, _ = call_api_full("POST", TELEMETRY_PATH, raw_body=b"\xff\xfe")
        mock_record.assert_not_called()
    assert status == 422
    assert "detail" in json.loads(body)
    assert _telemetry_lines(capsys.readouterr().out) == []


def test_client_disconnect_mid_stream_returns_400(capsys):
    """A client disconnecting mid-body gets 400 and nothing is emitted."""
    with patch.object(telemetry_service, "record_event") as mock_record:
        status, _, _ = call_api_full(
            "POST", TELEMETRY_PATH, chunks=[b'{"event": '], content_length=None,
            disconnect_mid_stream=True,
        )
        mock_record.assert_not_called()
    assert status == 400
    assert _telemetry_lines(capsys.readouterr().out) == []


def test_unparseable_content_length_falls_through_to_streaming_cap():
    """A non-numeric content-length is ignored; the streaming cap still applies."""
    with patch.dict(os.environ, {"TELEMETRY_MAX_BODY_BYTES": "100"}):
        status, _, _ = call_api_full(
            "POST", TELEMETRY_PATH, raw_body=b"x" * 150, content_length="abc",
        )
        assert status == 413
    status, _, _ = call_api_full(
        "POST", TELEMETRY_PATH, _finish_payload(), content_length="abc",
    )
    assert status == 204


def test_valid_event_logged_line_contains_no_client_key(capsys):
    """Emitted events never carry the client IP or its hashed key."""
    ip = "192.0.2.55"
    status, _, _ = call_api_full("POST", TELEMETRY_PATH, _finish_payload(), headers={"x-real-ip": ip})
    assert status == 204
    out = capsys.readouterr().out
    assert ip not in out
    assert hashlib.sha256(ip.encode()).hexdigest() not in out
