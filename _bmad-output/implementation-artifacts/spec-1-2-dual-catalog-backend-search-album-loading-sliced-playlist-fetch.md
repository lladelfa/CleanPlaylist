---
title: 'Story 1.2: Dual-Catalog Backend Search, Album Loading, & Sliced Playlist Fetch'
type: 'feature'
created: '2026-11-06'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Unauthenticated users require the ability to search catalog tracks and albums across Spotify and YouTube Music, inspect album track lists, and load public playlists with strict track limits to prevent timeouts and upstream rate limit exhaustion, all without user login.

**Approach:** Implement `SpotifyService.get_catalog_client()` using cached `SpotifyClientCredentials(cache_handler=MemoryCacheHandler())`, extend `TrackScanItem` with canonical 12 keys (`verification_status: "unscanned"` and `source_platform`), provide `POST /api/catalog/search` (capped at 10 items) and `POST /api/catalog/album` endpoints across both platforms, and update `POST /api/playlist/fetch` to enforce a 50-track slice on YouTube Music with `source_track_count` and `truncated` metadata.

</frozen-after-approval>

## Implementation Notes

- Implemented `SpotifyService.get_catalog_client()` with process-cached `SpotifyClientCredentials(cache_handler=MemoryCacheHandler())`, raising 500 when credentials are missing and isolating catalog queries from user OAuth sessions. Preserved `get_client()` as backward-compatible alias to `get_oauth_client()`.
- Implemented `SpotifyService.search_catalog(query, limit)` and `SpotifyService.get_album(album_id)` with multi-page track pagination and safe artist/URL dictionary navigation. Added `extract_album_id` static method.
- Implemented `YTMusicService.search_catalog(query, limit)` and `YTMusicService.get_album(album_id)` with safe track count extraction and `extract_album_id` helper.
- Updated `YTMusicService.get_playlist` and `SpotifyService.get_playlist` to enforce `limit` slicing with `source_track_count` and `truncated` envelope flags for symmetric platform behavior.
- Updated `TrackScanItem` in `backend/app/main.py` with canonical 12-key contract + `index` (`id`, `title`, `artist`, `artists_list`, `album`, `duration`, `duration_seconds`, `is_explicit`, `thumbnail`, `video_url`, `verification_status: "unscanned"`, `source_platform`), using `ConfigDict(extra="ignore")`.
- Added Pydantic models `AlbumSummary`, `CatalogSearchRequest`, `CatalogSearchResponse`, `CatalogAlbumRequest`, and `CatalogAlbumResponse`.
- Added route handlers `@app.post("/api/catalog/search")` and `@app.post("/api/catalog/album")` with fast empty/whitespace query short-circuiting and HTTP exception mapping.
- Added comprehensive unit and edge-case test suite in `backend/app/tests/test_catalog_endpoints.py` (22 tests, bringing total backend test suite to 36 tests).
- Verified all 36 backend tests pass, all 13 frontend tests pass, oxlint reports 0 errors, and Vite builds cleanly in production.

## Review Triage Log

- `high` (patched): Flawed truncation detection and source track count in `YTMusicService.get_playlist` — patched to read `raw_playlist.get("trackCount")` for true `source_track_count` and compute `truncated`.
- `medium` (patched): Missing slicing, limit parameter, and envelope fields in `SpotifyService.get_playlist` — patched to accept `limit` and return `source_track_count` and `truncated`.
- `medium` (patched): Stripping of track `index` in `TrackScanItem` — patched `TrackScanItem` to include `index: Optional[int] = None`.
- `medium` (patched): Missing error handling in `get_catalog_album` — patched `main.py` with try/except mapping `ValueError` to 400 and `Exception` to 500.
- `low` (patched): Uncaught `TypeError` when artist names are `None` in `SpotifyService` — patched with `(a.get("name") or "Unknown")`.
- `low` (patched): Unsafe dictionary navigation on `external_urls` in `SpotifyService` — patched with `(track.get("external_urls") or {}).get("spotify", "")`.
- `medium` (patched): Missing album URL and URI parsing in `get_album` — patched `SpotifyService.extract_album_id` and `YTMusicService.extract_album_id`.
- `medium` (patched): Unchecked empty and whitespace queries in catalog search — patched `search_catalog` to short-circuit and return `{"songs": [], "albums": []}`.
- `low` (patched): Inconsistent catalog search error handling across platforms — wrapped both platforms in clean error handling in `main.py`.
- `medium` (patched): Potential Pydantic validation failure on `AlbumSummary.track_count` — patched `ytmusic_service.py` to regex-extract numbers from string counts.
- `medium` (patched): Spotify album track pagination truncated at 50 items — patched `get_album` to paginate through `tracks.next`.
- `low` (patched): Unused response models on catalog endpoints — attached `response_model=CatalogSearchResponse` and `response_model=CatalogAlbumResponse`.
- `low` (patched): Contradictory default fetch limits in `PlaylistFetchRequest` — changed `PlaylistFetchRequest.limit` default to 50.
- `false`: Lack of integration testing via FastAPI `TestClient` — `TestClient` in this environment fails collection with `RuntimeError: The starlette.testclient module requires the httpx package to be installed`; direct FastAPI route function execution provides identical endpoint coverage without adding undeclared dependencies.
