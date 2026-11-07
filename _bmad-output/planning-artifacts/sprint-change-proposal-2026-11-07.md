# Sprint Change Proposal: Spotify Lyrics Resolution & UI Profanity Masking

**Date:** 2026-11-07  
**Project:** CleanPlaylist  
**Author / Initiator:** Zo  
**Scope Classification:** Moderate (Backlog addition + UI/UX enhancement)  
**Status:** Approved by Zo (2026-11-07)  

---

## 1. Issue Summary

### Problem Statement
During testing and review of the staged screening features:
1. **Spotify Lyrics Resolution:** When inspecting Spotify tracks in the working list, song lyrics are currently not displayed. As Spotify does not provide a public lyrics API, Spotify tracks must be cross-referenced with YouTube Music using song title, primary artist, and track duration ($\pm 10$ seconds) to retrieve lyrics.
2. **On-Screen Profanity Visibility:** Vulgar words and search keywords are currently displayed as raw plain text in custom blocklist chips, detected reasons, and snippet highlights. For parents, teachers, and public presenters, displaying raw profanity on screen during screening introduces discomfort and accidental exposure.

### Discovery Context
- The missing Spotify lyrics issue was observed while inspecting single tracks in the working list. Batch scanning in Story 2.1 already incorporates `lyric_xref_service.py`, but single-track retrieval endpoints and modal overlays needed alignment.
- The UI censoring requirement was identified as an essential safety and usability refinement to mask vulgar keywords by default while allowing users to toggle visibility.

---

## 2. Impact Analysis

### Epic Impact
- **Epic 2: Cross-Platform Lyric Screening & Verification Workbench**: Directly impacted. Adds Story 2.6 to Epic 2 for dedicated implementation of the masking feature. No impact on Epic 1, Epic 3, Epic 4, or Epic 5.

### Story Impact
- **Story 2.4 (In Progress):** Unaffected in scope. Proceeds with implementing `POST /api/scan/track-lyrics` using `lyric_xref_service.resolve_lyrics_and_yt_id` and the inspection overlay in `LyricsModal.jsx`, directly resolving single-track Spotify lyrics lookups.
- **Story 2.5 (Backlog):** Keyword Search Workbench proceeds as planned.
- **Story 2.6 (New - Backlog):** New dedicated story for the UI profanity masking toggle, global `isMasked` state, and universal asterisk formatting (`w***`).

### Artifact Conflicts
- **PRD:** Augmented with requirement `FR-16: On-Screen Profanity Masking & Unmask Toggle`.
- **UX Specifications (`DESIGN.md`, `EXPERIENCE.md`):** Augmented with requirement `UX-DR17: On-Screen Profanity Masking & Obfuscation Toggle`.
- **Epics Breakdown (`epics.md`):** Updated with Story 2.6 and requirement mapping.
- **Sprint Status (`sprint-status.yaml`):** Updated with `2-6-ui-profanity-masking-toggle-global-asterisk-obfuscation: backlog`.

### Technical Impact
- Zero database changes ($0 marginal cost maintained).
- Zero breaking changes to backend API contracts or regex matching logic (matching continues to run on unmasked strings).
- Simple client-side presentation helper: `${word[0]}${'*'.repeat(word.length - 1)}`.

---

## 3. Recommended Approach

### Selected Path: Direct Adjustment (Option 1)
- **Rationale:** Maintaining the existing Epic 2 structure and isolating the new UI masking capability into a dedicated Story 2.6 avoids interrupting Story 2.4 while in flight. Story 2.4 completes the Spotify lyrics lookup fix cleanly, after which Story 2.6 layers on the visual masking toggle.
- **Effort Estimate:** Low (Frontend state + masking utility + toggle button).
- **Risk Level:** Very Low (Purely presentational; no alteration of regex screening or API payloads).
- **Timeline Impact:** Adds 1 short story to Epic 2 before moving to Epic 3.

---

## 4. Detailed Change Proposals

