# Review: Reality-Check Lens
**Document:** `ARCHITECTURE-SPINE.md` (CleanPlaylist Public Launch Milestone)  
**Reviewer:** Reality-Check Reviewer (Gate Subagent)  
**Date:** 2026-11-06  
**Verdict:** PASS WITH ACTION ITEMS

---

## 1. Executive Summary

A comprehensive reality check was conducted across all 10 Architectural Decisions (`AD-1` through `AD-10`), the Technology Stack table, and the active codebase (`backend/`, `frontend/`, lockfiles, Python `.venv`, and npm runtime). Every external assertion was evaluated against live web documentation, official provider documentation (Spotify Web API, YouTube Music / `ytmusicapi`, Vercel Serverless), and actual local CLI executions.

The spine exhibits high technical realism:
- Spotify's February 2026 sandbox restrictions on Development Mode apps (removal of plural `/v1/tracks` and `/v1/albums`, search cap `<= 10`, 5-user allowlist, active Spotify Premium account requirement) were accurately anticipated and mitigated in `AD-2` and `AD-10`.
- The 50-track public quota and Clean Queue URL format (`https://www.youtube.com/watch_videos?video_ids=...`) were confirmed to match YouTube's hard 50-video ceiling.
- Vercel's Python 3.13 support via `.python-version` and function timeout configurations (`maxDuration: 60`) are completely supported on Vercel Hobby.

Three operational and library-level divergences require minor alignment in the spine and foundation stories.

---

## 2. Technology & Assumption Verification Matrix

| Technology / Assertion | Spine Claim | Live / Web Reality | Verdict |
| :--- | :--- | :--- | :--- |
| **Spotify Dev Mode Quotas** (`AD-2`) | Feb-2026 update removed plural `/v1/tracks`, `/v1/albums`; caps `/v1/search` limit `<= 10`. | Confirmed via Spotify Developer Documentation: Feb 2026 update locked Development Mode apps to singular lookups, 5 allowlisted users, and search limits of 10. | **VERIFIED** |
| **Spotify Account Prerequisite** (`AD-10`) | App owner developer account requires active Spotify Premium. | Confirmed: Spotify Dev Mode apps deactivate if the developer account's Premium subscription lapses. | **VERIFIED** |
| **Spotify Playlist Create Endpoint** (`AD-4`, `AD-1`) | `/api/spotify/playlist/save` creates playlists via Spotify API. | Spotify officially deprecated and removed `POST /users/{user_id}/playlists`. `sp.user_playlist_create(...)` in Spotipy 2.26.0 triggers `DeprecationWarning` and targets the dead route. Must use `sp.current_user_playlist_create(...)` (`POST /v1/me/playlists`). | **ACTION REQUIRED** |
| **Clean Queue Ceiling** (`AD-7`, `AD-11`) | `youtube.com/watch_videos?video_ids=<up-to-50-ids>` | Confirmed: YouTube's temporary playlist generator enforces a strict 50-video hard limit; excess IDs are dropped. AD-7's 50-track quota and VIP chunked queues (`1-50`, `51-N`) are exact fits. | **VERIFIED** |
| **ytmusicapi Methods & Slicing** (`AD-4`, `AD-5`) | `ytmusic.get_playlist(limit=...)` requires explicit `tracks[:limit]` slice; `get_watch_playlist(videoId)` returns metadata + lyrics. | Confirmed via `ytmusicapi 1.12.3` source inspection: `get_playlist`'s limit only bounds continuations, not exact returned count; `get_watch_playlist` returns both track details and `lyrics_browse_id`. | **VERIFIED** |
| **Profanity Scanning Dependency** (`AD-4`, Stack) | `better-profanity >=0.7.0` in Stack table, but `profanity.load_censor_words()` is removed in AD-4. | Confirmed: `better-profanity` is imported and loads words, but `scanner_service.py` never uses it for scanning (uses pure compiled regex over `WORD_CATEGORIES` and custom blocklists). It is dead weight. | **ACTION REQUIRED** |
| **Vercel Python 3.13 & Timeout** (`AD-10`) | Root `.python-version` pins `3.13`; `vercel.json` sets `maxDuration: 60`. | Confirmed: Vercel natively supports Python 3.13 via `.python-version`. Vercel Hobby Fluid Compute allows up to 300s timeout, so `60` is valid and supported. | **VERIFIED** |
| **Pydantic v2 Discriminated Union** (`AD-9`) | `extra="forbid"` on polymorphic `UsageEventPayload`. | Verified via live Python execution with Pydantic 2.13.5: discriminated unions with `extra="forbid"` validate correctly and reject unexpected fields. | **VERIFIED** |
| **Test & Build Tooling** (`AD-10`, `AGENTS.md`) | Pytest suite and Vitest suite pass locally. | Backend pytest passes (11 tests, pytest 9.1.1). However, Vitest 4.1.12 and Vite build fail on Windows with `EPERM` due to Read-Only attribute on `frontend/node_modules/.vite-temp`. | **ACTION REQUIRED** |

