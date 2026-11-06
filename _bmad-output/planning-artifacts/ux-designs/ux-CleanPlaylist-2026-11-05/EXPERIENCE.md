---
name: CleanPlaylist
status: final
sources:
  - _bmad-output/planning-artifacts/prds/prd-CleanPlaylist-2026-11-04/prd.md
updated: 2026-11-05
---

# CleanPlaylist — Experience Spine

## Foundation

Responsive single-page web workbench (`>= 360px` mobile viewports through `{spacing.page-max}` desktop studio layouts) built on React 19, Vite 8, Tailwind CSS v4, and `lucide-react` stroke icons without an external component library. `DESIGN.md` (Obsidian Audio Core) owns visual identity and tokens; this document specifies information architecture, behavior, states, interactions, accessibility, and user journeys.

CleanPlaylist runs in dedicated dark mode (`{colors.surface-canvas}`) on a **zero-login public client architecture**: users assemble an in-memory **Working List** of up to 50 normalized tracks and call relative `/api/...` endpoints without accounts or cookies. **VIP Mode** (`?vip=1` persisted in browser storage, or an active `cp_spotify_session` cookie) isolates direct Spotify OAuth library browsing and playlist saving.

## Inspiration & Anti-patterns

- **Lifted from Tidal Web & Spotify Desktop:** Authoritative dark studio hierarchy, dense scannable track rows with `{typography.mono-sm}` durations and line numbers, and native desktop clipboard handoff (`Ctrl+V` / `Cmd+V` pasting track URLs directly into a Spotify Desktop playlist).
- **Rejected — v1 Split-Personality Platform Chrome:** Flipping header and primary button colors between Spotify green and YouTube purple without resetting state caused cross-platform state pollution and collided with clean safety badges. Unified `{colors.brand-primary}` owns studio actions across both catalogs; `{colors.status-clean}` is reserved exclusively for safety verification.
- **Rejected — Public Login Dead-Ends & `"Read-Only Mode"` Labels:** Never expose `"Login to Spotify"` to public visitors (blocked by Spotify's 5-user Development Mode cap) or `"Read-Only Mode"` badges on YouTube Music.
- **Rejected — Manual `"Deep Lyric Scan"` Checkboxes & Track-Cap Dropdowns:** Full lyric evaluation (direct on `ytmusic`, **Lyric Cross-Reference** on `spotify`) runs automatically in progressive batches across up to 50 tracks.
- **Rejected — Stitch AI Embellishments & Deferred Widgets:** Exclude fabricated telemetry (`320 kbps`, `FCC Standard`, `99.4% Confidence`, `01:22` LRC timestamps, `Phonetic stemming`), shell clutter (notification bells, settings gears, avatars, `⌘K` bars, sidebars), inline audio scrubbers/iframes, and `#list=...` share buttons.

## Information Architecture

| Surface | Reached from | Purpose | Visual reference |
|---|---|---|---|
| `Scan & Clean` (Workbench & Mobile View) | Cold open / `GlobalHeader` Tab 1 | Assemble up to 50 tracks in **Working List**, run categorized lyric scan, swap **Clean Replacements**, and trigger zero-auth finish actions | [01-scan-clean-desktop.html](mockups/01-scan-clean-desktop.html) (desktop table & finish bar); [02-scan-clean-mobile.html](mockups/02-scan-clean-mobile.html) (390px stacked parent-test cards) |
| `Scan & Clean` — Paste & Spotify Helper | `Paste Track List` button or pasting Spotify playlist URL in `SmartInputBar` | Resolve multi-line **Pasted Track List** (`Artist - Title` or track URLs) and guide unauthenticated Spotify playlist copy-paste | [06-paste-and-spotify-helper-desktop.html](mockups/06-paste-and-spotify-helper-desktop.html) (expanded `PasteTrackListPanel` + `SpotifyPlaylistHelper`) |
| `LyricsModal` | `View Lyrics` action on any row/card in `Scan & Clean` or `Keyword Search` | Inspect line-numbered lyrics, jump across flagged tokens, and apply an in-modal **Clean Replacement** or remove track | [03-lyrics-modal-desktop.html](mockups/03-lyrics-modal-desktop.html) (dialog, swap banner, `L01`–`Lnn` viewer) |
| `Keyword Search` | `GlobalHeader` Tab 2 | Search custom thematic words across cached / cross-referenced lyrics of the current **Working List** (up to 50 tracks) | [05-keyword-search-desktop.html](mockups/05-keyword-search-desktop.html) (chip bar, hit filters, expandable `<mark>` excerpts) |
| **Stitch Studio** | `GlobalHeader` Tab 3 | Merge 2+ zero-login sources (up to 50 combined public input tracks) under automated batch clean, order, and deduplication rules | [04-stitch-studio-desktop.html](mockups/04-stitch-studio-desktop.html) (quota bar, source pool, batch rules, merged output) |
| `PlatformSwitchModal` | Toggling `CatalogSelector` when `Working List` is non-empty | Confirm clearing staged tracks and scan/lyric state before changing **Active Platform** | Spine-only (`DESIGN.md.Components` + `## Component Patterns`) |
| **VIP Mode** Controls & Modals (`/?vip=1`) | Visiting with `?vip=1` (or active `cp_spotify_session`) → `Browse Library` / `Save to Spotify` | Allowlisted Spotify OAuth connect, paginated personal playlist picker (`PlaylistPickerModal`), and direct Spotify playlist write (`SavePlaylistModal`) | [07-vip-spotify-modals-desktop.html](mockups/07-vip-spotify-modals-desktop.html) (**VIP Mode** header, `PlaylistPickerModal`, `SavePlaylistModal`) |

**Navigation & Stacking Rules:** `GlobalHeader` exposes strictly three tabs (`Scan & Clean`, `Keyword Search`, `Stitch Studio`). `Working List` state persists in memory when switching tabs so `Keyword Search` and **Stitch Studio** (`Add Current Working List`) operate seamlessly on staged tracks. Modals stack strictly one level deep over `{colors.surface-backdrop}`. Spines win on conflict with any mockup.

## Active Platform & Unified Catalog Model

`CatalogSelector` in `GlobalHeader` governs **Active Platform** (`spotify` | `ytmusic`) across all three tabs. Every `/api/*` request body explicitly sends `platform: activePlatform` so backend defaults (`"ytmusic"`) never mismatch UI context.

| Capability | `spotify` (Public Default) | `ytmusic` (Public Default) | `spotify` (**VIP Mode** `?vip=1`) |
|---|---|---|---|
| Song & Album Search (`FR-1`) | Server-side Client Credentials (`0` user login) | Unauthenticated catalog search | Authenticated / Client Credentials |
| Playlist URL Input (`FR-4`, `FR-10`) | Intercepted client-side (`0` HTTP `401`/`403`) → renders `SpotifyPlaylistHelper` | Loads first 50 tracks directly (`>50` truncation `NoticeBanner`) | Loads Spotify playlist directly with OAuth session |
| **Pasted Track List** (`FR-3`) | Batch track ID lookup (`/v1/tracks?ids=...`) + search fallback | Direct video ID lookup + search fallback | Same as `spotify` public |
| Lyric Evaluation (`FR-5`) | Automatic **Lyric Cross-Reference** against `ytmusic` (normalized title + primary artist + `±10s` duration tolerance; top-song fallback if duration absent) | Direct `ytmusic` lyric retrieval | Automatic **Lyric Cross-Reference** against `ytmusic` |
| **Clean Replacement** (`FR-8`, `FR-9`) | Non-explicit `spotify` catalog match | Non-explicit `ytmusic` catalog match | Non-explicit `spotify` catalog match |
| **Clean Track Link** (`FR-12`) | `https://open.spotify.com/track/<id>` | `https://music.youtube.com/watch?v=<id>` | `https://open.spotify.com/track/<id>` |
| **Clean Queue** (`FR-11`) | `youtube.com/watch_videos?video_ids=...` using cross-referenced YouTube IDs (notes omitted tracks if unresolvable) | `youtube.com/watch_videos?video_ids=...` using native track IDs | Same + sequential `Queue 1–50`, `Queue 51–N` buttons when `>50` tracks |
| Direct Library Save (`FR-14`) | Hidden (uses `Copy Clean Track Links` + Spotify Desktop `Ctrl+V` / `Cmd+V` or file export) | Hidden (uses `Play Clean Queue`, links, or file export) | `Browse Library` (`PlaylistPickerModal`) + `Save to Spotify` (`SavePlaylistModal`) |

- **Platform-Switch Reset (`A-1`, `FR-2`):** Toggling `CatalogSelector` while `Working List` is empty switches **Active Platform** immediately. Toggling while `Working List` contains `>= 1` track opens `PlatformSwitchModal`; confirming clears `Working List`, cached lyrics, replacement candidates, and **Verification Status** badges across tabs.
- **Cross-Platform URL Guard (`FR-3`):** Submitting or pasting `ytmusic` URLs while `spotify` is active (or `spotify` track URLs while `ytmusic` is active) skips those lines into an amber `NoticeBanner` offering a 1-click `"Switch to YouTube Music"` / `"Switch to Spotify"` action.

## Voice and Tone

Direct, calm, evidence-first microcopy for parents and teachers. Never moralize, gamify, or claim AI interpretation.

| Do | Don't |
|---|---|
| `"Swapped 10 of 12 flagged tracks; 2 still need review."` | `"🎉 Awesome! AI cleaned your playlist!"` |
| `"Public Spotify playlist links require a quick copy-paste (no login needed)."` | `"Error 401: Unauthorized — Please log in to Spotify."` |
| `"Lyrics Unavailable — Explicit tag detected on Spotify."` | `"Clean (No lyrics found)"` or `"99.4% Acoustic AI Confidence"` |
| `"Loaded first 50 of 74 tracks (50-track public limit)."` | `"Playlist too large. Upgrade or sign in."` |
| `"Copied 24 Clean Track Links — open Spotify Desktop, click an empty playlist, and press Ctrl+V (Cmd+V)."` | `"Copied to clipboard!"` (without next-step context on desktop `spotify`) |
| `"Direct Spotify login is limited to 5 allowlisted test accounts under Spotify's developer policy."` | `"OAuth callback failed (403 Forbidden)."` |

## Component Patterns

Every component below pairs 1-to-1 verbatim with `DESIGN.md` (`components` frontmatter and `## Components`).

| Component | Surface(s) | Behavioral rules |
|---|---|---|
| `GlobalHeader` | All | Renders sticky navigation across `Scan & Clean`, `Keyword Search`, and `Stitch Studio` (`{colors.brand-tint}` active tab). Hides all OAuth controls unless **VIP Mode** (`?vip=1` in URL/storage or valid `cp_spotify_session` cookie) is active. Clicking `Exit VIP Mode` clears stored VIP flag, calls logout if authenticated, and strips `?vip=1` from URL state. |
| `CatalogSelector` | `GlobalHeader` | Switches **Active Platform** (`spotify` \| `ytmusic`). Immediate when `Working List` is empty; opens `PlatformSwitchModal` when `Working List.length > 0`. Updates placeholder hints, onboarding samples, and **Clean Track Link** targets across all tabs. |
| `SmartInputBar` | `Scan & Clean` | Single unified input (`OQ-1`): debounces (`300ms`) text queries to preview top Song (`+ Add Song`) and Album (`+ Add Album`, appending album tracks in order) matches in `{colors.surface-inset}`, supports 1-click `Clear`, and routes URLs and multi-line pastes per `Smart Input Auto-Detection` (`## Interaction Primitives`). |
| `PasteTrackListPanel` | `Scan & Clean`, **Stitch Studio** | Editable `{typography.mono}` `<textarea>` for a **Pasted Track List**. Strips blank lines and edge whitespace live; updates `N / 50 lines` counter; truncates inputs `> 50` non-empty lines to `50` with an inline `{colors.status-caution}` warning *before* resolution; resolves matching-platform URLs by batch ID and `Artist - Title` text by top search match without failing on typos. |
| `SpotifyPlaylistHelper` | `Scan & Clean`, **Stitch Studio** | Intercepts `open.spotify.com/playlist/...` and `spotify:playlist:...` client-side whenever **VIP Mode** is inactive or unauthenticated (`0` network calls). Provides 3-step Spotify Desktop `Ctrl+A` / `Cmd+A` → `Ctrl+C` / `Cmd+C` instructions; `Focus Paste Box` opens and focuses `PasteTrackListPanel`; `Search Albums Instead` clears the URL and focuses `SmartInputBar`. |
| `ScreeningControlsBar` | `Scan & Clean` | Controls **Sensitivity Preset** (`kid_safe`, `moderate`, `slurs_only`, `custom` across `slurs`, `strong_profanity`, `mild_profanity`, `sexual`, `substances`) and **Custom Blocklist** (starts empty `[]`; `Enter` or `+ Add term` trims, lowercases, deduplicates, and appends a `{rounded.full}` chip). Changing preset or blocklist re-evaluates cached lyrics immediately; `Scan Lyrics` / auto-scan dispatches progressive 10–15 track `/api/scan` batches updating `Scanned X of Y`. Houses bulk `Find & Swap All Clean Versions`. |
| `WorkingListWorkbench` | `Scan & Clean` (Desktop `>= 768px`) | Stages up to 50 normalized tracks (`10`-key contract). Supports 5 filter pills (`All`, `Flagged`, `Verified Clean`, `Clean Swapped`, `Lyrics Unavailable`), instant client-side title/artist text filter, `Clear List`, and **VIP Mode** `Browse Library`. Removing or swapping tracks immediately recalculates header and `FinishLineBar` counts. |
| `MobileTrackCard` | `Scan & Clean` (Mobile `< 768px`) | Replaces wide table columns below `768px` while enforcing `{spacing.touch-min}` (`44px`) touch targets. `Verified Clean` and `Clean Swapped` cards stay compact with 1-tap `Open Clean Track`; `Flagged` cards surface category count chips, first flagged lyric line snippet, `CleanReplacementControl`, `View Lyrics`, and `Remove`. |
| `VerificationStatusBadge` | `Scan & Clean`, **Stitch Studio**, `LyricsModal` | Renders `Unscanned` (`{colors.surface-highest}`) before scanning, `Scanning…` during active batch, and strictly one post-scan **Verification Status**: `Verified Clean` (`{colors.status-clean}`), `Clean Swapped` (`{colors.status-clean}`), `Flagged` (`{colors.status-flagged}`), or `Lyrics Unavailable` (`{colors.status-caution}`). Never renders `Verified Clean` when `has_lyrics: false` (`NFR-3`). |
| `CleanReplacementControl` | `WorkingListWorkbench`, `MobileTrackCard`, `LyricsModal`, `ScreeningControlsBar` | Per-track state machine: `Find Clean Edit` queries `/api/replacements/find` with `platform: activePlatform` → reveals emerald `Swap to Clean` button with matched clean title/duration, or `"No clean version found"` (`{colors.text-muted}`) next to `Remove`. Clicking `Swap to Clean` replaces row track metadata/ID in-memory and sets `Clean Swapped`. Bulk `Find & Swap All Clean Versions` swaps all resolvable `Flagged` rows, leaves unfound rows `Flagged` (never auto-deleting), and emits a summary `NoticeBanner`. |
| `FinishLineBar` | `Scan & Clean`, **Stitch Studio** | Enabled whenever `>= 1` approved/staged track is present. Computes ready tracks (`Verified Clean` + `Clean Swapped`, plus any explicitly kept tracks) and triggers `Play Clean Queue`, `Copy Clean Track Links`, `Export ▾` (`.csv`, `.m3u8`, `.json` through `/api/export`), and **VIP Mode** `Save to Spotify` (`## Interaction Primitives`). |
| `LyricsModal` | Overlay from `Scan & Clean` or `Keyword Search` | Fetches or reads cached lyrics (`FR-7`, `platform: activePlatform`); highlights matched profanity tokens in `{colors.status-flagged}` line callouts; `Flag X of Y ↑ ↓` jumps between flagged `Lnn` lines. Header link opens **Clean Track Link** (`Open Track in Spotify` / `Open Track in YouTube Music`). In-modal `Swap to Clean` updates the parent row to `Clean Swapped`; `Keep Flagged Track` leaves the row unchanged and closes. Displays `"Lyrics cross-referenced via YouTube Music"` when `Active Platform` is `spotify`. |
| `KeywordSearchWorkbench` | `Keyword Search` | Pre-seeds removable starter theme chips (`money`, `drugs`, `party`, `alcohol`, `gun`) alongside custom term entry (`FR-7`). Queries `/api/scan/keywords` with `platform: activePlatform` across loaded **Working List** tracks (batched up to 50 tracks). Clicking `N matching lines ▾` toggles `{colors.surface-inset}` line excerpts with `{colors.keyword-mark-fg}` `<mark>` highlights. |
| `StitchStudioWorkbench` | **Stitch Studio** | Manages 2+ input sources (YouTube Music playlist URL, searched album, **Pasted Track List**, or 1-click `Add Current Working List` when non-empty) against a `50`-track combined public quota (`>50` allowed only in authenticated **VIP Mode**). Exposes **Sensitivity Preset**, batch rules (`clean_mode`, `order_mode`, `deduplication_mode` in `## Interaction Primitives`), and editable `playlistTitle` (used for output header and export filename slug). |
| `NoticeBanner` | All workbenches | Non-blocking inline alert bar. Supports 1-click recovery actions (`Retry` on HTTP `429`, `Switch to Spotify` / `Switch to YouTube Music` on cross-platform URLs, `Exit VIP Mode` on OAuth allowlist rejection) and manual `X` dismissal on informational/truncation notices. |
| `PlatformSwitchModal` | Global overlay | Blocks accidental state loss when `CatalogSelector` is clicked with a non-empty `Working List`. `Cancel` keeps current **Active Platform**; `Switch & Clear List` resets tracks, scan results, cached lyrics, and badges. |
| `PlaylistPickerModal` | **VIP Mode** (`Scan & Clean`, **Stitch Studio**) | Calls `/api/spotify/playlists` (`limit=20` pagination with `Previous` / `Next` and `Showing X–Y of Z`), filters visible playlists by name client-side, and loads the clicked playlist's tracks into **Working List** (or **Stitch Studio** source). |
| `SavePlaylistModal` | **VIP Mode** (`Scan & Clean`, **Stitch Studio**) | Restricted strictly to authenticated `spotify` **VIP Mode**. Submits post-swap track IDs (chunked server-side per 100 URIs) to `/api/spotify/playlist/save` in either `Create New Clean Playlist` mode (default title `<Title> (Clean)` + `Private Playlist` toggle) or `Update Original Playlist` mode, showing a 2-second `"Saved Successfully!"` state before closing. |

## State Patterns

| Surface | State | Behavioral & Visual Treatment |
|---|---|---|
| `Scan & Clean` | Empty / Cold load | `WorkingListWorkbench` displays concise onboarding prompt + 1-click platform-matched sample chips (such as *90s Hip-Hop Album Sample* or *5-Song Parent Test* on `spotify`; public sample playlists on `ytmusic`). `FinishLineBar` actions stay disabled until `>= 1` track is staged. |
| `Scan & Clean` | Pre-scan staged tracks | Newly added tracks display neutral `Unscanned` `VerificationStatusBadge` (`{colors.surface-highest}`)—never `Verified Clean` before lyric evaluation completes (`NFR-3`). |
| `Scan & Clean` | Progressive batched scan (`FR-5`, `NFR-1`) | Client dispatches `10–15` tracks per `/api/scan` call. Initial batch renders **Verification Status** badges in `<= 3s` while remaining rows show `Scanning…` and `ScreeningControlsBar` updates `Scanned X of Y` (`<= 25s` for 50 tracks). |
| `Scan & Clean` & **Stitch Studio** | `>50`-track cap truncation (`FR-2`, `FR-3`, `FR-4`, `FR-10`) | Enforced visibly across all 4 public entry paths with a `{colors.status-caution}` `NoticeBanner` naming omitted count: (1) Song/Album additions exceeding `50` in **Working List**; (2) **Pasted Track List** `>50` non-empty lines warned inline *before* resolution; (3) YouTube Music playlist URL `>50` loads first 50 tracks; (4) public **Stitch Studio** combined sources exceeding `50` tracks. |
| `Scan & Clean` | Duplicate track added (`FR-2`, `UJ-2`) | Exact track ID match on **Active Platform** is ignored without adding a duplicate row; surfaces brief non-blocking `NoticeBanner` (`"Already in Working List"`). |
| `Scan & Clean` & **Stitch Studio** | Missing lyrics & explicit metadata (`FR-6`, `NFR-3`) | **Zero False-Clean Invariant:** If `has_lyrics: false` and `is_explicit: true` (under a metadata-checking **Sensitivity Preset**), row renders `Flagged` (`{colors.status-flagged}`) citing explicit metadata + unavailable lyrics alongside `[E]`. Otherwise `has_lyrics: false` renders `Lyrics Unavailable` (`{colors.status-caution}` amber)—never `Verified Clean` under timeouts, misses, or empty lyric bodies. |
| `Scan & Clean` | Bulk clean swap (`FR-9`) | Button shows `"Finding clean edits (X of Y)…"` progress; on completion, renders summary `NoticeBanner` (`"Swapped X of Y flagged tracks; Z still need review"`). Unswappable tracks remain `Flagged` with `"No clean version found"` + `Remove`. |
| `LyricsModal` | Loading / Lyrics Unavailable / Error | Skeleton lines while fetching; if `has_lyrics: false` or an upstream error occurs, displays `{colors.status-caution}` explanation + platform `[E]` metadata status while keeping `Find Clean Edit`, `Remove`, and `Open Track` operable. |
| `Keyword Search` | Empty **Working List** / Zero matches | Empty **Working List** renders centered card with `"Go to Scan & Clean"` CTA. Populated list with `0` hits renders `"0 of N tracks contain target keywords"` confirmation (noting `Lyrics Unavailable` count when present). |
| **Stitch Studio** | Empty pool / Unresolved paste typos (`FR-3`, `UJ-3`) | `Stitch & Clean` requires `>= 1` valid source (`2+` recommended). Unresolved **Pasted Track List** lines (such as student typos) never abort the merge; matched tracks stitch normally and skipped lines appear as chips in a dismissible `{colors.status-caution}` `NoticeBanner`. |
| `FinishLineBar` | Spotify **Clean Queue** omitted tracks (`FR-11`) | If `Play Clean Queue` is clicked in `spotify` mode and `>= 1` approved track lacked a YouTube video ID match during **Lyric Cross-Reference**, launches the queue with all resolved IDs and displays an inline `{colors.status-caution}` `NoticeBanner` naming how many tracks were omitted. |
| All API surfaces | HTTP `429` rate limit / Network error (`NFR-2`) | Preserves all already-loaded or already-scanned tracks in memory; surfaces `{colors.status-caution}` `NoticeBanner` (`"Catalog rate limit reached — paused at track X"`) with a 1-click `Retry` button that re-runs only remaining failed chunks. Offline/5xx errors surface retryable `NoticeBanner` without clearing **Working List**. |
| `GlobalHeader` (**VIP Mode**) | Non-allowlisted OAuth error (`FR-14`, `UJ-4`) | Returning from `/api/spotify/callback` with `?auth_error=...` renders `{colors.status-flagged}` `NoticeBanner` explaining Spotify's 5-account developer allowlist restriction paired with a 1-click `Exit VIP Mode` button that restores zero-login public mode. |

## Interaction Primitives

- **Smart Input Auto-Detection (`OQ-1`):** `SmartInputBar` inspects input text before dispatching:
  1. `open.spotify.com/playlist/...` or `spotify:playlist:...` → client-side `SpotifyPlaylistHelper` in public mode (`SM-2`); direct `/api/playlist` fetch in authenticated **VIP Mode**.
  2. `music.youtube.com/playlist?list=...` or `youtube.com/playlist?list=...` → loads playlist on `ytmusic`; shows 1-click switch-platform `NoticeBanner` on `spotify`.
  3. Single `open.spotify.com/track/<id>` or `music.youtube.com/watch?v=<id>` URL → direct track lookup (or cross-platform switch hint).
  4. Multi-line paste (`\n` detected on `onPaste`) → populates and expands `PasteTrackListPanel`.
  5. Single-line text → debounced catalog song + album search (`platform: activePlatform`).
- **Progressive Batch Scanning (`FR-5`, `A-4`):** Client chunks uncached tracks into `10–15` item arrays per `/api/scan` POST request so every serverless call finishes well inside `<= 8s` p95 (`< 10s` Vercel ceiling) while rows update live.
- **Human-Judgment Workbench vs. Batch Merger (`FR-8`, `FR-9`, `FR-10`):** `Scan & Clean` never auto-deletes `Flagged` tracks; parents inspect snippets, swap clean edits, keep borderline songs, or click `Remove`. Automated drop policies execute exclusively in **Stitch Studio** via backend-aligned rule enums:
  - `clean_mode`: `replace_clean_or_drop` (*Swap to Clean or Drop Flagged*), `replace_clean_or_keep` (*Swap to Clean or Keep Flagged*), `exclude_flagged` (*Drop All Flagged*), `keep_all` (*Keep All Tracks*).
  - `order_mode`: `sequential`, `interleave`, `title_asc`, `artist_asc`.
  - `deduplication_mode`: `exact_id`, `title_artist`, `none`.
- **Zero-Auth Finish Handoffs (`FR-11`, `FR-12`, `FR-13`):**
  - `Play Clean Queue` opens `https://www.youtube.com/watch_videos?video_ids=<id1,id2,...>` (`target="_blank"`, `rel="noopener noreferrer"`), capped at 50 IDs per URL (`Queue 1–50`, `Queue 51–N` sequential buttons when **VIP Mode** output exceeds 50).
  - `Copy Clean Track Links` writes canonical **Clean Track Links** joined by `\n` (no trailing spaces or markdown) with `navigator.clipboard.writeText` and displays `"Copied N links"` confirmation.
  - `Export ▾` downloads `.csv`, `.m3u8`, or `.json` reflecting post-swap **Clean Replacement** IDs and **Clean Track Links**.
- **Privacy-Safe Telemetry & Secret Hygiene (`FR-15`, `NFR-5`):** Funnel actions emit structured **Usage Events** (`input_loaded`, `scan_completed`, `clean_swap_applied`, `stitch_completed`, `finish_action_clicked` with action enum and `mobile` | `desktop` viewport class) using deterministic `$0` server/client lookups (no LLM calls or client-exposed secrets). Payloads never include search strings, playlist URLs/titles, **Custom Blocklist** terms, or auth tokens.
- **Banned Everywhere:** Auto-removing unswappable tracks in `Scan & Clean`, hover-only actions without mobile tap equivalents, inline audio/iframe players, and nested modals.

## Responsive & Platform

| Viewport Class | Width | Layout & Finish-Line Adaptation |
|---|---|---|
| Mobile Touch Shell | `360px` – `767px` | Two-row sticky `GlobalHeader` with icons + visible tab labels (`Scan & Clean`, `Keyword Search`, `Stitch Studio`) and compact `CatalogSelector`. Replaces `WorkingListWorkbench` table with stacked `MobileTrackCard` list; enforces `{spacing.touch-min}` (`44px`) tap targets and `flex-wrap` chip strips with zero horizontal overflow at `360px`. **Finish-Line Inversion:** `FinishLineBar` docks full-width `{colors.brand-primary}` `Play Clean Queue` on top over 2-column `Copy Clean Track Links` + `Export ▾`, and surfaces per-card `Open Clean Track` because mobile streaming apps do not support bulk URL paste. |
| Tablet / Compact Laptop | `768px` – `1023px` | Single-row `GlobalHeader`; `WorkingListWorkbench` hides secondary `Album` column while keeping `#`, `Title & Artist`, `Duration`, `Verification Status`, and `Actions`. |
| Desktop Studio Workbench | `>= 1024px` (max `{spacing.page-max}` `1280px`) | Full 6-column `WorkingListWorkbench`, 2-column Instant Catalog Matches tray and **Stitch Studio** source grid. **Desktop Finish-Line Priority:** `Scan & Clean` `FinishLineBar` highlights `{colors.brand-primary}` `Copy Clean Track Links` with `{typography.mono-sm}` `Ctrl+V` / `Cmd+V` Spotify Desktop paste instruction (`spotify` mode) alongside secondary `Play Clean Queue` and `Export ▾` (**Stitch Studio** keeps `Play Clean Queue` primary for immediate classroom/event playback). |

## Accessibility Floor

Visual contrast targets (`>= 4.5:1` text, `>= 3.0:1` UI/focus rings) are verified in `DESIGN.md.Colors`.

- **Explicit Accessible Names (`NFR-4` & RTL Contract):** Every button, link, select, and input—especially icon-only `lucide-react` controls—must carry visible label text or an explicit `aria-label` so screen readers and React Testing Library (`getByRole`, `getByPlaceholderText`) resolve unambiguously:
  - Row/card delete button: `aria-label="Remove track"` (or visible `Remove` text on mobile flagged cards)
  - Modal dismiss `X`: `aria-label="Close modal"`
  - Input clear `X`: `aria-label="Clear search"`
  - Chip remove `X`: `aria-label="Remove blocklist term {term}"` / `aria-label="Remove keyword {word}"` / `aria-label="Remove source {name}"`
  - `LyricsModal` jumpers: `aria-label="Previous flagged line"` and `aria-label="Next flagged line"`
  - Search & filter inputs: descriptive `placeholder` + `aria-label` (such as `"Search songs, albums, or paste playlist URL"`, `"Filter loaded tracks..."`, `"Filter your playlists..."`).
- **Keyboard & Focus Management:** Logical DOM tab order across header → inputs → screening controls → track rows → `FinishLineBar`. Opening `LyricsModal`, `PlatformSwitchModal`, `PlaylistPickerModal`, or `SavePlaylistModal` moves focus inside the dialog, traps `Tab` / `Shift+Tab`, dismisses on `Escape`, and restores focus to the invoking trigger on close.
- **Live Region Announcements:** Progressive scan progress (`Scanned X of Y`), bulk **Clean Replacement** completion summaries, deduplication notices, and clipboard `"Copied N Clean Track Links"` confirmations announce through `aria-live="polite"`. HTTP `429` and OAuth failure `NoticeBanner` instances use `role="alert"`.
- **Non-Color & Motion Safety:** Every `VerificationStatusBadge` pairs a distinct `lucide-react` icon with verbatim status text (`Verified Clean`, `Flagged`, `Clean Swapped`, `Lyrics Unavailable`, `Unscanned`) plus `[E]` tags where applicable. Honor `prefers-reduced-motion: reduce` by disabling pulse/shimmer animations and smooth-scroll jumps.

## Key Flows

### `UJ-1` — Randy vets classic hip-hop albums on his laptop for Spotify Desktop

1. Randy opens CleanPlaylist on his laptop browser (`spotify` selected as **Active Platform** in `CatalogSelector`; **VIP Mode** inactive, zero Spotify login buttons visible).
2. In `Scan & Clean`, Randy types two 1990s hip-hop album names into `SmartInputBar` and clicks `+ Add Album` on both matches in the Instant Catalog Matches tray, staging `28 / 50 tracks` in `WorkingListWorkbench`.
3. In `ScreeningControlsBar`, he selects the `moderate` **Sensitivity Preset**, types two family-rule words + `Enter` into **Custom Blocklist**, and runs the scan; progressive 10–15 track batches execute **Lyric Cross-Reference** (`Scanned 28 of 28`), marking 14 rows `Flagged` with category count chips.
4. Randy clicks `View Lyrics` on three borderline tracks to inspect highlighted lines in `LyricsModal`, clicking `Remove` on two songs whose themes are too mature.
5. Randy clicks `Find & Swap All Clean Versions`; CleanPlaylist swaps 10 tracks to `Clean Swapped` (`"Swapped 10 of 12 flagged tracks; 2 still need review"`), and Randy clicks `Remove` (`aria-label="Remove track"`) on the two `"No clean version found"` rows.
6. **Climax:** Seeing 24 approved tracks in `WorkingListWorkbench`, Randy clicks `Copy Clean Track Links` in `FinishLineBar`—copying 24 newline-separated `https://open.spotify.com/track/...` URLs—then opens Spotify Desktop, clicks into his empty *"Dad's 90s Hip-Hop"* playlist, and presses `Ctrl+V` (`Cmd+V`) to populate and sync the playlist to his phone for Saturday's drive.

- **Failure / Edge Path:** One album skit has no matching lyrics on YouTube Music (`has_lyrics: false`) and carries Spotify's `Explicit` flag (`is_explicit: true`). Under `NFR-3` and `FR-6`, CleanPlaylist never marks it `Verified Clean`—it badges the skit `Flagged` (citing explicit metadata + unavailable lyrics; or amber `Lyrics Unavailable` alongside `[E]` when unflagged by metadata rules), prompting Randy to click `Remove` before copying links. If Spotify returns HTTP `429` mid-batch, an amber `NoticeBanner` pauses with a 1-click `Retry` button without losing already-scanned rows.

### `UJ-2` — Jill runs the "Parent Test" on five trending songs from her phone

1. Jill opens CleanPlaylist on her mobile browser (`>= 360px` touch shell) and confirms `spotify` (or `ytmusic`) in `CatalogSelector`.
2. She searches five trending pop and rap titles one by one in `SmartInputBar`, tapping `+ Add Song` on each match until `Working List` shows `5 / 50 tracks`.
3. Jill taps the `kid_safe` **Sensitivity Preset** pill and triggers `Scan Lyrics`; initial `MobileTrackCard` verdicts appear in `<= 3s`.
4. Two cards show emerald `Verified Clean`; two `Flagged` cards display profanity snippets and resolve to emerald `Clean Swapped` when Jill taps `Swap to Clean` (or `Find & Swap All Clean Versions`); the fifth `Flagged` card surfaces `sexual` category snippets that fail her parent test, so she taps the `44px` `Remove` button.
5. **Climax:** Under two minutes from cold open, Jill holds a four-song parent-approved list on her phone without visiting five ad-heavy lyric sites, and taps the docked full-width `Play Clean Queue` CTA in `FinishLineBar` (or per-card `Open Clean Track`) to play the clean songs immediately in the kitchen.

- **Failure / Edge Path:** When Jill accidentally taps `+ Add Song` twice on the same track, `Working List` deduplicates by exact track ID and surfaces a brief `"Already in Working List"` `NoticeBanner` rather than scanning duplicate cards.

### `UJ-3` — Ms. Rivera stitches a safe Friday classroom queue without signing in

1. On a shared 5th-grade classroom laptop wired to an interactive display, Ms. Rivera opens CleanPlaylist and selects the **Stitch Studio** tab with `ytmusic` as her **Active Platform** (zero personal Google or Spotify login).
2. In `StitchStudioWorkbench`, she adds a public YouTube Music pop playlist URL as Source 1 and opens `PasteTrackListPanel` as Source 2 to paste a 12-line **Pasted Track List** of student requests (`Artist - Title`), staging tracks within the `50`-track public quota bar.
3. In the Batch Clean & Merge Rules bar, she sets **Sensitivity Preset** to `kid_safe` and `clean_mode` to `replace_clean_or_drop`, then clicks `Stitch & Clean`.
4. CleanPlaylist resolves the pasted requests, scans lyrics across all staged tracks, swaps flagged songs to **Clean Replacements** where available, drops unswappable flagged tracks, and deduplicates the merged list.
5. **Climax:** Ms. Rivera clicks the primary `Play Clean Queue` CTA on the Stitched Clean Queue card, opening a zero-login `youtube.com/watch_videos?video_ids=...` browser tab queued with up to 50 classroom-safe songs—music plays immediately with zero credentials left on school hardware.

- **Failure / Edge Path:** Two student-written lines contain typos (`"bruno mras - aptt"`) that match nothing in the catalog. **Stitch Studio** completes the merge with all valid tracks and lists the two skipped lines inside a dismissible amber `NoticeBanner` so Ms. Rivera sees why those two requests were omitted. If Ms. Rivera had accidentally pasted a public Spotify playlist URL while unauthenticated, `SpotifyPlaylistHelper` intercepts it client-side (`0` HTTP `401`/`403`) with 3-step copy-paste guidance.

### `UJ-4` — Zo syncs a personal Spotify playlist directly via VIP Mode

1. Zo opens CleanPlaylist from a bookmark containing `/?vip=1`.
2. CleanPlaylist persists **VIP Mode** in browser storage and reveals the `VIP` badge, `Connect Spotify`, and `Exit VIP Mode` in `GlobalHeader`.
3. Zo completes Spotify OAuth (`/api/spotify/login` → `/api/spotify/callback`), clicks `Browse Library` to open `PlaylistPickerModal` (or pastes a Spotify playlist URL directly), loads a personal playlist into `WorkingListWorkbench`, runs the **Lyric Cross-Reference** scan, swaps flagged tracks with `Find & Swap All Clean Versions`, and clicks `Save to Spotify` in `FinishLineBar`.
4. **Climax:** In `SavePlaylistModal`, Zo confirms `Create New Clean Playlist` (`<Title> (Clean)`) or `Update Original Playlist` and clicks `Save to Spotify`—writing the cleaned tracklist directly to Zo's Spotify account through `/api/spotify/playlist/save` while public visitors never see OAuth controls.

- **Failure / Edge Path:** A non-allowlisted visitor discovers `/?vip=1` and clicks `Connect Spotify`. Spotify blocks authorization under the 5-user Development Mode allowlist and redirects back with an OAuth error; CleanPlaylist renders a rose `NoticeBanner` explaining the 5-account test restriction alongside a 1-click `Exit VIP Mode` button that clears **VIP Mode** storage and restores the zero-login workbench.
