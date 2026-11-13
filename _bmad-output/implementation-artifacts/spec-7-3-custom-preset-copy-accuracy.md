---
title: 'Story 7.3: Custom Preset Copy Accuracy'
type: 'bugfix'
created: '2026-11-13'
status: 'done'
baseline_commit: '52c9d72a6ee3cf966647e6073102dfe3d5cad189'
route: 'dispatch'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-7-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The Custom preset's description ("User-defined keyword blocklist with customizable preset rules.") does not say that Custom also applies the fixed slur and strong-profanity rules, so users may think Custom is blocklist-only.

**Approach:** Replace the Custom description with copy that states the fixed rules plus the custom blocklist, and that the blocklist applies under every preset. The text lives in three places that must match exactly: `backend/app/config.py`, `contracts/preset-contract.json`, and `frontend/src/utils/lyricEvaluator.js`. The Story 7.2 contract test enforces that they match. No verdict, category, or API payload changes.

## Boundaries & Constraints

**Always:** Write the failing copy test first (red), then change the strings (green). Keep the `Custom Filter` name. Keep the frontend and backend descriptions identical. Update `contracts/preset-contract.json` in the same diff as any description change. Unit tests make no live network calls.

**Never:** Change regex evaluation, preset categories, `include_metadata_explicit`, or API payloads. Make Custom blocklist-only (that is a separate behavior story). Modify existing `lyricEvaluator.js` or scanner tests beyond adding copy assertions.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Custom copy | `custom` profile description | Says fixed slur and strong-profanity rules plus custom blocklist terms apply, and blocklist applies under every preset | N/A |
| Old wording removed | Any frontend or backend description | Contains no "custom blocklist terms only" or "User-defined keyword blocklist with customizable preset rules." | N/A |
| Parity | Frontend and backend Custom descriptions | Identical strings, checked by the 7.2 contract tests | Test fails on drift |

  </frozen-after-approval>

## Decisions (made at planning)

- **Copy wording:** "Applies the fixed slur and strong-profanity rules plus your custom blocklist terms. Your blocklist applies under every preset." This follows the story's AC and is the only wording used.
- **Story 6.4 wording:** "Filters using custom blocklist terms only" is not present in the code. The current string is the generic "User-defined keyword blocklist…" line. Replacing that string satisfies the AC.

## Code Map

- `backend/app/config.py` -- `PRESET_PROFILES` `custom` entry (lines ~28-31): description to update
- `contracts/preset-contract.json` -- `custom` entry (lines ~29-32): shared fixture for both contract tests
- `frontend/src/utils/lyricEvaluator.js` -- `DEFAULT_PRESET_PROFILES` custom entry (lines ~34-37): description to update
- `frontend/src/utils/__tests__/presetContract.test.js` -- Story 7.2 Vitest contract test; reuse, add copy assertion
- `backend/app/tests/test_preset_contract.py` -- Story 7.2 pytest contract test; reuse, add copy assertion
- `frontend/src/components/ScreeningControlsBar.jsx` -- renders `p.summary` as pill `title` and sr-only text; no change expected
- Do not change: `frontend/src/utils/lyricEvaluator.js` evaluation logic, `backend/app/services/scanner_service.py`

## Tasks & Acceptance

**Execution:**
- [x] `frontend/src/utils/__tests__/presetContract.test.js` and `backend/app/tests/test_preset_contract.py` -- add failing assertions for the new Custom copy -- red first
- [x] `backend/app/config.py`, `contracts/preset-contract.json`, `frontend/src/utils/lyricEvaluator.js` -- set the new Custom description to the same string -- green
- [x] Confirm `ScreeningControlsBar` tests still pass unmodified

**Acceptance Criteria:**
- Given the Custom preset, when its description is read, then it states the fixed slur and strong-profanity rules, the custom blocklist terms, and that the blocklist applies under every preset
- Given the old Story 6.4 wording, when the suite runs, then it does not appear in any preset description
- Given frontend and backend Custom descriptions, when the 7.2 contract tests run, then they are identical
- Given the change, when the existing `lyricEvaluator.js` and scanner tests run unmodified, then all pass

## Implementation Notes

- Red-then-green TDD applied: new Custom copy assertions in `presetContract.test.js` and `test_preset_contract.py` failed on the old wording before the strings changed.
- Changed: `backend/app/config.py`, `contracts/preset-contract.json`, `frontend/src/utils/lyricEvaluator.js` (description), `frontend/src/utils/presetCopy.js` and `ScreeningControlsBar.test.jsx` (visible pill summary, found in review).
- Final Custom summary: "Applies the fixed slur and strong-profanity rules plus your custom blocklist terms, which apply under every preset. Also flags tracks tagged explicit."
- Verification: pytest 228 passed; Vitest 375 passed; build succeeded; lint has only pre-existing warnings in untouched files.

## Spec Change Log

## Review Triage Log

- Blind hunter, edge-case, and verification-gap reviews run in parallel on the diff.
- Patch (applied): visible Custom pill summary still showed old copy (`presetCopy.js`, contract summary, pinned test). Verified against the code.
- Rejected as cosmetic: redundant wording; literal duplication across test files; partial-wording guard; extra null guards.
- Rejected: "applies under every preset" is backed by `lyricEvaluator.js`, which always compiles custom patterns regardless of preset.
- Rejected: spec "Never" clause read as permitting the description-string change the Approach requires.
- Restored: `epic-7-context.md` to its committed content after a regenerated rewrite dropped requirements.
- Deferred or noted: Code Map line numbers approximate (off by one in places).

## Verification

**Commands:**
- `$env:PYTHONPATH="backend"; .\.venv\Scripts\pytest.exe backend/app/tests/` -- expected: all pass
- `npm --prefix frontend test` -- expected: all pass
- `npm --prefix frontend run lint` -- expected: no errors
- `npm --prefix frontend run build` -- expected: success
