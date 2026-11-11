---
title: 'Story 5.2: VIP Spotify Library Browsing (PlaylistPickerModal) with Pagination'
type: 'feature'
created: '2026-11-10'
status: 'done'
baseline_commit: 'b5998092af338983e37afcc00d25e3618e003c29'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '_bmad-output/implementation-artifacts/epic-5-context.md'
  - 'AGENTS.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Allowlisted VIP testers on Spotify must be able to browse and select playlists from their personal Spotify library directly within both Scan & Clean and Stitch Studio without manual URL copy/pasting, while maintaining Obsidian Audio Core token hygiene and accessible dialog behaviors. Currently, Stitch Studio lacks a library browser trigger, and the existing `PlaylistPickerModal` uses legacy green Spotify chrome and lacks standard modal accessibility (Escape key, backdrop click, dialog ARIA attributes).

**Approach:** Upgrade `PlaylistPickerModal` with Obsidian Audio Core tokens (`bg-surface-card`, electric violet `brand-primary`, no emerald chrome) and accessible dialog semantics (`role="dialog"`, `aria-modal="true"`, Escape key, backdrop dismissal). Connect `PlaylistPickerModal` to `StitchTab` via a "Browse Library" action when `activePlatform === 'spotify' && vipMode`, loading chosen playlists into the stitch pool with an announcement notice.

## Boundaries & Constraints

**Always:**
- Guard the "Browse Library" trigger in both `ScanTab` (`SmartInputBar`) and `StitchTab` behind `activePlatform === 'spotify' && vipMode`.
- Adhere strictly to Obsidian Audio Core design tokens: use electric violet `brand-primary` (`#7C3AED`) and surface tokens (`bg-surface-card`, `bg-surface-backdrop/80`, `border-border-subtle`, `text-text-primary`, `text-text-secondary`, `text-text-muted`). Never use green/emerald for Spotify branding or chrome (safety emerald is reserved solely for verified clean/swapped statuses).
- Implement standard modal accessibility for `PlaylistPickerModal`: `role="dialog"`, `aria-modal="true"`, `aria-labelledby="playlist-picker-modal-title"`, Escape key listener, backdrop click listener, and visible focus rings.
- Support 20-item page pagination with `Showing X–Y of Z` indicator, disabling `Prev` when `offset === 0` and `Next` when `!has_next` or loading.
- Provide real-time client-side name filtering across the currently loaded page of playlists via search input.
- Close the modal upon playlist selection, stage the playlist into the active workbench (`ScanTab` or `StitchTab`), and announce success via notice/toast.
- Maintain mock isolation in all tests: mock `/api/spotify/playlists` and `/api/playlist/fetch` without network access.

**Never:**
- Never commit directly to `master`; develop on `feature/5-2-vip-playlist-picker`.
- Never show the "Browse Library" trigger to public visitors when `vipMode` is false or when `activePlatform !== 'spotify'`.
- Never allow unauthenticated or unhandled 401/403 responses to crash the modal; display user-friendly error banners with retry or dismiss options.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Open Modal in ScanTab | Click "Browse Library" in `SmartInputBar` with Spotify VIP active | `PlaylistPickerModal` opens with backdrop blur; fetches `/api/spotify/playlists?limit=20&offset=0`; renders playlist cards with artwork, title, owner, and track count. | Shows spinner during load; shows red error box if fetch fails. |
| Open Modal in StitchTab | Click "Browse Library" in `StitchTab` quick actions with Spotify VIP active | `PlaylistPickerModal` opens with backdrop blur; lists user playlists. | Same as ScanTab. |
| Pagination Next / Prev | User clicks "Next" or "Prev" button | Fetches next/prev page of 20 with updated `offset`; updates `Showing X–Y of Z`; resets search filter. | Buttons disabled when at boundaries or loading. |
| Search filter | User types in filter input | Matches playlist names case-insensitively across currently loaded items; displays "No playlists on this page match your filter" if none match. | Blank input restores full page list. |
| Playlist selected in ScanTab | User clicks a playlist card | Modal closes; `handleFetchPlaylist` called with playlist URL; playlist stages into working list; announcement displayed. | Handled by existing ScanTab fetch pipeline. |
| Playlist selected in StitchTab | User clicks a playlist card | Modal closes; calls `/api/playlist/fetch` to load playlist tracks into stitch pool; announces loaded playlist via `onNotice`. | Displays error notice if fetch fails without clearing existing pool. |
| Modal Dismissal | User presses Escape key, clicks "Close" (X), or clicks outside modal on backdrop | Modal closes without selection; offset and search filter reset cleanly. | No-op if already closed. |
| Empty Library | User has 0 Spotify playlists | Displays "No Spotify playlists found in your library." with disabled pagination. | Graceful empty state. |

