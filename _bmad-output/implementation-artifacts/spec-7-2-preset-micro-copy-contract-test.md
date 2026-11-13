---
title: 'Preset Micro-Copy Contract Test'
type: 'chore'
created: '2026-11-12'
status: 'done'
baseline_commit: '187cda5f76781d2aa67954628bb1163642d7fa01'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-7-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The screening preset micro-copy in `ScreeningControlsBar.jsx` is hand-written and separate from the real preset rules in `DEFAULT_PRESET_PROFILES` (`lyricEvaluator.js`) and `PRESET_PROFILES` (`config.py`). Nothing fails if a rule's categories or `include_metadata_explicit` flag change without a copy change, so the copy can drift from what screening does (Story 7.2; deferred from Epic 6).

**Approach:** Put the shared preset contract in one JSON fixture (`contracts/preset-contract.json`) holding each preset's id, categories, metadata flag, description, and display copy. A Vitest test checks the frontend profiles and displayed copy against it; a pytest test checks `GET /api/presets` against it. Any drift on either side fails a test. Copy stays hand-written; the fixture is the reviewed checkpoint.

## Boundaries & Constraints

**Always:** Tests are written first and fail before the implementation (TDD red-green). Displayed copy moves out of the component into an exported `frontend/src/utils/presetCopy.js` module so tests can import it, with no change to rendered text. The fixture covers exactly the preset IDs `kid_safe`, `moderate`, `slurs_only`, `custom` and the categories `slurs`, `strong_profanity`, `mild_profanity`, `sexual`, `substances`. Vitest and pytest read the same fixture file. No live network calls or real auth state in tests.

**Never:** No change to verdicts, regex evaluation, preset rules, or API payloads. Do not change the Custom copy or description text (that is Story 7.3). No new runtime dependency.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Frontend profile drift | A category or `include_metadata_explicit` in `DEFAULT_PRESET_PROFILES` differs from fixture | Vitest contract test fails | N/A |
| Frontend copy drift | `PRESET_COPY` summary differs from fixture copy | Vitest contract test fails | N/A |
| Backend drift | `GET /api/presets` IDs, categories, or flags differ from fixture | pytest contract test fails | N/A |
| Backend description drift | `config.py` description differs from fixture description | pytest contract test fails | N/A |
| Happy path | Frontend and backend match fixture | Both suites pass | N/A |

</frozen-after-approval>

## Code Map

- `frontend/src/components/ScreeningControlsBar.jsx` -- hand-written `PRESETS` array (lines 5-29: `id`, `label`, `summary`); move to `presetCopy.js` and import
- `frontend/src/utils/lyricEvaluator.js` -- `DEFAULT_PRESET_PROFILES` (lines 11-38); source of truth for frontend rules; do not change
- `backend/app/config.py` -- `PRESET_PROFILES` (lines 5-34); source of truth for backend rules; do not change
- `backend/app/main.py` -- `get_presets()` at `/api/presets` (line ~196); contract under test; do not change
- `backend/app/tests/test_presets.py` -- existing presets tests; add the contract test here, keep existing assertions
- `frontend/src/components/__tests__/ScreeningControlsBar.test.jsx` -- existing tests; must still pass unchanged
- `frontend/src/App.jsx` -- fetches `/api/presets` (line ~78); reference only

## Tasks & Acceptance

**Execution:**
- [x] `contracts/preset-contract.json` -- create fixture with the four presets (id, name, description, include_metadata_explicit, categories, display summary) -- single shared source for both test suites
- [x] `frontend/src/utils/__tests__/presetContract.test.js` -- write failing Vitest tests: profiles match fixture; `PRESET_COPY` matches fixture copy -- red first
- [x] `backend/app/tests/test_preset_contract.py` -- add failing pytest contract test comparing `get_presets()` IDs, categories, flags, and descriptions against fixture -- red first (new file instead of `test_presets.py`, see Implementation Notes)
- [x] `frontend/src/utils/presetCopy.js` -- export `PRESET_COPY` with the current summaries moved verbatim -- green
- [x] `frontend/src/components/ScreeningControlsBar.jsx` -- import `PRESET_COPY` instead of local array; no text change -- green
- [x] Run and confirm all suites pass, including existing `ScreeningControlsBar.test.jsx`

**Acceptance Criteria:**
- Given `DEFAULT_PRESET_PROFILES` and the fixture, when the frontend suite runs, then the Vitest contract test asserts each preset's categories and `include_metadata_explicit` match, and that displayed copy matches the fixture.
- Given a change to a preset's categories or metadata flag without a fixture copy update, when the frontend suite runs, then it fails.
- Given `GET /api/presets` and the fixture, when the backend suite runs, then the pytest contract test asserts IDs, categories, flags, and descriptions match.
- Given the implementation, when tests are run, then the new tests failed before the change and pass after it (TDD).

## Implementation Notes

- Red confirmed: before the fixture and `presetCopy.js` existed, the pytest contract test failed with `FileNotFoundError` and the Vitest file failed to load its imports.
- Pytest contract went into `backend/app/tests/test_preset_contract.py`, not `test_presets.py`, to keep the contract separate from the existing route tests. Existing `test_presets.py` assertions are unchanged.
- `frontend/node_modules` in this worktree is a junction to the main checkout's `node_modules`, and pytest runs against the main `.venv`. Neither is committed.
- Review added a category-to-copy test (`summary for $id mentions exactly its categories and metadata flag`). The first version only checked fixture against profile and against copy, so a category change with an untouched summary could pass. Mutation checks confirmed the new test fails when the fixture's moderate categories gain `substances` without a copy change, and that the backend contract fails when moderate's metadata flag flips.
- Full suites after the change: backend 225 passed; frontend 371 passed, 34 files; `npm --prefix frontend run build` succeeds.
- Lint: no findings in the touched files. The repo already has `react(set-state-in-effect)` warnings in other components; not introduced here.

## Review Triage Log

- Verification gap: fixture could change a category while the summary stayed the same -> verdict `medium` (AC "fails if a category set changes without a matching copy change" not met) -> patch applied: category-to-copy test added and mutation-checked.
- Edge case: separate pytest file rather than `test_presets.py` as the task list said -> verdict `low` (cosmetic; moving it adds no behavior) -> rejected, recorded above.
- Blind review: `$comment` key in the JSON fixture is read by no test -> verdict `false` (harmless metadata, not a defect).

## Design Notes

Copy is checked against the fixture rather than generated from profile data. Generating the summaries would change the wording, which this story must not do. The fixture makes any rule change require an explicit, reviewed copy change in the same diff.

## Verification

**Commands:**
- `$env:PYTHONPATH="backend"; .\.venv\Scripts\pytest.exe backend/app/tests/test_presets.py` -- expected: all pass
- `npm --prefix frontend test` -- expected: all pass, including new contract test
- `npm --prefix frontend run lint` -- expected: no new errors
- `npm --prefix frontend run build` -- expected: build succeeds
