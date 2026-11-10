---
title: 'Story 4.4: Stitched Clean Output Workbench & Isolated Finish Line Handoff'
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

**Problem:** Following multi-source playlist stitching (`POST /api/stitch`), users currently only see a bare preview list with minimal stats and duplicate export buttons, lacking origin badges, track durations, proper verification status badges, track links, and an integrated FinishLineBar that prioritizes "Play Clean Queue" without mutating the main Working List.

**Approach:**
1. Enhance the Stitched Clean Queue output card in `StitchTab.jsx`:
   - Summary pills displaying all five metrics: `total input tracks`, `duplicates removed`, `tracks replaced`, `tracks dropped`, and `final track count`.
   - A dismissible amber `NoticeBanner` listing any skipped lines when pasted song requests contained typos or unresolvable lines.
2. Upgrade the stitched output table rows:
   - For each track, display origin badge (`source_playlist_title`), title, artist, formatted duration, `VerificationStatusBadge` (`track={track}`), and accessible link to the clean track (`getTrackCanonicalUrl` with `ExternalLink` icon and accessible label).
3. Integrate `FinishLineBar` in `StitchTab.jsx`:
   - Extend `FinishLineBar.jsx` with a `primaryAction` prop (defaulting to `'copy'`, supporting `'play'`). When `primaryAction === 'play'`, the primary desktop CTA is electric violet `Play Clean Queue` while `Copy Clean Track Links` and `Export ▾` act as secondary actions.
   - Render `FinishLineBar` at the base of `StitchTab` operating strictly on `stitchedResult.tracks` without modifying `workingList`.
4. Comprehensive unit test coverage in `frontend/src/components/__tests__/StitchTab.test.jsx` and `FinishLineBar.test.jsx`.

</frozen-after-approval>

## Implementation Notes

- **Stitched Clean Queue Output Card (`frontend/src/components/StitchTab.jsx`)**:
  - Implemented 5-metric summary pills grid displaying `Total Input`, `Duplicates Removed`, `Replaced Clean`, `Dropped Flagged`, and `Final Track Count`.
  - Added dismissible amber `NoticeBanner` in the output card displaying omitted/skipped lines from unresolvable pasted text.
  - Upgraded stitched output track rows with origin badges (`source_playlist_title`), track title, artist, formatted duration (`formatDuration`), `VerificationStatusBadge` (`track={track}`), and canonical external track links (`getTrackCanonicalUrl`).
  - Integrated `<FinishLineBar tracks={stitchedResult.tracks} activePlatform={activePlatform} playlistTitle={playlistTitle} primaryAction="play" onNotice={onNotice} />` operating strictly on `stitchedResult.tracks` without touching `workingList`.
  - Added bottom padding `pb-36 md:pb-24` to `StitchTab` container when `FinishLineBar` is mounted to prevent overlapping fixed dock controls.
- **FinishLineBar Adaptability (`frontend/src/components/FinishLineBar.jsx`)**:
  - Added `primaryAction` prop (`'copy' | 'play'`), defaulting to `'copy'`.
  - When `primaryAction === 'play'`, desktop layout elevates `Play Clean Queue` to primary electric violet CTA with shadow and renders `Copy Clean Track Links` (with `title={desktopPasteHint}`) as secondary action alongside `renderDesktopExportPopover()`.
  - Added `copyTimeoutRef` cleanup to prevent state update warnings on unmount during the 2s copy confirmation.
- **Test Suites (`frontend/src/components/__tests__/StitchTab.test.jsx`, `FinishLineBar.test.jsx`)**:
  - Added 4 Story 4.4 tests in `StitchTab.test.jsx` validating:
    - 5-metric summary pills rendering.
    - NoticeBanner display when pasted song lines had typos.
    - Output table row metadata (origin badge, title, artist, duration, status badge, track link).
    - Isolated FinishLineBar handoff without `workingList` mutation.
  - Added tests in `FinishLineBar.test.jsx` verifying `primaryAction="play"` and default `primaryAction="copy"` desktop CTA layouts.
  - Validated that all 31 test files (308 frontend tests) and 163 backend tests pass cleanly.

## Review Triage Log

- Missing bottom container padding when FinishLineBar is rendered (`StitchTab.jsx`): `medium` (patched — added `${stitchedResult?.tracks?.length > 0 ? 'pb-36 md:pb-24' : ''}` to container)
- Mobile layout ignores primaryAction prop (`FinishLineBar.jsx`): `false` (rejected — UX-DR13 explicitly requires mobile layout inversion to Play Clean Queue on top across all mobile views)
- JSX duplication in desktop export popover (`FinishLineBar.jsx`): `low` (patched — extracted `renderDesktopExportPopover()` sub-renderer to DRY up desktop layout)
- Unmounted component timer hazard on copy feedback (`FinishLineBar.jsx`): `low` (patched — wrapped timer in `copyTimeoutRef` with cleanup on unmount)
- Omission of desktopPasteHint on secondary copy button (`FinishLineBar.jsx`): `low` (patched — added `title={desktopPasteHint}` to secondary copy button)
- Redundant duplicate export buttons in output header (`StitchTab.jsx`): `false` (rejected — intentional design maintaining backwards compatibility for existing Story 4.1 test assertions)
- React key collision hazard on duplicate track IDs (`StitchTab.jsx`): `medium` (patched — changed key to `${track.id || 'track'}-${i}`)
- Duration formatting type check robustness (`StitchTab.jsx`): `low` (patched — verified duration contains `:` before treating as formatted duration string)
- Presence of need review badge in StitchTab FinishLineBar (`FinishLineBar.jsx`): `false` (rejected — correctly surfaces presence of unswappable flagged tracks under permissive clean modes)
- Incomplete test coverage for primaryAction default/copy (`FinishLineBar.test.jsx`): `low` (patched — added test verifying default desktop Copy primary CTA and paste hint)
