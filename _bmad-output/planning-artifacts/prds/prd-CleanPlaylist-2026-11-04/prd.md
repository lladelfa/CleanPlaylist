---
title: "PRD: CleanPlaylist (Public Launch Milestone)"
status: final
created: "2026-11-04"
updated: "2026-11-05"
---

# PRD: CleanPlaylist (Public Launch Milestone)

## 0. Document Purpose

This Product Requirements Document (PRD) defines the functional behaviors, user journeys, quality guardrails, and success criteria for CleanPlaylist's public launch milestone. It is written for the product owner and builder (Zo) and serves as the authoritative input for downstream UX design (`bmad-ux`), technical architecture (`bmad-architecture`), and epic and story decomposition (`bmad-create-epics-and-stories`). Vocabulary is locked in **§3 Glossary**—all journeys (`UJ-1` through `UJ-4`), globally numbered Functional Requirements (`FR-1` through `FR-15`), and Success Metrics (`SM-1` through `SM-4`, `SM-C1` through `SM-C2`) use Glossary nouns verbatim. This PRD builds directly on the finalized Product Brief (`_bmad-output/planning-artifacts/briefs/brief-CleanPlaylist-2026-11-04/brief.md`), its technical addendum, and the existing brownfield codebase (`AGENTS.md`); technical transport and implementation details live in the companion PRD document, `addendum.md`.

## 1. Vision

CleanPlaylist turns screening music for children and students from a tedious lyric-by-lyric chore—or a blind gamble on streaming `[E]` badges—into an instant, zero-login decision workbench across Spotify and YouTube Music. Parents sharing favorite 1980s, 1990s, and 2000s albums often forget explicit verses hidden on untagged older remasters, while kids and students routinely ask for trending tracks where a binary `Explicit` tag hides *why* a song was flagged. CleanPlaylist surfaces exact flagged words, categories, and lyric line snippets alongside verified **Clean Replacements** so adults can run their own "parent test" in under two minutes and immediately play or export an approved list.

This milestone pivots CleanPlaylist to a **zero-login public architecture** in response to Spotify's permanent five-user Development Mode OAuth ceiling (with Extended Quota Mode closed to indie projects under 250,000 monthly active users) and YouTube Music's read-only catalog constraint—delivering public catalog screening, lyric inspection, and frictionless playback and link handoffs at $0 in marginal API costs while reserving Spotify OAuth exclusively for allowlisted testers via **VIP Mode**.

## 2. Target User

### 2.1 Jobs To Be Done

- **Nostalgia Sharing Without Awkward Surprises (Functional & Emotional):** *"When I want to introduce my kids to classic albums and artists I grew up with, help me catch forgotten profanity or adult verses—and swap in radio edits where they exist—so we can enjoy the music together without scrambling for the skip button."*
- **Informed "Parent Test" on Kid Requests (Functional & Judgment):** *"When my child asks to listen to songs their friends are playing, show me the exact lyric lines and categories behind any flags so I can judge whether each song fits our family rules, swap to a clean version, or say no with confidence."*
- **Zero-Login Classroom & Group Queueing (Contextual):** *"When I need background, practice, or reward music as a teacher, youth leader, camp counselor, or sports coach on shared hardware, help me combine vetted tracks and press play immediately without signing my personal streaming account into a shared device."*
- **Frictionless Personal Sync for Allowlisted Testers (Builder Utility):** *"When an approved tester or I use CleanPlaylist, preserve one-click Spotify library browsing and playlist saving without exposing public visitors to broken login buttons."*

### 2.2 Non-Users (This Milestone)

- **Professional Wedding, Prom, and Club DJs:** DJs requiring offline crate synchronization with Serato, Rekordbox, or VirtualDJ across 500-track libraries. Offline file exports (CSV, M3U8, JSON) remain intact, but primary workflows and limits (50-track **Working List**) are optimized for parents and teachers.
- **Developer Tinkerers Seeking BYO OAuth Configuration:** Users expecting to register personal Spotify Developer applications and paste custom Client IDs and Secrets into CleanPlaylist.

### 2.3 Key User Journeys

