---
title: 'Story 2.6: UI Profanity Masking Toggle & Global Asterisk Obfuscation'
type: 'feature'
created: '2026-11-07'
status: 'done'
baseline_commit: '138744afe5c708ffa9642ca98843b79e559a6c9e'
route: 'dispatch'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** When screening songs in classrooms, family settings, or public presentations, teachers, parents, and presenters risk displaying explicit vulgar words and sensitive terms in plain text across chips, tables, modals, and search excerpts.

**Approach:** Introduce a global `isMasked` state defaulting to `true`, a masking toggle button (`EyeOff`/`Eye`) with `aria-label="Toggle profanity masking"` in `ScreeningControlsBar`, and universal formatting helpers (`maskWord`, `maskText`) that obfuscate terms as `${word[0]}${'*'.repeat(word.length - 1)}` across Custom Blocklist chips, track snippet lines, lyrics modal highlights, and keyword search excerpts, while ensuring internal regex and API calls strictly operate on unmasked literal strings.

## Boundaries & Constraints

**Always:**
- Initialize `isMasked` to `true` (masked by default) on app boot.
- Format single-word explicit tokens by preserving only the first character followed by asterisks (e.g. `fuck` -> `f***`, `shit` -> `s***`, `bitch` -> `b****`). Single-character tokens remain unchanged.
- Apply masking dynamically across:
  1. Custom Blocklist chips in `ScreeningControlsBar`
  2. Detected reason tags and snippets in `WorkingListWorkbench` and `MobileTrackCard`
  3. Flagged line highlights and profanity badge tags in `LyricsModal`
  4. Search keywords and highlighted excerpts in `KeywordSearchWorkbench` (`KeywordsTab`)
- Provide a toggle button in `ScreeningControlsBar` featuring `lucide-react` `EyeOff` (when masked) and `Eye` (when unmasked), styled with Obsidian tokens (`bg-surface-elevated text-text-muted hover:text-text-primary border border-border-subtle`), with explicit `aria-label="Toggle profanity masking"`.
- Follow Red-Green-Refactor TDD for the masking utility and component changes.
- Maintain accessible interactive elements with minimum 44px tap targets or accessible padding and visible labels / aria-labels.

**Never:**
- Never alter internal regex evaluation, scanning algorithms, preset definitions, or backend API request payloads with masked strings (matching and payloads must always execute on literal unmasked strings).
- Never persist masked strings into `customBlocklist` or search keyword state arrays (the state arrays hold unmasked terms; only the UI presentation is masked).
- Never mutate track objects in place in `workingList` or `lyricsByTrackId`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Mask Standard Word | `maskWord('fuck')` | `'f***'` | N/A |
| Mask Multi-Character Word | `maskWord('asshole')` | `'a******'` | N/A |
| Mask Single Character | `maskWord('f')` | `'f'` (unchanged) | N/A |
| Case Preservation | `maskWord('Shit')` | `'S***'` | N/A |
| Empty / Falsy Input | `maskWord('')` or `maskWord(null)` | `''` | Return empty string safely |
| Mask Text Snippet | `maskText("Don't give a fuck", ["fuck"], true)` | `"Don't give a f***"` | Return original text if `!isMasked` or `!words` |
| Blocklist Chip Display | `isMasked = true`, chip `'bitch'` | Chip renders `'b****'`; clicking delete still removes literal `'bitch'` | N/A |
| Toggle Masking Click | User clicks toggle button in `ScreeningControlsBar` | `isMasked` flips from `true` to `false`, icon changes from `EyeOff` to `Eye`, all chips/snippets reveal literal text | N/A |
| Keyword Search Monospace Excerpt | `isMasked = true`, line excerpt has keyword `'drugs'` | Excerpt renders line with `<mark ...>d****</mark>` and hit pill displays `d****: 2x` | N/A |
| Lyrics Modal Flagged Line | `isMasked = true`, flagged token `'cunt'` | Inline token badge displays `'c***'` | N/A |

</frozen-after-approval>

## Code Map

