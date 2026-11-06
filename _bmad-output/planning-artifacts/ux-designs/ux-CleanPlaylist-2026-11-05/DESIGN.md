---
name: CleanPlaylist
description: Dedicated dark-mode studio design system (Obsidian Audio Core) for CleanPlaylist on React 19, Tailwind CSS v4, and lucide-react.
status: final
updated: 2026-11-05
colors:
  surface-inset: '#070D1F'
  surface-canvas: '#0C1324'
  surface-low: '#151B2D'
  surface-card: '#191F31'
  surface-elevated: '#23293C'
  surface-highest: '#2E3447'
  surface-backdrop: '#050812'
  border-subtle: '#2B3247'
  border-strong: '#4A4455'
  ring-focus: '#A78BFA'
  text-primary: '#DCE1FB'
  text-secondary: '#CCC3D8'
  text-muted: '#958DA1'
  brand-primary: '#7C3AED'
  brand-primary-hover: '#6D28D9'
  brand-accent: '#6366F1'
  brand-tint: '#D2BBFF'
  brand-foreground: '#FFFFFF'
  status-clean: '#4EDEA3'
  status-clean-bg: '#062E22'
  status-clean-border: '#10B981'
  status-clean-ink: '#022C1E'
  status-flagged: '#FFB4AB'
  status-flagged-bg: '#3B0A14'
  status-flagged-border: '#F43F5E'
  status-caution: '#FCD34D'
  status-caution-bg: '#332106'
  status-caution-border: '#F59E0B'
  keyword-mark-bg: '#422806'
  keyword-mark-fg: '#FDE68A'
typography:
  display:
    fontFamily: "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif"
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '40px'
    letterSpacing: -0.02em
  heading-lg:
    fontFamily: "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif"
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '32px'
    letterSpacing: -0.015em
  heading-md:
    fontFamily: "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif"
    fontSize: 18px
    fontWeight: '600'
    lineHeight: '26px'
    letterSpacing: -0.01em
  heading-sm:
    fontFamily: "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif"
    fontSize: 15px
    fontWeight: '600'
    lineHeight: '22px'
    letterSpacing: -0.005em
  body:
    fontFamily: "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif"
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '18px'
    letterSpacing: 0em
  body-sm:
    fontFamily: "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif"
    fontSize: 12px
    fontWeight: '400'
    lineHeight: '16px'
    letterSpacing: 0em
  badge:
    fontFamily: "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif"
    fontSize: 11px
    fontWeight: '700'
    lineHeight: '14px'
    letterSpacing: 0.06em
  mono:
    fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '16px'
    letterSpacing: 0.02em
  mono-sm:
    fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: 11px
    fontWeight: '400'
    lineHeight: '14px'
    letterSpacing: 0.03em
rounded:
  xs: 2px
  sm: 4px
  md: 8px
  lg: 12px
  xl: 16px
  full: 9999px
spacing:
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  '5': 20px
  '6': 24px
  '8': 32px
  page-max: 1280px
  modal-md: 512px
  modal-lg: 672px
  gutter-mobile: 16px
  gutter-desktop: 24px
  card-pad: 20px
  row-pad-y: 12px
  row-pad-x: 16px
  section-gap: 24px
  header-height: 56px
  touch-min: 44px
