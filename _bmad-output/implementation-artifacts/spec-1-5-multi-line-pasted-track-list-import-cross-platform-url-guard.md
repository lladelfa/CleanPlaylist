---
title: 'Story 1.5: Multi-Line Pasted Track List Import & Cross-Platform URL Guard'
type: 'feature'
created: '2026-11-06'
status: 'done'
baseline_commit: '315ba4a1442d99cd1e35305dd759887456b3cbf7'
route: 'dispatch'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Users with plain-text song request lists or track URLs must currently search each song one-by-one; there is no bulk paste ingestion, no URL parsing to distinguish matching vs. cross-platform URLs, and no batch resolution into the working list with 50-track quota enforcement.

**Approach:** Implement `POST /api/catalog/resolve` to resolve matching track URLs via direct metadata lookup, text lines via top search match, and segregate mismatched URLs into `unresolved` with reason `wrong_platform`; build `PasteTrackListPanel` and `inputParser.js` to live-count non-empty lines, warn at >50 lines, and call chunked resolution (`<= 15` lines/batch); and integrate with `SmartInputBar` and `ScanTab` offering a 1-click catalog switch prompt if cross-platform URLs are detected.

## Boundaries & Constraints

**Always:**
- Keep all 12 normalized track keys on every resolved `TrackScanItem` (`id`, `title`, `artist`, `artists_list`, `album`, `duration`, `duration_seconds`, `is_explicit`, `thumbnail`, `video_url`, `verification_status: "unscanned"`, `source_platform: activePlatform`).
- Strip blank and whitespace-only lines live in `PasteTrackListPanel` before counting and processing.
- Enforce the 50-track working list cap and deduplicate against existing tracks in `workingList`.
- Chunk client-side requests to `POST /api/catalog/resolve` into batches of `<= 15` lines.
- Intercept multi-line paste (`\n`) in `SmartInputBar` to open and populate `PasteTrackListPanel`.
- Surface an amber `NoticeBanner` when cross-platform URLs are skipped, offering a 1-click platform switch; if `workingList` has items, opening the switch confirmation modal (`PlatformSwitchModal`) before switching.

**Never:**
- Never make live network requests or touch live credentials in unit tests (mock `SpotifyService.get_catalog_client` and `ytmusicapi`).
- Never reject the entire batch if individual lines fail or are cross-platform; segregate failed lines into `unresolved[]` and return all validly resolved tracks.
- Never exceed 50 resolved lines from `PasteTrackListPanel`.
- Never show raw unformatted error messages to the user.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Plain Text Line Resolution | `"The Killers - Mr. Brightside"` | Top song search match on active platform added to `resolved[]` | If no match found, append to `unresolved[]` with `reason: "not_found"` |
| Matching Platform Track URL | Spotify track URL on Spotify platform or YTM watch URL on YTM platform | Exact track metadata fetched via `sp.track()` or `ytmusic.get_song()` and appended to `resolved[]` | If track ID invalid or deleted, append to `unresolved[]` with `reason: "not_found"` |
| Cross-Platform Track URL | YTM URL on Spotify platform or Spotify URL on YTM platform | Skipped from `resolved[]`, added to `unresolved[]` with `reason: "wrong_platform"` and `target_platform` identified | Amber `NoticeBanner` rendered with 1-click switch button |
| Multi-line Paste in SmartInputBar | User pastes text containing `\n` into `SmartInputBar` input | Intercepted on `paste`, `PasteTrackListPanel` opens populated with pasted text | Clears query in `SmartInputBar` |
| Over 50 Non-Empty Lines | User pastes 55 lines into `PasteTrackListPanel` | Line counter indicates `55 / 50 lines`, amber truncation warning shown before resolution | Resolves only the first 50 lines upon user resolution |
| Whitespace & Blank Lines | Text with extra blank lines and trailing spaces | Blank lines stripped, lines trimmed live, count reflects non-empty lines only | Ignored without error |
| Partial Failure in Batch | Batch of 10 lines where 2 are invalid/not found | 8 resolved tracks returned, 2 added to `unresolved[]` | Resolves valid tracks, displays warning for unresolved lines |

</frozen-after-approval>

## Code Map

- `backend/app/main.py`: Define `CatalogResolveRequest`, `CatalogResolveResponse`, `UnresolvedLineItem` models, and `@app.post("/api/catalog/resolve")` endpoint.
- `backend/app/services/spotify_service.py`: Add `extract_track_id(url_or_id)` and `resolve_track(track_id)` using `get_catalog_client()`.
- `backend/app/services/ytmusic_service.py`: Add `extract_track_id(url_or_id)` and `resolve_track(video_id)`.
- `backend/app/tests/test_catalog_resolve.py`: Unit and endpoint tests for `/api/catalog/resolve` covering URL lookups, text search fallback, and cross-platform detection.
- `frontend/src/utils/inputParser.js`: Helper functions to parse and classify inputs (Spotify URL/URI, YouTube Music URL, multi-line text, plain search query).
- `frontend/src/components/PasteTrackListPanel.jsx`: Expandable panel with line numbers, live `N / 50 lines` counter, `<textarea>`, truncation warning, and `Resolve & Add` / `Cancel` actions.
- `frontend/src/components/SmartInputBar.jsx`: Wire `onPaste` for multi-line text detection to call `onOpenPastePanel(pastedText)` and keep `onOpenPastePanel` button functional.
- `frontend/src/components/ScanTab.jsx`: State management for `isPasteOpen`, chunked batch resolution via `POST /api/catalog/resolve`, cross-platform URL switch banner, and `PlatformSwitchModal` invocation.
- `frontend/src/utils/__tests__/inputParser.test.js`: Test URL detection and categorization.
- `frontend/src/components/__tests__/PasteTrackListPanel.test.jsx`: Unit tests for line counting, stripping, truncation warning, and resolve triggering.

