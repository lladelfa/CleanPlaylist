---
title: 'Story 5.4: Privacy-Safe Usage Event Telemetry Sink (POST /api/telemetry/event)'
type: 'feature'
created: '2026-11-11'
status: 'done'
baseline_commit: '61d268b2da02147ca3367f20c63dca20f2bc30ba'
route: 'dispatch'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** CleanPlaylist has no privacy-safe visibility into user funnel completion or feature drop-off, while ad-hoc telemetry calls in `finishLine.js` and `ScanTab.jsx` emit non-standard payloads to an unimplemented endpoint without validation or PII protection.

**Approach:** 
1. Backend: Implement `TelemetryService` in `backend/app/services/telemetry_service.py` with strict Pydantic v2 discriminated union models (`extra="forbid"`), PII/URL/IP leak detection, and structured JSON line stdout logging (`[cp_telemetry]`). Expose `POST /api/telemetry/event` in `backend/app/main.py` returning HTTP 204 No Content (or HTTP 422 on invalid/prohibited data).
2. Frontend: Create `frontend/src/utils/telemetry.js` providing `emitTelemetryEvent`, `getSessionAnonId`, `getViewportClass`, and `getTrackCountBucket`. Integrate schema-compliant emissions across the 5 funnel milestones: `input_loaded`, `scan_completed`, `clean_swap_applied`, `stitch_completed`, and `finish_action_clicked`.
3. Testing: Author unit tests in `backend/app/tests/test_telemetry.py` and `frontend/src/utils/__tests__/telemetry.test.js` validating valid schema acceptance, forbidden field rejection, PII/URL detection, and funnel firing.

## Boundaries & Constraints

**Always:**
- Validate telemetry events against a strict Pydantic v2 discriminated union (`discriminator="event"`) with `extra="forbid"`.
- Reject any payload with HTTP 422 if it contains unknown fields, URLs (`http://`, `https://`), email addresses, raw IP addresses, or strings resembling search queries or playlist titles.
- Share base fields on all events: `event: str`, `platform: Literal["spotify", "ytmusic"]`, `viewport_class: Literal["mobile", "desktop"]`, `vip_mode: bool`, and `session_anon_id: str` (UUID stored in `sessionStorage`).
- Emit structured stdout logs prefixed with `[cp_telemetry] ` containing `{"channel": "cp_telemetry", "schema_version": 1, ...}` and return HTTP 204 No Content on success.
- If environment variable `TELEMETRY_INGEST_URL` is set, forward the sanitized payload asynchronously with a short timeout without blocking response delivery.
- Frontend telemetry client must be fire-and-forget: catch all network or serialization errors silently without disrupting UI actions.
- Use `navigator.sendBeacon` with fallback to `fetch(..., { keepalive: true })` for reliable delivery during page unload/transitions.
- Dispatch optional `window.__CP_ANALYTICS_HOOK__?.(payload)` if defined.

**Never:**
- Never collect or log user IP addresses, authorization tokens, session cookies, raw song search queries, custom blocklist words, playlist URLs, or user names.
- Never block user interactions or surface UI errors if telemetry delivery fails.
- Never write telemetry records to local SQLite or cloud databases; zero paid infra ($0 marginal run cost).
- Never commit directly to `master`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Input Loaded Event | `input_type: "song_search"`, `track_count_bucket: "1-10"`, base fields | Validates and logs `[cp_telemetry] {...}`, returns HTTP 204. | N/A |
| Scan Completed Event | `preset_id: "kid_safe"`, `track_count: 25`, `flagged_count: 3`, `lyrics_unavailable_count: 2`, base fields | Validates and logs `[cp_telemetry] {...}`, returns HTTP 204. | N/A |
| Clean Swap Applied Event | `mode: "bulk"`, `swapped_count: 4`, `unfound_count: 1`, base fields | Validates and logs `[cp_telemetry] {...}`, returns HTTP 204. | N/A |
| Stitch Completed Event | `source_count: 3`, `clean_rule: "replace_clean_or_drop"`, `output_count: 42`, base fields | Validates and logs `[cp_telemetry] {...}`, returns HTTP 204. | N/A |
| Finish Action Clicked Event | `action: "vip_spotify_save"`, base fields | Validates and logs `[cp_telemetry] {...}`, returns HTTP 204. | N/A |
| Extra / Forbidden Field | Payload includes `extra_field: "foo"` or query text | Backend rejects with HTTP 422 Unprocessable Entity. | Returns 422 with detail. |
| PII / URL Injection Attempt | `session_anon_id: "https://open.spotify.com/playlist/xyz"` | Backend regex guard detects URL/PII, rejects with HTTP 422. | Returns 422 with detail. |
| Unknown Event Type | `event: "custom_unsupported_event"` | Discriminated union validation failure. | Returns 422 with detail. |
| Beacon Unavailability | Browser without `navigator.sendBeacon` | Emits via `fetch` with `keepalive: true`. | Catches network errors silently. |