- **UJ-1. Randy vets classic hip-hop albums on his laptop for Spotify Desktop.**
  - **Persona + context:** Randy, a dad of two elementary school children sitting at his laptop Friday evening, wants to build a playlist of 1990s hip-hop he loved growing up that is safe for Saturday drives, using Spotify as his family streaming app.
  - **Entry state:** Unauthenticated public visitor on desktop browser; selects `spotify` as his **Active Platform** (**VIP Mode** inactive, no Spotify login button shown).
  - **Path:**
    1. Randy searches for two classic hip-hop albums in `Scan & Clean` and appends both albums (28 tracks total) into his **Working List**.
    2. He selects a **Sensitivity Preset** (`moderate`), adds two terms to his **Custom Blocklist**, and runs a lyric scan.
    3. CleanPlaylist performs a **Lyric Cross-Reference** against YouTube Music, flagging 14 tracks with category badges and counts. Randy opens the lyric modal on three borderline songs to read the highlighted lyric snippets in context and removes two tracks whose themes are still too mature.
    4. Randy clicks **"Find & Swap All Clean Versions"**; CleanPlaylist locates **Clean Replacements** for 10 of the remaining 12 flagged tracks and marks two tracks as having no clean edit available, which Randy removes.
  - **Climax:** Randy now sees a 24-track verified list in `Scan & Clean` and clicks **"Copy Clean Track Links"**, putting 24 newline-separated `https://open.spotify.com/track/...` URLs onto his clipboard.
  - **Resolution:** Randy opens the Spotify Desktop app, creates a playlist named *"Dad's 90s Hip-Hop"*, clicks into the empty tracklist, and presses `Ctrl+V` (`Cmd+V`)—instantly populating a saved Spotify playlist that syncs to Spotify on his phone for tomorrow's drive.
  - **Edge case:** One album skit has no matching lyrics on YouTube Music; CleanPlaylist badges its **Verification Status** as `Lyrics Unavailable` alongside Spotify's `Explicit` tag rather than marking it `Verified Clean`, prompting Randy to remove the skit.

- **UJ-2. Jill runs the "Parent Test" on five trending songs from her phone.**
  - **Persona + context:** Jill, mom of a 10-year-old, needs to vet five trending pop and rap songs her child's friends talk about at school after her child asked to listen to them.
  - **Entry state:** Unauthenticated public visitor on mobile phone browser; selects `spotify` (or `ytmusic`) as her **Active Platform**.
  - **Path:**
    1. Jill searches each of the five song titles one by one in `Scan & Clean`, tapping **"+ Add to Working List"** on each match until all five sit in her **Working List**.
    2. She selects the `kid_safe` **Sensitivity Preset** and taps **Scan Lyrics**.
    3. She expands the flagged results on her phone: two songs are `Verified Clean`; two songs show profanity snippets that disappear when she taps **Swap to Clean** (or **Find & Swap All Clean Versions**); one song contains lyric snippets in the `sexual` category that fail her parent test, so she taps the remove icon to drop it.
  - **Climax:** In under two minutes, Jill has a four-song parent-approved list without reading five separate lyric websites.
  - **Resolution:** Right from the mobile view, Jill taps **"Open Clean Track"** on each approved song to play or save it inside her streaming app—or taps **"Play Clean Queue"** to stream all four clean tracks immediately in the kitchen.
  - **Edge case:** If Jill accidentally taps **"+ Add to Working List"** twice on the same song, CleanPlaylist deduplicates by track ID and shows a brief notice rather than scanning duplicate rows.

- **UJ-3. Ms. Rivera stitches a safe Friday classroom queue without signing in.**
  - **Persona + context:** Ms. Rivera, a 5th-grade teacher, is preparing Friday afternoon art-time music on a shared classroom laptop wired to an interactive display.
  - **Entry state:** Unauthenticated public visitor on classroom desktop browser; switches to **Stitch Studio** with `ytmusic` (or `spotify`) as her **Active Platform**.
  - **Path:**
    1. Ms. Rivera adds a public YouTube Music pop playlist URL as Source 1 and pastes a 12-line **Pasted Track List** of student song requests (`Artist - Title`) as Source 2.
    2. She selects the `kid_safe` **Sensitivity Preset** and sets the batch clean policy to `replace_clean_or_drop`.
    3. She clicks **Stitch & Clean**; CleanPlaylist resolves the pasted songs, scans lyrics across all tracks, swaps flagged songs to **Clean Replacements** where available, drops unswappable flagged tracks, and deduplicates the merged result.
  - **Climax:** Ms. Rivera clicks **"Play Clean Queue"**, opening a zero-login YouTube playback tab queued with up to 50 vetted songs.
  - **Resolution:** Safe classroom music plays immediately without leaving personal Google or Spotify credentials on the school computer.
  - **Edge case:** Two student-written song lines have typos that match nothing; **Stitch Studio** completes the merge with the matched songs and lists the two unresolved lines clearly so Ms. Rivera knows why they were skipped.

