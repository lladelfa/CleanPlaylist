<!-- bmad:context -->
<!-- Verified 2026-11-04 against 235afba. Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## CleanPlaylist

Playlist profanity scanner, clean-track replacer, and playlist stitcher for Spotify and YouTube Music. Python 3.10+ / FastAPI backend (`backend/app/`) and Node 18+ / React 19 + Vite 8 + Tailwind CSS v4 frontend (`frontend/`), served locally via `run.py` or deployed serverlessly on Vercel. BMad planning and sprint artifacts live in `_bmad-output/`; Spotify Web API reference: https://developer.spotify.com/documentation/web-api.

## Policy

- Never commit features or fixes directly to `master`; create and switch to `feature/<short-name>` or `fix/<short-name>` first.
- Follow Red-Green-Refactor TDD on every feature and bugfix: write unit tests for expected behavior and edge cases first, run them to confirm failure, implement minimum passing code, then refactor green.
- Never make live network calls or touch real auth state in unit tests; mock `spotipy.Spotify`, `ytmusicapi.YTMusic`, `cp_spotify_session` request cookies, and browser `global.fetch`.
- Never commit, log, or expose `backend/.env`, `client_secret_*.json`, or legacy local auth files (`backend/oauth.json`, `backend/.spotify_caches/`); document a safe placeholder in `backend/.env.example` whenever adding an environment variable.

## Where things are

- Local launcher: `run.py`; Vercel serverless entrypoint and routing: `api/index.py` and `vercel.json`
- API routes, Pydantic request models, and Spotify OAuth endpoints: `backend/app/main.py` and `backend/app/spotify_endpoints.py`
- Platform clients, profanity scanner, and playlist stitcher: `backend/app/services/` and `backend/app/config.py`
- Frontend root state and feature tabs/modals: `frontend/src/App.jsx` and `frontend/src/components/`

## Running and verifying

- Run backend tests from repo root with `$env:PYTHONPATH="backend"; .\.venv\Scripts\pytest.exe backend/app/tests/` — there is no `pytest.ini`, so bare `pytest` fails to import `app.*`.
- Run frontend checks from repo root with `npm --prefix frontend test` (Vitest + React Testing Library) and `npm --prefix frontend run lint` (`oxlint`; ESLint is not used) — there is no root `package.json`.
- Run `npm --prefix frontend run build` after any edit in `frontend/src/` so `.\.venv\Scripts\python.exe run.py` serves updated `frontend/dist` on `http://127.0.0.1:8000` (set `NO_BROWSER=1` for non-interactive runs).
- Add new runtime Python dependencies to both `requirements.txt` (used by Vercel for `api/index.py`) and `backend/requirements.txt` (used locally); keep test-only packages in `backend/requirements.txt` only.

## Conventions that differ from defaults

- Return matching playlist envelopes and all 10 normalized track keys (`id`, `title`, `artist`, `artists_list`, `album`, `duration`, `duration_seconds`, `is_explicit`, `thumbnail`, `video_url`) from both `SpotifyService` and `YTMusicService`, and keep `TrackScanItem` in `backend/app/main.py` aligned so Pydantic does not strip fields.
- Respect `activePlatform` (`'spotify' | 'ytmusic'`) and `isAuthenticated` across `ScanTab.jsx`, `KeywordsTab.jsx`, `StitchTab.jsx`, and modals, and explicitly include `platform: activePlatform` in `/api/*` request bodies because backend models default `platform` to `"ytmusic"`.
- Treat platform capabilities as asymmetric: Spotify supports OAuth (`cp_spotify_session` cookie) and playlist saves (`/api/spotify/playlist/save`) but has no lyrics (`get_track_lyrics` returns `None`); YouTube Music is unauthenticated read-only (file export only) with full lyrics.
- Call relative `/api/...` URLs in frontend `fetch()` rather than `http://localhost:8000` or `http://127.0.0.1:8000` so Vite's `/api` dev proxy, Vercel rewrites, and same-origin `cp_spotify_session` cookies work identically.
- Style UI with Tailwind CSS v4 (`@import "tailwindcss"` in `frontend/src/index.css`, no `tailwind.config.js`) using Obsidian Audio Core design tokens (`bg-surface-canvas`, `bg-surface-card`, `border-border-subtle`, unified electric violet `brand-primary` `#7C3AED` across both platforms, and safety-reserved emerald `#4EDEA3`/`#10B981` strictly for verified clean/swapped states, never for Spotify chrome) and `lucide-react` icons.
- Dual Spotify client architecture: Isolate `SpotifyClientCredentials(cache_handler=MemoryCacheHandler())` in `SpotifyService.get_catalog_client()` for unauthenticated zero-login search/album/track catalog calls from OAuth user sessions (`get_oauth_client()`).
- Include visible button text or `aria-label` on every interactive element and input (especially icon-only `lucide-react` buttons) so React Testing Library tests can query via `getByRole` and `getByPlaceholderText`.

## Known pitfalls

- On Windows, Vite builds or test runs may fail with `EPERM` on `.vite-temp`; resolve by executing `Remove-Item -Recurse -Force frontend\node_modules\.vite-temp`.
- Use `http://127.0.0.1:8000/api/spotify/callback` for local Spotify OAuth rather than `localhost` — Spotify's Web API rejects `localhost` redirect URIs.
- Guard for `None` items and handle all three Spotify playlist item shapes in `SpotifyService` (`item["track"]`, `item["item"]`, or flat track dict), and chunk Spotify playlist writes in batches of 100 track URIs.
- Do not reintroduce `ytmusicapi` OAuth or browser-header auth files — InnerTube auth repeatedly broke; keep `YTMusicService` unauthenticated (`YTMusic()`) and restrict direct playlist writes to Spotify.

<!-- /bmad:context -->
