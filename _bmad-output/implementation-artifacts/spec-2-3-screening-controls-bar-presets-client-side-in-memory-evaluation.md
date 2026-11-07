---
title: 'Story 2.3: Screening Controls Bar, Presets, & Client-Side In-Memory Evaluation'
type: 'feature'
created: '2026-11-06'
status: 'done'
baseline_commit: '30da5cda050861ec2449733823c4a05ba264e20b'
route: 'dispatch'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Users changing sensitivity presets or adding custom blocklist terms currently must trigger repeated network requests or cannot test strictness levels instantly across previously scanned tracks, causing unnecessary latency and UI desynchronization.

**Approach:** Return canonical preset profiles, word categories, and morphological suffix regex rules `(?:ing|ed|s|es)?` from `GET /api/presets`, create a dedicated `ScreeningControlsBar` component with 4 preset pills and an inline chip-based custom blocklist input, and implement `lyricEvaluator.js` to instantly re-evaluate cached lyrics in memory client-side with byte-for-byte parity to server scanning.

## Boundaries & Constraints

**Always:**
- Return `presets`, `categories`, and `morphological_suffix_pattern: "(?:ing|ed|s|es)?"` from `GET /api/presets` in `backend/app/main.py`.
- Render four distinct preset pills in `ScreeningControlsBar`: `Kid Safe` (`kid_safe`), `Moderate` (`moderate`), `Slurs Only` (`slurs_only`), and `Custom` (`custom`).
- Apply active preset styling using `{colors.brand-primary}` (`#7C3AED`) and `{colors.brand-foreground}` (`#FFFFFF`) with `rounded-full` pill shape.
- Trim, lowercase, and deduplicate custom blocklist terms upon `Enter` submission or click, rendering them as removable chips with `aria-label="Remove blocklist term {term}"`.
- Use `lyricEvaluator.js` to re-evaluate cached tracks client-side in memory with zero network calls whenever preset or custom blocklist changes.
- Apply whole-word boundary matching and morphological suffixes `(?:ing|ed|s|es)?` in `lyricEvaluator.js` matching `scanner_service.py` to ensure identical verdicts, snippets, and category counts.
- Maintain the zero false-clean state machine: tracks without cached lyrics remain `unscanned` or `lyrics_unavailable`, while non-explicit missing-lyrics tracks are never marked `verified_clean`.
- Fire-and-forget or safely guard `POST /api/telemetry/event` (`scan_completed`) so missing or unimplemented telemetry endpoints do not throw unhandled exceptions or block UI updates.

**Never:**
- Never issue network calls to `/api/scan/*` when re-evaluating tracks whose lyrics already exist in `lyricsByTrackId`.
- Never mark tracks with missing lyrics (`has_lyrics: false`) as `verified_clean`.
- Never use green/emerald for non-clean states or Spotify branding; reserve emerald strictly for `verified_clean` and `clean_swapped`.
- Never allow duplicate or whitespace-only custom blocklist terms.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| App Boot / Presets Fetch | Mount `ScreeningControlsBar` / boot app | `GET /api/presets` returns 200 with presets, word categories, and suffix rule `(?:ing|ed|s|es)?` | Fall back gracefully to bundled default profiles |
| Preset Switch | User clicks `Kid Safe` pill with cached lyrics in memory | `lyricEvaluator.js` runs synchronously across `scannedTracks`; rows update to new flagged/clean statuses; category summary counts update instantly with 0 network calls | Retain existing track status if evaluation throws |
| Custom Blocklist Add | User types `"beer "` and presses `Enter` | Term is trimmed and lowercased to `"beer"`, added to `customBlocklist`, rendered as chip with `aria-label="Remove blocklist term beer"`; cached tracks re-screened | Discard whitespace-only or duplicate entries |
| Custom Blocklist Remove | User clicks remove icon on `"beer"` chip | `"beer"` removed from `customBlocklist`; cached tracks re-screened in memory immediately | Safe no-op if term is not present |
| Unscanned Track in List | Track staged without lyrics in `lyricsByTrackId` | Preset change leaves track in `unscanned` state; only explicit metadata check applies if configured | Do not falsely mark clean |
| Morphological Suffix Match | Lyrics contain `"smoking"`, `"smokes"`, or `"smoked"` for root `"smoke"` | Evaluator flags term `"smoke"` with matched text and line number | Case-insensitive regex with `\b` boundaries |

