# Adversary Review — Architecture Spine (CleanPlaylist Public Launch Milestone)

**Document Reviewed:** `ARCHITECTURE-SPINE.md` (CleanPlaylist Public Launch Milestone)  
**Reviewer:** Adversary Reviewer (Reviewer Gate)  
**Date:** 2026-11-06  
**Verdict:** **CONDITIONAL PASS** (Architecture is robust in intent, but contains 5 high-impact integration holes where independent units obeying the ADs to the letter will build incompatibly).

---

## Adversarial Review Methodology

The adversary lens attempts to break the architecture spine by constructing two concrete units one level down (e.g. Unit A and Unit B: frontend vs backend, service vs router, or two parallel epic implementations) that each obey every Architectural Decision (AD) to the letter, yet still build incompatibly:
- Clashing shared-data shapes (field types, missing keys, Pydantic stripping).
- Split-brain ownership of an entity or state.
- Conflicting state-mutation paths and invariant violations.

Every incompatible pair identified represents a concrete risk of cross-epic integration failure during the build phase.

---

## Adversarial Findings & Incompatible Pairs

### 1. The 12-Key Canonical Envelope vs. Scan Verdict Payload (Data Shape Collision)
- **Governed by:** `AD-3`, `AD-4`, `AD-8`
- **Unit A (Backend Pydantic Schema in `main.py`):**
  Obeys AD-3 verbatim: *"Every track dict emitted by SpotifyService, YTMusicService, search_clean_replacement, and accepted/returned by TrackScanItem carries all 10 base keys ... plus ytmusic_video_id ... and verification_status ... keeping full lyric strings out of the 12-key Track dict."*
  Unit A defines `TrackScanItem(BaseModel)` with exactly those 12 fields and configures `model_config = ConfigDict(extra="ignore")` (or `extra="forbid"` to enforce strict contracts). `/api/scan/playlist` returns `tracks: List[TrackScanItem]`.
- **Unit B (Frontend Workbench / Modal in `WorkingListWorkbench.jsx` / `LyricsModal.jsx`):**
  Obeys AD-3 (*"with reasons containing both 'Marked Explicit by <Platform>' and 'Lyrics Unavailable'"*), AD-4 (*"un-truncated snippets per track"*), and AD-8 (*"icon+text pairing on every VerificationStatusBadge"*).
  Unit B expects `track.snippets: string[]`, `track.reasons: string[]`, `track.detected_terms: object[]`, and `track.is_flagged: bool` directly on each track object returned by `/api/scan/playlist`.
- **Adversarial Clash:**
  `TrackScanItem` in Unit A strips or rejects `snippets`, `reasons`, `detected_terms`, and `is_flagged` because AD-3 strictly limits the canonical track envelope to 12 keys. Unit B receives track objects with `snippets === undefined`, so `LyricsModal` has no snippets to highlight, `VerificationStatusBadge` has no reasons to display, and `StitchTab` cannot explain flagged tracks. Furthermore, if `TrackScanItem` uses `extra="forbid"`, passing previously scanned tracks from `workingList` back to `/api/scan/keywords` or `/api/stitch` will crash with HTTP `422 Unprocessable Entity`.
- **Hole to Close (Tighten AD-3 & AD-4):**
  AD-3 must formalize `ScannedTrackItem` as an explicit extension of `TrackScanItem`, defining the exact optional scan fields: `is_flagged: bool`, `reasons: List[str]`, `snippets: List[str]`, `detected_terms: List[Dict]`, and `total_flagged_count: int`. Specify that `TrackScanItem` on input ignores extra scan metadata, while scan endpoints explicitly return the enriched `ScannedTrackItem`.

---

### 2. Stitch Studio Clean Swapping & Output State Ownership (Split Brain & Mutation Path Collision)
- **Governed by:** `AD-4`, `AD-6`, `AD-7`
- **Unit A (Frontend `StitchTab.jsx` & `screeningPipeline.js`):**
  Obeys AD-6 (*"bulk Clean Replacement ... calls POST /api/replacements/find-batch in batches of <= 10 Flagged tracks ... maps non-null find-batch results into StitchRequest.manual_replacements ... and calls POST /api/stitch"*) and AD-7 (*"Public mode caps staged tracks at 50 ... Stitch Studio combined pool"*).
  Unit A executes replacement lookups on the client before calling stitch, and keeps the stitched result in `StitchTab` local state to avoid destroying `App.jsx.workingList`.
- **Unit B (Backend `stitcher_service.py` & Frontend `FinishLineBar.jsx`):**
  Obeys AD-4 (*"POST /api/stitch ... locks rule enums ... checks verification_status == 'flagged' ... and stamps verification_status = 'clean_swapped'"*) and AD-7 (*"FinishLineBar defines readyTracks as verification_status in {'verified_clean', 'clean_swapped'} or id in keptTrackIds"* from `App.jsx.workingList`).
  Unit B expects `stitcher_service.py` to be the sole authority applying clean rules, and `FinishLineBar` reads only `App.jsx.workingList`.
