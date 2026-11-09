---
title: 'Story 1.7: Zero-Horizontal-Scroll Responsive Table Layout for Working List Workbench'
type: 'feature'
created: '2026-11-08'
status: 'done'
baseline_commit: '7502619f8a7e68a8497977ea1de573a448bb2501'
route: 'dispatch'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** When users load an album or playlist on medium-sized screens (768px–1023px, tablets, split-screen windows) or when tracks have long titles, multi-featured artist strings, or multiple flagged reason chips, the `WorkingListWorkbench` table expands past its container and forces an unwanted horizontal scrollbar. This degrades UX, hides key action buttons (Find Clean, Swap, Remove), and breaks the screening workflow.

**Approach:** Implement Fix A + B:
1. Enforce `table-fixed w-full` layout on the desktop table with proportional, constrained column widths so text truncation (`truncate`) actually functions in CSS without cell blowout.
2. Responsively fold the standalone `Album` column on medium screens (`hidden lg:table-cell`) by displaying the album name under the artist line in the `Title & Artist` column below 1024px, restoring the dedicated column at `lg` (>= 1024px).
3. Ensure zero horizontal scrollbars or overflow across all viewports (mobile < 768px, tablet 768px–1023px, desktop >= 1024px) while preserving all 6 semantic table column headers for accessibility and test suites.

## Boundaries & Constraints

**Always:**
- Keep the table width strictly locked to 100% of its parent container (`w-full table-fixed`) with zero horizontal overflow (`overflow-x-hidden` / no scrollbars induced).
- Maintain all 6 semantic `<th>` column headers in the table DOM (`#`, `Title & Artist`, `Album`, `Duration`, `Status`, `Actions`) to preserve screen reader accessibility and existing test contracts.
- Responsively hide the standalone `Album` column (`<th>` and `<td>`) below `lg` (`hidden lg:table-cell`).
- When the standalone `Album` column is hidden (< 1024px), display the album name as a secondary subtitle under the artist in the `Title & Artist` column (`block lg:hidden text-text-muted/80 truncate text-[10px]`).
- Ensure track titles, artist names, album names, lyric snippets, and flagged reason lists reliably truncate with an ellipsis (`truncate`) rather than stretching table cells.
- Preserve all existing button labels, icons, tooltips, and `aria-label`s on action buttons (`aria-label="Remove track"`, `aria-label="View lyrics"`, `aria-label="Open track link"`, etc.).
- Maintain minimum 44px touch targets on mobile view (`< 768px`).

**Never:**
- Never let long track titles, artist lists, album names, or flagged reasons cause horizontal scrollbars on desktop or tablet viewports.
- Never drop or remove action buttons or status badges from the DOM.
- Never regress mobile card view (`MobileTrackCard`) below 768px.
- Never break existing Vitest test queries (e.g. `getAllByRole('columnheader')` expecting 6 headers).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Medium Viewport (768px – 1023px) | Screen width e.g. 800px or 900px with staged tracks | Table fits container 100% with no horizontal scrollbar; Album column header & cell hidden; album name rendered below artist in col 2 | Truncates long strings smoothly |
| Full Desktop Viewport (>= 1024px) | Screen width >= 1024px | Table displays all 6 columns including dedicated Album column; no horizontal scrollbar | Truncates within designated column bounds |
| Ultra-Long Track Title | Track title > 80 chars (e.g. classical piece or remix with 5 artists) | Title truncates with ellipsis inside Title & Artist cell; does not expand column width | `truncate min-w-0` on container and paragraph |
| Multi-Reason Flagged Track | Track with 6+ flagged words/reasons joined by bullet | Reason preview button truncates with ellipsis; lyric inspection modal remains accessible on click | Keeps row height compact, single line |
| Missing Album or Thumbnail | Track object with `album: ""` or `thumbnail: ""` | Renders placeholder or falls back cleanly without layout shift | No NaN or undefined text |
| Mobile Viewport (< 768px) | Screen width < 768px | Stacked `MobileTrackCard` components render with >= 44px touch targets; zero page overflow down to 360px | Unaltered mobile card contract |

</frozen-after-approval>

## Code Map