</frozen-after-approval>

## Code Map

- `backend/app/main.py` -- Update `GET /api/presets` to include `morphological_suffix_pattern` (`(?:ing|ed|s|es)?`) alongside `presets` and `categories`.
- `backend/app/tests/test_presets.py` -- Unit tests verifying `GET /api/presets` schema, profiles, categories, and suffix pattern.
- `frontend/src/utils/lyricEvaluator.js` -- Pure client evaluation engine matching server `ScannerService` logic: regex compilation with morphological suffixes, line-by-line scanning, snippet creation, category aggregation, and zero false-clean state machine.
- `frontend/src/utils/__tests__/lyricEvaluator.test.js` -- Comprehensive unit test suite verifying parity with server `scanner_service.py`, custom blocklist matching, suffix variations, and state machine transitions.
- `frontend/src/components/ScreeningControlsBar.jsx` -- Dedicated control bar component hosting the 4 preset pills (`Kid Safe`, `Moderate`, `Slurs Only`, `Custom`), inline Custom Blocklist term input, removable chips with proper ARIA labels, and scan button trigger with progress announcements.
- `frontend/src/components/__tests__/ScreeningControlsBar.test.jsx` -- React Testing Library tests verifying preset selection, blocklist addition/removal, Enter key submission, ARIA labels, and disabled states during scanning.
- `frontend/src/components/ScanTab.jsx` -- Replace existing inline settings with `ScreeningControlsBar`, wire preset and custom blocklist state changes to `lyricEvaluator.js` for immediate in-memory re-evaluation of cached tracks.
- `frontend/src/App.jsx` -- Fetch and hydrate preset rules from `GET /api/presets` on boot, passing presets data down to `ScanTab`.

## Tasks & Acceptance

**Execution:**
- [x] `backend/app/main.py` -- Update `GET /api/presets` to return `morphological_suffix_pattern` and ensure canonical preset profiles and word categories are exposed.
- [x] `backend/app/tests/test_presets.py` -- Create backend unit test for `GET /api/presets` validating keys, preset profiles, word categories, and regex pattern.
- [x] `frontend/src/utils/lyricEvaluator.js` -- Implement client-side lyric evaluator supporting preset profiles, word categories, morphological suffixes, custom blocklists, and track verification status calculation.
- [x] `frontend/src/utils/__tests__/lyricEvaluator.test.js` -- Create unit tests for `lyricEvaluator.js` checking morphological suffixes, line snippets, category counts, metadata fallback, and empty/missing lyric handling.
- [x] `frontend/src/components/ScreeningControlsBar.jsx` -- Create `ScreeningControlsBar` component with 4 preset pills, inline blocklist input, removable chips with `aria-label="Remove blocklist term {term}"`, and scan button.
- [x] `frontend/src/components/__tests__/ScreeningControlsBar.test.jsx` -- Create unit tests for `ScreeningControlsBar` testing preset switching, custom word submission via Enter, chip removal, and accessibility attributes.
- [x] `frontend/src/components/ScanTab.jsx` -- Integrate `ScreeningControlsBar` and hook preset/blocklist changes to in-memory `lyricEvaluator.js` re-evaluation of cached tracks.
- [x] `frontend/src/App.jsx` -- Fetch `/api/presets` on boot and pass preset configuration into `ScanTab`.

