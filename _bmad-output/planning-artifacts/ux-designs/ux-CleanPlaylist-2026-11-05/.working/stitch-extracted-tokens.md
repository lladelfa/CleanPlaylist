# CleanPlaylist — Google Stitch Extracted Design System & Screen Tokens

- **Stitch Project:** `projects/17521564154222297091` (`https://stitch.withgoogle.com/projects/17521564154222297091`)
- **Design System ID:** `assets/2525869ccd694176b1609ffa813710fd`
- **Design System Name:** **Obsidian Audio Core** (`colorMode: DARK`, `colorVariant: FIDELITY`, `roundness: ROUND_FOUR`, `spacingScale: 2`)
- **Override Anchor Colors:**
  - `overrideNeutralColor`: `#020617` (Slate 950 studio baseline)
  - `overridePrimaryColor`: `#7c3aed` (Electric Violet — primary studio CTA / selection)
  - `overrideSecondaryColor`: `#6366f1` (Indigo — secondary studio velocity / hover)
  - `overrideTertiaryColor`: `#10b981` (Emerald — reserved strictly for safety verification states)

---

## 1. Color Palette Tokens (Stitch Material-Tonal + Studio Slate Mapping)

### Surface & Elevation Hierarchy
| Token | Hex | Role Across Stitch Screens |
|---|---|---|
| `surface-container-lowest` | `#070d1f` | Deepest recessed wells: search inputs, inline catalog match tray, code-grade lyric viewer pane, sticky finish-line bar (`bg-surface-container-lowest/95`), scrollbar track |
| `background` / `surface` / `surface-dim` | `#0c1324` | Primary app shell canvas (`<body class="bg-surface">` / `bg-background`) |
| `surface-container-low` | `#151b2d` | Sticky top global header (`bg-surface-container-low`), Stitch Studio input pool cards, modal header/footer bars |
| `surface-container` | `#191f31` | Elevated workbench cards (`Smart Input Bar Card`, `Screening Controls Bar`, `LyricsModal` dialog container, export popover) |
| `surface-container-high` | `#23293c` | Secondary interactive buttons (`Paste Track List`, `Add Album`, `Open Clean Track`), active catalog toggle segment, blocklist word chips, row hover (`hover:bg-surface-container-high/40`) |
| `surface-container-highest` / `surface-variant` | `#2e3447` | Subtle badges (`STUDIO`, `⌘K`, `⌘V`, explicit `E` tag), quota progress track, scrollbar thumb |
| `surface-bright` | `#33394c` | Hover illumination state on secondary buttons (`hover:bg-surface-bright`) |
| Modal Backdrop | `#050812` @ 80% | `bg-[#050812]/80 backdrop-blur-md` over dimmed workbench (`blur-[5px] brightness-[0.38]`) |

### Brand, Text, Outline & Semantic Safety Tokens
| Token | Hex | Role & Strict Usage Rule |
|---|---|---|
| `primary-container` | `#7c3aed` | Solid primary studio CTAs (`Copy Clean Track Links`, `Add Song`, active `Moderate` preset pill, `+ Add Playlist URL`, `Stitch & Clean`), focus ring (`focus:ring-primary-container`) |
| `inverse-primary` | `#732ee4` | Primary CTA hover fill (`hover:bg-inverse-primary`) |
| `primary` / `primary-fixed-dim` | `#d2bbff` | Active tab text & bottom indicator (`border-b-2 border-primary text-primary`), brand glyph, active catalog label, high-contrast violet accents on dark surfaces |
| `on-primary-container` | `#ede0ff` | Crisp light text/icons inside `#7c3aed` `primary-container` buttons |
| `secondary` / `secondary-container` | `#c0c1ff` / `#3131c0` | Secondary category tags (`substances: 2`), external track links, and `Lyrics Unavailable` neutral-indigo caution pills (`bg-secondary-container/20 border-secondary/30 text-secondary`) |
| `tertiary` / `tertiary-fixed-dim` | `#4edea3` | **Strictly Safety-Reserved Emerald**: `Verified Clean` & `Clean Swapped` badge text/icons, live catalog match pulse dot, and `Swap to Clean` solid modal CTA (`bg-tertiary text-on-tertiary-fixed`) |
| `tertiary-container` | `#007650` | Translucent emerald safety pill fill (`bg-tertiary-container/20` or `/30` with `border-tertiary/40`) |
| `on-tertiary-fixed` | `#002113` | High-contrast dark ink on solid emerald `Swap to Clean` button |
| `error` / `error-container` | `#ffb4ab` / `#93000a` | `Flagged` badge (`bg-error-container/30 border-error/40 text-error`), flagged row tint (`bg-error-container/5`), inline lyric profanity token highlight (`bg-error-container text-error border-error/50`), trash hover (`hover:text-error`) |
| Amber / Red Platform Accents | `#f59e0b` / `#ef4444` | Dismissible unresolved student paste warning banner (`amber` border/fill in Screen 4) and YouTube Music source icon (`text-red-500` / `bg-red-950/50 text-red-400`) |
| `on-surface` / `on-background` | `#dce1fb` | Primary high-contrast studio text (titles, headers, lyric lines) |
| `on-surface-variant` | `#ccc3d8` | Secondary metadata text (artist names, albums, inactive nav tabs) |
| `outline` | `#958da1` | Muted telemetry text, monospace durations (`4:12`), line numbers (`L08`), input placeholders |
| `outline-variant` | `#4a4455` | Hairline 1px structural borders at 20%–50% alpha (`border-outline-variant/30`, `divide-outline-variant/20`) |

