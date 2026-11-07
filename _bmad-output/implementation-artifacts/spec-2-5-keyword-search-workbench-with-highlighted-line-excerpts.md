---
title: 'Story 2.5: Keyword Search Workbench with Highlighted Line Excerpts'
type: 'feature'
created: '2026-11-07'
status: 'done'
baseline_commit: '1b7d63d81c49ebedd6c2d3ce1a6d90d48c8bb209'
route: 'dispatch'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Users screening music for specific thematic boundaries (such as substances, violence, or wealth) currently lack a dedicated workbench to find exact term occurrences across playlist lyrics without manually reading every song's entire text or mutating their screening verification statuses.

**Approach:** Upgrade `KeywordsTab.jsx` into the Obsidian Audio Core Keyword Search Workbench with pre-seeded theme chips (`money`, `drugs`, `party`, `alcohol`, `gun`), custom keyword entry, hybrid instant in-memory search for cached lyrics with chunked `<= 15` track backend lookups for uncached songs, summary telemetry with honest `lyrics_unavailable_count`, hit-count badges, and expandable `[Lnn]` monospace excerpt lines with `<mark>` keyword highlights.

## Boundaries & Constraints

**Always:**
- Use Obsidian Audio Core tokens (`bg-surface-canvas`, `bg-surface-card`, `border-border-subtle`, `text-text-primary`, `text-text-muted`, `bg-brand-primary` `#7C3AED`, `bg-surface-inset`) and `lucide-react` icons; never use legacy arbitrary slate or amber-pink gradient styles.
- Resolve lyrics on the backend via `lyric_xref_service.resolve_lyrics_and_yt_id(track, platform)` for both Spotify (cross-referenced) and YouTube Music tracks, caching resolved lyrics in `lyrics_by_id` response payloads.
- Chunk uncached lyric requests to `POST /api/scan/keywords` in batches of `<= 15` tracks with explicit `platform: activePlatform`.
- For tracks already present in `lyricsByTrackId`, perform in-memory instant search with 0 network calls.
- Include `lyrics_unavailable_count` in the summary header alongside total keyword occurrences and matched tracks count.
- When `workingList` is empty, display a centered studio card explaining that tracks must be added first, with a 1-click CTA button routing back to `Scan & Clean`.
- Provide accessible `role`, `aria-label`, and interactive element attributes on all buttons and inputs with at least 44px tap targets.

**Never:**
- Never mutate or overwrite `workingList` track `verification_status` or flagged properties when searching keywords.
- Never make live external network calls in unit tests; mock platform services and `global.fetch`.
- Never use unauthenticated `spotify_service.get_track_lyrics()` directly for Spotify tracks since Spotify has no native lyric endpoint.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Empty Working List | `workingList.length === 0` | Centered card with icon, explanation, and CTA button calling `onNavigateToScan` to switch to `scan` tab | N/A |
| Starter Theme Chips | Tab mounted with non-empty `workingList` | Chips (`money`, `drugs`, `party`, `alcohol`, `gun`) pre-seeded with remove buttons; custom keyword input and `+ Add Keyword` button active | N/A |
| Add Custom Keyword | User types `"hustle"` and presses Enter or clicks `+ Add Keyword` | `"hustle"` added to active keywords list (trimmed, lowercased, deduplicated); input cleared | Ignore empty or whitespace-only inputs |
| Remove Keyword Chip | User clicks remove icon on `"party"` chip | `"party"` removed from keyword list | If list becomes empty, require >=1 keyword before searching |
| Instant In-Memory Search | All tracks present in `lyricsByTrackId` | Immediate search evaluation with 0 `fetch` requests, rendering summary and matched track rows | N/A |
| Uncached Tracks Search | Tracks missing from `lyricsByTrackId` | `POST /api/scan/keywords` called in chunks of `<= 15` tracks with `platform: activePlatform`; returned lyrics saved to `lyricsByTrackId` | Display error alert on request failure, restore search button state |
| Spotify Track Resolution | Spotify track in uncached search chunk | Backend calls `lyric_xref_service.resolve_lyrics_and_yt_id(track, "spotify")`, matching duration $\pm 10$s | Returns `has_lyrics: False` if no match found; increments `lyrics_unavailable_count` |
| Monospace Line Excerpts | Matched track with 3 hits | Row shows hit pills (e.g. `money: 2x`, `drugs: 1x`) and `3 matching lines ↓`; expanding shows `[L04]` and `[L12]` with `<mark>` highlighted words | Safe line splitting handling CRLF, LF, and trailing newlines |
| No Keyword Matches | Search completed with 0 matches across songs | Summary shows 0 occurrences; empty findings card states no songs contained the target keywords | N/A |

