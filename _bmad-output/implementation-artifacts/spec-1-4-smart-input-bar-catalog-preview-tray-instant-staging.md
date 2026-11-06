---
title: 'Story 1.4: Smart Input Bar, Catalog Preview Tray, & Instant Staging'
type: 'feature'
created: '2026-11-06'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Unauthenticated users have no interactive way to search for tracks and albums directly within the Scan & Clean workbench, preview catalog matches before staging, add songs or full albums to an in-memory working list, or see warnings when hitting the 50-track staging quota or adding duplicate tracks.

**Approach:** Implement `SmartInputBar` with 300ms debounced search calling `POST /api/catalog/search` (`songs` and `albums`), sample chips for 1-click query testing, and a recessed 2-column Instant Catalog Matches preview tray with `+ Add Song` and `+ Add Album` (calling `POST /api/catalog/album`); implement `NoticeBanner` for dismissible caution/info alerts; and wire them into `ScanTab` with exact-ID deduplication ("Already in Working List" alert) and 50-track list capping with omitted-count notice.

</frozen-after-approval>

## Implementation Notes

- Created `frontend/src/components/NoticeBanner.jsx`: Compact inline alert and caution banner with Obsidian Audio Core tokens (`bg-status-caution-bg`, `border-status-caution-border`, `text-status-caution`), leading `lucide-react` icons, optional action button, optional inline chips, dismiss button with `aria-label="Dismiss notice"`, and `aria-live="assertive"`/`"polite"` accessibility announcements.
- Created `frontend/src/components/SmartInputBar.jsx`: Unified search input debouncing queries at 300ms, sample query chips (`90s Hip-Hop Sample`, `Parent Test Sample`, `Top Pop Hits`), 2-column recessed Instant Catalog Matches preview tray (`songs` with `+ Add Song` and `albums` with `+ Add Album`, showing 36x36 cover thumbnails, track durations, and album track counts), `AbortController` cancellation for in-flight requests, and `Enter`/`Escape` keyboard shortcuts.
- Updated `frontend/src/components/ScanTab.jsx`: Integrated `SmartInputBar` and `NoticeBanner` into the `Scan & Clean` workbench, wired up song staging with exact-ID deduplication ("Already in Working List" banner), 50-track working list capacity enforcement, and album track expansion calling `POST /api/catalog/album` with automatic truncation notice for omitted tracks over 50.
- Unit and integration tests added:
  - `frontend/src/components/__tests__/NoticeBanner.test.jsx` (3 tests)
  - `frontend/src/components/__tests__/SmartInputBar.test.jsx` (8 tests)
  - `frontend/src/components/__tests__/ScanTabStaging.test.jsx` (4 tests)

## Review Triage Log

- State desynchronization and duplicate updates between `scannedTracks` and `workingList` in `ScanTab.jsx`: patch (removed redundant `setWorkingList` call in `ScanTab`, allowing `handleSetScannedTracks` from `App.jsx` to synchronize state).
- Missing track removal synchronization in `ScanTab.jsx`: false (tested: `initialTrackCount = playlist?.tracks?.length` preserves original baseline so `removedCount` summary statistic computes accurately; mutating `playlist.tracks` broke the test contract).
- Missing deduplication check in `handleAddAlbum` in `ScanTab.jsx`: patch (filtered out album tracks whose IDs already exist in staged list and surfaced notice if all tracks exist).
- Missing request cancellation / race condition prevention in `SmartInputBar.jsx`: patch (added `AbortController` cancellation ref on query changes and clear actions).
- Misleading placeholder vs missing functionality in `SmartInputBar.jsx`: false (placeholder string matches exact specification in `DESIGN.md`; multi-line paste and public playlist URL fallback belong to Stories 1.5 & 1.6).
- Missing wiring for `onOpenPastePanel` in `ScanTab.jsx`: low (deferred to Story 1.5 where `PasteTrackListPanel` is implemented).
- Two competing input bars and unhandled platform branding in `ScanTab.jsx`: low (transitional state between Story 1.4 catalog search and Story 1.6 full input bar unification).
- Dual, uncoordinated status notification mechanisms in `ScanTab.jsx`: patch (unified staging and capacity warnings through `NoticeBanner`).
- Missing keyboard accessibility attributes and hotkeys in `SmartInputBar.jsx`: patch (added `Enter` to submit immediately, `Escape` to clear, and `aria-expanded`/`aria-controls` on the search input).
- Narrow viewport / mobile layout crowding in `SmartInputBar.jsx`: patch (made right padding responsive: `pr-10 sm:pr-48`).
- Stale search results not cleared on platform switch in `SmartInputBar.jsx`: patch (added `useEffect` resetting `results`, `error`, and `isSearching` on `activePlatform` change).
- Unrealistic sample chip query in `SmartInputBar.jsx`: low (updated parent test chip query to "Clean Pop Hits").
- Missing `aria-live` attribute in `NoticeBanner.jsx`: patch (added `aria-live` and `aria-atomic="true"`).
- Unused import `Filter` in `ScanTab.jsx`: patch (removed unused import).
- Missing single-track capacity capping and error scenario tests in test suites: patch (added test cases in `ScanTabStaging.test.jsx` and `SmartInputBar.test.jsx`).
