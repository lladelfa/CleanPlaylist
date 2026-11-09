# Epic 3 Context: Clean Replacement Workbench & Dual Zero-Auth Finish Lines

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Users can find and swap clean edits individually or in one-click bulk across all flagged tracks, keep borderline songs, and take their clean music anywhere without logging in via instant YouTube Clean Queue playback, one-click clipboard link copying with Spotify Desktop paste guidance, and offline CSV, M3U8, or JSON exports.

## Stories

- Story 3.1: Single-Track & Batch Clean Replacement Endpoints (`find-batch`) with Self-Swap Guard
- Story 3.2: Per-Track Clean Replacement Control & In-Modal Swap Workflow
- Story 3.3: One-Click Bulk Clean Replacement in Scan & Clean
- Story 3.4: Universal YouTube Clean Queue Generation & Omitted-Track Guard
- Story 3.5: Clean Track Deep Links, One-Click Desktop Clipboard Copy, & Offline File Exports

## Requirements & Constraints

- **Self-Swap Guard & Zero False-Clean Safety**: A flagged track must never match itself as its own Clean Replacement—even when `is_explicit == False` in provider metadata (such as a song flagged strictly by lyrics). Replacement lookups must exclude the source track ID and verify non-explicit status before marking a track `Clean Swapped`.
- **Single-Track & Bulk Clean Replacement**: Users can preview candidate clean edits (title and duration difference) and apply swaps individually in-row or inside `LyricsModal`, or click `Find & Swap All Clean Versions` to process all flagged tracks in batches of $\le 10$ tracks.
- **No Auto-Delete in Scan & Clean**: Tracks with no available clean version must remain visibly `Flagged` with `"No clean version found"` and a one-click `Remove` action. `Scan & Clean` never automatically drops unswappable tracks.
- **Serverless Latency & Rate-Limit Resilience**: Single and batch replacement requests must complete in $\le 8\text{s}$ at p95 with $5\text{s}$ upstream socket timeouts and bounded concurrency (`max_workers=4`). On upstream `HTTP 429` or `5xx` errors during bulk swap, the pipeline must halt cleanly, preserve all already-swapped tracks in memory, and surface a retryable `NoticeBanner` (`role="alert"`).
- **Universal Clean Queue Playback**: Clicking `Play Clean Queue` opens `https://www.youtube.com/watch_videos?video_ids=...` in a new tab (`target="_blank"`, `rel="noopener noreferrer"`), capped at 50 video IDs per URL (rendering sequential `Queue 1–50`, `Queue 51–N` buttons when VIP output exceeds 50). In `spotify` mode, it uses cross-referenced `ytmusic_video_id` values (including co-resolved IDs for swapped clean tracks), warns via an amber `NoticeBanner` if any ready tracks lacked a YouTube match, and blocks opening a broken URL if zero IDs resolved.
- **Clean Track Links & Desktop Clipboard Paste**: Every track exposes a canonical deep link (`https://open.spotify.com/track/<id>` or `https://music.youtube.com/watch?v=<id>`). Clicking `Copy Clean Track Links` joins all ready track URLs with `\n` (zero trailing whitespace) onto the clipboard for direct `Ctrl+V` / `Cmd+V` paste into Spotify Desktop.
- **Offline File Exports**: Users can export ready tracks as `.csv`, `.m3U8`, or `.json` without authentication, preserving post-swap metadata, canonical track URLs, sanitized filenames, and platform-neutral `"Track Link"` CSV headers.
- **Funnel Telemetry**: Completed single or bulk swaps emit a single `clean_swap_applied` event (`mode: "single" | "bulk"`, `swapped_count`, `unfound_count`), and finish-line actions emit `finish_action_clicked` (`play_clean_queue`, `copy_clean_links`, `open_track_link`, `file_export`) with zero PII.

## Technical Decisions

- **API Contracts**:
  - `POST /api/replacements/find`: Accepts `{title, artist, duration_seconds, track_id: Optional[str], platform}`. Enforces `exclude_track_id=track_id`, co-resolves clean `ytmusic_video_id` on `spotify` via `lyric_xref_service`, and returns candidate metadata plus `lyrics_by_id`.
  - `POST /api/replacements/find-batch`: Accepts `{tracks: {id, title, artist, duration_seconds}[] (<=10), platform}`. Queries clean replacements concurrently (`ThreadPoolExecutor(max_workers=4)`), co-resolves clean `ytmusic_video_id`s and lyrics on `spotify`, and returns `{results: Record<track_id, TrackScanItem | null>, lyrics_by_id: Dict[str, str]}`.
  - `POST /api/export`: Accepts `{tracks, format: "csv" | "m3u8" | "json", playlist_title, platform}`, using `"Track Link"` as the CSV URL column header and writing canonical `video_url` values.
  - All endpoints use relative `/api/*` paths, explicitly include `platform: activePlatform`, and use `SpotifyService.get_catalog_client()` (isolated Client Credentials) for public Spotify replacement lookups.
