---
title: 'Story 7.8: Rename the Custom Preset Label'
type: 'feature'
created: '2026-11-13'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The `custom` screening preset is labeled "Custom" / "Custom Filter", so users expect a "just my words" mode, but it applies fixed slur and strong-profanity rules plus the blocklist.

**Approach:** Rename the user-visible label to **"Slurs + Strong Language"** (the working label from epics.md Story 7.8; final wording still to be confirmed by Zo before merge) in the pill, active-policy line, frontend and backend profile `name`, and the shared contract. Keep the preset ID `custom`. Update the 7.2 contract test first (red), then go green.

**Acceptance criteria:** per epics.md Story 7.8. The Custom Keyword Blocklist label and its every-preset helper text are unchanged. No verdict, regex, category, `include_metadata_explicit`, or payload changes. Existing `lyricEvaluator.js` and scanner tests pass unmodified.

**Boundaries:** No new blocklist-only preset. No change to telemetry `preset_id` values.

</frozen-after-approval>

## Implementation Notes

- Label renamed to "Slurs + Strong Language" in `presetCopy.js` (pill and active-policy line), `lyricEvaluator.js` and `config.py` profile `name`, and `contracts/preset-contract.json`. The ID stays `custom`. Evaluator, categories, flags, payloads and the blocklist label/helper text are untouched.
- Tests written red first: contract label tests in `presetContract.test.js` and `test_preset_contract.py`, plus `ScreeningControlsBar.test.jsx` updates. Two old tests that queried the "Custom" pill by name were updated. Frontend 397 and backend 268 pass; lint shows existing warnings only; build passes.
- Telemetry still emits `preset_id: "custom"`. No docs referenced the old label.
- Open for the human: final wording ("Slurs + Strong Language" is the epic's working label) is to be confirmed by Zo before merge.

## Review Triage Log

- Inline self-review of the diff, no findings. The Blind Hunter subagent was skipped for this label-only change. Nothing deferred.

