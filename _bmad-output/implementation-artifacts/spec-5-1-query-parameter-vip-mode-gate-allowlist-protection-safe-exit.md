---
title: 'Story 5.1: Query-Parameter VIP Mode Gate, Allowlist Protection, & Safe Exit'
type: 'feature'
created: '2026-11-10'
status: 'done'
baseline_commit: '045f5a660789ca3a3872516a3076e6616fe448d9'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '_bmad-output/implementation-artifacts/epic-5-context.md'
  - 'AGENTS.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Public visitors must experience CleanPlaylist as an unauthenticated, zero-login tool without exposed or broken Spotify OAuth login prompts, while allowlisted testers need a secure query parameter (`?vip=1`) or active session to unlock Spotify OAuth and library controls. Furthermore, un-allowlisted Spotify OAuth users who hit Spotify Developer Mode's 5-user quota must receive an informative 403 alert banner with a 1-click safe exit rather than an unhandled error.

**Approach:** Wire a `vipMode` boolean state in `App.jsx` persisted in `localStorage["cp_vip_mode"]` activated via `?vip=1` query param or verified session from `GET /api/spotify/status`. Catch 403 errors on `sp.current_user()` in backend `/api/spotify/callback` to redirect to `/?auth_error=allowlist_blocked&platform=spotify`. Render a rose `role="alert"` `NoticeBanner` explaining Spotify's 5-user developer policy with a 1-click `Exit VIP Mode` button, and conditionally render VIP controls (`VIP` badge, `Connect Spotify` / `Spotify Connected`, and `Exit VIP Mode`) in `GlobalHeader` and `ScanTab`.

## Boundaries & Constraints

**Always:**
- Keep all Spotify login buttons, library-picker triggers, and direct save actions completely hidden when `vipMode` is false.
- Activate `vipMode` when `?vip=1` is present in URL search params, when `localStorage.getItem("cp_vip_mode") === "true"`, or when `GET /api/spotify/status` returns `authenticated: true`.
- Persist `vipMode` in `localStorage["cp_vip_mode"] = "true"` whenever activated.
- In `backend/app/spotify_endpoints.py`, after exchanging the authorization code, call `sp.current_user()` to verify the token; if Spotify returns HTTP 403 (Spotify Developer Mode allowlist restriction), redirect to `/?auth_error=allowlist_blocked&platform=spotify`.
- Render a rose `role="alert"` `NoticeBanner` when `auth_error=allowlist_blocked` explaining Spotify's 5-user developer allowlist policy with an `actionLabel="Exit VIP Mode"`.
- Clicking `Exit VIP Mode` must clear `localStorage["cp_vip_mode"]`, call `POST /api/spotify/logout`, set `vipMode = false` and `isAuthenticated = false`, clear auth error state, and strip `?vip=1`, `?auth_error`, and `?auth_success` from the URL using `window.history.replaceState`.
- Ensure all interactive buttons and badges have visible text or explicit `aria-label` attributes with 44px minimum touch targets on mobile.

**Never:**
- Never commit directly to `master`; develop on `feature/5-1-vip-mode-gate`.
- Never expose Spotify client secrets in frontend code or client responses.
- Never make live Spotify API calls in unit tests; mock Spotipy client and browser `global.fetch`.
- Never show Spotify OAuth login buttons to public visitors without `vipMode`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Public visitor (no VIP) | URL has no `?vip=1`, `localStorage["cp_vip_mode"]` is unset, `/api/spotify/status` returns `authenticated: false` | `vipMode` is `false`. `GlobalHeader` shows no VIP badge, login button, or exit action. `ScanTab` renders no "Login to Save" or library triggers. | N/A |
| URL `?vip=1` activation | Visitor arrives with `/?vip=1` | `vipMode` is set to `true` and saved to `localStorage["cp_vip_mode"]`. `GlobalHeader` renders `VIP` badge, `Connect Spotify` button (if unauthenticated), and `Exit VIP Mode` action. | Invalid query param values (e.g. `?vip=0`) do not activate VIP. |
| Existing session activation | `localStorage["cp_vip_mode"] === "true"` or `/api/spotify/status` returns `authenticated: true` | `vipMode` activates automatically on boot. If authenticated, header shows `Spotify Connected` pill and `Exit VIP Mode`. | Network failure on status endpoint defaults gracefully to unauthenticated without crashing. |
| Non-allowlisted user OAuth callback | Spotify redirects to `/api/spotify/callback?code=valid_code` but user is not on developer allowlist; `sp.current_user()` raises 403 | Backend catches 403 and redirects to `/?auth_error=allowlist_blocked&platform=spotify`. Frontend renders rose `role="alert"` NoticeBanner explaining developer policy. | User can dismiss or click "Exit VIP Mode". |
| Exit VIP Mode clicked | User clicks `Exit VIP Mode` from header or alert banner | `localStorage.removeItem("cp_vip_mode")`, `POST /api/spotify/logout` called, `vipMode` and `isAuthenticated` set to `false`, URL query stripped via `replaceState`. UI reverts to public zero-login state. | Logout network error handled gracefully; local VIP state clears regardless. |