---

## 3. Detailed Findings & Action Items

### Finding 1 (High): Spotify Playlist Creation Must Target `current_user_playlist_create`
- **Location:** `ARCHITECTURE-SPINE.md` lines 125 (`AD-4`) and `spotify_endpoints.py`.
- **Reality:** Spotipy's `sp.user_playlist_create(user=user_id, ...)` issues:
  ```text
  DeprecationWarning: You're using `user_playlist_create(...)`, which is marked as deprecated by Spotify. Use `current_user_playlist_create(...)` instead.
  ```
  In Spotify's Feb 2026 Web API, `POST /users/{user_id}/playlists` was completely stripped for Development Mode apps, causing `403 Forbidden` / `404 Not Found`.
- **Fix:** In `AD-4` and implementation code, specify that Spotify playlist creation must use `sp.current_user_playlist_create(name=req.playlist_title, public=req.is_public, description=...)`.

### Finding 2 (Medium): Prune Dead Dependency `better-profanity`
- **Location:** `ARCHITECTURE-SPINE.md` Stack Table (line 198), `requirements.txt`, and `backend/requirements.txt`.
- **Reality:** While `better-profanity` was originally imported, `ScannerService` implements its own regex compilation over `app.config.WORD_CATEGORIES` and custom blocklists. AD-4 already mandates stripping the cold-start `profanity.load_censor_words()` call. Once stripped, `better-profanity` is completely unused.
- **Fix:** Remove `better-profanity` from `requirements.txt`, `backend/requirements.txt`, and the Stack table.

### Finding 3 (Medium): Document Windows `node_modules/.vite-temp` EPERM Workaround
- **Location:** `ARCHITECTURE-SPINE.md` §Repo Hygiene (`AD-10`) & `AGENTS.md` Known Pitfalls.
- **Reality:** On Windows environments with Node.js v25.1.0, `npm --prefix frontend test` and `npm --prefix frontend run build` fail with:
  ```text
  Error: EPERM: operation not permitted, open 'frontend\node_modules\.vite-temp\vite.config.js.timestamp-....mjs'
  ```
  `Get-Item frontend\node_modules\.vite-temp` reveals `Mode: d-r--` (Read-Only). Removing the directory or clearing attributes allows Vite/Vitest to execute.
- **Fix:** Add a note under `AGENTS.md` Known Pitfalls instructing Windows developers/agents to run `Remove-Item -Recurse -Force frontend\node_modules\.vite-temp` if Vite/Vitest hits `EPERM`.

### Finding 4 (Low): Sync `pytest` and `pytest-asyncio` Versions in Stack Table
- **Location:** `ARCHITECTURE-SPINE.md` Stack Table (line 201) and `backend/requirements.txt`.
- **Reality:** `backend/requirements.txt` specifies `pytest==8.0.2`, while local `.venv` runs `pytest 9.1.1`. Additionally, `pytest-asyncio==0.23.5` is listed in requirements but not installed in `.venv`, and none of the test suites currently require async fixtures.
- **Fix:** Change `pytest==8.0.2` in `backend/requirements.txt` to `pytest>=8.0.2` (matching the Stack table notation) and confirm whether `pytest-asyncio` is needed for future stories or can be pruned.
