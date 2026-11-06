---
title: 'Story 1.3: Unified Header, Active Platform Context, & Atomic Switch Confirmation'
type: 'feature'
created: '2026-11-06'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The current navigation header (`Navbar.jsx`) uses platform-specific green/purple chrome, renders outdated login/read-only badges, has inconsistent tab labels (`Stitch Playlists` instead of `Stitch Studio`), and allows unconfirmed platform switching that can lead to confusion or dirty-state inconsistency with staged tracks.

**Approach:** Implement `GlobalHeader` and `CatalogSelector` using Obsidian Audio Core design tokens (`bg-surface-low`, `border-border-subtle`, unified electric violet `#7C3AED` across both platforms, strictly 3 tabs: `Scan & Clean`, `Keyword Search`, `Stitch Studio`, and no public auth badges), pair it with `PlatformSwitchModal` confirmation over backdrop blur when `workingList` is non-empty, and ensure an atomic reset of `workingList`, `scannedTracks`, `lyricsByTrackId`, and scan state upon confirmed switch.

</frozen-after-approval>

## Implementation Notes

- Created `frontend/src/components/CatalogSelector.jsx`: Segmented pill selector supporting Spotify and YouTube Music, arrow key navigation (ArrowLeft / ArrowRight), active/inactive Obsidian Audio Core tokens, and accessible touch target heights.
- Created `frontend/src/components/PlatformSwitchModal.jsx`: Modal confirmation dialog with `AlertTriangle` in caution amber, focus trap between Cancel and Switch & Clear List, focus restoration to previously active element, body scroll locking, and Escape/backdrop dismissal.
- Created `frontend/src/components/GlobalHeader.jsx`: Unified 56px (`h-14`) studio header with strictly 3 tabs (`Scan & Clean`, `Keyword Search`, `Stitch Studio`), `brand-tint` active indicator, electric violet branding, `aria-label` on navigation buttons, and zero public authentication or read-only badges.
- Updated `frontend/src/components/Navbar.jsx` as backward-compatible wrapper delegating to `GlobalHeader`.
- Updated `frontend/src/App.jsx` to integrate `GlobalHeader`, `CatalogSelector`, `PlatformSwitchModal`, and atomic platform switching that resets `workingList`, `scannedTracks`, `playlist`, and `lyricsByTrackId`.
- Added unit and integration test suites:
  - `frontend/src/components/__tests__/CatalogSelector.test.jsx` (5 tests)
  - `frontend/src/components/__tests__/PlatformSwitchModal.test.jsx` (7 tests)
  - `frontend/src/components/__tests__/GlobalHeader.test.jsx` (3 tests)
  - `frontend/src/components/__tests__/AppHeaderSwitch.test.jsx` (2 tests)

## Review Triage Log

- Focus trap missing in `PlatformSwitchModal`: patch (implemented Tab/Shift+Tab looping between Cancel and Switch & Clear List).
- Focus restoration missing on modal close: patch (saved `document.activeElement` on open and restored on close).
- Missing accessible name on mobile navigation tabs: patch (added explicit `aria-label={tab.label}` to tab buttons).
- Touch target sizes below 44px on mobile: patch (added min-h target styling across header and selector buttons).
- Incomplete state synchronization between `workingList` and `scannedTracks`: patch (synchronized state updater in `App.jsx`).
- Disconnected `_lyricsByTrackId` state in `App.jsx`: false (part of ARCH-7 / Story 1.3 spec contracts; will be wired to cross-tab lyric caching in Epic 2).
- Missing background scroll lock in `PlatformSwitchModal`: patch (added `document.body.style.overflow = 'hidden'` on open).
- Dead authentication logic in `App.jsx`: low (rejected; dormant logic reserved for VIP Mode query parameter activation in Epic 5).
- Missing test coverage for modal Escape, backdrop, and arrow navigation: patch (added tests covering Escape, backdrop click, scroll lock, and ArrowRight navigation).
- Missing arrow-key navigation in `CatalogSelector`: patch (added ArrowLeft and ArrowRight navigation handlers).
- Header height token mismatch: patch (aligned header height to `h-14` / 56px per `DESIGN.md`).
