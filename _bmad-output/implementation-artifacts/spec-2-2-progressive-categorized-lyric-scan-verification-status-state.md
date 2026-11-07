---
title: 'Story 2.2: Progressive Categorized Lyric Scan & Verification Status State Machine'
type: 'feature'
created: '2026-11-06'
status: 'done'
baseline_commit: '3c2ed6c51273f5ec59b0ffb83d5807ddf3e39be8'
route: 'dispatch'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Staged tracks currently undergo a monolithic, un-chunked scan call with incomplete cross-platform lyric cross-referencing, truncated snippets, and ambiguous clean verdicts that risk misclassifying tracks with missing or failed lyrics as verified clean.

**Approach:** Implement `screeningPipeline.js` to progressively chunk lyric scan requests (initial chunk $\le 10$, subsequent $\le 15$) with live `aria-live="polite"` progress announcements, integrate `lyric_xref_service.py` into `POST /api/scan/playlist` with top-level `lyrics_by_id` dictionary return, preserve full un-truncated snippets, and enforce a strict zero false-clean verification status state machine across backend and `VerificationStatusBadge`.

## Boundaries & Constraints

**Always:**
- Chunk client-side requests in `screeningPipeline.js` to `POST /api/scan/playlist` into an initial batch of $\le 10$ tracks and subsequent batches of $\le 15$ tracks, updating staged tracks progressively as batches resolve.
- Announce scanning progress through an accessible `aria-live="polite"` live region (e.g. `"Scanned X of Y tracks"`).
- Return `ScannedTrackItem` envelopes from `POST /api/scan/playlist` containing `is_flagged: bool`, `reasons: List[str]`, `snippets: List[Dict]`, `detected_terms: List[Dict]`, `total_flagged_count: int`, and `has_lyrics: bool`.
- Preserve full un-truncated lyric snippets per track (removing the 20-snippet truncation limit).
- Return top-level `lyrics_by_id: Dict[str, str]` from `POST /api/scan/playlist` and merge it into `App.jsx`'s `lyricsByTrackId` state.
- Resolve lyrics on the backend via `lyric_xref_service.resolve_lyrics_and_yt_id(track, platform)` as the sole server lyric resolution entry point.
- Enforce the Zero False-Clean Invariant (`NFR-3`):
  - Initial staged state is `"unscanned"`.
  - Status becomes `"verified_clean"` if and only if `has_lyrics == True` AND `total_flagged_count == 0` AND (`not include_metadata_explicit or not is_explicit`).
  - When `has_lyrics == False`: NEVER mark `"verified_clean"`. If `is_explicit == True` and active preset checks metadata, status is `"flagged"` with reasons citing `"Marked Explicit by <Platform>"` and `"Lyrics Unavailable"`; if not explicit, status is `"lyrics_unavailable"`.
  - When scan throws or encounters unhandled failure: status is `"scan_error"`.
- Update `VerificationStatusBadge` to support `"lyrics_unavailable"` (amber styling with `FileQuestion` icon) and `"scanning"` (subtle animated spinner state) alongside existing `"verified_clean"`, `"clean_swapped"`, `"flagged"`, and `"unscanned"`.
- Provide `aria-label="Scan Lyrics"` and visible interactive text on the primary scan action trigger in `ScanTab`.

**Never:**
- Never mark a track without verified clean lyrics as `"verified_clean"`.
- Never make live outbound network calls or touch real OAuth tokens in unit tests.
- Never truncate flagged lyric snippets in `scanner_service.py` or strip scan fields via Pydantic.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Clean track with lyrics | Track with retrieved clean lyrics, 0 flagged terms, `is_explicit == False` | `verification_status: "verified_clean"`, `is_flagged: False`, badge renders emerald `Verified Clean` with `CheckCircle2` | N/A |
| Flagged track with lyrics | Track with lyrics containing profanities matching active preset | `verification_status: "flagged"`, `is_flagged: True`, reasons list detected categories, full snippets returned, badge renders rose `Flagged` | N/A |
| Missing lyrics & explicit metadata | `has_lyrics == False`, `is_explicit == True`, preset includes metadata | `verification_status: "flagged"`, `is_flagged: True`, `reasons` includes `"Marked Explicit by <Platform>"` and `"Lyrics Unavailable"` | Handled without raising exception |
| Missing lyrics & clean metadata | `has_lyrics == False`, `is_explicit == False` | `verification_status: "lyrics_unavailable"`, `is_flagged: False`, badge renders amber `Lyrics Unavailable` with `FileQuestion` | Handled without raising exception |
| Progressive scan chunking | Staged list of 25 tracks scanned | Dispatches initial chunk of 10 tracks, updates UI immediately, then dispatches chunk of 15 tracks, updates UI, announces `"Scanned 25 of 25 tracks"` | Displays error notice if chunk fails |
| Top-level lyrics dictionary | Successful scan of tracks with lyrics | Top-level `lyrics_by_id` returned with `{track_id: lyrics_text}` mapped, merged into `App.jsx` `lyricsByTrackId` | Missing lyric tracks omitted from dict |