</frozen-after-approval>

## Code Map

- `frontend/src/components/PlaylistPickerModal.jsx` -- Paging, filtering, and selection already work. Replace legacy/green styling; add dialog semantics, Escape/backdrop dismissal, focus states, retry UI, and reset paging/filter state on dismissal.
- `frontend/src/components/SmartInputBar.jsx` and `ScanTab.jsx` -- Spotify+VIP guard, picker state, selection-to-`handleFetchPlaylist`, track staging, and success/error status already exist; preserve this path.
- `frontend/src/components/StitchTab.jsx`, `NoticeBanner.jsx`, and `App.jsx` -- App passes `vipMode` but no `onNotice`; render success/error notices in StitchTab and forward through `onNotice` when supplied. Reuse `/api/playlist/fetch` and append `{ id, title, tracks, type, thumbnail }` only after success.
- `backend/app/spotify_endpoints.py` and `backend/app/services/spotify_service.py` -- Existing playlist-list API returns the page envelope (`items`, `total`, `limit`, `offset`, `has_next`, `has_prev`); no backend changes.
- `frontend/src/components/__tests__/PlaylistPickerModal.test.jsx`, `StitchTab.test.jsx`, and `ScanTab.test.jsx` -- Extend existing tests with mocked fetch only; no live API or auth.

## Tasks & Acceptance

**Execution:**
- [x] `frontend/src/components/PlaylistPickerModal.jsx` -- Add Obsidian tokens, accessible dialog/dismissal, visible focus, retryable errors, and dismissal reset while preserving paging/filtering.
- [x] `frontend/src/components/StitchTab.jsx` -- Add Spotify+VIP picker; fetch and append selected playlists on success; show outcome notices and forward through optional `onNotice` without clearing sources on failure.
- [x] `frontend/src/components/__tests__/PlaylistPickerModal.test.jsx` and `StitchTab.test.jsx` -- Mock fetch; cover guards, selection, notices, errors/retry, dismissal, empty state, paging/filter, and styling.
- [x] `frontend/src/components/__tests__/ScanTab.test.jsx` -- Assert the existing picker selection stages tracks and displays success feedback.

**Acceptance Criteria:**
- Given Spotify VIP Mode is active, when `Browse Library` is clicked in either workbench, then the picker fetches page one and displays playlist artwork, title, owner, and track count.
- Given playlists are loaded, when the user pages or filters, then pagination reports the displayed range and name filtering applies to the current page.
- Given a playlist is selected, when its fetch succeeds, then the modal closes, tracks enter the active workbench, and success is announced; on Stitch fetch failure, existing sources remain and an error is announced.
- Given the picker is open, when Escape or the backdrop is clicked, then it closes and resets its page and filter.

## Implementation Notes

## Spec Change Log

## Review Triage Log

- `medium` — `frontend/src/components/StitchTab.jsx:124` — The playlist-fetch API reports `truncated` and `source_track_count`, but Stitch Studio ignored them after requesting at most 100 tracks; playlists over that limit could be staged incompletely without warning. **Route: patch** — announce the loaded/total counts when truncation is reported.
- `low` — `frontend/src/components/__tests__/StitchTab.test.jsx:35` — The existing exact `1 tracks` assertion does prove a source card was staged, contrary to the review claim; however, the integration test does not assert that the picker dialog closes after selection. **Route: patch** — assert the dialog is absent after selecting.

## Design Notes

- Follow `SavePlaylistModal.jsx` surfaces/backdrop; use `brand-primary` violet, never green Spotify chrome. Retain the existing cover-art size and inset `Music` fallback.
- Use a `role="alert"` error panel with Retry and an always-available close action. Stitch notices must render in the tab because `App.jsx` does not supply `onNotice`; forward through the optional callback when present.

## Verification

**Commands:**
- `npm --prefix frontend test -- PlaylistPickerModal StitchTab ScanTab` -- expected: Targeted picker and integration tests pass.
- `npm --prefix frontend run lint` -- expected: Oxlint passes with 0 errors.
- `npm --prefix frontend run build` -- expected: Frontend Vite build succeeds.
