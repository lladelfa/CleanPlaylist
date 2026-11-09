---
title: 'Story 6.2: 3-Zone Workspace Surface Depths & Accent Rails'
type: 'feature'
created: '2026-11-09'
status: 'done'
baseline_commit: '9a23e31be6ccd7f869397e32eb6e10788de12950'
route: 'dispatch'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Reviewing tracks in `ScanTab.jsx` feels like looking at an undifferentiated "dark slab". Functional areas lack visual depth hierarchy, the outer summary card nests the inner table card redundantly, and explicit flagged tracks do not stand out immediately in the list.

**Approach:** 
1. 3-Zone Workspace Hierarchy: Establish three visually distinct studio console zones separated by macro spacing (`space-y-8`):
   - Zone 1: Ingest & Discovery (`bg-surface-elevated`, subtle violet accent rail `border-l-4 border-l-brand-primary`, and eyebrow badge `01 / SOURCE MUSIC`).
   - Zone 2: Screening Console (`bg-surface-inset`, `border-border-strong`, and eyebrow badge `02 / SCREENING RULES`).
   - Zone 3: Track Workbench (`bg-surface-card`, `shadow-2xl`, and eyebrow badge `03 / TRACK WORKBENCH`).
2. De-Nest Workbench Container: Merge the outer summary container and inner table workbench into a single non-nested workbench container, eliminating card-in-a-card visual nesting and replacing legacy `slate-*` classes with Obsidian Audio Core tokens.
3. Flagged Accent Rails: Display a subtle rose accent rail (`border-l-2 border-l-status-flagged-border/60`) on explicit/flagged track rows and mobile cards for instant identification.
4. Banded Table Header Strip: Render a dark banded header strip (`bg-surface-inset/80`) with uppercase, tracking-spaced mono column labels in desktop view (`>= 768px`).

## Boundaries & Constraints

**Always:**
- Keep all interactive elements accessible with explicit `aria-label`s and visible labels.
- Follow Obsidian Audio Core design tokens (`bg-surface-card`, `bg-surface-inset`, `bg-surface-elevated`, `border-border-subtle`, `border-border-strong`, `brand-primary`).
- Preserve all existing functionality: track search, filtering (All / Flagged / Clean), lyrics inspection modal, clean track search/swap, CSV export, and Spotify playlist saving.
- Reserve Emerald Green (`#4EDEA3` / `#10B981`) exclusively for verified clean/swapped states.

**Never:**
- Never reintroduce card-in-a-card nested containers for the Track Workbench.
- Never use green colors for Spotify platform chrome; keep green reserved for clean/swapped state tokens.
- Never break zero-horizontal-scroll responsive guarantees on mobile (< 768px) and desktop (>= 768px).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Empty Workspace | `currentTracks.length === 0` | Zone 1 (Ingest & Discovery) renders with `01 / SOURCE MUSIC` badge and `EmptyStateHero`; Zones 2 and 3 remain unmounted | N/A |
| Populated Workspace | `currentTracks.length > 0` | All 3 zones render separated by `space-y-8`, each with its designated eyebrow badge (`01`, `02`, `03`) and elevation styling | N/A |
| Single Non-Nested Workbench | Populated workbench inspected | Single outer card container with header stats, filter/search bar, and track table/cards; zero inner nested cards | N/A |
| Flagged Track in Table | Track with `is_flagged === true` | Table row displays subtle rose accent rail `border-l-2 border-l-status-flagged-border/60` | N/A |
| Clean Track in Table | Track with `is_flagged === false` | Table row displays transparent or neutral border rail without rose accent | N/A |
| Flagged Track in Mobile Card | Mobile view (< 768px), `is_flagged === true` | `MobileTrackCard` displays `border-l-2 border-l-status-flagged-border/60` accent rail | N/A |
| Banded Table Header | Desktop view (>= 768px) | Header `<tr>` has `bg-surface-inset/80` and uppercase tracking-wider mono headers | N/A |

</frozen-after-approval>

## Code Map

- `frontend/src/components/ScanTab.jsx` -- Root workspace layout: apply `space-y-8` macro spacing, wrap Ingest & Discovery in Zone 1 hero container with `01 / SOURCE MUSIC` eyebrow badge and violet accent rail, render Zone 2 (`ScreeningControlsBar`), de-nest and render Zone 3 Track Workbench directly without duplicate outer `bg-slate-900` card.
- `frontend/src/components/SmartInputBar.jsx` -- Align container styling with Zone 1 hero elevation (`bg-surface-elevated`, `border-l-4 border-l-brand-primary`) and include or integrate the `01 / SOURCE MUSIC` eyebrow badge.
- `frontend/src/components/ScreeningControlsBar.jsx` -- Zone 2 styling: update container to `bg-surface-inset` with `border-border-strong` and eyebrow badge `02 / SCREENING RULES`.
- `frontend/src/components/WorkingListWorkbench.jsx` -- Zone 3 Track Workbench: single non-nested container with `bg-surface-card`, `shadow-2xl`, eyebrow badge `03 / TRACK WORKBENCH`, banded header strip (`bg-surface-inset/80`), and rose accent rail (`border-l-2 border-l-status-flagged-border/60`) on flagged rows. Incorporate or slot toolbar/stats cleanly.
- `frontend/src/components/MobileTrackCard.jsx` -- Add rose accent rail `border-l-2 border-l-status-flagged-border/60` for flagged tracks.
- `frontend/src/components/__tests__/ScanTab.test.jsx` -- Verify 3-zone structure, eyebrow badges, macro spacing, and single non-nested workbench layout.
- `frontend/src/components/__tests__/WorkingListWorkbench.test.jsx` -- Verify `03 / TRACK WORKBENCH` eyebrow badge, banded header strip (`bg-surface-inset/80`), and rose accent rail on flagged tracks.
- `frontend/src/components/__tests__/ScreeningControlsBar.test.jsx` -- Verify Zone 2 `02 / SCREENING RULES` eyebrow badge and `bg-surface-inset` styling.

