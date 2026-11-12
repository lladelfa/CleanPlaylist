# Deferred Work

- source_spec: `C:\Users\llade\Documents\GitHub\CleanPlaylist/_bmad-output/implementation-artifacts/spec-1-1-project-foundation-dependency-hygiene-obsidian-design-tokens.md`
  summary: ScannerService hardcodes 'Marked Explicit by YouTube Music' when is_metadata_explicit is true regardless of platform.
  evidence: `backend/app/services/scanner_service.py` line 48 appends a YouTube Music specific reason string even when scanning Spotify tracks; will be resolved under Epic 2 lyric screening stories.

- source_spec: `C:\Users\llade\Documents\GitHub\CleanPlaylist/_bmad-output/implementation-artifacts/spec-5-4-privacy-safe-usage-event-telemetry-sink-post-api-telemetry-e.md`
  summary: Add application-level rate limiting and payload size bounds on POST /api/telemetry/event.
  evidence: Telemetry endpoint is publicly accessible; currently relies on serverless platform host constraints rather than explicit FastAPI middleware rate limiting.
