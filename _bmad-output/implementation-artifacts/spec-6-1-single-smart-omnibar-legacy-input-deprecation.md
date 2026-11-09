---
title: 'Story 6.1: Single Smart Omnibar & Legacy Input Box Deprecation'
type: 'feature'
created: '2026-11-08'
status: 'done'
baseline_commit: '0f7920d804a740ef7339b845cc9fd383bd1e774b'
route: 'dispatch'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Users staging tracks in `ScanTab.jsx` currently face competing, redundant input boxes: a hero `SmartInputBar` and a separate legacy "YouTube Music Playlist URL or Playlist ID" card with duplicate sample buttons. Furthermore, empty workspace state shows nothing below the input area, leaving users without guidance on the 3-step CleanPlaylist workflow.

**Approach:** 
1. Client-Side Input Parser: Extend `frontend/src/utils/inputParser.js` to detect YouTube Music playlist URLs and playlist IDs (`isYouTubePlaylistUrl`, `isYouTubePlaylistId`).
2. Smart Omnibar Enhancements: Update `SmartInputBar.jsx` to intercept YouTube playlist URLs/IDs and authenticated Spotify playlist URLs on submit/enter, routing directly to `onLoadPlaylist`. Add support for opening the Spotify library picker (`onOpenLibraryPicker`) directly from the omnibar action area.
3. Legacy Deprecation: Remove the legacy input container and its duplicate sample buttons from `ScanTab.jsx`, making `SmartInputBar` the sole ingestion omnibar.
4. 3-Step Empty State Hero: Add `EmptyStateHero.jsx` displaying the 3-step visual narrative (Source Music, Screen Rules, Clean Swaps) whenever `workingList` is empty.

## Boundaries & Constraints

**Always:**
- Keep all interactive elements accessible with explicit `aria-label`s and visible labels.
- Follow Obsidian Audio Core design tokens (`bg-surface-card`, `bg-surface-inset`, `border-border-subtle`, `brand-primary`).
- Ensure unauthenticated Spotify playlist URLs continue to trigger `SpotifyPlaylistHelper` with zero network overhead.
- Ensure all Vitest tests pass without regressions.

**Never:**
- Never reintroduce duplicate input containers in `ScanTab.jsx`.
- Never use green colors for Spotify platform chrome; keep green reserved for clean/swapped state tokens.
- Never make unmocked external network calls in tests.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| YouTube Playlist URL entered | User enters `https://music.youtube.com/playlist?list=PL123` and presses Enter | `onLoadPlaylist` invoked with the URL; working list stages returned tracks | Displays caution notice if fetch fails |
| YouTube Playlist ID entered | User enters `PLq9HLaXrThm0pOPOiFHy8a0WHlsIwRANk` and presses Enter | Recognized as YouTube playlist ID; `onLoadPlaylist` called | Displays error notice if invalid ID |
| Unauthenticated Spotify Playlist | User enters Spotify playlist URL without VIP login | Intercepts locally; displays `SpotifyPlaylistHelper` banner | Handled client-side (no network) |
| Authenticated Spotify Playlist | User enters Spotify playlist URL with `vipMode={true}` and presses Enter | Triggers `onLoadPlaylist` directly | Displays error notice if Spotify fetch fails |
| Empty Working List | `workingList.length === 0 && scannedTracks.length === 0` | Displays `EmptyStateHero` below Omnibar explaining 3-step workflow | N/A |
| Populated Working List | `workingList.length > 0` | `EmptyStateHero` is unmounted; `ScreeningControlsBar` and `WorkingListWorkbench` render | N/A |

</frozen-after-approval>

## Code Map

- `frontend/src/utils/inputParser.js` -- Add `isYouTubePlaylistUrl` and `isYouTubePlaylistId`, integrate with `classifyInput`.
- `frontend/src/utils/__tests__/inputParser.test.js` -- Unit tests for YouTube playlist regexes and edge cases.
- `frontend/src/components/EmptyStateHero.jsx` -- New 3-step empty-state hero component styled with Obsidian tokens.
- `frontend/src/components/__tests__/EmptyStateHero.test.jsx` -- Unit tests verifying 3 steps and step copy.
- `frontend/src/components/SmartInputBar.jsx` -- Support playlist submit, sample playlist execution, and "Browse Library" button.
- `frontend/src/components/ScanTab.jsx` -- Remove legacy input container, wire `handleFetchPlaylist` to `SmartInputBar`, render `EmptyStateHero` when empty.
- `frontend/src/components/__tests__/ScanTab.test.jsx` -- Update tests to assert absence of legacy card and presence of EmptyStateHero.
- `frontend/src/components/__tests__/SmartInputBar.test.jsx` -- Add tests for playlist URL handling and submit events.

## Tasks & Acceptance

