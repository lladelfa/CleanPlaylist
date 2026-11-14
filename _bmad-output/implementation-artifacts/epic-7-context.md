# Epic 7 Context: Screening Trust & Hardening

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Make what CleanPlaylist tells users trustworthy, and harden its one public write surface, before any post-MVP feature work starts. Screening preset descriptions must match the real rules. The Custom preset must be labeled accurately. The anonymous telemetry endpoint must resist flooding and oversized payloads. The mobile header must clear the phone status bar. The epic closes the open deferred-work items from Epics 1–6 (telemetry hardening, the missing preset copy contract test, and the misleading Custom preset copy). The other two deferred items (the hardcoded YouTube Music explicit-reason string and the stale 6-3 sprint status) are already fixed and are closed as housekeeping, with no story.

## Stories

- Story 7.1: Telemetry Rate Limiting & Payload Bounds
- Story 7.2: Preset Micro-Copy Contract Test
- Story 7.3: Custom Preset Copy Accuracy
- Story 7.4: Mobile Header Safe-Area Fix
- Story 7.5: CI Quality Gate Workflow
- Story 7.6: Lyric Lookup Outcome Signal (Backend)
- Story 7.7: Honest Degraded-State Messaging (Frontend)
- Story 7.8: Rename the Custom Preset Label
- Story 7.9: "Verified Clean" Caveat Copy
- Story 7.10: Accessibility & Mobile Pass

Stories 7.5–7.10 were added 2026-11-13 for friends-and-family launch readiness (CI gate, honest lyrics-failure signal and messaging, clearer Custom preset name, Verified Clean caveat, accessibility/mobile pass). They add no new FRs.

## Requirements & Constraints

- **Telemetry abuse protection:** `POST /api/telemetry/event` is public and zero-login. Over-limit requests (default 60 per minute per client IP-derived key, fixed window) return `429` with `Retry-After`. Bodies over the maximum size (default 2048 bytes) return `413`. Rejected requests emit no `cp_telemetry` log line. Limits come from environment settings with safe defaults, and every new variable gets a placeholder in `backend/.env.example`.
- **Telemetry privacy stays intact:** Usage Events still carry no identities, queries, URLs, titles, blocklist words, emails, or tokens. The IP-derived limiter key must not end up in emitted events or logs.
- **$0 run cost:** No paid infrastructure or new paid dependencies (no Redis or hosted rate limiter). New runtime Python dependencies, if any, go in both requirements files.
- **Preset honesty:** Preset micro-copy must describe each profile's real categories and its `include_metadata_explicit` flag. A change to rules without a matching copy change must fail tests. The frontend and backend must not drift on preset IDs or categories.
- **Custom preset decision (confirmed):** Custom keeps its current behavior: fixed slur and strong-profanity rules, plus the custom blocklist, which applies under every preset. Only the copy changes. The copy must say Custom applies the fixed rules **and** the blocklist, and the old "custom blocklist terms only" wording is removed. Verdicts, regex evaluation, categories, and API payloads stay unchanged, and existing evaluator and scanner tests pass without edits. A blocklist-only Custom would be a separate, re-approved behavior story.
- **Zero false-clean invariant still holds:** No change in this epic may cause a track to default to Verified Clean.
- **Mobile accessibility parity:** At 360px width, header controls stay fully visible, touch targets are at least 44px, and there is no horizontal overflow. Every control keeps visible text or an `aria-label`.
- **Testing policy:** TDD red-green. No live network calls and no real auth state in tests. Inject the limiter clock so window expiry tests are deterministic.

## Technical Decisions

- **Telemetry pipeline:** `TelemetryService` validates a strict Pydantic v2 discriminated union (`extra="forbid"`) and writes one JSON line (`channel: "cp_telemetry"`, `schema_version: 1`) to stdout. A forwarder is optional, gated by `TELEMETRY_INGEST_URL`. On success the endpoint returns `204 No Content`. Rate limiting and size checks run before validation and emission.
- **Limiter scope:** In-memory and per-instance, so best effort only. Serverless instances on Vercel Hobby do not share memory, and the platform host limits remain the outer defense. Story 7.1 must state this limit in its Dev Notes.
- **Preset sources of truth:** `DEFAULT_PRESET_PROFILES` in `lyricEvaluator.js` and `PRESET_PROFILES` in `backend/app/config.py`, served by `GET /api/presets`. Preset IDs are `kid_safe`, `moderate`, `slurs_only`, `custom`. Categories are `slurs`, `strong_profanity`, `mild_profanity`, `sexual`, `substances`. The client evaluator relies on byte-for-byte parity with server rules.
- **Contract approach:** Either derive copy from the profile data or check the copy against it in Vitest. Add a pytest test that compares `/api/presets` IDs and categories against a shared frontend contract fixture. The frontend and backend Custom descriptions must be identical strings, enforced by that test.
- **Safe-area fix:** Add `viewport-fit=cover` to the viewport meta in `frontend/index.html`. The sticky `GlobalHeader` adds `env(safe-area-inset-top)` on top of its normal top padding, which resolves to 0 on desktop. Use Tailwind v4 utilities or arbitrary values. There is no `tailwind.config.js`.

## UX & Interaction Patterns

- `ScreeningControlsBar` shows segmented preset pills (Kid Safe, Moderate, Slurs Only, Custom). Their micro-copy appears on hover or as visible text. The active pill uses `brand-primary`. Emerald stays reserved for verified clean or swapped states.
- On mobile (360–767px), the `GlobalHeader` is a sticky two-row header with icons, visible tab labels, and a compact `CatalogSelector`. On desktop, the layout must not change.
- Show only honest, deterministic copy. No embellished or fabricated claims about what the screening does.

## Cross-Story Dependencies

- 7.2 must land before 7.3, because the contract test guards the Custom copy change and enforces matching frontend and backend strings.
- 7.1 and 7.4 do not depend on each other or on 7.2 and 7.3.
- The preset copy being corrected came from Epic 6 (Story 6.4). The telemetry endpoint came from Epic 5 (Story 5.4).
