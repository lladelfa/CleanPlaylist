# Epic 6 Context: Studio Workspace Hierarchy & Visual Zoning

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Provide a structured, high-contrast studio workspace that eliminates the "dark slab" effect through a unified Smart Omnibar, distinct 3-zone surface elevations (Ingest & Discovery, Screening Console, Track Workbench), left-edge accent rails, strict Obsidian Audio Core design token hygiene, and self-explanatory screening presets.

## Stories

- Story 6.1: Single Smart Omnibar & Legacy Input Box Deprecation
- Story 6.2: 3-Zone Workspace Surface Depths & Accent Rails
- Story 6.3: Obsidian Design Token Hygiene & Safety Emerald Reservation
- Story 6.4: Screening Preset Micro-Explainers & Policy Badging

## Requirements & Constraints

- Eliminate competing input boxes in the Scan & Clean view (`ScanTab.jsx`). `SmartInputBar` must serve as the single, authoritative entry point for catalog search, multi-line pasted track lists, and playlist URLs (both YouTube Music and Spotify).
- Deprecate/remove the duplicate legacy input container labeled "YouTube Music Playlist URL or Playlist ID" from `ScanTab.jsx`.
- When a YouTube Music playlist URL or ID is entered into `SmartInputBar`, automatically detect it and stage the playlist directly into the Working List.
- When a Spotify playlist URL or ID is entered by an unauthenticated user, seamlessly trigger `SpotifyPlaylistHelper` with step-by-step copy-paste instructions; if authenticated as VIP, initiate direct playlist fetching.
- Render quick try-it sample chips (e.g. "90s Hip-Hop", "Parent Test Sample") beneath `SmartInputBar` for zero-friction testing.
- When the Working List is empty (`workingList.length === 0`), present an empty-state hero card showing a clear 3-step visual narrative: 1. Source Music, 2. Screen Rules, 3. Clean Swaps.
- Maintain responsive zero-horizontal-scroll behavior across desktop and mobile layouts.
- Reserve Emerald Green (`#4EDEA3` / `#10B981`) exclusively for verified clean/swapped states (badges, clean candidate previews, swap confirmations). Unify platform and action chrome in Electric Violet (`#7C3AED` / `brand-primary`).

## Technical Decisions

- Architecture remains React 19 + Tailwind CSS v4 on the frontend.
- Component structure in `ScanTab.jsx`: replace the two side-by-side / separate card sections with a single Omnibar ingest area.
- In `SmartInputBar.jsx`: extend URL parsing logic to handle YouTube Music playlist URLs/IDs (e.g., `music.youtube.com/playlist?list=...` or standard playlist IDs) and route them to `onLoadPlaylist` or equivalent handler passed from `ScanTab.jsx`.
- Keep all unit tests passing with Vitest and `@testing-library/react`.
- Maintain visible text or explicit `aria-label`s on all interactive elements for accessibility and testability.

## UX & Interaction Patterns

- **UX-DR18 (3-Zone Studio Workspace Hierarchy & Surface Depth):** Workspace is organized into 3 distinct functional zones with `space-y-8` macro spacing:
  1. `Zone 1: Ingest & Discovery` (`bg-surface-elevated` with violet accent rail `border-l-4 border-l-brand-primary` and eyebrow badge `01 / SOURCE MUSIC`).
  2. `Zone 2: Screening Console` (`bg-surface-inset`, `border-border-strong`, eyebrow badge `02 / SCREENING RULES`).
  3. `Zone 3: Track Workbench` (`bg-surface-card`, `shadow-2xl`, eyebrow badge `03 / TRACK WORKBENCH`).
- **UX-DR19 (Unified Smart Omnibar & Single-Entry Staging):** Consolidates catalog search, multi-line text paste, and playlist URLs into a single hero omnibar, accompanied by sample chips and a 3-step value hero when empty.

## Cross-Story Dependencies

- Story 6.1 creates the single Omnibar and empty state hero in Zone 1.
- Story 6.2 completes the 3-zone container styling, surface depths, accent rails, and workbench de-nesting.
- Story 6.3 scrubs all leftover legacy `slate-*` classes and guards the emerald green safety token.
- Story 6.4 adds micro-explainers and badging to the screening presets in Zone 2.
