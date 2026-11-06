# Epic 1 Context: Zero-Login Catalog Search & Working List Staging

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Unauthenticated users can search songs and albums across Spotify (via server-side Client Credentials) and YouTube Music, import pasted track lists, handle playlist URLs with guided fallback for Spotify links, and manage an in-memory Working List capped at 50 tracks with responsive desktop table / mobile cards and atomic catalog switching.

## Stories

- Story 1.1: Project Foundation, Dependency Hygiene, & Obsidian Design Tokens
- Story 1.2: Dual-Catalog Backend Search, Album Loading, & Sliced Playlist Fetch
- Story 1.3: Unified Header, Active Platform Context, & Atomic Switch Confirmation
- Story 1.4: Smart Input Bar, Catalog Preview Tray, & Instant Staging
- Story 1.5: Multi-Line Pasted Track List Import & Cross-Platform URL Guard
- Story 1.6: Public Spotify Playlist Helper & Responsive Working List Workbench

## Requirements & Constraints

- Support unauthenticated song/album search on Spotify (via Client Credentials) and YouTube Music (`ytmusicapi`), capped at <= 10 items per upstream request.
- Working list capped at 50 tracks staged in-memory with client-side exact ID deduplication.
- Zero-login user journey: no login prompt or authentication wall for public search and staging.
- Pasted track lists accept up to 50 lines (track URLs or `Artist - Title`), resolving same-platform URLs via ID lookup and plain text via top search match; cross-platform URLs are safely skipped into an unresolved notice.
- Unauthenticated Spotify playlist URLs are intercepted client-side with step-by-step Spotify Desktop copy-paste guidance (`SpotifyPlaylistHelper`) with 0 network calls and 0 401/403 errors.
- Switching platform with a non-empty working list prompts for confirmation and atomically resets all staged tracks, cached lyrics, and scan state.

## Technical Decisions

- Architecture: Dual-credential Spotify client structure (`get_catalog_client()` using `SpotifyClientCredentials` with `MemoryCacheHandler`, isolated from user OAuth sessions).
- Data Contracts: Canonical 12-key `TrackScanItem` (`id`, `title`, `artist`, `artists_list`, `album`, `duration`, `duration_seconds`, `is_explicit`, `thumbnail`, `video_url`, `verification_status`, `source_platform`) with Pydantic `extra="ignore"`.
- Sync Python runtime dependencies across root `requirements.txt` and `backend/requirements.txt` (root `.python-version` at 3.13); prune dead `better-profanity` reference.
- Responsive table on desktop (`>= 768px`) adapting to stacked `MobileTrackCard` components below 768px with min 44px touch targets down to 360px viewport.
- Error handling: Upstream HTTP 429 backoff/pause banners and socket timeout protection (5s per upstream request).

## UX & Interaction Patterns

- Obsidian Audio Core dark studio palette configured via Tailwind CSS v4 `@theme` in `frontend/src/index.css`.
- Fonts: `Plus Jakarta Sans` for body/headings and `JetBrains Mono` for metadata/durations/counters loaded via Google Fonts in `frontend/index.html`.
- Unified header with 3 tabs (`Scan & Clean`, `Keyword Search`, `Stitch Studio`), pill `CatalogSelector` (`Spotify` | `YouTube Music`), and electric violet `#7C3AED` brand accents.
- Responsive `SmartInputBar` with debounced search (300ms) and recessed 2-column preview tray (`Songs` and `Albums`).
- `PlatformSwitchModal` modal confirmation on dirty list platform switch.

## Cross-Story Dependencies

- Story 1.1 provides the baseline dependency sync and Obsidian design tokens needed for UI components in Stories 1.3–1.6.
- Story 1.2 provides backend endpoints (`/api/catalog/search`, `/api/catalog/album`, sliced `/api/playlist/fetch`) consumed by frontend components in Stories 1.4–1.6.
