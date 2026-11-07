---
title: 'Story 2.4: Lyrics Modal Inspection Overlay, Line Jumpers, & Keep Action'
type: 'feature'
created: '2026-11-07'
status: 'done'
baseline_commit: '35d6de0237dd1b2354938f59e60a88db8ea831ba'
route: 'dispatch'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Users reviewing flagged songs in the working list cannot inspect exact flagged lines with line numbers or navigate directly between profanity violations, nor can they mark acceptable flagged tracks as kept for the clean queue without losing their audit verdict.

**Approach:** Upgrade `LyricsModal` with an Obsidian dark glass overlay (`surface-backdrop/80` with `backdrop-blur-md`), strict focus trapping with `Escape` restoration, monospace line numbers (`L01`-`Lnn`), 2px rose border and subtle wash on flagged lines with inline profanity highlight tags, `Flag X of Y` jumper controls with smooth scrolling, platform-specific lyrics attribution, and a "Keep Flagged Track" action adding the track ID to `keptTrackIds` in `App.jsx`.

## Boundaries & Constraints

**Always:**
- Apply Obsidian Audio Core tokens: `bg-surface-backdrop/80`, `backdrop-blur-md`, `bg-surface-card`, `border-border-subtle`, `text-status-flagged`, `bg-status-flagged-bg/30`, `border-status-flagged-border`, and `brand-primary`.
- Implement accessible dialog semantics: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, focus trap cycling with `Tab` / `Shift+Tab`, and `Escape` key handler that restores focus to the invoking trigger button.
- Provide verbatim ARIA labels: `aria-label="Previous flagged line"`, `aria-label="Next flagged line"`, and `aria-label="Close modal"`.
- Format line numbers right-aligned in monospace (`L01`-`Lnn`), zero-padded to at least 2 digits.
- Display `"Lyrics cross-referenced via YouTube Music"` on Spotify tracks, and `"Lyrics provided by YouTube Music service"` on native YouTube Music tracks.
- Preserve the track's visible `Flagged` badge in the working list when "Keep Flagged Track" is clicked (no false-clean inflation), while adding track ID to `keptTrackIds` in `App.jsx` and closing the modal.
- Use cached lyrics from `lyricsByTrackId[track.id]` if already available, evaluating in memory with `lyricEvaluator.js` without dispatching redundant network calls.

**Never:**
- Never mutate a kept track's badge to `Clean` or `Clean Swapped` (honesty and zero false-clean guarantee).
- Never allow modal focus to escape to underlying document while open.
- Never hardcode Spotify track attribution as native YouTube Music without cross-reference disclosure.
- Never break when a track has no lyrics or empty string — display honest "No lyrics available for this track" empty state with jumper disabled.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Open Flagged Track with Cached Lyrics | User clicks "View Lyrics" or flagged snippet on track with `lyricsByTrackId` entry | Modal opens instantly with zero network fetch; displays line numbers `L01`-`Lnn`, rose border on flagged lines, and jumper set to `Flag 1 of N` | Fallback to empty state if parsing fails |
| Uncached Track Lyrics Fetch | Track has no cached lyrics in `lyricsByTrackId` | Modal displays loading spinner; calls `POST /api/scan/track-lyrics`; caches result and renders highlights | Displays inline error banner with error message if request fails |
| Flag Jumper Navigation | Track has 3 flagged lines (e.g. lines 10, 14, 25); jumper starts at `Flag 1 of 3` | Clicking Next jumper moves to `Flag 2 of 3` and scrolls line 14 into view; clicking Next again moves to `Flag 3 of 3`; wraps or stops at boundary | Disabled if `N === 0` |
| Keep Flagged Track | User clicks "Keep Flagged Track" button on flagged track | Invokes `onKeepTrack(track.id)`; track ID added to `keptTrackIds` in `App.jsx`; modal closes; track still displays `Flagged` badge | Safe no-op if track ID is missing |
| Keyboard Escape & Focus Trap | Modal open with focus inside dialog; user presses `Escape` or `Tab` past last element | `Escape` closes modal and restores DOM focus to original trigger element; `Tab` wraps focus to first focusable element inside modal | Ignore keys when modal is unmounted |
| Track Without Lyrics | Track lyrics resolution returns `has_lyrics: False` / `null` | Displays "No lyrics available for this track"; jumper shows `No flags` and buttons disabled; "Keep Flagged Track" remains usable if track was explicit | Graceful UI state without exceptions |

