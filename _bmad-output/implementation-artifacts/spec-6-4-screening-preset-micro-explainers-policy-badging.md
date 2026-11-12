---
title: 'Story 6.4: Screening Preset Micro-Explainers & Policy Badging'
type: 'feature'
created: '2026-11-12'
status: 'done'
route: 'dispatch'
review_loop_iteration: 1
baseline_commit: 75c0c4e9882bd833a1333b2e45445b0f87d7f69f
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The four sensitivity preset pills in `ScreeningControlsBar` show only a label, so parents and DJs must guess what each threshold actually flags.

**Approach:** Give every preset pill an accessible criteria description, render a compact always-visible active-policy indicator under the pills that names the selected preset and its criteria summary, and politely announce the new threshold to assistive tech when the user changes preset while tracks are staged.

**Decisions (micro-copy — must describe actual engine behavior; revised after review pass 1):**
- `Kid Safe`: "Strictest: flags slurs, all profanity, sexual terms, and drug references, plus tracks tagged explicit."
- `Moderate`: "Radio-edit rules: flags slurs, strong profanity, and sexual terms, plus tracks tagged explicit; allows mild words like damn/hell."
- `Slurs Only`: "Flags only slurs and hate speech; allows other explicit lyrics and ignores explicit tags."
- `Custom`: "Slurs and strong profanity, plus tracks tagged explicit."
- The active-policy indicator also shows the constant line: "Your blocklist words are flagged under every preset."
- Unknown preset ids resolve to **Moderate** (matching `lyricEvaluator.js` fallback), and the resolved preset's pill is the one shown `aria-pressed="true"`.

## Boundaries & Constraints

**Always:** Micro-copy is reachable without hover (touch and screen readers): each pill references its description via `aria-describedby`, and the active indicator is visible text. Keep `aria-pressed` pills, the existing `onSelectPreset`/`setPreset` callback contract, disabled states, and 44px touch targets. Use Obsidian tokens (`brand-*`, `surface-*`, `text-*`, `border-*`); the indicator is policy chrome, not a clean state, so it never uses `status-clean` emerald.

**Never:** No backend, `/api/presets`, `lyricEvaluator.js`, or preset-rule changes. No new tooltip/popover dependency. No visible `NoticeBanner` on preset change (the indicator plus live region is the confirmation). Do not announce on initial mount.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Initial render | `preset="moderate"` | Indicator reads "Active policy: Moderate" + Moderate summary; live region empty | N/A |
| Preset change | user clicks Kid Safe, parent rerenders `preset="kid_safe"` | Indicator shows Kid Safe summary; live region announces "Active threshold: Kid Safe — <summary>" | N/A |
| Unknown preset id | `preset="legacy_x"` | Indicator shows Moderate label/summary and the Moderate pill is `aria-pressed="true"`, no crash | Fallback |
| Blocklist note | any preset | Indicator includes "Your blocklist words are flagged under every preset." | N/A |
| Pill description | any pill | pill's accessible description equals its micro-copy | N/A |

</frozen-after-approval>

## Code Map

- `frontend/src/components/ScreeningControlsBar.jsx` -- Only production file to change. `PRESETS` array (lines 5–10) gains a `summary` per id; pills rendered in the `role="group" aria-label="Sensitivity Presets"` block (~136–156). Existing `role="status"` sr-only region (~161–168) is for scan/bulk progress — do not repurpose it; add a separate policy live region. Already receives `preset` as a controlled prop from `ScanTab.jsx`.
- `frontend/src/components/ScanTab.jsx:1050` -- Renders `ScreeningControlsBar` only when `currentTracks.length > 0`, so "tracks are staged" is guaranteed whenever the bar exists; no change needed here.
- `frontend/src/components/__tests__/ScreeningControlsBar.test.jsx` -- Extend; existing tests query pills via `getByRole('button', { name: /kid safe/i })` — accessible names must stay the labels (put copy in description, not name).
- `backend/app/config.py` `PRESET_PROFILES` / `lyricEvaluator.js` `DEFAULT_PRESETS` -- Reference only for what each preset truly flags; their `description` strings are not shown in UI and stay untouched.

## Tasks & Acceptance

