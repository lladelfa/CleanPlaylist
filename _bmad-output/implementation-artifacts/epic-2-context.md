# Epic 2 Context: Cross-Platform Lyric Screening & Verification Workbench

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Users can evaluate staged tracks on both Spotify and YouTube Music using sensitivity presets and custom blocklists (backed by automated Spotify-to-YouTube Music lyric cross-referencing), inspect highlighted profanity snippets with line jumpers in an inspection modal, search custom keywords across cached lyrics, view honest verification status badges without false-clean inflation, and shield sensitive viewers with default on-screen profanity masking.

## Stories

- Story 2.1: Spotify-to-YouTube Lyric Cross-Reference Engine (`lyric_xref_service.py`)
- Story 2.2: Progressive Categorized Lyric Scan & Verification Status State Machine
- Story 2.3: Screening Controls Bar, Presets, & Client-Side In-Memory Evaluation (`lyricEvaluator.js`)
- Story 2.4: Lyrics Modal Inspection Overlay, Line Jumpers, & Keep Action
- Story 2.5: Keyword Search Workbench with Highlighted Line Excerpts
- Story 2.6: UI Profanity Masking Toggle & Global Asterisk Obfuscation

## Requirements & Constraints

- **Cross-Platform Lyric Resolution**: Spotify tracks must resolve lyrics via YouTube Music cross-referencing matching normalized title, primary artist, and track duration ($\pm 10$ seconds tolerance, falling back to top song match when duration is 0) to prevent mismatched covers or remixes.
- **Zero False-Clean Safety Invariant**: Under no circumstance may a track with missing or failed lyrics resolve to `Verified Clean`. Tracks without lyrics display an amber `Lyrics Unavailable` warning, or `Flagged` if metadata indicates explicit content under an active preset checking metadata.
- **Progressive Scanning Latency**: Staged tracks scan in progressive client-managed chunks: an initial chunk ($\le 10$ tracks) rendering verdicts in $\le 3$ seconds, followed by subsequent chunks ($\le 15$ tracks) completing 50 tracks in $\le 25$ seconds, with progress announced via `aria-live="polite"`.
- **Dual-Tier Deterministic Evaluation**: The backend evaluates lyrics on initial network retrieval; the client evaluates already-cached lyrics locally in memory with 0 network calls when presets or custom blocklist chips change, using identical regex tokenization and morphological suffixes (`(?:ing|ed|s|es)?`) to guarantee byte-for-byte identical verdicts.
- **Categorized Lyric Detections**: Scans categorize detections into `slurs`, `strong_profanity`, `mild_profanity`, `sexual`, `substances`, and `custom`, retaining full un-truncated line snippets, detected term occurrences, and total hit counts.
- **Line-Numbered Lyric Inspection & Navigation**: Users can inspect lyrics with right-aligned line numbers (`L01`–`Lnn`), jump between highlighted flagged lines via navigation buttons, view cross-reference source attribution on Spotify tracks, and explicitly keep borderline songs without changing the underlying flagged badge.
- **Thematic Keyword Search**: Users can search custom thematic keywords across staged tracks without mutating working list verification statuses, searching cached lyrics instantly in memory and chunking uncached tracks ($\le 15$ per request), displaying hit counts and collapsible highlighted line excerpts.
- **Default On-Screen Profanity Masking**: Vulgar words, custom blocklist chips, and detected keyword matches default to masked display across all UI surfaces (e.g., `fuck` $\to$ `f***`), with an accessible toggle in the screening controls to unmask on demand. All internal regex screening, preset lists, and API payloads operate exclusively on raw unmasked strings.
- **Funnel Telemetry**: Completed scans and in-memory preset re-evaluations emit a single `scan_completed` event with preset ID, track count, flagged count, and accurate `lyrics_unavailable_count` (including explicit tracks with missing lyrics) without logging song queries, URLs, or PII.

## Technical Decisions