- **UJ-4. Zo syncs a personal Spotify playlist directly via VIP Mode.**
  - **Persona + context:** Zo (or one of up to four allowlisted test users) wants to curate a personal family Spotify playlist using v1's direct library read and one-click save workflow.
  - **Entry state:** Visits CleanPlaylist using a bookmark containing the client-side **VIP Mode** query parameter (`/?vip=1`).
  - **Path:**
    1. CleanPlaylist detects `?vip=1`, persists **VIP Mode** in browser storage, and reveals the **Connect Spotify** OAuth control in the header.
    2. Zo completes Spotify OAuth (`/api/spotify/login` → `/api/spotify/callback`), opens **Browse Library** (`PlaylistPickerModal`) or pastes a Spotify playlist URL directly, scans tracks (enriched with **Lyric Cross-Reference**), swaps flagged songs, and clicks **Save to Spotify**.
  - **Climax:** CleanPlaylist writes the cleaned tracklist directly to a new `<Title> (Clean)` playlist (or updates the existing playlist) in Zo's Spotify account.
  - **Resolution:** Zo's personal workflow remains intact while general public visitors never see Spotify OAuth controls unless they open the **VIP Mode** URL.
  - **Edge case:** If a non-allowlisted user discovers `?vip=1` in source code and clicks **Connect Spotify**, Spotify's OAuth screen blocks authorization per the five-user allowlist; returning to CleanPlaylist surfaces a clear message explaining that direct Spotify login is restricted to allowlisted test accounts and offers a one-click action to exit **VIP Mode**.

## 3. Glossary

*Downstream UX, Architecture, and Story documents must use these exact terms without synonyms.*

- **Active Platform** — The user-selected catalog context (`spotify` or `ytmusic`) governing track lookup metadata, branding accent, and primary **Clean Track Link** targets.
- **Working List** — The client-side staging collection of up to 50 normalized tracks assembled in `Scan & Clean` via song search, album lookup, **Pasted Track List** import, or playlist fetch prior to or during lyric scanning.
- **Pasted Track List** — Multi-line plain text entered by a user containing up to 50 entries formatted as `Artist - Title` strings, Spotify track URLs (`https://open.spotify.com/track/...`), or YouTube Music URLs (`https://music.youtube.com/watch?v=...`).
- **Lyric Cross-Reference** — The backend lookup that matches a `spotify` track (by title, artist, and duration) to its corresponding `ytmusic` catalog entry to retrieve full song lyrics for scanning.
- **Verification Status** — One of four mutually exclusive post-scan track states:
  - `Verified Clean`: Lyrics were retrieved and contain no matches against the active **Sensitivity Preset** and **Custom Blocklist**, and platform metadata is not explicit (when the preset checks metadata).
  - `Flagged`: Lyrics or explicit metadata matched one or more active rules.
  - `Clean Swapped`: A `Flagged` track replaced in the **Working List** or **Stitch Studio** output by a verified **Clean Replacement**.
  - `Lyrics Unavailable`: No lyric text could be retrieved (directly or via **Lyric Cross-Reference**); falls back to platform `Explicit` metadata if present and never displays `Verified Clean`.
- **Clean Replacement** — A non-explicit alternate version (such as a radio edit or clean album version) of a `Flagged` track matched by artist and title on the **Active Platform**.
- **Sensitivity Preset** — One of the four configured profanity filter profiles (`kid_safe`, `moderate`, `slurs_only`, `custom`) controlling which word categories (`slurs`, `strong_profanity`, `mild_profanity`, `sexual`, `substances`) and explicit metadata flags trigger a `Flagged` state.
- **Custom Blocklist** — User-entered words or phrases evaluated alongside the selected **Sensitivity Preset** during lyric scanning.
- **Clean Queue** — A zero-auth YouTube playback URL (`https://www.youtube.com/watch_videos?video_ids=...`) constructed from up to 50 approved YouTube video IDs per batch.
- **Clean Track Link** — The canonical external URL (`https://open.spotify.com/track/<id>` or `https://music.youtube.com/watch?v=<id>`) pointing directly to an approved track or its **Clean Replacement** on the **Active Platform**.
- **Stitch Studio** — The multi-source merging surface (`Stitch Playlists` tab) where users combine two or more inputs under automated batch clean rules (`replace_clean_or_drop`, `replace_clean_or_keep`, `exclude_flagged`, `keep_all`).
- **VIP Mode** — The UI state unlocked by a designated URL query parameter and persisted in browser storage that reveals Spotify OAuth login, library picking, direct Spotify playlist URL fetching, and `/api/spotify/playlist/save`.
- **Usage Event** — An anonymous, zero-PII telemetry record capturing key funnel actions (input added, scan completed, swap applied, finish-line action triggered) for test rollout monitoring.

## 4. Features

### 4.1 Zero-Login Multi-Input & Working List

**Description:** Public users arriving on `Scan & Clean` assemble a **Working List** of up to 50 tracks via catalog song/album search, **Pasted Track List** import, or YouTube Music playlist URL load without signing in. Realizes `UJ-1`, `UJ-2`, `UJ-3`, `UJ-4`.

**Functional Requirements:**

#### FR-1: Zero-Login Song and Album Search
An unauthenticated user can search for songs and albums by keyword on the **Active Platform** (`spotify` via Client Credentials or `ytmusic` unauthenticated) and preview matching results before adding them to the **Working List**. Realizes `UJ-1`, `UJ-2`.