**Execution:**
- [x] `frontend/src/components/__tests__/ScreeningControlsBar.test.jsx` -- Write failing tests first for every I/O matrix row: per-pill accessible description (`toHaveAccessibleDescription`), indicator text for initial and changed preset via `rerender`, empty live region on mount then announcement after rerender, unknown-id fallback to Moderate with Moderate pill pressed, blocklist note, and indicator not using `status-clean`/emerald classes. Because jsdom applies no Tailwind CSS, also assert the indicator and its descendants carry no `sr-only`/`hidden`/`invisible` classes. In the preset-change test use one `onSelectPreset` mock and assert `toHaveBeenCalledWith('kid_safe')`.
- [x] `frontend/src/components/ScreeningControlsBar.jsx` -- Add `summary` to `PRESETS`; resolve the active preset with a Moderate fallback and derive pill `aria-pressed` from the resolved id; render sr-only description elements (sibling container, ids from `useId()`) and wire `aria-describedby` + `title` on each pill (accessible name stays the label); add compact visible indicator (lucide icon + "Active policy: {label}" + summary + blocklist note) below the pills; add an `aria-live="polite" aria-atomic="true"` sr-only region (no `role="status"` — a second status role breaks existing `getByRole('status')` queries in `ScreeningControlsBar.test.jsx` and `ScanTab.test.jsx`) populated only after `preset` changes from its last-seen value (ref).

**Acceptance Criteria:**
- Given the Screening Console on a 375px viewport, when rendered, then the indicator wraps without horizontal overflow and pills keep min 44px height.
- Given the existing ScreeningControlsBar test suite, when run, then all prior tests still pass unchanged.

## Implementation Notes

- (Pass 1, reverted) Policy live region used `aria-live="polite" aria-atomic="true"` without `role="status"`; pill descriptions lived in a sibling `sr-only` container; pills gained `min-h-[44px]`; indicator used `flex items-start` + `break-words`/`min-w-0` to wrap at 375px. All worked and passed the full suite.
- (Pass 2) `resolvePreset()` with `FALLBACK_PRESET_ID = 'moderate'` drives indicator, `aria-pressed`, and the ref-gated announcement (keyed on resolved id, so unknown→moderate stays silent); `BLOCKLIST_NOTE` constant in indicator; pills keep label as accessible name with `aria-describedby` + `title`. Verified: 27/27 component tests, 357/357 full suite, lint (no new warnings), build.

## Spec Change Log

- **Review pass 1 → intent_gap.** Trigger: reviewers verified the approved micro-copy misdescribed engine rules (Moderate/Kid Safe/Custom omitted categories and explicit-tag flagging; Custom implied blocklist was Custom-only) and the Custom fallback contradicted the engine's Moderate fallback. Amended (human-approved 1a/2a): frozen Decisions copy, blocklist note, Moderate fallback with pressed pill; matrix rows; tasks now carry the two patch findings (Tailwind-visibility assertion, asserted click mock) and the no-`role="status"` rationale. Avoids: shipping UI copy that tells parents a preset is looser than it is. KEEP: sibling sr-only descriptions + `useId()`; live region without `role="status"`; ref-gated announcement; `min-h-[44px]` pills; wrapping indicator classes; existing tests untouched.

## Review Triage Log

Pass 1 (iteration 0 → 1). Route: **intent_gap** loopback — code reverted; frozen micro-copy and fallback need human re-decision.