- **API Contracts**:
  - `GET /api/presets`: Returns `PRESET_PROFILES`, `WORD_CATEGORIES`, and morphological suffix rule `(?:ing|ed|s|es)?`.
  - `POST /api/scan/playlist`: Accepts up to 15 tracks, `deep_scan_lyrics: bool = True`, returning `{tracks: ScannedTrackItem[], summary, lyrics_by_id: Dict[str, str]}`.
  - `POST /api/scan/track-lyrics`: Evaluates single track lyrics for modal inspection, taking track identifiers, preset, blocklist, and platform.
  - `POST /api/scan/keywords`: Evaluates custom keywords across uncached tracks in chunks of $\le 15$, returning hit counts and line excerpts.
  - All endpoints require explicit `platform: activePlatform` in request bodies and communicate via relative `/api/*` URLs.
- **Track Data Models**:
  - `TrackScanItem`: Canonical 12-key envelope (`id`, `title`, `artist`, `artists_list`, `album`, `duration`, `duration_seconds`, `is_explicit`, `thumbnail`, `video_url`, `ytmusic_video_id`, `verification_status`).
  - `ScannedTrackItem`: Extends `TrackScanItem` with `is_flagged: bool`, `reasons: List[str]`, `snippets: List[Dict]`, `detected_terms: List[Dict]`, and `total_flagged_count: int`.
- **Sole Lyric Resolution Owner (`lyric_xref_service.py`)**:
  - Single server entry point for lyric resolution across all scan endpoints. Normalizes title/artist (stripping parenthetical labels like "Remastered" or "feat."), enforces the $\pm 10$s duration window, and catches upstream errors gracefully returning `None`.
  - Stashes resolved `ytmusic_video_id` onto the track dictionary for downstream Clean Queue assembly.
- **Two-Tier Caching Architecture**:
  - Server: `YTMusicService._lyrics_cache` (LRU cache `maxsize=512`) stores `(ytmusic_video_id, lyrics)` pairs.
  - Client: `App.jsx` root state maintains `lyricsByTrackId: Record<string, string>`, populated from top-level `lyrics_by_id` response dicts and shared across all tabs and modals.
- **Verification Status State Machine**:
  - Five distinct statuses: `unscanned`, `verified_clean`, `flagged`, `clean_swapped`, `lyrics_unavailable`.
  - Status becomes `verified_clean` iff `has_lyrics == True` AND `total_flagged_count == 0` AND (`not include_metadata_explicit or not is_explicit`).
  - If `has_lyrics == False`: resolves to `flagged` (citing platform explicit tag and missing lyrics) when metadata is explicit under a preset checking metadata, else `lyrics_unavailable`.
- **Client-Side Screening Evaluator (`lyricEvaluator.js`)**:
  - Initialized with data from `GET /api/presets`.
  - Evaluates tracks in memory over `lyricsByTrackId` during preset switches or blocklist chip edits, triggering `POST /api/telemetry/event` (`scan_completed`) to maintain accurate analytics funnels.
- **On-Screen Masking Presentation Helper**:
  - Pure presentation helper `${word[0]}${'*'.repeat(word.length - 1)}` (preserving single-character tokens) applied strictly at the render layer.

## UX & Interaction Patterns

- **ScreeningControlsBar**:
  - Elevated card container (`bg-surface-card`, `border-border-subtle`, `rounded-md`).
  - Preset selector pills (`kid_safe`, `moderate`, `slurs_only`, `custom`).
  - Custom Blocklist: inline text input with `Enter` / `+ Add term` appending trimmed, lowercased, deduplicated chips (`rounded-full`) with `aria-label="Remove blocklist term {term}"`.
  - Profanity Masking Toggle: button toggling `isMasked` between `true` and `false` with `EyeOff` / `Eye` icon and `aria-label="Toggle profanity masking"`.
  - Primary `Scan Lyrics` button displaying live chunk progress (`Scanned X of Y` via `aria-live="polite"`).
