---
title: 'Story 4.2: Automated Stitch Pre-Screening Pipeline & Batch Clean Rule Enforcement'
type: 'feature'
created: '2026-11-10'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context:
  - _bmad-output/implementation-artifacts/epic-4-context.md
  - _bmad-output/planning-artifacts/epics.md
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** When merging multiple playlists in Stitch Studio, staged sources may contain unresolved pasted track lines, un-screened lyrics, or explicit tracks requiring clean replacements before invoking the backend stitch engine, resulting in inconsistent clean policy enforcement or unhandled rate limits.

**Approach:** Implement an automated client-side pre-screening pipeline (`runStitchPreScreeningPipeline` in `frontend/src/utils/screeningPipeline.js` integrated into `frontend/src/components/StitchTab.jsx`) that executes upon clicking `Stitch & Clean`: (1) resolves pasted lines via `POST /api/catalog/resolve`, surfacing unresolved lines without blocking valid tracks, (2) runs chunked lyric and profanity scanning across all uncached source tracks via `POST /api/scan/playlist`, (3) queries `POST /api/replacements/find-batch` across flagged tracks when `clean_mode` is `replace_clean_or_drop` or `replace_clean_or_keep`, (4) maps valid clean replacements into `manual_replacements` keyed by original `track.id` for `POST /api/stitch`, and (5) cleanly pauses and retains evaluated tracks while presenting a retry banner if an HTTP 429 rate limit or network error occurs.

</frozen-after-approval>

## Implementation Notes

- **Stitch Pre-Screening Pipeline (`frontend/src/utils/screeningPipeline.js`)**:
  - Implemented `runStitchPreScreeningPipeline({ playlistPool, cleanMode, platform, preset, customBlocklist, cachedLyrics, signal, onProgress, onError })`.
  - Phase 1 (Resolve): Checks for unresolved pasted sources (`!source.resolved && (source.type === 'paste' || source.rawLines)`), sends up to 50 lines to `POST /api/catalog/resolve`, annotates resolved tracks onto the source, and surfaces unresolved lines (plus lines beyond quota) without blocking valid tracks.
  - Phase 2 (Lyric Scan): Gathers uncached tracks across all sources, deduplicates by track ID, filters out temporary paste placeholder IDs, and scans via chunked `POST /api/scan/playlist` calls (initial <=10, subsequent <=15). Applies screened metadata back to sources immediately on batch completion and early exit.
  - Phase 3 (Batch Clean Replacements): When `cleanMode` requires replacements (`replace_clean_or_drop` or `replace_clean_or_keep`), filters flagged tracks (`is_flagged === true`) and runs `runBulkCleanPipeline` to query `POST /api/replacements/find-batch` in chunks <= 10. Maps valid non-null clean replacement candidates into `manualReplacements` keyed by original `track.id`. Skips replacement lookup when `cleanMode` is `exclude_flagged` or `keep_all`.
  - Fail-Soft Rate Limit Handling: On HTTP 429 rate limit during resolve, lyric scan, or batch clean search, retains all evaluated tracks and mapped replacements, sets `status: 'rate_limited'`, and surfaces the error for graceful pause and retry.
- **Stitch Studio Integration (`frontend/src/components/StitchTab.jsx` & `frontend/src/App.jsx`)**:
  - Integrated `runStitchPreScreeningPipeline` into `handleStitch`, forwarding `preset` and `customBlocklist` from `App.jsx`.
  - Added live progress announcements with `aria-live="polite"` (`screeningProgressText`) updating the Stitch button label and screen readers.
  - Displayed inline `NoticeBanner` for unresolved pasted track lines and rate limit errors with an accessible `Retry Pre-Screening` button (`handleRetryPreScreening`).
  - Added `abortControllerRef` to support request cancellation on component unmount.
  - Updated output preview badge check to support `track.verification_status === 'clean_swapped' || track.replaced_original`.
- **Unit Testing Suite (`frontend/src/utils/__tests__/screeningPipeline.test.js` & `frontend/src/components/__tests__/StitchTab.test.jsx`)**:
  - Added 4 unit tests in `screeningPipeline.test.js` covering end-to-end stitch pre-screening, skipping replacement lookups for non-clean modes, rate limit pause handling, and partial chunk retention across multi-chunk scans.
  - Added 2 unit tests in `StitchTab.test.jsx` covering pre-screening execution with paste resolve and manual replacements handoff to `POST /api/stitch`, and rate limit pause with accessible retry button resuming stitch.

## Review Triage Log

- Unscreened track retention on early rate-limit return: `high` (patched — created `applyScreenedToSources` invoked on early rate-limit return to map screened results into `sources`).
- Discarded bulk clean replacements on 429 rate limit: `medium` (patched — mapped `bulkOutcome.results` and merged `lyricsById` prior to returning rate-limit status).
- Swallowed non-429 bulk replacement errors: `medium` (patched — propagated `bulkOutcome.error` with `status: 'error'`).
- Redundant catalog resolution on retry: `medium` (patched — added `!source.resolved` check).
- Unnotified truncation of pasted lines past 50: `low` (patched — pushed lines beyond 50 into `unresolvedLines` with reason `limit_exceeded`).
- Scanning placeholder IDs on resolve failure: `low` (patched — filtered out `track.id.startsWith('paste-')` from `tracksToScan`).
- Duplicate tracks in lyric scan: `medium` (patched — deduplicated `tracksToScan` via `seenTrackIds` set).
- Missing "Clean Swapped" badge for replaced tracks: `low` (patched — added `track.replaced_original` to badge check in `StitchTab.jsx`).
- Missing preset and custom blocklist forwarding: `low` (patched — forwarded `preset` and `customBlocklist` from `App.jsx` to `StitchTab`).
- Deep lyric scan on keep_all mode: `low` (rejected — as-designed per AC 2 to provide verification metadata for preview).
- Incomplete fallback track envelope on scan error: `low` (patched — populated `detected_terms: []`, `snippets: []`, `total_flagged_count: 0`, `has_lyrics: false`).
- Missing abort signal and cleanup in StitchTab: `low` (patched — added `abortControllerRef` and unmount cleanup in `StitchTab.jsx`).
- Untested partial chunk retention on 429: `low` (patched — added unit test verifying chunk 1 retention when chunk 2 hits 429).
- Unfinalized spec frontmatter and implementation notes: `high` (patched — updated spec with notes, triage log, and `status: done`).