## Tasks & Acceptance

**Execution:**
- [x] `frontend/src/components/SmartInputBar.jsx` -- Update styling to Zone 1 hero elevation with `border-l-4 border-l-brand-primary` and `01 / SOURCE MUSIC` eyebrow badge.
- [x] `frontend/src/components/ScreeningControlsBar.jsx` -- Update styling to Zone 2 sunken console with `bg-surface-inset`, `border-border-strong`, and `02 / SCREENING RULES` eyebrow badge.
- [x] `frontend/src/components/WorkingListWorkbench.jsx` -- Implement Zone 3 single non-nested workbench container with `bg-surface-card`, `shadow-2xl`, `03 / TRACK WORKBENCH` badge, banded `bg-surface-inset/80` header strip, and `border-l-2 border-l-status-flagged-border/60` row accent rails.
- [x] `frontend/src/components/MobileTrackCard.jsx` -- Apply `border-l-2 border-l-status-flagged-border/60` accent rail when `is_flagged === true`.
- [x] `frontend/src/components/ScanTab.jsx` -- Restructure workspace with `space-y-8` macro spacing, remove redundant outer `bg-slate-900` card and unify workbench controls.
- [x] `frontend/src/components/__tests__/WorkingListWorkbench.test.jsx` -- Add unit tests for Zone 3 styling, eyebrow badge, banded header, and flagged row accent rails.
- [x] `frontend/src/components/__tests__/ScreeningControlsBar.test.jsx` -- Add unit tests for Zone 2 eyebrow badge and surface styling.
- [x] `frontend/src/components/__tests__/ScanTab.test.jsx` -- Update and expand tests for 3-zone layout and non-nested workbench.

**Acceptance Criteria:**
- Given the main workspace in `ScanTab.jsx`, when rendered on screen, then the workspace is structured into three visually distinct functional zones separated by macro spacing (`space-y-8`):
  1. `Zone 1: Ingest & Discovery` (hero container with `bg-surface-elevated`, subtle violet accent rail `border-l-4 border-l-brand-primary`, and eyebrow badge `01 / SOURCE MUSIC`),
  2. `Zone 2: Screening Console` (sunken audio-hardware styling with `bg-surface-inset`, `border-border-strong`, and eyebrow badge `02 / SCREENING RULES`),
  3. `Zone 3: Track Workbench` (raised cutting table with `bg-surface-card`, `shadow-2xl`, and eyebrow badge `03 / TRACK WORKBENCH`).
- Given the Track Workbench containing staged tracks, when inspecting the layout structure, then the outer summary card and inner table workbench are merged into a single non-nested workbench container, eliminating card-in-a-card visual redundancy.
- Given tracks rendered in the workbench table and mobile cards, when a track is flagged (`is_flagged === true`), then the row/card displays a subtle rose accent rail (`border-l-2 border-l-status-flagged-border/60`), making explicit tracks visually identifiable at a glance.
- Given the desktop table view (`>= 768px`), when rendering table headers, then a dark banded header strip (`bg-surface-inset/80`) with uppercase, tracking-spaced mono labels clearly separates the column headers from track rows.

## Implementation Notes

- Updated `SmartInputBar.jsx` to Zone 1 hero container styling (`bg-surface-elevated`, `border-l-4 border-l-brand-primary`) with `01 / SOURCE MUSIC` eyebrow badge.
- Updated `ScreeningControlsBar.jsx` to Zone 2 sunken console styling (`bg-surface-inset`, `border-border-strong`) with `02 / SCREENING RULES` eyebrow badge.
- Updated `WorkingListWorkbench.jsx` to Zone 3 raised workbench styling (`bg-surface-card`, `shadow-2xl`) with `03 / TRACK WORKBENCH` eyebrow badge, banded desktop table header (`bg-surface-inset/80`), rose accent rail (`border-l-2 border-l-status-flagged-border/60`) on flagged rows, and integrated `headerActions` / `toolbar` slots so `ScanTab.jsx` renders a single non-nested workbench container.
- Updated `MobileTrackCard.jsx` to apply `border-l-2 border-l-status-flagged-border/60` on flagged mobile cards.
- Updated `ScanTab.jsx` root workspace spacing to `space-y-8`, removed the redundant outer `bg-slate-900` card wrapper around `WorkingListWorkbench`, and replaced legacy `slate-*` and Spotify green classes with Obsidian Audio Core tokens.

