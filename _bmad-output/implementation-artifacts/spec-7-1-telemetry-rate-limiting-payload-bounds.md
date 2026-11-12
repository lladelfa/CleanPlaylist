---
title: 'Telemetry Rate Limiting & Payload Bounds'
type: 'feature'
created: '2026-11-12'
status: 'ready-for-dev'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-7-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `POST /api/telemetry/event` is public and zero-login, with no application-level rate limit or body-size bound, so anyone can flood the `cp_telemetry` log sink or push large payloads at it (deferred-work item from Story 5.4).

**Approach:** Add an in-memory, per-instance fixed-window limiter (injectable clock) and a streaming body-size cap in front of telemetry validation and emission. Over-limit requests get `429` with `Retry-After`. Oversized bodies get `413`. Limits come from env vars with safe defaults.

## Boundaries & Constraints

**Always:** Rejected requests (429/413/422) emit no `[cp_telemetry]` line and do not call the forwarder. Defaults: 60 requests per 60-second window per client key, and a 2048-byte body maximum. Env vars: `TELEMETRY_RATE_LIMIT`, `TELEMETRY_RATE_WINDOW_SECONDS`, `TELEMETRY_MAX_BODY_BYTES`. Missing, non-integer or non-positive values fall back to the defaults. Each var gets a placeholder in `backend/.env.example`. The client key comes from `x-real-ip`, then the first `x-forwarded-for` entry, then `request.client.host`, then `"unknown"`. The key is SHA-256-hashed before storage and never logged or added to events. Limiter memory is bounded (expired windows pruned, a hard cap on tracked keys). Valid events keep returning `204`, and validation failures keep returning FastAPI-style `422`.

**Never:** No Redis, external store, or new third-party dependency (stdlib only). No change to the telemetry event schemas, the PII validators, or the frontend `telemetry.js`. No live network calls or real clock sleeps in tests.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Valid event under limit | Valid JSON ≤ max bytes, count ≤ limit | `204`, one `[cp_telemetry]` line | N/A |
| Limit exceeded | (limit+1)th request from same key in window | `429`, `Retry-After` = whole seconds until window reset (≥1) | No log line |
| Window expiry | Clock advanced past window end | Next request allowed (`204`) | N/A |
| Separate clients | Different `x-real-ip` / `x-forwarded-for` | Counted independently | N/A |
| Oversized by header | `content-length` > max | `413` without reading body | No log line |
| Oversized, no/false header | Streamed body exceeds max | `413` once cap crossed | No log line |
| Invalid / malformed JSON | Schema violation or bad JSON | `422` | No log line |
| Bad env values | `TELEMETRY_RATE_LIMIT=abc` or `0` | Defaults applied | N/A |

</frozen-after-approval>

## Code Map

- `backend/app/main.py:721-724` -- `post_telemetry_event` currently takes the parsed `TelemetryEvent` body. Change it to `async def(request: Request)`: size-check (header, then streamed read), rate-check, then `TypeAdapter(TelemetryEvent).validate_json(body)`. On `ValidationError`, raise `fastapi.exceptions.RequestValidationError(e.errors())` to keep the 422 shape. Keep `status_code=204`.
- `backend/app/services/telemetry_service.py` -- `TelemetryEvent` union and `record_event` are reused unchanged. `record_event` already accepts a validated model.
- `backend/app/services/rate_limiter.py` (new) -- `FixedWindowRateLimiter(clock=time.monotonic, max_keys=10_000)` with `check(key, limit, window_seconds) -> (allowed: bool, retry_after: int)`, `reset()`, a `threading.Lock`, and prune/evict logic. Add `get_telemetry_limits() -> (limit, window, max_bytes)` that reads env per call, plus `client_key(request) -> str` (hashed). Module singleton `telemetry_rate_limiter`.
- `backend/app/tests/test_telemetry.py` -- existing ASGI `call_api` helper. Extend it with optional `headers` and `chunks` arguments, and return response headers. Add an autouse fixture that calls `telemetry_rate_limiter.reset()`. Existing tests must still pass, and the existing 422 assertions remain valid.
- `backend/app/tests/test_rate_limiter.py` (new) -- unit tests for the limiter with a fake clock.
- `backend/.env.example` -- append the three placeholders with comments.
- Do not touch: `frontend/src/utils/telemetry.js` (fire-and-forget `sendBeacon`, errors swallowed, so it already tolerates 429/413), `requirements.txt` files (stdlib only).

## Tasks & Acceptance

**Execution:**
- [ ] `backend/app/tests/test_rate_limiter.py` -- RED: limiter allows up to the limit and blocks the next one with correct `retry_after`, resets after the window (fake clock), isolates keys, prunes/evicts at `max_keys`, and env parsing falls back on bad values. `client_key` precedence and hashing (raw IP never in the output) -- defines the contract first.
- [ ] `backend/app/tests/test_telemetry.py` -- RED: endpoint 429 plus `Retry-After` with no log line (patch the limit env to a small value), 413 via header, 413 via chunked stream without content-length, malformed JSON gives 422 with no log line, and the autouse limiter reset -- covers the I/O matrix end to end.
- [ ] `backend/app/services/rate_limiter.py` -- GREEN: implement the limiter, settings reader and key derivation.
- [ ] `backend/app/main.py` -- GREEN: rewire the endpoint as described in the Code Map.
- [ ] `backend/.env.example` -- document the three vars with placeholder defaults.

**Acceptance Criteria:**
- Given the full backend suite, when it runs, then all tests pass with no network calls, no real sleeps and no real auth state.
- Given a request rejected for any reason, when it is processed, then `telemetry_service.record_event` is never invoked.
- Given this story is done, then Dev Notes (Implementation Notes) state that the limiter is per-instance best effort on serverless, with Vercel host limits as the outer defense.

## Implementation Notes

## Spec Change Log

## Review Triage Log

## Design Notes

Ordering: size check first, then rate check, so an oversized request is rejected without parsing. Every size-valid request counts toward the window, including ones later rejected as 422, so a flood of invalid payloads is still limited. On Vercel, `x-real-ip` and `x-forwarded-for` are set by the platform edge. Locally they may be spoofable, which is acceptable for a best-effort limiter. Fixed window (not sliding) keeps the state to one `(window_start, count)` pair per key.

```python
allowed, retry_after = telemetry_rate_limiter.check(key, limit, window)
if not allowed:
    return Response(status_code=429, headers={"Retry-After": str(retry_after)})
```

## Verification

**Commands:**
- `$env:PYTHONPATH="backend"; .\.venv\Scripts\pytest.exe backend/app/tests/` -- expected: all pass, including new limiter and endpoint tests
