# CleanPlaylist — Google Stitch Handoff Prompt Pack

- **Stitch Project:** `projects/17521564154222297091` (`https://stitch.withgoogle.com/projects/17521564154222297091`)
- **Aesthetic Posture:** Tidal & Spotify Web inspired dedicated dark-mode music screening studio. Tailwind Slate dark surfaces (`#020617` canvas, `#0f172a` cards, `#1e293b` borders), unified cool studio brand accent (no green-vs-purple app reskinning), semantic safety tokens (`emerald` reserved strictly for `Verified Clean` & `Clean Swapped`, `rose/red` for `Flagged`, `amber` caution for `Lyrics Unavailable`).

## Screen 1 — Desktop: `Scan & Clean` Workbench (`DESKTOP`)
Design a modern, dedicated dark-mode web application screen for **CleanPlaylist** inspired by Tidal and Spotify Desktop/Web. Use a deep Slate dark palette (`#020617` background canvas, `#0f172a` surface cards, `#1e293b` subtle borders, crisp `#f8fafc` primary text, `#94a3b8` secondary text, clean sans-serif typography with monospace track durations, and minimal crisp stroke icons). Keep one unified studio brand accent (electric violet/indigo `#7c3aed` / `#6366f1`) across chrome so emerald green (`#10b981`) is reserved strictly for "Verified Clean" and "Clean Swapped" safety status badges.

Layout from top to bottom:
1. **Sticky Global Header:** Left: "CleanPlaylist" sleek wordmark with subtle audio/shield mark. Center: 3 navigation tabs — `Scan & Clean` (active), `Keyword Search`, `Stitch Studio`. Right: unified target catalog segmented pill `Catalog: [Spotify (selected) | YouTube Music]` (no Login button, no Read-Only badge — zero-login public studio).
2. **Unified Smart Input Bar Card:** Prominent single command-style input bar with search icon, placeholder `"Search songs or albums, paste a playlist URL, or paste a track list..."`, subtle badge `"Matching Spotify Catalog"`, and secondary button `"Paste Track List"`. Below input, show a compact inline search-results tray previewing 1 Song match (`+ Add Song`) and 1 Album match (`"Illmatic — Nas • 10 tracks"` with `+ Add Album`).
3. **Screening Controls Bar:** Compact horizontal toolbar with **Sensitivity Preset** pills (`Kid Safe`, `Moderate` [selected], `Slurs Only`, `Custom`), inline **Custom Blocklist** removable word chips (`+ Add term`), live scan progress indicator `Scanned 28 of 28`, and action button `"Find & Swap All Clean Versions"`.
4. **Working List Workbench Card:**
   - Card header: `Working List` title with `28 / 50 tracks` capacity pill, filter tabs (`All 28`, `Flagged 4`, `Verified Clean 14`, `Clean Swapped 9`, `Lyrics Unavailable 1`), compact `"Filter loaded tracks..."` search input, and muted `"Clear List"` action.
   - Compact Tidal-density track rows showing `#`, `40x40` album thumbnail, Title, Artist, Album, monospace duration, mutually exclusive **Verification Status** badge, and row actions:
     - Row 1: `"Juicy - Radio Edit"` — The Notorious B.I.G. | `4:12` | Emerald badge `Verified Clean` | Actions: `View Lyrics`, `Open Clean Track`, trash icon.
     - Row 2: `"Gin and Juice"` — Snoop Dogg | `3:31` | Rose/Red badge `Flagged` + category chips `strong_profanity (4)` `substances (1)` + muted snippet preview | Actions: `View Lyrics`, emerald outline CTA `"Swap to Clean"`, trash icon.
     - Row 3: `"California Love (Clean Edit)"` — 2Pac | `4:45` | Emerald-teal badge `Clean Swapped` (with small swap icon) | Actions: `View Lyrics`, `Open Clean Track`, trash icon.
     - Row 4: `"The Doctor's Office (Skit)"` — Dr. Dre | `1:04` | Amber caution badge `Lyrics Unavailable` + small `E` metadata tag | Actions: `"Remove"` button, `Open Track`.
5. **Sticky Desktop Finish-Line Bar (bottom of workbench):** Left summary `23 clean tracks ready • 5 need review`. Right actions: Primary button `"Copy Clean Track Links (23)"` with inline helper microcopy `"Paste into an empty Spotify Desktop playlist (Ctrl+V / Cmd+V)"`, secondary button `"Play Clean Queue"` (zero-login YouTube queue), and `"Export ▾"` (`CSV`, `M3U8`, `JSON`).

