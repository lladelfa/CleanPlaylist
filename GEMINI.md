# CleanPlaylist Workspace Rules & Guidelines

## 1. Git Branching Workflow
- **Feature Branches Required**: Always create and switch to a descriptive branch (`feature/<short-name>` or `fix/<short-name>`) before implementing a new feature or bugfix.
- Never commit new features directly to `master`.

## 2. Test-Driven Development (TDD)
- **Red -> Green -> Refactor**: Every new feature or bugfix must include automated unit tests written *before* or alongside the implementation:
  1. Write unit tests defining the expected behavior and edge cases.
  2. Run the test suite to verify the new tests fail as expected (Red).
  3. Implement the minimum production code required to pass the tests (Green).
  4. Refactor while keeping all tests green.
- **Zero Live Network Calls in Tests**:
  - Always mock external clients (`spotipy.Spotify`, `ytmusicapi.YTMusic`, and browser `global.fetch`) in unit tests.
  - Never depend on or mutate real authentication caches (`backend/.spotify_caches/token.json`, `backend/oauth.json`) during test runs.

## 3. Standard Commands & Build Pipeline (Windows / `.venv`)
- **Backend Unit Tests (`pytest`)**:
  ```powershell
  $env:PYTHONPATH="backend"; .\.venv\Scripts\pytest.exe backend/app/tests/
  ```
- **Frontend Unit Tests (`vitest` + React Testing Library)**:
  ```powershell
  npm --prefix frontend test
  ```
- **Frontend Linter (`oxlint`)**:
  ```powershell
  npm --prefix frontend run lint
  ```
- **Frontend Static Build Sync**:
  - `run.py` serves `frontend/dist` as static files via FastAPI on port `8000`.
  - After modifying any files in `frontend/src/`, always run:
    ```powershell
    npm --prefix frontend run build
    ```
    so that running `python run.py` serves the updated UI.

## 4. Architecture & Cross-Platform Parity (`spotify` vs. `ytmusic`)
- **Normalized Data Contracts**: Both `SpotifyService` (`backend/app/services/spotify_service.py`) and `YTMusicService` (`backend/app/services/ytmusic_service.py`) must return normalized playlist and track dictionaries with consistent keys (`id`, `title`, `artist`, `artists_list`, `album`, `duration`, `duration_seconds`, `is_explicit`, `thumbnail`, `video_url`).
- **Platform-Aware Frontend**: Components (`ScanTab.jsx`, `KeywordsTab.jsx`, `StitchTab.jsx`, and modals) must respect `activePlatform` (`'spotify' | 'ytmusic'`) and `isAuthenticated` when rendering platform-specific actions, endpoints, and labels.

## 5. UI, Accessibility & Secrets Hygiene
- **Styling**: Use Tailwind CSS following the existing dark Slate aesthetic (`bg-slate-950` / `bg-slate-900`, `border-slate-800`, `purple-600` primary accents, `green-600` for Spotify-specific actions, and `lucide-react` icons).
- **Accessibility & Testability**: Always include clear button text or `aria-label` attributes on interactive elements and inputs so tests can query via `getByRole` / `getByPlaceholderText`.
- **Secrets Protection**:
  - Never commit, log, or expose `backend/.env`, `backend/oauth.json`, `backend/.spotify_caches/`, or `client_secret_*.json`.
  - Whenever adding a new environment variable, document a safe placeholder in `backend/.env.example`.