- `frontend/src/utils/masking.js` -- New formatting helper module exporting `maskWord(word)` and `maskText(text, wordsToMask, isMasked)`.
- `frontend/src/utils/__tests__/masking.test.js` -- Unit tests validating `maskWord` and `maskText` covering lengths, casing, punctuation, word boundaries, and falsy inputs.
- `frontend/src/App.jsx` -- Declare `const [isMasked, setIsMasked] = useState(true);`, define `handleToggleMasking = () => setIsMasked(prev => !prev);`, and pass `isMasked` and `onToggleMasking` to `ScanTab`, `KeywordsTab`, and `LyricsModal`.
- `frontend/src/components/ScanTab.jsx` -- Accept `isMasked` and `onToggleMasking` and pass them to `ScreeningControlsBar` and `WorkingListWorkbench`.
- `frontend/src/components/ScreeningControlsBar.jsx` -- Add profanity masking toggle button (`EyeOff`/`Eye`, `aria-label="Toggle profanity masking"`) and render masked custom blocklist chips when `isMasked` is active.
- `frontend/src/components/__tests__/ScreeningControlsBar.test.jsx` -- Add unit tests verifying toggle presence, aria-label, toggle click handler, and masked blocklist chip display.
- `frontend/src/components/WorkingListWorkbench.jsx` -- Accept `isMasked`, pass to `MobileTrackCard`, and mask snippet text and reason tags when `isMasked` is active.
- `frontend/src/components/MobileTrackCard.jsx` -- Accept `isMasked` and mask snippet text and reason tags when `isMasked` is active.
- `frontend/src/components/__tests__/WorkingListWorkbench.test.jsx` -- Add tests verifying snippet and reason masking when `isMasked` is true vs unmasked when false.
- `frontend/src/components/LyricsModal.jsx` -- Accept `isMasked` and mask flagged word tokens and reason text when `isMasked` is active.
- `frontend/src/components/__tests__/LyricsModal.test.jsx` -- Add tests verifying flagged word tokens are masked when `isMasked` is true and revealed when false.
- `frontend/src/components/KeywordsTab.jsx` -- Accept `isMasked`, mask keyword chips, hit-count pills, and `<mark>` highlighted excerpt lines.
- `frontend/src/components/__tests__/KeywordsTab.test.jsx` -- Add tests verifying keyword chips, hit pills, and line excerpt highlights are masked when `isMasked` is true and unmasked when false.

## Tasks & Acceptance

**Execution:**
- [x] `frontend/src/utils/masking.js` -- Implement and export `maskWord(word)` and `maskText(text, wordsToMask, isMasked)`.
- [x] `frontend/src/utils/__tests__/masking.test.js` -- Create comprehensive unit test suite covering word lengths, casing, empty inputs, word boundary regex matching, and multi-word phrases.
- [x] `frontend/src/App.jsx` -- Initialize `isMasked` state to `true` and wire `isMasked` and `onToggleMasking` to `ScanTab`, `KeywordsTab`, and `LyricsModal`.
- [x] `frontend/src/components/ScanTab.jsx` -- Forward `isMasked` and `onToggleMasking` props to `ScreeningControlsBar` and `WorkingListWorkbench`.
- [x] `frontend/src/components/ScreeningControlsBar.jsx` -- Add toggle button with `EyeOff` / `Eye` icon and `aria-label="Toggle profanity masking"`, and mask custom blocklist chips when `isMasked` is true.
- [x] `frontend/src/components/__tests__/ScreeningControlsBar.test.jsx` -- Add tests verifying the masking toggle button and masked blocklist chips.
- [x] `frontend/src/components/WorkingListWorkbench.jsx` & `MobileTrackCard.jsx` -- Mask snippet text and flagged reasons when `isMasked` is true.
- [x] `frontend/src/components/__tests__/WorkingListWorkbench.test.jsx` & `MobileTrackCard.test.jsx` -- Add tests verifying masked snippet display.
- [x] `frontend/src/components/LyricsModal.jsx` -- Mask inline flagged tokens and reasons summary when `isMasked` is true.
- [x] `frontend/src/components/__tests__/LyricsModal.test.jsx` -- Add tests verifying masked inline lyric tokens.
- [x] `frontend/src/components/KeywordsTab.jsx` -- Mask active keyword chips, hit-count pills, and highlighted line excerpt marks when `isMasked` is true.
- [x] `frontend/src/components/__tests__/KeywordsTab.test.jsx` -- Add tests verifying masked keyword chips, pills, and highlighted marks.

**Acceptance Criteria:**
- Given the CleanPlaylist studio interface, when the app mounts, then `isMasked` initializes to `true`, a masking toggle button (`EyeOff`/`Eye`) with `aria-label="Toggle profanity masking"` is accessible in `ScreeningControlsBar`, and clicking it toggles `isMasked`.
- Given any word displayed as an explicit token, blocklist chip, or flagged snippet, when `isMasked` is `true`, then a formatting helper masks the word keeping only the initial character visible followed by asterisks (e.g. "fuck" -> "f***", "shit" -> "s***", single-character unchanged), applying across:
  1. Custom Blocklist chips in `ScreeningControlsBar`
  2. Detected reason tags and snippets in `WorkingListWorkbench` and `MobileTrackCard`
  3. Flagged line highlights and profanity badge tags in `LyricsModal`
  4. Search keywords and highlighted excerpts in `KeywordSearchWorkbench` (`KeywordsTab`).
- Given underlying screening and search mechanisms, when words are masked in the UI, then all internal regex matching, preset definitions, and API payloads continue to operate on the unmasked literal strings.

## Implementation Notes