components:
  GlobalHeader:
    background: '{colors.surface-low}'
    border: '{colors.border-subtle}'
    activeTabInk: '{colors.brand-tint}'
    inactiveTabInk: '{colors.text-secondary}'
    height: '{spacing.header-height}'
  CatalogSelector:
    trackBackground: '{colors.surface-inset}'
    activeSegmentBackground: '{colors.surface-elevated}'
    activeSegmentInk: '{colors.text-primary}'
    inactiveSegmentInk: '{colors.text-muted}'
    border: '{colors.border-strong}'
    radius: '{rounded.full}'
  SmartInputBar:
    cardBackground: '{colors.surface-card}'
    fieldBackground: '{colors.surface-inset}'
    trayBackground: '{colors.surface-inset}'
    border: '{colors.border-strong}'
    focusRing: '{colors.ring-focus}'
    radius: '{rounded.md}'
    typography: '{typography.body}'
  PasteTrackListPanel:
    containerBackground: '{colors.surface-low}'
    textareaBackground: '{colors.surface-inset}'
    border: '{colors.border-strong}'
    counterInk: '{colors.text-muted}'
    radius: '{rounded.md}'
    typography: '{typography.mono}'
  SpotifyPlaylistHelper:
    background: '{colors.surface-low}'
    border: '{colors.brand-accent}'
    titleInk: '{colors.text-primary}'
    stepBackground: '{colors.surface-inset}'
    radius: '{rounded.lg}'
    typography: '{typography.body-sm}'
  ScreeningControlsBar:
    background: '{colors.surface-card}'
    border: '{colors.border-subtle}'
    activePresetBackground: '{colors.brand-primary}'
    activePresetInk: '{colors.brand-foreground}'
    chipBackground: '{colors.surface-elevated}'
    radius: '{rounded.md}'
  WorkingListWorkbench:
    background: '{colors.surface-card}'
    headerBackground: '{colors.surface-low}'
    rowHoverBackground: '{colors.surface-elevated}'
    flaggedRowTint: '{colors.status-flagged-bg}'
    divider: '{colors.border-subtle}'
    radius: '{rounded.md}'
  MobileTrackCard:
    background: '{colors.surface-card}'
    flaggedBackground: '{colors.status-flagged-bg}'
    flaggedBorder: '{colors.status-flagged-border}'
    snippetBackground: '{colors.surface-inset}'
    radius: '{rounded.md}'
    minTapHeight: '{spacing.touch-min}'
  VerificationStatusBadge:
    cleanInk: '{colors.status-clean}'
    cleanBackground: '{colors.status-clean-bg}'
    cleanBorder: '{colors.status-clean-border}'
    flaggedInk: '{colors.status-flagged}'
    flaggedBackground: '{colors.status-flagged-bg}'
    flaggedBorder: '{colors.status-flagged-border}'
    cautionInk: '{colors.status-caution}'
    cautionBackground: '{colors.status-caution-bg}'
    cautionBorder: '{colors.status-caution-border}'
    unscannedBackground: '{colors.surface-highest}'
    unscannedInk: '{colors.text-muted}'
    radius: '{rounded.full}'
    typography: '{typography.badge}'
  CleanReplacementControl:
    findBackground: '{colors.surface-elevated}'
    findInk: '{colors.text-primary}'
    swapBackground: '{colors.status-clean}'
    swapInk: '{colors.status-clean-ink}'
    swapOutlineBorder: '{colors.status-clean-border}'
    emptyInk: '{colors.text-muted}'
    radius: '{rounded.sm}'
  FinishLineBar:
    background: '{colors.surface-inset}'
    border: '{colors.border-subtle}'
    primaryButtonBackground: '{colors.brand-primary}'
    primaryButtonHover: '{colors.brand-primary-hover}'
    primaryButtonInk: '{colors.brand-foreground}'
    secondaryButtonBackground: '{colors.surface-elevated}'
    secondaryButtonInk: '{colors.text-primary}'
    radius: '{rounded.sm}'
  LyricsModal:
    backdrop: '{colors.surface-backdrop}'
    dialogBackground: '{colors.surface-card}'
    viewerBackground: '{colors.surface-inset}'
    gutterInk: '{colors.text-muted}'
    flaggedLineBackground: '{colors.status-flagged-bg}'
    flaggedLineBorder: '{colors.status-flagged-border}'
    radius: '{rounded.xl}'
    maxWidth: '{spacing.modal-lg}'
  KeywordSearchWorkbench:
    cardBackground: '{colors.surface-low}'
    excerptBackground: '{colors.surface-inset}'
    markBackground: '{colors.keyword-mark-bg}'
    markInk: '{colors.keyword-mark-fg}'
    chipBackground: '{colors.surface-elevated}'
    radius: '{rounded.lg}'
  StitchStudioWorkbench:
    poolBackground: '{colors.surface-low}'
    sourceCardBackground: '{colors.surface-card}'
    quotaFill: '{colors.brand-primary}'
    quotaTrack: '{colors.surface-highest}'
    primaryActionBackground: '{colors.brand-primary}'
    radius: '{rounded.md}'
  NoticeBanner:
    cautionBackground: '{colors.status-caution-bg}'
    cautionBorder: '{colors.status-caution-border}'
    cautionInk: '{colors.status-caution}'
    errorBackground: '{colors.status-flagged-bg}'
    errorBorder: '{colors.status-flagged-border}'
    errorInk: '{colors.status-flagged}'
    radius: '{rounded.md}'
    typography: '{typography.body-sm}'
  PlatformSwitchModal:
    backdrop: '{colors.surface-backdrop}'
    dialogBackground: '{colors.surface-card}'
    confirmBackground: '{colors.brand-primary}'
    confirmInk: '{colors.brand-foreground}'
    radius: '{rounded.xl}'
    maxWidth: '{spacing.modal-md}'
  PlaylistPickerModal:
    backdrop: '{colors.surface-backdrop}'
    dialogBackground: '{colors.surface-card}'
    searchBackground: '{colors.surface-inset}'
    rowHoverBackground: '{colors.surface-elevated}'
    radius: '{rounded.xl}'
    maxWidth: '{spacing.modal-lg}'
  SavePlaylistModal:
    backdrop: '{colors.surface-backdrop}'
    dialogBackground: '{colors.surface-card}'
    selectedCardBorder: '{colors.brand-primary}'
    selectedCardBackground: '{colors.surface-low}'
    primarySaveBackground: '{colors.brand-primary}'
    primarySaveInk: '{colors.brand-foreground}'
    radius: '{rounded.xl}'
    maxWidth: '{spacing.modal-md}'
---

# CleanPlaylist — Design Spine

## Brand & Style

CleanPlaylist adopts **Obsidian Audio Core**: a dedicated dark-mode audio workbench inspired by the editorial precision of Tidal and the dense catalog legibility of Spotify Web. Parents screening 1990s albums on a Friday night and teachers queueing classroom songs on shared hardware do not want a "parental control" cartoon or a split-personality UI that repaints green and purple on every catalog toggle. They want an authoritative, calm listening studio that surfaces lyric evidence in seconds and lets them make the call.

