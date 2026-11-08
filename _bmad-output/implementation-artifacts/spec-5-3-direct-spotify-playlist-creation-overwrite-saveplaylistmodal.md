---
title: 'Story 5.3: Direct Spotify Playlist Creation & Overwrite (SavePlaylistModal)'
type: 'feature'
created: '2026-11-08'
status: 'review'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Users saving a clean playlist to their Spotify library encounter a 403 Forbidden error (`https://api.spotify.com/v1/users/{user_id}/playlists: Forbidden`) because the backend invokes the deprecated `sp.user_playlist_create(...)` endpoint rather than Spotify's current `sp.current_user_playlist_create(...)` (`POST /v1/me/playlists`). Furthermore, `SavePlaylistModal` lacks custom title editing, a public/private toggle, and silently attempts an unintended duplicate playlist creation fallback if playlist overwrite fails.

**Approach:** 
1. Backend: Update `backend/app/spotify_endpoints.py` to use `sp.current_user_playlist_create(name=req.playlist_title, public=req.is_public, description="Clean version created by CleanPlaylist")`, extend `SpotifySaveRequest` with `is_public: bool = False` and `original_playlist_id: Optional[str] = None`, chunk track additions in batches of 100, and remove silent fallback to raise clean HTTP 500 errors on overwrite failure.
2. Frontend: Modernize `SavePlaylistModal.jsx` with Obsidian Audio Core tokens (`bg-surface-card`, `border-border-subtle`, `brand-primary`), an editable playlist title input with default `<Title> (Clean)`, a "Private Playlist" toggle (default: True), verified clean track count badge, destructive warning on "Update Original Playlist", and rigorous `aria-label` attributes for accessibility.
3. Tests: Author unit tests in `backend/app/tests/test_spotify_save.py` and `frontend/src/components/__tests__/SavePlaylistModal.test.jsx` adhering strictly to Red-Green-Refactor TDD.

## Boundaries & Constraints

**Always:**
- Call `sp.current_user_playlist_create` (`POST /v1/me/playlists`) instead of `sp.user_playlist_create` (`POST /v1/users/{user_id}/playlists`).
- Batch track additions to Spotify in chunks of 100 URIs (`sp.playlist_add_items(pl_id, uris[i:i+100])`).
- Raise an explicit HTTP 500 error if updating an existing playlist fails rather than silently creating an unintended duplicate playlist.
- Align `SpotifySaveRequest` in `spotify_endpoints.py` to support `is_public: bool = False` and `original_playlist_id: Optional[str] = None`.
- Style `SavePlaylistModal` using Obsidian Audio Core design tokens (`bg-surface-card`, `bg-surface-backdrop/80`, `border-border-subtle`, `text-text-primary`, `text-text-muted`, `bg-brand-primary`, safety-reserved emerald `#4EDEA3` strictly for the success badge).
- Include visible button text or explicit `aria-label` attributes on every interactive element in `SavePlaylistModal`.
- Write unit tests first (Red phase) mocking `spotipy.Spotify` and `global.fetch`, verify failure, then implement minimum passing code (Green phase).