- **Adversarial Clash:**
  1. *Split Ownership of Swapping:* If `screeningPipeline.js` already substituted the track in the playlist before sending to `/api/stitch`, the track ID changed to the replacement ID, so `stitcher_service.py`'s check for `verification_status == "flagged"` and lookup in `manual_replacements[original_id]` fails. If `screeningPipeline.js` does NOT substitute it, but `clean_mode == "replace_clean_or_drop"`, `stitcher_service` drops flagged tracks that lacked replacements, while the client has no visibility into what was dropped until response.
  2. *Orphaned Stitched Output:* If `StitchTab` keeps the result in local component state, `FinishLineBar` (which sits in `App.jsx` and filters `App.jsx.workingList`) cannot export, copy links, or queue the stitched playlist! If `StitchTab` instead mutates `App.jsx.workingList`, it clobbers the user's staged scan session without warning.
- **Hole to Close (Tighten AD-4 & AD-7):**
  AD-4 and AD-7 must explicitly define:
  1. `StitchRequest.playlists` contains original unswapped tracks, and `manual_replacements` is strictly keyed by the original `track.id`.
  2. The output of `POST /api/stitch` is a standalone `StitchResult = {tracks: ScannedTrackItem[], summary: StitchSummary}`.
  3. `StitchTab` renders its own dedicated instance of `FinishLineBar` operating on `stitchedTracks`, leaving `App.jsx.workingList` intact.

---

### 3. Client vs. Server Regex Stemming & In-Memory Rescan Telemetry Drop (Divergent State Mutation)
- **Governed by:** `AD-4`, `AD-5`, `AD-9`
- **Unit A (Client `lyricEvaluator.js` for In-Memory Evaluation):**
  Obeys AD-5 (*"Client lyricEvaluator.js hydrates GET /api/presets once so Sensitivity Preset toggles, Custom Blocklist edits, LyricsModal line highlighting ... execute instantaneously in memory (0 network calls)"*).
  Unit A implements JavaScript regex `\b${word}\b` to evaluate cached lyrics when the user changes presets or edits the custom blocklist in `WorkingListWorkbench`.
- **Unit B (Server `scanner_service.py` & Telemetry `telemetry_service.py`):**
  Obeys AD-4 (`GET /api/presets`), AD-5, and AD-9 (*"scan_completed: {preset_id, track_count, flagged_count, lyrics_unavailable_count}"*).
  `scanner_service.py` applies Python stemming regex (`rf"\b{escaped}(?:ing|ed|s|es)?\b"`), case-folding, and specific punctuation handling that differs from naive JS word boundaries.
- **Adversarial Clash:**
  1. *Divergent Verdicts:* `scanner_service.py` flags "bitching", "fucking", and "shitted" due to `(?:ing|ed|s|es)?`. If `lyricEvaluator.js` compiles raw words from `WORD_CATEGORIES` without the exact suffix regex, client in-memory re-evaluations mark tracks as `verified_clean`, but opening `LyricsModal` (which calls `POST /api/scan/track-lyrics` per AD-4) marks them as `flagged`! The user sees a green badge flip to red upon opening the modal.
  2. *Telemetry Blindspot:* AD-5 mandates `0` network calls on preset toggle. AD-9 mandates `scan_completed` emission per completed funnel action. If Unit A doesn't call `/api/scan/playlist`, does Unit A call `POST /api/telemetry/event` with `scan_completed`? If Unit A does not call telemetry, preset switches are invisible to analytics (breaking SM-1/SM-3 conversion tracking). If Unit A DOES call `POST /api/telemetry/event`, it emits client-computed counts that clash with server definitions.
- **Hole to Close (Tighten AD-4 & AD-5):**
  AD-4 must specify that `GET /api/presets` returns compiled regex patterns or exact suffix rules (e.g., explicit morphological expansions `(?:ing|ed|s|es)?`) rather than bare root word lists, ensuring byte-for-byte identical evaluation between Python and JS. And AD-9 must explicitly mandate that `lyricEvaluator.js` emits `POST /api/telemetry/event (scan_completed)` upon completing client-side in-memory re-screening.

---

### 4. Spotify Clean Replacement ID Swapping vs. Lyric Cache & Zero False-Clean Invariant
- **Governed by:** `AD-3`, `AD-4`, `AD-5`, `AD-7`
- **Unit A (Backend `SpotifyService.search_clean_replacement`):**
  Obeys AD-3 (*"Both search_clean_replacement adapters require exclude_track_id and reject any candidate where candidate['id'] == exclude_track_id"*) and AD-4 (*"POST /api/replacements/find: adds track_id: Optional[str] = None and co-resolves clean ytmusic_video_id on spotify"*).
  Unit A finds clean Spotify track `sp_clean_456` for explicit track `sp_orig_123`, co-resolves `ytmusic_video_id`, and returns `candidate`.
- **Unit B (Frontend `App.jsx` & `finishLine.js`):**
  Obeys AD-3 (*"Applying a Clean Replacement sets verification_status = 'clean_swapped' and is_flagged = False"*) and AD-7 (*"App.jsx owns workingList deduplicated by track.id ... lyricsByTrackId"*).
  Unit B replaces `sp_orig_123` with `sp_clean_456` in `workingList`.