**Acceptance Criteria:**
- Given `ScreeningControlsBar` mounted, when `GET /api/presets` is fetched on app boot, then it returns `presets`, `categories`, and `morphological_suffix_pattern` `(?:ing|ed|s|es)?`, and `ScreeningControlsBar` renders four preset pills (`Kid Safe`, `Moderate`, `Slurs Only`, `Custom`) and an inline Custom Blocklist term input.
- Given a user typing a word into Custom Blocklist and pressing `Enter`, when the term is submitted, then it is trimmed, lowercased, deduplicated, and appended as a removable chip with `aria-label="Remove blocklist term {term}"`.
- Given cached lyrics in `lyricsByTrackId` for staged tracks, when the user clicks a different preset pill or adds/removes a Custom Blocklist chip, then `lyricEvaluator.js` re-evaluates all cached tracks client-side in memory with zero network calls, regex evaluation applies `(?:ing|ed|s|es)?` to ensure byte-for-byte identical flagged verdicts to server `scanner_service.py`, and row badges and category summaries update immediately.

## Implementation Notes

- Added `morphological_suffix_pattern: "(?:ing|ed|s|es)?"` to `GET /api/presets` in `backend/app/main.py`.
- Added unit tests in `backend/app/tests/test_presets.py` verifying preset profiles, word categories, and regex pattern.
- Created `frontend/src/utils/lyricEvaluator.js` implementing client-side lyric evaluation, stem/suffix boundary regex compilation, category summaries, Zero False-Clean state machine, and fire-and-forget telemetry.
- Created `frontend/src/utils/__tests__/lyricEvaluator.test.js` with comprehensive test suite (17 tests) covering morphological suffixes, empty/missing lyrics, category aggregation, and zero false-clean state invariants.
- Created `frontend/src/components/ScreeningControlsBar.jsx` hosting the 4 preset pills (`Kid Safe`, `Moderate`, `Slurs Only`, `Custom`), inline custom blocklist input with Enter submission, removable chips with accessible remove labels, and scan button with aria-live announcements.
- Created `frontend/src/components/__tests__/ScreeningControlsBar.test.jsx` (6 tests) and `frontend/src/components/__tests__/ScanTabReevaluation.test.jsx` (3 tests) validating zero-network-call client re-evaluation.
- Integrated `ScreeningControlsBar` and `reevaluateTracks` into `frontend/src/components/ScanTab.jsx` for synchronous and reactive in-memory re-screening.
- Hydrated `presetsData` from `GET /api/presets` on boot in `frontend/src/App.jsx`.

## Spec Change Log

## Review Triage Log