- Implemented `frontend/src/utils/masking.js` with `maskWord` and `maskText` using whole-word boundary matching (`\b`), regex escaping, and initial-character asterisk replacement (`${word[0]}${'*'.repeat(word.length - 1)}`). Handles single character unchanged, multi-word phrases, empty/falsy values, and case preservation.
- Defaulted `isMasked` state to `true` in `App.jsx` and added toggle handler `handleToggleMasking`. Forwarded state and toggle callback down to `ScanTab`, `KeywordsTab`, and `LyricsModal`.
- Added masking toggle button to `ScreeningControlsBar` with Obsidian tokens, `min-h-[44px]`, `EyeOff`/`Eye` icons, and `aria-label="Toggle profanity masking"`. Masked custom blocklist chips without changing literal values used for deletion or API scanning.
- Masked lyric snippets and flagged reasons across `WorkingListWorkbench` and `MobileTrackCard` when `isMasked` is true.
- Masked inline flagged word badges and summary profanity tags in `LyricsModal` when `isMasked` is true.
- Masked search keyword chips, summary keyword pills, hit pills, and `<mark>` line excerpt tokens in `KeywordsTab` when `isMasked` is true.
- Followed Red-Green-Refactor TDD across all utilities and components.

## Spec Change Log

<!-- Append-only. Populated by step-04 during review loops. -->

## Review Triage Log

| Finding | Verdict | Evidence / Disposition |
|---------|---------|------------------------|
| EC-1: `LyricsModal.jsx:555` non-string reason mapping | low | patch: added defensive guard `typeof r !== 'string' ? r : (!r.includes(' ') ? ...)` in `LyricsModal.jsx`. |
| EC-2: `masking.js:38` astral Unicode surrogate pairs | low | patch: used `Array.from(word)` for character counting and extracting the initial character. |
| EC-3: `masking.js:69` symbol-prefixed tokens | false | reject: CleanPlaylist explicit tokens are natural language word tokens bounded by `\b` matching `ScannerService`. |
| BH-1: `maskText` inflections and apostrophes | false | reject: `wordsToMask` is populated from `matched_terms`, which already contains the inflected tokens from `ScannerService`. |
| BH-2: `KeywordsTab.jsx` non-keyword profanity masking | false | reject: AC specifies `KeywordSearchWorkbench` masks target search keywords and highlighted excerpts. |
| BH-3: `WorkingListWorkbench` wordsToMask population | false | reject: `matched_terms` and `detected_terms` accurately identify all flagged tokens for the track. |
| BH-4: `ScanTab` customBlocklist prop forwarding | low | patch: `getTrackFlaggedWords` covers all track detected terms and snippets; blocklist terms matching lyrics are already added to `snippet.matched_terms`. |
| BH-5: `LyricsModal.jsx` tokenization multi-word phrases | false | reject: `detectedWords` contains normalized individual word tokens from scanning. |
| BH-6: `ScreeningControlsBar.jsx` toggle button missing `aria-pressed` | medium | patch: added `aria-pressed={isMasked}` to the toggle button per W3C WAI-ARIA guidelines. |
| BH-7: Component default prop values `isMasked = false` | medium | patch: changed default prop values to `isMasked = true` across all components to ensure secure-by-default behavior in isolation. |
| BH-8: `sprint-status.yaml` status update | false | reject: sprint status transitions are managed by build workflow steps. |
| BH-9: Duplicate `getTrackFlaggedWords` implementation | low | patch: extracted shared `getTrackFlaggedWords` to `frontend/src/utils/masking.js` and imported into `WorkingListWorkbench` and `MobileTrackCard`. |
| BH-10: KeywordsTab/LyricsModal in-context toggle | false | reject: AC explicitly specifies placing the toggle in `ScreeningControlsBar`. |
| VG-1: ScanTab `isMasked` / `onToggleMasking` forwarding test gap | medium | patch: added unit test in `ScanTab.test.jsx` verifying `isMasked` and `onToggleMasking` are forwarded to children. |
| VG-2: MobileTrackCard mobile viewport test gap | medium | patch: added unit test in `WorkingListWorkbench.test.jsx` with `window.innerWidth = 500` verifying mobile cards display masked snippets when `isMasked={true}`. |

## Design Notes

- **Toggle Button Placement & Styling**: In `ScreeningControlsBar`, place the masking toggle button adjacent to the sensitivity preset controls or in the bar header:
  `bg-surface-elevated hover:bg-surface-elevated/80 text-text-muted hover:text-text-primary border border-border-subtle p-2 rounded-xl flex items-center gap-1.5 transition text-xs cursor-pointer min-h-[44px]`
  Featuring `EyeOff` (masked, default) and `Eye` (unmasked) icons from `lucide-react`.
- **Masking Invariant**: `${word[0]}${'*'.repeat(word.length - 1)}`.
- **Text Replacement Boundary**: When masking full snippets or lines, compile regex `\b${escapeRegex(w)}\b` with `gi` flag so only target word tokens are obfuscated without mangling neighboring punctuation or surrounding lyrics.

## Verification

**Commands:**
- `npm --prefix frontend test` -- expected: All frontend unit tests pass including masking utility and component tests.
- `npm --prefix frontend run lint` -- expected: Zero lint errors (`oxlint`).
- `npm --prefix frontend run build` -- expected: Vite production build succeeds with 0 errors.
- `$env:PYTHONPATH="backend"; .\.venv\Scripts\pytest.exe backend/app/tests/` -- expected: All backend tests pass.