The visual posture is **one unified studio brand, semantic color discipline, high-density clarity**. Every interactive surface across `Scan & Clean`, `Keyword Search`, and **Stitch Studio** shares the same deep obsidian-slate hierarchy and electric-violet studio actions whether `spotify` or `ytmusic` is the **Active Platform**. Chromatic color never decorates chrome; when emerald, rose, or amber appears in a track list, it carries an immediate, unambiguous **Verification Status** verdict.

Visual composition references live in `mockups/`: desktop workbench ([01-scan-clean-desktop.html](mockups/01-scan-clean-desktop.html)), mobile parent-test view ([02-scan-clean-mobile.html](mockups/02-scan-clean-mobile.html)), lyric overlay ([03-lyrics-modal-desktop.html](mockups/03-lyrics-modal-desktop.html)), multi-source merger ([04-stitch-studio-desktop.html](mockups/04-stitch-studio-desktop.html)), keyword search ([05-keyword-search-desktop.html](mockups/05-keyword-search-desktop.html)), paste panel and Spotify helper ([06-paste-and-spotify-helper-desktop.html](mockups/06-paste-and-spotify-helper-desktop.html)), and **VIP Mode** modals ([07-vip-spotify-modals-desktop.html](mockups/07-vip-spotify-modals-desktop.html)). Spines win on conflict with any mockup.

## Colors

CleanPlaylist runs in dedicated dark mode only—no light-mode toggle—implemented with Tailwind CSS v4 (`@import "tailwindcss"` and `@theme` custom properties in `frontend/src/index.css`, no `tailwind.config.js`). Declaring every token in `@theme` exposes native utilities (`bg-surface-canvas`, `bg-surface-card`, `text-brand-tint`, `border-border-subtle`) without arbitrary hex brackets or undefined v3 shades.

### Tonal Slate Surface Ladder

- **Inset Well (`{colors.surface-inset}`, `#070D1F`)** — Deepest recessed layer for command inputs, the Instant Catalog Matches preview tray, `<textarea>` paste wells, the code-grade lyric viewer, and the translucent sticky `FinishLineBar`.
- **App Canvas (`{colors.surface-canvas}`, `#0C1324`)** — Primary `<body />` studio background anchoring the dark Slate palette.
- **Low Bar (`{colors.surface-low}`, `#151B2D`)** — Sticky `GlobalHeader`, **Stitch Studio** input pool containers, `PasteTrackListPanel` shell, and modal headers/footers.
- **Workbench Card (`{colors.surface-card}`, `#191F31`)** — Default elevated container for `SmartInputBar`, `ScreeningControlsBar`, `WorkingListWorkbench`, `MobileTrackCard`, and modal dialogs.
- **Elevated Control (`{colors.surface-elevated}`, `#23293C`)** — Secondary interactive buttons, active `CatalogSelector` pill, **Custom Blocklist** chips, and table row hover fills.
- **Highest Neutral (`{colors.surface-highest}`, `#2E3447`)** — Quota progress tracks, pre-scan `Unscanned` pills, keyboard shortcut hints (`Ctrl+V` / `Cmd+V`), and platform `[E]` metadata tags.
- **Modal Backdrop (`{colors.surface-backdrop}`, `#050812`)** — Applied at `80%` alpha with `backdrop-blur-md` behind overlays.

### Unified Studio Brand vs. Safety-Reserved Emerald

- **Electric Violet (`{colors.brand-primary}`, `#7C3AED`; hover `{colors.brand-primary-hover}`, `#6D28D9`)** and **Violet Tint (`{colors.brand-tint}`, `#D2BBFF`)** own all primary studio CTAs (`Copy Clean Track Links`, `Play Clean Queue`, `Stitch & Clean`, `Search Keywords Across Working List`, `Save to Spotify`), active **Sensitivity Preset** selection, and active tab underlines across *both* `spotify` and `ytmusic`. **Indigo (`{colors.brand-accent}`, `#6366F1`)** frames calm guidance surfaces such as `SpotifyPlaylistHelper`.
- **Safety-Reserved Emerald:** `{colors.status-clean}` (`#4EDEA3`), `{colors.status-clean-bg}` (`#062E22`), and `{colors.status-clean-border}` (`#10B981`) **never** appear on Spotify catalog toggles, `Save to Spotify` chrome, or generic CTAs. Emerald means one thing product-wide: *verified safe for playback* (`Verified Clean`, `Clean Swapped`, and `Swap to Clean`).
- **Rose Flagged (`{colors.status-flagged}`, `#FFB4AB` on `{colors.status-flagged-bg}`, `#3B0A14` with `{colors.status-flagged-border}`, `#F43F5E`)** marks `Flagged` badges, inline lyric profanity highlights, and destructive hover states.
- **Amber Caution (`{colors.status-caution}`, `#FCD34D` on `{colors.status-caution-bg}`, `#332106` with `{colors.status-caution-border}`, `#F59E0B`)** marks `Lyrics Unavailable` badges, 50-track truncation notices, unresolved **Pasted Track List** warnings, and HTTP `429` retry banners so missing lyrics or partial loads warn adults visibly without masquerading as clean (`NFR-3`). `{colors.keyword-mark-fg}` (`#FDE68A`) on `{colors.keyword-mark-bg}` (`#422806`) highlights neutral `Keyword Search` hits.

### Verified WCAG 2.2 AA Contrast Pairs

