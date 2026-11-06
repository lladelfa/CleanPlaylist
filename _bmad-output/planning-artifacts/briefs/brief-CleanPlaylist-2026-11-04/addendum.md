---
title: "Product Brief Addendum: CleanPlaylist (Public Launch Milestone)"
status: complete
created: "2026-11-04"
updated: "2026-11-04"
---

# Addendum: Technical Context, Trade-Offs, and Parked Ideas

This addendum preserves external platform constraints, verified baseline capabilities, architectural trade-offs, and parked roadmap concepts surfaced during discovery to ground downstream PRD, UX, and architecture work without crowding the core brief.

## 1. 2025–2026 Streaming Platform API Boundaries
- **Spotify User OAuth (`Authorization Code`):** Strictly capped at **five allowlisted users** in Development Mode and requiring an active Spotify Premium subscription on the developer account. Playlist item reads (`GET /v1/playlists/{id}/tracks`) and playlist writes require user OAuth for owned or collaborative playlists—blocking the sixth visitor from reading or writing Spotify playlists via OAuth.
- **Extended Quota Mode Closed to Indies:** Since May 2025, Spotify has required a registered commercial entity and at least 250,000 monthly active users (MAUs) for quota extensions, making consumer OAuth non-viable for a public side-project launch.
- **Spotify Client Credentials (`spotipy.SpotifyClientCredentials`):** Server-to-server catalog flow **not** subject to the five-user allowlist cap (still subject to Development Mode rate limits and owner Premium status). Supports `GET /v1/search` (tracks, albums, artists), `GET /v1/tracks/{id}`, and `GET /v1/albums/{id}`.

## 2. Verified Baseline Capabilities (v1)
- **Stack and Deployment:** React 19, Vite, and Tailwind CSS v4 frontend; Python 3.10+ and FastAPI backend; deployed serverlessly on Vercel with local script execution.
- **YouTube Music (`YTMusicService`):** Unauthenticated `YTMusic()` client supporting playlist fetches, catalog and song searches, explicit badges, full lyrics, clean-version replacement discovery, and playlist stitching. Intentionally read-only (InnerTube OAuth or header authentication previously proved brittle and must not be reintroduced).
- **Spotify (`SpotifyService`):** Currently gates *both* `/api/playlist/fetch` and `/api/spotify/playlist/save` behind per-user `cp_spotify_session` OAuth cookies. Supports explicit metadata flags, clean-track search, and batched 100-URI playlist saves, but returns `None` for `get_track_lyrics`.
- **Scanner (`ScannerService`):** Deterministic boundary-aware regex scanner (`better_profanity`, `WORD_CATEGORIES`, `PRESET_PROFILES`, and custom blocklists) returning categorized word counts and exact lyric line snippets at $0 in marginal API costs.
- **Exports:** CSV, M3U/M3U8, and JSON via `/api/export`.

## 3. Architectural and UX Notes for Downstream Specs
- **Zero-Auth Client Handoff Mechanics:**
  - *Spotify Desktop URL Paste:* While raw `spotify:track:` URI pasting broke in recent clients, copying tracks in Spotify Desktop puts newline-separated `https://open.spotify.com/track/<id>` URLs on the clipboard, and pasting them into an open Spotify Desktop playlist tracklist (`Ctrl+V` or `Cmd+V`) adds them directly. Third-party transfer services with enterprise quota (TuneMyMusic, Soundiiz) also accept pasted URLs or CSV files.
  - *YouTube Instant Queue:* `https://www.youtube.com/watch_videos?video_ids=id1,id2,...` generates an instant, zero-auth playable queue for up to **50 video IDs** per URL (lists exceeding 50 tracks require chunked Part 1 and Part 2 queue buttons).
- **Cross-Platform Lyric Resolution:** When scanning tracks in Spotify mode, backend services should match `(title, artist, duration_seconds)` against YouTube Music search results to fetch lyrics and feed them into `ScannerService`, clearly indicating in the UI whether lyrics were matched or unavailable (falling back to an explicit metadata badge when no lyric match exists).
- **Spotify Rate-Limit Hygiene:** Because Spotify Development Mode applies shared app-wide rate limits on Client Credentials calls, prefer batch lookups (`GET /v1/tracks?ids=...` for up to 50 IDs, `GET /v1/albums/{id}/tracks`) over per-track sequential searches whenever track or album IDs are pasted.
- **Secret VIP Parameter Flow:** Keep Spotify OAuth hidden by default in public UI state. When the configured query parameter (such as `?vip=<token>` or `?mode=spotify-auth`; the exact key and mechanism will be finalized in the architecture specification) is present, expose the Spotify Connect action and unlock direct playlist URL fetching and `/api/spotify/playlist/save` for the five allowlisted accounts.

## 4. Rejected Architectural Alternatives and Trade-Offs
- **Rejected — Bring-Your-Own (BYO) Spotify Developer API Keys:** Parents and teachers want a 60-second answer, not instructions to create a Spotify Developer app, configure redirect URIs, and paste Client Secrets.
- **Preserve Offline Exports Without DJ UX Bloat:** Professional wedding and club DJs remain an explicit non-target for primary UX copy and flows, but M3U8, CSV, and JSON export endpoints are retained so offline crate workflows remain intact.

## 5. Parked Roadmap Candidates (Post-Validation)
- **LLM Thematic and Innuendo Pass:** Catch implied sexual, violent, or substance themes when songs use euphemisms without explicit profanity. Parked for post-launch validation to preserve $0 per-scan running costs and low latency at launch.
- **Shareable "Parent-Approved" List Links:** Lightweight stateless (URL-encoded) or KV-backed shareable pages so a parent can vet an album once and text a playable clean list link to a co-parent or child's device.