</frozen-after-approval>

## Code Map

- `frontend/src/components/LyricsModal.jsx` -- Upgrade with focus trap (`useRef`, keydown listeners), `Escape` close with trigger focus restoration, monospace `L01`-`Lnn` line numbers, 2px rose border (`#F43F5E`) and subtle wash on flagged lines, inline rose highlighted tags for detected terms, `Flag X of Y` jumper controls with smooth scrolling, platform attribution note, and "Keep Flagged Track" button.
- `frontend/src/components/__tests__/LyricsModal.test.jsx` -- Comprehensive test suite verifying modal accessibility (`role="dialog"`, focus trap, `Escape` key close), line numbering format (`L01`), rose highlighting, jumper navigation (`aria-label="Previous flagged line"`, `aria-label="Next flagged line"`), platform attribution ("Lyrics cross-referenced via YouTube Music"), and "Keep Flagged Track" action.
- `frontend/src/App.jsx` -- Add `keptTrackIds` state (`Set` or array), `handleKeepTrack(trackId)` callback, reset `keptTrackIds` on platform switch in `handleConfirmPlatformSwitch`, pass `keptTrackIds`, `onKeepTrack`, `activePlatform`, and `lyricsByTrackId` to `LyricsModal` and `ScanTab`.
- `frontend/src/components/WorkingListWorkbench.jsx` -- Allow clicking track lyric snippet / flagged reasons to open `LyricsModal`, pass button/trigger ref or event target to `onOpenLyrics` so focus can be restored on close.
- `frontend/src/components/MobileTrackCard.jsx` -- Ensure mobile view supports opening lyrics modal via View Lyrics button and lyric snippets.
- `frontend/src/components/ScanTab.jsx` -- Forward `keptTrackIds` and `onKeepTrack` from `App.jsx` to `WorkingListWorkbench`.
- `backend/app/main.py` -- Update `scan_single_track_lyrics` to resolve Spotify track lyrics via `lyric_xref_service.resolve_lyrics_and_yt_id` when track metadata (title, artist, duration) is provided in `SingleTrackScanRequest`.
- `backend/app/tests/test_single_track_lyrics.py` -- Unit tests validating `POST /api/scan/track-lyrics` behavior for both YouTube Music and Spotify cross-referenced tracks.

## Tasks & Acceptance

**Execution:**
- [x] `backend/app/main.py` -- Extend `SingleTrackScanRequest` to accept track metadata (`title`, `artist`, `duration`, `duration_seconds`) and wire `scan_single_track_lyrics` to use `lyric_xref_service.resolve_lyrics_and_yt_id` when platform is `spotify`.
- [x] `backend/app/tests/test_single_track_lyrics.py` -- Add unit tests for `POST /api/scan/track-lyrics` validating Spotify cross-referencing and error handling.
- [x] `frontend/src/components/LyricsModal.jsx` -- Implement complete modal inspection overlay with focus trap, Escape key focus restoration, monospace line numbers `L01`-`Lnn`, rose border/wash, profanity highlights, `Flag X of Y` jumpers, platform attribution, and Keep Track button.
- [x] `frontend/src/components/__tests__/LyricsModal.test.jsx` -- Create unit tests covering rendering, focus trap, Escape key, line numbers, jumpers, keep button, and platform footer note.
- [x] `frontend/src/components/WorkingListWorkbench.jsx` -- Wire lyric snippet / flagged reasons click to open lyrics modal, and track trigger element for focus restoration.
- [x] `frontend/src/components/MobileTrackCard.jsx` -- Ensure mobile card wires `onOpenLyrics` for view lyrics and snippet clicks.
- [x] `frontend/src/components/ScanTab.jsx` -- Pass `keptTrackIds` and `onKeepTrack` props down to `WorkingListWorkbench`.
- [x] `frontend/src/App.jsx` -- Add `keptTrackIds` state and `handleKeepTrack` callback, reset on platform switch, pass props to `LyricsModal` and `ScanTab`.