**Consequences (testable):**
- Searching a query returns normalized song results (10-key track schema) and album results (title, artist, thumbnail, track count, album ID) for both `spotify` and `ytmusic` without a `cp_spotify_session` cookie present.
- Selecting `"Add Song"` appends that single track to the **Working List**; selecting `"Add Album"` fetches the album's tracks and appends them in tracklist order up to the **Working List** cap (`FR-2`).

#### FR-2: Working List Assembly, Deduplication, and 50-Track Cap
A user can incrementally add songs and albums into a persistent in-memory **Working List** up to 50 tracks, remove individual rows, or clear the entire **Working List**. Realizes `UJ-1`, `UJ-2`.

**Consequences (testable):**
- Adding tracks appends to existing **Working List** items rather than overwriting them, deduplicating exact track IDs on the **Active Platform** and displaying a visible count (`N / 50 tracks`).
- Attempting to add tracks beyond 50 truncates the addition at 50 tracks and displays a clear warning naming how many tracks were omitted due to the 50-track limit.
- Clicking `"Clear List"` resets the **Working List** to 0 tracks.
- Switching **Active Platform** (`spotify` ↔ `ytmusic`) when the **Working List** is non-empty prompts user confirmation; confirming clears all **Working List** tracks and resets all in-memory scan results, cached lyrics, and **Verification Status** badges to prevent cross-platform state pollution.

#### FR-3: Pasted Track List Import
A user can paste a **Pasted Track List** of up to 50 lines (plain-text `Artist - Title` lines or direct Spotify/YouTube Music track URLs) and resolve them into the **Working List** or a **Stitch Studio** source. Realizes `UJ-1`, `UJ-3`.

**Consequences (testable):**
- Blank lines and leading/trailing whitespace are stripped automatically; the system truncates inputs exceeding 50 non-empty lines to 50 tracks and displays an inline count warning before resolution.
- Direct track URLs matching the **Active Platform** resolve by exact track ID lookup; plain-text lines resolve via top catalog search match on the **Active Platform**; track URLs belonging to the non-active platform are skipped and surfaced in the unresolved lines summary with a hint to switch **Active Platform**.
- Unresolved lines do not fail the batch; resolved tracks populate normally while unresolved lines are surfaced in a dismissible summary list.

#### FR-4: Playlist URL Handling and Public Spotify Playlist Fallback
A user can load a public or unlisted YouTube Music playlist URL directly, while an unauthenticated public user who pastes a Spotify playlist URL receives a guided inline helper instead of an authorization error. Realizes `UJ-1`, `UJ-3`, `UJ-4`.

**Consequences (testable):**
- Pasting a valid YouTube Music playlist URL loads up to the first 50 tracks into the **Working List** and displays a clear truncation notice when the source playlist exceeds 50 tracks.
- When **VIP Mode** is inactive (or `isAuthenticated` is false) and a user submits `open.spotify.com/playlist/...` or `spotify:playlist:...`, the UI intercepts submission client-side (without making HTTP 401 or 403 calls) and displays step-by-step instructions to select tracks in Spotify Desktop (`Ctrl+A` / `Cmd+A`, `Ctrl+C` / `Cmd+C`) and paste them via **Pasted Track List**, or search albums directly.

---

### 4.2 Cross-Platform Lyric Scanning & Verification Honesty

**Description:** CleanPlaylist evaluates tracks on both platforms against full song lyrics (via **Lyric Cross-Reference** on `spotify`) and assigns an explicit **Verification Status** so missing lyrics are never mistaken for clean songs. Realizes `UJ-1`, `UJ-2`, `UJ-3`.

**Functional Requirements:**

#### FR-5: Cross-Platform Lyric Cross-Reference and Categorized Regex Scan
When scanning tracks on `spotify` or `ytmusic`, the system retrieves lyrics (via direct lookup on `ytmusic` or **Lyric Cross-Reference** on `spotify`) and evaluates them against the selected **Sensitivity Preset** and **Custom Blocklist**. Realizes `UJ-1`, `UJ-2`, `UJ-3`.

**Consequences (testable):**
- Scanning a `spotify` track executes a **Lyric Cross-Reference** against YouTube Music requiring normalized title and primary artist similarity plus duration within `±10 seconds` (falling back to top song result when duration metadata is absent) to avoid matching incorrect covers or remixes.
- Matched lyrics are scanned by `ScannerService`, returning flagged categories (`slurs`, `strong_profanity`, `mild_profanity`, `sexual`, `substances`, `custom`), occurrence counts, and exact lyric line snippets identically on both platforms.
- Scanning executes in progressive client-requested batches of 10 to 15 tracks per `/api/scan` request with visible progress (`Scanned X of Y`) so a 50-track **Working List** never triggers serverless request timeouts.

#### FR-6: Explicit Verification Status and Lyrics Unavailable Guardrail
The system assigns and displays one of the four **Verification Status** badges (`Verified Clean`, `Flagged`, `Clean Swapped`, or `Lyrics Unavailable`) on every scanned track. Realizes `UJ-1`, `UJ-2`.

