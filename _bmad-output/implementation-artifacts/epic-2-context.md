# Epic 2 Context: Cross-Platform Lyric Screening & Verification Workbench

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Users can evaluate staged tracks on both platforms using Sensitivity Presets and Custom Blocklists (with automated Spotify-to-YouTube Music Lyric Cross-Reference), inspect highlighted profanity snippets with line jumpers in LyricsModal, search custom keywords across cached lyrics, and view honest Verification Status badges without false-clean inflation.

## Stories

- Story 2.1: Spotify-to-YouTube Lyric Cross-Reference Engine (lyric_xref_service.py)
- Story 2.2: Progressive Categorized Lyric Scan & Verification Status State Machine
- Story 2.3: Screening Controls Bar, Presets, & Client-Side In-Memory Evaluation
- Story 2.4: Lyrics Modal Inspection Overlay, Line Jumpers, & Keep Action
- Story 2.5: Keyword Search Workbench with Highlighted Line Excerpts

## Requirements & Constraints

- Automated Spotify-to-YouTube Music Lyric Cross-Reference resolves song lyrics for Spotify tracks without requiring Spotify OAuth or credentials.
- Zero false-clean guarantee: tracks without verified clean lyrics display honest badges (e.g. Unscanned, No Lyrics, Scan Error) and are never falsely marked Clean.
- Progressive scanning: client-side chunking dispatches initial batch of <= 10 tracks (verdict <= 3s) followed by batches of <= 15 tracks (completing 50 tracks in <= 25s) with aria-live progress.
- Dual-tier evaluation: backend evaluates lyrics on initial fetch; frontend (`lyricEvaluator.js`) evaluates already-cached lyrics in memory with 0 network calls when presets or custom blocklists change, matching server verdicts byte-for-byte.
- Lyrics Modal provides full lyrics display, highlighted profanity snippets, instant line jumpers, and a Keep Track action that preserves user intent.
- Keyword Search allows on-demand searching across cached lyrics with snippet highlighting without mutating the main Working List verification state.

## Technical Decisions

- Architecture (AD-5): `lyric_xref_service.resolve_lyrics_and_yt_id(track, platform)` is the sole server entry point for lyric resolution across all scan endpoints.
- Matching logic: On Spotify, search YT Music (`filter="songs"`, `limit=5`) matching normalized title + primary artist AND duration match `abs(yt_duration - spotify_duration) <= 10s` (fallback to top normalized song match only if duration is 0).
- Caching: In-memory LRU cache `YTMusicService._lyrics_cache` (maxsize=512) caches `(ytmusic_video_id, lyrics)` to prevent duplicate lookups.
- State Machine (SM-3, SM-C1): Verification statuses are `unscanned`, `scanning`, `flagged`, `verified_clean`, `no_lyrics`, and `scan_error`.
- Categorized profanity rules and regex patterns: Suffix matching `(?:ing|ed|s|es)?` synced between backend (`config.py` / `scanner_service.py`) and frontend (`lyricEvaluator.js`).
- Upstream resilience: Per-call socket timeouts (5s) and graceful fallback (`None`) without raising unhandled exceptions.

## UX & Interaction Patterns

- Screening Controls Bar: Sticky or prominent bar above working list with Preset Selector (`Strict`, `Standard`, `Mild`), `Custom Words` pill toggle, and primary `Scan Lyrics` action button.
- Verification Status Badges: Distinct visual treatments for each status (Clean in emerald `#4EDEA3`/`#10B981`, Flagged in rose `#F43F5E`, No Lyrics in muted zinc `#71717A`, Unscanned in subtle border).
- Lyrics Modal: Obsidian-themed modal overlay with dark inset background, line numbers, highlighted violation badges, jump buttons, and Keep Track toggle.
- Tab-isolated Keyword Search workbench retaining search history and matching track cards.

## Cross-Story Dependencies

- Story 2.1 provides backend cross-referencing (`lyric_xref_service.py`) and caching needed by Story 2.2 (`/api/scan/playlist`) and subsequent screening flows.
- Story 2.2 provides the scan pipeline and verification status contracts needed by UI components in Stories 2.3, 2.4, and 2.5.