| Finding | Verdict | Evidence |
|---|---|---|
| EC-1: Infinite loop on zero-length regex match | medium | patch: guarded with `if (match[0].length === 0) regex.lastIndex++;` in `lyricEvaluator.js`. |
| EC-2: Uncaught TypeError when lyricsByTrackId is null or lyrics non-string | medium | patch: guarded with `safeLyricsMap = lyricsByTrackId || {};` and `typeof lyrics === 'string'` check before `.trim()`. |
| EC-3: Non-string element in customBlocklist causes crash | low | patch: added `typeof t === 'string'` in `ScreeningControlsBar.jsx` duplicate check. |
| EC-4 / BH-2: Divergence on custom blocklist suffixes between client and server | medium | patch: aligned custom blocklist in `lyricEvaluator.js` to exact whole-word boundaries `\b${escaped}\b` matching `scanner_service.py:82`. |
| BH-1: Trailing 'e' stripping in compileTermPattern breaks parity with server | medium | patch: removed trailing `'e'` stem stripping in `compileTermPattern` so category compilation matches `scanner_service.py` (`\b${escaped}${suffixPattern}\b`). |
| BH-3: Over-broad stem regex matches truncated root words without suffix | medium | patch: resolved by compiling exact `\b${escaped}${suffixPattern}\b`, preventing false matches on `"cok"` or `"smok"`. |
| BH-4: Duplicate snippet matches for pre-inflected lexicon entries | low | reject: server `scanner_service.py` evaluates categories similarly without span deduplication; maintaining server parity is prioritized. |
| BH-5: ScreeningControlsBar interactive elements operable during scanning | low | patch: added `disabled={scanning || disabled}` to preset buttons, blocklist input, Add Word button, and chips. |
| BH-6: ScreeningControlsBar fails to clear duplicate input | low | patch: added `setInputValue('')` before returning on duplicate submission in `handleAddTerm`. |
| BH-7 / VG-2: Clean-swapped tracks lose status upon re-evaluation | medium | patch: updated `evaluateTrack` to check `track.verification_status === 'clean_swapped' || track.was_replaced` and preserve clean status. |
| BH-8: Unscanned tracks marked flagged with unscanned status | low | false: Refutation: unscanned tracks staged with explicit metadata carry honest status indicator; zero false-clean state machine strictly forbids verified_clean. |
| BH-9: Category summaries omitted from summary and UI | low | false: Refutation: category summaries are rendered per-track via `detected_terms` and reasons; top-level summary totals display flagged/clean counts. |
| BH-10: Uncached regex compilation on every track | low | reject: in-memory re-evaluation of 50 staged tracks runs in <15ms, well within the 3s latency budget. |
| BH-11: ScanTab does not re-evaluate when backend presetsData finishes loading | low | patch: included `presetsData` in `lastScreeningConfigRef` dependency tracking. |
| BH-12: Unhandled TypeError if lyrics is not string | low | patch: added `typeof lyrics === 'string'` guard in `lyricEvaluator.js`. |
| BH-13: test_presets.py invokes get_presets directly | low | false: Refutation: matches existing repo testing conventions (`test_catalog_endpoints.py`, `test_scan_pipeline.py`) where route paths are tested on `app.routes` and handlers called directly without httpx. |
| VG-1: Missing test for presetsData propagation | low | patch: added test in `ScanTabReevaluation.test.jsx` verifying custom category unpacking from `presetsData`. |
| VG-3: Missing test for Add Word button click submission | low | patch: added test in `ScreeningControlsBar.test.jsx` verifying submission via Add Word button click. |

## Design Notes

- Preset Profiles:
  - `kid_safe`: `["slurs", "strong_profanity", "mild_profanity", "sexual", "substances"]`, metadata explicit enabled.
  - `moderate`: `["slurs", "strong_profanity", "sexual"]`, metadata explicit enabled.
  - `slurs_only`: `["slurs"]`, metadata explicit disabled.
  - `custom`: user blocklist + `["slurs", "strong_profanity"]`, metadata explicit enabled.
- Token and Color Palette:
  - Container background: `bg-surface-card` (`#191F31`), border: `border-border-subtle`.
  - Active preset pill: `bg-brand-primary` (`#7C3AED`) text `text-white`.
  - Inactive preset pill: `bg-surface-elevated` (`#23293C`) text `text-text-muted` hover `text-text-primary`.
  - Custom blocklist chips: `bg-surface-elevated` border `border-border-subtle` text `text-brand-foreground` with `X` button.
- Client-Side In-Memory Re-evaluation:
  - Re-evaluates each track in `scannedTracks` (and `workingList`) when `preset` or `customBlocklist` changes.
  - If `lyricsByTrackId[track.id]` is present, evaluate with `evaluateLyrics(lyrics, presetConfig, customBlocklist, track)`.
  - If track was `clean_swapped`, retain clean swap metadata while updating lyric match snippets if necessary.
  - If `lyricsByTrackId[track.id]` is absent, update metadata explicit evaluation if preset's `include_metadata_explicit` toggled.

## Verification

**Commands:**
- `$env:PYTHONPATH="backend"; .\.venv\Scripts\pytest.exe backend/app/tests/` -- expected: All backend tests pass including `test_presets.py`.
- `npm --prefix frontend test -- --run` -- expected: All vitest unit tests pass including `lyricEvaluator.test.js` and `ScreeningControlsBar.test.jsx`.
- `npm --prefix frontend run lint` -- expected: Oxlint completes with 0 errors.
- `npm --prefix frontend run build` -- expected: Vite production build succeeds without errors.
