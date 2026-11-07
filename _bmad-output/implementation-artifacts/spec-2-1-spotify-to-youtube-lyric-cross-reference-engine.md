---
title: 'Story 2.1: Spotify-to-YouTube Lyric Cross-Reference Engine (lyric_xref_service.py)'
type: 'feature'
created: '2026-11-06'
status: 'done'
baseline_commit: '5f30febaf4266b46ec60c78cd30dff2431f10f80'
route: 'dispatch'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Spotify provides no public lyrics API for unauthenticated or third-party users; consequently, staged Spotify tracks cannot be evaluated for offensive lyrics or profanity without cross-referencing against an external source.

**Approach:** Implement `lyric_xref_service.py` as the sole server-side lyric resolution engine, querying YouTube Music for matching song candidates by normalized title and primary artist with duration tolerance (`<= 10s`), fetching and caching lyrics in `YTMusicService._lyrics_cache` (`maxsize=512`), and populating `ytmusic_video_id` onto track payloads for downstream Clean Queue generation.

## Boundaries & Constraints

**Always:**
- Expose `lyric_xref_service.resolve_lyrics_and_yt_id(track, platform)` as the sole server entry point for lyric resolution across all scan endpoints.
- When `platform == 'ytmusic'`, assign `ytmusic_video_id = track["id"]` (or `track.id`), fetch lyrics directly from `YTMusicService.get_track_lyrics(ytmusic_video_id)`, and populate `ytmusic_video_id`.
- When `platform == 'spotify'`, if `track.ytmusic_video_id` is already populated, reuse it; otherwise query `YTMusicService.search(query, filter="songs", limit=5)` using the normalized title and primary artist.
- Match candidate iff normalized title aligns (ignoring casing, punctuation, and parenthetical metadata like `(feat. ...)`, `(Remastered ...)`) AND primary artist aligns AND `abs(yt_duration - spotify_duration) <= 10` seconds when both duration values are `> 0`.
- Fall back to the top title/artist-aligned song candidate only if duration metadata is `0`.
- Cache retrieved `(ytmusic_video_id, lyrics)` in `YTMusicService._lyrics_cache` with an LRU bound of `maxsize=512`.
- Populate `ytmusic_video_id` onto the track dictionary or `TrackScanItem` whenever a candidate is matched.
- Catch all upstream network or parsing exceptions and return `(None, None)` or `(candidate_id, None)` gracefully without raising unhandled exceptions.

**Never:**
- Never import `ytmusicapi` or `spotipy` directly inside `lyric_xref_service.py`; always call domain methods on `YTMusicService`.
- Never mark tracks as clean when lyrics fail to resolve or are missing.
- Never crash on missing metadata, malformed durations, or empty artist lists.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Spotify track exact duration match | Spotify track with title `"In the End (Remastered)"`, artist `"Linkin Park"`, duration 216s | Query `"In the End Linkin Park"`, match candidate within 10s, return `(yt_video_id, lyrics_text)` and set `track["ytmusic_video_id"]` | Log warning and return `(None, None)` if search fails |
| Spotify track zero duration fallback | Spotify track with duration 0s or missing | Matches top aligned song candidate regardless of duration, fetches lyrics, returns `(yt_video_id, lyrics_text)` | Returns `(None, None)` if no aligned song found |
| Spotify track candidate found but no lyrics | Spotify track matches song video ID, but `get_lyrics` returns `None` | Returns `(yt_video_id, None)`, populates `track["ytmusic_video_id"] = yt_video_id` | Handled gracefully without exception |
| Spotify track no candidate found | Spotify track with no matching songs on YouTube Music | Returns `(None, None)`, leaves `ytmusic_video_id` as `None` | Handled gracefully without exception |
| YouTube Music native track | Platform is `'ytmusic'`, track ID `"abc123xyz"` | Directly calls `get_track_lyrics("abc123xyz")`, returns `("abc123xyz", lyrics_text)` | Returns `("abc123xyz", None)` if lyrics unavailable |
| Cache hit on subsequent request | Repeated query for previously resolved video ID | Returns cached lyrics immediately from `_lyrics_cache` without outbound network call | Handled by LRU cache |
| Upstream timeout / network error | YouTube search or lyrics fetch throws `ConnectionError` or `Timeout` | Returns `(None, None)` without bubbling 500 error | Catches `Exception`, logs warning |

</frozen-after-approval>

## Code Map

- `backend/app/services/lyric_xref_service.py` -- New domain service implementing string normalization, candidate search, duration matching, lyric resolution, and `ytmusic_video_id` assignment.
- `backend/app/services/ytmusic_service.py` -- Update `_lyrics_cache` to bounded LRU cache (`maxsize=512`), expose `search(query, filter, limit)` method for `lyric_xref_service`.
- `backend/app/main.py` -- Add `ytmusic_video_id: Optional[str] = None` to `TrackScanItem` schema to prevent Pydantic from stripping the field.
- `backend/app/tests/test_lyric_xref_service.py` -- Unit tests covering matching rules, duration tolerance, normalization stopwords, caching, error resilience, and edge cases.

