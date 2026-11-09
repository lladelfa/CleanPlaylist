---
title: 'Story 3.1: Resilient Clean Replacement Search Engine & Batch Endpoints (`find-batch`)'
type: 'feature'
created: '2026-11-09'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context:
  - _bmad-output/planning-artifacts/prds/prd-CleanPlaylist-2026-11-04/prd.md
  - _bmad-output/planning-artifacts/epics.md
  - backend/app/services/spotify_service.py
  - backend/app/services/ytmusic_service.py
  - backend/app/services/lyric_xref_service.py
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** 
1. When searching for clean replacements on Spotify (`POST /api/replacements/find`), the current implementation builds the search query using raw track and artist strings: `query = f"track:{title} artist:{artist}"`.
2. For tracks featuring numerous guest collaborators or long metadata titles (e.g. Wu-Tang Clan's *"Triumph (feat. Ol' Dirty Bastard, Inspectah Deck, Method Man, Cappadonna, U-God, RZA, GZA, Masta Killa, Ghostface Killah & Raekwon)"*), the resulting query string reaches 273+ characters, exceeding Spotify's strict Web API limit of 250 characters and causing `HTTP 400: Query exceeds maximum length of 250 characters`.
3. In addition, passing unparsed parenthetical guest lists and comma-separated collaborator rosters into Spotify search degrades search recall, causing clean versions of songs to be missed.
4. Furthermore, `Story 3.1` requires self-swap protection (`exclude_track_id`), batch lookup capabilities (`POST /api/replacements/find-batch` with `max_workers=4`), and co-resolving YouTube Music video IDs via `lyric_xref_service` for universal queue playback.

**Approach:** 
1. **Query Sanitization Pipeline:**
   - Implement title cleaning that strips parenthetical and bracketed metadata (`(feat. ...)`, `[feat. ...]`, `(Remastered ...)`, `(Live ...)`) before querying, reusing or aligning with `LyricXRefService.clean_title_for_query`.
   - Implement lead/primary artist extraction (`extract_primary_artist`) that isolates the primary artist name rather than chaining comma-separated guest lists.
2. **Multi-Tier Fallback Query Cascade:**
   - Execute an ordered fallback search cascade for Spotify clean replacement:
     - Tier 1 (Fielded): `track:"{clean_title}" artist:"{primary_artist}"`
     - Tier 2 (Unfielded Keyword): `"{clean_title}" "{primary_artist}"`
     - Tier 3 (Clean Suffix): `"{clean_title}" "{primary_artist}" clean`
     - Tier 4 (Title Only): `track:"{clean_title}"`
3. **Hard 200-Character Query Bound:**
   - Truncate any generated query to a maximum of 200 characters before sending to Spotify, well below the 250-character hard ceiling.
4. **Defensive API Error Handling:**
   - Catch `spotipy.SpotifyException` (specifically 400 Bad Request, 429 Rate Limit, and 5xx) within `search_clean_replacement`. Log warnings and safely fall back through tiers without raising unhandled 500 errors to the API caller.
5. **Self-Swap Guard & Scoring Verification:**
   - Accept `exclude_track_id: Optional[str] = None` (and map from `track_id` in request payloads).
   - Reject any search candidate where `candidate["id"] == exclude_track_id`, satisfying `NFR-3` (a song flagged for vulgar lyrics never matches itself as a clean edit).
   - Enforce duration diff threshold ($\le 35$ seconds) and boost non-explicit tracks tagged with "clean" or "radio edit".
6. **Batch Replacement Endpoint & Cross-Reference:**
   - Implement `POST /api/replacements/find-batch` taking up to 10 tracks, running clean searches concurrently (`max_workers=4`), co-resolving YouTube video IDs for Spotify tracks via `lyric_xref_service`, and returning `{results: Record<track_id, TrackScanItem | null>, lyrics_by_id: Dict[str, str]}`.

</frozen-after-approval>

## Acceptance Criteria

### Scenario 1: Long Metadata & Guest List Query Normalization
**Given** a flagged track with a long title and extensive guest features (e.g. title: *"Triumph (feat. Ol' Dirty Bastard, Inspectah Deck...)"*, artist: *"Wu-Tang Clan, Ol' Dirty Bastard..."* where raw concatenation exceeds 250 characters),  
**When** `POST /api/replacements/find` is called for `platform="spotify"`,  
**Then** the service sanitizes the title to *"Triumph"* and extracts the primary artist *"Wu-Tang Clan"*,  
**And** the query length sent to Spotify is strictly $\le 200$ characters,  
**And** Spotify returns a `200 OK` candidate search result without throwing `HTTP 400 Query exceeds maximum length of 250 characters`.

### Scenario 2: Multi-Tier Search Cascade
**Given** a track whose strict fielded query (`track:... artist:...`) yields 0 clean candidates on Spotify,  
**When** clean replacement search executes,  
**Then** the engine automatically falls back to secondary tiers (`"{clean_title}" "{primary_artist}"`, etc.) before concluding no clean version exists,  
**And** it returns the highest-scoring non-explicit match within $\pm 35$ seconds of original duration.

### Scenario 3: Defensive Error Isolation
**Given** an upstream Spotify API error (such as an unexpected HTTP 400, 429, or temporary outage),  
**When** `search_clean_replacement()` is invoked,  
**Then** the exception is caught and logged,  
**And** the endpoint returns `{"found": False, "clean_candidate": None}` rather than an unhandled 500 error.

