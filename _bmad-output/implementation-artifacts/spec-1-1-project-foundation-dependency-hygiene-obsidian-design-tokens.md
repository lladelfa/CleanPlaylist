---
title: 'Story 1.1: Project Foundation, Dependency Hygiene & Obsidian Design Tokens'
type: 'feature'
created: '2026-11-06'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** CleanPlaylist requires a modern Python 3.13 serverless baseline, clean dependency synchronization without dead packages (`better-profanity`), and full Obsidian Audio Core design tokens in Tailwind CSS v4 alongside Google Fonts to prepare the UI for unified dark-mode studio workbenches.

**Approach:** Pin Python 3.13 in root `.python-version`, synchronize runtime packages in `requirements.txt` and `backend/requirements.txt` (pruning `better-profanity` and setting `pytest>=8.0.2`), remove dead profanity censor-word loading in `scanner_service.py`, embed Google Fonts (`Plus Jakarta Sans` and `JetBrains Mono`) in `frontend/index.html`, define all 30 Obsidian Audio Core design tokens in `frontend/src/index.css` under Tailwind CSS v4 `@theme`, and update `AGENTS.md` conventions and Windows `.vite-temp` workaround.

</frozen-after-approval>

## Implementation Notes

- Pinned Python version to 3.13 in `.python-version`.
- Synced `requirements.txt` and `backend/requirements.txt`, removing unused `better-profanity` and specifying `pytest>=8.0.2`.
- Removed `better_profanity` import and startup censor word loading in `backend/app/services/scanner_service.py`.
- Added unit tests in `backend/app/tests/test_foundation_hygiene.py` verifying python version pinning, requirements hygiene/sync, and profanity detection without `better_profanity`.
- Embedded Google Fonts (`Plus Jakarta Sans` and `JetBrains Mono`) and theme-color meta tag in `frontend/index.html`.
- Defined all 30 Obsidian Audio Core design tokens and `--font-sans` / `--font-mono` in `frontend/src/index.css` using Tailwind CSS v4 `@theme`.
- Added Vitest tests in `frontend/src/__tests__/designTokens.test.js` verifying Google Fonts and token declarations.
- Updated `AGENTS.md` to reflect Obsidian Audio Core tokens, dual Spotify client architecture, and the Windows `.vite-temp` workaround.
- Verified all 14 backend tests, 13 frontend tests, oxlint checks, and frontend production build pass.

## Review Triage Log

- `low` (patched): `test_scanner_service_no_better_profanity` only tested clean text — patched to also assert flagged text detection.
- `low` (patched): `_compile_patterns` return type annotation mismatch `List[re.Pattern]` — patched to `List[Tuple[str, re.Pattern]]`.
- `low` (deferred): `reasons.append("Marked Explicit by YouTube Music")` in `scanner_service.py` is platform-specific — deferred to Epic 2 cross-reference implementation.
- `low` (patched): Custom scrollbar in `index.css` used hex values instead of theme variables — patched to `var(--color-surface-*)`.
- `low` (deferred): `App.jsx` root element retains `bg-slate-950 text-slate-100` — deferred to Story 1.3 header & workbench re-skinning.
- `false`: `designTokens.test.js` uses static file reading — valid for unit-testing file configuration assets.
- `low` (deferred): `pytest-asyncio==0.23.5` exact pin in `backend/requirements.txt` — pre-existing and harmless, deferred.
- `false`: `test_requirements_hygiene_and_sync` asserts `r.startswith("pytest>=8.0.2")` — directly tests the acceptance criteria requirement.
- `low` (patched): `.python-version` lacked trailing newline — patched.
- `low` (patched): `frontend/index.html` lacked `<meta name="theme-color">` — patched with `#0C1324`.
