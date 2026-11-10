# Epic 5 Context: VIP Mode Spotify Library Sync & Anonymous Funnel Telemetry

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Allowlisted testers can unlock VIP Mode with `?vip=1` to connect their personal Spotify accounts, browse libraries, and save clean playlists directly, while anonymous, privacy-safe usage events record funnel milestones to verify launch health.

## Stories

- Story 5.1: Query-Parameter VIP Mode Gate, Allowlist Protection, & Safe Exit
- Story 5.2: VIP Spotify Library Browsing (`PlaylistPickerModal`) with Pagination
- Story 5.3: Direct Spotify Playlist Creation & Overwrite (`SavePlaylistModal`)
- Story 5.4: Privacy-Safe Usage Event Telemetry Sink (`POST /api/telemetry/event`)

## Requirements & Constraints

- **FR-14 (Query-Parameter VIP Mode Gate):** All Spotify OAuth login, library browsing, and direct playlist save controls are hidden by default for public visitors. Visiting with `?vip=1` persists VIP Mode in `localStorage["cp_vip_mode"]`, unlocking allowlisted Spotify OAuth login, `PlaylistPickerModal`, direct Spotify playlist URL loading, and `SavePlaylistModal`.
- **Allowlist Protection & Safe Exit:** Spotify OAuth is restricted to the 5-user developer allowlist. If an un-allowlisted user attempts Spotify OAuth, `/api/spotify/callback` catches the `403` from `sp.me()` and redirects to `/?auth_error=allowlist_blocked&platform=spotify`. The frontend renders a rose `role="alert"` `NoticeBanner` explaining Spotify's 5-user developer policy with a 1-click `Exit VIP Mode` button that clears `localStorage["cp_vip_mode"]`, calls `POST /api/spotify/logout`, and strips `?vip=1` / `?auth_error` from URL params.
- **FR-15 (Privacy-Safe Usage Event Recording):** Emits anonymous, zero-PII structured JSON Usage Events once per completed user action (`input_loaded`, `scan_completed`, `clean_swap_applied`, `stitch_completed`, `finish_action_clicked`) capturing viewport class and funnel counts without collecting queries, URLs, titles, blocklist terms, IPs, or tokens.
- **NFR-5 ($0 Marginal Run Cost & Secret Hygiene):** Zero third-party paid LLM or database dependencies. Server-side secrets (`SPOTIFY_CLIENT_SECRET`, `SESSION_SECRET_KEY`) never leak to client bundles; Spotify Client Credentials tokens are cached server-side.

## Technical Decisions

- **AD-1 (Dual-Credential Spotify Split & 3-State Lifecycle):** `SpotifyService` isolates `get_catalog_client()` (Client Credentials) from `get_oauth_client()` (OAuth session cookie `cp_spotify_session`). On boot, `App.jsx` calls `GET /api/spotify/status` (`200 {"authenticated": bool}`); VIP Mode activates if `?vip=1` in URL OR `localStorage["cp_vip_mode"] === "true"` OR `authenticated === true`.
- **AD-4 (Unified Backend API Surface & Route Contracts):** VIP endpoints in `backend/app/spotify_endpoints.py` include `/api/spotify/status`, `/api/spotify/login`, `/api/spotify/callback`, `/api/spotify/logout`, `/api/spotify/playlists`, and `/api/spotify/playlist/save`. `POST /api/telemetry/event` handles anonymous telemetry.
- **AD-7 (Single-Root Session State):** `App.jsx` owns `vipMode` and `isAuthenticated` state, passing them down to `GlobalHeader`, `FinishLineBar`, and workbench tabs/modals.
- **AD-9 (Schema-Locked Telemetry Sink):** `TelemetryService` validates strict `extra="forbid"` Pydantic v2 schemas and emits stdout JSON logs (`cp_telemetry`) with ephemeral `session_anon_id`.

## UX & Interaction Patterns

- **UX-DR3 (GlobalHeader VIP Controls):** Sticky header conditionally displays a subtle `VIP` badge, `Connect Spotify` button (or `Spotify Connected` pill), and `Exit VIP Mode` action when `vipMode` is active.
- **UX-DR14 (NoticeBanner System & VIP OAuth Error Banner):** Rose `role="alert"` alert banner for `auth_error=allowlist_blocked` with clear explanation and 1-click `Exit VIP Mode` button.
- **UX-DR16 (VIP Modals):** `PlaylistPickerModal` (Story 5.2) with pagination and search; `SavePlaylistModal` (Story 5.3) with create new / overwrite options.

## Cross-Story Dependencies

- Story 5.1 establishes the VIP Mode gate, `localStorage` persistence, `GlobalHeader` integration, allowlist 403 handling, and safe exit mechanism required by Story 5.2 (`PlaylistPickerModal`) and Story 5.3 (`SavePlaylistModal`).
- Story 5.3 (`SavePlaylistModal`) has already been implemented and tested; Story 5.1 wires the gate protecting it and other VIP features.
- Story 5.4 adds anonymous telemetry across funnels including VIP mode events.