- **Ready-Track Predicate (`finishLine.js` & `FinishLineBar`)**:
  - In `Scan & Clean`, `readyTracks` is defined strictly as tracks where `verification_status in {"verified_clean", "clean_swapped"}` OR `track.id in keptTrackIds`.
- **In-Memory Swap State Transition**:
  - Committing a swap replaces the item in `App.jsx.workingList` with the clean candidate metadata, sets `verification_status: "clean_swapped"` and `is_flagged: false`, merges clean lyrics into `lyricsByTrackId`, and preserves `ytmusic_video_id` for Clean Queue handoff.
- **Chunked Bulk Replacement Pipeline (`screeningPipeline.js`)**:
  - Dispatches flagged tracks in chunks of $\le 10$ to `POST /api/replacements/find-batch`, updating progress state after each chunk so partial completions survive upstream `HTTP 429` interruptions and can resume from the first incomplete chunk on `Retry`.

## UX & Interaction Patterns

- **CleanReplacementControl**:
  - **Initial (`Flagged`)**: `bg-surface-elevated` `Find Clean Edit` button with `Sparkles` / `Search` icon.
  - **Searching**: Disabled spinner state (`"Searching…"`).
  - **Candidate Ready**: Emerald `Swap to Clean` button (`bg-status-clean`, `text-status-clean-ink` in modal/mobile; `bg-status-clean-bg` with `border-status-clean-border` outline in dense desktop rows) showing matched clean title and duration delta. Inside `LyricsModal`, renders as an emerald top banner that updates the parent row and closes the modal.
  - **No Match**: Muted italic `"No clean version found"` (`text-text-muted`) next to a one-click `Remove` button (`aria-label="Remove track"`).
- **Bulk Swap in `ScreeningControlsBar`**:
  - `Find & Swap All Clean Versions` button displays animated progress (`"Finding clean edits (X of Y)…"`).
  - Emits an `aria-live="polite"` summary `NoticeBanner` on completion (`"Swapped X of Y flagged tracks; Z still need review"`).
- **FinishLineBar & Responsive CTA Inversion**:
  - Sticky bottom dock (`bg-surface-inset/95`, `backdrop-blur-md`, `border-t border-border-subtle`) with live ready/flagged summary. Page containers reserve `pb-24` (`96px`) on desktop and `136px` on mobile so the dock never occludes row actions.
  - **Desktop (`>= 768px`) `Scan & Clean`**: Primary CTA is electric violet `Copy Clean Track Links` (`bg-brand-primary`) stacked above a monospace `Ctrl+V` / `Cmd+V` Spotify Desktop paste hint; secondary buttons are `Play Clean Queue` and `Export ▾` (`.csv`, `.m3u8`, `.json`).
  - **Mobile (`< 768px`)**: Primary CTA inverts to full-width `Play Clean Queue` on top, with secondary 2-column `Copy Clean Track Links` and `Export ▾` below, plus per-card `Open Clean Track` links (`44px` minimum tap height).
- **Color & Accessibility Discipline**:
  - Studio CTAs (`Copy Clean Track Links`, `Play Clean Queue`) always use electric violet (`brand-primary` `#7C3AED`); safety emerald (`#4EDEA3` / `#10B981`) is reserved strictly for `Verified Clean`, `Clean Swapped` (`ArrowLeftRight` icon), and `Swap to Clean`.
  - All status updates (swap applied, bulk swap summary, `"Copied N Clean Track Links"`) announce via `aria-live="polite"`.

## Cross-Story Dependencies

- **Story 3.1 (Replacement Endpoints & Self-Swap Guard)** provides the backend `/api/replacements/find` and `/api/replacements/find-batch` routes and `lyric_xref_service` co-resolution required by per-track swaps (Story 3.2), bulk swaps (Story 3.3), and Spotify Clean Queue playback of swapped tracks (Story 3.4).
- **Story 3.2 (Per-Track & In-Modal Swap)** and **Story 3.3 (Bulk Clean Swap)** transition tracks to `verification_status: "clean_swapped"` and populate clean `ytmusic_video_id`s consumed by `FinishLineBar` in Stories 3.4 and 3.5.
- **Story 3.4 (Universal Clean Queue)** and **Story 3.5 (Clean Track Links, Clipboard Copy, & Exports)** share `finishLine.js` and `FinishLineBar` to filter `readyTracks` and deliver zero-auth finish actions.
- **Epic Boundaries**:
  - Depends on Epic 1 (`workingList`, `activePlatform`) and Epic 2 (`lyric_xref_service.py`, `verification_status`, `keptTrackIds`, `LyricsModal`, `ScreeningControlsBar`).
  - Reused directly by Epic 4 (**Stitch Studio** calls `/api/replacements/find-batch` during pre-screening and mounts `FinishLineBar` on stitched output) and extended in Epic 5 (`Save to Spotify` in VIP Mode and telemetry sink validation).