## Tasks & Acceptance

**Execution:**
- [x] `backend/app/services/spotify_service.py` -- Add `extract_track_id` and `resolve_track` using catalog client -- Enables zero-login direct track resolution.
- [x] `backend/app/services/ytmusic_service.py` -- Add `extract_track_id` and `resolve_track` -- Enables YouTube Music direct video/track resolution.
- [x] `backend/app/main.py` -- Add `POST /api/catalog/resolve` endpoint -- Orchestrates single-platform batch resolution and cross-platform segregation.
- [x] `backend/app/tests/test_catalog_resolve.py` -- Add backend tests for `/api/catalog/resolve` -- Verifies track URL lookup, search fallback, and error handling.
- [x] `frontend/src/utils/inputParser.js` -- Add URL parsing and line classification logic -- Shared utility for input routing and cross-platform detection.
- [x] `frontend/src/components/PasteTrackListPanel.jsx` -- Create paste panel UI with line numbers, live counter, and truncation alert -- Implements UX-DR5 and Story 1.5 paste container.
- [x] `frontend/src/components/SmartInputBar.jsx` -- Add `onPaste` handler detecting multi-line input and delegating to `onOpenPastePanel` -- Enables seamless paste transition.
- [x] `frontend/src/components/ScanTab.jsx` -- Integrate `PasteTrackListPanel`, chunked resolution caller, cross-platform switch banner, and modal trigger -- Connects UI to backend API and Working List.
- [x] `frontend/src/components/__tests__/PasteTrackListPanel.test.jsx` & `frontend/src/utils/__tests__/inputParser.test.js` -- Add comprehensive frontend tests -- Validates behavior against acceptance criteria.

**Acceptance Criteria:**
- Given `PasteTrackListPanel` open or multi-line text pasted into `SmartInputBar`, when the textarea receives text, then blank lines and surrounding whitespace are stripped live, a live `N / 50 lines` counter updates in mono font, and inputs exceeding 50 non-empty lines display an inline amber truncation warning before resolution.
- Given a valid pasted list of up to 50 lines, when the user clicks `Resolve & Add`, then client calls `POST /api/catalog/resolve` in chunks of `<= 15` lines with `platform: activePlatform`, matching-platform track URLs resolve via exact ID lookup, plain-text lines resolve via top song search match, and cross-platform track URLs are skipped into `unresolved[]` with `reason: "wrong_platform"`.
- Given unresolved lines returned from `POST /api/catalog/resolve`, when resolution completes, then valid resolved tracks are appended to `workingList`, and if cross-platform URLs were skipped, an amber `NoticeBanner` appears offering a 1-click `"Switch to <Platform>"` button (which opens `PlatformSwitchModal` if `workingList` has items).

## Implementation Notes

- Added `extract_track_id` and `resolve_track` to `SpotifyService` and `YTMusicService`.
- Added `POST /api/catalog/resolve` to `backend/app/main.py`.
- Created `frontend/src/utils/inputParser.js` and `frontend/src/components/PasteTrackListPanel.jsx`.
- Integrated `PasteTrackListPanel` and chunked resolution into `frontend/src/components/ScanTab.jsx` and `SmartInputBar.jsx`.

## Review Triage Log

- `ScanTab.jsx:33, 990-997`: Double `PlatformSwitchModal` and dead `_setWorkingList` prop: patch (delegate platform switch to `onRequestPlatformChange` if available, rename `_setWorkingList` to `setWorkingList`, and remove redundant duplicate modal in `ScanTab`).
- `ScanTab.jsx:1049-1052`: Missing in-batch self-deduplication in `handleResolvePaste`: patch (maintain a `seen` set initialized with `existingIds` to filter duplicates within `allResolved`).
- `ScanTab.jsx:359-369`: Unresolved non-cross-platform lines (`not_found` or `error`) omitted without user notice in partial batches: patch (surface caution notice when `unresolved` contains items even if some tracks resolved).
- `ScanTab.jsx:1040-1045`: Network error in `fetch` silently caught without user feedback: patch (surface caution NoticeBanner on network error).
- `ScanTab.jsx:1048`: Working list at capacity notice missing if user resolves paste when list is already full: patch (check `remainingSlots <= 0` and surface capacity notice).
- `backend/app/main.py:177` & `spotify_service.py:255`: Localized Spotify track URLs (e.g. `/intl-en/track/...`): patch (support optional `/intl-[a-z-]+/` in regex/pattern).
- `PasteTrackListPanel.jsx`: Textarea soft-wrapping misaligns with gutter line numbers, and inputs not disabled during loading: patch (set `wrap="off"` with horizontal overflow, and disable textarea and cancel/close buttons when `isLoading` is true).
- `backend/app/main.py`: `CatalogResolveRequest` allows unbounded lines: patch (limit `lines` to max 50).
- `frontend/src/utils/inputParser.js`: Whitespace-only string returns query: patch (return type `empty` for whitespace-only strings).

## Verification

**Commands:**
- `$env:PYTHONPATH="backend"; .\.venv\Scripts\pytest.exe backend/app/tests/` -- expected: all backend tests pass without error.
- `npm --prefix frontend test` -- expected: all Vitest unit tests pass.
- `npm --prefix frontend run lint` -- expected: 0 lint errors (`oxlint`).
- `npm --prefix frontend run build` -- expected: Vite production build succeeds.