### Scenario 4: Self-Swap Prevention (`exclude_track_id`)
**Given** a track flagged solely by lyrics whose provider metadata marks it `is_explicit == False`,  
**When** `POST /api/replacements/find` is called with `exclude_track_id=track.id`,  
**Then** any candidate matching `exclude_track_id` is rejected,  
**And** `NFR-3` is upheld: the track is never offered as a clean replacement for itself.

### Scenario 5: Batch Replacement Endpoint (`POST /api/replacements/find-batch`)
**Given** a batch request containing up to 10 flagged tracks,  
**When** `POST /api/replacements/find-batch` is invoked,  
**Then** it searches replacements concurrently with `max_workers=4`,  
**And** for each clean Spotify candidate found, it co-resolves its clean YouTube Music video ID via `lyric_xref_service`,  
**And** it returns `{results: Record<track_id, TrackScanItem | null>, lyrics_by_id: Dict[str, str]}` in $\le 8$ seconds p95.

## Implementation Notes

- **Query Sanitization & Primary Artist Isolation**:
  - Implemented `clean_title_for_query` and `extract_primary_artist` in `backend/app/services/spotify_service.py` with metadata regex patterns (`METADATA_PAREN_PATTERN`, `TRAILING_PAREN_PATTERN`, `TRAILING_HYPHEN_METADATA`).
  - Strips parenthetical guest lists and featured artist brackets (`(feat. ...)`, `[feat. ...]`, `(Remastered ...)`, `(Live ...)`) before constructing query strings.
  - Extracts the primary artist name, splitting on `,`, `/`, `&`, or `feat.`/`ft.`, eliminating 273+ character query strings that previously caused HTTP 400 errors with Spotify's 250-character limit.
  - Enforced a hard 200-character truncation ceiling (`query[:200]`) on all search queries sent to Spotify.

- **Multi-Tier Fallback Query Cascade**:
  - Configured ordered 4-tier query cascade:
    - Tier 1: `track:"{clean_title}" artist:"{primary_artist}"`
    - Tier 2: `"{clean_title}" "{primary_artist}"`
    - Tier 3: `"{clean_title}" "{primary_artist}" clean`
    - Tier 4: `track:"{clean_title}"`
  - Safely falls back across tiers if earlier tiers yield 0 clean candidates or raise Spotify API exceptions (e.g., HTTP 400, 429, 5xx).

- **Self-Swap Prevention & Normalized Track Envelope**:
  - Added `exclude_track_id` support across `SpotifyService.search_clean_replacement`, `YTMusicService.search_clean_replacement`, and `main.py` endpoints (`exclude_track_id` or `track_id`).
  - Rejects candidates matching `exclude_track_id`, upholding NFR-3 so songs flagged solely for lyrics are never replaced by themselves.
  - Added duration diff ceiling ($\le 35$s) and boosted confidence score (+20) for "clean" or "radio edit" in candidate titles.
  - Normalized candidate outputs to include all 10 keys: `id`, `title`, `artist`, `artists_list`, `album`, `duration`, `duration_seconds`, `is_explicit`, `thumbnail`, `video_url`, plus `confidence_score`.

- **Batch Clean Replacement Endpoint**:
  - Created `POST /api/replacements/find-batch` taking up to 10 tracks (`FindBatchCleanReplacementRequest`), returning `{results, lyrics_by_id}`.
  - Executes concurrent searches using `ThreadPoolExecutor(max_workers=4)`.
  - For clean Spotify candidates, co-resolves YouTube Music video IDs and clean lyrics via `lyric_xref_service.resolve_lyrics_and_yt_id`.
  - Defensive error isolation: guards against upstream Spotify or YouTube exceptions, returning clean `{results: {<id>: None}, lyrics_by_id: {}}` rather than unhandled 500 errors.

## Review Triage Log

- Unauthenticated Spotify batch requests trigger HTTP 401: `high` (patched — switched to `spotify_service.get_catalog_client()`, enabling catalog clean replacement without requiring user OAuth sessions).
- Single-track Spotify clean replacement fails silently for unauthenticated users: `high` (patched — single-track endpoint now uses `get_catalog_client()`).
- `SpotifyService.search_clean_replacement` defaults to OAuth client instead of catalog client: `high` (patched — defaults to `self.get_catalog_client()`).
- Blind query truncation (`query[:200]`) produces unbalanced quotes and broken Lucene search syntax: `high` (patched — individual token inputs `clean_title` to 80 chars, `primary_artist` to 60 chars are bounded before formatted query string generation, preventing unclosed quotes).
- Single-track endpoint does not co-resolve YouTube video ID or clean lyrics: `medium` (patched — co-resolves `ytmusic_video_id` for Spotify tracks in `/api/replacements/find`).
- Primary artist extraction splits valid band names containing delimiters: `low` (patched — refined regex to split on commas and feature markers while preserving names like AC/DC or Simon & Garfunkel).
- Duplication of title sanitization regexes and helper logic: `low` (patched — reused `LyricXRefService.clean_title_for_query`).
- Inconsistent platform string normalization across replacement endpoints: `low` (patched — unified to `(req.platform or "ytmusic").strip().lower()`).
- Tier 4 query fallback drops artist filtering without post-validation: `medium` (patched — added post-search candidate artist alignment check when falling back to title-only query).
- Batch replacement results dictionary order is non-deterministic: `low` (patched — preserved exact input ordering of `req.tracks`).
- Missing test coverage for batch YouTube Music replacement and unauthenticated Spotify flows: `low` (patched — added comprehensive test cases in `test_clean_replacements.py`).
- Missing `source_platform` and `verification_status` fields on returned clean candidate objects: `low` (patched — added `source_platform: "spotify" | "ytmusic"`, `verification_status: "clean"`, and `ytmusic_video_id` to candidate dicts).
