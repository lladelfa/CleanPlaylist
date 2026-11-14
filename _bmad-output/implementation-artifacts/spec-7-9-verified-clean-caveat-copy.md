---
title: 'Story 7.9: "Verified Clean" Caveat Copy'
type: 'feature'
created: '2026-11-13'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** "Verified Clean" can read as a guarantee, but it only reflects the lyrics found and the selected preset.

**Approach:** Per epics.md Story 7.9: caveat on the badge (title + sr-only `aria-describedby`, focusable), a caveat line in the lyrics modal for verified-clean tracks, and a dismissible info note near results (session-only via a `sessionStorage` boolean). Badge label, finish-line surfaces and emerald usage unchanged.

**Boundaries:** No change to verdicts, payloads, or finish-line copy.

</frozen-after-approval>

## Implementation Notes

- Shared copy and `isVerifiedCleanTrack` in `frontend/src/utils/verifiedCleanCaveat.js`.
- `VerificationStatusBadge`: sr-only span adds no row height; `tabIndex=0` makes it focusable on desktop and mobile. `NoticeBanner` gained a `dismissLabel` prop. The results note uses the neutral `info` style, not emerald.
- Tests written red first (badge, modal, ScanTab note and dismissal). Frontend 402 pass; lint existing warnings only; build passes.

## Review Triage Log

- Inline self-review, no findings. Nothing deferred.