**Consequences (testable):**
- A track with `has_lyrics: false` (no lyric match found) is *never* rendered as `Verified Clean`; it displays a distinct `Lyrics Unavailable` warning badge.
- If a track has `has_lyrics: false` *and* `is_explicit: true` in platform metadata (under a **Sensitivity Preset** that checks metadata), its status is `Flagged` (with a reason citing explicit metadata and unavailable lyrics).

#### FR-7: Lyric Snippet Inspection and Keyword Search Continuity
A user can inspect highlighted flagged lyric snippets per track via the lyrics modal and search custom target terms across the loaded **Working List** in the `Keyword Search` tab on both `spotify` and `ytmusic`. Realizes `UJ-1`, `UJ-2`.

**Consequences (testable):**
- Clicking `"View Lyrics"` on any `spotify` or `ytmusic` track where **Lyric Cross-Reference** succeeded opens `LyricsModal` with flagged tokens highlighted in line context.
- Switching to `Keyword Search` with a populated **Working List** searches cached or cross-referenced lyrics across up to 50 tracks on both `spotify` and `ytmusic`.

---

### 4.3 Clean Replacement Workbench

**Description:** Scanned tracks support per-track judgment (*Keep*, *Remove*, or single *Swap*) alongside a one-click bulk **Clean Replacement** action across the **Working List**. Realizes `UJ-1`, `UJ-2`.

**Functional Requirements:**

#### FR-8: Per-Track Keep, Remove, and Clean Replacement Swap
A user can keep a `Flagged` track as-is, remove any track from the **Working List**, or search and apply a **Clean Replacement** on an individual `Flagged` track. Realizes `UJ-1`, `UJ-2`.

**Consequences (testable):**
- Clicking `"Find Clean Edit"` queries the **Active Platform** (`spotify` via Client Credentials when unauthenticated, or `ytmusic`) and displays candidate clean version metadata; clicking `"Swap to Clean"` replaces the row in-memory and sets **Verification Status** to `Clean Swapped`.
- If no non-explicit match exists, the row displays `"No clean version found"` and retains a one-click remove button.

#### FR-9: One-Click Bulk Clean Swap in Scan & Clean
A user can click **"Find & Swap All Clean Versions"** in `Scan & Clean` to automatically locate and apply **Clean Replacements** across all currently `Flagged` tracks in the **Working List**. Realizes `UJ-1`, `UJ-2`.

**Consequences (testable):**
- Triggering **"Find & Swap All Clean Versions"** processes all `Flagged` tracks, automatically swapping every track that returns a valid **Clean Replacement** to `Clean Swapped` and displaying a completion summary (`Swapped X of Y flagged tracks; Z still need review`).
- Tracks with no available **Clean Replacement** remain visibly `Flagged`; `Scan & Clean` never automatically deletes unswappable tracks without user action (automated drop policies apply exclusively to **Stitch Studio** batch rules).

---

### 4.4 Public Stitch Studio

**Description:** **Stitch Studio** merges multiple zero-login inputs under automated batch clean rules (`replace_clean_or_drop`, `replace_clean_or_keep`, `exclude_flagged`, `keep_all`) and deduplication. Realizes `UJ-3`.

**Functional Requirements:**

#### FR-10: Zero-Login Multi-Source Stitching
An unauthenticated user can configure two or more sources in **Stitch Studio** and merge them using batch clean rules on either **Active Platform**. Public sources support YouTube Music playlist URLs, searched albums, or **Pasted Track Lists** up to a 50-track combined input budget, with an inline truncation notice when inputs exceed 50 tracks. Realizes `UJ-3`.

**Consequences (testable):**
- **Stitch Studio** executes without requiring `cp_spotify_session` when sources are albums or **Pasted Track Lists** in `spotify` mode, or any supported source in `ytmusic` mode.
- `spotify` tracks processed in **Stitch Studio** use **Lyric Cross-Reference** rather than explicit metadata alone when evaluating clean rules.
- Unauthenticated users pasting a Spotify playlist URL into a **Stitch Studio** source slot receive the same guided helper defined in `FR-4`.

---

### 4.5 Dual Zero-Auth Finish Line

**Description:** Both `Scan & Clean` and **Stitch Studio** offer a consistent zero-login finish line across `spotify` and `ytmusic`: instant **Clean Queue** playback, **Clean Track Links** (deep links plus clipboard copy), and file exports. Realizes `UJ-1`, `UJ-2`, `UJ-3`.

**Functional Requirements:**

#### FR-11: Universal Clean Queue Playback Across Both Platforms
A user with at least one track in their **Working List** or **Stitch Studio** result can click **"Play Clean Queue"** in either `spotify` or `ytmusic` mode to launch a zero-login YouTube **Clean Queue** in a new browser tab. Realizes `UJ-2`, `UJ-3`.

