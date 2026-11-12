---
title: 'Story 6.3: Obsidian Design Token Hygiene & Safety Emerald Reservation'
type: 'feature'
created: '2026-11-12'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: e06d8ee5abf2d65532fc9862372624eb1962b6a3
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Inconsistent or non-semantic colors make platform actions and safety states difficult to distinguish, weakening the meaning of green as a verified-clean signal.

**Approach:** Use Obsidian semantic tokens consistently across the scan and stitch workspaces, keep platform/action chrome electric violet, and reserve emerald styling for verified-clean and clean-swap states.

## Boundaries & Constraints

**Always:**
- Use existing Tailwind v4 semantic tokens from `frontend/src/index.css`.
- Keep `brand-primary` electric violet for Spotify navigation and action chrome.
- Keep emerald only for verified-clean/swapped status, clean candidate previews, and clean-swap confirmation.
- Preserve functionality, accessibility, responsive layouts, and all existing platform/auth gates.

**Never:**
- Change scan, replacement, playlist, authentication, or platform-switch behavior.
- Use green for Spotify connection/navigation, generic success feedback, or ordinary action controls.
- Reintroduce hardcoded `slate-*` utilities or introduce colors outside the existing semantic palette.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|----------------------------|----------------|
| Verified clean status | Track is verified clean or clean-swapped | Status badge uses semantic `status-clean` tokens | N/A |
| Generic success | Playlist loaded, scan completed, copied, or saved | Feedback remains visible but does not use emerald | N/A |
| Spotify chrome | VIP Spotify connected; Browse Library or Save action shown | Platform/action styling uses electric violet or neutral surfaces, never emerald | N/A |
| Clean replacement action | Candidate has a verified clean version | Emerald is limited to the explicit clean-swap action and its confirmed result | N/A |

</frozen-after-approval>

## Code Map

- `frontend/src/index.css` -- Source of truth for `surface-*`, `brand-*`, and `status-*` colors; reuse these tokens rather than adding palette entries.
- `frontend/src/components/ScanTab.jsx`, `ScreeningControlsBar.jsx`, and `StitchTab.jsx` -- Workspace chrome, clean-state filtering/counts, bulk-clean action, and Spotify library/save controls. No production `slate-*` utilities remain in these views; preserve the existing responsive structure and action behavior.
- `frontend/src/components/GlobalHeader.jsx` and `SmartInputBar.jsx` -- Spotify connection indicator and library browsing entry points; the SmartInputBar browse control already uses brand tokens and should match the story's violet hover treatment.
- `frontend/src/components/VerificationStatusBadge.jsx`, `CleanReplacementControl.jsx`, and `LyricsModal.jsx` -- Safety-state and clean-swap treatments; use semantic clean tokens and preserve their emerald meaning.
- `frontend/src/components/NoticeBanner.jsx`, `FinishLineBar.jsx`, and `SavePlaylistModal.jsx` -- Generic success feedback currently shares green styling with clean states; separate generic success from explicit clean status.
- Existing focused tests: `components/__tests__/VerificationStatusBadge.test.jsx`, `NoticeBanner.test.jsx`, `GlobalHeader.test.jsx`, `ScreeningControlsBar.test.jsx`, `ScanTab.test.jsx`, `StitchTab.test.jsx`, `FinishLineBar.test.jsx`, and `SavePlaylistModal.test.jsx`.

## Tasks & Acceptance

**Execution:**
- [x] `frontend/src/components/GlobalHeader.jsx`, `SmartInputBar.jsx`, `ScanTab.jsx`, and `StitchTab.jsx` -- Keep the Spotify connection indicator non-green, style Browse Library with `text-brand-tint hover:bg-surface-elevated`, preserve the violet Save to Spotify action, and make selected clean filtering consistent with other selected controls.
- [x] `frontend/src/components/ScreeningControlsBar.jsx` and `StitchTab.jsx` -- Use violet for action buttons and valid semantic hover/status tokens; retain green only for clean-result metrics.
- [x] `frontend/src/components/VerificationStatusBadge.jsx`, `NoticeBanner.jsx`, `FinishLineBar.jsx`, and `SavePlaylistModal.jsx` -- Use semantic clean tokens for verified-safe states and non-green styling for generic success feedback.
- [x] Focused component tests -- Assert semantic clean tokens, non-green generic success/platform chrome, and preserved clean-swap styling.

**Acceptance Criteria:**
- Given Spotify platform controls are visible, when inspecting `Save to Spotify`, `Browse Library`, and `Spotify Connected`, then Save uses `bg-brand-primary hover:bg-brand-primary-hover text-white`, Browse Library uses `text-brand-tint hover:bg-surface-elevated`, and the connection indicator is not emerald.
- Given a verified-clean or clean-swapped track, when its status is displayed, then the semantic `status-clean` tokens identify it; clean-swap actions retain their approved emerald treatment.
- Given a generic success event such as playlist load, scan completion, copy, or save, when feedback is shown, then it does not use emerald.
- Given the Scan & Clean and Stitch Studio workspaces, when reviewing their semantic classes, then no hardcoded `slate-*`, undefined brand-hover, or undefined danger tokens remain in the affected styling.

## Implementation Notes

## Spec Change Log

## Review Triage Log

- **blind-hunter — low — patch:** The spec was `in-review` while `sprint-status.yaml` still showed `in-progress`, leaving the review queue status inconsistent; updated story 6.3 to `review`.
- **blind-hunter — false:** Recording command output in the spec is not required by the workflow; the verification section lists the required commands, and the requested results are reported to the user.
- **blind-hunter — false:** Violet for bulk/action controls is explicit in the execution task; the dedicated clean replacement control and confirmation retain semantic clean styling.
- **blind-hunter — low — patch:** The connection-indicator test only excluded the clean token and could miss other green classes; it now asserts `bg-brand-primary` and rejects emerald/clean classes.
- **blind-hunter — low — patch:** Generic-success tests did not cover all visible icon/surface styling; they now assert neutral success surfaces and icons as well as text.
- **blind-hunter — low — patch:** The single-track clean-swap confirmation had no assertion for its clean status classes; `CleanReplacementControl.test.jsx` now verifies them.
- **verification-gap — low — patch:** The same missing clean-swap confirmation assertion was independently identified; the test now verifies `bg-status-clean-bg`, `border-status-clean-border`, and `text-status-clean`.
- **blind-hunter — low — patch:** `NoticeBanner`'s type comment omitted supported values; it now documents the clean, flagged, and rate-limit variants.
- Edge-case hunter reported no findings.

## Design Notes

Treat generic success and verified-clean as different meanings: use the existing neutral surface treatment for generic success notices and reserve `status-clean` for explicitly clean results and clean-swap confirmation. Replace unsupported `bg-brand-hover` and `status-danger` references with existing `brand-primary-hover` and `status-flagged` tokens.

## Verification

**Commands:**
- `npm --prefix frontend test -- src/components/__tests__/VerificationStatusBadge.test.jsx src/components/__tests__/NoticeBanner.test.jsx src/components/__tests__/GlobalHeader.test.jsx src/components/__tests__/ScreeningControlsBar.test.jsx src/components/__tests__/ScanTab.test.jsx src/components/__tests__/StitchTab.test.jsx src/components/__tests__/FinishLineBar.test.jsx src/components/__tests__/SavePlaylistModal.test.jsx` -- expected: all targeted tests pass.
- `npm --prefix frontend run lint` -- expected: oxlint passes.
- `npm --prefix frontend run build` -- expected: Vite production build succeeds.
