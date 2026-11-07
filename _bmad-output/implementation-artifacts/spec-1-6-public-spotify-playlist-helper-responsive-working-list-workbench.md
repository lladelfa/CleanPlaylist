---
title: 'Story 1.6: Public Spotify Playlist Helper & Responsive Working List Workbench'
type: 'feature'
created: '2026-11-06'
status: 'done'
baseline_commit: '75fef50e2a65d2f668d8d834a994b8aa9072ee48'
route: 'dispatch'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Unauthenticated users pasting Spotify playlist URLs encounter missing playlist support or confusing errors due to Spotify API zero-login restrictions; furthermore, staged tracks currently lack a unified, responsive workbench view with status badges, desktop/mobile adaptation, and quick list manipulation.

**Approach:** Intercept Spotify playlist links client-side in `SmartInputBar` with zero network calls and surface `SpotifyPlaylistHelper` with 3-step desktop clipboard guidance and fast action buttons; replace inline ad-hoc track rendering with `WorkingListWorkbench`, displaying a dense 6-column desktop table and stacked `MobileTrackCard` components with 44px touch targets on mobile, featuring `VerificationStatusBadge` ("Unscanned") and `Clear List` / remove actions.

## Boundaries & Constraints

**Always:**
- Intercept Spotify playlist URLs (`open.spotify.com/playlist/...`, localized `open.spotify.com/intl-.../playlist/...`, and `spotify:playlist:...`) purely client-side without making `/api/catalog/search` or external network calls when unauthenticated (`vipMode == false`).
- Render `SpotifyPlaylistHelper` with a calm studio-indigo border (`border-brand-accent/40`), 3-step Spotify Desktop `Ctrl+A` $\rightarrow$ `Ctrl+C` $\rightarrow$ paste instructions, alongside `Focus Paste Box` and `Search Albums Instead` actions.
- Render `WorkingListWorkbench` when staged tracks exist in `workingList`, providing a dense 6-column table on desktop (`>= 768px`) with columns: `#`, cover art, title & artist, album, duration, `VerificationStatusBadge`, and remove action.
- Provide `Clear List` button resetting `workingList` (and corresponding `scannedTracks`/`playlist`) to 0.
- Provide `aria-label="Remove track"` on every individual track remove button.
- Adapt to stacked `MobileTrackCard` components below 768px with minimum 44px touch targets (`min-h-[44px] min-w-[44px]` on interactive buttons) and zero horizontal page overflow down to 360px viewport width.
- Render `VerificationStatusBadge` showing `"Unscanned"` in neutral/mono styling before lyric scanning.

**Never:**
- Never emit network requests to `/api/catalog/search` or Spotify APIs when a Spotify playlist URL is pasted or entered by an unauthenticated visitor.
- Never crash or fail to render tracks missing optional fields (`album`, `thumbnail`, `duration_seconds`).
- Never use non-semantic or unlabelled icon buttons without accessible `aria-label` or visible text.
- Never introduce horizontal scrollbars or overflow at 360px viewport width.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Spotify Playlist URL Input | `https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M` typed/pasted in `SmartInputBar` | 0 network calls; `SpotifyPlaylistHelper` renders with 3-step copy-paste guidance and action buttons | Clears or suppresses search query execution |
| Localized Spotify Playlist URL | `https://open.spotify.com/intl-es/playlist/37i9dQZF1DXcBWIGoYBM5M` | Intercepted client-side identically to standard playlist URLs | 0 network calls |
| Spotify URI Input | `spotify:playlist:37i9dQZF1DXcBWIGoYBM5M` | Intercepted client-side identically | 0 network calls |
| "Focus Paste Box" Click | User clicks "Focus Paste Box" in helper banner | Opens `PasteTrackListPanel` and focuses its textarea | Helper remains or dismisses cleanly |
| "Search Albums Instead" Click | User clicks "Search Albums Instead" | Clears playlist URL, focuses search input with album guidance | 0 network errors |
| Desktop Viewport (>= 768px) | Staged tracks in `workingList` on desktop | `WorkingListWorkbench` renders 6-column dense table with `#`, art, title/artist, album, duration, status badge, remove action | Responsive table layout |
| Mobile Viewport (< 768px) | Staged tracks in `workingList` on mobile | `MobileTrackCard` stacked cards render; touch targets >= 44px; no horizontal overflow at 360px | Truncates long titles/artists safely |
| Remove Single Track | Click remove button on row or mobile card | Track is removed from `workingList`; remaining count updates | Dedupes and keeps list intact |
| Clear List Click | Click "Clear List" button | All staged tracks cleared (`workingList` reset to empty array) | Disables or hides workbench when list empty |
| Missing Cover Art or Duration | Track object with `thumbnail: ""` or missing `duration` | Renders music placeholder icon; formats duration fallback `0:00` | No JavaScript exceptions |