</frozen-after-approval>

## Code Map

- `frontend/src/utils/lyricEvaluator.js` -- Add and export `searchLyricsKeywords(lyrics, targetKeywords)` performing in-memory whole-word regex matching `\b{kw}\b` per line, returning `{ matched, total_matches, keywords_found, snippets: [{ line_number, text, matched_keywords }] }`.
- `frontend/src/utils/__tests__/lyricEvaluator.test.js` -- Unit tests validating `searchLyricsKeywords` matching, line numbering, multi-word keywords, and case insensitivity.
- `backend/app/main.py` -- Update `search_keywords_in_playlist` endpoint to resolve lyrics via `lyric_xref_service.resolve_lyrics_and_yt_id`, calculate `lyrics_unavailable_count`, and return `lyrics_by_id` map alongside `summary` and `results`.
- `backend/app/tests/test_keywords_scan.py` -- Backend unit tests verifying `POST /api/scan/keywords` input validation, YouTube Music & Spotify resolution, summary counts, and error handling.
- `frontend/src/components/KeywordsTab.jsx` -- Overhaul into Obsidian Audio Core Keyword Search Workbench: pre-seeded chips, custom term input, hybrid in-memory / `<= 15` chunk network search, empty state card with CTA, summary header with occurrences & `lyrics_unavailable_count`, hit-count pills, and expandable `[Lnn]` monospace line excerpts with `<mark>` highlights.
- `frontend/src/components/__tests__/KeywordsTab.test.jsx` -- React Testing Library test suite covering chip management, empty working list CTA, cached in-memory search, chunked backend search, summary metrics, and excerpt expansion.
- `frontend/src/App.jsx` -- Pass `workingList`, `lyricsByTrackId`, `setLyricsByTrackId`, and `onNavigateToScan` (`() => setActiveTab('scan')`) to `KeywordsTab`.

## Tasks & Acceptance

**Execution:**
- [x] `frontend/src/utils/lyricEvaluator.js` -- Implement and export `searchLyricsKeywords(lyrics, targetKeywords)` for fast in-memory keyword scanning.
- [x] `frontend/src/utils/__tests__/lyricEvaluator.test.js` -- Add tests verifying `searchLyricsKeywords` regex matching, hit counts, line snippets, and case-folding.
- [x] `backend/app/main.py` -- Refactor `search_keywords_in_playlist` to use `lyric_xref_service.resolve_lyrics_and_yt_id`, count `lyrics_unavailable_count`, and return `lyrics_by_id`.
- [x] `backend/app/tests/test_keywords_scan.py` -- Create comprehensive unit test suite for `POST /api/scan/keywords`.
- [x] `frontend/src/components/KeywordsTab.jsx` -- Re-architect UI with Obsidian Audio Core tokens, starter theme chips, empty state CTA, hybrid search runner, summary header, and collapsible `[Lnn]` highlighted excerpts.
- [x] `frontend/src/components/__tests__/KeywordsTab.test.jsx` -- Add unit tests verifying starter chips, custom keyword add/remove, empty state CTA, hybrid evaluation, and hit pill / snippet rendering.
- [x] `frontend/src/App.jsx` -- Wire `workingList`, `lyricsByTrackId`, `setLyricsByTrackId`, and `onNavigateToScan` props into `<KeywordsTab />`.