## Spec Change Log

## Review Triage Log

- **Verification Gap Reviewer (VG-1):** `medium` (`patch`) — `WorkingListWorkbench.jsx:53-55, 75, 108-112` & `ScanTab.jsx:793-900`: Filtered-out empty state (`tracks={[]}` with `totalTrackCount > 0` and `toolbar`) and `totalTrackCount` badge preservation are untested in `WorkingListWorkbench.test.jsx` and `ScanTab.test.jsx`.
- **Edge Case Hunter (EC-1):** `medium` (`patch`) — `WorkingListWorkbench.jsx:53-57`: Early return guard `if (validTracks.length === 0 && !effectiveTotalCount && !toolbar)` fails to return `null` when `toolbar` is passed while `effectiveTotalCount` is `0`, rendering `"No tracks match the selected filter."` on an empty list.
- **Edge Case Hunter (EC-2):** `low` (`patch`) — `WorkingListWorkbench.jsx:53`: `typeof totalTrackCount === 'number'` accepts `NaN` or negative numbers; tightening to `Number.isFinite(totalTrackCount) && totalTrackCount >= 0` on the same line prevents invalid badge counts.
- **Blind Hunter (BH-1):** `medium` (`patch`) — `ScreeningControlsBar.jsx:83-94`: `<div className="flex flex-col gap-1.5">` wraps only the `02 / SCREENING RULES` badge instead of both the badge and heading block, causing `sm:flex-row justify-between` to split the header into 3 horizontal columns on `sm+` screens.
- **Blind Hunter (BH-2):** `medium` (`patch`) — `WorkingListWorkbench.jsx:125, 159-169`: `divide-border-subtle/40` on `<tbody>` has higher CSS specificity than `border-l-status-flagged-border/60` on `<tr>`, and `border-collapse` tables can suppress `<tr>` left borders unless the first `<td>` also carries `border-l-2 border-l-status-flagged-border/60`.
- **Blind Hunter (BH-3):** `false` (rejected) — `WorkingListWorkbench.jsx:74-80` & `ScanTab.jsx:795-797`: Both `{effectiveTotalCount} / 50 tracks` and `{scannedTracks.length} tracks total` are explicitly asserted by existing regression tests (`WorkingListWorkbench.test.jsx:56` and `ScanTab.test.jsx:104`), and playlists are capped at 50 tracks per Epic 1 Story 1.2.
- **Blind Hunter (BH-4):** `medium` (`patch`, grouped with EC-1) — `WorkingListWorkbench.jsx:52-57`: Passing `toolbar` when `totalTrackCount === 0` bypasses the `null` guard and renders the empty filter message when no tracks are staged.
- **Blind Hunter (BH-5):** `medium` (`patch`, grouped with VG-1) — `WorkingListWorkbench.test.jsx` & `ScanTab.test.jsx`: Missing unit test coverage for the zero-match filtered state inside the de-nested workbench.
- **Blind Hunter (BH-6):** `low` (`patch`, grouped with BH-1) — `ScreeningControlsBar.jsx:81`: Root element is a `<div>` lacking a `<section aria-label="Screening Console">` region landmark, unlike Zone 1 and Zone 3.
- **Blind Hunter (BH-7):** `low` (rejected) — `ScanTab.jsx:719, 902-931`: Modals are closed (`null`) by default and pre-existed as direct children of `<div className="space-y-6">`; altering root container nesting would break `container.firstChild` test assertions.
- **Blind Hunter (BH-8):** `false` (rejected) — `ScanTab.jsx:805-806` & `WorkingListWorkbench.jsx:26-27`: `_keptTrackIds` and `_onKeepTrack` are pre-existing unused parameters in `WorkingListWorkbench.jsx` from before `baseline_commit` (the Keep action resides in `LyricsModal.jsx`).
- **Blind Hunter (BH-9):** `low` (rejected) — `ScanTab.jsx:818-821`: `hidden sm:flex` on the `{removedCount} Removed` badge is pre-existing responsive behavior from Epic 1; only color tokens changed in this diff.
- **Blind Hunter (BH-10):** `false` (rejected) — `sprint-status.yaml:82`: In `bmad-build`, `sprint-status.yaml` transitions from `in-progress` to `review` in Step 5 after Step 4 review completes, and the spec file exists on disk.

## Verification

**Commands:**
- `npm --prefix frontend test -- src/components/__tests__/WorkingListWorkbench.test.jsx src/components/__tests__/ScreeningControlsBar.test.jsx src/components/__tests__/ScanTab.test.jsx src/components/__tests__/SmartInputBar.test.jsx` -- expected: All targeted unit tests pass.
- `npm --prefix frontend run lint` -- expected: oxlint passes with 0 errors.
- `npm --prefix frontend run build` -- expected: Vite production bundle builds successfully.
- `$env:PYTHONPATH="backend"; .\.venv\Scripts\pytest.exe backend/app/tests/` -- expected: Backend tests pass with no regressions.