</frozen-after-approval>

## Code Map

- `frontend/src/utils/inputParser.js`: Add `isSpotifyPlaylistUrl(urlOrUri)` helper to reliably detect Spotify playlist URLs and URIs (including localized `/intl-.../` routes).
- `frontend/src/components/SpotifyPlaylistHelper.jsx`: New component displaying studio-indigo bordered guidance banner with 3-step Spotify Desktop copy-paste instructions, "Focus Paste Box", "Search Albums Instead", and dismiss trigger.
- `frontend/src/components/VerificationStatusBadge.jsx`: New component rendering status badge with Obsidian Audio Core tokens ("Unscanned" neutral badge, plus future-proof support for "Verified Clean", "Clean Swapped", "Flagged").
- `frontend/src/components/MobileTrackCard.jsx`: New mobile card component for viewports `< 768px` with 44px touch targets, artwork, metadata, status badge, and remove action.
- `frontend/src/components/WorkingListWorkbench.jsx`: New responsive container component wrapping desktop 6-column table (`hidden md:block`) and mobile cards (`block md:hidden`), track count header, and "Clear List" button.
- `frontend/src/components/SmartInputBar.jsx`: Wire `isSpotifyPlaylistUrl` check in `handleInputChange`, `handlePaste`, and `executeSearch` to prevent search requests and notify parent/render `SpotifyPlaylistHelper`.
- `frontend/src/components/ScanTab.jsx`: Integrate `SpotifyPlaylistHelper` and replace ad-hoc track list with `WorkingListWorkbench`.
- `frontend/src/components/__tests__/SpotifyPlaylistHelper.test.jsx`: Unit tests for `SpotifyPlaylistHelper` rendering, actions, and step instructions.
- `frontend/src/components/__tests__/WorkingListWorkbench.test.jsx`: Unit tests for 6-column desktop table, mobile card rendering, remove action, and Clear List.
- `frontend/src/utils/__tests__/inputParser.test.js`: Unit tests for `isSpotifyPlaylistUrl`.

## Tasks & Acceptance

**Execution:**
- [x] `frontend/src/utils/inputParser.js` -- Add `isSpotifyPlaylistUrl` detection -- Detects Spotify playlist URLs and URIs client-side before any network request.
- [x] `frontend/src/components/SpotifyPlaylistHelper.jsx` -- Create Spotify playlist helper banner -- Implements calm studio-indigo guidance with 3-step instructions and action buttons.
- [x] `frontend/src/components/VerificationStatusBadge.jsx` -- Create verification status badge -- Reusable status badge with "Unscanned" default.
- [x] `frontend/src/components/MobileTrackCard.jsx` -- Create mobile track card component -- Implements stacked cards with >= 44px touch targets and zero horizontal overflow.
- [x] `frontend/src/components/WorkingListWorkbench.jsx` -- Create working list workbench with desktop table and mobile cards -- Renders dense 6-column table and responsive mobile view with track removal and Clear List.
- [x] `frontend/src/components/SmartInputBar.jsx` -- Intercept Spotify playlist URLs client-side -- Suppresses catalog search and surfaces helper banner.
- [x] `frontend/src/components/ScanTab.jsx` -- Integrate `WorkingListWorkbench` and `SpotifyPlaylistHelper` -- Connects workbench to working list state and actions.
- [x] `frontend/src/utils/__tests__/inputParser.test.js` & `frontend/src/components/__tests__/SpotifyPlaylistHelper.test.jsx` & `frontend/src/components/__tests__/WorkingListWorkbench.test.jsx` -- Add unit and integration tests -- Validates all acceptance criteria and edge cases.