| Combination | Foreground | Background | Ratio | Target |
|---|---|---|---|---|
| Primary studio copy on canvas | `{colors.text-primary}` (`#DCE1FB`) | `{colors.surface-canvas}` (`#0C1324`) | `14.29:1` | `>= 4.5:1` (AAA) |
| Track titles on workbench cards | `{colors.text-primary}` (`#DCE1FB`) | `{colors.surface-card}` (`#191F31`) | `12.64:1` | `>= 4.5:1` (AAA) |
| Artist / album metadata on cards | `{colors.text-secondary}` (`#CCC3D8`) | `{colors.surface-card}` (`#191F31`) | `9.65:1` | `>= 4.5:1` (AAA) |
| Muted durations & line numbers | `{colors.text-muted}` (`#958DA1`) | `{colors.surface-card}` (`#191F31`) | `5.15:1` | `>= 4.5:1` (AA) |
| Primary violet CTA button label | `{colors.brand-foreground}` (`#FFFFFF`) | `{colors.brand-primary}` (`#7C3AED`) | `5.70:1` | `>= 4.5:1` (AA) |
| Active tab & brand tint on header | `{colors.brand-tint}` (`#D2BBFF`) | `{colors.surface-low}` (`#151B2D`) | `10.02:1` | `>= 4.5:1` (AAA) |
| `Verified Clean` / `Clean Swapped` pill | `{colors.status-clean}` (`#4EDEA3`) | `{colors.status-clean-bg}` (`#062E22`) | `8.65:1` | `>= 4.5:1` (AAA) |
| Solid `Swap to Clean` button label | `{colors.status-clean-ink}` (`#022C1E`) | `{colors.status-clean}` (`#4EDEA3`) | `8.90:1` | `>= 4.5:1` (AAA) |
| `Flagged` pill & lyric callout | `{colors.status-flagged}` (`#FFB4AB`) | `{colors.status-flagged-bg}` (`#3B0A14`) | `9.98:1` | `>= 4.5:1` (AAA) |
| `Lyrics Unavailable` & caution banner | `{colors.status-caution}` (`#FCD34D`) | `{colors.status-caution-bg}` (`#332106`) | `10.70:1` | `>= 4.5:1` (AAA) |
| `Keyword Search` `<mark>` token | `{colors.keyword-mark-fg}` (`#FDE68A`) | `{colors.keyword-mark-bg}` (`#422806`) | `10.97:1` | `>= 4.5:1` (AAA) |
| Keyboard focus ring on canvas | `{colors.ring-focus}` (`#A78BFA`) | `{colors.surface-canvas}` (`#0C1324`) | `6.80:1` | `>= 3.0:1` (AA) |

## Typography

CleanPlaylist pairs a geometric grotesk for fast catalog scanning with a developer monospace for lyric line evidence, track quotas, and durations. Load Google Fonts (`Plus Jakarta Sans` `400;500;600;700` and `JetBrains Mono` `400;500`) with system sans/monospace fallbacks so cold renders never block text.

- **`Plus Jakarta Sans`** carries `{typography.display}` through `{typography.badge}`. Dense studio tables default to `{typography.body}` (`13px / 18px`, `font-semibold` on track titles) with `{typography.body-sm}` (`12px / 16px`) for artist/album sublines so 10–12 rows fit comfortably above `FinishLineBar` on a laptop screen. `{typography.badge}` (`11px / 14px`, `700`, `0.06em` tracking) sets **Verification Status** pills and compact segmented labels.
- **`JetBrains Mono`** carries `{typography.mono}` (`12px / 16px`) and `{typography.mono-sm}` (`11px / 14px`) for **Pasted Track List** lines, quota counters (`28 / 50 tracks`, `38 / 50 Staged`), track durations (`3:31`), lyric gutter numbers (`L08`), flagged category counts (`strong_profanity: 4`), and desktop paste shortcut hints (`Ctrl+V` / `Cmd+V`).
- **Iconography:** Render stroke icons exclusively with `lucide-react` (`14px` inside pills, `16px`–`18px` inside buttons/tabs, `20px` in command inputs). Never load external icon webfonts.

## Layout & Spacing

Spacing follows a 4px studio grid (`{spacing.1}` through `{spacing.8}`). Desktop workbenches center inside `{spacing.page-max}` (`1280px`, `max-w-7xl`) with `{spacing.gutter-desktop}` (`24px`) horizontal padding and `{spacing.section-gap}` (`24px`) between stacked cards; mobile viewports (`>= 360px`) use `{spacing.gutter-mobile}` (`16px`) horizontal padding and `12px`–`16px` vertical card gaps.

- **Vertical Density Rule:** Chrome stays compact so track evidence dominates the viewport. `GlobalHeader` occupies `{spacing.header-height}` (`56px`) on desktop and a tight two-row sticky header below `768px`. Desktop track rows use `{spacing.row-pad-y}` (`12px`) by `{spacing.row-pad-x}` (`16px`) (`48px`–`56px` row height) with `40x40px` cover art (`36x36px` in search preview trays).
- **Sticky Footer Clearance:** Scrollable page containers reserve `96px` (`pb-24`) bottom padding on desktop and `136px` on mobile so the docked `FinishLineBar` never occludes the final row's actions.
- **360px Floor Integrity:** Every pill cluster (**Sensitivity Preset** options, status filter tabs, **Custom Blocklist** chips) wraps (`flex-wrap`) or scrolls locally with zero horizontal page overflow down to `360px`, keeping `{spacing.touch-min}` (`44px`) minimum tap height on mobile controls.