**Execution:**
- [x] `frontend/src/utils/inputParser.js` -- Add `isYouTubePlaylistUrl` and `isYouTubePlaylistId` helper functions and unit tests.
- [x] `frontend/src/components/EmptyStateHero.jsx` -- Create component rendering the 3-step narrative with Obsidian tokens and unit test.
- [x] `frontend/src/components/SmartInputBar.jsx` -- Add `onLoadPlaylist`, `onOpenLibraryPicker` props, handle playlist detection on submit/Enter, and render "Browse Library" for authenticated Spotify VIPs.
- [x] `frontend/src/components/ScanTab.jsx` -- Deprecate legacy input container, bind `SmartInputBar` handlers, and mount `EmptyStateHero` when list is empty.
- [x] `frontend/src/components/__tests__/ScanTab.test.jsx` -- Verify legacy card removal, SmartInputBar single-entry flow, and EmptyStateHero mounting.

**Acceptance Criteria:**
- Given `ScanTab.jsx`, when rendered, then the legacy "YouTube Music Playlist URL or Playlist ID" container is removed.
- Given `SmartInputBar` with a YouTube playlist URL or ID, when submitted, then `onLoadPlaylist` is invoked.
- Given `SmartInputBar` with an authenticated Spotify user and a Spotify playlist URL, when submitted, then `onLoadPlaylist` is invoked.
- Given an unauthenticated user and a Spotify playlist URL, when submitted or entered, then `SpotifyPlaylistHelper` is displayed.
- Given an empty working list, when viewing `ScanTab`, then `EmptyStateHero` renders with steps `Source Music`, `Screen Rules`, and `Clean Swaps`.

## Implementation Notes

- Added `isYouTubePlaylistUrl`, `isYouTubePlaylistId`, and `isYouTubePlaylist` to `frontend/src/utils/inputParser.js` with comprehensive test coverage in `inputParser.test.js`.
- Created `frontend/src/components/EmptyStateHero.jsx` showcasing the 3-step visual narrative (Source Music, Screen Rules, Clean Swaps) using Obsidian tokens and accessible region labels.
- Extended `frontend/src/components/SmartInputBar.jsx` with `onLoadPlaylist`, `onOpenLibraryPicker`, and `isLoading` props. Utilized `useRef` callbacks to prevent timer thrashing. Handled YouTube and authenticated Spotify playlist submissions directly while preserving `SpotifyPlaylistHelper` for unauthenticated Spotify playlist URLs.
- Removed the deprecated legacy input card, duplicate sample buttons, and unused imports/state in `frontend/src/components/ScanTab.jsx`.
- Mounted `EmptyStateHero` when `currentTracks.length === 0`.
- Verified and aligned test suites in `ScanTab.test.jsx`, `SmartInputBar.test.jsx`, and `EmptyStateHero.test.jsx`. All 39 targeted tests passed cleanly, oxlint reported 0 errors, and `npm --prefix frontend run build` succeeded.

## Spec Change Log

None. Intent and boundaries remained stable throughout execution.

## Review Triage Log

- **Edge Case Hunter:**
  - Finding: Typing a playlist URL triggered premature execution during 300ms debounce rather than on Enter/paste submit.
    - Verdict: `patch`. Resolved by returning early from debounce when a playlist URL is detected and executing only on explicit Enter/Paste.
  - Finding: Cross-platform playlist URL issue in `ScanTab.jsx` `handleFetchPlaylist` when `activePlatform` differed from URL platform.
    - Verdict: `patch`. Resolved by detecting target platform from URL (`isYouTubePlaylist(url) ? 'ytmusic' : isSpotifyPlaylistUrl(url) ? 'spotify' : activePlatform`) and passing it to `/api/playlist/fetch`.
  - Finding: `EmptyStateHero` condition `(!playlist && currentTracks.length === 0)` remained unmounted if tracks were cleared or removed individually while `playlist` object remained.
    - Verdict: `patch`. Resolved by simplifying condition to `{currentTracks.length === 0 && <EmptyStateHero />}`.
- **Blind Hunter:**
  - Finding: Missing loading spinner feedback in `SmartInputBar` while a playlist fetch was in-flight.
    - Verdict: `patch`. Resolved by introducing `isLoading` prop and `isPlaylistLoading` state in `ScanTab`, displaying animated `Loader2` indicator in the omnibar during playlist network calls.
- **Verification Gap Reviewer:**
  - Finding: Missing integration tests in `ScanTab.test.jsx` verifying that typing a YouTube playlist URL into `SmartInputBar` and pressing Enter triggers `/api/playlist/fetch` and populates the workbench while dismissing `EmptyStateHero`.
    - Verdict: `patch`. Added two comprehensive integration tests to `ScanTab.test.jsx`.

## Verification

**Commands:**
- `npm --prefix frontend test -- src/utils/__tests__/inputParser.test.js src/components/__tests__/EmptyStateHero.test.jsx src/components/__tests__/SmartInputBar.test.jsx src/components/__tests__/ScanTab.test.jsx` -- expected: All test suites pass (39/39 passing).
- `npm --prefix frontend run lint` -- expected: Lint passes with 0 errors.
- `npm --prefix frontend run build` -- expected: Production Vite bundle builds successfully.
- `$env:PYTHONPATH="backend"; .\.venv\Scripts\pytest.exe backend/app/tests/` -- expected: All backend unit tests pass (127/127 passing).