## Screen 2 — Mobile: `Scan & Clean` Parent-Test View (`MOBILE`)
Design the mobile (`390px` width) responsive view of **CleanPlaylist — Scan & Clean**, following the exact same Tidal/Spotify dark Slate design system, unified violet-indigo studio accent, and strict semantic safety badges (`Verified Clean`, `Flagged`, `Clean Swapped`, `Lyrics Unavailable`).

Layout from top to bottom:
1. **Compact Mobile Header:** "CleanPlaylist" mark on left, compact `Spotify | YT Music` catalog pill on right, and accessible 3-tab segmented navigation bar (`Scan & Clean` [active], `Keywords`, `Stitch Studio`) with both icons and visible labels.
2. **Smart Input & Preset Strip:** Compact unified smart search/paste input (`"Search song/album or paste list..."`), `Sensitivity: Kid Safe` pill, and `Working List • 4 / 50 tracks` counter.
3. **Compact Mobile Track Cards (4 tracks from a quick parent check):**
   - Card 1: `"APT."` — ROSÉ & Bruno Mars | Emerald `Verified Clean` badge | `Open Clean Track` icon+label button.
   - Card 2: `" Espresso (Clean Edit)"` — Sabrina Carpenter | Emerald `Clean Swapped` badge | `Open Clean Track` button.
   - Card 3 (Expanded Flagged state): `"Popular Rap Track"` — Trending Artist | Red `Flagged` badge + category pills `sexual (2)` `mild_profanity (1)`, 1-line highlighted lyric snippet preview, and two clear thumb-friendly buttons: `"View Lyrics"` and `"Remove"` (plus `"No clean version found"` muted note).
   - Card 4: `"Luther"` — Kendrick Lamar & SZA | Emerald `Verified Clean` badge | `Open Clean Track` button.
4. **Sticky Mobile Bottom Finish-Line Bar:** Emphasizes mobile-native actions: full-width primary CTA `"Play Clean Queue (3)"` (opens instant zero-login playback) alongside compact secondary buttons `"Copy Links"` and `"Export"`.

## Screen 3 — Desktop: `LyricsModal` Inspection Overlay (`DESKTOP`)
Design the desktop **Lyrics Inspection Modal (`LyricsModal`)** overlaid on top of the dimmed **CleanPlaylist** `Scan & Clean` dark studio workbench, using the exact same dark Slate design system.

Modal anatomy (`max-w-2xl` centered elevated dialog on `#0f172a` surface with `#1e293b` border):
1. **Track Header:** `56x56` album artwork, Title `"Gin and Juice"`, Artist `"Snoop Dogg • Doggystyle • 3:31"`, red `Flagged` badge, category breakdown pills (`strong_profanity: 4`, `substances: 2`), external link `"Open Track in Spotify"`, and top-right accessible Close `X` button.
2. **Inline Clean Replacement Action Banner:** High-craft inset card right below the header showing: `"Clean Replacement Found: Gin and Juice (Clean Radio Edit) • 3:31 — Verified Clean"` with primary emerald button `"Swap to Clean"` and secondary button `"Remove Track"` so the parent can act immediately without closing the modal.
3. **Line-Numbered Lyric Viewer:** Scrollable dark `#020617` code/lyric pane with monospace line numbers (`L08`–`L22`), clean readable lyric lines, flagged profanity/substance tokens highlighted inline with subtle red pill backgrounds (`bg-red-500/20 text-red-300 border-red-500/40`) and category tags on hover/inline, plus a compact top-right jumper `"Flag 1 of 6 ↑ ↓"`.
4. **Modal Footer:** Muted attribution note `"Lyrics cross-referenced via YouTube Music"` on left, `"Keep Flagged Track"` and `"Close"` on right.

## Screen 4 — Desktop: `Stitch Studio` Multi-Source Merger (`DESKTOP`)
Design the desktop **Stitch Studio** tab of **CleanPlaylist** for zero-login classroom/group playlist merging, using the exact same Tidal/Spotify dark Slate design system, with `Catalog: YouTube Music` selected in the top global header and `Stitch Studio` active in the center tab bar.