- **Adversarial Clash:**
  1. *Lyric Cache Invalidation:* `lyricsByTrackId` in `App.jsx` was keyed by `sp_orig_123`. The replacement track `sp_clean_456` has NO entry in `lyricsByTrackId`. When the user later switches presets or blocklists, `lyricEvaluator.js` cannot evaluate `sp_clean_456` in memory. Opening `LyricsModal` triggers a network call. If `sp_clean_456` contains vulgar lyrics (e.g., an unedited re-upload or metadata mislabel), the Zero False-Clean Invariant (`NFR-3`) is breached because Unit B blindly set `verification_status = "clean_swapped"` and `is_flagged = False` upon swapping.
  2. *Duplicate Key Collisions:* If `sp_clean_456` was already in `workingList` (e.g., from an album add containing both versions), swapping deduplicates by `track.id` (AD-7) and silently reduces `workingList.length`, breaking row key stability.
- **Hole to Close (Tighten AD-3 & AD-5):**
  AD-3 and AD-5 must mandate that `POST /api/replacements/find` and `find-batch` return `lyrics` (or pre-screen the replacement track against active preset rules) and return `lyrics_by_id` for the candidate so `App.jsx` immediately hydrates `lyricsByTrackId[candidate.id]`. If the clean candidate itself fails lyric screening, it must NOT be marked `clean_swapped`.

---

### 5. VIP Mode Bootstrap vs. Public Mode Spotify Playlist Interception (Routing Deadlock)
- **Governed by:** `AD-1`, `AD-7`
- **Unit A (Frontend `inputParser.js` & `SmartInputBar.jsx`):**
  Obeys AD-1: *"When **VIP Mode** or `isAuthenticated` is false, `open.spotify.com/playlist/*` and `spotify:playlist:*` are intercepted client-side (`0` network calls) into `SpotifyPlaylistHelper`."*
- **Unit B (Frontend `App.jsx` & `GlobalHeader.jsx`):**
  Obeys AD-1: *"VIP Mode activates iff `?vip=1` (`VIP_QUERY_PARAM`, persisted in `localStorage['cp_vip_mode']`) OR `authenticated == True`."* And AD-7: *"Routes (1) Spotify playlist URL/URI -> SpotifyPlaylistHelper in public mode or /api/playlist/fetch in authenticated VIP Mode."*
- **Adversarial Clash:**
  When an invited VIP user arrives with `?vip=1`, `vipMode == true` (persisted in `localStorage`), but `isAuthenticated == false` because they have not completed Spotify OAuth yet.
  The user pastes their Spotify playlist URL into `SmartInputBar`.
  Under Unit A's literal rule from AD-1 (*"When VIP Mode or isAuthenticated is false"*), because `isAuthenticated` is false, the input is immediately intercepted into `SpotifyPlaylistHelper` (which instructs the user to manually copy/paste songs because they are in "public mode"). The user is NEVER prompted to authenticate or connect Spotify, creating an onboarding deadlock for VIP testers.
- **Hole to Close (Tighten AD-1 & AD-7):**
  Clarify the 3-state VIP lifecycle in AD-1 and AD-7:
  - If `!vipMode`: Intercept Spotify playlist URLs to `SpotifyPlaylistHelper`.
  - If `vipMode && !isAuthenticated`: Intercept Spotify playlist URLs to open `SpotifyAuthModal` with a clear CTA (*"Connect Spotify to import your playlist"*).
  - If `vipMode && isAuthenticated`: Route Spotify playlist URLs to `POST /api/playlist/fetch`.

---

## Summary of Actionable AD Tightening Directives

| Finding | Target AD | Tightening Action |
| --- | --- | --- |
| 1. Scanned track fields stripped | `AD-3`, `AD-4` | Formalize `ScannedTrackItem` extending `TrackScanItem` with `is_flagged`, `reasons`, `snippets`, `detected_terms`, and `total_flagged_count`. Explicitly permit extra metadata on input or split input/output schemas. |
| 2. Stitch swapping & finish line split | `AD-4`, `AD-7` | Define `POST /api/stitch` output envelope as a standalone `StitchResult`; mandate that `StitchTab` hosts its own `FinishLineBar` without mutating `App.jsx.workingList`. |
| 3. Client/server regex & telemetry divergence | `AD-4`, `AD-5`, `AD-9` | Standardize regex compilation contract in `GET /api/presets` (include `(?:ing|ed|s|es)?` suffix patterns); explicitly require `POST /api/telemetry/event` emission on in-memory preset changes. |
| 4. Replacement track lyric hole | `AD-3`, `AD-5` | Mandate that `find-batch` returns replacement track lyrics into `lyrics_by_id` and verifies zero profanity before assigning `clean_swapped`. |
| 5. VIP unauthenticated playlist deadlock | `AD-1`, `AD-7` | Replace binary check with 3-state check: unauthenticated VIP mode routes playlist URLs to an auth modal rather than public helper. |