### 4.1. Epics & Stories Breakdown (`_bmad-output/planning-artifacts/epics.md`)
**Addition to Epic 2:**
```markdown
### Story 2.6: UI Profanity Masking Toggle & Global Asterisk Obfuscation

As a parent, teacher, or presenter screening music,
I want explicit words and custom search terms masked on-screen by default with an optional unmask toggle,
So that vulgar language is never visibly exposed on my screen while setting up or reviewing playlists.

Acceptance Criteria:

Given the CleanPlaylist studio interface,
When the app mounts,
Then a global `isMasked` state initializes to `true` (masked by default),
And a Masking toggle button (eye / eye-off icon with `aria-label="Toggle profanity masking"`) is accessible in `ScreeningControlsBar`,
And clicking the toggle switches `isMasked` between `true` and `false`.

Given any word displayed as an explicit token, blocklist chip, or flagged snippet,
When `isMasked` is `true`,
Then a formatting helper masks the word keeping only the initial character visible followed by asterisks (e.g., "fuck" -> "f***", "shit" -> "s***", single-character tokens unchanged),
And masking applies consistently across:
  1. Custom Blocklist chips in `ScreeningControlsBar`
  2. Detected reason tags and snippets in `WorkingListWorkbench` and `MobileTrackCard`
  3. Flagged line highlights and profanity badge tags in `LyricsModal`
  4. Search keywords and highlighted excerpts in `KeywordSearchWorkbench`.

Given underlying screening and search mechanisms,
When words are masked in the UI,
Then all internal regex matching, preset definitions, and API payloads continue to operate on the unmasked literal strings.
```

### 4.2. PRD Requirement (`_bmad-output/planning-artifacts/prds/prd-CleanPlaylist-2026-11-04/prd.md`)
**Addition to Functional Requirements:**
```markdown
FR-16: On-Screen Profanity Masking & Unmask Toggle — The UI defaults to masking all displayed profanity tokens, custom blocklist chips, and detected keyword matches (preserving only the first character followed by asterisks, e.g., `w***`), with a global toggle in the screening controls to mask/unmask on demand without altering internal regex evaluation or API payloads.
```

### 4.3. UX Specifications (`DESIGN.md` & `EXPERIENCE.md`)
**Addition to Design & Experience Requirements:**
```markdown
UX-DR17: On-Screen Profanity Masking & Obfuscation Toggle —
- Component: ScreeningControlsBar renders a compact toggle button featuring `lucide-react` `EyeOff` (when masked, default) and `Eye` (when unmasked), styled with Obsidian tokens `bg-surface-card` and `border-border-subtle`, with explicit `aria-label="Toggle profanity masking"`.
- Formatting Invariant: When `isMasked` is active (default), any explicit term is formatted as `${word[0]}${'*'.repeat(word.length - 1)}` (e.g., `shit` -> `s***`). Single-character tokens remain unmasked.
- Universal Scope: Masking dynamically applies to:
  1. Custom Blocklist chips in `ScreeningControlsBar`
  2. Flagged reason chips and snippet previews in `WorkingListWorkbench` and `MobileTrackCard`
  3. Flagged line highlights and profanity badges in `LyricsModal`
  4. Starter theme chips and matched line excerpts in `KeywordSearchWorkbench`
- Layout Stability: Toggling state updates text nodes immediately without page re-renders, network requests, or layout shifts.
```

### 4.4. Sprint Tracking (`_bmad-output/implementation-artifacts/sprint-status.yaml`)
**Addition under `epic-2`:**
```yaml
  2-6-ui-profanity-masking-toggle-global-asterisk-obfuscation: backlog
```

---

## 5. Implementation Handoff

- **Classification:** Moderate Scope (Backlog addition + UI/UX enhancement).
- **Handoff Recipients:**
  - **Developer Agent (`bmad-agent-dev` / Amelia):** Complete Story 2.4 implementation, then Story 2.5, then pick up Story 2.6 using test-driven development (TDD unit tests for masking helper and toggle).
- **Success Criteria:**
  - Single-track Spotify inspections resolve lyrics via YouTube Music cross-referencing without errors.
  - UI profanity masking is active by default upon app boot.
  - Toggling mask/unmask in `ScreeningControlsBar` instantaneously flips all explicit tokens across chips, tables, modals, and search excerpts.
  - 100% test pass rate for all frontend and backend test suites.
