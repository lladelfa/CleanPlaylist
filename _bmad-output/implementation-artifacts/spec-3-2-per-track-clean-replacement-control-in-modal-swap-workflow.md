---
title: 'Story 3.2: Per-Track Clean Replacement Control & In-Modal Swap Workflow'
type: 'feature'
created: '2026-11-09'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context:
  - _bmad-output/implementation-artifacts/epic-3-context.md
  - _bmad-output/planning-artifacts/epics.md
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Users inspecting a flagged song in `WorkingListWorkbench`, `MobileTrackCard`, or `LyricsModal` lack a complete per-track clean replacement workflow that sends `track_id` for self-swap protection, shows a `"Searching…"` spinner state, previews the candidate clean title and duration difference on an emerald `Swap to Clean` button, displays `"No clean version found"` in muted italic text next to a one-click `Remove` button when no candidate exists, or allows applying the swap from an emerald top banner inside `LyricsModal` while updating `workingList` (`verification_status: "clean_swapped"`, `is_flagged: false`), `lyricsByTrackId`, and announcing the swap.

**Approach:** Create `CleanReplacementControl.jsx` and integrate it across `WorkingListWorkbench.jsx`, `MobileTrackCard.jsx`, `LyricsModal.jsx`, `ScanTab.jsx`, and `App.jsx`, while enriching `POST /api/replacements/find` in `backend/app/main.py` to return resolved clean `lyrics_by_id` so single-track swaps populate `lyricsByTrackId`, set `verification_status: "clean_swapped"` and `is_flagged: false`, and announce the swap via `aria-live="polite"`.

</frozen-after-approval>

## Implementation Notes

- **Backend Clean Lyrics Resolution (`backend/app/main.py`)**:
  - Updated `POST /api/replacements/find` (`find_clean_replacement`) to resolve clean lyrics via `lyric_xref_service.resolve_lyrics_and_yt_id` on both `spotify` and `ytmusic`, returning `lyrics_by_id: Dict[str, str]` alongside `found` and `clean_candidate`.
- **`CleanReplacementControl` Component (`frontend/src/components/CleanReplacementControl.jsx`)**:
  - Created reusable per-track clean replacement control supporting four states:
    1. Initial (`Flagged`): `Find Clean Edit` button (`aria-label="Find Clean Edit"`).
    2. Searching: Disabled spinner state (`"Searching…"`).
    3. Candidate Ready: Emerald `Swap to Clean` button displaying the matched clean title and formatted duration difference (`+Ns`, `-Ns`, `0s`).
    4. No Match: Muted italic `"No clean version found"` (`text-text-muted italic`) next to a one-click `Remove` button (`aria-label="Remove track"`).
- **Workbench, Mobile Card, & Modal Integration (`WorkingListWorkbench.jsx`, `MobileTrackCard.jsx`, `LyricsModal.jsx`, `ScanTab.jsx`, `App.jsx`)**:
  - Replaced inline replacement buttons in `WorkingListWorkbench.jsx` and `MobileTrackCard.jsx` with `CleanReplacementControl`, preserving single-row `Remove track` button semantics when no clean candidate is found.
  - Updated `ScanTab.jsx` `handleFindClean` to include `track_id: track.id` and `platform: activePlatform` in `POST /api/replacements/find` requests and attach resolved clean lyrics to candidates.
  - Updated `ScanTab.jsx` and `App.jsx` swap handlers to set `verification_status: "clean_swapped"`, `is_flagged: false`, clear flagged reasons/snippets/terms, merge clean lyrics into `lyricsByTrackId`, and announce swaps via `aria-live="polite"`.
  - Added an emerald top banner in `LyricsModal.jsx` when a clean candidate is available, displaying the clean title, duration difference, and `Swap to Clean` button that updates the parent row and closes the modal.
  - Guarded `ScanTab.jsx` `customBlocklist` change comparison in `useEffect` with deep array equality to prevent re-evaluation loops when inline array literals are passed in tests.


## Review Triage Log

- In-modal swaps in `App.jsx` fail to announce the swap via `aria-live="polite"`: `medium` (patched — added `swapAnnouncement` state and `aria-live="polite"` status region in `App.jsx`).
- `onApplyReplacement` in `App.jsx` leaves `playlist.tracks` stale: `low` (patched — updated `onApplyReplacement` to map `playlist.tracks` alongside `scannedTracks` and `workingList`).
- Duration difference is truncated out of view on desktop `Swap to Clean` buttons: `medium` (patched — separated `({deltaLabel})` into its own `shrink-0` element outside the `.truncate` title span in `CleanReplacementControl.jsx`).
- `formatDurationDelta` displays the full track length as a delta when either duration is missing or zero: `medium` (patched — guarded `origSec <= 0 || candSec <= 0` to return `'0s'`).
- `ScanTab.jsx` `lastScreeningConfigRef` updates drop `presetsData`, causing duplicate re-evaluations: `low` (patched — preserved `presetsData` in `lastScreeningConfigRef.current` across `handleSelectPreset`, `handleAddBlocklistTerm`, and `handleRemoveBlocklistTerm`).
- `ScanTab.handleFindClean` does not check `res.ok` and permanently caches `"none"` on transient HTTP/network failures: `medium` (patched — checked `res.ok` and surfaced a caution `NoticeBanner` on failure without caching `"none"`, keeping `Find Clean Edit` retryable).
- In-flight `handleFindClean` state not cleared on platform switch or list clear: `low` (patched — reset `cleanCandidates` and `searchingClean` in `handleConfirmPlatformSwitch` and `handleClearList`).
- Resolved clean candidate lyrics are not verified against active screening rules after swapping (`evaluateTrack` short-circuits `clean_swapped` tracks): `false` (preserving `verification_status: "clean_swapped"` and `is_flagged: false` on swapped tracks is an explicit Story 3.2 requirement and enforced by `lyricEvaluator.test.js`).
- Swapped track `has_lyrics` property is not updated from the clean candidate's lyrics: `medium` (patched — computed `has_lyrics: Boolean(typeof cleanLyrics === "string" && cleanLyrics.trim())` on `swappedTrack` in `ScanTab.jsx` and `App.jsx`).
- `LyricsModal` header link hardcodes `"Listen on YouTube Music"` on Spotify tracks: `false` (pre-existing label from Story 2.4 explicitly asserted by `LyricsModal.test.jsx` line 346).
- Missing test coverage for `"No clean version found"` and error paths in `ScanTab` and backend lyric resolution failure: `low` (patched — added tests in `CleanReplacementControl.test.jsx` and `test_clean_replacements.py`).
