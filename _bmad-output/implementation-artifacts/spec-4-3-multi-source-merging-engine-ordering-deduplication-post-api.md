---
title: 'Story 4.3: Multi-Source Merging Engine, Ordering, & Deduplication (POST /api/stitch)'
type: 'feature'
created: '2026-11-10'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context:
  - _bmad-output/implementation-artifacts/epic-4-context.md
  - _bmad-output/planning-artifacts/epics.md
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** When users merge multiple zero-login music sources in Stitch Studio, the backend stitch endpoint must deterministically apply user-selected ordering (sequential, interleave, title_asc, artist_asc), deduplication (exact_id, title_artist, none), and clean filtering rules (replace_clean_or_drop, replace_clean_or_keep, exclude_flagged, keep_all) while prioritizing `verification_status` over raw metadata and stamping clean replacements with verified non-explicit status.

**Approach:** Update `stitcher_service.py` and `POST /api/stitch` in `main.py` to:
1. Accept `platform: Optional[str] = "ytmusic"` in `StitchRequest` alongside `playlists`, `order_mode`, `deduplication_mode`, `clean_mode`, `manual_replacements`, and `manual_actions`.
2. Apply ordering modes: `sequential` (in playlist order), `interleave` (round-robin across playlists), `title_asc` (case-insensitive sort by title), and `artist_asc` (case-insensitive sort by artist).
3. Apply deduplication modes: `exact_id` (by non-empty track `id`), `title_artist` (normalized title and artist key), or `none` (preserve all).
4. Evaluate clean rules prioritizing `verification_status == "flagged"` (falling back to `is_flagged or is_explicit` only when `verification_status` is unset).
5. For clean replacement candidates under `replace_clean_or_drop`, `replace_clean_or_keep`, or manual `replace`: replace the flagged track, stamp `verification_status: "clean_swapped"` and `is_flagged: false`, attach `replaced_original`, and retain `source_playlist_title`.
6. Return a comprehensive `StitchResult` envelope with `tracks`, `summary` (and matching `stats`), retaining `source_playlist_title` on each output track.
7. Verify all edge cases with comprehensive backend unit tests in `backend/app/tests/test_stitch.py`.

</frozen-after-approval>

## Implementation Notes

- **Multi-Source Stitcher Service (`backend/app/services/stitcher_service.py`)**:
  - Implemented `_create_swapped_track` stamping `verification_status: "clean_swapped"`, `is_flagged: False`, and `is_explicit: False` per NFR-3 / ARCH-3, while preserving `replaced_original` (`id`, `title`, `artist`) and origin `source_playlist_title`.
  - Added `verification_status` priority evaluation: checks `verification_status == "flagged"` directly, falling back to `is_flagged or is_explicit` only when unset or blank.
  - Added support for both `manual_replacements` dict and embedded `track["clean_replacement"]` candidates.
  - Implemented safe deduplication guarding against `None`/empty track IDs and title/artist normalization with empty fallbacks.
  - Enhanced ordering modes with null-safe title and artist casing (`(x.get("title") or "").lower()`).
  - Added falsy playlist title fallback (`pl.get("title") or f"Playlist {p_idx + 1}"`).
  - Returned unified `StitchResult` envelope with `tracks`, `summary`, and backwards-compatible `stats` (including `total_input_tracks`, `initial_total_tracks`, `duplicates_removed`, `tracks_replaced`, `tracks_dropped`, and `final_track_count`).
- **API Endpoint Contracts (`backend/app/main.py`)**:
  - Extended `StitchRequest` to accept `platform: Optional[str] = "ytmusic"`, matching client payload from `StitchTab.jsx`.
  - Forwarded `platform` to `stitcher_service.stitch_playlists`.
- **Unit Testing Suite (`backend/app/tests/test_stitch.py`)**:
  - Added 9 unit tests covering:
    - Route registration on `/api/stitch` (`POST`).
    - All 4 ordering modes (`sequential`, `interleave`, `title_asc`, `artist_asc`).
    - All 3 deduplication modes (`exact_id`, `title_artist`, `none`).
    - Verification status priority and all 4 clean filtering modes (`replace_clean_or_drop`, `replace_clean_or_keep`, `exclude_flagged`, `keep_all`).
    - Manual user actions override (`drop`, `replace`, `keep`).
    - POST `/api/stitch` endpoint execution and envelope validation.
    - Embedded `clean_replacement` track attribute handling.
    - Missing/None `id`, `title`, and `artist` safety.
    - Boundary conditions for empty playlists and track lists.

## Review Triage Log

- Missing None/empty ID guard in `exact_id` deduplication (`stitcher_service.py`): `medium` (patched — added `if v_id` check before deduplicating and adding to `seen_ids`)
- Potential `AttributeError` on `None` title or artist in sorting and normalization (`stitcher_service.py`): `low` (patched — used `(x.get(...) or "").lower()` defensively)
- `platform` parameter is accepted but ignored in `stitch_playlists` (`stitcher_service.py`): `low` (rejected — `platform` is accepted on `StitchRequest` and forwarded to maintain route contract with frontend callers)
- Missing `is_explicit: False` enforcement in `_create_swapped_track` (`stitcher_service.py`): `medium` (patched — added `rep_track["is_explicit"] = False` per NFR-3 and ARCH-3)
- Unchecked fallback when `manual_actions[v_id] == "replace"` but clean replacement is missing (`stitcher_service.py`): `low` (rejected — as-designed fallback behavior to automatic clean mode evaluation)
- Falsy playlist title fallback in track annotation (`stitcher_service.py`): `low` (patched — used `pl.get("title") or f"Playlist {p_idx + 1}"`)
- Missing Pydantic response model for `POST /api/stitch` (`main.py`): `low` (rejected — consistent with dynamic envelope patterns across other endpoints)
- Missing literal or enum validation on `StitchRequest` fields (`main.py`): `low` (rejected — optional strings with defaults in service adhere to project pattern)
- Redundant `summary` and `stats` fields with duplicated key names (`stitcher_service.py`): `false` (rejected — intentional design providing backwards compatibility for `StitchTab.jsx`'s `stitchedResult.stats` while fulfilling `StitchSummary` contract from `epics.md`)
- Lack of HTTP execution testing via `TestClient` (`backend/app/tests/test_stitch.py`): `false` (rejected — Starlette `TestClient` is unconfigured without httpx2 in test env; direct endpoint testing is standard across backend tests)
- Missing test coverage for embedded `track["clean_replacement"]` (`backend/app/tests/test_stitch.py`): `medium` (patched — added `test_embedded_track_clean_replacement`)
- Missing test coverage for empty inputs and boundary conditions (`backend/app/tests/test_stitch.py`): `medium` (patched — added `test_empty_inputs_boundary` and `test_none_id_and_none_titles_handling`)
