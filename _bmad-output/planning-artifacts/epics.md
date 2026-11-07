---
status: final
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-CleanPlaylist-2026-11-04/prd.md
  - _bmad-output/planning-artifacts/prds/prd-CleanPlaylist-2026-11-04/addendum.md
  - _bmad-output/planning-artifacts/architecture/architecture-CleanPlaylist-2026-11-05/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-CleanPlaylist-2026-11-05/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-CleanPlaylist-2026-11-05/EXPERIENCE.md
  - AGENTS.md
---

# CleanPlaylist - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for CleanPlaylist, decomposing the requirements from the PRD, UX Design, and Architecture specifications into implementable, testable stories organized by user value.

## Requirements Inventory

### Functional Requirements

FR-1: Zero-Login Song and Album Search — Unauthenticated users can search for songs and albums by keyword on the Active Platform (`spotify` via Client Credentials or `ytmusic` unauthenticated), previewing matches in a 2-column tray before adding single songs or full albums into the Working List.
FR-2: Working List Assembly, Deduplication, and 50-Track Cap — Users can incrementally stage up to 50 tracks in memory, deduplicating exact track IDs on the Active Platform, removing individual tracks, or clearing the entire list. Switching Active Platform with a non-empty list prompts confirmation and atomically resets all staged tracks, cached lyrics, and scan state.
FR-3: Pasted Track List Import — Users can paste a multi-line list of up to 50 entries (plain-text `Artist - Title` or track URLs). Same-platform track URLs resolve via exact ID lookup, plain text resolves via top catalog search match, and cross-platform URLs are skipped into an unresolved summary with a switch-platform hint.
FR-4: Playlist URL Handling and Public Spotify Playlist Fallback — Users can load public/unlisted YouTube Music playlist URLs directly (up to 50 tracks, with truncation notice if larger). Unauthenticated users submitting Spotify playlist URLs are intercepted client-side with step-by-step Spotify Desktop copy-paste instructions (`SpotifyPlaylistHelper`) with zero HTTP 401/403 errors.
FR-5: Cross-Platform Lyric Cross-Reference and Categorized Regex Scan — Scans lyrics on both platforms against selected Sensitivity Presets and Custom Blocklists. Spotify tracks cross-reference YouTube Music requiring normalized title + primary artist match and duration within ±10s. Scanning executes in progressive batches of 10–15 tracks.
FR-6: Explicit Verification Status and Lyrics Unavailable Guardrail — Every scanned track receives one of four mutually exclusive Verification Statuses: `Verified Clean`, `Flagged`, `Clean Swapped`, or `Lyrics Unavailable`. Tracks with missing lyrics (`has_lyrics == False`) never resolve to `Verified Clean`; explicit tracks with missing lyrics resolve to `Flagged` citing both explicit metadata and unavailable lyrics.
FR-7: Lyric Snippet Inspection and Keyword Search Continuity — Users can inspect line-numbered lyrics with highlighted profanity tokens and line jumpers (`LyricsModal`), and search custom target keywords across cached/cross-referenced lyrics of up to 50 staged tracks in the `Keyword Search` tab.
FR-8: Per-Track Keep, Remove, and Clean Replacement Swap — Users can inspect candidate clean edits on individual Flagged tracks, swap to non-explicit clean replacements in-memory (`Clean Swapped`), keep borderline tracks as-is (`Keep Flagged Track`), or remove tracks from the Working List.
FR-9: One-Click Bulk Clean Swap in Scan & Clean — Users can click "Find & Swap All Clean Versions" to automatically search and apply Clean Replacements across all currently Flagged tracks in the Working List, updating swappable tracks to `Clean Swapped` and leaving unfound tracks `Flagged` with a completion summary.
FR-10: Zero-Login Multi-Source Stitching — Unauthenticated users can combine 2 or more sources (YTM playlist URLs, searched albums, Pasted Track Lists, or current Working List) up to a 50-track combined public quota under automated clean rules (`replace_clean_or_drop`, `replace_clean_or_keep`, `exclude_flagged`, `keep_all`), order modes, and deduplication modes.
FR-11: Universal Clean Queue Playback Across Both Platforms — Clicking "Play Clean Queue" opens a zero-login YouTube playback queue (`https://www.youtube.com/watch_videos?video_ids=...`) for ready tracks across both YouTube Music and Spotify (using cross-referenced YouTube video IDs, warning if any unresolvable tracks were omitted).
FR-12: Per-Track Clean Track Links and One-Click Copy Clean Track Links — Every approved track provides an accessible deep link to the Active Platform ("Open Clean Track"). Clicking "Copy Clean Track Links" copies newline-separated links to clipboard, displaying inline `Ctrl+V`/`Cmd+V` Spotify Desktop paste instructions on desktop.
FR-13: Offline File Exports Continuity — Users can export approved tracks as CSV, M3U8, or JSON on either platform without authentication, preserving post-swap metadata and Clean Track Links.
FR-14: Query-Parameter VIP Mode Activation and Public UI Isolation — Hides all Spotify OAuth login, library browsing, and direct playlist save controls by default. Visiting with `?vip=1` persists VIP Mode in browser storage, unlocking allowlisted Spotify OAuth login, `PlaylistPickerModal`, direct Spotify playlist URL loading, and `SavePlaylistModal`.
FR-15: Privacy-Safe Usage Event Recording — Emits anonymous, zero-PII structured JSON Usage Events once per completed user action (`input_loaded`, `scan_completed`, `clean_swap_applied`, `stitch_completed`, `finish_action_clicked`) capturing viewport class and funnel counts without collecting queries, URLs, titles, blocklist terms, IPs, or tokens.
FR-16: On-Screen Profanity Masking & Unmask Toggle — The UI defaults to masking all displayed profanity tokens, custom blocklist chips, and detected keyword matches (preserving only the first character followed by asterisks, e.g., `w***`), with a global toggle in the screening controls to mask/unmask on demand without altering internal regex evaluation or API payloads.

### NonFunctional Requirements

