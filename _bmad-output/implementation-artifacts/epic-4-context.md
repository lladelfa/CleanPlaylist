# Epic 4 Context: Zero-Login Multi-Source Stitch Studio

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Users (such as teachers and group leaders) can merge multiple zero-login music sources (YouTube Music playlist URLs, searched albums, pasted song requests, or the active Working List) up to a 50-track quota under automated batch clean, ordering, and deduplication rules, and launch an instant Clean Queue without logging in.

## Stories

- Story 4.1: Multi-Source Input Pool & 50-Track Staged Quota Bar
- Story 4.2: Automated Stitch Pre-Screening Pipeline & Batch Clean Rule Enforcement
- Story 4.3: Multi-Source Merging Engine, Ordering, & Deduplication (`POST /api/stitch`)
- Story 4.4: Stitched Clean Output Workbench & Isolated Finish Line Handoff

## Requirements & Constraints

- Enforce a 50-track combined staged quota in public mode to maintain $0 marginal cost and fit within single-link playback limits; warn with amber notice on truncation.
- Support 4 source triggers: YouTube Music playlist URL, searched album, `PasteTrackListPanel`, and 1-click `Add Current Working List` (when `workingList.length > 0`).
- Stitch Studio (`StitchTab.jsx`) manages its own independent input pool and isolated stitched result state without mutating `App.jsx.workingList`.
- Preserve cached lyrics from `lyricsByTrackId` when adding the current Working List to avoid redundant network calls.
- Resolve pasted track lists via `POST /api/catalog/resolve`, handling unresolvable lines gracefully with an inline banner without aborting the batch.
- Automatically execute pre-screening before merge: resolve pasted text, scan uncached lyrics via `POST /api/scan/playlist`, and query `POST /api/replacements/find-batch` for flagged tracks when clean modes require replacements.
- Support 4 automated clean modes: `replace_clean_or_drop`, `replace_clean_or_keep`, `exclude_flagged`, `keep_all`.
- Support 4 ordering modes: `sequential`, `interleave`, `title_asc`, `artist_asc`.
- Support 3 deduplication modes: `exact_id`, `title_artist`, `none`.
- Stitched output tracks must retain origin `source_playlist_title` metadata.

## Technical Decisions

- **State Isolation:** `StitchTab.jsx` maintains its own input pool and stitch results. `FinishLineBar` in `StitchTab` operates strictly on `stitchedResult.tracks` without modifying `App.jsx.workingList`.
- **Pre-screening Pipeline:** Client orchestration (`screeningPipeline.js`) runs resolution, lyric scanning, and batch replacement calls prior to `POST /api/stitch`.
- **Backend Merge Engine:** `stitcher_service.py` executes deterministic track ordering, deduplication, and clean mode rule application with `verification_status` priority (clean candidates stamped `clean_swapped` + `is_flagged: false`).
- **HTTP Transport Boundary:** `POST /api/stitch` schema accepts `StitchRequest = {playlists, order_mode, deduplication_mode, clean_mode, manual_replacements, manual_actions, platform}` and returns `StitchResult = {tracks, summary}`.
- **Fail-soft Handling:** 429 rate limit or network errors pause the pre-screening pipeline cleanly, retain evaluated tracks, and show a retry banner.

## UX & Interaction Patterns

- **Stitch Studio Workbench:** 2-column source card layout showing title, track count, and explicit remove button (`aria-label="Remove source {name}"`).
- **Combined Track Quota Meter:** Live progress meter (`Combined Track Quota: N / 50 Staged`); transitions to caution amber with `NoticeBanner` when exceeding 50 staged tracks.
- **Rules Configuration Bar:** Clean mode dropdown, ordering selector, and deduplication toggles styled with Obsidian design tokens.
- **Isolated Finish Line Handoff:** Stitched Clean Queue output card with summary pills (total input, duplicates removed, replaced, dropped, final count), origin badges per row, and `FinishLineBar` (Play Clean Queue, Copy Clean Track Links, Export).

## Cross-Story Dependencies

- Story 4.1 builds the staged source pool, input triggers, and 50-track quota bar.
- Story 4.2 depends on Story 4.1's source pool to orchestrate the pre-screening pipeline (`screeningPipeline.js`).
- Story 4.3 consumes pre-screened tracks and implements `POST /api/stitch` in `stitcher_service.py`.
- Story 4.4 displays the output workbench and finishes handoff using `FinishLineBar` (built in Story 3.4/3.5).
