"""Unit tests for TelemetryService and POST /api/telemetry/event endpoint."""

import os
import json
import uuid
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

VALID_UUID = str(uuid.uuid4())


def call_api(method: str, path: str, json_data: dict) -> tuple[int, bytes]:
    """Invoke ASGI application directly without requiring third-party test clients."""
    body = json.dumps(json_data).encode("utf-8")
    status_code = None
    response_body = []

    async def receive():
        return {"type": "http.request", "body": body, "more_body": False}

    async def send(message):
        nonlocal status_code
        if message["type"] == "http.response.start":
            status_code = message["status"]
        elif message["type"] == "http.response.body":
            response_body.append(message.get("body", b""))

    scope = {
        "type": "http",
        "method": method,
        "path": path,
        "headers": [
            (b"content-type", b"application/json"),
            (b"content-length", str(len(body)).encode("ascii")),
        ],
        "query_string": b"",
    }
    asyncio.run(app(scope, receive, send))
    return status_code, b"".join(response_body)


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
