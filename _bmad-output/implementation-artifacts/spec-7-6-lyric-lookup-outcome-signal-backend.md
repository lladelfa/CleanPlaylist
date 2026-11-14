---
title: 'Story 7.6: Lyric Lookup Outcome Signal (Backend)'
type: 'feature'
created: '2026-11-13'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A YouTube Music outage is indistinguishable from "no lyrics exist", so scans present a service failure as a property of the song.

**Approach:** Classify every lyric lookup as `found`, `not_found`, or `upstream_error`; expose it per track as `lyrics_lookup` on `/api/scan/playlist` and `/api/scan/keywords`; expose `lyrics_service_degraded` in the summary when more than half of looked-up tracks are `upstream_error`.

**Acceptance criteria:** per epics.md Story 7.6. `verification_status` logic and existing tests are unchanged; `lyrics_unavailable_count` keeps its meaning.

**Boundaries:** `get_track_lyrics` single-track endpoint, frontend, and telemetry are out of scope.

</frozen-after-approval>

## Implementation Notes

- `LyricXRefService.resolve_lyrics_lookup` returns `LyricLookupResult(yt_id, lyrics, outcome)`. `resolve_lyrics_and_yt_id` delegates and keeps its tuple contract; for model objects it also stamps `track.lyrics_lookup`, so `main.py` callers (and existing tests that patch the tuple method) are unchanged. `TrackScanItem.lyrics_lookup` is reset server-side before each scan, so client-sent values are ignored.
- `YTMusicService.get_track_lyrics` swallows its own exceptions, so xref could not see outages. It now records failed IDs (`lyrics_fetch_failed`) and no longer caches a failure as a miss (a transient outage used to poison the cache as "no lyrics").
- Without `deep_scan_lyrics` no lookup runs, so `lyrics_lookup` is `null` and the service is not degraded.
- Tests: `backend/app/tests/test_lyric_lookup_outcome.py` (38, written red first). Full suite: 266 passed.

## Review Triage Log

- Inline self-review, no findings. Nothing deferred.
