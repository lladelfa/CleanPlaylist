"""In-memory fixed-window rate limiter for the public telemetry endpoint.

Best effort only: state lives in process memory, so each serverless instance
(e.g. on Vercel) keeps its own counters. Platform host limits remain the
outer defense. Stdlib only, no external store.
"""

import hashlib
import math
import os
import threading
import time
from typing import Callable, Dict, Tuple

DEFAULT_TELEMETRY_RATE_LIMIT = 60
DEFAULT_TELEMETRY_RATE_WINDOW_SECONDS = 60
DEFAULT_TELEMETRY_MAX_BODY_BYTES = 2048

DEFAULT_MAX_KEYS = 10_000


class FixedWindowRateLimiter:
    """Per-key fixed-window counter with bounded memory.

    State per key is a single ``(window_start, count, window_seconds)`` tuple. When the number of
    tracked keys reaches ``max_keys``, expired windows are pruned first; if the
    table is still full, the keys with the oldest windows are evicted.
    """

    def __init__(self, clock: Callable[[], float] = time.monotonic, max_keys: int = DEFAULT_MAX_KEYS):
        self._clock = clock
        self._max_keys = max(1, int(max_keys))
        self._lock = threading.Lock()
        # key -> (window_start, count, window_seconds)
        self._windows: Dict[str, Tuple[float, int, int]] = {}

    def check(self, key: str, limit: int, window_seconds: int) -> Tuple[bool, int]:
        """Count one request for ``key``.

        Returns ``(allowed, retry_after)``. ``retry_after`` is 0 when allowed,
        otherwise the whole seconds (>= 1) until the current window resets.
        """
        now = self._clock()
        with self._lock:
            entry = self._windows.get(key)
            if entry is not None and now - entry[0] >= window_seconds:
                entry = None  # window expired, start fresh

            if entry is None:
                if key not in self._windows and len(self._windows) >= self._max_keys:
                    self._make_room(now)
                self._windows[key] = (now, 1, window_seconds)
                return (True, 0) if limit >= 1 else (False, max(1, math.ceil(window_seconds)))

            start, count, _ = entry
            if count >= limit:
                remaining = start + window_seconds - now
                return False, max(1, math.ceil(remaining))

            self._windows[key] = (start, count + 1, window_seconds)
            return True, 0

    def reset(self) -> None:
        with self._lock:
            self._windows.clear()

    def tracked_keys(self) -> int:
        with self._lock:
            return len(self._windows)

    def _make_room(self, now: float) -> None:
        """Prune expired windows, then evict oldest windows until below the cap."""
        expired = [k for k, (start, _, win) in self._windows.items() if now - start >= win]
        for k in expired:
            del self._windows[k]
        while self._windows and len(self._windows) >= self._max_keys:
            oldest = min(self._windows, key=lambda k: self._windows[k][0])
            del self._windows[oldest]


def _positive_int_env(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        value = int(raw.strip())
    except (TypeError, ValueError):
        return default
    return value if value > 0 else default


def get_telemetry_limits() -> Tuple[int, int, int]:
    """Return ``(limit, window_seconds, max_body_bytes)`` read from env on every call."""
    return (
        _positive_int_env("TELEMETRY_RATE_LIMIT", DEFAULT_TELEMETRY_RATE_LIMIT),
        _positive_int_env("TELEMETRY_RATE_WINDOW_SECONDS", DEFAULT_TELEMETRY_RATE_WINDOW_SECONDS),
        _positive_int_env("TELEMETRY_MAX_BODY_BYTES", DEFAULT_TELEMETRY_MAX_BODY_BYTES),
    )


def client_key(request) -> str:
    """Derive a SHA-256 hashed limiter key for the requesting client.

    Precedence: ``x-real-ip``, first ``x-forwarded-for`` entry,
    ``request.client.host``, then ``"unknown"``. The raw value is never
    returned, stored, or logged.
    """
    identity = ""
    real_ip = (request.headers.get("x-real-ip") or "").strip()
    if real_ip:
        identity = real_ip
    else:
        forwarded = request.headers.get("x-forwarded-for") or ""
        first = forwarded.split(",")[0].strip()
        if first:
            identity = first
        else:
            client = getattr(request, "client", None)
            host = getattr(client, "host", None) if client is not None else None
            identity = (host or "").strip()
    if not identity:
        identity = "unknown"
    return hashlib.sha256(identity.encode("utf-8")).hexdigest()


telemetry_rate_limiter = FixedWindowRateLimiter()
