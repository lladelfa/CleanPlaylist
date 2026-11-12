# Epic 6 Context: Studio Workspace Hierarchy & Visual Zoning

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Epic 6 turns CleanPlaylist from a functional but visually flat dark interface into a coherent, high-contrast studio workspace. It establishes the shared information hierarchy, smart input, 3-zone surface model, and Obsidian Audio Core design system so users can confidently stage music, review screening results, and move between Scan & Clean, Keyword Search, and Stitch Studio without platform confusion, visual overload, or ambiguous status signals.

## Stories

- Story 6.1: Single Smart Omnibar & Legacy Input Box Deprecation
- Story 6.2: 3-Zone Workspace Surface Depths & Accent Rails
- Story 6.3: Obsidian Design Token Hygiene & Safety Emerald Reservation
- Story 6.4: Screening Preset Micro-Explainers & Policy Badging

## Requirements & Constraints

- Public UI must use a unified dark studio system with Obsidian token palette: `brand-primary` electric violet, `status-clean` emerald reserved for verified-safe states, and caution amber for notices only.
- The studio should present one dominant input experience: the SmartInputBar handles search, playlist URLs, and multi-line pasted lists. Legacy duplicate inputs are removed.
- The main workspace should be divided into three zones: Ingest & Discovery, Screening Console, and Track Workbench, each with distinct surface depth, section labels, and left-edge accent rail.
- The workbench must stay responsive across desktop and mobile, with dense track tables, mobile cards, the 44px touch minimum, and zero horizontal overflow.
- The system must preserve explicit platform context and avoid cross-platform state leakage: `activePlatform` drives all UI actions, and switching platforms with a non-empty working list requires an atomic reset via `PlatformSwitchModal`.
- All interactive controls need visible labels or aria-labels; banners, progress, and modal focus behavior must provide accessible feedback and reduced-motion compliance.
- Design decisions must be consistent with the zero-login public architecture: no public Spotify OAuth chrome, no legacy split-personality green/purple platform styling, and no “read-only” badges or confusing state labels.

## Technical Decisions

- `App.jsx` remains the single-root state owner for `activePlatform`, `workingList`, `lyricsByTrackId`, `preset`, `customBlocklist`, and related session state. The epic relies on this root state to keep the header, workbench, and modal flows consistent.
- `GlobalHeader` and `CatalogSelector` are the canonical navigation and platform toggle surfaces, with 3 tabs only and VIP controls gated behind the VIP mode state.
- `SmartInputBar` becomes the sole omnibar for search queries, playlist URLs, and paste notifications, while `PasteTrackListPanel` and `SpotifyPlaylistHelper` handle the detailed entry paths.
- The design system is implemented in Tailwind CSS v4 using theme tokens; the UI uses semantic classes instead of hardcoded `slate-*` or one-off platform tinting.
- Screening and finish actions remain client-side driven but must call relative `/api/*` endpoints with explicit `platform` payloads, preserving backend compatibility and preventing default `ytmusic` mismatches.
- The workbench and result surfaces are designed around a ready-track model: only verified clean or clean-swapped/kept track states are eligible for finish actions, while flagged or unavailable tracks clearly remain in review.
- The epic depends on prior architecture decisions for chunked screening, cross-platform reset semantics, and privacy-safe telemetry, but it owns the visual and interaction contract that makes those flows intelligible to users.

## UX & Interaction Patterns

- The Scan & Clean workspace opens with a 3-step empty-state hero: Source Music, Screen Rules, and Clean Swaps.
- The input area behaves like a smart studio console: typed searches debounce, playlist URLs auto-detect, pasted multi-line entries are interpreted inline, and same-platform or cross-platform mismatches are surfaced in `NoticeBanner` with direct recovery actions.
- Screening controls use a segmented preset bar with custom blocklist chips and a profanity-masking toggle defaulting to `isMasked = true`. This keeps the UI clear while preserving the underlying rule evaluation logic.
- The workbench surfaces a dense dark table on desktop and stacked mobile cards below `768px`, with row-level flags, accent rails, truncation, and status-pill clarity for `Verified Clean`, `Clean Swapped`, `Flagged`, `Lyrics Unavailable`, and `Unscanned`.
- `LyricsModal` provides evidence-first inspection: numbered lines, jump controls, token highlighting, and in-modal actions for `Keep Flagged Track`, `Swap to Clean`, or `Remove`.
- Finish actions remain sticky and contextual: the bar computes ready tracks and offers `Copy Clean Track Links`, `Play Clean Queue`, export, and VIP save actions in a platform-safe way.

## Cross-Story Dependencies

- Epic 1 provides the foundational session state, platform switching, catalog search, and input behavior that the omnibar and workbench depend on.
- Epic 2 supplies the masking, statuses, scanned-results semantics, and lyric inspection functionality that the studio surfaces visually.
- Epic 3 contributes the replacement flows, finish-line actions, and export/playback interactions that the 3-zone studio makes discoverable.
- Epic 5 is required for VIP-only Spotify actions and the associated allowlist/error banners, but public visitors must never see those controls without VIP mode.
- The design system and the visual zoning are deliberately layered on top of the functional platform and scan architecture; they do not replace the underlying data-model or screening logic.