**Acceptance Criteria:**
- Given the `Keyword Search` tab selected with a non-empty `workingList`, when the tab mounts, then starter theme chips (`money`, `drugs`, `party`, `alcohol`, `gun`) are pre-seeded and removable, and user can type custom terms into an input and click `+ Add Keyword`.
- Given selected keywords and staged tracks, when the user clicks `Search Keywords Across Working List`, then for tracks present in `lyricsByTrackId`, `lyricEvaluator.js` searches line matches instantly in memory with 0 network calls, and for uncached tracks, client calls `POST /api/scan/keywords` in chunks of `<= 15` tracks with `platform: activePlatform` and updates `lyricsByTrackId`.
- Given search results returned, when viewing matched tracks, then summary header displays total keyword occurrences and `lyrics_unavailable_count`, each matched track row shows hit-count pills (e.g. `money: 4x`), and expanding `N matching lines ↓` reveals monospace line excerpts `[Lnn]` with `<mark>` highlighted keyword tokens.
- Given the `Keyword Search` tab opened with an empty `workingList`, when viewed, then a centered studio card explains that tracks must be added first, with a 1-click button routing back to `Scan & Clean`.

## Implementation Notes

- Added `searchLyricsKeywords(lyrics, targetKeywords)` to `frontend/src/utils/lyricEvaluator.js` using whole-word regex with `\b` word boundaries, case-insensitivity, CRLF line normalization, and line snippet generation.
- Created `test_keywords_scan.py` testing route registration, 400 error handling on empty or whitespace keywords, YouTube Music and Spotify lyrics cross-referencing via `lyric_xref_service.resolve_lyrics_and_yt_id`, `lyrics_unavailable_count` metrics, and `lyrics_by_id` response caching.
- Updated `POST /api/scan/keywords` in `backend/app/main.py` to resolve lyrics via `lyric_xref_service.resolve_lyrics_and_yt_id` concurrently with `ThreadPoolExecutor`, count `lyrics_unavailable_count`, and return `lyrics_by_id` dictionary.
- Replaced legacy UI in `frontend/src/components/KeywordsTab.jsx` with Obsidian Audio Core tokens (`bg-surface-card`, `border-border-subtle`, `text-text-primary`, `text-text-muted`, `bg-brand-primary`).
- Integrated pre-seeded theme chips (`money`, `drugs`, `party`, `alcohol`, `gun`) with removable actions, custom keyword addition with trimming/deduplication, and empty state studio card with 1-click CTA `Add Tracks in Scan & Clean` navigating via `onNavigateToScan`.
- Added hybrid search execution: instant in-memory scanning via `searchLyricsKeywords` for tracks present in `lyricsByTrackId` with 0 network calls, and chunked batches (`<= 15`) sent to `POST /api/scan/keywords` for uncached tracks with `platform: activePlatform`.
- Rendered hit pills (`keyword: Nx`), collapsible monospace line excerpts `[Lnn]`, and highlighted keywords using `<mark>` with Obsidian violet styling.
- Wired `workingList`, `lyricsByTrackId`, `setLyricsByTrackId`, and `onNavigateToScan` from `App.jsx` to `KeywordsTab`.

## Spec Change Log

<!-- Append-only. Populated during review loops. -->

## Review Triage Log

