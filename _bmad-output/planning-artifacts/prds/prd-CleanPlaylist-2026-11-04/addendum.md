---
title: "PRD Addendum: CleanPlaylist (Public Launch Milestone)"
status: final
created: "2026-11-04"
updated: "2026-11-05"
---

# PRD Addendum: Technical Mechanisms, Baseline Inventory, and Deferred Detail

This addendum preserves upstream artifact links (the finalized Product Brief and Product Brief Addendum in `_bmad-output/planning-artifacts/briefs/brief-CleanPlaylist-2026-11-04/`), brownfield v1 code inventory, technical implementation mechanisms, and deferred integration thresholds to ground downstream UX and architecture specifications without overloading `prd.md`.

## 1. Extracted v1 Codebase Surface (Brownfield Baseline)

- **Frontend Tabs and Modals (`frontend/src/`):**
  - `ScanTab.jsx` (**Scan & Clean**): Loads a single playlist URL at a time (overwriting `scannedTracks` on each load) and supports manual per-track **Find Clean Edit** → **Swap to Clean** workflows or trash-icon removal (v1 has no bulk swap button).
  - `KeywordsTab.jsx` (**Keyword Search**): Consumes `scannedTracks` from `ScanTab` (lacks an independent URL or search input) and scans the lyrics of up to 15, 25, or 50 tracks for custom target keyword chips.
  - `StitchTab.jsx` (**Stitch Playlists**): Merges multiple playlists and supports automated batch `clean_mode` options (`replace_clean_or_drop`, `replace_clean_or_keep`, `exclude_flagged`, `keep_all`).
  - Modals: `LyricsModal` (displays highlighted flagged lyric tokens), `PlaylistPickerModal` (browses Spotify OAuth user libraries), and `SavePlaylistModal` (creates or updates playlists via Spotify OAuth).
- **Backend Services and Schemas (`backend/app/`):**
  - A normalized 10-key track envelope is required across `SpotifyService`, `YTMusicService`, and `TrackScanItem` (`id`, `title`, `artist`, `artists_list`, `album`, `duration`, `duration_seconds`, `is_explicit`, `thumbnail`, `video_url`).
  - `ScannerService` (`backend/app/config.py`): Defines preset IDs (`kid_safe`, `moderate`, `slurs_only`, `custom`) and word categories (`slurs`, `strong_profanity`, `mild_profanity`, `sexual`, `substances`).

## 2. Technical Transport and API Mechanism Notes for Architecture

### 2.1 Spotify Client Credentials Architecture (`FR-1`, `FR-4`)
- Uses existing `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` server-side environment variables without requiring user OAuth cookies (`cp_spotify_session`).
- Operational prerequisite: The app owner's Spotify Developer account must maintain an active Spotify Premium subscription for both Client Credentials catalog calls and `VIP Mode` (Spotify Development Mode OAuth) to function.
- Bypasses the five-user Development Mode allowlist cap for catalog endpoints (`GET /v1/search` for `track` and `album`, `GET /v1/tracks?ids=...` up to 50 IDs, and `GET /v1/albums/{id}/tracks`).
- Does not permit `GET /v1/playlists/{id}/tracks`. Consequently, CleanPlaylist must intercept Spotify playlist URLs on the client when `VIP Mode` or Spotify OAuth is inactive (`FR-4`).

### 2.2 Track Envelope Extension and Universal Clean Queue (`FR-7`, `FR-11`)
- Constructs queues using `https://www.youtube.com/watch_videos?video_ids=id1,id2,...` (subject to YouTube's limit of 50 comma-separated video IDs per URL).
- When `activePlatform === 'spotify'`, `Lyric Cross-Reference` already queries `ytmusicapi` for the matching track. Caching the matched YouTube `videoId` (and resolving a clean YouTube `videoId` for `Clean Swapped` tracks) enables `Clean Queue` generation in Spotify mode at no additional cost.
- To power `Clean Queue` (`FR-11`) and `LyricsModal` (`FR-7`), Architecture must add optional `ytmusic_video_id` and `verification_status` fields across both service outputs and `TrackScanItem`.

### 2.3 Spotify Desktop Clipboard Paste Mechanics (`FR-3`, `FR-12`)
- Copying tracks inside Spotify Desktop places newline-separated `https://open.spotify.com/track/<id>` URLs onto the operating system clipboard (`FR-3` input).
- Conversely, copying newline-separated `https://open.spotify.com/track/<id>` URLs (without trailing spaces) from CleanPlaylist and pressing `Ctrl+V` or `Cmd+V` inside an open Spotify Desktop playlist body adds all tracks directly (`FR-12`), which Spotify then syncs to the user's mobile app.

### 2.4 VIP Mode Security Trade-Off (`FR-14`)
- Explicitly confirmed with the product owner: Exposing the `?vip=1` parameter name in open-source frontend code is acceptable because Spotify's Developer Dashboard strictly enforces the five-user OAuth allowlist server-side. The gate's purpose is UX isolation (preventing public visitors from clicking a dead-end login button), not cryptographic secrecy.

### 2.5 Telemetry Implementation Hint (`FR-15`, `OQ-3`)
- Vercel Hobby plans include free basic pageview Web Analytics, whereas custom client `track()` events typically require Vercel Pro. Emitting structured JSON `Usage Event` lines from FastAPI endpoints (or wiring a free-tier, privacy-safe analytics endpoint) ensures Zo receives actionable test-user counts at no cost.

## 3. Deferred Third-Party Integration Thresholds (Reference for Post-MVP)

*Rationale for all deferred scope items appears in `prd.md` §7.2; external platform limits discovered during research are preserved here for future reference:*
- **Soundiiz and TuneMyMusic Free Limits:** The Soundiiz free tier imports up to 200 tracks per playlist (unlimited playlists), whereas the TuneMyMusic free tier is capped at 500 lifetime tracks.
- **Spotify Iframe Embed Playback (`open.spotify.com/embed/track/...`):** Plays 30-second previews when logged out, or full tracks when logged into `open.spotify.com` in the browser (subject to third-party cookie restrictions).
