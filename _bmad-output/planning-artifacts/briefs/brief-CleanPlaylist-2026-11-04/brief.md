---
title: "Product Brief: CleanPlaylist (Public Launch Milestone)"
status: complete
created: "2026-11-04"
updated: "2026-11-04"
---

# Product Brief: CleanPlaylist (Public Launch Milestone)

## Executive Summary

CleanPlaylist is evolving from a personal playlist cleaner into a **zero-login web app for vetting music, finding clean versions, and stitching playlists** across Spotify and YouTube Music for parents and teachers. Adults who want to share childhood albums with children—or vet trending songs kids ask to hear—cannot rely on streaming platforms' binary `[E]` (Explicit) badges, which routinely miss untagged older catalog tracks and hide *why* modern songs were flagged. Meanwhile, tightening streaming API lockdowns (Spotify's five-user OAuth cap for indie apps and YouTube Music's read-only catalog) prevent third-party tools from directly reading or writing a stranger's music library.

This milestone redesigns CleanPlaylist around those constraints rather than fighting them. It pivots the public experience to zero-login catalog search, cross-platform lyric inspection, and frictionless playback and link handoffs at $0 in marginal API costs—while preserving full Spotify OAuth library sync behind a private access parameter for the owner and up to four allowlisted accounts.

## The Problem

Sharing music with kids sits in an uncomfortable gap between blind trust and tedious manual labor:

- **Nostalgia blind spots and opaque `[E]` tags:** A parent puts on a favorite 1990s album in the car and forgets verse two contains three F-bombs—often on an older remaster never tagged `Explicit`. Conversely, when a child or student asks for five trending pop songs tagged `[E]`, an adult has no idea whether a song has a single mild swear word or explicit sexual and violent verses, or whether a radio edit exists.
- **Manual lyric checking kills the moment:** Looking up 15 to 30 songs one by one on lyric sites—then hunting down matching clean versions on Spotify or YouTube Music, or trying to play safe tracks on shared classroom hardware without logging into a personal account—takes far too long.
- **Platform walls block v1 for the public:** CleanPlaylist v1 requires per-user Spotify OAuth even to *read* a playlist and offers no lyric scanning on Spotify. Because Spotify caps Development Mode at five allowlisted users (and restricts Extended Quota Mode to commercial entities with more than 250,000 monthly active users), the sixth visitor encounters an immediate authorization error on launch day.

## Who This Serves

- **Primary — Intentional Parents:** Parents introducing children (ages 5 through 13) to favorite albums or musical eras from their youth, or screening new song requests before a road trip, birthday party, or family hangout. Success means knowing *why* a song was flagged and getting clean music playing or queued in under two minutes.
- **Secondary — Classroom Teachers and Youth Leaders:** Educators vetting student-submitted song requests or launching a worry-free classroom work queue on a laptop or interactive display without logging personal streaming accounts into school hardware.
- **Explicit Non-Target (This Milestone):** Professional wedding and club DJs who require offline DJ software crate syncing or beatmatched library management across hundreds of tracks.

## The Solution

CleanPlaylist becomes an instant **music content X-ray and clean-version workbench** that works end-to-end without user accounts or developer API keys:

