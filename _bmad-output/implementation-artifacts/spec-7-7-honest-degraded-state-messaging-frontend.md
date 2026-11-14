---
title: 'Story 7.7: Honest Degraded-State Messaging (Frontend)'
type: 'feature'
created: '2026-11-13'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** When the lyrics service is down, every song looks unscannable, so users give up instead of retrying.

**Approach:** Use the Story 7.6 signals (`lyrics_lookup`, `lyrics_service_degraded`) to show one warning banner with **Retry Scan** in `ScanTab` and `StitchTab`, distinguish "Couldn't check (service error)" from "No lyrics found" in `VerificationStatusBadge`, and make Retry Scan re-request only `upstream_error` tracks.

**Acceptance criteria:** per epics.md Story 7.7. Banner uses caution styling, never safety emerald. A track is never shown as Verified Clean without lyrics. `lyricEvaluator.js` keeps `lyrics_lookup` on re-evaluation.

**Boundaries:** No backend changes. No new dependencies.

</frozen-after-approval>

## Implementation Notes

- `screeningPipeline.js`: new `isLyricsServiceDegraded(tracks)` (more than half `upstream_error`, same rule as the backend). `runScreeningPipeline` and `runStitchPreScreeningPipeline` return `lyricsServiceDegraded` (any batch summary flag, or derived from the scanned tracks). The stitch pre-screen no longer treats `upstream_error` tracks as already screened, so a re-run re-requests only those.
- `ScanTab.jsx`: `runScan(onlyUpstreamErrors)`; Retry Scan filters the working list to `upstream_error` tracks and merges results by id. Retries do not emit a new `scan_completed` telemetry event. The banner also shows when the tracks alone are degraded, and clears once a retry fixes them.
- `StitchTab.jsx`: banner with Retry Scan reuses the pre-screen re-run (`handleRetryPreScreening`).
- `VerificationStatusBadge.jsx`: only the `lyrics_unavailable` state changes. `upstream_error` renders "Couldn't check (service error)" (rose) and `not_found` renders "No lyrics found" (amber), each with an `aria-label`. No lookup keeps "Lyrics Unavailable".
- Tests (written red first): `utils/__tests__/lyricsDegraded.test.js`, `components/__tests__/LyricsLookupBadge.test.jsx`, `components/__tests__/ScanTabDegradedState.test.jsx`. Full suite 393 passed; lint shows existing warnings only; build passes.
- Not covered: the StitchTab banner is verified at pipeline level only, not by a rendered StitchTab test. `KeywordsTab` does not yet use the new signals (out of scope).

## Review Triage Log

- Inline self-review, no findings. Nothing deferred.
