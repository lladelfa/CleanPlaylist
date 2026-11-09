---
title: 'Story 3.3: One-Click Bulk Clean Replacement in Scan & Clean'
type: 'feature'
created: '2026-11-09'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context:
  - _bmad-output/implementation-artifacts/epic-3-context.md
  - _bmad-output/planning-artifacts/epics.md
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Users with multiple flagged tracks in the Working List must manually inspect and swap clean versions row-by-row or inside modals, lacking a one-click bulk replacement workflow in `ScreeningControlsBar` that searches clean versions in chunked batches of $\le 10$ tracks via `POST /api/replacements/find-batch`, updates swappable tracks in-memory to `verification_status: "clean_swapped"`, keeps unswappable tracks visibly `Flagged`, announces completion through a summary `NoticeBanner`, and gracefully handles HTTP 429 rate limits with retryable pause banners.

**Approach:** Implement `runBulkCleanPipeline` in `frontend/src/utils/screeningPipeline.js` to dispatch flagged tracks in chunks of $\le 10$ to `POST /api/replacements/find-batch` with progress tracking and rate-limit recovery. Wire a `"Find & Swap All Clean Versions"` button into `ScreeningControlsBar.jsx` with animated progress states (`"Finding clean edits (X of Y)…"`). In `ScanTab.jsx`, orchestrate bulk swap execution, update `workingList`, `scannedTracks`, `playlist.tracks`, and `lyricsByTrackId`, record unfound tracks in `cleanCandidates`, display completion and rate-limit notice banners with `aria-live="polite"`, and provide a retry action for rate-limited batches.

</frozen-after-approval>

## Implementation Notes

- **`runBulkCleanPipeline` Utility (`frontend/src/utils/screeningPipeline.js`)**:
  - Implemented and exported `runBulkCleanPipeline` chunking flagged tracks in batches of $\le 10$ to `POST /api/replacements/find-batch`.
  - Added support for `signal` (`AbortSignal`), user progress callback announcements (`"Finding clean edits (X of Y)…"`), and `onBatchComplete` result aggregation.
  - Added clean halting on HTTP 429 and network errors, preserving completed chunk results and tracking `unprocessedTracks` for seamless retry resumption.
  - Protected consumer callbacks with `try/catch` error boundaries to prevent pipeline crashes.
- **`ScreeningControlsBar` Component (`frontend/src/components/ScreeningControlsBar.jsx`)**:
  - Added `"Find & Swap All Clean Versions"` button in the Zone 2 Screening Console actions segment (`bg-status-clean`, `text-status-clean-ink`, `min-h-[44px]`).
  - Implemented animated spinner and dynamic progress label (`"Finding clean edits (X of Y)…"`) during execution with `aria-live="polite"` status announcements.
  - Disabled the button when `flaggedCount === 0`, `bulkCleaning === true`, `scanning === true`, or `disabled === true`.
  - Disabled preset pills and custom blocklist inputs when `bulkCleaning` is active to prevent concurrent state re-evaluations.
- **`ScanTab` Integration (`frontend/src/components/ScanTab.jsx`)**:
  - Implemented `handleBulkClean` orchestrating bulk clean execution with cumulative progress tracking across retries.
  - Looked up original tracks directly in the authoritative batch `chunk` and preserved root metadata (`original_title`, `original_id`, `original_set_video_id`).
  - Synchronized `workingList`, `scannedTracks`, `playlist.tracks`, `lyricsByTrackId`, and `cleanCandidates` (`"none"` for unswappable tracks).
  - Emitted fire-and-forget `clean_swap_applied` telemetry events (`mode: "bulk"`, `swapped_count`, `unfound_count`).
  - Surfaced retryable `NoticeBanner` (`role="alert"`) on HTTP 429 and 5xx errors with working `Retry` actions, and displayed completion summary notices (`"Swapped X of Y flagged tracks; Z still need review"`).
- **Test Baseline & Regression Fixes (`AppHeaderSwitch.test.jsx`)**:
  - Aligned `AppHeaderSwitch.test.jsx` with SmartInputBar's placeholder and Enter-key submission semantics.

## Review Triage Log

- Misleading green success NoticeBanner when zero clean versions are found: `medium` (patched — changed completion `NoticeBanner` type to `"caution"` when `totalSwapped === 0`).
- Progress count and summary announcement reset and under-report on rate-limit retry: `medium` (patched — added `cumulativeStats` tracking `swapped`, `unfound`, and `initialTotal` across retries).
- Missing retry action and un-cleared progress announcement on 5xx or network errors: `medium` (patched — surfaced retryable alert `NoticeBanner` with `Retry` action on both 429 and 5xx/network errors).
- Stale track references during batch callbacks via `currentTracksRef.current` lookup: `medium` (patched — inspected the authoritative `chunk` array directly before falling back to `currentTracksRef`).
- Screening controls, presets, and input remain unblocked during bulk clean execution: `medium` (patched — disabled preset pills, custom blocklist input, and removal chips when `bulkCleaning` is true).
- Bulk clean button remains enabled when all remaining flagged tracks are already marked with no replacement or kept: `low` (rejected — keeping button enabled if flagged tracks exist allows users to re-attempt clean searches if catalog availability changes, consistent with per-track `CleanReplacementControl` retryability).
- Missing request timeout and cancellation / abort handling in `runBulkCleanPipeline`: `low` (patched — added `signal` parameter and early abort check to `runBulkCleanPipeline`).
- Loss of true root original track metadata across multiple scan/swap cycles: `low` (patched — preserved `origTrack.original_title || origTrack.title` and `origTrack.original_id || origTrack.id`).
- Missing `clean_swap_applied` telemetry event on bulk swap completion: `low` (patched — added fire-and-forget `clean_swap_applied` POST request to `/api/telemetry/event`).
- Gaps in automated test suites for error recovery and edge cases: `low` (patched — added tests for 500 server error, zero clean matches, exact cumulative count after retry, abort signal handling, and callback error handling).