- `frontend/src/components/WorkingListWorkbench.jsx`:
  - Update `table` element with `table-fixed w-full`.
  - Adjust `thead` `th` widths and responsive classes (e.g., `#`: `w-10`, `Title & Artist`: `w-[38%] lg:w-[32%]`, `Album`: `w-[20%] hidden lg:table-cell`, `Duration`: `w-16`, `Status`: `w-[24%] lg:w-[18%]`, `Actions`: `w-[22%] lg:w-[16%]`).
  - Update `Title & Artist` cell to include responsive album subtitle below artist (`<p className="block lg:hidden text-text-muted/80 truncate text-[10px]">{track.album}</p>`).
  - Update `Album` `td` with `hidden lg:table-cell`.
  - Ensure parent wrapper prevents spurious horizontal scroll.
- `frontend/src/components/__tests__/WorkingListWorkbench.test.jsx`:
  - Add test verifying `table-fixed` class and responsive album folding at medium viewports.
  - Verify all 6 column headers remain in the DOM.
  - Verify ultra-long title track rendering without overflowing table layout.

## Tasks & Acceptance

**Execution:**
- [x] `frontend/src/components/WorkingListWorkbench.jsx` -- Apply `table-fixed`, proportional column widths, and responsive `Album` folding -- Eliminates horizontal scrollbar across all desktop/tablet screen sizes.
- [x] `frontend/src/components/WorkingListWorkbench.jsx` -- Add mid-screen album subtitle under artist -- Preserves album context when standalone column is hidden below 1024px.
- [x] `frontend/src/components/__tests__/WorkingListWorkbench.test.jsx` -- Add unit tests for zero horizontal scroll, `table-fixed`, and responsive album display -- Verifies all acceptance criteria and protects against layout regression.

**Acceptance Criteria:**
- Given `WorkingListWorkbench` rendered with any number of staged tracks (including tracks with ultra-long titles or multiple flagged reasons), when viewed on any viewport >= 768px (from 768px up to 4K), then the table fits 100% of its parent container with zero horizontal scrolling or container overflow.
- Given a medium viewport between 768px and 1023px, the standalone Album column is hidden (`hidden lg:table-cell`) while the album name is visible below the artist in the Title & Artist column.
- Given a full desktop viewport >= 1024px, the dedicated Album column is displayed.
- Given existing test suite `npm --prefix frontend test`, all existing and new unit tests pass with 0 failures.

## Review Triage Log

| # | Finding | Layer | Verdict | Route | Disposition / Evidence |
|---|---|---|---|---|---|
| 1 | Corrupted escape sequences in `epics.md` story specification (`\table-fixed`, `\truncate`, `\aria-label`) | Blind Hunter | `low` | `patch` | Verified string generation artifact in planning doc. Fixed by replacing with markdown backticks. |
| 2 | `overflow-x-hidden` on desktop table wrapper risks clipping interactive action controls | Blind Hunter | `low` | `patch` | Verified table-fixed ensures 100% width, but combined with finding 4, Actions column width was tuned to prevent button overflow. |
| 3 | Column width percentages do not total 100% in `table-fixed` mode | Blind Hunter | `low` | `patch` | Verified fixed columns (#, Duration) pair cleanly with flexible Title & Artist column and balanced proportional columns. |
| 4 | Potential button overflow in Actions column on medium screens (768px) | Blind Hunter | `medium` | `patch` | Usable width at 768px was ~149px while 4 simultaneous buttons required ~164px. Patched by expanding Actions column to `w-[26%] lg:w-[16%]` (~190px usable) and `flex-nowrap min-w-0`. |
| 5 | Missing tooltip (`title`) fallback for truncated track title and artist | Blind Hunter | `low` | `patch` | Verified users could not read truncated names on hover. Patched with `title` attributes on title, artist, and album. |
| 6 | Flex child truncation risk in lyric snippet button | Blind Hunter | `low` | `patch` | Patched with `min-w-0` on inner flex containers. |
| 7 | Missing test for 4 simultaneous action buttons fit | Blind Hunter | `low` | `patch` | Patched by adding explicit test for simultaneous action buttons rendering without wrapping. |