**Acceptance Criteria:**
- Given a track in `WorkingListWorkbench`, when the user clicks `View Lyrics` or clicks the row's lyric snippet, then `LyricsModal` opens over backdrop blur (`surface-backdrop` at 80% with `backdrop-blur-md`), focus is trapped within the dialog, and pressing `Escape` closes the modal and restores focus to the trigger.
- Given `LyricsModal` open with loaded lyrics, when inspecting the lyrics viewer, then lyrics display right-aligned line numbers (`L01`-`Lnn`) in monospace font, flagged lines carry a `2px` rose border and subtle rose wash with matched profanity words highlighted in rose tags, `Flag X of Y` jumper buttons allow navigating directly between flagged lines with `aria-label="Previous flagged line"` and `aria-label="Next flagged line"`, and on Spotify tracks the footer displays `"Lyrics cross-referenced via YouTube Music"`.
- Given a flagged track that passes the user's judgment, when the user clicks `Keep Flagged Track`, then the track ID is added to `keptTrackIds` in `App.jsx`, the track's visible `Flagged` badge remains unchanged, and the modal closes.

## Implementation Notes

- **Backend Single Track Lyrics**: Extended `SingleTrackScanRequest` in `backend/app/main.py` with metadata fields (`title`, `artist`, `duration`, `duration_seconds`, `ytmusic_video_id`). Routed Spotify tracks to `lyric_xref_service.resolve_lyrics_and_yt_id` and verified via 6 new unit tests in `backend/app/tests/test_single_track_lyrics.py`.
- **In-Memory Lyric Evaluation & Zero-Fetch Cache**: Integrated `useMemo` in `LyricsModal.jsx` to evaluate already-cached lyrics via `lyricEvaluator.js`, skipping `/api/scan/track-lyrics` when `lyricsByTrackId[track.id]` is present.
- **Accessible Dialog & Focus Trapping**: Configured `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, a keyboard trap for `Tab`/`Shift+Tab`, and `Escape` key close that restores focus to `previousActiveElement` (trigger button).
- **Line Numbers & Rose Highlights**: Formatted right-aligned line numbers as `L01`-`Lnn`, added `border-l-2 border-status-flagged-border bg-status-flagged-bg/30` on flagged lines, and tagged detected profanity words in rose tags.
- **Line Jumpers & Smooth Scroll**: Added `Flag X of Y` jumper controls with `aria-label="Previous flagged line"` and `aria-label="Next flagged line"`, centering each target line smoothly via element refs.
- **Platform Attribution & Keep Action**: Added conditional footer text (`"Lyrics cross-referenced via YouTube Music"` vs `"Lyrics provided by YouTube Music service"`), and wired `Keep Flagged Track` to `onKeepTrack(track.id)` which updates `keptTrackIds` in `App.jsx` and closes the modal.
- **Verification**: Verified 110/110 pytest tests pass, 13/13 LyricsModal vitest tests pass, 0 oxlint errors, and Vite production build succeeds.

## Spec Change Log

## Review Triage Log

| Finding | Verdict | Evidence / Disposition |
|---------|---------|------------------------|
| BH-3: `presetsData?.presets` array index lookup in `evaluateLyrics` | high | patch: backend returns presets as array; convert to object in `LyricsModal.jsx` before passing to `evaluateLyrics`. |
| BH-1 / VG-4: `cleanToken.startsWith(dw)` prefix false-positives | medium | patch: replace `startsWith` with exact word boundary / token match (`cleanToken === dw`). |
| BH-8: Focus steal on App re-render via unstable `onClose` callback | medium | patch: wrap `onClose` in `useRef` so effect does not re-run on App renders. |
| BH-13: Missing `aria-label` on snippet and reason buttons in working list | medium | patch: add `aria-label="Inspect lyric snippet"` and `aria-label="Inspect flagged reasons"` in `WorkingListWorkbench.jsx` and `MobileTrackCard.jsx`. |
| VG-1: Missing test coverage for uncached lyrics caching | low | patch: assert `setLyricsByTrackId` is called in `LyricsModal.test.jsx`. |
| VG-2: Missing test coverage for `Kept Flagged Track` button status | low | patch: add test asserting button text is `'Kept Flagged Track'` when track ID is in `keptTrackIds`. |
| VG-3: Missing test coverage for snippet click in working list / mobile card | low | patch: add tests in `WorkingListWorkbench.test.jsx` and `MobileTrackCard.test.jsx` for snippet button click. |
| EC-1: Empty or whitespace matched terms in highlights | low | patch: filter non-empty string tokens in `LyricsModal.jsx`. |
| EC-2: Shift+Tab focus trap escape when focus is not on focusables | low | patch: handle document.activeElement not in focusables inside Tab handler in `LyricsModal.jsx`. |
| EC-4: Jumper index reset on trackId change | low | patch: reset `currentFlagIndex` to 0 when `trackId` changes. |
| EC-5 / EC-6: Non-numeric snippet line number rendering | low | patch: guard `typeof track.snippets[0]?.line_number === 'number'` in `WorkingListWorkbench.jsx` and `MobileTrackCard.jsx`. |
| BH-5: Cache empty lyrics to avoid repeat fetch | low | patch: store `data.lyrics || ''` in `setLyricsByTrackId` even when lyrics are missing. |
| BH-12: Discarded `yt_id` in single track scan | low | patch: return `"ytmusic_video_id": yt_id` in `scan_single_track_lyrics`. |
| BH-17: Trailing newline phantom line number | low | patch: trim trailing newlines before splitting lyrics text in `LyricsModal.jsx`. |
| BH-4: Replacement UI in LyricsModal | false | reject: per PRD and Epics breakdown, per-track modal clean replacement UI belongs to Story 3.2. |
| BH-14: `sprint-change-proposal-2026-11-07.md` out-of-sync | false | reject: planning doc from separate task; unrelated to Story 2.4. |

## Design Notes

- **Backdrop and Glass Depth:** `fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-backdrop/80 backdrop-blur-md` with container `bg-surface-card border border-border-subtle rounded-2xl shadow-2xl overflow-hidden max-w-2xl w-full max-h-[85vh] flex flex-col`.
- **Monospace Line Numbers:** Formatted as `L${String(idx + 1).padStart(2, '0')}` in monospace font (`font-mono text-xs text-text-muted`), right-aligned with a subtle right border `border-r border-border-subtle/40 pr-3 mr-3`.
- **Rose Flagged Treatment:** Flagged line container has `border-l-2 border-status-flagged-border bg-status-flagged-bg/30 rounded px-1.5 py-0.5`. Matched profanity words have `bg-status-flagged-bg border border-status-flagged-border text-status-flagged px-1.5 py-0.5 rounded text-xs font-mono font-semibold`.
- **Line Jumpers:** Telemetry bar in modal shows `Flag ${currentFlagIndex + 1} of ${totalFlaggedLines}` with up (`Previous flagged line`) and down (`Next flagged line`) chevron buttons. Clicking navigates `currentFlagIndex` and calls `lineRefs.current[flaggedLineNumbers[index]].scrollIntoView({ behavior: 'smooth', block: 'center' })`.
- **Platform Attribution:** Left side of footer shows `Lyrics cross-referenced via YouTube Music` when `activePlatform === 'spotify'` or `track.platform === 'spotify'`, else `Lyrics provided by YouTube Music service`.
- **Keep Flagged Action:** Button in footer styled with `text-text-muted hover:text-text-primary hover:bg-surface-elevated px-3 py-1.5 rounded-lg text-sm font-medium transition-colors`. Clicking adds track ID to `keptTrackIds` and calls `onClose()`.

## Verification

**Commands:**
- `$env:PYTHONPATH="backend"; .\.venv\Scripts\pytest.exe backend/app/tests/` -- expected: All backend tests pass including single track scan tests.
- `npm --prefix frontend test -- src/components/__tests__/LyricsModal.test.jsx` -- expected: All LyricsModal tests pass.
- `npm --prefix frontend run lint` -- expected: 0 lint errors.
- `npm --prefix frontend run build` -- expected: Vite build succeeds with 0 errors.