</frozen-after-approval>

## Code Map

- `backend/app/spotify_endpoints.py` -- Verify user on allowlist via `sp.current_user()` after code exchange; catch 403 `SpotifyException` and redirect to `/?auth_error=allowlist_blocked&platform=spotify`; ensure `/api/spotify/logout` properly clears cookie.
- `backend/app/tests/test_spotify_endpoints.py` -- Unit tests for `/api/spotify/callback` handling allowlist 403 redirect and normal success redirect.
- `frontend/src/App.jsx` -- Single-root session state owning `vipMode`, `isAuthenticated`, and `authError`; boot URL search param parsing for `vip=1` and `auth_error`; `localStorage` synchronization; `handleExitVip` implementation; passing `vipMode` to `GlobalHeader`, `ScanTab`, and `StitchTab`; rendering allowlist error `NoticeBanner`.
- `frontend/src/components/GlobalHeader.jsx` -- Renders conditional VIP controls: `VIP` badge, `Connect Spotify` button (when `!isAuthenticated`), `Spotify Connected` pill (when `isAuthenticated`), and `Exit VIP Mode` button (with `aria-label="Exit VIP Mode"`).
- `frontend/src/components/ScanTab.jsx` -- Guards "Login to Save" button and library picker trigger behind `vipMode`.
- `frontend/src/components/__tests__/GlobalHeader.test.jsx` -- Tests for `GlobalHeader` rendering and omitting VIP controls based on `vipMode` and `isAuthenticated`.
- `frontend/src/components/__tests__/VipModeGate.test.jsx` -- Comprehensive integration unit tests for VIP mode query param activation, allowlist 403 alert banner, and safe exit workflow.

## Tasks & Acceptance

**Execution:**
- [x] `backend/app/spotify_endpoints.py` -- Add `sp.current_user()` allowlist verification in `/api/spotify/callback`, catching 403 exceptions and redirecting to `/?auth_error=allowlist_blocked&platform=spotify` -- Prevents 500 error and informs user of developer allowlist policy.
- [x] `backend/app/tests/test_spotify_endpoints.py` -- Add unit test verifying that when `sp.current_user()` raises a 403 `SpotifyException`, the callback redirects with `auth_error=allowlist_blocked` -- Guarantees backend allowlist guard contract.
- [x] `frontend/src/components/GlobalHeader.jsx` -- Add `vipMode`, `isAuthenticated`, `onLogin`, and `onExitVip` props; render `VIP` badge, `Connect Spotify` button / `Spotify Connected` pill, and `Exit VIP Mode` button when `vipMode` is true -- Provides accessible VIP UI controls per UX-DR3.
- [x] `frontend/src/components/ScanTab.jsx` -- Pass and respect `vipMode` so that "Login to Save" and library picker triggers are only visible when `vipMode` is true -- Enforces zero-login public UI isolation per FR-14.
- [x] `frontend/src/App.jsx` -- Implement `vipMode` state, `localStorage["cp_vip_mode"]` persistence, boot URL parameter detection (`?vip=1` and `?auth_error`), `handleExitVip` clearing storage and calling `/api/spotify/logout`, and rose `role="alert"` `NoticeBanner` for `auth_error=allowlist_blocked` -- Connects end-to-end VIP gate and safe exit flow.
- [x] `frontend/src/components/__tests__/GlobalHeader.test.jsx` -- Update tests to verify VIP controls appear when `vipMode={true}` and are hidden when `vipMode={false}` -- Tests header contract.
- [x] `frontend/src/components/__tests__/VipModeGate.test.jsx` -- Create comprehensive unit test suite covering public visitor isolation, `?vip=1` activation, `auth_error=allowlist_blocked` alert banner, and `Exit VIP Mode` clean reset -- Verifies Story 5.1 acceptance criteria.

**Acceptance Criteria:**
- Given a public visitor without `?vip=1` in the URL and no active session cookie, when viewing CleanPlaylist, then no Spotify login buttons, library-picker triggers, or direct save actions are rendered anywhere in the UI.
- Given a visitor arriving with `/?vip=1` (or holding an active `cp_spotify_session` verified via boot `/api/spotify/status`), when the app loads, then `vipMode` is set to `true` and persisted in `localStorage["cp_vip_mode"]`, and `GlobalHeader` reveals a `VIP` badge, `Connect Spotify` button (or `Spotify Connected` pill), and an `Exit VIP Mode` action.
- Given an unauthorized user attempting Spotify OAuth who is not on the 5-user developer allowlist, when Spotify redirects back to `/api/spotify/callback`, then `sp.current_user()` catches the `403` error and redirects to `/?auth_error=allowlist_blocked&platform=spotify`, and the UI renders a rose `role="alert"` `NoticeBanner` explaining Spotify's 5-user developer policy with a 1-click `Exit VIP Mode` button.
- Given the `Exit VIP Mode` button clicked, when executed, then it clears `localStorage["cp_vip_mode"]`, calls `POST /api/spotify/logout`, resets state, and strips `?vip=1` / `?auth_error` from URL state.