---

## 2. Typography Scale

- **Display / UI Sans:** `Plus Jakarta Sans` (weights `400`, `500`, `600`, `700`, `800`)
- **Telemetry / Timestamps / Badges Mono:** `JetBrains Mono` (weights `400`, `500`, `600`)
- **Iconography:** Sharp stroke icons (`14px` micro-badge icons, `18px` nav/button icons, `20px` input/header icons)

| Token | Font Family | Size / Line-Height | Weight | Tracking | Usage |
|---|---|---|---|---|---|
| `headline-xl` | Plus Jakarta Sans | `32px / 40px` | `700` | `-0.02em` | Hero / top-level display anchors |
| `headline-xl-mobile` | Plus Jakarta Sans | `24px / 32px` | `700` | `-0.015em` | Mobile primary view title |
| `headline-lg` | Plus Jakarta Sans | `24px / 32px` | `600` | `-0.015em` | Page section titles (`Stitch Studio`, `Working List`) |
| `headline-md` | Plus Jakarta Sans | `18px / 26px` | `600` | `-0.01em` | Wordmark (`CleanPlaylist`), card headers, modal track title |
| `body-lg` | Plus Jakarta Sans | `15px / 22px` | `500` | `-0.005em` | Prominent control labels |
| `body-md` | Plus Jakarta Sans | `13px / 18px` | `400` | `0em` | Dense studio base text, inputs, track titles (`font-semibold`), lyric lines |
| `body-sm` | Plus Jakarta Sans | `12px / 16px` | `400` | `0em` | Artist/album sublines, secondary buttons, snippet previews |
| `label-sans-bold` | Plus Jakarta Sans | `11px / 14px` | `700` | `0.06em` | Safety status pills (`Verified Clean`, `Clean Swapped`), segmented toggles, compact CTAs |
| `label-mono-md` | JetBrains Mono | `12px / 16px` | `500` | `0.02em` | Quota counters (`38 / 50 Staged`), active timecodes |
| `label-mono-sm` | JetBrains Mono | `11px / 14px` | `400` | `0.03em` | Track durations (`4:12`), table headers, lyric line numbers (`L08`–`L17`), category counts (`strong_profanity: 4`), keyboard hints (`⌘V`) |

---

## 3. Radii, Spacing, Borders & Elevation