- **VerificationStatusBadge**:
  - Icon and text paired on every badge:
    - `Verified Clean`: emerald (`text-status-clean`, `bg-status-clean-bg`) with `CheckCircle2`.
    - `Flagged`: rose (`text-status-flagged`, `bg-status-flagged-bg`) with `AlertTriangle` / `AlertCircle`.
    - `Lyrics Unavailable`: amber (`text-status-caution`, `bg-status-caution-bg`) with `FileQuestion`.
    - `Clean Swapped`: emerald with `CheckCircle2`.
    - `Unscanned`: neutral border (`bg-surface-highest`) with `Clock` / `HelpCircle`.
- **LyricsModal**:
  - Modal dialog (`max-w-2xl`, `bg-surface-card`, `rounded-xl`) over backdrop (`surface-backdrop` at 80% opacity, `backdrop-blur-md`). Strictly 1-level stacking.
  - Keyboard accessible: focus trapped inside modal, `Escape` key closes dialog and returns focus to the trigger.
  - Inset lyrics pane (`bg-surface-inset`) with right-aligned monospace line numbers (`JetBrains Mono`, `L01`–`Lnn`).
  - Flagged line highlights: `2px` rose left border, subtle rose wash, rose profanity violation tags.
  - Line jumpers: `Flag X of Y ↑ ↓` buttons with `aria-label="Previous flagged line"` and `aria-label="Next flagged line"`.
  - Spotify attribution footer: `"Lyrics cross-referenced via YouTube Music"`.
  - `Keep Flagged Track` action adds track ID to `keptTrackIds` in `App.jsx`, qualifying the track for finish-line actions without altering its visible `Flagged` badge.
- **KeywordSearchWorkbench**:
  - Removable starter theme chips (`money`, `drugs`, `party`, `alcohol`, `gun`) and custom keyword input.
  - Results card: summary header with occurrence count and `lyrics_unavailable_count`, per-track hit pills (`money: 4x`), and expandable `[Lnn]` monospace excerpt lines with `<mark>` keyword highlights.
  - Empty working list card with 1-click CTA button routing back to `Scan & Clean`.
- **Accessibility Floor**:
  - 44px minimum tap targets on mobile (`MobileTrackCard`).
  - Verbatim `aria-label` attributes on all icon-only buttons.
  - Respects `prefers-reduced-motion: reduce` by disabling smooth-scroll jumps and pulse animations.

## Cross-Story Dependencies

- **Story 2.1 (`lyric_xref_service.py`)** is the foundational backend service for cross-platform lyric lookups and `ytmusic_video_id` resolution; it is required by batch scanning (Story 2.2), modal inspection (Story 2.4), and keyword search (Story 2.5).
- **Story 2.2 (Scan Pipeline & Status State Machine)** establishes `POST /api/scan/playlist`, `ScannedTrackItem`, `lyrics_by_id`, and `VerificationStatusBadge`, which are consumed by `ScreeningControlsBar` (Story 2.3), `LyricsModal` (Story 2.4), and `WorkingListWorkbench`.
- **Story 2.3 (`ScreeningControlsBar` & `lyricEvaluator.js`)** consumes `GET /api/presets` and hydrated `lyricsByTrackId` from Story 2.2 to enable zero-network-call client re-evaluation.
- **Story 2.4 (`LyricsModal`)** consumes single-track lyric resolution from Story 2.1 and flagged snippet metadata from Story 2.2, while providing the `Keep Flagged Track` action that feeds into `readyTracks`.
- **Story 2.5 (`KeywordSearchWorkbench`)** reuses `lyricEvaluator.js` for in-memory keyword scanning over cached lyrics and uses Story 2.1 for uncached track resolution.
- **Story 2.6 (Profanity Masking Toggle)** layers universal visual obfuscation over the chips, badges, snippets, and excerpt components built across Stories 2.2 through 2.5.
- **Epic Boundaries**:
  - Epic 1 provides the staged 10-key `workingList` and active platform context.
  - Epic 2 outputs `verification_status`, flagged snippets, and resolved `ytmusic_video_id`s required by Epic 3 for Clean Replacement matching and Clean Queue playback.