</frozen-after-approval>

## Code Map

- `backend/app/services/telemetry_service.py` -- Define Pydantic v2 discriminated union event models (`InputLoadedEvent`, `ScanCompletedEvent`, `CleanSwapAppliedEvent`, `StitchCompletedEvent`, `FinishActionClickedEvent`), PII/URL detection validator, and `TelemetryService.record_event(...)`.
- `backend/app/main.py` -- Mount `POST /api/telemetry/event` route returning 204 No Content, calling `telemetry_service.record_event`.
- `backend/app/tests/test_telemetry.py` -- Unit tests verifying validation, rejection of forbidden fields, PII/URL blocking, stdout logging, and optional HTTP forwarding.
- `frontend/src/utils/telemetry.js` -- Client helper providing `getSessionAnonId`, `getViewportClass`, `getTrackCountBucket`, and `emitTelemetryEvent`.
- `frontend/src/utils/__tests__/telemetry.test.js` -- Unit tests for client helper functions, payload formatting, sendBeacon fallback, and error silencing.
- `frontend/src/utils/finishLine.js` -- Update finish line action telemetry to use `emitTelemetryEvent` with exact AD-9 schema.
- `frontend/src/components/ScanTab.jsx` -- Emit `input_loaded`, `scan_completed`, and `clean_swap_applied` events.
- `frontend/src/components/StitchTab.jsx` -- Emit `stitch_completed` event upon stitch success and `finish_action_clicked: file_export` on export.
- `frontend/src/components/SavePlaylistModal.jsx` -- Emit `finish_action_clicked: vip_spotify_save` upon successful playlist save.

## Tasks & Acceptance

**Execution:**
- [x] `backend/app/services/telemetry_service.py` -- Create `TelemetryService` with Pydantic v2 models and PII guards -- Enforce AD-9 schema and zero-PII invariant.
- [x] `backend/app/main.py` -- Mount `POST /api/telemetry/event` endpoint -- Provide HTTP 204 telemetry sink for frontend funnels.
- [x] `backend/app/tests/test_telemetry.py` -- Author backend unit tests -- Verify strict validation, 422 rejections, and stdout log output.
- [x] `frontend/src/utils/telemetry.js` -- Author frontend telemetry utility module -- Centralize session ID, viewport detection, bucket calculation, and reliable emission.
- [x] `frontend/src/utils/__tests__/telemetry.test.js` -- Author frontend unit tests for telemetry module -- Verify sendBeacon, fetch fallback, and hook integration.
- [x] `frontend/src/utils/finishLine.js` -- Refactor existing ad-hoc telemetry calls -- Align `play_clean_queue`, `copy_clean_links`, and `file_export` to AD-9 schema.
- [x] `frontend/src/components/ScanTab.jsx` -- Wire `input_loaded`, `scan_completed`, and `clean_swap_applied` -- Capture Scan & Clean funnel milestones.
- [x] `frontend/src/components/StitchTab.jsx` -- Wire `stitch_completed` and `file_export` -- Capture Stitch Studio funnel milestones.
- [x] `frontend/src/components/SavePlaylistModal.jsx` -- Wire `finish_action_clicked: vip_spotify_save` -- Capture VIP Spotify save funnel milestone.

**Acceptance Criteria:**
- Given `POST /api/telemetry/event` called with any of the 5 valid funnel payloads, when validated by `TelemetryService`, then it returns HTTP 204 No Content and prints a JSON log line to stdout prefixed with `[cp_telemetry]`.
- Given a payload containing unknown keys or forbidden content (URLs, email addresses, IP addresses), when sent to `/api/telemetry/event`, then the endpoint rejects the request with HTTP 422.
- Given a client user session, `getSessionAnonId()` creates and persists a single random UUID in `sessionStorage["cp_session_anon_id"]` across tab navigations without using cookies.
- Given a user completing track input, scanning, clean swapping, playlist stitching, or finish-line actions, the frontend emits exactly one corresponding structured event with the correct platform, viewport class, and VIP mode.

