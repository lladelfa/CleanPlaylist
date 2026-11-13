---
title: 'Story 7.4: Mobile Header Safe-Area Fix'
type: 'bugfix'
created: '2026-11-13'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** On notched or status-bar phones the sticky `GlobalHeader` renders under the status bar, so the title and `CatalogSelector` can be clipped. `frontend/index.html` lacks `viewport-fit=cover`, so `env(safe-area-inset-top)` resolves to `0`.

**Approach:** Add `viewport-fit=cover` to the viewport meta. Give the sticky `GlobalHeader` top padding of `env(safe-area-inset-top)` on top of its normal padding, keeping its existing 56px content row so the inset adds height rather than squeezing content. On mobile, raise the tab buttons to a 44px minimum touch target; keep the 40px height at `sm:` and up so desktop is unchanged. Inset is `0` on desktop.

**Acceptance criteria (from epics.md Story 7.4):**
- Given `frontend/index.html`, when the page loads on a notched device, then the viewport meta includes `viewport-fit=cover`, and the sticky header applies `env(safe-area-inset-top)` top padding.
- Given a 360px-wide viewport with a 24px inset, when the header renders, then the title, `CatalogSelector`, and icon buttons are fully visible with 44px minimum touch targets and zero horizontal overflow.
- Given desktop viewports, when the header renders, then the inset is `0` and the layout is unchanged.
- Given `npm --prefix frontend test`, then a React Testing Library test asserts the header carries the safe-area class.

**Boundaries:** No new dependencies; no `tailwind.config.js`; styling uses Tailwind v4 utilities and arbitrary values. Never change `FinishLineBar`, `Navbar`, or other components; never detect the inset in JavaScript.

</frozen-after-approval>

## Implementation Notes

- Files: `frontend/index.html` (viewport meta), `frontend/src/components/GlobalHeader.jsx` (safe-area padding, mobile tab height), `frontend/src/components/__tests__/GlobalHeader.test.jsx` (safe-area class assertion).
- `GlobalHeader` root `<header>` is `h-14`; with Tailwind preflight `border-box`, padding would shrink the content. Plan: `<header>` gets `pt-[env(safe-area-inset-top)]` and `h-auto`, with the inner row set to `h-14`.
- `Navbar.jsx` is a deprecated wrapper around `GlobalHeader`; it inherits the fix and is not edited.
- TDD: three new tests failed first (header safe-area class, 44px mobile tab height, `viewport-fit=cover` in `index.html`). Test setup fix: the `index.html` test reads `index.html` via `process.cwd()`, since `import.meta.url` is not a `file:` URL under jsdom.
- Changes: `index.html` viewport meta gains `viewport-fit=cover`; `GlobalHeader` root is `h-auto pt-[env(safe-area-inset-top)]` with the inner row at `h-14`; tab buttons are `min-h-[44px] sm:min-h-[40px]`.
- Verification: `npm --prefix frontend test` 378/378 passing across 34 files; `npm --prefix frontend run lint` exits 0 (5 pre-existing `set-state-in-effect` warnings in other files); `npm --prefix frontend run build` succeeds.
- Not verified: the 360px / 24px-inset visual check and before/after screenshots called for in the story's Dev Notes. No browser run was done, so zero horizontal overflow is untested.
- Review: no reviewer subagents launched (none requested). Inline self-review of the three-file diff found no issues.

## Review Triage Log

- Inline self-review, no findings. Nothing deferred.
