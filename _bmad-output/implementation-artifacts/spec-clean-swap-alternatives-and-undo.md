---
title: 'Clean Swap Alternatives Picker, Undo, & Instrumental Ranking Guardrail'
type: 'feature'
created: '2026-11-20'
status: 'done'
baseline_commit: 'b8702a5aa248ce8ff8511b2fc7ab34a0be807553'
route: 'dispatch'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Clean replacement searches return only the #1 auto-scored match and overwrite the track in-place with no undo. Users—especially after Bulk Swap—get stuck with instrumental/karaoke covers or wrong tracks and cannot pick another match or revert.

**Approach:** Penalize instrumental/karaoke/tribute/lullaby/8-bit candidates in backend ranking, return up to 5 ranked candidates additively from `/api/replacements/find` and `/api/replacements/find-batch`, and add a "Change / Undo" picker modal in Scan & Clean to switch matches or revert to the original track.

## Boundaries & Constraints

**Always:**
- Preserve all 10 normalized track keys (`id`, `title`, `artist`, `artists_list`, `album`, `duration`, `duration_seconds`, `is_explicit`, `thumbnail`, `video_url`) on candidates and swapped/reverted tracks.
- Keep `/api/replacements/find`, `/api/replacements/find-batch` (including >10 track 400 cap), and `search_clean_replacement -> Optional[Dict]` backward-compatible; multi-candidate fields are strictly additive.
- Allow freely selecting any candidate in the picker (never block; display explicit/duration metadata honestly).
- Preserve the original unswapped track snapshot across repeated re-swaps so "Revert to Original" restores the true original track and screening metadata.
- Use Obsidian Audio Core Tailwind v4 tokens, `lucide-react` icons, `aria-label` on icon buttons, `min-h-[44px]` mobile touch targets, dialog focus-trap/Escape semantics, and Red-Green-Refactor TDD with mocked clients.