Layout from top to bottom:
1. **Sticky Global Header:** Same unified header with `Stitch Studio` active and `Catalog: [Spotify | YouTube Music (selected)]`.
2. **Multi-Source Input Pool Card (`38 / 50 tracks` combined input budget bar):**
   - Unified source input bar accepting a public YouTube Music playlist URL or triggering `"Paste Track List"` (`Artist - Title` lines).
   - 2 loaded source cards side-by-side:
     - Source 1: `"Friday Art Class Pop"` (YouTube Music Playlist • 26 tracks • remove button).
     - Source 2: `"5th Grade Student Requests"` (`Pasted Track List` • 12 lines — 10 matched, 2 unresolved • remove button).
3. **Batch Clean & Merge Rules Bar:** 4 compact controls in a clean row: `Sensitivity Preset: Kid Safe`, `Clean Policy: Replace with Clean or Drop Flagged`, `Track Order: Interleave Sources`, `Deduplicate: Track + Artist`, plus primary studio button `"Stitch & Clean"`.
4. **Dismissible Unresolved Lines Notice (Amber caution banner):** `"2 pasted student lines could not be matched and were skipped"` with collapsible/inline items (`"bruno mras - aptt"`, `"wknd - blinding lite"`) so the batch succeeds cleanly without failing.
5. **Stitched Clean Queue Output Card:**
   - Summary metric pills: `32 Ready to Play`, `6 Clean Swapped`, `2 Flagged Dropped`, `2 Duplicates Removed`.
   - Classroom Finish-Line CTA cluster: prominent primary button `"Play Clean Queue (32 tracks)"` (launches zero-login YouTube queue tab), secondary `"Copy Clean Track Links"`, and `"Export ▾"` (`CSV`, `M3U8`, `JSON`).
   - Compact merged track list rows showing `#`, thumbnail, title, artist, source badge (`Source 1` / `Student Paste`), and `Verified Clean` or `Clean Swapped` emerald badges.


## Screen 5 — Desktop: `Keyword Search` Tab (`DESKTOP`)
Design the desktop **Keyword Search** tab of **CleanPlaylist** using the exact `Obsidian Audio Core` dark studio design system. Strictly include ONLY 3 navigation tabs in the top header (`Scan & Clean`, `Keyword Search` [active], `Stitch Studio`) and the right-aligned `Catalog: [Spotify (selected) | YouTube Music]` segmented pill — do NOT render any notification bell, gear icon, user avatar, or extra nav links.

Layout from top to bottom:
1. **Sticky Global Header:** `CleanPlaylist` wordmark on left, 3 tabs centered (`Keyword Search` active), `Catalog: [Spotify | YouTube Music]` pill on right.
2. **Keyword Search Bar & Target Chips Card:**
   - Context pill: `Searching 28 loaded tracks from Working List (Lyrics cross-referenced)`.
   - Input row: text input `"Enter custom word or phrase to hunt across all lyrics..."` + `"Add Keyword"` button.
   - Active target keyword pills (removable `×`): `money`, `drugs`, `gun`, `party`, `alcohol`.
   - Primary studio violet button: `"Search Keywords Across Working List"`.
3. **Keyword Match Results Card:**
   - Header summary: `4 of 28 tracks contain target keywords` + filter chips by matched keyword (`All Matches 4`, `money (3)`, `drugs (2)`, `gun (1)`).
   - Expandable matched track cards (`#`, `40x40` album thumbnail, Title, Artist, Album, monospace duration, per-keyword hit count badges, `"View Lyrics"` button, `"Open Track"` button):
     - Expanded Match 1: `"C.R.E.A.M."` — Wu-Tang Clan | Hit pills: `money: 6x` | Expanded monospace lyric excerpt rows (`L09`, `L17`, `L24`) with matched `money` tokens highlighted in crisp amber/gold `<mark>` pills inside dark `#070d1f` inset box.
     - Expanded Match 2: `"Gin and Juice"` — Snoop Dogg | Hit pills: `money: 2x`, `party: 1x` | Expanded monospace lyric excerpt rows (`L13: Laid back with my mind on my [money] and my [money] on my mind`).
     - Collapsed Match 3: `"Juicy - Radio Edit"` — The Notorious B.I.G. | Hit pills: `party: 1x` | `1 matching line ▾`.