## Elevation & Depth

Hierarchy comes from **tonal surface steps and 1px hairline borders**, not neon glows or stacked drop shadows.

- **Tonal Wells Inside Cards:** Placing `{colors.surface-inset}` inside `{colors.surface-card}` creates recessed depth for search inputs, `PasteTrackListPanel`, and `LyricsModal` lyric panes without inner shadows.
- **Hairline Structural Borders:** Containers separate from `{colors.surface-canvas}` with `1px solid {colors.border-subtle}`; interactive inputs use `{colors.border-strong}` and illuminate with a `2px` `{colors.ring-focus}` outline on `:focus-visible`.
- **Glass Sticky Chrome & Modals:** `GlobalHeader` and `FinishLineBar` apply `95%` surface opacity with `backdrop-blur-md` and a `1px` `{colors.border-subtle}` edge. Modals (`LyricsModal`, `PlatformSwitchModal`, `PlaylistPickerModal`, `SavePlaylistModal`) stack strictly **one level deep** over `{colors.surface-backdrop}` (`80%` alpha + `backdrop-blur-md`) with `shadow-2xl` and a `1px` subtle light ring.

## Shapes

Corner geometry signals functional hierarchy—taut and tool-like on interactive controls, rounded on containers, and true pills strictly for semantic tags and toggles:

- **`{rounded.xs}` (`2px`):** Inline micro-tags (`[E]` platform explicit badge, `VIP` header badge, keyboard keycaps, inline flagged lyric word highlights).
- **`{rounded.sm}` (`4px`):** Command inputs, compact buttons (`Swap to Clean`, `Open Clean Track`), and `36x36` / `40x40` album cover thumbnails.
- **`{rounded.md}` (`8px`):** Primary workbench cards (`SmartInputBar`, `ScreeningControlsBar`, `WorkingListWorkbench`, `MobileTrackCard`, `NoticeBanner`).
- **`{rounded.lg}` (`12px`):** Multi-column guidance cards (`SpotifyPlaylistHelper`, `KeywordSearchWorkbench` containers).
- **`{rounded.xl}` (`16px`):** Modal dialog shells (`LyricsModal`, `PlatformSwitchModal`, `PlaylistPickerModal`, `SavePlaylistModal`).
- **`{rounded.full}` (`9999px`):** `VerificationStatusBadge`, `CatalogSelector` pill track, **Sensitivity Preset** pills, and **Custom Blocklist** / keyword chips.

## Components

Every component below maps 1-to-1 verbatim to `components` in frontmatter and `## Component Patterns` in `EXPERIENCE.md`.