### Corner Radius Strategy (Disciplined Studio Geometry)
- **Tailwind Config Custom Map (in generated HTML):**
  - `rounded` (`DEFAULT`): `0.125rem` (`2px`) — micro tags (`CLEAN`, `EXPLICIT`, `E`, `STUDIO`, keyboard hints)
  - `rounded-lg`: `0.25rem` (`4px`) — inputs, compact buttons, album art thumbnails (`36x36` / `40x40`), inline search match rows
  - `rounded-xl`: `0.5rem` (`8px`) — primary workbench cards (`Smart Input`, `Screening Controls`, `Working List`, `Multi-Source Input Pool`, `Lyric Viewer`)
  - `rounded-2xl`: `1rem` (`16px`) — elevated `LyricsModal` dialog shell
  - Pill geometry (`9999px` / `rounded-full` in standard Tailwind; note Stitch's custom config overrode `full` to `0.75rem` in `<script id="tailwind-config">`, so true pills in React/Tailwind v4 should keep standard `rounded-full: 9999px` for status badges and preset pills)

### Spacing Rhythm
- `space-xs`: `0.25rem` (`4px`) — tight metadata pairs
- `space-sm`: `0.5rem` (`8px`) — chip clusters & icon-label gaps
- `space-md`: `0.75rem` (`12px`) — compact card/toolbar rhythm
- `space-lg`: `1.25rem` (`20px`) — card padding (`p-5`) & nav tab spacing
- `space-xl`: `2rem` (`32px`) — major section separation
- `margin` / `margin-desktop`: `1rem` (`16px`) mobile / `1.5rem` (`24px`) desktop horizontal shell padding
- **Dense Track Row Height:** `py-3 px-4` (~`48px`–`56px` row height) with `40x40` (`w-10 h-10`) album thumbnail on desktop, `36x36` (`w-9 h-9`) in search tray.

### Shadows, Hairlines & Glass Layers
- **Tonal Layering > Heavy Glows:** Cards rely on 1px hairline borders (`border border-outline-variant/30`) separating `#191f31` / `#151b2d` cards from `#070d1f` / `#0c1324` canvas.
- **Sticky Chrome Glass:** Top `h-14` header and bottom Finish-Line bar use `bg-surface-container-lowest/95` or `bg-surface-container-low` + `backdrop-blur-md` + `border-b` / `border-t border-outline-variant/30` + `shadow-2xl`.
- **Primary Button Depth:** `shadow-lg shadow-primary-container/20` with `active:scale-[0.98]`.
- **Modal Elevation:** `shadow-2xl shadow-black/90 ring-1 ring-white/10` over `bg-[#050812]/80 backdrop-blur-md`.

---

## 4. Per-Screen Layout & Component Structures

### Screen 1 — Desktop `Scan & Clean` Workbench (`01-scan-clean-desktop.html`, `1c7980b622084f36a10b2437db81da62`)
1. **Sticky Global Top Bar (`h-14`, `sticky top-0 z-50`):** Left `CleanPlaylist STUDIO` wordmark + `graphic_eq` mark; center 3-tab nav (`Scan & Clean` active with `border-b-2 border-primary text-primary`, `Keyword Search`, `Stitch Studio`); right `Catalog: [Spotify | YouTube Music]` segmented pill with live pulse dot on selected catalog.
2. **Unified Smart Input Card (`max-w-7xl` container, `p-5 rounded-xl`):** Full-width command input with embedded `"Matching Spotify Catalog"` live status pill + adjacent `"Paste Track List"` secondary button; nested `bg-surface-container-lowest` `"Instant Catalog Matches"` 2-column grid showing Song (`+ Add Song`) and Album (`+ Add Album`) results.
3. **Screening Controls Bar (`p-4 rounded-xl flex-wrap justify-between`):** Left `Sensitivity Preset` pill group (`Kid Safe`, `Moderate` active in `bg-primary-container`, `Slurs Only`, `Custom`); center removable `Custom Blocklist` chips + `+ Add term`; right scan progress (`Scanned 28 of 28`) + `"Find & Swap All Clean Versions"` studio action.
4. **Working List Workbench Card (`mb-24` clearance for fixed footer):** Header with `Working List` + `28 / 50 tracks` badge, 5 status filter tabs (`All 28`, `Flagged 4`, `Verified Clean 14`, `Clean Swapped 9`, `Lyrics Unavailable 1`), inline filter input, and `Clear List`. Dense 6-column table (`#` with hover play glyph, `Title & Artist` + `40x40` cover, `Album`, mono `Duration`, `Safety Status` pill + category chips/snippet on flagged rows, right-aligned `Actions` with emerald `Swap to Clean` outline button on flagged rows).
5. **Fixed Desktop Finish-Line Footer (`fixed bottom-0 z-50`):** Left status summary (`23 clean tracks ready • 5 need review`); right action cluster (`Play Clean Queue`, `Export ▾` hover popover for `.m3u8`/`.csv`/`.json`, and primary `Copy Clean Track Links (23)` stacked above `10px` mono paste helper microcopy).

### Screen 2 — Mobile `Scan & Clean` Parent-Test View (`02-scan-clean-mobile.html`, `047d353aa59b45efbdfb454c806466ca`)
1. **Constrained `390px` Touch Shell:** Two-tier sticky mobile header — top row with compact `CleanPlaylist` mark + `Spotify | YT Music` pill; second row segmented 3-tab bar (`Scan & Clean`, `Keywords`, `Stitch Studio`) with icons and visible labels.
2. **Smart Input & Telemetry Strip:** Single-line search/paste input with right paste icon button, paired below with `Sensitivity: Kid Safe` badge and `Working List • 4 / 50 tracks (3 Clean • 1 Flagged)` counter.
3. **Stacked Mobile Track Cards:** Touch-friendly cards replacing desktop columns; clean/swapped cards expose one clear `Open Clean Track` action, while the expanded `Flagged` card surfaces category chips (`sexual (2)`, `mild_profanity (1)`), a bordered lyric snippet preview box, `"No clean radio version found"` note, and side-by-side 44px-tall `View Lyrics` + `Remove` buttons.
4. **Docked Mobile Finish-Line Bar:** Full-width primary `Play Clean Queue (3)` CTA (mobile-first zero-login playback) above secondary 2-column `Copy Links` + `Export` buttons.

### Screen 3 — Desktop `LyricsModal` Inspection Overlay (`03-lyrics-modal-desktop.html`, `4cd7a384ba0840fe87de688c1661cd71`)
1. **Centered `max-w-2xl` Dialog (`rounded-2xl`):** Overlaid on blurred/dimmed workbench (`bg-[#050812]/80 backdrop-blur-md`).
2. **Track Header (`bg-surface-container-low/70`):** `56x56` (`w-14 h-14`) album cover with corner flag badge, track title + `"Open Track in Spotify"` external link, `Artist • Album • 3:31` mono subline, `Flagged` pill + category breakdown chips (`strong_profanity: 4`, `substances: 2`), and accessible `aria-label="Close modal"` button.
3. **Inline Clean Replacement Banner (`border-tertiary/30 bg-tertiary-container/15 rounded-xl p-3.5`):** Displays matched clean track (`Gin and Juice (Clean Radio Edit) • 3:31 • Verified Clean`) with immediate in-modal `Remove` and solid emerald `Swap to Clean` buttons.
4. **Code-Grade Lyric Viewer (`bg-surface-container-lowest rounded-xl`):** Sub-header bar with `LYRIC INSPECTION ENGINE` label and `Flag 1 of 6 ↑ ↓` jumper buttons; scrollable body with right-aligned mono gutter (`L08`–`L17`, `w-10 border-r`), flagged line left-border callouts (`border-l-2 border-error bg-error-container/15`), and inline highlighted token pills (`shit [profanity: #1]`, `smokin' indo [substance: #1]`).
5. **Modal Footer:** Left YouTube Music lyric cross-reference attribution; right `Keep Flagged Track` ghost button + `Close` button.

### Screen 4 — Desktop `Stitch Studio` Multi-Source Merger (`04-stitch-studio-desktop.html`, `2bb23afe76e04df68757815d67b666ba`)
1. **Header & Combined Quota Banner:** Active `Stitch Studio` tab + `YouTube Music` active in catalog toggle; page header paired with a `w-80` `Combined Track Quota: 38 / 50 Staged` progress bar card (`76%` violet gradient fill, `12 Slots Free`).
2. **Multi-Source Input Pool Card:** Unified URL/paste bar (`+ Add Playlist URL` + `Paste Track List (Artist - Title)`) above a 2-column grid of loaded source cards (`Source 1: YT Music — Friday Art Class Pop • 26/26 scanned` and `Source 2: Text Paste — 5th Grade Student Requests • 10 matched, 2 unresolved`, each with remove `✕` action).
3. **Batch Clean & Merge Rules Bar:** Horizontal 4-control strip (`Sensitivity Preset: Kid Safe`, `Clean Policy: Swap or Drop Flagged`, `Track Order: Interleave Sources`, `Deduplicate: Track + Artist`) + right-aligned `Stitch & Clean` primary button.
4. **Dismissible Unresolved Lines Notice:** Fault-tolerant amber caution banner listing skipped student typos (`"bruno mras - aptt"`, `"wknd - blinding lite"`) as inline chips with dismiss `✕` so the batch completes cleanly.
5. **Stitched Clean Queue Card:** Summary metric pills (`32 Ready to Play`, `6 Clean Swapped`, `2 Flagged Dropped`, `2 Duplicates Removed`), classroom Finish-Line CTA cluster (`Play Clean Queue (32 tracks)` primary, `Copy Clean Track Links`, `Export ▾`), and compact merged track rows with `Source Origin` badges (`Friday Art Class` / `Student Paste`) + `Safety Status` badges.

### Screen 5 — Desktop `Keyword Search` Tab (`05-keyword-search-desktop.html`, `8ae358295e7a4d3793f5eb4598e6427c`)
1. **Clean Sticky Global Header (`h-14`):** `CleanPlaylist STUDIO` wordmark on left, strictly 3 navigation tabs centered (`Scan & Clean`, `Keyword Search` active with `border-b-2 border-primary-container` glow, `Stitch Studio`), and right-aligned `Catalog: [Spotify | YouTube Music]` segmented pill (no notification bell, gear, or avatar).
2. **Keyword Search Bar & Target Chips Card (`bg-surface-container-low rounded-2xl p-6`):** Top context strip (`Searching 28 loaded tracks from Working List • Lyrics cross-referenced`), full-width search input (`bg-surface-container-lowest rounded-xl`) + `+ Add Keyword` violet-outline button, removable target keyword pills (`money`, `drugs`, `gun`, `party`, `alcohol` with `×` buttons), and primary `Search Keywords Across Working List` CTA (`bg-primary-container`) paired with `Clear All Keywords`.
3. **Keyword Match Results Card (`bg-surface-container-low rounded-2xl p-6`):** Header summary (`4 of 28 tracks contain target keywords`) + per-keyword filter chips (`All Matches (4)`, `money (3)`, `drugs (2)`, `gun (1)`). Expandable matched track list (`01`–`04`) with `40x40` (`w-10 h-10`) album cover, Title, mono duration, `Artist — Album`, per-keyword hit count badges (`money: 6x`, `party: 1x`), `View Lyrics` + `Open Track ↗` buttons, and expand/collapse toggle (`1 matching line ▾` / `▲`).
4. **Expanded Lyric Excerpt Inset (`bg-surface-container-lowest border-outline-variant/30 rounded-xl p-4 ml-9`):** Monospace line-numbered lyric excerpt rows (`[L09]`, `[L13]`, `[L17]`, `[L24]`) with matched keyword tokens highlighted in crisp amber `<mark>` pills (`bg-amber-400/20 text-amber-300 border-amber-400/40`).
5. **Stitch Embellishments to Override in Spines:** Omit the fixed bottom engine telemetry strip (`Engine: Keyword Hunter v2.4 • 0 False Negatives • Latency 18ms • Bulk Flag Tracks`), fake LRC timestamps (`0:42` — backend lyric lines are un-timestamped plain text), `Phonetic stemming active` / `Sensitivity: High (Strict Phonetic)` copy (keyword search is case-insensitive substring/word match), `Export Keyword Audit`, and `CLEAN EDIT` / `Security` emerald micro-badges; keep user keyword pills unified in studio slate/violet (reserving amber `<mark>` for matched tokens and emerald strictly for `Verified Clean` / `Clean Swapped`).

### Screen 6 — Desktop `Scan & Clean` Paste Track List & Spotify URL Helper (`06-paste-and-spotify-helper-desktop.html`, `a58e52459e3f4360a0b4feedc10e0286`)
1. **Zero-Login Sticky Header (`h-14`):** Strictly 3 tabs (`Scan & Clean` active, `Keyword Search`, `Stitch Studio`) and `Spotify | YouTube Music` catalog toggle.
2. **Smart Input Bar + Guided Spotify Playlist Copy Helper Banner:** Input populated with `https://open.spotify.com/playlist/37i9dQZF1DX0XUsuxWHRQd`, `Clear` button, active/pressed `Paste Track List` button, and `Scan URL` CTA. Directly below sits a calm violet/slate guidance card (`bg-surface-container-low/90 border-primary/25 rounded-xl p-4`, no red error) titled `"Public Spotify playlist links require a quick copy-paste (no login needed)"` with quick actions (`Search Albums Instead`, `Focus Paste Box Below ↓`) and a 3-column inline step strip (`1. Open playlist in Spotify Desktop` → `2. Select tracks (Ctrl+A / Cmd+A) & Copy (Ctrl+C / Cmd+C)` → `3. Paste track links or Artist - Title lines below`).
3. **Expanded `Paste Track List` Workbench Panel (`bg-surface-container-low border-outline-variant/50 rounded-xl`):** Header with `Paste Track List`, helper subline (`Accepts track URLs, Spotify URIs, or 'Artist - Title' plain text lines`), monospace `14 / 50 lines` quota pill, and `Clear` action; recessed `#070d1f` (`bg-surface-container-lowest`) monospace multi-line input showing mixed `open.spotify.com/track/...` URLs and `Artist - Title` text lines; inline cross-catalog notice (`1 YouTube Music URL detected — will be skipped unless you switch Catalog to YouTube Music` + `Switch to YT Music` quick link); footer bar with `13 valid Spotify tracks & text queries ready to resolve`, `Cancel`, and primary violet `Resolve & Add 13 Tracks to Working List →` CTA.
4. **Stitch Embellishments to Override in Spines:** Implement the paste area as a true editable `<textarea>` (raw pasted lines without pre-resolved parenthetical titles `(The Killers - Mr. Brightside)`), style cross-catalog URL notices in calm **amber** (`bg-amber-500/10 border-amber-500/30 text-amber-300`) rather than `error` red, drop the unimplemented `"Auto-Convert to Spotify"` link, drop decorative emerald `LIVE ENGINE` / `AUTO-DETECT` pills and fake rate-limit footer (`480 req/min`), and keep `Clean Swapped` emerald + preset names canonical (`Kid Safe`, `Moderate`, `Slurs Only`, `Custom`).

### Screen 7 — Desktop `VIP Mode` (`?vip=1`) Spotify Library & Save Modals (`07-vip-spotify-modals-desktop.html`, `b65572c65d3f4866aeeb249811351899`)
1. **VIP Mode Sticky Header & Workbench Triggers:** Left `CleanPlaylist` wordmark + `VIP` pill badge (`?vip=1`), center 3 tabs (`Scan & Clean` active, `Keyword Search`, `Stitch Studio`), right `Catalog: [Spotify | YouTube Music]` + `Spotify Connected` status pill + muted `Exit VIP Mode` button; dimmed background workbench exposes `Browse Library` and `Save to Spotify` buttons.
2. **`PlaylistPickerModal` (`Browse Your Spotify Playlists`):** Elevated dark dialog (`rounded-2xl shadow-2xl`) with header + Close `×`, `"Filter your playlists..."` search input, scrollable list of user playlists (`44x44` cover art, playlist title, owner name, mono track count e.g. `34 tracks` and amber cap callout `68 tracks (loads first 50)`, `Load →` / `Loaded` button), and pagination footer (`Showing 1–20 of 42 playlists` + `Previous` / `Next`).
3. **`SavePlaylistModal` (`Save Clean Playlist to Spotify`):** Elevated dark dialog (`rounded-2xl shadow-2xl`) with header + Close `×`, segmented radio-card mode selector (`Create New Clean Playlist` active card in `bg-purple-950/25 border-2 border-purple-500/80` with nested `New Playlist Title` input pre-filled `"90s Hip-Hop Classics (Clean)"` and `Private Playlist` toggle switch; `Replace Tracks in Original Playlist` unselected card with `Destructive` rose tag), emerald verification summary inset (`24 verified / swapped tracks will be written to Spotify`), and footer (`Cancel` + `Save to Spotify` CTA).
4. **Stitch Embellishments to Override in Spines:** Remove the spec-only side-by-side showcase wrapper (`VIP Authenticated Modal Architecture — Specification View` ribbon exposing OAuth token TTL/scopes and `Desktop Modals Benchmark` footer) — render `PlaylistPickerModal` and `SavePlaylistModal` individually as standard single centered modal overlays (`max-w-lg` / `max-w-xl`). Replace Stitch's `#1ed760` Spotify-green chrome accents (on the `Catalog: Spotify` button, folder icon, `RECOMMENDED` pill, and solid green `Save to Spotify` CTA) with unified studio violet (`#7c3aed` `bg-primary-container`) so emerald (`#10b981`) remains strictly reserved for track safety verification states, and render real Spotify playlist cover images (`images[0].url` with single fallback icon) instead of genre-badged (`MIX`, `RAP`, `EDU`) gradient placeholders.