## Implementation Notes

## Spec Change Log

## Review Triage Log

| Finding | Verdict | Evidence / Routing |
|---------|---------|--------------------|
| Non-403 OAuth error redirect formats unescaped `str(se)` into URL `Location` header | `medium` | `backend/app/spotify_endpoints.py`: `str(SpotifyException)` contains newlines and unencoded characters, risking Starlette header `ValueError`. Route: `patch`. |
| `App.jsx` `vipMode` initializer throws and fails to activate if `localStorage.setItem` fails in private mode | `medium` | `frontend/src/App.jsx:82-89`: Writing to `localStorage` inside `useState` initializer causes `vipMode` to evaluate to `false` if `setItem` throws. Move side-effect to `useEffect` and isolate storage access. Route: `patch`. |
| Dismissing `NoticeBanner` wipes entire URL search string including `?vip=1` | `medium` | `frontend/src/App.jsx:187,202`: `replaceState` wipes entire pathname instead of deleting only `auth_error`. Route: `patch`. |
| `GlobalHeader` default props missing for `onLogin` and `onExitVip` | `low` | `frontend/src/components/GlobalHeader.jsx`: If rendered without callbacks, clicking would attempt to call undefined. Add default no-op callbacks. Route: `patch`. |
| Lingering session cookie not cleared on callback error redirect | `low` | `backend/app/spotify_endpoints.py`: Error redirect should call `spotify_service.clear_session_cookie(redirect_resp)` so stale cookies don't persist. Route: `patch`. |
| Broad `"403" in str(e)` catch in callback | `low` | `backend/app/spotify_endpoints.py`: Replace with structured check `getattr(e, 'http_status', None) == 403 or getattr(getattr(e, 'response', None), 'status_code', None) == 403`. Route: `patch`. |
| `VipModeGate.test.jsx` queries `/my playlists/i` instead of `/browse library/i` | `low` | `frontend/src/components/__tests__/VipModeGate.test.jsx:90`: Button in `SmartInputBar` is named `Browse Library`, so `/my playlists/i` passed vacuously. Route: `patch`. |
| Missing test coverage for `/?auth_success=true` in `VipModeGate.test.jsx` | `low` | `frontend/src/components/__tests__/VipModeGate.test.jsx`: Add test asserting `?auth_success=true` sets `vipMode`, `isAuthenticated`, persists localStorage, and strips URL. Route: `patch`. |
| Missing test coverage for generic `auth_error` banner in `VipModeGate.test.jsx` | `low` | `frontend/src/components/__tests__/VipModeGate.test.jsx`: Add test asserting generic auth error banner renders and dismisses cleanly. Route: `patch`. |
| Missing test coverage for non-403 callback error redirect in `test_spotify_endpoints.py` | `low` | `backend/app/tests/test_spotify_endpoints.py`: Add unit test for non-403 `SpotifyException` verifying URL quoting and cookie clearing. Route: `patch`. |
| GlobalHeader VIP controls shown on YouTube Music tab | `false` | Spec UX-DR3 deliberately unifies VIP status in GlobalHeader across all tabs. |

## Design Notes

VIP Mode badge and buttons use Obsidian Audio Core design tokens:
- VIP Badge: compact `bg-brand-primary/20 text-brand-tint border border-brand-primary/40 text-xs px-2 py-0.5 rounded-full font-mono font-semibold`
- Connect Spotify Button: `bg-surface-elevated hover:bg-surface-highest text-text-primary border border-border-subtle text-xs px-3 py-1.5 rounded-lg font-medium`
- Spotify Connected Pill: `bg-surface-elevated text-text-secondary border border-border-subtle text-xs px-2.5 py-1 rounded-lg flex items-center gap-1.5`
- Exit VIP Mode Action: `text-text-muted hover:text-text-primary text-xs px-2.5 py-1 rounded-lg border border-transparent hover:border-border-subtle transition`
- Allowlist Blocked Banner: `NoticeBanner type="error"` with `role="alert"`, message explaining Spotify Developer Mode 5-user allowlist, and `actionLabel="Exit VIP Mode"`.

## Verification

**Commands:**
- `$env:PYTHONPATH="backend"; .\.venv\Scripts\pytest.exe backend/app/tests/` -- expected: All backend tests pass including test_spotify_endpoints.py.
- `npm --prefix frontend test` -- expected: All frontend tests pass including GlobalHeader.test.jsx and VipModeGate.test.jsx.
- `npm --prefix frontend run lint` -- expected: Oxlint passes with 0 errors.
- `npm --prefix frontend run build` -- expected: Vite production build succeeds cleanly.