| Component | Visual Anatomy & Token Bindings | Visual States |
|---|---|---|
| `GlobalHeader` | Sticky top bar (`{colors.surface-low}`, bottom border `{colors.border-subtle}`). Left: `AudioLines` icon (`{colors.brand-tint}`) + `CleanPlaylist` wordmark (`{typography.heading-md}`). Center: strictly 3 tabs (`Scan & Clean`, `Keyword Search`, `Stitch Studio`) with `lucide-react` icons + visible labels ([01-scan-clean-desktop.html](mockups/01-scan-clean-desktop.html), [02-scan-clean-mobile.html](mockups/02-scan-clean-mobile.html)). Right: `CatalogSelector` + conditional **VIP Mode** cluster ([07-vip-spotify-modals-desktop.html](mockups/07-vip-spotify-modals-desktop.html)). | **Active tab:** `{colors.brand-tint}` ink + `2px` bottom bar `{colors.brand-primary}`.<br>**Inactive tab:** `{colors.text-secondary}`, hover `{colors.text-primary}`.<br>**VIP Mode (`?vip=1`):** Renders `{rounded.xs}` `VIP` badge (`{colors.surface-highest}`), `Connect Spotify` (`{colors.brand-primary}`) or `Spotify Connected` pill, and muted `Exit VIP Mode` ghost button. |
| `CatalogSelector` | `{rounded.full}` segmented control (`{colors.surface-inset}` track, `1px` `{colors.border-strong}`) labeled `Catalog:` (`{typography.mono-sm}`, `{colors.text-muted}`) with `Spotify` and `YouTube Music` segments. | **Selected segment:** `{colors.surface-elevated}` fill, `{colors.text-primary}` bold label, `6px` `{colors.brand-tint}` indicator dot (never `#1ED760` Spotify green).<br>**Unselected:** `{colors.text-muted}`, hover `{colors.text-secondary}`. |
| `SmartInputBar` | `{colors.surface-card}` card (`{rounded.md}`, `{spacing.card-pad}`) with full-width `{colors.surface-inset}` input (`Search` icon, `{typography.body}`, `Clear` `X` button) + adjacent `Paste Track List` button (`{colors.surface-elevated}`), paired with a recessed `{colors.surface-inset}` 2-column Instant Catalog Matches tray (Songs + Albums, `36x36` `{rounded.sm}` art) and sample chips ([01-scan-clean-desktop.html](mockups/01-scan-clean-desktop.html)). | **Focused:** `2px` `{colors.ring-focus}` ring.<br>**Loading matches:** Spinner in right input slot.<br>**Paste panel open:** `Paste Track List` pressed in `{colors.brand-primary}` tint. |
| `PasteTrackListPanel` | Expandable `{colors.surface-low}` panel (`{rounded.md}`, border `{colors.border-strong}`) with header, helper subline, `{typography.mono}` `N / 50 lines` counter pill (`{colors.surface-highest}`), `{colors.surface-inset}` `<textarea>` (`{typography.mono}`), optional amber cross-catalog `NoticeBanner`, and footer (`Cancel` + `{colors.brand-primary}` `Resolve & Add`) ([06-paste-and-spotify-helper-desktop.html](mockups/06-paste-and-spotify-helper-desktop.html)). | **Over 50 lines:** Counter pill turns `{colors.status-caution}` on `{colors.status-caution-bg}` with truncation warning.<br>**Resolving:** Primary CTA shows spinner + `Resolving…` disabled state. |
| `SpotifyPlaylistHelper` | `{colors.surface-low}` guidance card (`{rounded.lg}`, `1px` `{colors.brand-accent}` border—never error red) with headline, `Search Albums Instead` + `Focus Paste Box` buttons (`{colors.surface-elevated}`), and 3-column `{colors.surface-inset}` step strip showing Spotify Desktop `Ctrl+A` / `Cmd+A` → `Ctrl+C` / `Cmd+C` → paste ([06-paste-and-spotify-helper-desktop.html](mockups/06-paste-and-spotify-helper-desktop.html)). | **Default:** Calm studio-indigo border.<br>**Dismissed / Cleared:** Collapses when input changes or clears. |
| `ScreeningControlsBar` | `{colors.surface-card}` bar (`{rounded.md}`, `16px` pad, `flex-wrap`) with three zones: left **Sensitivity Preset** `{rounded.full}` pills (`Kid Safe`, `Moderate`, `Slurs Only`, `Custom`); center **Custom Blocklist** inline input + removable `{rounded.full}` word chips (`{colors.surface-elevated}`); right `{typography.mono-sm}` `Scanned X of Y` progress meter + `Find & Swap All Clean Versions` button ([01-scan-clean-desktop.html](mockups/01-scan-clean-desktop.html)). | **Active preset:** `{colors.brand-primary}` fill, `{colors.brand-foreground}` ink.<br>**Scanning / Swapping:** Progress bar animates in `{colors.brand-primary}`; bulk swap button shows progress count (`Finding clean edits (X of Y)…`). |
| `WorkingListWorkbench` | `{colors.surface-card}` container (`{rounded.md}`) with `{colors.surface-low}` header strip (`Working List`, `{typography.mono}` `N / 50 tracks` pill, 5 status filter pills, inline filter input, `Clear List` ghost action, and **VIP Mode** `Browse Library` button) above a dense 6-column table (`#`, `Title & Artist` with `40x40` `{rounded.sm}` cover, `Album`, `{typography.mono-sm}` `Duration`, `Verification Status` + flagged category chips/snippet, right-aligned `Actions`) ([01-scan-clean-desktop.html](mockups/01-scan-clean-desktop.html)). | **Clean / Swapped row:** Standard `{colors.surface-card}` background, hover `{colors.surface-elevated}`.<br>**Flagged row:** Subtle `{colors.status-flagged-bg}` (`15%` tint) row wash + inline category count pills.<br>**Empty:** Centered studio empty state with quick-try sample chips. |
| `MobileTrackCard` | Stacked `{colors.surface-card}` card (`{rounded.md}`, `12px` pad) on `< 768px` viewports replacing table columns ([02-scan-clean-mobile.html](mockups/02-scan-clean-mobile.html)). Top row: `40x40` cover, title/artist, `{typography.mono-sm}` duration, `VerificationStatusBadge`. Touch buttons enforce `{spacing.touch-min}` (`44px`) height. | **Clean / Swapped card:** Compact layout with single `{colors.surface-elevated}` `Open Clean Track` action + `Trash2` remove icon.<br>**Flagged card:** `1px` `{colors.status-flagged-border}` accent, category chips, `{colors.surface-inset}` lyric snippet box, `CleanReplacementControl`, and side-by-side `44px` `View Lyrics` + `Remove` buttons. |
| `VerificationStatusBadge` | `{rounded.full}` pill (`{typography.badge}`, `px-2.5 py-1`) pairing a `14px` `lucide-react` icon with verbatim label text—never color alone. Accompanied by `{rounded.xs}` `[E]` tag (`{colors.surface-highest}`, `{colors.text-secondary}`) when platform `is_explicit` is true. | **`Unscanned` / `Scanning…`:** `{colors.surface-highest}` fill, `{colors.text-muted}` ink, `Clock` / `Loader2` icon.<br>**`Verified Clean`:** `{colors.status-clean-bg}` fill, `{colors.status-clean-border}` border, `{colors.status-clean}` ink + `CheckCircle2`.<br>**`Clean Swapped`:** Same emerald tokens + `ArrowLeftRight` icon.<br>**`Flagged`:** `{colors.status-flagged-bg}` fill, `{colors.status-flagged-border}` border, `{colors.status-flagged}` ink + `AlertTriangle`.<br>**`Lyrics Unavailable`:** `{colors.status-caution-bg}` fill, `{colors.status-caution-border}` border, `{colors.status-caution}` ink + `FileQuestion` (never indigo or emerald). |
| `CleanReplacementControl` | Inline per-row and in-modal replacement affordance (`{rounded.sm}`, `{typography.body-sm}` `font-semibold`). | **Initial (`Flagged`):** `{colors.surface-elevated}` `Find Clean Edit` button (`Sparkles` / `Search` icon).<br>**Searching:** Disabled spinner `Searching…`.<br>**Candidate ready:** Emerald `{colors.status-clean}` solid fill + `{colors.status-clean-ink}` label (`Swap to Clean` in modal/mobile) or `{colors.status-clean-bg}` + `{colors.status-clean-border}` outline in dense table rows.<br>**No match:** Italic `{colors.text-muted}` `"No clean version found"` next to 1-click `Remove`. |
| `FinishLineBar` | Sticky bottom dock (`{colors.surface-inset}` at `95%` alpha + `backdrop-blur-md`, top border `{colors.border-subtle}`). Left: live ready/flagged summary (`{typography.body-sm}`). Right: primary studio CTA (`{colors.brand-primary}`, `{colors.brand-foreground}`), secondary `{colors.surface-elevated}` actions, and `Export ▾` popover (`.csv`, `.m3u8`, `.json`) ([01-scan-clean-desktop.html](mockups/01-scan-clean-desktop.html), [02-scan-clean-mobile.html](mockups/02-scan-clean-mobile.html), [04-stitch-studio-desktop.html](mockups/04-stitch-studio-desktop.html)). | **Desktop `Scan & Clean`:** Primary `Copy Clean Track Links` stacked over `{typography.mono-sm}` `Ctrl+V` / `Cmd+V` paste hint; secondary `Play Clean Queue` + `Export ▾` (+ `Save to Spotify` in **VIP Mode**).<br>**Mobile `Scan & Clean` & `Stitch Studio`:** Primary `Play Clean Queue`; secondary `Copy Clean Track Links` + `Export ▾`.<br>**VIP `>50` Queue:** Sequential `{colors.brand-primary}` / `{colors.surface-elevated}` batch buttons (`Queue 1–50`, `Queue 51–N`). |
| `LyricsModal` | Centered `{spacing.modal-lg}` (`672px`) `{colors.surface-card}` dialog (`{rounded.xl}`) over `{colors.surface-backdrop}` ([03-lyrics-modal-desktop.html](mockups/03-lyrics-modal-desktop.html)). Header: `56x56` cover, title + external **Clean Track Link**, artist/album/duration, `VerificationStatusBadge` + category chips, `X` close. Optional emerald **Clean Replacement** banner (`{colors.status-clean-bg}`, `{colors.status-clean-border}`). Body: `{colors.surface-inset}` scrollable viewer with `Flag X of Y ↑ ↓` jumper, `{typography.mono-sm}` right-aligned line gutter (`L01`–`Lnn`), `2px` `{colors.status-flagged-border}` left callout + `{colors.status-flagged-bg}` line tint, and `{rounded.xs}` highlighted profanity tokens. Footer: **Lyric Cross-Reference** attribution + `Keep Flagged Track` + `Close`. | **Loading:** Skeleton lines inside `{colors.surface-inset}` viewer.<br>**Lyrics Unavailable / Error:** `{colors.status-caution}` notice explaining no lyric match was found alongside explicit metadata status. |
| `KeywordSearchWorkbench` | Two stacked `{colors.surface-low}` cards (`{rounded.lg}`, `24px` pad) ([05-keyword-search-desktop.html](mockups/05-keyword-search-desktop.html)). Top card: context subline, `{colors.surface-inset}` keyword input + `+ Add Keyword`, removable `{colors.surface-elevated}` `{rounded.full}` chips, and `{colors.brand-primary}` `Search Keywords Across Working List` CTA. Results card: summary header, per-keyword filter pills, matched track rows with hit-count pills (`money: 6x`), and indented `{colors.surface-inset}` collapsible line excerpts with `[Lnn]` `{typography.mono-sm}` numbers and `{colors.keyword-mark-bg}` / `{colors.keyword-mark-fg}` `<mark>` pills. | **Empty Working List:** Centered prompt with 1-click button routing back to `Scan & Clean`.<br>**Zero matches:** Calm studio card confirming `0 of N tracks` matched the target keywords. |
| `StitchStudioWorkbench` | Multi-source merger layout ([04-stitch-studio-desktop.html](mockups/04-stitch-studio-desktop.html)): top header with `Combined Track Quota: N / 50 Staged` progress card (`{colors.brand-primary}` fill over `{colors.surface-highest}`); `{colors.surface-low}` Multi-Source Input Pool card with URL/album/paste/`Add Current Working List` triggers and 2-column `{colors.surface-card}` source cards; horizontal Batch Clean & Merge Rules bar (4 selects + editable playlist title + `{colors.brand-primary}` `Stitch & Clean`); and Stitched Clean Queue output card with metric pills, `FinishLineBar` actions, and merged rows displaying `{rounded.xs}` source-origin badges. | **Over 50 staged (public):** Quota bar shifts to `{colors.status-caution-border}` with inline truncation `NoticeBanner`.<br>**Unresolved paste lines:** Renders dismissible amber `NoticeBanner` above merged output without blocking valid tracks. |
| `NoticeBanner` | Compact `{rounded.md}` inline banner (`12px 16px` pad, `1px` border) with leading `18px` `lucide-react` icon, concise message + inline chips if applicable, and optional action button (`Retry`, `Switch Platform`, `Exit VIP Mode`) + `X` dismiss button. | **Caution / Info-Warning (truncation, unresolved typos, cross-platform URL, deduplication, omitted queue tracks):** `{colors.status-caution-bg}` fill, `{colors.status-caution-border}` border, `{colors.status-caution}` ink.<br>**Rate Limit (`HTTP 429`):** Caution tokens + prominent `{colors.surface-elevated}` `Retry` button.<br>**VIP OAuth Blocked:** `{colors.status-flagged-bg}` fill, `{colors.status-flagged-border}` border, `{colors.status-flagged}` ink + `Exit VIP Mode` button. |
| `PlatformSwitchModal` | Compact `{spacing.modal-md}` (`512px`) `{colors.surface-card}` confirmation dialog (`{rounded.xl}`) over `{colors.surface-backdrop}` with `AlertTriangle` header icon (`{colors.status-caution}`), clear state-reset explanation, `Cancel` (`{colors.surface-elevated}`), and `Switch & Clear List` (`{colors.brand-primary}`). | **Open:** Focus-trapped on `Cancel` or `Switch & Clear List`. |
| `PlaylistPickerModal` | `{spacing.modal-lg}` (`672px`) **VIP Mode** dialog (`{colors.surface-card}`, `{rounded.xl}`) ([07-vip-spotify-modals-desktop.html](mockups/07-vip-spotify-modals-desktop.html)) with header + `X`, `{colors.surface-inset}` filter input, scrollable playlist rows (`44x44` `{rounded.sm}` cover image with `Music` fallback icon, title, owner, `{typography.mono-sm}` track count, `{colors.brand-primary}` / `{colors.surface-elevated}` `Load` button), and `{colors.surface-low}` pagination footer (`Showing X–Y of Z` + `Previous` / `Next`). | **Loading page:** Skeleton playlist rows.<br>**Empty filter:** Muted `"No matching playlists"` state. |
| `SavePlaylistModal` | `{spacing.modal-md}` (`512px`) **VIP Mode** dialog (`{colors.surface-card}`, `{rounded.xl}`) ([07-vip-spotify-modals-desktop.html](mockups/07-vip-spotify-modals-desktop.html)) with two selectable radio cards (`Create New Clean Playlist` with nested `{colors.surface-inset}` title input + `Private Playlist` toggle; `Update Original Playlist` with `{colors.status-flagged}` destructive overwrite badge), `{colors.status-clean-bg}` track-count verification summary, and footer (`Cancel` + `{colors.brand-primary}` `Save to Spotify` CTA—never `#1ED760` green). | **Selected card:** `2px` `{colors.brand-primary}` border on `{colors.surface-low}`.<br>**Saved:** `Save to Spotify` shows `CheckCircle2` `"Saved Successfully!"` confirmation state. |

