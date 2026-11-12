"""Unit tests for the in-memory fixed-window telemetry rate limiter."""

import hashlib
import os
from unittest.mock import patch

import pytest
from starlette.requests import Request

from app.services.rate_limiter import (
    DEFAULT_TELEMETRY_MAX_BODY_BYTES,
    DEFAULT_TELEMETRY_RATE_LIMIT,
    DEFAULT_TELEMETRY_RATE_WINDOW_SECONDS,
    FixedWindowRateLimiter,
    client_key,
    get_telemetry_limits,
    telemetry_rate_limiter,
)


class FakeClock:
    def __init__(self, start: float = 1000.0):
        self.now = start

    def __call__(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds


def make_request(headers=None, client=("10.0.0.1", 1234)) -> Request:
    raw_headers = [
        (k.lower().encode("latin-1"), v.encode("latin-1"))
        for k, v in (headers or {}).items()
    ]
    scope = {
        "type": "http",
        "method": "POST",
        "path": "/api/telemetry/event",
        "headers": raw_headers,
        "query_string": b"",
    }
    if client is not None:
        scope["client"] = client
    return Request(scope)


# ---------------------------------------------------------------------------
# FixedWindowRateLimiter
# ---------------------------------------------------------------------------


def test_allows_up_to_limit_then_blocks():
    clock = FakeClock()
    limiter = FixedWindowRateLimiter(clock=clock)
    for _ in range(3):
        allowed, retry_after = limiter.check("k", limit=3, window_seconds=60)
        assert allowed is True
        assert retry_after == 0

    allowed, retry_after = limiter.check("k", limit=3, window_seconds=60)
    assert allowed is False
    assert retry_after == 60


def test_retry_after_counts_down_and_is_at_least_one():
    clock = FakeClock()
    limiter = FixedWindowRateLimiter(clock=clock)
    limiter.check("k", limit=1, window_seconds=60)

    clock.advance(20.5)
    allowed, retry_after = limiter.check("k", limit=1, window_seconds=60)
    assert allowed is False
    assert retry_after == 40  # ceil(39.5)

    clock.advance(39.4)  # t=59.9, 0.1s left in window
    allowed, retry_after = limiter.check("k", limit=1, window_seconds=60)
    assert allowed is False
    assert retry_after == 1


def test_window_expiry_resets_count():
    clock = FakeClock()
    limiter = FixedWindowRateLimiter(clock=clock)
    limiter.check("k", limit=1, window_seconds=60)
    assert limiter.check("k", limit=1, window_seconds=60)[0] is False

    clock.advance(60)
    allowed, retry_after = limiter.check("k", limit=1, window_seconds=60)
    assert allowed is True
    assert retry_after == 0
    assert limiter.check("k", limit=1, window_seconds=60)[0] is False


def test_keys_are_isolated():
    clock = FakeClock()
    limiter = FixedWindowRateLimiter(clock=clock)
    assert limiter.check("a", limit=1, window_seconds=60)[0] is True
    assert limiter.check("a", limit=1, window_seconds=60)[0] is False
    assert limiter.check("b", limit=1, window_seconds=60)[0] is True


def test_reset_clears_state():
    limiter = FixedWindowRateLimiter(clock=FakeClock())
    limiter.check("k", limit=1, window_seconds=60)
    assert limiter.check("k", limit=1, window_seconds=60)[0] is False
    limiter.reset()
    assert limiter.check("k", limit=1, window_seconds=60)[0] is True
    assert limiter.tracked_keys() == 1


def test_expired_windows_are_pruned():
    clock = FakeClock()
    limiter = FixedWindowRateLimiter(clock=clock, max_keys=3)
    for key in ("a", "b", "c"):
        limiter.check(key, limit=5, window_seconds=60)
    assert limiter.tracked_keys() == 3

    clock.advance(61)
    limiter.check("d", limit=5, window_seconds=60)
    # a, b, c expired and were pruned when the cap was reached
    assert limiter.tracked_keys() == 1


def test_hard_cap_evicts_oldest_when_nothing_expired():
    clock = FakeClock()
    limiter = FixedWindowRateLimiter(clock=clock, max_keys=2)
    limiter.check("a", limit=1, window_seconds=60)
    clock.advance(1)
    limiter.check("b", limit=1, window_seconds=60)
    clock.advance(1)
    limiter.check("c", limit=1, window_seconds=60)

    assert limiter.tracked_keys() == 2
    # "a" (oldest) was evicted, so it starts a fresh window
    assert limiter.check("b", limit=1, window_seconds=60)[0] is False
    assert limiter.check("c", limit=1, window_seconds=60)[0] is False
    assert limiter.check("a", limit=1, window_seconds=60)[0] is True
    assert limiter.tracked_keys() == 2


def test_module_singleton_is_limiter():
    assert isinstance(telemetry_rate_limiter, FixedWindowRateLimiter)


# ---------------------------------------------------------------------------
# get_telemetry_limits
# ---------------------------------------------------------------------------

ENV_VARS = ("TELEMETRY_RATE_LIMIT", "TELEMETRY_RATE_WINDOW_SECONDS", "TELEMETRY_MAX_BODY_BYTES")


def _clean_env():
    return {k: v for k, v in os.environ.items() if k not in ENV_VARS}


def test_defaults_when_env_missing():
    with patch.dict(os.environ, _clean_env(), clear=True):
        assert get_telemetry_limits() == (60, 60, 2048)
    assert DEFAULT_TELEMETRY_RATE_LIMIT == 60
    assert DEFAULT_TELEMETRY_RATE_WINDOW_SECONDS == 60
    assert DEFAULT_TELEMETRY_MAX_BODY_BYTES == 2048


def test_valid_env_values_are_used():
    env = {
        "TELEMETRY_RATE_LIMIT": "5",
        "TELEMETRY_RATE_WINDOW_SECONDS": " 30 ",
        "TELEMETRY_MAX_BODY_BYTES": "512",
    }
    with patch.dict(os.environ, env):
        assert get_telemetry_limits() == (5, 30, 512)


@pytest.mark.parametrize("bad", ["abc", "0", "-3", "", "1.5", "  "])
def test_bad_env_values_fall_back_to_defaults(bad):
    env = {var: bad for var in ENV_VARS}
    with patch.dict(os.environ, env):
        assert get_telemetry_limits() == (60, 60, 2048)


def test_env_read_per_call():
    with patch.dict(os.environ, {"TELEMETRY_RATE_LIMIT": "7"}):
        assert get_telemetry_limits()[0] == 7
    with patch.dict(os.environ, {"TELEMETRY_RATE_LIMIT": "9"}):
        assert get_telemetry_limits()[0] == 9


# ---------------------------------------------------------------------------
# client_key
# ---------------------------------------------------------------------------


def _sha(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def test_client_key_prefers_x_real_ip():
    req = make_request({"x-real-ip": "1.2.3.4", "x-forwarded-for": "5.6.7.8"})
    key = client_key(req)
    assert key == _sha("1.2.3.4")
    assert "1.2.3.4" not in key


def test_client_key_uses_first_forwarded_for_entry():
    req = make_request({"x-forwarded-for": " 5.6.7.8 , 9.9.9.9"})
    key = client_key(req)
    assert key == _sha("5.6.7.8")
    assert "5.6.7.8" not in key


def test_client_key_falls_back_to_client_host():
    req = make_request({}, client=("10.0.0.1", 1234))
    key = client_key(req)
    assert key == _sha("10.0.0.1")
    assert "10.0.0.1" not in key


def test_client_key_unknown_when_nothing_available():
    req = make_request({}, client=None)
    assert client_key(req) == _sha("unknown")


def test_client_key_skips_blank_headers():
    req = make_request({"x-real-ip": "  ", "x-forwarded-for": " , 9.9.9.9"}, client=("10.0.0.1", 1))
    assert client_key(req) == _sha("10.0.0.1")


def test_distinct_clients_get_distinct_keys():
    a = client_key(make_request({"x-real-ip": "1.1.1.1"}))
    b = client_key(make_request({"x-real-ip": "2.2.2.2"}))
    assert a != b