**Never:**
- Never call live Spotify APIs or use real credentials in tests; always mock `spotify_service.get_client`.
- Never commit directly to `master`; use a feature or fix branch (e.g. `fix/spotify-playlist-save-endpoint`).
- Never silently fall back to creating a new playlist when updating an existing playlist fails.
- Never strip track IDs when formatting `spotify:track:{tid}` URIs.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Create New Clean Playlist (Default) | `create_new: True`, `playlist_title: "My List (Clean)"`, `is_public: False`, 150 track IDs | Calls `sp.current_user_playlist_create(name="My List (Clean)", public=False)`, then two calls to `sp.playlist_add_items` (100 tracks, then 50 tracks). Returns 200 with new `playlist_id`. | If Spotify API throws, catch and raise HTTPException(status_code=500, detail=str(e)). |
| Update Original Playlist | `create_new: False`, `original_playlist_id: "pl123"`, 120 track IDs | Calls `sp.playlist_replace_items("pl123", uris[:100])`, then `sp.playlist_add_items("pl123", uris[100:120])`. Returns 200 with `playlist_id`. | If replace fails, raises HTTP 500 with error detail; DOES NOT create fallback playlist. |
| Update Without Original Playlist ID | `create_new: False`, `original_playlist_id: null` | Backend raises HTTP 400 Bad Request ("original_playlist_id required when create_new is False"). | Returns 400 with descriptive detail. |
| Empty Track List Save | `final_track_ids: []`, `create_new: True` | Creates empty playlist via `current_user_playlist_create`, skips `playlist_add_items`, returns 200. | Safe no-op on item addition. |
| UI Custom Title & Privacy Toggle | User edits title in modal, toggles "Private Playlist" off (`is_public = true`) | Modal sends updated `playlist_title` and `is_public: true` in payload. | Form validation prevents blank title. |
| Overwrite Disabled When Not Allowed | Playlist has `canOverwrite === false` or unowned | Radio card for "Update Original Playlist" is disabled with tooltip/hint "(Only works if you own the playlist)". | Prevents user submission of invalid update. |

</frozen-after-approval>

## Code Map

- `backend/app/spotify_endpoints.py` -- Update `SpotifySaveRequest` (`is_public: bool = False`, `original_playlist_id: Optional[str] = None`) and `save_playlist` endpoint to use `sp.current_user_playlist_create(...)`, chunk additions, and eliminate silent fallback duplicate creation.
- `backend/app/tests/test_spotify_save.py` -- Author unit tests for `POST /api/spotify/playlist/save` covering create new, overwrite, chunking >100 tracks, empty tracks, missing original playlist ID, and error handling.
- `frontend/src/components/SavePlaylistModal.jsx` -- Refactor modal with Obsidian Audio Core tokens, editable title input for new playlist, private playlist toggle, track count badge, accessible radio cards, and error alert.
- `frontend/src/components/__tests__/SavePlaylistModal.test.jsx` -- Author unit tests for `SavePlaylistModal` covering rendering, title editing, toggle changes, successful save callback, and error message rendering.

## Tasks & Acceptance

**Execution:**
- [x] Create and checkout branch `fix/spotify-playlist-save-endpoint`.
- [x] Write backend unit tests in `backend/app/tests/test_spotify_save.py` mocking `spotipy.Spotify` and confirming test failures (Red phase).
- [x] Update `backend/app/spotify_endpoints.py` to use `sp.current_user_playlist_create`, support `is_public`, chunk additions, and raise on overwrite error (Green phase).
- [x] Run backend tests to verify 100% pass: `$env:PYTHONPATH="backend"; .\.venv\Scripts\pytest.exe backend/app/tests/`.
- [x] Write frontend unit tests in `frontend/src/components/__tests__/SavePlaylistModal.test.jsx` testing `SavePlaylistModal` interactions and fetch calls (Red phase).
- [x] Update `frontend/src/components/SavePlaylistModal.jsx` with Obsidian tokens, editable title, private toggle, and error handling (Green phase).
- [x] Run frontend checks: `npm --prefix frontend test` and `npm --prefix frontend run lint`.
- [x] Build frontend: `npm --prefix frontend run build`.

**Acceptance Criteria:**
- Given an authenticated Spotify session in CleanPlaylist, when the user chooses `Create New Clean Playlist`, then the request payload includes `create_new: true`, `playlist_title`, `is_public`, and `final_track_ids`, and the backend invokes `sp.current_user_playlist_create(name=req.playlist_title, public=req.is_public)` without calling deprecated `user_playlist_create`.
- Given a track list of over 100 tracks, when saved as a new playlist, then tracks are added to Spotify in batches of 100 using `sp.playlist_add_items`.
- Given an existing playlist update where the user does not own the playlist or Spotify rejects the overwrite, then the backend raises an HTTP 500 error and the UI displays the error message without creating an unwanted duplicate playlist.
- Given the `SavePlaylistModal` open, all buttons and interactive controls have accessible labels and adhere to the Obsidian Audio Core design palette.