## Do's and Don'ts

| Do | Don't |
|---|---|
| Keep primary studio CTAs (`Copy Clean Track Links`, `Play Clean Queue`, `Stitch & Clean`, `Save to Spotify`) in unified `{colors.brand-primary}` across both `spotify` and `ytmusic`. | Flip app chrome between green and purple on platform change, or paint `CatalogSelector` / `Save to Spotify` in `#1ED760` Spotify green. |
| Reserve `{colors.status-clean}` and `{colors.status-clean-border}` exclusively for `Verified Clean`, `Clean Swapped`, and `Swap to Clean`. | Color `Lyrics Unavailable` in emerald or indigo, or color `Clean Swapped` in violet—`Lyrics Unavailable` always uses amber `{colors.status-caution}`. |
| Render strictly 3 global navigation tabs (`Scan & Clean`, `Keyword Search`, `Stitch Studio`) and hide OAuth controls unless **VIP Mode** (`?vip=1`) is active. | Include Stitch AI-hallucinated shell chrome (notification bells, settings gears, help icons, `⌘K` search bars, user avatars, left sidebars, or `"Read-Only Mode"` / public `"Login"` buttons). |
| Show honest deterministic data: plain-text line numbers (`L01`–`Lnn`), exact matched words/counts, and real track durations. | Display fabricated broadcast/AI telemetry (`320 kbps`, `Latency: 14ms`, `FCC Standard Section 14.2`, `Confidence: 99.4%`, `Phonetic stemming`, or fake `01:22` LRC timecodes). |
| Route all listening through external **Clean Track Links** (`Open Clean Track`) and YouTube **Clean Queue** (`Play Clean Queue`). | Render deferred inline audio transport bars, waveform scrubbers, row-hover play buttons, or `Share Link` (`#list=...`) buttons. |
| Define all custom palette tokens in Tailwind CSS v4 `@theme` inside `frontend/src/index.css`, use `rounded-full` (`9999px`) for pills, and render icons exclusively with `lucide-react`. | Use undefined Tailwind v3 classes (such as `bg-slate-850`), load Google `Material Symbols` webfonts, or override `rounded-full` to `12px`. |