| # | Layer | Finding | Verdict | Evidence / route |
|---|-------|---------|---------|------------------|
| 1 | blind, edge | Moderate copy omits `sexual` category and explicit-tag flagging | medium | `lyricEvaluator.js:24,23` moderate = slurs, strong_profanity, sexual + `include_metadata_explicit: true`. Root in frozen Decisions → intent_gap |
| 2 | blind, edge | Kid Safe copy omits slurs and explicit tags; calls explicit sexual terms "innuendo" | medium | `lyricEvaluator.js:16-17,55-57` (blowjob, dildo, penis…). Frozen → intent_gap |
| 3 | blind, edge | Custom copy implies blocklist is Custom-only; omits explicit tags | medium | `lyricEvaluator.js:154-165` compiles blocklist under every preset; custom `include_metadata_explicit: true`. Frozen → intent_gap |
| 4 | edge | Unknown preset falls back to Custom in UI but Moderate in engine | low | `lyricEvaluator.js:107,273` fall back to `presets.moderate`; frozen matrix row says Custom. Unreachable today (preset only set from pill ids, no persistence) but frozen → intent_gap |
| 5 | blind, edge | Unknown id: no pill `aria-pressed` while indicator names a preset | low | `isActive = preset === p.id` ignores fallback. Same root as #4 → folded into intent_gap |
| 6 | edge | Hardcoded copy can drift from `presetsData` rules | maybe-false | `/api/presets` returns `PRESET_PROFILES`, identical categories today; drift only if server rules change. Same root as #1–3 |
| 7 | verification-gap | `toBeVisible()` cannot catch Tailwind `sr-only`/`hidden` on indicator in jsdom | low | Pre-verified; `vite.config.js` jsdom w/o CSS. patch — carry into re-implementation |
| 8 | blind | Preset-change test clicks an unasserted inline mock | low | Test L289-290: click result never asserted. patch — carry into re-implementation |
| 9 | edge | Announces programmatic (non-user) preset changes | false | Only setters are pill clicks (`ScanTab.jsx:925`, `ScreeningControlsBar` handler); no reset/restore path exists |
| 10 | edge, verif | legacy_x → custom announces with no visible change | low | Reachable only via unknown id (#4); rejected as unlikely, fix adds branching |
| 11 | blind, verif | Spec `in-review` vs sprint `in-progress` | false | Workflow moves sprint to `review` at step-05; transient by design |
| 12 | edge | No `role="status"` on policy region | false | Deliberate, documented in Implementation Notes; `aria-live="polite"` announces identically |
| 13 | blind | No test for `useId()` multi-instance uniqueness | low | Rejected: single instance in app; adds test surface for an unlikely case |
| 14 | blind | 375px/44px AC unverifiable in jsdom | low | Real; rejected as code finding — handled as manual check at present step |
| 15 | blind | Live region retains last text; remount re-arms | false | Retained text is inert (aria-live only fires on change); remount reset is intended |

Pass 2 (iteration 1). Route: no loopback — no intent_gap/bad_spec/patch survivors; 3 entries deferred.

| # | Layer | Finding | Verdict | Evidence / route |
|---|-------|---------|---------|------------------|
| 16 | blind, edge | Hardcoded copy can drift from `presetsData` / `PRESET_PROFILES` rules; no contract test | maybe-false | carried #6: `/api/presets` categories identical to `lyricEvaluator.js` today; would be medium if server rules diverge → defer (unverified) |
| 17 | blind | Custom summary lacks a verb and doesn't say what is "custom" | low | Accurate per engine; wording is human-approved frozen copy — rejected (fix edits spec) |
| 18 | blind | "Custom" preset name is misleading: blocklist applies under every preset, so Custom is just a fixed slurs+strong-profanity set | medium | Pre-existing product semantics (`lyricEvaluator.js:154-165`, `config.py` custom), not caused by this story → defer |
| 19 | blind | Copy implies lyrics are always checked; Slurs Only flags nothing when lyrics missing | low | Per-track `lyrics_unavailable` badge (`VerificationStatusBadge.jsx:30`) already signals it; qualifier would edit frozen copy — rejected |
| 20 | blind | Implementation Notes describe only the reverted pass | low | Real; agent-owned notes updated at present step, not a code finding |
| 21 | blind | Spec `in-review` vs sprint `in-progress` | false | carried #11: sprint moves to `review` at step-05 by design |
| 22 | blind | Story 6-3 still `review` in sprint-status though PR #70 merged | low | Pre-existing tracking drift, not caused by this story → defer |
| 23 | blind | 375px/44px AC has no recorded evidence; md column may crowd actions | low | carried #14 (manual check at present). Crowding: presets column is a shrinkable flex item with wrapping text and actions are `shrink-0`+`flex-wrap`, so no overflow — folded into manual check |
| 24 | blind | Missing tests: legacy_x→moderate silent, A→B→A, remount silent | low | Code compares resolved ids and ref initializes to current preset on mount; unlikely regressions, fix adds tests — rejected |
| 25 | blind | No test for descriptions on disabled pills; no "locked" signal | false | `disabled` does not remove `aria-describedby` from the accessible description; disabled pills already render at 50% opacity |
| 26 | blind | Unchanged-preset test passes for a never-announce implementation | false | The preset-change test fails for such an implementation, so the suite catches it |
| 27 | blind | `title` duplicates `aria-describedby` and visible indicator | low | Accessible-description computation prefers `aria-describedby` over `title` (no double read); tooltip echo is cosmetic — rejected |
| 28 | verification-gap | No verification gaps | — | Layer reported none |

## Design Notes

Hover-only tooltips fail on touch and for keyboard users, so the visible indicator carries the AC's "inspect" path and `title` is only a desktop nicety. Announcement is gated by a `useRef` holding the last-seen preset so remounts and the first render stay silent.

## Verification

**Commands:**
- `npm --prefix frontend test -- ScreeningControlsBar` -- expected: all tests pass
- `npm --prefix frontend test` -- expected: full suite green
- `npm --prefix frontend run lint` -- expected: no oxlint errors
- `npm --prefix frontend run build` -- expected: build succeeds
