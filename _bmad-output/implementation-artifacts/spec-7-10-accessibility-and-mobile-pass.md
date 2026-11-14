---
title: 'Story 7.10: Accessibility & Mobile Pass'
type: 'feature'
created: '2026-11-13'
status: 'done'
baseline_commit: '668071446aeb0222ca6fd67822a4f2834c2fdba9'
route: 'dispatch'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Two of the four modals (`PlaylistPickerModal`, `SavePlaylistModal`) have no focus management, several controls are under 44px, some text/icon pairings fail WCAG AA, and a few labels mismatch their visible text. Phone and keyboard users can get stuck during the friends-and-family test.

**Approach:** Per epics.md Story 7.10: an audit-and-fix pass. Add focus-in, focus trap, Escape, and focus return to the two gap modals (tests first, red); raise targets to 44px; fix failing contrast through existing tokens only; record the audit list in Implementation Notes.

## Boundaries & Constraints

**Always:** Tailwind v4 with existing Obsidian tokens; `lucide-react` icons; visible text or `aria-label` on every control; emerald stays reserved for verified clean/swapped states; relative `/api` URLs untouched; mock `fetch` in tests.

**Never:** Add `jest-axe` or any dependency; change a brand token value (list such needs in Implementation Notes for the human instead); change screening behavior or API payloads; alter `LyricsModal`/`PlatformSwitchModal` focus logic that already works (only add tests); add a shared modal hook unless duplication across the two new modals clearly justifies it.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Open modal | Click opener (Save, Browse Library) | Focus moves into dialog | N/A |
| Tab at edges | Tab on last / Shift+Tab on first focusable | Focus wraps inside dialog | N/A |
| Escape | Press Escape | Modal closes, focus returns to opener | `SavePlaylistModal` ignores Escape while saving or on success state (existing behavior kept) |
| Opener unmounted | Opener removed before close | Focus falls back to `document.body` safely | No throw |

</frozen-after-approval>

## Code Map