| Finding | Verdict | Evidence / Disposition |
|---------|---------|------------------------|
| EC-1 / BH-6: Regex alternation shadowing in `renderHighlightedLine` | medium | patch: sort `matchedKeywords` by descending string length before compiling regex alternator so multi-word phrases match before sub-words. |
| BH-2: Mobile suppression of keyword hit-count pills | medium | patch: replace `hidden sm:flex` with `flex flex-wrap gap-1` on hit pills so mobile users see hit counts per AC. |
| BH-3: Sub-minimum touch target height on excerpt expand button | low | patch: change `min-h-[36px]` to `min-h-[44px]` in `KeywordsTab.jsx` to satisfy accessibility 44px tap target rule. |
| BH-1 / VG-Other: Prop destructuring `_playlist`, `_onOpenLyrics` in `KeywordsTab.jsx` | low | patch: correctly destructure `playlist` and `onOpenLyrics` and wire `onOpenLyrics` to track rows. |
| BH-5: Cache unavailable lyrics as empty string to prevent redundant network calls | medium | patch: return `lyrics or ""` in `backend/app/main.py` and check `cachedLyricsMap[t.id] !== undefined` so failed lyrics are cached and not re-fetched every search. |
| EC-3: `stagedTracks` fallback suppresses empty card when `workingList` is empty | low | patch: check `props.workingList !== undefined ? workingList : (scannedTracks || [])` so empty `workingList` correctly shows empty card. |
| BH-8: Missing `aria-live` status announcement during background scanning | low | patch: add `aria-live="polite"` live region announcing scanning status for screen readers. |
| BH-7: Input handling lacks multi-term comma splitting | low | patch: split by comma in `handleAddKeyword` when user pastes comma-separated terms. |
| BH-10: Include `ytmusic_video_id` in backend keyword track results | low | patch: attach resolved `ytmusic_video_id` to results items in `backend/app/main.py`. |
| BH-4: Preserve intermediate lyrics on multi-chunk error | low | patch: update `setLyricsByTrackId` with intermediate fetched lyrics even if a subsequent chunk throws. |
| VG-1: Missing test for hybrid mixed cached and uncached search | medium | patch: add unit test in `KeywordsTab.test.jsx` verifying mixed cached/uncached tracks search and order preservation. |
| VG-2: Missing test for `lyrics_unavailable_count` in summary banner | medium | patch: add unit test in `KeywordsTab.test.jsx` verifying `(N without lyrics)` displays when lyrics are missing. |
| VG-3: Missing test for empty findings state when no target keywords match | medium | patch: add unit test in `KeywordsTab.test.jsx` verifying empty findings message renders when matches = 0. |
| EC-2: Non-word character symbols in keywords | false | reject: keywords are natural words with `\b` boundaries matching backend ScannerService; spec AC uses word tokens. |
| BH-9: Missing separate card for tracks with unavailable lyrics | false | reject: AC specifies `lyrics_unavailable_count` in summary header and matched tracks row list; missing tracks should not clutter findings. |

## Design Notes

- **Obsidian Audio Core Theme**: Card containers styled with `bg-surface-card border border-border-subtle rounded-2xl shadow-xl p-5`, text styled with `text-text-primary` and `text-text-muted`.
- **Theme Chips**: Removable badge styled with `bg-surface-elevated text-brand-secondary border border-border-subtle px-3 py-1 rounded-full text-xs font-medium inline-flex items-center space-x-1.5`.
- **Search Action Button**: Styled with `bg-brand-primary hover:bg-brand-primary-hover text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-lg transition disabled:opacity-50 flex items-center justify-center space-x-2`.
- **Empty State Studio Card**: Centered card within `max-w-md mx-auto my-12 text-center p-8 bg-surface-card border border-border-subtle rounded-2xl space-y-4` featuring a music/search icon and a prominent CTA button `Add Tracks in Scan & Clean` navigating via `onNavigateToScan`.
- **Monospace Line Numbering**: Line numbers formatted as `[L${String(snip.line_number).padStart(2, '0')}]` in monospace font (`font-mono text-xs text-text-muted select-none w-12 text-right mr-3`).
- **Highlighted Tokens**: Highlighted term wrapped in `<mark className="bg-brand-primary/20 text-brand-primary border border-brand-primary/30 font-semibold px-1 py-0.5 rounded mx-0.5">`.

## Verification

**Commands:**
- `$env:PYTHONPATH="backend"; .\.venv\Scripts\pytest.exe backend/app/tests/test_keywords_scan.py` -- expected: All keyword backend scan tests pass.
- `npm --prefix frontend test -- src/utils/__tests__/lyricEvaluator.test.js src/components/__tests__/KeywordsTab.test.jsx` -- expected: All evaluator and KeywordsTab frontend tests pass.
- `npm --prefix frontend run lint` -- expected: 0 lint errors (`oxlint`).
- `npm --prefix frontend run build` -- expected: Vite build succeeds with 0 errors.