## Implementation Notes

## Spec Change Log

## Review Triage Log

- `FinishLineBar omits vipMode propagation`: `patch` -- FinishLineBar.jsx lacked vipMode prop, causing finish line telemetry to emit vip_mode: false. Patched by accepting vipMode and passing to all action handlers.
- `Unverified vip_spotify_save finish-line telemetry in SavePlaylistModal`: `patch` -- Missing component test assertion for vip_spotify_save telemetry emission. Patched with assertion in SavePlaylistModal.test.jsx.
- `Unverified StitchTab milestone telemetry (stitch_completed and file_export)`: `patch` -- Missing component test assertions for stitch_completed and file_export in StitchTab.test.jsx. Patched with assertions in StitchTab.test.jsx.
- `Unverified ScanTab funnel telemetry (clean_swap_applied)`: `patch` -- Missing test assertion for clean_swap_applied in ScanTabBulkClean.test.jsx. Patched with assertion verifying swapped and unfound counts.
- `Redundant sendScanCompletedTelemetry in lyricEvaluator.js`: `patch` -- reevaluateTracks was calling sendScanCompletedTelemetry on each in-memory reevaluation pass. Patched by removing call from reevaluateTracks so scan_completed emits once on scan completion in ScanTab.jsx.
- `Missing working_list_import telemetry emission in StitchTab.jsx`: `patch` -- handleAddWorkingList lacked input_loaded telemetry. Patched by emitting input_loaded with input_type: 'working_list_import'.
- `Incomplete IPv6 and URL PII regex detection`: `patch` -- IPV6_REGEX and URL_REGEX in telemetry_service.py did not catch compressed IPv6 (::1) or protocol-relative/URI formats. Patched with enhanced patterns.
- `check_pii_across_fields inspects self.__dict__ instead of model fields`: `patch` -- Iterated self.__dict__ rather than model_dump(). Patched to inspect model_dump() and validate dict inputs with TypeAdapter.
- `buildSchemaPayload fails to handle NaN values for integer counts`: `patch` -- Math.max(0, NaN) yields NaN which serializes to null. Patched using safeNonNegativeInt in telemetry.js.
- `Missing in-memory fallback cache for session_anon_id when sessionStorage is restricted`: `patch` -- Each call generated a fresh UUID when sessionStorage threw. Patched with module-level inMemoryAnonId cache.
- `Rate limiting and body size limits on public endpoint`: `defer` -- Architectural rate-limiting concern outside zero-infrastructure scope; recorded in deferred-work.md.
- `input_type: vip_spotify_playlist for non-VIP playlist loads`: `false` -- Non-VIP users cannot access or load private Spotify library playlists under VIP mode gate.

## Design Notes

### Schema Definitions (AD-9)

Base fields present on all events:
- `event`: string discriminator
- `platform`: `"spotify" | "ytmusic"`
- `viewport_class`: `"mobile" | "desktop"`
- `vip_mode`: `bool`
- `session_anon_id`: `str` (UUID format)

Event payloads:
1. `input_loaded`: `input_type` in `["song_search", "album_search", "pasted_list", "ytm_playlist", "vip_spotify_playlist", "working_list_import"]`, `track_count_bucket` in `["1-10", "11-25", "26-50", "51+"]`
2. `scan_completed`: `preset_id` in `["kid_safe", "moderate", "slurs_only", "custom"]`, `track_count` int, `flagged_count` int, `lyrics_unavailable_count` int
3. `clean_swap_applied`: `mode` in `["single", "bulk"]`, `swapped_count` int, `unfound_count` int
4. `stitch_completed`: `source_count` int, `clean_rule` in `["replace_clean_or_drop", "replace_clean_or_keep", "exclude_flagged", "keep_all"]`, `output_count` int
5. `finish_action_clicked`: `action` in `["play_clean_queue", "copy_clean_links", "open_track_link", "file_export", "vip_spotify_save"]`

Stdout format:
`[cp_telemetry] {"channel": "cp_telemetry", "schema_version": 1, "timestamp": "...", "data": {...}}`

## Verification

**Commands:**
- `$env:PYTHONPATH="backend"; .\.venv\Scripts\pytest.exe backend/app/tests/test_telemetry.py` -- expected: 100% pass
- `npm --prefix frontend test` -- expected: 100% pass
- `npm --prefix frontend run lint` -- expected: 0 errors
- `npm --prefix frontend run build` -- expected: successful build