**Acceptance Criteria:**
- Given an unauthenticated visitor in public mode (`vipMode == false`), when a Spotify playlist URL (`open.spotify.com/playlist/...`, `/intl-.../playlist/...`, or `spotify:playlist:...`) is entered or pasted into `SmartInputBar`, then input is intercepted client-side (`0` network calls, `0` HTTP 401/403 errors), and `SpotifyPlaylistHelper` renders with a calm studio-indigo border, showing 3-step Spotify Desktop `Ctrl+A` $\rightarrow$ `Ctrl+C` $\rightarrow$ paste instructions, alongside `Focus Paste Box` and `Search Albums Instead` actions.
- Given staged tracks in `workingList`, when viewed on desktop (`>= 768px`), then `WorkingListWorkbench` renders a dense 6-column table (`#`, cover art, title & artist, album, duration, `VerificationStatusBadge` showing `"Unscanned"`, and remove action), individual tracks can be removed with `aria-label="Remove track"`, and `Clear List` resets `workingList` to 0.
- Given staged tracks in `workingList`, when viewed on mobile (`< 768px`), then table columns adapt to stacked `MobileTrackCard` components with 44px minimum touch targets and zero horizontal page overflow down to 360px viewport width.

## Implementation Notes

## Spec Change Log

## Review Triage Log

- `VerificationStatusBadge.jsx:842-848`: `status="unscanned"` overrides `track.was_replaced` and `track.is_flagged` properties: patch (prioritize track replacement and flagged status when track is provided or check `status && status !== 'unscanned'`).
- `SmartInputBar.jsx:15` & `ScanTab.jsx:630`: `vipMode` is not passed by `ScanTab` (`<SmartInputBar vipMode={isAuthenticated} ... />`): patch (pass `vipMode={isAuthenticated}` in `ScanTab.jsx`, and add test for `vipMode={true}`).
- `ScanTab.jsx:65, 721-733`: Unreachable `showSpotifyHelper` state and duplicate `SpotifyPlaylistHelper` rendered in `ScanTab.jsx`: patch (remove dead duplicate helper and state in `ScanTab` since `SmartInputBar` directly handles rendering helper banner).
- `WorkingListWorkbench.jsx:1006` & `MobileTrackCard.jsx`: Guard against potential null/undefined track items in arrays: patch (filter `Boolean` on `tracks`).
- `WorkingListWorkbench.jsx` & `MobileTrackCard.jsx`: Missing `aria-label` on lyrics button and external link buttons: patch (add `aria-label="View lyrics"` and `aria-label="Open track link"`).
- `WorkingListWorkbench.jsx` & `MobileTrackCard.jsx`: Floating-point duration seconds formatting: patch (wrap `track.duration_seconds % 60` with `Math.floor()`).
- `ScanTab.jsx:535`: `handleSwapTrack` updates `scannedTracks` but does not update `workingList`: patch (add `if (setWorkingList) setWorkingList(...)`).
- `frontend/src/utils/inputParser.js:1614`: `isSpotifyPlaylistUrl` misses legacy `/user/{username}/playlist/{id}` routes: patch (support optional `user/[^/]+/` in regex).
- `ScanTab.test.jsx`: Missing integration test for "Clear List" button in `ScanTab`: patch (add integration test verifying workbench Clear List button resets working list and scanned tracks).

## Design Notes

- **Studio-Indigo Accent:** Use `border-brand-accent/40` (`--color-brand-accent: #6366F1`) or `border-indigo-500/40` for the `SpotifyPlaylistHelper` container to distinguish guided system help from amber warning banners (`NoticeBanner`).
- **Touch Target Accessibility:** Mobile buttons (remove track, clear list) must include `min-h-[44px] min-w-[44px]` and `flex items-center justify-center` to satisfy mobile accessibility standards.
- **Table Density:** Desktop table rows styled with `p-2.5` / `py-2 px-3` and font sizes aligned with Obsidian Audio Core (`text-xs text-text-primary`, duration in `font-mono text-text-muted`).

## Verification

**Commands:**
- `$env:PYTHONPATH="backend"; .\.venv\Scripts\pytest.exe backend/app/tests/` -- expected: all backend tests pass without error.
- `npm --prefix frontend test` -- expected: all Vitest unit tests pass.
- `npm --prefix frontend run lint` -- expected: 0 lint errors (`oxlint`).
- `npm --prefix frontend run build` -- expected: Vite production build succeeds.