1. **Zero-Login Multi-Input Front Door:** Instead of requiring a playlist URL, users can **search individual songs or full albums** (powered by server-side Spotify Client Credentials and YouTube Music), **paste a plain-text song list or copied `open.spotify.com/track/...` links**, or **paste a YouTube Music playlist URL**. When a public visitor pastes a Spotify playlist URL, a clear inline helper shows how to copy and paste tracks from Spotify Desktop in seconds or search albums directly.
2. **Cross-Platform Lyric Snippets for Informed Judgment:** Every scan—including Spotify mode—cross-references YouTube Music lyrics and runs CleanPlaylist's deterministic regex scanner against sensitivity presets and custom blocklists. Parents and teachers see **which words triggered flags, their categories, and the exact lyric line snippets**, letting them decide whether to keep a track, swap in an auto-matched clean version, or drop it altogether.
3. **Public Stitch Studio:** Users can merge multiple vetted sources (such as two childhood albums plus a pasted list of child or student requests) into one deduplicated, family-safe mix without signing in.
4. **Dual Zero-Auth Finish Line:**
   - **Play Clean Queue Now:** A one-tap action launches an instant, zero-login playable YouTube queue (`watch_videos?video_ids=...`, batched up to 50 clean tracks) for immediate car, kitchen, or classroom playback.
   - **Open or Copy Into Your App:** Per-track `"Open Clean Track"` deep links jump straight to the clean version in Spotify or YouTube Music on mobile, paired with one-click `"Copy Clean Links"` (for pasting via `Ctrl+V` or `Cmd+V` into Spotify Desktop playlists or TuneMyMusic) alongside CSV, M3U8, and JSON exports.

> **Owner and Approved-Tester Access:** Visiting CleanPlaylist with a secret URL query parameter reveals Spotify OAuth login, preserving full playlist reading and one-click library saving for the owner and up to four allowlisted users while keeping the public interface completely free of dead-end login prompts.

## What Makes This Different

- **Informed judgment over blind censorship:** Rather than hiding every `[E]` song and missing untagged classics, CleanPlaylist surfaces categorized flags and exact lyric lines so adults decide what fits their children's age.
- **Lyric visibility for Spotify households:** Cross-matching against YouTube Music gives Spotify families lyric-level screening without switching services or logging in.
- **Zero-friction, zero-marginal-cost design:** Built around current platform API rules using official catalog lookups, deterministic regex snippets, and native URL and queue handoffs—no developer-key setup, brittle cookie scraping, or per-scan LLM token bills.

## Scope

**In Scope (Public Launch Milestone):**
- Deliver zero-auth song search, album lookup, pasted song or track-URL inputs, and guided Spotify playlist-URL fallback across Scan and Stitch Studio.
- Cross-reference Spotify tracks against YouTube Music lyrics for categorized regex and line-snippet scanning.
- Ship the dual zero-auth finish line (batched YouTube Clean Queues, per-track clean deep links, and one-click Copy Clean Links) alongside existing file exports.
- Gate existing Spotify OAuth and direct playlist saving behind a secret URL query parameter for up to five allowlisted users.

**Out of Scope:**
- Bring-Your-Own (BYO) Spotify Developer API key configuration UI.
- AI and LLM semantic or innuendo analysis (keeping this release fast, deterministic, and $0 per scan).
- User accounts, server-side user databases, or persistent hosted playlist pages.
- Unofficial YouTube Music or Spotify cookie or session scraping for library writes.
- Dedicated DJ software and hardware integrations.

## Success Criteria

Because this is a public side-project launch focused on real-world utility and demand validation:

- **Zero public auth dead-ends:** Every public visitor (100%) can search, vet, clean, and stitch across Spotify and YouTube Music modes without encountering a Spotify OAuth 401 or 403 error.
- **End-to-end finish-line usage:** Parents and teachers complete full vetting flows *and* activate the zero-auth outputs (launching a Clean Queue, tapping per-track clean deep links, or copying clean track links).
- **Validated demand for more:** Organic repeat visits, shares in parent and teacher communities, and qualitative feedback ("I wish it also did X") justify—or steer—a next milestone, while maintaining **$0 in marginal API and hosting costs**.

## Vision

If parents and teachers adopt CleanPlaylist and ask for deeper tools, CleanPlaylist can grow into the go-to **family music readiness hub**. Future additions could include lightweight shareable "Parent-Approved List" links (`cleanplaylist.app/...`) that families can open anytime, optional AI thematic summaries for implied adult themes without explicit words, and one-tap mobile shortcuts—transforming family music discovery from a minefield into an effortless shared experience.