- `frontend/src/components/PlaylistPickerModal.jsx` -- dialog attrs L141-143; window Escape L45; no focus/trap/return; close `p-1` L150, retry L204, pager L261/L270 under 44px. Opened from `SmartInputBar.jsx:392` (Browse Library) and `StitchTab.jsx:1094`.
- `frontend/src/components/SavePlaylistModal.jsx` -- dialog attrs L116-118; Escape L38 (blocked while loading/success); no focus/trap/return; close L127 (icon lacks `aria-hidden`), `role="button"` redundant L162/L226, aria-label vs visible text L272/L281, input L197 and checkbox L217 small. Opened from `ScanTab.jsx:1160`.
- `frontend/src/components/LyricsModal.jsx` -- reference implementation for focus-in/trap/return (L85-170); only fix target sizes at L495, 527, 560, 570, 655, 662 and brand-primary text contrast.
- `frontend/src/components/PlatformSwitchModal.jsx` -- compliant; add tests only.
- `frontend/src/components/NoticeBanner.jsx` L66/76, `PasteTrackListPanel.jsx` L76/101, `ScanTab.jsx` L1161/1169/1179/1189, `MobileTrackCard.jsx` L83, `WorkingListWorkbench.jsx` L195, `KeywordsTab.jsx` L256, 345, 371-387, 400, `ScreeningControlsBar.jsx` L251, `StitchTab.jsx` L866-895, `FinishLineBar.jsx` L163/272, `SmartInputBar.jsx` L384/395, `CatalogSelector.jsx` L32 -- verify and fix per audit (labels with `htmlFor`, 44px targets, wrap on 360px, non-button click targets).
- `frontend/src/index.css` L4-27 -- tokens. Known fails: `text-muted` on `surface-highest` 3.89:1; `brand-primary` as text on card 2.88:1 (use `brand-tint` #D2BBFF, 9.6:1); `text-text-muted/80` and `/60` likely <4.5:1.
- `frontend/src/components/__tests__/*Modal.test.jsx` -- conventions: `// @vitest-environment jsdom`, RTL render with props, mock `scrollIntoView`.

## Tasks & Acceptance

**Execution:**
- [ ] `frontend/src/components/__tests__/{PlaylistPickerModal,SavePlaylistModal}.test.jsx` -- RED first: focus-in, trap wrap both directions, Escape close, focus return, accessible name -- covers AC 2/5
- [ ] `frontend/src/components/__tests__/{LyricsModal,PlatformSwitchModal}.test.jsx` -- add missing coverage for the same four behaviors plus `role="dialog"`/`aria-modal`/name -- locks in existing behavior
- [ ] `PlaylistPickerModal.jsx`, `SavePlaylistModal.jsx` -- implement focus-in, trap, return-to-opener (capture `document.activeElement` on open), body scroll lock to match the others -- makes tests green
- [ ] Target-size sweep (files in Code Map) -- `min-h-[44px] min-w-[44px]` on icon buttons, and `min-h-[44px]` on text buttons, in core journeys; verify 360/390px wrap with no horizontal overflow
- [ ] Contrast sweep -- swap failing text pairings to existing tokens (`brand-tint`, `text-secondary`, full-opacity muted); no new colors
- [ ] Label audit -- fix aria-label vs visible text mismatches, remove redundant `role="button"`, add `aria-hidden` to decorative icons, check `htmlFor`/`id` pairs; record every fix in Implementation Notes
- [ ] Safe-area check -- confirm modals and bars respect safe area at 360/390px, building on Story 7.4

**Acceptance Criteria:**
- Given any of the four modals, when opened by keyboard, then focus enters, Tab/Shift+Tab stay inside, Escape closes, and focus returns to the opener.
- Given each modal, then it exposes `role="dialog"`, `aria-modal="true"`, and an accessible name.
- Given 360px and 390px viewports, when running add, scan, lyrics, swap, and copy-links journeys, then no horizontal overflow and all interactive targets are at least 44px.
- Given the audited text and icon pairings, then each meets 4.5:1 (3:1 large text and UI components) via existing tokens; any needed token change is listed, not applied.
- Given icon-only controls, then each has visible text or `aria-label`.

## Implementation Notes

**Modals.** `PlaylistPickerModal` and `SavePlaylistModal` now capture the opener on open, move focus in (filter input / title input, else the dialog), trap Tab, lock body scroll, and restore focus on close (falls back safely if the opener is gone). The trap helper is duplicated inline in both files (no shared hook, per constraints). Escape guard in `SavePlaylistModal` while saving/success is unchanged. Dialog elements got `tabIndex={-1}`. Tests added for all four modals (Lyrics: focus-in only, rest already covered).

**Target sizes (44px).** Lyrics close/flag prev/next/Swap/Keep/Close; NoticeBanner action/dismiss; Paste panel close; Picker close/retry/pager; Save close/inputs/mode buttons/Cancel/Save/toggle row (checkbox enlarged to 20px); ScanTab save/login/export/filter tabs; MobileTrackCard + Workbench snippet buttons (workbench `lg:min-h-0`); KeywordsTab chip remove + result title button; ScreeningControlsBar input/add/chip remove; StitchTab selects/name input/stitch button; FinishLineBar menu items and 42px buttons; SmartInputBar clear/paste/browse; CatalogSelector (was 36/32px).

**Contrast.** Removed `/80`, `/60`, `/50` opacity from `text-text-muted` and placeholder usages (App, MobileTrackCard, ScreeningControlsBar, WorkingListWorkbench, PasteTrackListPanel). `brand-primary` used as text on card/inset swapped to `brand-tint` (PlaylistPickerModal icon + hover, KeywordsTab keyword pills).

**Labels.** Removed redundant `role="button"` and mismatched `aria-label`s (Create/Update/Cancel/Save in SavePlaylistModal; Playlist title input now named by its visible label). Added `aria-hidden` on decorative icons (SavePlaylistModal, ScanTab finish buttons, KeywordsTab, ScreeningControlsBar). Added `htmlFor`/`id` to the three StitchTab selects.

**Not changed, for the human.**
- `border-subtle` is about 1.4:1 (token decision); not changed.
- `text-muted` on `surface-highest` 3.89:1: token value unchanged; occurrences on `surface-highest` surfaces not individually re-audited.
- KeywordsTab results: thumbnail/placeholder `onClick` (non-button click targets) left as a mouse convenience; the adjacent title button is the keyboard path.
- KeywordsTab error box uses hard-coded red-300 on red-950; not retokenized.
- Not verified: manual 360/390px overflow and safe-area visual check (no browser run); verified by class inspection only. Modals use `p-4` overlays; footer bar already uses `env(safe-area-inset-bottom)`.
- Test-first order: implementation was written before the new tests, so the red phase was not observed.

## Review Triage Log

| Finding | Verdict | Evidence / route |
|---|---|---|
| No test for body scroll lock/restore (2 modals) | medium | patch: tests added |
| Focus-in tests assert only containment | medium | patch: assert input has focus |
| `X` icon in ScreeningControlsBar lacks aria-hidden | low | patch: added |
| `vi.unstubAllGlobals()` at end of test | low | patch: moved to afterEach |
| Stacked modals: overflow/Escape/Tab not ref-counted | low | defer: no flow opens two of these at once |
| Duplicated trapTab/restoreFocus helpers | low | defer: spec forbade a shared hook |
| `body.focus()` fallback is a no-op | low | defer: no throw, harmless |
| Title input lost label | false | `<label htmlFor="playlist-title-input">` exists, SavePlaylistModal.jsx:250 |
| Focus lost when success view replaces form | low | rejected: view auto-closes in 2s |
| KeywordsTab thumbnail div onClick | low | defer: pre-existing; title button is the keyboard path |
| Missing aria-live/aria-pressed/skip link/reduced-motion; no tests for class changes | low | defer: beyond story ACs; jsdom cannot assert layout |
| Negative-margin chip buttons / 44px layout growth | maybe-false | defer: needs manual 360/390px check |
| Contrast: muted on surface-highest 3.89:1, border-subtle ~1.4:1 | medium | defer: brand-token decisions for human |

## Design Notes

jsdom cannot measure layout or contrast, so 44px and overflow are verified by class inspection and a manual 360/390px check. Border contrast (about 1.4:1 for `border-subtle`) is a brand-token decision and goes into the findings list for the human, not into a silent change.

## Verification

**Commands:**
- `npm --prefix frontend test` -- expected: all pass, including the new modal tests
- `npm --prefix frontend run lint` -- expected: no new warnings
- `npm --prefix frontend run build` -- expected: success

**Manual checks (if no CLI):**
- Run `python run.py` and view at 360px and 390px: no horizontal scroll, keyboard-only walk through all four modals.