**Never:**
- Do not touch `StitchTab.jsx`, `runStitchPreScreeningPipeline`, `KeywordsTab.jsx`, `AboutTab.jsx`, or `SavePlaylistModal.jsx` (Scan & Clean only).
- Do not add inline manual catalog search inside the picker (deferred to Slice 2 in `deferred-work.md`).
- Do not fan out backend lyric lookups to runner-up alternatives (resolve lyrics for candidate #1 only).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Instrumental penalty | Original `"SICKO MODE"`, candidates `"SICKO MODE (Instrumental)"` (0s) vs `"SICKO MODE - Clean"` (2s) | Clean vocal edit outranks instrumental (-45 penalty for instrumental/karaoke/tribute/lullaby/8-bit) | N/A |
| Original is instrumental | Original `"Clair de Lune (Instrumental)"`, candidate `"Clair de Lune (Instrumental)"` | No penalty applied (keyword already in original title) | N/A |
| Multi-candidate find | `POST /api/replacements/find` (4 matches) | `found: true`, `clean_candidate: c[0]`, `clean_alternatives: [c0..c3]` (max 5, deduped by `id`) | Exception -> `found: false`, `clean_candidate: null`, `clean_alternatives: []`, `lyrics_by_id: {}` |
| Multi-candidate batch | `POST /api/replacements/find-batch` | `results[id]` = top or `null`; `alternatives[id]` = up to 5 ranked candidates (`[]` if none) | Per-track exception isolated -> `results[id]: null`, `alternatives[id]: []` |
| Pick alternate | Swapped track -> "Change / Undo" -> select alternate #2 | Updates `scannedTracks`, `workingList`, `playlist`; retains original `original_track`; `aria-live` announcement | Empty cached alternatives -> "Fetch Other Matches" calls `/api/replacements/find` with `original_track` |
| Revert to original | Swapped track (after 1+ re-swaps) -> "Revert to Original" | Restores exact `original_track` (`id`, `verification_status`, `is_flagged`, `reasons`, `snippets`, `is_explicit`), clears `was_replaced`, updates `FinishLineBar` | N/A |
| Pre-swap alternates | Flagged track after single find with >=2 alternatives | Shows "Swap to Clean" + "Other matches (N)" trigger | <=1 candidate -> no extra trigger |

</frozen-after-approval>

## Code Map

- `backend/app/services/spotify_service.py` (L456–557) & `ytmusic_service.py` (L215–293) -- add low-fidelity penalty helper and `search_clean_replacements(..., max_results=5)` across tiers; delegate `search_clean_replacement`.
- `backend/app/main.py` (L634–738) -- add `clean_alternatives` to `/api/replacements/find` and `alternatives` to `/api/replacements/find-batch`; resolve lyrics for top candidate only.
- `backend/app/tests/test_clean_replacements.py` -- extend with penalty, exemption, deduped top-5, and additive payload tests.
- `frontend/src/utils/swapHelpers.js` (new) & `screeningPipeline.js` (L222–345) -- centralize `buildSwappedTrack`/`buildRevertedTrack` (preserving `original_track` + `clean_alternatives`); forward `alternativesById` in `runBulkCleanPipeline`.
- `frontend/src/components/CleanReplacementPickerModal.jsx` (new) -- accessible dialog (reusing `LyricsModal` focus-trap/Escape/backdrop pattern) with ranked candidate list, external links, "Fetch Other Matches", and "Revert to Original".
- `frontend/src/components/CleanReplacementControl.jsx` (L14–120), `WorkingListWorkbench.jsx` (L272–280), `MobileTrackCard.jsx` (L157–165), `LyricsModal.jsx` (L334–345, L509–533) -- render "Change / Undo" on swapped tracks and "Other matches (N)" pre-swap.
- `frontend/src/components/ScanTab.jsx` (L614–906, L1125–1236) & `App.jsx` (L318–440) -- wire `swapHelpers`, `cleanAlternatives`, picker modal, `handleSelectAlternative`, and `handleRevertSwap`.

## Tasks & Acceptance

**Execution:**
- [x] `backend/app/services/spotify_service.py` & `ytmusic_service.py` -- Add non-vocal/cover penalty (`instrumental`, `karaoke`, `tribute`, `lullaby`, `8-bit`; skipped if in original title) and `search_clean_replacements(..., max_results=5)` deduping across tiers; delegate `search_clean_replacement` -- Prevents bad top picks and supplies ranked runners-up.
- [x] `backend/app/main.py` -- Return additive `clean_alternatives` (`/find`) and `alternatives` (`/find-batch`), resolving lyrics for #1 only -- Exposes up to 5 candidates without extra lyric fan-out.
- [x] `backend/app/tests/test_clean_replacements.py` -- Unit-test penalty, exemption, cross-tier top-5 deduping, additive payloads, and error isolation -- Verifies backend I/O matrix.
- [x] `frontend/src/utils/swapHelpers.js` & `screeningPipeline.js` -- Add `buildSwappedTrack`/`buildRevertedTrack` preserving `original_track` across re-swaps; forward `alternativesById` from `runBulkCleanPipeline` -- Lossless swap/revert state across single, bulk, and modal flows.
- [x] `frontend/src/components/CleanReplacementPickerModal.jsx` -- Build accessible picker modal with metadata, duration delta, explicit badge, external verification link, "Current" pill, "Fetch Other Matches", and "Revert to Original" -- Fast recovery UI on desktop and mobile.
- [x] `frontend/src/components/CleanReplacementControl.jsx`, `WorkingListWorkbench.jsx`, `MobileTrackCard.jsx`, `LyricsModal.jsx`, `ScanTab.jsx`, `App.jsx` -- Wire "Change / Undo", pre-swap "Other matches (N)", picker modal, alternate selection, and revert across `scannedTracks`, `workingList`, `playlist`, and `aria-live` -- End-to-end Scan & Clean UX.
- [x] `frontend/src/components/__tests__/CleanReplacementPickerModal.test.jsx`, `CleanReplacementControl.test.jsx`, `ScanTabBulkClean.test.jsx` -- Unit/integration tests for picker, re-swap, revert restoring original flagged state, uncached fetch fallback, and Escape/focus a11y -- Verifies frontend I/O matrix.

**Acceptance Criteria:**
- Given a single or Bulk Swap in Scan & Clean, when the user opens "Change / Undo" from a desktop row, mobile card, or `LyricsModal`, then the picker modal lists up to 5 ranked candidates with metadata/external links and a "Revert to Original" action.
- Given the picker is open, when the user selects any candidate, then `scannedTracks`, `workingList`, and `playlist` update in-place, announce politely, and retain the true original track for future revert.
- Given a swapped track is reverted, then its original metadata, `is_flagged` state, reasons/snippets, and `FinishLineBar` counts are fully restored.

## Implementation Notes

## Spec Change Log

## Review Triage Log

- `[blind-hunter, edge-case-hunter]` `frontend/src/utils/swapHelpers.js:58-90` (stale `ytmusic_video_id` & `lyrics` inherited on Spotify re-swap) — **high** -> `patch`: `buildSwappedTrack` spreads `originalSnapshot` before `candidate`, inheriting explicit `ytmusic_video_id`/`lyrics` when candidate #2–#5 lacks them.
- `[blind-hunter, edge-case-hunter]` `backend/app/services/spotify_service.py:586-587`, `ytmusic_service.py:312-313` (premature tier early-exit on penalized covers) — **high** -> `patch`: breaking on `len(candidates_by_id) >= capped_max` stops before later clean-keyword tiers when Tier 1 returns 5 penalized covers.
- `[blind-hunter, edge-case-hunter]` `backend/app/services/spotify_service.py:468-470`, `ytmusic_service.py:227-229` (substring false positives & missing album check in `_compute_low_fidelity_penalty`) — **medium** -> `patch`: raw substring check penalizes words like `"contribute"`/`"retribution"` and ignores candidate album name.
- `[blind-hunter, edge-case-hunter, verification-gap]` `frontend/src/components/LyricsModal.jsx:356-360` (detached `triggerEl` focus loss on picker close) — **medium** -> `patch`: passes unmounting button `e.currentTarget` and calls `handleClose()` instead of passing `previousActiveElement.current` and calling `onCloseRef.current?.()`.
- `[blind-hunter, edge-case-hunter, verification-gap]` `frontend/src/App.jsx:351-355,394-398`, `WorkingListWorkbench.jsx`, `LyricsModal.jsx` (truthy empty array `[]` and missing `original_id` key lookup) — **medium** -> `patch`: `[]` short-circuits `||` fallback and swapped rows keyed by `original_id` miss `cleanAlternatives[track.id]`.
- `[blind-hunter, edge-case-hunter]` `frontend/src/components/ScanTab.jsx:979-1031` (`handleFetchAlternatives` race condition on close/switch) — **medium** -> `patch`: no request-id guard; late response can overwrite another track's picker state.
- `[blind-hunter]` `frontend/src/components/CleanReplacementPickerModal.jsx:2410-2429` (no "Fetch Other Matches" when only 1 candidate is cached) — **medium** -> `patch`: swapped track with 1 cached item has no way to fetch more candidates.
- `[blind-hunter]` `frontend/src/components/CleanReplacementPickerModal.jsx:2517` (no-op ternary & duplicate swap/telemetry on Current match) — **low** -> `patch`: renders identical label and allows re-clicking current match.
- `[blind-hunter]` `frontend/src/components/ScanTab.jsx:1458-1484` (revert discards cached `cleanCandidates`) — **low** -> `patch`: restoring `cleanCandidates[revertedTrack.id]` from cached alternatives avoids redundant re-fetch.
- `[edge-case-hunter]` `backend/app/services/spotify_service.py:483`, `ytmusic_service.py:241` (`max_results=0` coerces to 5) — **low** -> `patch`: `int(max_results or 5)` treats `0` as falsy.
- `[edge-case-hunter]` `backend/app/services/spotify_service.py:551-552` (`track.get('name')` explicit `None`) — **low** -> `patch`: `track.get('name', '')` returns `None` when key is explicitly `None`.
- `[blind-hunter]` `frontend/src/components/ScanTab.jsx:1289-1291,1547-1549` (stale `pickerTriggerEl`/`fetchAlternativesError` on clear/switch) — **low** -> `patch`: reset both when clearing list or switching platforms.
- `[blind-hunter]` `frontend/src/utils/swapHelpers.js` (explicit candidate keeps `is_explicit: true` with `clean_swapped`) — **false**: intentional per user requirement to freely pick any candidate while displaying its explicit badge honestly.
- `[blind-hunter]` `frontend/src/components/ScanTab.jsx`, `App.jsx` (duplicate `track.id` collisions in `swapFn`/`revertFn`) — **low** -> `defer`: pre-existing ID-based update pattern; WorkingList deduplicates by `id` on staging.
- `[verification-gap]` `App.jsx` `LyricsModal` swap & picker wiring untested — **medium** -> `patch`: add `<App />` integration test.
- `[verification-gap]` `LyricsModal` pre-swap `Other matches (N)` and swapped-banner mutual exclusion untested — **medium** -> `patch`: add component assertions.
- `[verification-gap, blind-hunter]` `runBulkCleanPipeline` multi-chunk & partial-failure `alternativesById` untested — **medium** -> `patch`: add assertions in `screeningPipeline.test.js`.
- `[verification-gap]` `handleFetchAlternatives` error/empty paths & `role="alert"` untested — **medium** -> `patch`: add error & empty-response tests.
- `[verification-gap]` `CleanReplacementPickerModal` `Tab`/`Shift+Tab` focus trap untested — **medium** -> `patch`: add focus-trap test.

## Verification

**Commands:**
- `$env:PYTHONPATH="backend"; .\.venv\Scripts\pytest.exe backend/app/tests/` -- expected: 0 failures
- `npm --prefix frontend test` -- expected: 0 failures
- `npm --prefix frontend run lint` -- expected: 0 oxlint errors
- `npm --prefix frontend run build` -- expected: clean build into `frontend/dist`
