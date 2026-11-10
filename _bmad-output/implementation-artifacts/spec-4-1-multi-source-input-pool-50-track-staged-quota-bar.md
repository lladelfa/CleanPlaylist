---
title: 'Story 4.1: Multi-Source Input Pool & 50-Track Staged Quota Bar'
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

**Problem:** Users staging playlists in Stitch Studio lack an intuitive multi-source input pool and track budget monitor to combine YouTube Music playlists, searched albums, pasted track lists, and active Working List tracks without exceeding the 50-track public limit or making redundant network requests.

**Approach:** Upgrade `StitchTab.jsx` with Obsidian Audio Core tokens and implement a multi-source input pool featuring 4 distinct triggers (YouTube Music playlist URL input, album search modal/tray, `PasteTrackListPanel` trigger, and 1-click `Add Current Working List` snapshot with cached lyrics preservation), render added sources in a responsive 2-column card grid with track counts and accessible remove actions (`aria-label="Remove source {name}"`), and display a live `Combined Track Quota: N / 50 Staged` progress meter that transitions to caution amber accompanied by a `NoticeBanner` warning of truncation whenever staged tracks exceed 50 in public mode.

</frozen-after-approval>

## Implementation Notes

- **App Integration (`frontend/src/App.jsx`)**:
  - Forwarded `workingList`, `lyricsByTrackId`, and `vipMode={isAuthenticated}` to `StitchTab`.
- **Multi-Source Ingest Pool & Quota Meter (`frontend/src/components/StitchTab.jsx`)**:
  - Upgraded component with Obsidian Audio Core design tokens (`bg-surface-card`, `bg-surface-elevated`, `bg-surface-inset`, `border-border-subtle`, `text-text-primary`, `bg-brand-primary`).
  - Implemented 4 source triggers: YouTube Music playlist URL input/button with Enter key support, interactive Album Search tray querying `/api/catalog/search` and `/api/catalog/album`, integrated `PasteTrackListPanel` trigger staging pasted line sources, and 1-click `Add Current Working List` disabled when `workingList.length === 0`.
  - Implemented working list snapshotting that isolates staged pool tracks while preserving any active lyrics in `stitchLyricsCache` for downstream screening in Story 4.2.
  - Implemented responsive 2-column source cards with thumbnails/icons, track count metrics, and accessible remove buttons (`aria-label="Remove source {name}"`).
  - Implemented real-time `Combined Track Quota: N / 50 Staged` progress meter with percentage display; triggers caution amber progress bar and inline `NoticeBanner` warning of truncation when `totalTracks > 50` in public mode.
  - Preserved merge settings (order mode, deduplication mode, clean mode) and export controls with metrics summary and track preview.
- **Unit Testing Suite (`frontend/src/components/__tests__/StitchTab.test.jsx`)**:
  - Added 8 unit tests covering all 4 triggers, working list snapshotting and caching, YouTube playlist ingest, album searching and loading, paste panel staging, source deletion, live quota progress updates, caution warning banner upon exceeding 50 staged tracks in public mode, and stitch/export workflows.

## Review Triage Log

- Missing accessible labels on text inputs: `medium` (patched — added `aria-label` to URL input, album search input, and playlist title input).
- Stale error clearing in `handleExport`: `low` (patched — added `setError(null)` on export start).
- Missing track list preview and summary stats in stitched results: `low` (patched — restored summary metrics cards and track sequence preview table).
- Missing test coverage for stitch execution and export: `low` (patched — added assertions verifying `POST /api/stitch` payload, stats display, and `POST /api/export` blob generation).
- Unused `stitchLyricsCache` in `POST /api/stitch`: `false` (cached lyrics are purposely retained in StitchTab state for pre-screening consumption in Story 4.2).
- Unresolved track metadata for pasted sources: `false` (pasted line resolution via `POST /api/catalog/resolve` is explicitly specified as step 1 of Story 4.2 pre-screening before merge).
- Missing native Spotify save integration: `defer` (direct Spotify sync for stitched playlists is scheduled for Epic 4/5 integration).