**Consequences (testable):**
- In `ytmusic` mode, **"Play Clean Queue"** constructs `https://www.youtube.com/watch_videos?video_ids=...` from the current track IDs (up to 50 video IDs per batch; when authenticated **VIP Mode** playlist merges exceed 50 tracks, the UI renders sequential batch buttons `Queue 1–50`, `Queue 51–N`).
- In `spotify` mode, **"Play Clean Queue"** uses the YouTube video IDs resolved during **Lyric Cross-Reference** (resolving clean YouTube counterparts for `Clean Swapped` tracks where needed) and notes if any unresolvable tracks were omitted from the queue.

#### FR-12: Per-Track Clean Track Links and One-Click Copy Clean Track Links
A user can open any individual track's **Clean Track Link** directly on the **Active Platform** or copy all current **Clean Track Links** as newline-separated URLs with one click. Realizes `UJ-1`, `UJ-2`.

**Consequences (testable):**
- Every row in `Scan & Clean` and **Stitch Studio** renders an accessible `"Open Clean Track"` (or `"Open Track"`) link pointing to `https://open.spotify.com/track/<id>` (`spotify`) or `https://music.youtube.com/watch?v=<id>` (`ytmusic`).
- Clicking **"Copy Clean Track Links"** writes newline-separated Spotify or YouTube Music **Clean Track Links** with no trailing spaces to the clipboard; desktop viewports display inline `Ctrl+V` / `Cmd+V` Spotify Desktop paste instructions, while mobile viewports emphasize **"Play Clean Queue"** and per-track **"Open Clean Track"** links since mobile apps do not support bulk tracklist paste.

#### FR-13: Offline File Exports Continuity
A user can export the current **Working List** or **Stitch Studio** result as CSV, M3U8, or JSON on either **Active Platform** without authentication. Realizes `UJ-1`.

**Consequences (testable):**
- `/api/export` continues generating valid `csv`, `m3u8`, and `json` downloads containing the post-swap track metadata and **Clean Track Links**.

---

### 4.6 VIP Mode Gate & Legacy Spotify Sync

**Description:** **VIP Mode** isolates v1 Spotify OAuth login, library browsing, and one-click playlist saving behind a client-side URL query parameter for up to five allowlisted accounts. Realizes `UJ-4`.

**Functional Requirements:**

#### FR-14: Query-Parameter VIP Mode Activation and Public UI Isolation
The application hides all Spotify OAuth login, library-picker, and direct Spotify save controls by default, unlocking **VIP Mode** only when the user visits with the designated URL query parameter (or already holds an active `cp_spotify_session` cookie). Realizes `UJ-4`.

**Consequences (testable):**
- Visiting CleanPlaylist without the `?vip=1` query parameter (configurable via a single frontend constant) and without an active auth session does not render `"Connect Spotify"`, `"Browse Library"`, or `"Save to Spotify"` buttons anywhere in the UI.
- Visiting with `/?vip=1` persists **VIP Mode** in browser `localStorage` or `sessionStorage` across the Spotify OAuth redirect cycle and exposes all v1 Spotify OAuth capabilities (`PlaylistPickerModal`, direct Spotify playlist URL fetch, `SavePlaylistModal`).
- The UI includes an `"Exit VIP Mode"` (or logout) control that clears stored **VIP Mode** state, plus a clear fallback message if a non-allowlisted user fails Spotify OAuth.

---

### 4.7 Anonymous Usage Funnel Telemetry

**Description:** Anonymous **Usage Event** logging provides funnel visibility across test-user rollouts and public launches without user accounts or cookies. Validates `SM-1` through `SM-4`.

**Functional Requirements:**

#### FR-15: Privacy-Safe Usage Event Recording
The system records anonymous **Usage Events** across core funnel milestones without collecting user identities, playlist titles, custom blocklist words, or IP-linked profiles. Validates `SM-1` through `SM-4`.

**Consequences (testable):**
- Emits structured JSON **Usage Events** from backend endpoints (plus an optional client-side analytics hook when configured, keeping infrastructure cost at $0) for:
  1. `input_loaded` (input type: `song_search`, `album_search`, `pasted_list`, `ytm_playlist`, `vip_spotify_playlist`; platform; track count bucket)
  2. `scan_completed` (platform, preset ID, track count, flagged count, `lyrics_unavailable` count)
  3. `clean_swap_applied` (mode: `single` or `bulk`, swapped count, unfound count)
  4. `stitch_completed` (platform, source count, clean rule, output count)
  5. `finish_action_clicked` (action: `play_clean_queue`, `copy_clean_links`, `open_track_link`, `file_export`, `vip_spotify_save`; platform; device viewport class `mobile` vs `desktop`)
- Automated unit tests verify telemetry payloads contain no raw song queries, playlist URLs, user emails, or Spotify tokens.