</frozen-after-approval>

## Code Map

- `backend/app/main.py` -- Define `ScannedTrackItem(TrackScanItem)` and `PlaylistScanResponse`; update `POST /api/scan/playlist` to use `lyric_xref_service.resolve_lyrics_and_yt_id(track, req.platform)` and return top-level `lyrics_by_id` and strict `verification_status`.
- `backend/app/services/scanner_service.py` -- Remove snippet truncation (`snippets[:20]` $\rightarrow$ `snippets`), format dynamic platform name in explicit metadata reason (`"Marked Explicit by Spotify"` / `"Marked Explicit by YouTube Music"`).
- `frontend/src/utils/screeningPipeline.js` -- New client utility for progressive batch chunking (initial chunk $\le 10$, subsequent $\le 15$), merging `lyrics_by_id`, and progress callbacks with aria-live announcements.
- `frontend/src/components/VerificationStatusBadge.jsx` -- Add `lyrics_unavailable` (amber with `FileQuestion` icon) and `scanning` (with spinner) badge variants.
- `frontend/src/components/ScanTab.jsx` -- Wire `screeningPipeline.js` into scan workflow, maintain `aria-live="polite"` progress announcer, and pass `lyrics_by_id` up to `App.jsx`.
- `frontend/src/App.jsx` -- Pass `lyricsByTrackId` and `setLyricsByTrackId` to `ScanTab`.
- `backend/app/tests/test_scan_pipeline.py` -- New backend unit tests covering `ScannedTrackItem`, `POST /api/scan/playlist`, `lyric_xref_service` integration, zero false-clean state machine, and snippet preservation.
- `frontend/src/utils/__tests__/screeningPipeline.test.js` -- Unit tests for client chunking logic, progressive updates, and lyrics aggregation.
- `frontend/src/components/__tests__/VerificationStatusBadge.test.jsx` -- Tests for `lyrics_unavailable` and `scanning` badge states.

## Tasks & Acceptance

**Execution:**
- [x] `backend/app/services/scanner_service.py` -- Update `scan_lyrics` to preserve full un-truncated snippets and format platform name dynamically in metadata explicit reason.
- [x] `backend/app/main.py` -- Implement `ScannedTrackItem` and `PlaylistScanResponse`; integrate `lyric_xref_service` for concurrent lyric cross-referencing; enforce zero false-clean state machine (`verified_clean`, `flagged`, `lyrics_unavailable`, `scan_error`); return top-level `lyrics_by_id`.
- [x] `backend/app/tests/test_scan_pipeline.py` -- Unit tests covering `POST /api/scan/playlist` verdicts, lyric cross-referencing, metadata explicit fallbacks, full snippet preservation, and top-level `lyrics_by_id`.
- [x] `frontend/src/components/VerificationStatusBadge.jsx` -- Support `lyrics_unavailable` with amber styling and `FileQuestion` icon, and `scanning` badge.
- [x] `frontend/src/components/__tests__/VerificationStatusBadge.test.jsx` -- Unit tests verifying badge rendering for all status states.
- [x] `frontend/src/utils/screeningPipeline.js` -- Create progressive chunk batcher with initial chunk $\le 10$, subsequent $\le 15$, error handling, and progress notifications.
- [x] `frontend/src/utils/__tests__/screeningPipeline.test.js` -- Unit tests verifying progressive chunking, progress callbacks, and lyric dictionary aggregation.
- [x] `frontend/src/App.jsx` & `frontend/src/components/ScanTab.jsx` -- Integrate `screeningPipeline.js`, wire `lyricsByTrackId` state, add `aria-live="polite"` progress indicator, and ensure `aria-label="Scan Lyrics"`.

**Acceptance Criteria:**
- Given staged tracks in `workingList`, when the user clicks `Scan Lyrics` in `ScanTab`, then `screeningPipeline.js` chunks requests to `POST /api/scan/playlist` into an initial batch of $\le 10$ tracks followed by subsequent batches of $\le 15$ tracks, and `Scanned X of Y tracks` announces through `aria-live="polite"`.
- Given the response from `POST /api/scan/playlist`, when tracks are received, then each track is typed as `ScannedTrackItem` with `is_flagged: bool`, `reasons: List[str]`, `snippets: List[Dict]`, `detected_terms: List[Dict]`, `total_flagged_count: int`, full un-truncated snippets are preserved, and top-level `lyrics_by_id: Dict[str, str]` is returned and merged into `App.jsx`'s `lyricsByTrackId`.
- Given a track with `has_lyrics == True`, `total_flagged_count == 0`, and `is_explicit == False`, when status is evaluated, then `VerificationStatusBadge` renders emerald `Verified Clean` with `CheckCircle2` icon.
- Given a track where lyrics could not be retrieved (`has_lyrics == False`), when status is evaluated, then it is NEVER marked `Verified Clean`; if `is_explicit == True` and active preset checks metadata, status is `Flagged` with `reasons` citing `"Marked Explicit by <Platform>"` and `"Lyrics Unavailable"`; if not explicit, status is amber `Lyrics Unavailable` with `FileQuestion` icon.