NFR-1: Serverless Scan Latency & Timeout Safety — Progressive client batches of 10–15 tracks ensure initial scan results render in `<= 3s` and 50-track completion in `<= 25s`, with per-request p95 latency `<= 8s` (safely below Vercel's 60s function limit) and 5s per-request socket timeouts on upstream catalog calls.
NFR-2: Spotify Rate-Limit Conservation & Singular Track Adaptation — In accordance with Spotify's February 2026 Development Mode update, search limits are capped at `<= 10`, albums load via album tracks endpoints, and pasted track URLs resolve via singular `sp.track()` calls backed by a 512-entry 1h TTL cache and bounded concurrency. Upstream HTTP 429 errors surface retryable pause banners.
NFR-3: Zero False-Clean Safety Invariant — Under no circumstance (timeout, search miss, empty lyric body, rate limit) may a track default to `Verified Clean`. Missing lyrics must always badge as `Lyrics Unavailable` (or `Flagged` if explicit metadata is true). Clean replacements must exclude the source track ID and verify non-explicit status before marking `Clean Swapped`.
NFR-4: Mobile & Desktop Accessibility Parity — Responsive design down to 360px viewport width with zero horizontal page overflow, 44px minimum touch targets on mobile, dark Slate Obsidian Audio Core palette, and visible text or explicit `aria-label` attributes on every interactive element for 100% React Testing Library queryability and keyboard accessibility.
NFR-5: $0 Marginal Run Cost & Secret Hygiene — Zero third-party paid LLM or database dependencies. Server-side secrets (`SPOTIFY_CLIENT_SECRET`, `SESSION_SECRET_KEY`) never leak to client bundles; Spotify Client Credentials tokens are cached server-side; app owner maintains active Spotify Premium developer account.

### Additional Requirements

ARCH-1: Brownfield Foundation & Dependency Sync (`AD-10`) — Create root `.python-version` (`3.13`), synchronize runtime dependencies across root `requirements.txt` and `backend/requirements.txt` (keeping test-only packages in backend only), prune unused `better-profanity`, refresh `AGENTS.md` to reflect Obsidian Audio Core tokens and Windows `.vite-temp` read-only attribute workaround (`Remove-Item -Recurse -Force frontend\node_modules\.vite-temp`).
ARCH-2: Dual-Credential Spotify Architecture & 3-State Lifecycle (`AD-1`) — Isolate `SpotifyClientCredentials(cache_handler=MemoryCacheHandler())` in `SpotifyService.get_catalog_client()` from OAuth user sessions. Implement 3-state Spotify playlist URL handling: `!vipMode` $\rightarrow$ `SpotifyPlaylistHelper`; `vipMode && !isAuthenticated` $\rightarrow$ `SpotifyAuthModal`; `vipMode && isAuthenticated` $\rightarrow$ `/api/playlist/fetch`.
ARCH-3: Canonical Envelope & Typed Scan Verdict Extension (`AD-3`) — Define 12-key `TrackScanItem` (`extra="ignore"`) for input normalization and `ScannedTrackItem` (enriched with `is_flagged`, `reasons`, `snippets`, `detected_terms`, `total_flagged_count`) for scan outputs. Enforce `exclude_track_id` in replacement searches.
ARCH-4: Unified Backend API Surface & Route Contracts (`AD-4`) — Implement 5 new endpoints (`POST /api/catalog/search`, `POST /api/catalog/album`, `POST /api/catalog/resolve`, `POST /api/replacements/find-batch`, `POST /api/telemetry/event`). Enhance `/api/playlist/fetch` with explicit `tracks[:limit]` slice, `source_track_count`, and `truncated`. Update Spotify playlist creation to `sp.current_user_playlist_create` (`POST /v1/me/playlists`).
ARCH-5: Single Lyric Cross-Reference Owner & Morphological Parity (`AD-5`) — Implement `lyric_xref_service.py` as single authority for Spotify-to-YTM ±10s matching. Update `GET /api/presets` to return morphological regex rules `(?:ing|ed|s|es)?` so client `lyricEvaluator.js` evaluates cached lyrics in memory with byte-for-byte server parity.
ARCH-6: Shared Progressive Screening Pipeline (`AD-6`) — Implement client `screeningPipeline.js` orchestrating chunked execution (`<=10` initial batch, `<=15` subsequent batches) for `Scan & Clean`, `Keyword Search`, and `Stitch Studio` (pre-screening tracks and passing `manual_replacements` before `/api/stitch`), with HTTP 429 retry pause.
ARCH-7: Single-Root Session State & Stitch Tab Decoupling (`AD-7`) — `App.jsx` owns global catalog context, `keptTrackIds`, `sourcePlaylist`, and `lyricsByTrackId`. Switching Active Platform triggers `PlatformSwitchModal` confirmation and atomic reset. `StitchTab` hosts its own dedicated `FinishLineBar` on `stitchedResult.tracks` without modifying `workingList`.
ARCH-8: Schema-Locked Discriminated Union Telemetry Sink (`AD-9`) — `TelemetryService` validates strict `extra="forbid"` payload schemas with ephemeral `session_anon_id` and emits stdout JSON logs (`cp_telemetry`) once per user action. `scan_completed` counts all `has_lyrics == False` tracks under `lyrics_unavailable_count`.

### UX Design Requirements

UX-DR1: Obsidian Audio Core Dark Studio Palette — Implement dedicated dark-mode palette in `frontend/src/index.css` via Tailwind CSS v4 `@theme` (surface ladder `surface-inset` through `surface-backdrop`, `brand-primary` `#7C3AED` across both platforms, safety-reserved emerald `#4EDEA3`/`#10B981` strictly for clean/swapped states, caution amber `#FCD34D`/`#F59E0B` for unavailable/truncation notices).
UX-DR2: Typography & Google Font Integration — Load `Plus Jakarta Sans` (`400;500;600;700`) and `JetBrains Mono` (`400;500`) in `frontend/index.html`; apply monospace tokens to durations, line gutters, quotas, and keycaps; render stroke icons exclusively via `lucide-react`.
UX-DR3: Unified GlobalHeader & CatalogSelector — Sticky header with strictly 3 tabs (`Scan & Clean`, `Keyword Search`, `Stitch Studio`), pill `CatalogSelector` (`Spotify` | `YouTube Music`), conditional VIP controls (`VIP` badge, `Connect Spotify`, `Exit VIP Mode`), and `PlatformSwitchModal` confirmation when switching platform with a non-empty Working List.
UX-DR4: SmartInputBar with Auto-Detection & Instant Catalog Matches Tray — Unified search input debouncing queries at 300ms, displaying 2-column preview tray (Songs + Albums with 36x36 cover art) and sample chips, routing multi-line paste to `PasteTrackListPanel` and cross-platform URLs to switch `NoticeBanner`.
UX-DR5: PasteTrackListPanel & SpotifyPlaylistHelper — Expandable mono textarea with live `N / 50 lines` counter and truncation warning, paired with 3-step Spotify Desktop copy-paste helper card (`Ctrl+A` $\rightarrow$ `Ctrl+C` $\rightarrow$ paste) and `Focus Paste Box` / `Search Albums Instead` actions.
UX-DR6: ScreeningControlsBar & Preset Selection — Segmented preset pills (`Kid Safe`, `Moderate`, `Slurs Only`, `Custom`), inline Custom Blocklist term input + removable chips, `Scanned X of Y` live progress meter, and bulk `Find & Swap All Clean Versions` trigger.
UX-DR7: WorkingListWorkbench & Responsive MobileTrackCard — Dense 6-column desktop table (`#`, cover, title/artist, album, duration, VerificationStatusBadge + category chips, actions) adapting below 768px to stacked `MobileTrackCard` components with 44px minimum touch targets and zero horizontal overflow down to 360px.
UX-DR8: VerificationStatusBadge Component — Full-pill badge pairing distinct `lucide-react` stroke icons with verbatim text (`Verified Clean`, `Clean Swapped`, `Flagged`, `Lyrics Unavailable`, `Unscanned`) alongside optional `[E]` metadata tags, never communicating status through color alone.
UX-DR9: CleanReplacementControl & In-Row/In-Modal Workflow — State machine transitioning from `Find Clean Edit` $\rightarrow$ searching spinner $\rightarrow$ candidate preview with solid/outline emerald `Swap to Clean` or `"No clean version found"` next to `Remove`.
UX-DR10: LyricsModal Inspection Overlay — Modal dialog over backdrop blur with line-gutter (`L01`–`Lnn`), flagged line callouts, `Flag X of Y ↑ ↓` jumper, cross-reference attribution, in-modal `Swap to Clean`, and `Keep Flagged Track` action.
UX-DR11: KeywordSearchWorkbench — Dedicated tab with starter theme chips (`money`, `drugs`, `party`, `alcohol`, `gun`), custom keyword entry, match counters, and collapsible `<mark>` highlighted line excerpts across cached Working List lyrics.
UX-DR12: StitchStudioWorkbench — Multi-source input pool (URL, album, paste, `Add Current Working List`), 50-track staged quota progress bar, batch rules bar (`clean_mode`, `order_mode`, `deduplication_mode`), and Stitched Clean Queue output table with source-origin badges.
UX-DR13: FinishLineBar & Responsive Finish-Line Inversion — Sticky bottom dock computing `readyTracks` (`Verified Clean` + `Clean Swapped` + kept flagged tracks). Primary `Copy Clean Track Links` with `Ctrl+V`/`Cmd+V` desktop hint on desktop `Scan & Clean`; primary `Play Clean Queue` on mobile and `Stitch Studio`; export popover (`.csv`, `.m3u8`, `.json`); and VIP `Save to Spotify` trigger.
UX-DR14: NoticeBanner System & VIP OAuth Error Banner — Non-blocking alert banner supporting caution (truncation, skipped cross-platform URLs, omitted queue tracks), HTTP 429 rate limit with `Retry` action, and rose `role="alert"` VIP OAuth failure banner with 1-click `Exit VIP Mode`.
UX-DR15: Accessibility & Motion Floor — Verbatim `aria-label`s on all interactive elements, modal focus trap with `Escape` close and trigger focus restoration, `aria-live="polite"` on progress/status regions, and `prefers-reduced-motion: reduce` compliance.
UX-DR16: VIP Modals (PlaylistPickerModal & SavePlaylistModal) — Paginated library picker (`limit=20`, filter input) and save modal with radio cards (`Create New Clean Playlist` with title input + `Private Playlist` toggle; `Update Original Playlist` with destructive warning) and 2-second confirmation state.
UX-DR17: On-Screen Profanity Masking & Obfuscation Toggle — ScreeningControlsBar renders a compact toggle button (`EyeOff` when masked, `Eye` when unmasked, defaulting to masked `isMasked=true`) with `aria-label="Toggle profanity masking"`. Formats explicit tokens as `${word[0]}${'*'.repeat(word.length - 1)}` across Custom Blocklist chips, detected reasons/snippets, LyricsModal line highlights, and Keyword Search excerpts.

### FR Coverage Map

FR-1: Epic 1 - Zero-Login Song and Album Search
FR-2: Epic 1 - Working List Assembly, Deduplication, and 50-Track Cap
FR-3: Epic 1 - Pasted Track List Import
FR-4: Epic 1 - Playlist URL Handling and Public Spotify Playlist Fallback
FR-5: Epic 2 - Cross-Platform Lyric Cross-Reference and Categorized Regex Scan
FR-6: Epic 2 - Explicit Verification Status and Lyrics Unavailable Guardrail
FR-7: Epic 2 - Lyric Snippet Inspection and Keyword Search Continuity
FR-16: Epic 2 - On-Screen Profanity Masking & Unmask Toggle
FR-8: Epic 3 - Per-Track Keep, Remove, and Clean Replacement Swap
FR-9: Epic 3 - One-Click Bulk Clean Swap in Scan & Clean
FR-10: Epic 4 - Zero-Login Multi-Source Stitching
FR-11: Epic 3 - Universal Clean Queue Playback Across Both Platforms
FR-12: Epic 3 - Per-Track Clean Track Links and One-Click Copy Clean Track Links
FR-13: Epic 3 - Offline File Exports Continuity
FR-14: Epic 5 - Query-Parameter VIP Mode Activation and Public UI Isolation
FR-15: Epic 5 - Privacy-Safe Usage Event Recording

## Epic List

### Epic 1: Zero-Login Catalog Search & Working List Staging
Users can visit CleanPlaylist without logging in, search songs and albums across Spotify (via Client Credentials) and YouTube Music, paste multi-line track lists or load playlist links (with guided fallback for Spotify links), and stage up to 50 deduplicated tracks in a responsive dark studio workbench with atomic platform reset.
**FRs covered:** FR-1, FR-2, FR-3, FR-4

### Epic 2: Cross-Platform Lyric Screening & Verification Workbench
Users can evaluate staged tracks on both platforms using Sensitivity Presets and Custom Blocklists (with automated Spotify-to-YouTube Music Lyric Cross-Reference), inspect highlighted profanity snippets with line jumpers in LyricsModal, search custom keywords across cached lyrics, and view honest Verification Status badges without false-clean inflation.
**FRs covered:** FR-5, FR-6, FR-7

### Epic 3: Clean Replacement Workbench & Dual Zero-Auth Finish Lines
Users can find and swap clean edits individually or in 1-click bulk across all flagged tracks, keep borderline songs, and take their clean music anywhere via instant YouTube Clean Queue playback, 1-click clipboard link copying with Spotify Desktop paste guidance, and offline CSV/M3U8/JSON exports.
**FRs covered:** FR-8, FR-9, FR-11, FR-12, FR-13

### Epic 4: Zero-Login Multi-Source Stitch Studio
Users (such as teachers and group leaders) can merge multiple zero-login music sources (YouTube Music playlist URLs, searched albums, pasted song requests, or the active Working List) up to a 50-track quota under automated batch clean, ordering, and deduplication rules, and launch an instant Clean Queue without logging in.
**FRs covered:** FR-10

### Epic 5: VIP Mode Spotify Library Sync & Anonymous Funnel Telemetry
Allowlisted testers can unlock VIP Mode with `?vip=1` to connect their personal Spotify accounts, browse libraries, and save clean playlists directly, while anonymous, privacy-safe usage events record funnel milestones to verify launch health.
**FRs covered:** FR-14, FR-15


## Epic 1: Zero-Login Catalog Search & Working List Staging

Unauthenticated users can search songs and albums across Spotify (via server-side Client Credentials) and YouTube Music, import pasted track lists, handle playlist URLs with guided fallback for Spotify links, and manage an in-memory Working List capped at 50 tracks with responsive desktop table / mobile cards and atomic catalog switching.

### Story 1.1: Project Foundation, Dependency Hygiene, & Obsidian Design Tokens

As a developer,
I want the repository foundation, runtime dependencies, and Tailwind v4 design tokens configured,
So that all subsequent feature development starts from a verified, consistent, and warning-free baseline.

**Acceptance Criteria:**

**Given** the repository root and serverless environment,
**When** the project is inspected,
**Then** a root `.python-version` file exists pinning Python to `3.13`,
**And** `requirements.txt` and `backend/requirements.txt` are synced with `better-profanity` pruned and `pytest>=8.0.2` specified,
**And** `scanner_service.py` has the dead `profanity.load_censor_words()` cold-start call removed.

**Given** `frontend/src/index.css` and `frontend/index.html`,
**When** the frontend is loaded or built,
**Then** `index.html` loads Google Fonts `Plus Jakarta Sans` (`400;500;600;700`) and `JetBrains Mono` (`400;500`),
**And** `index.css` defines all 30 Obsidian Audio Core design tokens under Tailwind CSS v4 `@theme` (including `surface-inset` `#070D1F`, `surface-canvas` `#0C1324`, `brand-primary` `#7C3AED`, `status-clean` `#4EDEA3`/`#10B981`, and `status-caution` `#FCD34D`/`#F59E0B`),
**And** `npm --prefix frontend run build` completes successfully.

**Given** developer instructions in `AGENTS.md`,
**When** an agent reviews the repository conventions,
**Then** `AGENTS.md` reflects Obsidian Audio Core tokens (superseding legacy `green-600` Spotify chrome), dual Spotify client architecture, and documents the Windows `.vite-temp` read-only workaround (`Remove-Item -Recurse -Force frontend\node_modules\.vite-temp` on `EPERM`).

### Story 1.2: Dual-Catalog Backend Search, Album Loading, & Sliced Playlist Fetch

As an unauthenticated user,
I want backend endpoints to search songs/albums and load playlists on Spotify or YouTube Music without logging in,
So that I can retrieve catalog tracks while respecting serverless timeouts and provider rate limits.

**Acceptance Criteria:**

**Given** Spotify Developer credentials configured in `.env`,
**When** `SpotifyService` initializes,
**Then** `get_catalog_client()` provides an isolated, process-cached `SpotifyClientCredentials(cache_handler=MemoryCacheHandler())` instance with no user OAuth dependency,
**And** `get_client()` remains as a backward-compatible alias to `get_oauth_client()`.

**Given** a catalog search query,
**When** `POST /api/catalog/search` is called with `{query: str, platform: "spotify" | "ytmusic", limit: int <= 10}`,
**Then** on `spotify`, it queries `sp.search()` with `limit <= 10` and returns `{songs: TrackScanItem[], albums: AlbumSummary[]}`,
**And** on `ytmusic`, it queries unauthenticated `ytmusicapi` and returns `{songs: TrackScanItem[], albums: AlbumSummary[]}`,
**And** all returned song objects conform to the 12-key `TrackScanItem` contract with `verification_status: "unscanned"`.

**Given** an album ID on Spotify or YouTube Music,
**When** `POST /api/catalog/album` is called with `{album_id: str, platform: "spotify" | "ytmusic"}`,
**Then** it returns `{id, title, artist, thumbnail, track_count, tracks: TrackScanItem[]}` with album tracks in order.

**Given** a public or unlisted YouTube Music playlist URL,
**When** `POST /api/playlist/fetch` is called with `{url_or_id: str, limit: 50, platform: "ytmusic"}`,
**Then** `tracks` is explicitly sliced to `tracks[:50]`,
**And** the response envelope includes `source_track_count: int` and `truncated: bool` (`true` when the source playlist had more than 50 tracks).

### Story 1.3: Unified Header, Active Platform Context, & Atomic Switch Confirmation

As a user,
I want a unified studio header with a clear catalog selector and safe platform-switching confirmation,
So that I never get confused about which music service I am screening and do not accidentally lose staged tracks.

**Acceptance Criteria:**

**Given** CleanPlaylist loaded in the browser,
**When** `App.jsx` mounts,
**Then** `activePlatform` defaults to `"spotify"` (or `"ytmusic"`),
**And** `GlobalHeader` renders exactly 3 navigation tabs (`Scan & Clean`, `Keyword Search`, `Stitch Studio`) with `brand-tint` active indicator and electric violet (`#7C3AED`) branding across both platforms,
**And** no public login or "Read-Only Mode" badges are rendered.

**Given** a non-empty `workingList` in `App.jsx`,
**When** the user clicks the opposite segment in `CatalogSelector` (`Spotify` $\leftrightarrow$ `YouTube Music`),
**Then** `PlatformSwitchModal` opens over a backdrop blur, displaying a caution notice explaining that switching platforms resets the working list,
**And** clicking `Cancel` leaves `activePlatform` and all staged tracks unchanged,
**And** clicking `Switch & Clear List` atomically switches `activePlatform`, empties `workingList`, clears `lyricsByTrackId`, resets scan results, and restores focus cleanly.

**Given** an empty `workingList`,
**When** the user clicks `CatalogSelector`,
**Then** `activePlatform` switches immediately without opening `PlatformSwitchModal`.

### Story 1.4: Smart Input Bar, Catalog Preview Tray, & Instant Staging

As an unauthenticated user,
I want to search songs and albums with instant previews and add them to my Working List,
So that I can quickly assemble a list of tracks to screen without creating an account.

**Acceptance Criteria:**

**Given** `Scan & Clean` tab open,
**When** the user types text into `SmartInputBar`,
**Then** queries are debounced at 300ms and call `POST /api/catalog/search` with `platform: activePlatform`,
**And** a recessed 2-column Instant Catalog Matches tray displays top song matches (with `+ Add Song`) and album matches (with `+ Add Album`, showing track count and 36x36 cover art).

**Given** matches displayed in the preview tray,
**When** the user clicks `+ Add Song`,
**Then** that single track is appended to `workingList` with `verification_status: "unscanned"` up to the 50-track limit,
**And** adding an exact track ID already in `workingList` is ignored and triggers a brief `"Already in Working List"` NoticeBanner.

**Given** matches displayed in the preview tray,
**When** the user clicks `+ Add Album`,
**Then** `POST /api/catalog/album` fetches the album's tracks and appends them in order to `workingList`,
**And** if adding the album causes total tracks to exceed 50, the list is capped at 50 and an amber `NoticeBanner` displays the count of omitted tracks.

**Given** an empty search input,
**When** viewing `SmartInputBar`,
**Then** clickable sample chips (e.g. *90s Hip-Hop Sample*, *Parent Test Sample*) are rendered, allowing 1-click query testing.

### Story 1.5: Multi-Line Pasted Track List Import & Cross-Platform URL Guard

As a user with a text list of song requests,
I want to paste plain-text lines or track URLs into a dedicated paste panel,
So that I can import up to 50 tracks in bulk without searching each song individually.

**Acceptance Criteria:**

**Given** `PasteTrackListPanel` open or multi-line text pasted into `SmartInputBar`,
**When** the textarea receives text,
**Then** blank lines and surrounding whitespace are stripped live,
**And** a live `N / 50 lines` counter updates in mono font,
**And** inputs exceeding 50 non-empty lines display an inline amber truncation warning *before* resolution.

**Given** a valid pasted list of up to 50 lines,
**When** the user clicks `Resolve & Add`,
**Then** client calls `POST /api/catalog/resolve` in chunks of `<= 15` lines with `platform: activePlatform`,
**And** matching-platform track URLs resolve via exact ID lookup (`sp.track()` on Spotify, watch metadata on YTM),
**And** plain-text `Artist - Title` lines resolve via top song search match,
**And** cross-platform track URLs are skipped into `unresolved[]` with `reason: "wrong_platform"`.

**Given** unresolved lines returned from `POST /api/catalog/resolve`,
**When** resolution completes,
**Then** valid resolved tracks are appended to `workingList`,
**And** if cross-platform URLs were skipped, an amber `NoticeBanner` appears offering a 1-click `"Switch to <Platform>"` button,
**And** clicking the switch button with a non-empty `workingList` opens `PlatformSwitchModal` to confirm before switching.

### Story 1.6: Public Spotify Playlist Helper & Responsive Working List Workbench

As an unauthenticated user,
I want clear guidance if I paste a Spotify playlist link and a dense responsive workbench to manage my staged tracks,
So that I can vet my list comfortably on desktop or mobile without hitting permission errors.

**Acceptance Criteria:**

**Given** an unauthenticated visitor in public mode (`vipMode == false`),
**When** a Spotify playlist URL (`open.spotify.com/playlist/...` or `spotify:playlist:...`) is entered into `SmartInputBar`,
**Then** input is intercepted client-side (`0` network calls, `0` HTTP 401/403 errors),
**And** `SpotifyPlaylistHelper` renders with a calm studio-indigo border, showing 3-step Spotify Desktop `Ctrl+A` $\rightarrow$ `Ctrl+C` $\rightarrow$ paste instructions, alongside `Focus Paste Box` and `Search Albums Instead` actions.

**Given** staged tracks in `workingList`,
**When** viewed on desktop (`>= 768px`),
**Then** `WorkingListWorkbench` renders a dense 6-column table (`#`, cover art, title & artist, album, duration, `VerificationStatusBadge` showing `"Unscanned"`, and remove action),
**And** individual tracks can be removed with `aria-label="Remove track"`,
**And** `Clear List` resets `workingList` to 0.

**Given** staged tracks in `workingList`,
**When** viewed on mobile (`< 768px`),
**Then** table columns adapt to stacked `MobileTrackCard` components with 44px minimum touch targets and zero horizontal page overflow down to 360px viewport width.


## Epic 2: Cross-Platform Lyric Screening & Verification Workbench

Users can evaluate staged tracks on both platforms using Sensitivity Presets and Custom Blocklists (with automated Spotify-to-YouTube Music Lyric Cross-Reference), inspect highlighted profanity snippets with line jumpers in LyricsModal, search custom keywords across cached lyrics, and view honest Verification Status badges without false-clean inflation.

### Story 2.1: Spotify-to-YouTube Lyric Cross-Reference Engine (`lyric_xref_service.py`)

As a user screening a Spotify playlist,
I want CleanPlaylist to automatically find and load song lyrics from YouTube Music,
So that I can evaluate lyrics without being blocked by Spotify's lack of a public lyrics API.

**Acceptance Criteria:**

**Given** a Spotify track in `workingList`,
**When** `lyric_xref_service.resolve_lyrics_and_yt_id` is invoked,
**Then** it queries `YTMusicService.search(query, filter="songs", limit=5)` using the normalized title and primary artist,
**And** it matches a YouTube candidate iff normalized title and primary artist align AND `abs(yt_duration - spotify_duration) <= 10` seconds when duration metadata is present,
**And** it falls back to the top normalized song result only if duration metadata is 0.

**Given** a successful YouTube Music lyric cross-reference,
**When** the lyrics are retrieved,
**Then** the pair `(ytmusic_video_id, lyrics)` is cached in `YTMusicService._lyrics_cache` (maxsize=512),
**And** `ytmusic_video_id` is populated onto the track dictionary for subsequent Clean Queue generation.

**Given** a track where YouTube Music has no match or no lyrics available,
**When** cross-reference resolution completes,
**Then** it returns `ytmusic_video_id = None` (or candidate ID if found without lyrics) and `lyrics = None` without crashing or throwing unhandled exceptions.

### Story 2.2: Progressive Categorized Lyric Scan & Verification Status State Machine

As an adult screening songs,
I want lyrics evaluated in progressive batches with honest verification status badges,
So that I see fast initial verdicts and never mistake a track with missing lyrics for a clean song.

**Acceptance Criteria:**

**Given** staged tracks in `workingList`,
**When** the user clicks `Scan Lyrics` in `ScreeningControlsBar`,
**Then** client `screeningPipeline.js` chunks requests to `POST /api/scan/playlist` into an initial batch of `<= 10` tracks (rendering verdicts in `<= 3s`), followed by subsequent batches of `<= 15` tracks (completing 50 tracks in `<= 25s`),
**And** `Scanned X of Y` progress announces through `aria-live="polite"`.

**Given** the response from `POST /api/scan/playlist`,
**When** tracks are received,
**Then** each track is typed as `ScannedTrackItem` with `is_flagged: bool`, `reasons: List[str]`, `snippets: List[Dict]`, `detected_terms: List[Dict]`, and `total_flagged_count: int`,
**And** full un-truncated snippets are preserved,
**And** top-level `lyrics_by_id: Dict[str, str]` is returned and merged into `App.jsx`'s `lyricsByTrackId`.

**Given** a track with `has_lyrics == True` and `total_flagged_count == 0` and `is_explicit == False`,
**When** status is evaluated,
**Then** `VerificationStatusBadge` renders emerald `Verified Clean` with `CheckCircle2` icon.

**Given** a track where lyrics could not be retrieved (`has_lyrics == False`),
**When** status is evaluated,
**Then** it is NEVER marked `Verified Clean`,
**And** if `is_explicit == True` and the active preset checks metadata, status is `Flagged` with `reasons` citing `"Marked Explicit by <Platform>"` and `"Lyrics Unavailable"`,
**And** if not flagged by metadata, status is amber `Lyrics Unavailable` with `FileQuestion` icon.

### Story 2.3: Screening Controls Bar, Presets, & Client-Side In-Memory Evaluation (`lyricEvaluator.js`)

As a parent or teacher,
I want to switch sensitivity presets or add custom blocked words and see my list re-evaluated instantly,
So that I can test different strictness levels without waiting for repeated network requests.

**Acceptance Criteria:**

**Given** `ScreeningControlsBar` mounted,
**When** `GET /api/presets` is fetched on app boot,
**Then** it returns `PRESET_PROFILES`, `WORD_CATEGORIES`, and morphological suffix regex rules `(?:ing|ed|s|es)?`,
**And** `ScreeningControlsBar` renders four preset pills (`Kid Safe`, `Moderate`, `Slurs Only`, `Custom`) and an inline Custom Blocklist term input.

**Given** a user typing a word into Custom Blocklist and pressing `Enter`,
**When** the term is submitted,
**Then** it is trimmed, lowercased, deduplicated, and appended as a removable chip with `aria-label="Remove blocklist term {term}"`.

**Given** cached lyrics in `lyricsByTrackId` for staged tracks,
**When** the user clicks a different preset pill or adds/removes a Custom Blocklist chip,
**Then** `lyricEvaluator.js` re-evaluates all cached tracks client-side in memory with zero network calls,
**And** regex evaluation applies the exact same morphological suffixes `(?:ing|ed|s|es)?` as server `scanner_service.py` to ensure byte-for-byte identical flagged verdicts,
**And** row badges and category summaries update immediately,
**And** `POST /api/telemetry/event` emits a `scan_completed` event to maintain accurate funnel tracking.

### Story 2.4: Lyrics Modal Inspection Overlay, Line Jumpers, & Keep Action

As a parent running the "parent test",
I want to inspect exact flagged lyric lines with line numbers and navigate across profanities,
So that I can understand why a song was flagged and decide whether to keep or remove it.

**Acceptance Criteria:**

**Given** a track in `WorkingListWorkbench`,
**When** the user clicks `View Lyrics` (or clicks the row's lyric snippet),
**Then** `LyricsModal` opens over backdrop blur (`surface-backdrop` at 80% with `backdrop-blur-md`),
**And** focus is trapped within the dialog, and pressing `Escape` closes the modal and restores focus to the trigger.

**Given** `LyricsModal` open with loaded lyrics,
**When** inspecting the lyrics viewer,
**Then** lyrics display right-aligned line numbers (`L01`–`Lnn`) in monospace font,
**And** flagged lines carry a `2px` rose border and subtle rose wash, with matched profanity words highlighted in rose tags,
**And** `Flag X of Y ↑ ↓` jumper buttons allow navigating directly between flagged lines with `aria-label="Previous flagged line"` and `aria-label="Next flagged line"`,
**And** on Spotify tracks, footer displays `"Lyrics cross-referenced via YouTube Music"`.

**Given** a flagged track that passes the user's judgment,
**When** the user clicks `Keep Flagged Track`,
**Then** the track ID is added to `keptTrackIds` in `App.jsx`,
**And** the track's visible `Flagged` badge remains unchanged, but `FinishLineBar` now includes this track in `readyTracks`,
**And** the modal closes.

### Story 2.5: Keyword Search Workbench with Highlighted Line Excerpts

As a user searching for specific themes,
I want to search target keywords across the lyrics of my staged tracks,
So that I can discover thematic references (like drugs, money, or violence) without reading every song.

**Acceptance Criteria:**

**Given** the `Keyword Search` tab selected with a non-empty `workingList`,
**When** the tab mounts,
**Then** starter theme chips (`money`, `drugs`, `party`, `alcohol`, `gun`) are pre-seeded and removable,
**And** user can type custom terms into an input and click `+ Add Keyword`.

**Given** selected keywords and staged tracks,
**When** the user clicks `Search Keywords Across Working List`,
**Then** for tracks present in `lyricsByTrackId`, `lyricEvaluator.js` searches line matches instantly in memory,
**And** for uncached tracks, client calls `POST /api/scan/keywords` in chunks of `<= 15` tracks with `platform: activePlatform`.

**Given** search results returned,
**When** viewing matched tracks,
**Then** summary header displays total keyword occurrences and `lyrics_unavailable_count`,
**And** each matched track row shows hit-count pills (e.g. `money: 4x`),
**And** expanding `N matching lines ▾` reveals monospace line excerpts `[Lnn]` with `<mark>` highlighted keyword tokens.

**Given** the `Keyword Search` tab opened with an empty `workingList`,
**When** viewed,
**Then** a centered studio card explains that tracks must be added first, with a 1-click button routing back to `Scan & Clean`.

### Story 2.6: UI Profanity Masking Toggle & Global Asterisk Obfuscation

As a parent, teacher, or presenter screening music,
I want explicit words and custom search terms masked on-screen by default with an optional unmask toggle,
So that vulgar language is never visibly exposed on my screen while setting up or reviewing playlists.

**Acceptance Criteria:**

**Given** the CleanPlaylist studio interface,
**When** the app mounts,
**Then** a global `isMasked` state initializes to `true` (masked by default),
**And** a Masking toggle button (eye / eye-off icon with `aria-label="Toggle profanity masking"`) is accessible in `ScreeningControlsBar`,
**And** clicking the toggle switches `isMasked` between `true` and `false`.

**Given** any word displayed as an explicit token, blocklist chip, or flagged snippet,
**When** `isMasked` is `true`,
**Then** a formatting helper masks the word keeping only the initial character visible followed by asterisks (e.g., "fuck" -> "f***", "shit" -> "s***", single-character tokens unchanged),
**And** masking applies consistently across:
  1. Custom Blocklist chips in `ScreeningControlsBar`
  2. Detected reason tags and snippets in `WorkingListWorkbench` and `MobileTrackCard`
  3. Flagged line highlights and profanity badge tags in `LyricsModal`
  4. Search keywords and highlighted excerpts in `KeywordSearchWorkbench`.

**Given** underlying screening and search mechanisms,
**When** words are masked in the UI,
**Then** all internal regex matching, preset definitions, and API payloads continue to operate on the unmasked literal strings.


## Epic 3: Clean Replacement Workbench & Dual Zero-Auth Finish Lines

Users can find and swap clean edits individually or in 1-click bulk across all flagged tracks, keep borderline songs, and take their clean music anywhere via instant YouTube Clean Queue playback, 1-click clipboard link copying with Spotify Desktop paste guidance, and offline CSV/M3U8/JSON exports.

### Story 3.1: Single-Track & Batch Clean Replacement Endpoints (`find-batch`) with Self-Swap Guard

As a backend service,
I want replacement search endpoints that protect against self-swapping and resolve YouTube video counterparts,
So that clean swaps never replace a flagged song with itself and always enable clean YouTube queue playback.

**Acceptance Criteria:**

**Given** a flagged track that has `is_explicit == False` in provider metadata (e.g. flagged strictly by lyrics),
**When** `POST /api/replacements/find` or `POST /api/replacements/find-batch` is called with `exclude_track_id` (or `track_id`),
**Then** both `SpotifyService` and `YTMusicService` search clean alternates and explicitly reject any candidate where `candidate["id"] == exclude_track_id`,
**And** `NFR-3` is upheld: a song flagged for vulgar lyrics never matches itself as a clean version.

**Given** `POST /api/replacements/find-batch` called with up to 10 tracks,
**When** executed on `spotify`,
**Then** it queries clean tracks concurrently (`max_workers=4`),
**And** for each clean Spotify candidate found, it co-resolves its clean YouTube Music video ID via `lyric_xref_service`,
**And** it returns `{results: Record<track_id, TrackScanItem | null>, lyrics_by_id: Dict[str, str]}` in `<= 8s` p95.

**Given** no non-explicit candidate found for a track,
**When** the response is constructed,
**Then** `results[track_id]` is `null` without throwing an error.

### Story 3.2: Per-Track Clean Replacement Control & In-Modal Swap Workflow

As a user inspecting a flagged song,
I want an intuitive control to find and apply a clean version on that individual track,
So that I can preview the clean replacement title and duration before committing the swap.

**Acceptance Criteria:**

**Given** a `Flagged` track row in `WorkingListWorkbench` or `MobileTrackCard`,
**When** the user clicks `Find Clean Edit`,
**Then** `CleanReplacementControl` shows a loading spinner (`"Searching…"`),
**And** it calls `POST /api/replacements/find` with `platform: activePlatform` and `track_id: track.id`.

**Given** a clean candidate returned,
**When** previewed,
**Then** an emerald `Swap to Clean` button displays the clean title and duration difference,
**And** clicking `Swap to Clean` replaces the track metadata in `workingList`, sets `verification_status: "clean_swapped"` and `is_flagged: false`, updates `lyricsByTrackId` with the clean lyrics, and announces the swap.

**Given** no clean candidate found,
**When** search completes,
**Then** the control displays `"No clean version found"` in muted italic text next to a one-click `Remove` button (`aria-label="Remove track"`).

**Given** `LyricsModal` open on a flagged track,
**When** a clean candidate is available,
**Then** an emerald top banner displays `Swap to Clean`, which updates the parent row in `workingList` and closes the modal.

### Story 3.3: One-Click Bulk Clean Replacement in Scan & Clean

As a parent or teacher with multiple flagged songs,
I want to click one button to swap all flagged tracks to clean versions at once,
So that I can clean a 20-song playlist in seconds without clicking each row manually.

**Acceptance Criteria:**

**Given** `workingList` with multiple `Flagged` tracks,
**When** the user clicks `Find & Swap All Clean Versions` in `ScreeningControlsBar`,
**Then** the button enters an animated progress state (`"Finding clean edits (X of Y)…"`),
**And** `screeningPipeline.js` dispatches chunked requests of `<= 10` tracks to `POST /api/replacements/find-batch`.

**Given** batch responses returning candidates,
**When** all chunks complete,
**Then** all resolvable tracks in `workingList` are updated in-memory to their clean alternates with `verification_status: "clean_swapped"`,
**And** tracks with no clean version found remain visibly `Flagged` (never auto-deleted),
**And** a summary `NoticeBanner` announces completion (e.g. `"Swapped 10 of 12 flagged tracks; 2 still need review"`) through `aria-live="polite"`.

**Given** Spotify rate limits reached during bulk swap,
**When** HTTP 429 is encountered,
**Then** the pipeline halts cleanly, preserves all already-swapped tracks, and displays a retryable pause banner.

### Story 3.4: Universal YouTube Clean Queue Generation & Omitted-Track Guard

As a user on any platform or device,
I want to click "Play Clean Queue" and immediately listen to approved songs in a browser tab,
So that I can play safe music in the classroom or kitchen without signing into any streaming account.

**Acceptance Criteria:**

**Given** at least one ready track in `workingList` (`verification_status in {"verified_clean", "clean_swapped"}` or in `keptTrackIds`),
**When** the user clicks `Play Clean Queue`,
**Then** `finishLine.js` extracts YouTube video IDs (native IDs in `ytmusic` mode; cross-referenced `ytmusic_video_id`s in `spotify` mode),
**And** opens `https://www.youtube.com/watch_videos?video_ids=<id1,id2,...>` in a new browser tab (`target="_blank"`, `rel="noopener noreferrer"`) capped at 50 IDs.

**Given** `spotify` mode where one or more ready tracks lack a YouTube counterpart,
**When** `Play Clean Queue` is clicked,
**Then** the queue launches with all resolved YouTube IDs,
**And** an amber `NoticeBanner` displays naming how many tracks were omitted from the queue due to missing YouTube links.

**Given** `spotify` mode where zero ready tracks have resolved YouTube IDs (e.g. pre-scan),
**When** `Play Clean Queue` is clicked,
**Then** the queue does not open a broken URL, and a caution `NoticeBanner` informs the user to run the lyric scan first to resolve playback links.

### Story 3.5: Clean Track Deep Links, One-Click Desktop Clipboard Copy, & Offline File Exports

As a user finishing a screening session,
I want to copy clean links formatted for Spotify Desktop paste or export an offline file,
So that I can transfer my vetted playlist into my personal streaming app or DJ software without logging in.

**Acceptance Criteria:**

**Given** `FinishLineBar` docked at the bottom of `Scan & Clean`,
**When** viewed on desktop (`>= 768px`),
**Then** primary studio CTA is electric violet `Copy Clean Track Links` stacked above a monospace `Ctrl+V` / `Cmd+V` Spotify Desktop paste instruction hint,
**And** secondary actions are `Play Clean Queue` and `Export ▾`.

**Given** `FinishLineBar` viewed on mobile (`< 768px`),
**When** rendered,
**Then** primary CTA inverts to full-width `Play Clean Queue` on top, with secondary `Copy Clean Track Links` and `Export ▾` below it, and per-card `Open Clean Track` links.

**Given** clicking `Copy Clean Track Links`,
**When** triggered,
**Then** canonical URLs (`https://open.spotify.com/track/<id>` or `https://music.youtube.com/watch?v=<id>`) for all ready tracks are joined by `\n` (with no trailing whitespace) and written to `navigator.clipboard.writeText`,
**And** a confirmation message announces `"Copied N Clean Track Links"`.

**Given** clicking `Export ▾` and selecting CSV, M3U8, or JSON,
**When** triggered,
**Then** `POST /api/export` receives post-swap tracks and returns a valid downloadable file with sanitized filename and platform-neutral `"Track Link"` column headers.


## Epic 4: Zero-Login Multi-Source Stitch Studio

Users (such as teachers and group leaders) can merge multiple zero-login music sources (YouTube Music playlist URLs, searched albums, pasted song requests, or the active Working List) up to a 50-track quota under automated batch clean, ordering, and deduplication rules, and launch an instant Clean Queue without logging in.

### Story 4.1: Multi-Source Input Pool & 50-Track Staged Quota Bar

As an event host or teacher,
I want to add multiple music sources into a staged pool and monitor our combined track budget,
So that I can see all inputs in one place and stay within our 50-track playback limit.

**Acceptance Criteria:**

**Given** the `Stitch Studio` tab selected,
**When** the user views `StitchStudioWorkbench`,
**Then** an input pool card renders 4 source triggers: YouTube Music playlist URL, searched album, `PasteTrackListPanel`, and 1-click `Add Current Working List` (enabled when `workingList.length > 0`),
**And** adding a source renders a 2-column source card displaying title, track count, and a remove button (`aria-label="Remove source {name}"`).

**Given** staged sources in the pool,
**When** tracks are added or removed,
**Then** the `Combined Track Quota: N / 50 Staged` progress meter updates live,
**And** in public mode, exceeding 50 staged tracks turns the quota track to caution amber with an inline `NoticeBanner` warning of truncation.

**Given** a user clicking `Add Current Working List`,
**When** triggered,
**Then** all currently staged tracks in `App.jsx.workingList` are added as an isolated source card snapshot,
**And** any already-cached lyrics in `lyricsByTrackId` are preserved so downstream screening skips redundant network calls.

### Story 4.2: Automated Stitch Pre-Screening Pipeline & Batch Clean Rule Enforcement

As an unauthenticated user stitching multiple playlists,
I want CleanPlaylist to automatically screen all source tracks and find clean replacements before merging,
So that vulgar songs are handled consistently across all merged playlists.

**Acceptance Criteria:**

**Given** multiple staged sources in `Stitch Studio`,
**When** the user clicks `Stitch & Clean`,
**Then** `screeningPipeline.js` executes pre-screening:
  1. Resolves any pasted track lists via `POST /api/catalog/resolve`, surfacing unresolved lines without blocking valid tracks;
  2. Runs chunked lyric scanning across all uncached source tracks via `POST /api/scan/playlist`;
  3. If `clean_mode` is `replace_clean_or_drop` or `replace_clean_or_keep`, calls `POST /api/replacements/find-batch` across all flagged tracks;
  4. Maps non-null clean replacement candidates into `manual_replacements` keyed by original `track.id`.

**Given** a pre-screening error or upstream rate limit,
**When** HTTP 429 occurs,
**Then** the screening pipeline pauses cleanly, retains all evaluated tracks, and surfaces a retry banner.

### Story 4.3: Multi-Source Merging Engine, Ordering, & Deduplication (`POST /api/stitch`)

As a user merging playlists,
I want a flexible merging engine that applies my chosen clean, ordering, and deduplication rules,
So that the final playlist has no duplicate songs, no explicit language, and plays in my preferred sequence.

**Acceptance Criteria:**

**Given** pre-screened tracks and rule configurations,
**When** `POST /api/stitch` is invoked with `StitchRequest = {playlists, order_mode, deduplication_mode, clean_mode, manual_replacements, manual_actions, platform}`,
**Then** `order_mode` arranges tracks by `sequential`, `interleave`, `title_asc`, or `artist_asc`,
**And** `deduplication_mode` strips duplicates by `exact_id`, `title_artist`, or `none`.

**Given** tracks evaluated under `clean_mode`,
**When** `stitcher_service.py` evaluates flagged tracks,
**Then** it checks `verification_status == "flagged"` (falling back to `is_flagged` only when unset),
**And** under `replace_clean_or_drop`, flagged tracks with clean candidates are replaced and stamped `verification_status: "clean_swapped"` + `is_flagged: false`, while unswappable flagged tracks are dropped,
**And** under `replace_clean_or_keep`, unswappable flagged tracks are retained,
**And** under `exclude_flagged`, all flagged tracks are dropped,
**And** under `keep_all`, all tracks are preserved.

**Given** merged output tracks,
**When** returned as `StitchResult = {tracks: ScannedTrackItem[], summary: StitchSummary}`,
**Then** every track retains its origin `source_playlist_title` metadata.

### Story 4.4: Stitched Clean Output Workbench & Isolated Finish Line Handoff

As a teacher or organizer with a merged playlist,
I want to view my stitched tracklist and play or export it immediately without affecting my Scan & Clean list,
So that my working staging list is preserved while my classroom queue plays.

**Acceptance Criteria:**

**Given** `POST /api/stitch` completed,
**When** viewing the Stitched Clean Queue output card,
**Then** summary pills display total input tracks, duplicates removed, tracks replaced, tracks dropped, and final track count,
**And** if any pasted song lines contained typos, a dismissible amber `NoticeBanner` lists skipped lines.

**Given** the stitched output table,
**When** inspecting rows,
**Then** each track displays its origin badge (`source_playlist_title`), title, artist, duration, `VerificationStatusBadge`, and link.

**Given** `FinishLineBar` in `StitchTab`,
**When** viewed,
**Then** it operates strictly on `stitchedResult.tracks` without modifying `App.jsx.workingList`,
**And** primary action is `Play Clean Queue` launching the zero-login YouTube queue, with secondary `Copy Clean Track Links` and `Export ▾` actions.


## Epic 5: VIP Mode Spotify Library Sync & Anonymous Funnel Telemetry

Allowlisted testers can unlock VIP Mode with `?vip=1` to connect their personal Spotify accounts, browse libraries, and save clean playlists directly, while anonymous, privacy-safe usage events record funnel milestones to verify launch health.

### Story 5.1: Query-Parameter VIP Mode Gate, Allowlist Protection, & Safe Exit

As an allowlisted tester,
I want to unlock Spotify login and library controls by visiting with a special link,
So that I can use my personal Spotify account without exposing broken login flows to public visitors.

**Acceptance Criteria:**

**Given** a public visitor without `?vip=1` in the URL and no active session cookie,
**When** viewing CleanPlaylist,
**Then** no Spotify login buttons, library-picker triggers, or direct save actions are rendered anywhere in the UI.

**Given** a visitor arriving with `/?vip=1` (or holding an active `cp_spotify_session` verified via boot `/api/spotify/status`),
**When** the app loads,
**Then** `vipMode` is set to `true` and persisted in `localStorage["cp_vip_mode"]`,
**And** `GlobalHeader` reveals a `VIP` badge, `Connect Spotify` button (or `Spotify Connected` pill), and an `Exit VIP Mode` action.

**Given** an unauthorized user attempting Spotify OAuth who is not on the 5-user developer allowlist,
**When** Spotify redirects back to `/api/spotify/callback`,
**Then** `sp.me()` catches the `403` error and redirects to `/?auth_error=allowlist_blocked&platform=spotify`,
**And** the UI renders a rose `role="alert"` `NoticeBanner` explaining Spotify's 5-user developer policy with a 1-click `Exit VIP Mode` button,
**And** clicking `Exit VIP Mode` clears `localStorage["cp_vip_mode"]`, calls `POST /api/spotify/logout`, and strips `?vip=1` / `?auth_error` from URL state.

### Story 5.2: VIP Spotify Library Browsing (`PlaylistPickerModal`) with Pagination

As an authenticated VIP tester,
I want to browse and search my personal Spotify playlists with pagination,
So that I can quickly load a playlist for screening without copying and pasting URLs.

**Acceptance Criteria:**

**Given** authenticated VIP Mode active,
**When** the user clicks `Browse Library` in `Scan & Clean` or `Stitch Studio`,
**Then** `PlaylistPickerModal` opens over backdrop blur,
**And** it fetches `GET /api/spotify/playlists?limit=20&offset=0`, rendering playlist cards with cover art, title, owner, and track count.

**Given** `PlaylistPickerModal` loaded,
**When** viewing pagination controls,
**Then** `Showing X–Y of Z` is displayed alongside `Previous` and `Next` buttons, which fetch the corresponding offset pages.

**Given** the search input in `PlaylistPickerModal`,
**When** the user types text,
**Then** visible playlists are filtered client-side by name instantly.

**Given** a playlist card in `PlaylistPickerModal`,
**When** the user clicks `Load`,
**Then** the playlist tracks are loaded into `workingList` (or added as a `Stitch Studio` source),
**And** `sourcePlaylist` in `App.jsx` stores `{id: playlist.id, title: playlist.name, canOverwrite: true}`,
**And** the modal closes.

### Story 5.3: Direct Spotify Playlist Creation & Overwrite (`SavePlaylistModal`)

As an authenticated VIP tester,
I want to save my cleaned playlist directly into my Spotify library as a new playlist or overwrite the original,
So that I can immediately listen to the clean version inside my Spotify app.

**Acceptance Criteria:**

**Given** authenticated VIP Mode with at least one ready track,
**When** the user clicks `Save to Spotify` in `FinishLineBar`,
**Then** `SavePlaylistModal` opens displaying the count of verified clean tracks to save.

**Given** `SavePlaylistModal` open,
**When** inspecting options,
**Then** two selectable radio cards are rendered:
  1. `Create New Clean Playlist`: pre-fills title with `<Title> (Clean)` and includes a `Private Playlist` toggle (default: ON);
  2. `Update Original Playlist`: shows a destructive overwrite badge (enabled only when `sourcePlaylist?.canOverwrite == true`).

**Given** `Create New Clean Playlist` confirmed,
**When** `POST /api/spotify/playlist/save` is called with `{original_playlist_id: null, playlist_title: str, final_track_ids: str[], create_new: true, is_public: bool}`,
**Then** backend calls `sp.current_user_playlist_create(name=req.playlist_title, public=req.is_public)` (`POST /v1/me/playlists`),
**And** track URIs are added in batches of 100,
**And** the UI displays a 2-second `"Saved Successfully!"` confirmation before closing.

**Given** `Update Original Playlist` confirmed,
**When** `POST /api/spotify/playlist/save` is called with `create_new: false`,
**Then** `sp.playlist_replace_items` replaces the first 100 tracks and appends remaining tracks in batches of 100,
**And** if updating fails, it raises an HTTP error rather than silently creating an unintended duplicate playlist.

### Story 5.4: Privacy-Safe Usage Event Telemetry Sink (`POST /api/telemetry/event`)

As the product owner,
I want anonymous, zero-PII usage events recorded across key funnel actions,
So that I can evaluate public conversion and adoption rates at $0 infrastructure cost.

**Acceptance Criteria:**

**Given** a user interacting with CleanPlaylist,
**When** a key funnel milestone completes,
**Then** `finishLine.js` (or the relevant workbench) emits a structured event via `POST /api/telemetry/event` (`keepalive: true` / `sendBeacon`):
  1. `input_loaded`: `{event: "input_loaded", platform, viewport_class, vip_mode, session_anon_id, input_type, track_count_bucket}`
  2. `scan_completed`: `{event: "scan_completed", platform, viewport_class, vip_mode, session_anon_id, preset_id, track_count, flagged_count, lyrics_unavailable_count}`
  3. `clean_swap_applied`: `{event: "clean_swap_applied", platform, viewport_class, vip_mode, session_anon_id, mode, swapped_count, unfound_count}`
  4. `stitch_completed`: `{event: "stitch_completed", platform, viewport_class, vip_mode, session_anon_id, source_count, clean_rule, output_count}`
  5. `finish_action_clicked`: `{event: "finish_action_clicked", platform, viewport_class, vip_mode, session_anon_id, action}`.

**Given** `POST /api/telemetry/event` invoked,
**When** `TelemetryService` validates the payload,
**Then** it verifies the request against a strict Pydantic v2 discriminated union with `extra="forbid"`,
**And** rejects any payload containing unknown fields, raw song queries, playlist URLs, playlist titles, custom blocklist words, or IP addresses with HTTP 422,
**And** writes exactly one structured JSON line to stdout (`{"channel": "cp_telemetry", "schema_version": 1, ...}`) for Vercel Runtime Logs inspection,
**And** returns `202 {"ok": true}`.

**Given** a scan with tracks that have `has_lyrics == False`,
**When** `scan_completed` is emitted,
**Then** `lyrics_unavailable_count` accurately counts all tracks where lyrics could not be retrieved (including explicit-flagged tracks), preventing artificial inflation of success metric `SM-3`.