#### FR-16: On-Screen Profanity Masking & Unmask Toggle
The UI defaults to masking all displayed profanity tokens, custom blocklist chips, and detected keyword matches (preserving only the first character followed by asterisks, e.g., `w***`), with a global toggle in the screening controls to mask/unmask on demand without altering internal regex evaluation or API payloads.

**Consequences (testable):**
- Global `isMasked` state initializes to `true` on app mount.
- A toggle button in `ScreeningControlsBar` allows switching `isMasked` between `true` and `false`.
- When `isMasked` is `true`, formatting helper `${word[0]}${'*'.repeat(word.length - 1)}` masks displayed terms across blocklist chips, detected reasons, modal line highlights, and keyword search excerpts.
- Internal screening regexes, sensitivity preset lists, and backend scan payloads continue to evaluate against raw unmasked strings.

## 5. Cross-Cutting Non-Functional Requirements & Guardrails

- **NFR-1 — Serverless Scan Latency & Timeout Safety:** Each batched API request (`/api/scan`, `/api/replacements/find`, catalog search) must complete in `<= 8 seconds` at p95 (`< 10 seconds` Vercel Hobby function ceiling). Full 50-track **Working List** lyric scanning must stream or batch progressively so the user sees initial track results in `<= 3 seconds` and full completion in `<= 25 seconds` under normal upstream latency.
- **NFR-2 — Spotify Rate-Limit Conservation:** When resolving **Pasted Track Lists** containing Spotify track URLs or fetching album tracks via Client Credentials, the backend must use Spotify batch endpoints (`GET /v1/tracks?ids=...` up to 50 IDs, `GET /v1/albums/{id}/tracks`) rather than N individual search calls, and the UI must display a clear retryable banner on HTTP `429`.
- **NFR-3 — Zero False-Clean Safety Invariant:** Under no error condition (upstream timeout, YouTube Music search miss, empty lyric body, rate limit) may a track default to `Verified Clean`; failed lyric lookups must always resolve to `Lyrics Unavailable` (or `Flagged` if explicit metadata is true).
- **NFR-4 — Mobile & Desktop Accessibility Parity:** All new interactive controls across mobile (`>= 360px` viewport width) and desktop viewports must follow the existing dark Slate Tailwind CSS v4 palette and include visible text or explicit `aria-label` attributes on every button and input (including icon-only `lucide-react` actions) to maintain 100% React Testing Library queryability and keyboard accessibility.
- **NFR-5 — $0 Marginal Run Cost & Secret Hygiene:** Public functionality must rely exclusively on zero-marginal-cost catalog and lyric lookups with no paid third-party LLM or database dependencies. Server-side `SPOTIFY_CLIENT_SECRET` and `SESSION_SECRET` must never be exposed to client bundles; Client Credentials tokens must be fetched and cached server-side only.

## 6. Non-Goals (Explicit)

- **Not a cloud playlist host or social network:** CleanPlaylist will not create user accounts, store persistent playlists in a database, or host public user profiles.
- **No BYO developer credentials:** CleanPlaylist will never require users to open the Spotify Developer Dashboard or supply API keys.
- **Not an unofficial library-write scraper:** CleanPlaylist will not use browser extensions, spoofed cookies, or unofficial InnerTube/Spotify internal write APIs to mutate user libraries.
- **No DJ software integrations:** CleanPlaylist will not build Serato/Rekordbox plugins or bulk >50-track playlist sync tools.

## 7. MVP Scope

### 7.1 In Scope
The Public Launch MVP encompasses all 15 Functional Requirements (`FR-1` through `FR-15`) defined in **§4 Features** and all five guardrails (`NFR-1` through `NFR-5`) in **§5**, delivering the complete zero-login screening, replacement, stitching, finish-line queueing/export, **VIP Mode** isolation, and anonymous **Usage Event** loop across Spotify and YouTube Music under the 50-track working cap.