## Tasks & Acceptance

**Execution:**
- [x] `backend/app/services/ytmusic_service.py` -- Implement `BoundedLyricsCache(maxsize=512)` for `_lyrics_cache` and expose `search(query, filter="songs", limit=5)` delegate method.
- [x] `backend/app/main.py` -- Add `ytmusic_video_id: Optional[str] = None` to `TrackScanItem` model.
- [x] `backend/app/services/lyric_xref_service.py` -- Create `LyricXRefService` with title/artist normalization, `resolve_lyrics_and_yt_id(track, platform)`, duration tolerance, and exception safety.
- [x] `backend/app/tests/test_lyric_xref_service.py` -- Write comprehensive unit tests for `lyric_xref_service` and `BoundedLyricsCache` edge cases (duration bounds, parenthetical stripping, missing lyrics, network exceptions).

**Acceptance Criteria:**
- Given a Spotify track in `workingList`, when `lyric_xref_service.resolve_lyrics_and_yt_id` is invoked, then it queries `YTMusicService.search(query, filter="songs", limit=5)` using normalized title and primary artist, matching a candidate iff normalized title and primary artist align AND `abs(yt_duration - spotify_duration) <= 10` seconds (or top candidate if duration is 0).
- Given a successful YouTube Music lyric cross-reference, when lyrics are retrieved, then `(ytmusic_video_id, lyrics)` is cached in `YTMusicService._lyrics_cache` (maxsize=512), and `ytmusic_video_id` is populated onto the track dictionary.
- Given a track where YouTube Music has no match or no lyrics available, when cross-reference resolution completes, then it returns `ytmusic_video_id = None` (or candidate ID if found without lyrics) and `lyrics = None` without crashing or throwing unhandled exceptions.

## Implementation Notes

## Spec Change Log

## Review Triage Log

| Finding | Verdict | Route | Evidence |
|---------|---------|-------|----------|
| VG-1: Candidate artist mismatch rejection unverified | low | patch | No test asserted skipping candidate with non-matching artist; easily covered in test suite. |
| VG-2: Candidate title mismatch rejection unverified | low | patch | No test asserted skipping candidate with non-matching title; easily covered in test suite. |
| VG-3: `YTMusicService.get_track_lyrics` cache integration unverified | low | patch | Acceptance criteria requires caching in `_lyrics_cache`; needs direct test exercising `get_track_lyrics`. |
| EC-1: `artists_list[0]` whitespace skips fallback to `artist` | low | patch | If `artists_list[0]` is whitespace, `bool(" ")` is True; check `strip()` before returning. |
| EC-2: Empty normalized candidate artist falsely matches in `_primary_artist_aligns` | medium | patch | Empty string in `norm_primary in cand_full_str` or `norm_cand_primary in norm_primary` evaluates to True. Guard against empty strings. |
| BH-1: Substring containment in `_primary_artist_aligns` matches across word boundaries | medium | patch | Bare `in` matches "eve" in "steve"; use token set comparison. |
| BH-2: `TRAILING_PAREN_PATTERN` strips song parts | low | patch | Refine regex to protect multi-part tracks like "(Part 1)". |
| BH-3: Zero-duration candidate accepted when track duration > 0 | low | patch | Check candidate duration > 0 when track duration > 0 before accepting zero-duration candidate if other candidates exist. |
| BH-4: Transient network errors cache None in `get_track_lyrics` | defer | defer | Pre-existing logic in `ytmusic_service.py` before this story. |
| BH-5: `BoundedLyricsCache` lacks thread safety | low | patch | Add `threading.Lock` to synchronize `OrderedDict` mutations. |
| BH-6: Inline import of `YTMusicService` in `_duration_aligns` | low | patch | Use `self.ytmusic_service.parse_duration_to_seconds`. |
| BH-7: Lack of fallback when matched candidate has no lyrics | false | reject | AC explicitly specifies returning candidate ID with None lyrics for Clean Queue linkage. |
| BH-8: Missing fallback from duration_seconds to duration | low | patch | Parse `duration` string if `duration_seconds` is missing or 0. |
| BH-9: Unicode apostrophe `\u2018` in `_normalize_text` | low | patch | Add `\u2018` to punctuation stripping. |
| BH-10: `extract_primary_artist` split on `/` or `&` | low | reject | Spotify tracks have populated `artists_list` which avoids string splitting; fallback only. |

## Verification

**Commands:**
- `$env:PYTHONPATH="backend"; .\.venv\Scripts\pytest.exe backend/app/tests/test_lyric_xref_service.py` -- expected: All unit tests pass
- `$env:PYTHONPATH="backend"; .\.venv\Scripts\pytest.exe backend/app/tests/` -- expected: All backend unit tests pass without regression
