# Deferred Work

- source_spec: `C:\Users\llade\Documents\GitHub\CleanPlaylist/_bmad-output/implementation-artifacts/spec-1-1-project-foundation-dependency-hygiene-obsidian-design-tokens.md`
  summary: ScannerService hardcodes 'Marked Explicit by YouTube Music' when is_metadata_explicit is true regardless of platform.
  evidence: `backend/app/services/scanner_service.py` line 48 appends a YouTube Music specific reason string even when scanning Spotify tracks; will be resolved under Epic 2 lyric screening stories.

- source_spec: `C:\Users\llade\Documents\GitHub\CleanPlaylist/_bmad-output/implementation-artifacts/spec-5-4-privacy-safe-usage-event-telemetry-sink-post-api-telemetry-e.md`
  summary: Add application-level rate limiting and payload size bounds on POST /api/telemetry/event.
  evidence: Telemetry endpoint is publicly accessible; currently relies on serverless platform host constraints rather than explicit FastAPI middleware rate limiting.

- source_spec: `C:\Users\llade\Documents\GitHub\CleanPlaylist/_bmad-output/implementation-artifacts/spec-6-4-screening-preset-micro-explainers-policy-badging.md`
  summary: Preset micro-copy in ScreeningControlsBar is hardcoded and has no contract test tying it to preset categories / include_metadata_explicit.
  evidence: Unverified (maybe-false, medium if true): copy matches lyricEvaluator.js DEFAULT_PRESET_PROFILES and backend PRESET_PROFILES today; would mislead users if server rules change. Settle with a test deriving expected claims from DEFAULT_PRESET_PROFILES or by building summaries from presetsData.

- source_spec: `C:\Users\llade\Documents\GitHub\CleanPlaylist/_bmad-output/implementation-artifacts/spec-6-4-screening-preset-micro-explainers-policy-badging.md`
  summary: The "Custom" preset is a fixed slurs + strong-profanity rule set, while the custom blocklist applies under every preset, so the name misleads users.
  evidence: lyricEvaluator.js:154-165 compiles the blocklist regardless of preset; config.py custom profile has fixed categories. Needs a product decision (rename, or make Custom blocklist-driven).

- source_spec: `C:\Users\llade\Documents\GitHub\CleanPlaylist/_bmad-output/implementation-artifacts/spec-6-4-screening-preset-micro-explainers-policy-badging.md`
  summary: sprint-status.yaml still lists 6-3-obsidian-design-token-hygiene-safety-emerald-guard as review although its spec is done and PR #70 is merged.
  evidence: Spec frontmatter status 'done'; merge commit 1a486b0 on master.

- source_spec: `_bmad-output/implementation-artifacts/spec-7-10-accessibility-and-mobile-pass.md`
  summary: Decide brand-token contrast fixes (`border-subtle` ~1.4:1, `text-muted` on `surface-highest` 3.89:1) and re-audit all `surface-highest` text.
  evidence: Brand-token changes need a human decision per the story notes.
- source_spec: `_bmad-output/implementation-artifacts/spec-7-10-accessibility-and-mobile-pass.md`
  summary: Manual 360/390px overflow, safe-area and screen-reader pass; check negative-margin chip remove buttons and taller 44px rows.
  evidence: jsdom cannot verify layout; the app was not run during this story.
- source_spec: `_bmad-output/implementation-artifacts/spec-7-10-accessibility-and-mobile-pass.md`
  summary: Modal robustness follow-ups: ref-counted body scroll lock and topmost-only Escape/Tab for stacked modals, shared focus helper, KeywordsTab thumbnail div onClick, aria-live/aria-pressed gaps.
  evidence: Raised by edge-case and blind reviewers; none reachable in current flows or required by the story ACs.