### 7.2 Out of Scope for This Milestone
- **Stateless QR Code & Compressed URL Hash (`#list=...`) for Laptop-to-Phone Handoff:** Deferred post-validation (`UJ-1` prioritizes Spotify Desktop `Ctrl+V` link paste, which natively syncs playlists to the user's phone via Spotify).
- **Guided Soundiiz / TuneMyMusic Import Buttons:** Deferred post-launch unless test users without Spotify Desktop report friction importing copied links.
- **Inline Spotify Iframe Audio Previews (`open.spotify.com/embed/...`):** Deferred to keep mobile and desktop track tables compact and fast; external `"Open Clean Track"` links cover spot-listening.
- **Cross-Searching YouTube Music Playlists Inside Spotify Mode:** Deferred to avoid confusing users when playlist tracks lack 1-to-1 Spotify catalog matches.
- **LLM Thematic & Innuendo Scanning (AI Music Critic):** Deferred post-validation to preserve $0 per-scan run costs and deterministic latency. CleanPlaylist evaluates deterministic word categories, custom blocklists, and explicit tags rather than LLM-inferred double entendres or thematic essays. (Revisit post-launch if parent feedback highlights unmarked suggestive songs passing regex scans.)

## 8. Success Metrics

*Evaluated during initial test-user rollout and the first 30 days following public community shares using anonymous **Usage Events** (`FR-15`) and qualitative feedback.*

**Primary**
- **SM-1 — Finish-Line Action Completion Rate:** `>= 40%` of sessions firing `scan_completed` or `stitch_completed` subsequently fire at least one `finish_action_clicked` event (`play_clean_queue`, `copy_clean_links`, `open_track_link`, or `file_export`). Validates `FR-1` through `FR-3`, `FR-9` through `FR-13`.
- **SM-2 — Public Zero-Auth Error Rate:** `0%` of non-VIP public sessions encounter an HTTP `401` or `403` Spotify OAuth error during search, scan, replacement, or stitch flows. Validates `FR-1`, `FR-4`, `FR-8`, `FR-10`, `FR-14`.

**Secondary**
- **SM-3 — Spotify Lyric Cross-Reference Match Rate:** `>= 75%` of scanned `spotify` tracks successfully resolve lyrics via **Lyric Cross-Reference** (yielding `Verified Clean` or lyric-backed `Flagged` rather than `Lyrics Unavailable`). Validates `FR-5`, `FR-6`.
- **SM-4 — Bulk Clean Swap Adoption & Qualitative Pull:** `>= 50%` of multi-track scans with `>= 3` flagged tracks use **"Find & Swap All Clean Versions"**, accompanied by repeat organic sessions and constructive feature requests from real parent and teacher testers. Validates `FR-9`, `FR-15`.

**Counter-Metrics (Do Not Optimize)**
- **SM-C1 — Artificial "Verified Clean" Inflation (Never Optimize):** Do *not* loosen **Lyric Cross-Reference** matching thresholds or hide `Lyrics Unavailable` warnings to make `SM-3` or clean-playlist totals look higher. False-clean songs played in front of children destroy parent trust instantly. Counterbalances `SM-1`, `SM-3`.
- **SM-C2 — Raw Track Volume per Session Over Completion Speed (Never Optimize):** Do *not* raise the 50-track cap if doing so increases Vercel timeout failures (`HTTP 504`) or Spotify `HTTP 429` rate-limit errors beyond `2%` of scans. Fast, reliable 5-to-50-song parent sessions beat broken 500-song imports. Counterbalances `SM-1`.

## 9. Open Questions

1. **OQ-1 (Owner: UX — Revisit in `bmad-ux`):** In `Scan & Clean`, should the four zero-login input methods (Song Search, Album Search, **Pasted Track List**, and YouTube Music playlist URL) appear as a unified smart input bar that auto-detects URLs versus search queries (with a button for multi-line paste), or as explicit segmented input pills?
2. **OQ-2 (Owner: Architect — Revisit in `bmad-architecture`):** Should batch `"Find & Swap All Clean Versions"` (`FR-9`) call a new bulk `/api/replacements/find-batch` endpoint or concurrently dispatch chunked requests to `/api/replacements/find` to balance Vercel function duration against Spotify and YouTube Music rate limits?
3. **OQ-3 (Owner: Architect — Revisit in `bmad-architecture`):** Which lightweight zero-cost sink is preferred for viewing **Usage Event** aggregates (`FR-15`) on Vercel Hobby—structured JSON function logs alone, or pairing logs with a free-tier PostHog/Umami dashboard?

## 10. Confirmed Decisions Log (Resolved Assumptions)

*All initial draft assumptions (`A-1` through `A-7`) were reviewed and locked during PRD finalization (`0` unresolved assumptions remain):*

| ID | Locked Decision | Target FR |
| :--- | :--- | :--- |
| **A-1** | Confirming an **Active Platform** switch clears the **Working List** and resets all scan, lyric, and **Verification Status** state. | `FR-2` |
| **A-2** | Direct YouTube Music playlist URL loads in `Scan & Clean` cap at the first 50 tracks with a truncation notice. | `FR-4` |
| **A-3** | **Lyric Cross-Reference** requires normalized title and primary artist similarity plus `±10s` duration tolerance (top song fallback if duration absent). | `FR-5` |
| **A-4** | Lyric scanning dispatches progressive batches of 10 to 15 tracks per `/api/scan` request. | `FR-5` |
| **A-5** | Public **Stitch Studio** enforces a 50-track combined input budget (sequential >50-track **Clean Queue** batching applies to **VIP Mode** merges). | `FR-10`, `FR-11` |
| **A-6** | Client-side **VIP Mode** defaults to `?vip=1` persisted in browser storage across OAuth redirects. | `FR-14` |
| **A-7** | **Usage Events** emit as structured JSON backend logs (plus optional client analytics hook) at $0 cost. | `FR-15` |