## Implementation Notes

- Implemented `ScannedTrackItem` and `PlaylistScanResponse` in `backend/app/main.py` with full type envelopes and `lyrics_by_id: Dict[str, str]`.
- Integrated `lyric_xref_service.resolve_lyrics_and_yt_id` as the sole concurrent lyric resolution entry point for playlist scanning.
- Enforced strict Zero False-Clean state machine: clean tracks requires `has_lyrics == True` and zero flags; tracks with missing lyrics transition to `lyrics_unavailable` (or `flagged` if explicit metadata is detected); unexpected failures map to `scan_error`.
- Removed snippet truncation in `backend/app/services/scanner_service.py` (`snippets[:20]` -> `snippets`), and formatted dynamic platform metadata reasons.
- Added 10 comprehensive unit tests in `backend/app/tests/test_scan_pipeline.py` (all 102 backend tests pass).
- Updated `VerificationStatusBadge.jsx` to render amber `Lyrics Unavailable` (with `FileQuestion`) and purple animated spinner `Scanning` badges.
- Created `frontend/src/utils/screeningPipeline.js` with batch chunking (initial chunk <= 10, subsequent <= 15), live progress announcements (`Scanned X of Y tracks`), lyrics dictionary aggregation, and error handling.
- Integrated progressive scanning and accessible `aria-live="polite"` announcer into `ScanTab.jsx`, ensuring `aria-label="Scan Lyrics"`. Wired `lyricsByTrackId` in `App.jsx`.
- Verified with 99 passing frontend tests in vitest, oxlint (0 errors), and successful production build.

## Spec Change Log

## Review Triage Log

| Finding | Verdict | Route | Evidence |
|---------|---------|-------|----------|
| VG-1: Unverified scan_error badge rendering | low | patch | Added unit tests in VerificationStatusBadge.test.jsx verifying scan_error renders AlertCircle and "Scan Error" in rose styling. |
| VG-2: Unverified track update and aria-live announcement on completion | low | patch | Added assertions in ScanTab.test.jsx verifying setScannedTracks updates and role="status" live region receives completion announcement. |
| EC-1: Potential duplicate fallback tracks if consumer callbacks throw | low | patch | Isolated user callbacks in try/catch in screeningPipeline.js to ensure callback failures do not push duplicate fallback tracks. |
| EC-2: Missing required scan envelope fields in fallback tracks | medium | patch | Populated detected_terms: [], snippets: [], total_flagged_count: 0, and has_lyrics: false on fallback items. |
| EC-3: Missing re-entrancy guard in ScanTab.jsx | low | patch | Added if (scanning) return; at top of handleRunScan. |
| EC-4: Non-positive subsequent chunk size hangs in chunkTracks | low | patch | Added guard if (subsequentSize <= 0) return [tracks];. |
| EC-5: False-positive success banner when all tracks fail | medium | patch | Added conditional check in ScanTab.jsx to render error status message and live announcement when all tracks fail with scan_error. |
| BH-1: Redundant setWorkingList secondary calls in ScanTab.jsx | medium | patch | Relied on setScannedTracks which synchronizes workingList in App.jsx, removing redundant secondary setWorkingList calls. |
| BH-2: Incomplete track metadata merge in ScanTab.jsx | medium | patch | Replaced full object replacement with shallow merge to preserve was_replaced and original track metadata. |
| BH-3: Zero False-Clean bypass via track.is_clean | medium | patch | Removed track.is_clean fallback from VerificationStatusBadge.jsx so tracks require explicit verification_status: 'verified_clean'. |
| BH-4: Missing test coverage for onBatchStart and network errors | low | patch | Added tests in screeningPipeline.test.js for onBatchStart chunk invocation and TypeError network errors. |
| BH-5: Diagnostic reason for clean tracks with unavailable lyrics | false | reject | Refutation: Acceptance criteria specifies non-explicit missing-lyrics tracks receive lyrics_unavailable status without requiring an explanatory reason string. |
| BH-6: Ignored max_deep_scan in main.py | low | reject | Client controls batch chunking directly via screeningPipeline.js with initial <= 10 and subsequent <= 15 tracks. |
| BH-7: AbortSignal cancellation support | low | reject | Out of scope for Story 2.2 core state machine; deferred for future streaming/cancellation enhancement. |

## Design Notes

- State machine transitions:
  - `unscanned`: Default initial staging status.
  - `scanning`: Interim state while batch chunk is inflight.
  - `verified_clean`: Guaranteed safe; requires both `has_lyrics == True` AND `total_flagged_count == 0` AND non-explicit.
  - `flagged`: Either profanity detected in lyrics OR (`is_explicit == True` and metadata checking enabled).
  - `lyrics_unavailable`: Honest indicator when lyrics could not be retrieved and metadata is not explicit.
  - `clean_swapped`: Reserved for clean replacement applied in Story 3.2.
  - `scan_error`: Fallback when upstream resolution fails unexpectedly.
