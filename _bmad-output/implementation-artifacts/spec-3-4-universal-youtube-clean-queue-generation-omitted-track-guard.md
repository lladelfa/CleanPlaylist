---
title: 'Story 3.4: Universal YouTube Clean Queue Generation & Omitted-Track Guard'
type: 'feature'
created: '2026-11-09'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context:
  - _bmad-output/implementation-artifacts/epic-3-context.md
  - _bmad-output/planning-artifacts/epics.md
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Users reviewing a screened playlist lack a universal, zero-login mechanism to immediately play their approved clean tracks (`verification_status in {"verified_clean", "clean_swapped"}` or `keptTrackIds`) across devices without logging into streaming accounts. Additionally, on Spotify, tracks lacking resolved YouTube counterparts could cause broken playback queues or silent omissions without user warning.

**Approach:** Implement `finishLine.js` to compute ready tracks, extract YouTube video IDs (native IDs in `ytmusic` mode; cross-referenced `ytmusic_video_id`s in `spotify` mode capped at 50 IDs), and launch `https://www.youtube.com/watch_videos?video_ids=<ids>` in a new tab (`target="_blank"`, `rel="noopener noreferrer"`). Guard Spotify playback by opening the queue with resolved IDs and displaying an amber `NoticeBanner` if any ready tracks lacked YouTube links, or blocking queue generation with a caution `NoticeBanner` if zero ready tracks resolved. Mount the sticky `FinishLineBar` in `ScanTab` with real-time ready-track summary and responsive `Play Clean Queue` CTA.

</frozen-after-approval>

## Implementation Notes

- **`finishLine.js` Domain Logic (`frontend/src/utils/finishLine.js`)**:
  - Implemented `getReadyTracks(tracks, keptTrackIds)` supporting `verification_status in ["verified_clean", "clean_swapped"]` and `keptTrackIds` (both Set and Array).
  - Implemented `extractYouTubeVideoIds(readyTracks, platform)` extracting native YouTube IDs in `ytmusic` (including YouTube Shorts regex support) and cross-referenced `ytmusic_video_id`s in `spotify`, capping at 50 IDs and calculating `omittedCount`.
  - Implemented `buildYouTubeWatchVideosUrl(videoIds)` validating and URI-encoding video IDs.
  - Implemented `launchYouTubeCleanQueue({ readyTracks, platform, onNotice, openWindow })` opening `watch_videos` in a new tab (`noopener,noreferrer`), emitting `finish_action_clicked` telemetry, warning on omitted tracks, blocking broken URLs with caution notices when zero IDs resolve on Spotify, and alerting if the browser blocks popups.
- **`FinishLineBar` Component (`frontend/src/components/FinishLineBar.jsx`)**:
  - Implemented sticky bottom dock (`fixed bottom-0 left-0 right-0 z-40 bg-surface-inset/95 backdrop-blur-md border-t border-border-subtle`) with `pb-[max(0.75rem,env(safe-area-inset-bottom))]` safe-area inset.
  - Surfaced real-time status summary: `{readyCount} tracks ready` with safety-reserved emerald `CheckCircle2` icon and `{flaggedCount} need review` alert text, wired with `aria-live="polite"` and `aria-atomic="true"`.
  - Responsive CTA layout: Desktop primary `Play Clean Queue` studio CTA in electric violet (`bg-brand-primary`) alongside microcopy; Mobile full-width `Play Clean Queue ({readyCount})` (`min-h-[46px]`, `w-full`).
  - Disabled `Play Clean Queue` button when `readyCount === 0`.
- **`ScanTab` Integration (`frontend/src/components/ScanTab.jsx`)**:
  - Reserved `pb-36 md:pb-24` bottom padding on page container when tracks are loaded so dock never occludes row actions.
  - Mounted `FinishLineBar` passing `currentTracks`, `keptTrackIds`, `activePlatform`, and smooth scrolling to top when dock notices are surfaced.
- **Test Suites (`frontend/src/utils/__tests__/finishLine.test.js`, `frontend/src/components/__tests__/FinishLineBar.test.jsx`)**:
  - Added 13 unit tests for `finishLine.js` covering all edge cases (ready tracks filtering, YouTube Shorts, excess capping, URI encoding, missing links, zero resolved links, popup blocking, telemetry).
  - Added 5 component tests for `FinishLineBar.jsx` verifying status summaries, button states, responsive classes, keep overrides, and launch callbacks.

## Review Triage Log

- Silent truncation when ready tracks exceed 50: `medium` (patched — added excess count calculation into `omittedCount` in `extractYouTubeVideoIds`).
- Missing sequential queue support for > 50 tracks: `false` (rejected — workingList has a hard capacity limit of 50 tracks in Scan & Clean; sequential queue buttons are scoped to VIP/Stitch output exceeding 50).
- Off-screen notice banner visibility from bottom dock: `low` (patched — added smooth scroll to top when dock emits notice banners in `ScanTab`).
- Missing safe-area inset on fixed dock for mobile devices: `low` (patched — added `pb-[max(0.75rem,env(safe-area-inset-bottom))]` safe-area padding).
- Missing YouTube Shorts URL regex support: `low` (patched — added `|shorts\/` to YouTube URL matching pattern).
- Lack of video ID validation and URI encoding: `low` (patched — added `encodeURIComponent` and whitespace trimming to video IDs in `buildYouTubeWatchVideosUrl`).
- Unhandled popup blocker suppression: `medium` (patched — detected `null` return from `window.open` and surfaced retryable caution notice).
- Asymmetric and incomplete fallback in `extractYouTubeVideoIds`: `medium` (patched — added fallback to candidate `video_id` / `ytmusic_video_id` across platforms).
- Inconsistent flagged count calculation: `medium` (patched — synchronized flagged count formula with `ScanTab.jsx` checking both `is_flagged` and `verification_status === 'flagged'`).
- Mobile layout hides status summary when flagged count reaches zero: `false` (rejected — mockup `02-scan-clean-mobile.html` intentionally uses the primary full-width button containing the ready count `Play Clean Queue (${readyCount})`).
- Missing ARIA live region for dynamic count updates: `low` (patched — added `aria-live="polite"` and `aria-atomic="true"` to status summaries).
- Missing test coverage for edge cases: `low` (patched — added test coverage for Shorts, excess capping in omitted count, URI encoding, and popup blocker suppression).
