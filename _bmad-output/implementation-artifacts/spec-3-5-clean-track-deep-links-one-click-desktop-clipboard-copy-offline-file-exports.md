---
title: 'Story 3.5: Clean Track Deep Links, One-Click Desktop Clipboard Copy, & Offline File Exports'
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

**Problem:** Users finishing a screening session have no zero-login way to copy their vetted clean playlist URLs formatted for instant Spotify Desktop paste (`Ctrl+V` / `Cmd+V`), export platform-neutral offline files (CSV, M3U8, JSON), or access per-track deep links to the active platform for approved clean songs.

**Approach:** Extend `finishLine.js` and `FinishLineBar.jsx` to introduce one-click clipboard copying of canonical track links (`https://open.spotify.com/track/<id>` or `https://music.youtube.com/watch?v=<id>`) separated by newlines with live user feedback ("Copied N Clean Track Links"), render primary desktop CTA in electric violet stacked above a monospace `Ctrl+V` / `Cmd+V` desktop paste hint, provide an `Export ▾` dropdown popover triggering `POST /api/export` (supporting CSV with platform-neutral `"Track Link"` headers, M3U8, and JSON), invert layout on mobile to keep `Play Clean Queue` prominent while providing secondary copy and export actions, and ensure per-track "Open Clean Track" deep links appear on approved cards.

</frozen-after-approval>

## Implementation Notes

- **Backend Export Alignment (`backend/app/services/stitcher_service.py`, `backend/app/main.py`)**:
  - Updated `StitcherService.export_as_csv` to output platform-neutral `"Track Link"` column header instead of platform-specific `"YouTube Music Link"`.
  - Added `_resolve_track_export_url` static helper to normalize URLs across CSV and M3U8 exports, resolving canonical `https://open.spotify.com/track/<id>` or `https://music.youtube.com/watch?v=<id>`, handling `None`, empty string IDs, and stripping `spotify:track:` prefixes safely without raising `AttributeError`.
  - Added `platform: Optional[str] = "ytmusic"` to `ExportRequest` model and routed `platform` to `export_as_m3u` and `export_as_csv`.
  - Added safe fallback `or "CleanPlaylist"` to `export_playlist_file` when title sanitation results in empty string to avoid extension-only filenames.
  - Added unit test suite `backend/app/tests/test_export.py` covering CSV, M3U8, JSON, sanitization, invalid format, and null/empty ID handling.
- **Frontend Finish Line Domain Logic (`frontend/src/utils/finishLine.js`)**:
  - Exported `isTrackReady(track, keptTrackIds)` helper standardizing ready status checks (`verified_clean`, `clean_swapped`, `was_replaced`, or in `keptTrackIds` Set/Array).
  - Implemented `getTrackCanonicalUrl(track, platform)` constructing canonical Spotify (`open.spotify.com/track/<id>`) and YouTube Music (`music.youtube.com/watch?v=<id>`) deep links with `uri` fallback and HTTP URL validation.
  - Implemented `formatCleanTrackLinks(readyTracks, platform)` joining canonical URLs with `\n` and no trailing whitespace.
  - Implemented `copyCleanTrackLinks({ readyTracks, platform, onNotice, clipboard })` copying formatted URLs to clipboard, announcing `"Copied N Clean Track Links"` based on actual copied count, and firing fire-and-forget telemetry (`finish_action_clicked`, `copy_clean_links`).
  - Implemented `exportCleanPlaylistFile({ readyTracks, format, playlistTitle, platform, onNotice, fetchFn })` posting to `/api/export`, triggering browser blob download with sanitized filename, surfacing success notice, and emitting telemetry.
- **FinishLineBar Component (`frontend/src/components/FinishLineBar.jsx`)**:
  - Desktop layout: Primary studio CTA is electric violet `Copy Clean Track Links` stacked above monospace paste instruction hint (`Ctrl+V / Cmd+V in Spotify Desktop` or `Paste links in YouTube Music`), paired with secondary `Play Clean Queue` and `Export ▾` actions.
  - Mobile layout: Inverted layout with full-width `Play Clean Queue ({readyCount})` on top, paired with secondary `Copy Clean Track Links` and `Export ▾` actions below.
  - Accessible export popover dropdown supporting CSV, M3U8, and JSON formats, with `Loader2` in-flight spinner, escape key dismissal, and outside-click handling.
- **Track List Deep Link Integration (`WorkingListWorkbench.jsx`, `MobileTrackCard.jsx`, `ScanTab.jsx`)**:
  - Connected per-card and table row deep links using `getTrackCanonicalUrl` with `aria-label={isReady ? 'Open Clean Track' : 'Open track link'}` and title tooltip with track title.
  - Replaced legacy `handleExportCSV` in `ScanTab.jsx` with `exportCleanPlaylistFile` using `getReadyTracks(currentTracks, keptTrackIds)`.
- **Test Suites**:
  - Expanded `frontend/src/utils/__tests__/finishLine.test.js` to 27 tests covering all new domain methods and edge cases.
  - Expanded `frontend/src/components/__tests__/FinishLineBar.test.jsx` to 9 tests covering responsive layouts, clipboard copy, and export popover interactions.

## Review Triage Log

- `backend/app/services/stitcher_service.py`: `AttributeError` when `id` is `None` in `export_as_m3u` & `export_as_csv`: `medium` (patched — added `_resolve_track_export_url` safely guarding non-string / None / empty IDs).
- `backend/app/services/stitcher_service.py`: Empty string ID in Spotify mode outputting trailing slash URL: `medium` (patched — only returns Spotify URL when clean ID is non-empty).
- `backend/app/main.py`: Empty sanitized filename when playlist title consists only of stripped chars: `medium` (patched — added `or "CleanPlaylist"` fallback).
- `frontend/src/utils/finishLine.js`: `copyCleanTrackLinks` reporting `readyTracks.length` rather than count of successfully formatted URLs: `medium` (patched — count computed from actual formatted lines).
- `frontend/src/utils/finishLine.js`: Missing HTTP URL validation and `uri` inspection in `getTrackCanonicalUrl`: `low` (patched — added `track.uri` fallback and HTTP URL protocol validation).
- `frontend/src/utils/finishLine.js`: Missing success feedback on file download in `exportCleanPlaylistFile`: `low` (patched — added success notice upon successful download trigger).
- `frontend/src/components/FinishLineBar.jsx`: Static Spotify paste hint on YouTube Music mode: `medium` (patched — dynamically renders based on `activePlatform`).
- `frontend/src/components/FinishLineBar.jsx`: Export popover menu container declaring `role="menu"` without menuitem children: `low` (patched — removed conflicting role declaration).
- `frontend/src/components/FinishLineBar.jsx`: Missing visual loading spinner while export request is in flight: `low` (patched — added `Loader2` animate-spin icon).
- `frontend/src/components/WorkingListWorkbench.jsx` & `MobileTrackCard.jsx`: External track links lack accessible title in `title` / `aria-label`: `low` (patched — added track title to `title` tooltip and preserved `aria-label`).
- `frontend/src/components/WorkingListWorkbench.jsx` & `MobileTrackCard.jsx`: Inline ready checks duplicate logic and omit `was_replaced`: `low` (patched — unified via exported `isTrackReady` helper).
- `frontend/src/components/ScanTab.jsx`: Legacy `handleExportCSV` exports unvetted `scannedTracks` directly via raw fetch: `medium` (patched — routed through `exportCleanPlaylistFile` using `readyTracks`).
- `frontend/src/components/ScanTab.jsx`: Unused `activePlatform` and `playlistTitle` props passed to child components: `low` (rejected — harmless and safe).