## Screen 6 — Desktop: `Scan & Clean` Paste Track List & Spotify Playlist URL Helper (`DESKTOP`)
Design the desktop **Scan & Clean — Multi-Input Paste & Guided Spotify URL Helper** state of **CleanPlaylist** using the `Obsidian Audio Core` dark studio design system. Strictly include ONLY the 3 tabs (`Scan & Clean` [active], `Keyword Search`, `Stitch Studio`) and `Catalog: [Spotify (selected) | YouTube Music]` in the header — no avatar, bell, or settings icons.

Layout from top to bottom:
1. **Sticky Global Header:** Clean zero-login studio header.
2. **Smart Input Bar with Pasted Spotify Playlist URL Detected:**
   - Input contains `https://open.spotify.com/playlist/37i9dQZF1DX0XUsuxWHRQd`.
   - Immediately below the input, render a sleek **Guided Spotify Playlist Copy Helper Banner** (no red error — calm violet/slate guidance card):
     - Title: `"Public Spotify playlist links require a quick copy-paste (no login needed)"`
     - 3 compact inline numbered steps: `1. Open playlist in Spotify Desktop` → `2. Select tracks (Ctrl+A / Cmd+A) & Copy (Ctrl+C / Cmd+C)` → `3. Paste track links or Artist - Title lines below`
     - Quick buttons: `"Focus Paste Box Below"` and `"Search Albums Instead"`.
3. **Expanded `Paste Track List` Workbench Panel:**
   - Header: `"Paste Track List"` with monospace quota counter `14 / 50 lines` and `"Clear"` button.
   - Dark `#070d1f` monospace multi-line textarea showing a realistic mix of pasted `https://open.spotify.com/track/...` URLs and `Artist - Title` lines (`OutKast - Hey Ya!`, `TLC - No Scrubs`, `Will Smith - Miami`), plus 1 inline subtleamber notice at the bottom: `"1 YouTube Music URL detected — will be skipped unless you switch Catalog to YouTube Music"`.
   - Footer action bar: `"Cancel"` secondary button and `"Resolve & Add 13 Tracks to Working List"` primary violet CTA.

## Screen 7 — Desktop: `VIP Mode` (`?vip=1`) Spotify Library & Save Modals (`DESKTOP`)
Design the desktop **VIP Mode (`?vip=1`) Authenticated Spotify Modals** view of **CleanPlaylist** using the `Obsidian Audio Core` dark studio design system.

Layout:
1. **Sticky Global Header (VIP Mode Active):** Left `CleanPlaylist` wordmark + subtle `VIP` pill badge; Center 3 tabs (`Scan & Clean` active, `Keyword Search`, `Stitch Studio`); Right `Catalog: [Spotify (selected) | YouTube Music]` + emerald `"Spotify Connected"` status pill + muted `"Exit VIP Mode"` text button. Below header in the dimmed workbench, `"Browse Library"` and `"Save to Spotify"` buttons are visible.
2. **Dual Modal Showcase Overlay (side-by-side clean studio dialogs over blurred dark workbench for specification reference):**
   - **Left Dialog — `Browse Spotify Library` (`PlaylistPickerModal`):**
     - Header: `"Browse Your Spotify Playlists"` + Close `×` button.
     - Search input: `"Filter your playlists..."`.
     - Compact list of 5 user playlists (`44x44` cover art, playlist title e.g. `"Saturday Family Roadtrip"`, `"90s Hip-Hop Classics"`, owner name, track count `"34 tracks"` or `"68 tracks (loads first 50)"`, and `"Load"` button).
     - Footer: `"Showing 1–20 of 42 playlists"` + `Previous` / `Next` pagination buttons.
   - **Right Dialog — `Save to Spotify` (`SavePlaylistModal`):**
     - Header: `"Save Clean Playlist to Spotify"` + Close `×` button.
     - Segmented mode cards:
       - Selected card: `"Create New Clean Playlist"` (recommended — keeps original untouched) with editable playlist name input pre-filled `"90s Hip-Hop Classics (Clean)"` and privacy toggle `Private playlist`.
       - Unselected card: `"Replace Tracks in Original Playlist"`.
     - Summary inset box: `"24 verified/swapped tracks will be written to Spotify"` (emerald check icon).
     - Footer: `"Cancel"` button + primary emerald/violet CTA `"Save to Spotify"`.
