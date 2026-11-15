import React from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  CheckCircle2,
  Disc3,
  Download,
  FileQuestion,
  Layers,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  Shuffle,
  Sparkles,
} from 'lucide-react';
import { VERIFIED_CLEAN_CAVEAT } from '../utils/verifiedCleanCaveat';

const WORKBENCH_CARDS = [
  {
    id: 'scan',
    code: '01 • WORKBENCH',
    title: 'Scan & Clean',
    icon: Disc3,
    description:
      'Assemble up to 50 tracks via song or album search, multi-line Paste Track List, or a public YouTube Music playlist URL. Screen against Kid Safe, Moderate, Slurs Only, or Slurs + Strong Language presets plus custom blocklist terms, inspect line-numbered lyrics, and click "Find & Swap All Clean Versions".',
    chips: ['Kid Safe & Moderate', 'Line-Numbered Excerpts', 'Clean Edit Swaps'],
    cta: 'Try Scan & Clean',
  },
  {
    id: 'keywords',
    code: '02 • DISCOVERY',
    title: 'Keyword Search',
    icon: Search,
    description:
      'Hunt specific themes across your staged Working List without scanning songs one by one. Check recurring words like money, drugs, party, alcohol, gun, or custom phrases across retrieved lyrics with expandable amber line-numbered excerpts.',
    chips: ['Theme & Phrase Hunt', 'Line-Numbered Matches', 'Shared Working List'],
    cta: 'Open Keyword Search',
  },
  {
    id: 'stitch',
    code: '03 • BATCH PIPELINE',
    title: 'Stitch Studio',
    icon: Shuffle,
    description:
      'Combine two or more sources—such as favorite throwback albums plus a pasted list of kid or student requests—under automated batch clean rules (Swap to Clean or Drop Flagged) and deduplication.',
    chips: ['Multi-Source Merge', 'Auto Deduplication', 'Batch Clean Rules'],
    cta: 'Launch Stitch Studio',
  },
];

const PERSONA_STORIES = [
  {
    initial: 'R',
    title: 'Saturday Road Trip',
    person: 'Randy • Parent of 2',
    quote:
      'Vetting two 1990s hip-hop albums on my laptop before a weekend drive. I swapped 10 flagged classics to clean edits, dropped two skits, and clicked "Copy Clean Track Links" to paste (Ctrl+V / Cmd+V) straight into an empty Spotify Desktop playlist.',
    footerLeft: 'Spotify Desktop Handoff',
    footerRight: '24 Tracks Ready',
  },
  {
    initial: 'J',
    title: 'The 2-Minute Parent Test',
    person: 'Jill • Middle School Mom',
    quote:
      'Screening five trending pop and rap requests on my phone in the kitchen. Seeing the exact flagged lyric lines let me approve four clean edits without guessing, then launch "Play Clean Queue" right from mobile.',
    footerLeft: 'Mobile Parent Test',
    footerRight: 'Exact Line Context',
  },
  {
    initial: 'M',
    title: 'Friday Classroom Queue',
    person: 'Ms. Rivera • 5th Grade Teacher',
    quote:
      'Merged a public study playlist with 12 student requests in Stitch Studio and launched a zero-login YouTube "Play Clean Queue" on the shared classroom display without ever signing a personal account into school hardware.',
    footerLeft: 'Shared Hardware Safe',
    footerRight: 'Zero Account Login',
  },
];

const ARCHITECTURE_PILLARS = [
  {
    icon: RefreshCw,
    title: 'Cross-Platform Lyric Cross-Reference',
    description:
      'Spotify tracks automatically match against YouTube Music lyrics by song title, primary artist, and ±10s duration. Deterministic regex boundary rules evaluate every line—no AI guesswork or false assurances.',
  },
  {
    icon: Download,
    title: 'Dual Zero-Auth Finish Line',
    description:
      'Take your vetted mix anywhere without OAuth tokens: 1-tap "Play Clean Queue" opens an instant YouTube queue (up to 50 tracks), "Copy Clean Track Links" pastes cleanly into Spotify Desktop, plus CSV, M3U8, and JSON exports.',
  },
  {
    icon: Shield,
    title: 'Zero-Login by Design',
    description:
      'Built around official public catalog lookups and $0 API setup. No user accounts, no server-side playlist history, and zero risk of leaving personal credentials signed into classroom or shared family computers.',
  },
];

export default function AboutTab({ activePlatform = 'spotify', onNavigateTab = () => {} }) {
  const activeCatalogLabel = activePlatform === 'ytmusic' ? 'YouTube Music' : 'Spotify';

  return (
    <div className="space-y-10 pb-10">
      {/* 1. Hero & Brand Manifesto */}
      <section
        aria-label="About CleanPlaylist"
        className="relative overflow-hidden rounded-2xl bg-surface-card border border-brand-primary/40 p-6 sm:p-10 shadow-xl"
      >
        <div
          className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-brand-primary/10 blur-3xl pointer-events-none"
          aria-hidden="true"
        />

        <div className="relative z-10 max-w-4xl space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-inset border border-border-subtle text-brand-tint font-mono text-[11px] tracking-wider uppercase">
            <Sparkles className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Zero-Login Music Content X-Ray • Spotify &amp; YouTube Music</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-text-primary tracking-tight leading-tight">
            Share the music you love—
            <span className="text-brand-tint">without the skip-button panic.</span>
          </h1>

          <div className="space-y-3 max-w-3xl">
            <p className="text-base font-semibold text-text-primary">
              Informed Judgment Over Blind Censorship.
            </p>
            <p className="text-sm text-text-secondary leading-relaxed">
              Streaming platforms reduce music screening to an opaque{' '}
              <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-surface-highest border border-border-subtle text-text-primary font-semibold">
                [E]
              </span>{' '}
              badge—missing untagged 80s, 90s, and 2000s album remasters with forgotten explicit verses while hiding{' '}
              <em>why</em> modern songs were flagged. CleanPlaylist is an instant, zero-login lyric X-ray and
              clean-version workbench built for intentional parents and teachers.
            </p>
            <p className="text-sm text-text-muted leading-relaxed">
              We inspect line-numbered lyric evidence across both Spotify and YouTube Music (currently active:{' '}
              <span className="text-text-secondary font-medium">{activeCatalogLabel}</span>), highlight flagged
              categories in context, and help you swap in clean edits or queue safe mixes in under two minutes.
            </p>
          </div>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigateTab('scan')}
              className="min-h-[44px] sm:min-h-[40px] inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-brand-primary hover:bg-brand-primary-hover text-brand-foreground text-sm font-semibold transition shadow-md focus:outline-none focus:ring-2 focus:ring-ring-focus"
            >
              <span>Open Scan &amp; Clean Studio</span>
              <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('stitch')}
              className="min-h-[44px] sm:min-h-[40px] inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-elevated hover:bg-surface-highest text-text-primary border border-border-subtle text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-ring-focus"
            >
              <Layers className="w-4 h-4 shrink-0 text-brand-tint" aria-hidden="true" />
              <span>Explore Stitch Studio</span>
            </button>

            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-inset border border-border-subtle text-text-secondary font-mono text-xs">
              <ShieldCheck className="w-4 h-4 shrink-0 text-brand-tint" aria-hidden="true" />
              <span>100% Zero-Login • $0 API Keys Required</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Why [E] Badges Fail vs. CleanPlaylist Lyric X-Ray */}
      <section aria-label="Why Explicit Badges Fail" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 border-b border-border-subtle pb-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold text-text-primary tracking-tight">
              Why [E] Badges Fail vs. The CleanPlaylist X-Ray
            </h2>
            <p className="text-sm text-text-muted mt-0.5">
              Deterministic line-by-line verification replaces guesswork and surprises.
            </p>
          </div>
          <span className="font-mono text-[11px] text-brand-tint uppercase tracking-wider">
            Audit Architecture
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Streaming [E] Blind Spot */}
          <div className="rounded-xl bg-surface-inset border border-status-flagged-border/35 p-6 space-y-5">
            <div className="flex items-center justify-between gap-3 border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-status-flagged shrink-0" aria-hidden="true" />
                <h3 className="text-lg font-semibold text-text-primary">
                  The Streaming [E] Blind Spot
                </h3>
              </div>
              <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-status-flagged-bg text-status-flagged border border-status-flagged-border/40">
                METADATA GAP
              </span>
            </div>

            <div className="space-y-4 text-sm">
              <div className="space-y-1">
                <h4 className="font-semibold text-text-primary">(a) Nostalgia Blind Spots</h4>
                <p className="text-xs text-text-muted leading-relaxed">
                  Classic 80s, 90s, and 2000s album remasters frequently ship without an Explicit metadata flag—even
                  when raw profanity or slurs appear mid-verse.
                </p>
              </div>

              <div className="space-y-1">
                <h4 className="font-semibold text-text-primary">(b) Opaque Modern Tags</h4>
                <p className="text-xs text-text-muted leading-relaxed">
                  A binary [E] badge never tells you whether a trending song has one mild swear word or explicit
                  sexual and substance verses, forcing adults into manual lyric-site searches.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-surface-card border border-border-subtle space-y-2.5">
                <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
                  <span className="text-text-muted uppercase tracking-wider">Streaming Metadata Preview</span>
                  <span className="px-2 py-0.5 rounded-full bg-surface-elevated text-text-secondary border border-border-subtle font-semibold">
                    Untagged in Metadata
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">
                      Classic Throwback Track (Remaster)
                    </p>
                    <p className="text-xs text-text-muted">90s Catalog Release • Missing [E] Flag</p>
                  </div>
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface-highest text-text-muted border border-border-subtle">
                    NO [E] TAG
                  </span>
                </div>
                <div className="p-2.5 rounded bg-surface-inset border border-border-subtle font-mono text-xs text-status-flagged">
                  <span className="text-text-muted">Verse 2 [L24]:</span> &quot;...unexpected explicit verse hidden behind missing catalog metadata...&quot;
                </div>
              </div>
            </div>
          </div>

          {/* Right: 4 Mutually Exclusive Verification States */}
          <div className="rounded-xl bg-surface-inset border border-brand-primary/35 p-6 space-y-4">
            <div className="flex items-center justify-between gap-3 border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-status-clean shrink-0" aria-hidden="true" />
                <h3 className="text-lg font-semibold text-text-primary">
                  CleanPlaylist Lyric X-Ray &amp; Verification
                </h3>
              </div>
              <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-surface-elevated text-brand-tint border border-brand-primary/30">
                HONEST AUDIT
              </span>
            </div>

            <p className="text-xs text-text-muted leading-relaxed">
              Every scanned track resolves to one of four mutually exclusive Verification Status badges:
            </p>

            <div className="space-y-2.5">
              {/* Verified Clean */}
              <div className="flex flex-col sm:flex-row sm:items-start gap-2.5 p-3 rounded-lg bg-status-clean-bg/45 border border-status-clean-border/35">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-status-clean-bg border border-status-clean-border text-status-clean text-[11px] font-bold tracking-wide shrink-0 w-fit">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Verified Clean</span>
                </span>
                <div className="space-y-0.5">
                  <p className="text-xs text-text-primary font-medium">
                    Full lyrics scanned with 0 matches against your active preset and blocklist.
                  </p>
                  <p className="text-[11px] text-text-secondary">{VERIFIED_CLEAN_CAVEAT}</p>
                </div>
              </div>

              {/* Clean Swapped */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 p-3 rounded-lg bg-status-clean-bg/30 border border-status-clean-border/30">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-status-clean-bg border border-status-clean-border text-status-clean text-[11px] font-bold tracking-wide shrink-0 w-fit">
                  <ArrowLeftRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Clean Swapped</span>
                </span>
                <p className="text-xs text-text-primary font-medium">
                  Flagged track replaced in-place with a verified non-explicit radio or clean version.
                </p>
              </div>

              {/* Flagged */}
              <div className="p-3 rounded-lg bg-status-flagged-bg/45 border border-status-flagged-border/35 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-status-flagged-bg border border-status-flagged-border text-status-flagged text-[11px] font-bold tracking-wide">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>Flagged</span>
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
                    <span className="px-2 py-0.5 rounded bg-surface-highest text-status-flagged border border-status-flagged-border/30">
                      strong_profanity: 3
                    </span>
                    <span className="px-2 py-0.5 rounded bg-surface-highest text-text-secondary border border-border-subtle">
                      substances: 1
                    </span>
                  </div>
                </div>
                <div className="p-2 rounded bg-surface-inset border border-border-subtle font-mono text-xs text-text-secondary">
                  <span className="text-text-muted">L18:</span> &quot;...highlighted line context with masked match{' '}
                  <mark className="px-1 rounded-xs bg-keyword-mark-bg text-keyword-mark-fg">f*****g</mark> shown cleanly...&quot;
                </div>
              </div>

              {/* Lyrics Unavailable */}
              <div className="flex flex-col sm:flex-row sm:items-start gap-2.5 p-3 rounded-lg bg-status-caution-bg/45 border border-status-caution-border/35">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-status-caution-bg border border-status-caution-border text-status-caution text-[11px] font-bold tracking-wide shrink-0 w-fit">
                  <FileQuestion className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Lyrics Unavailable</span>
                </span>
                <p className="text-xs text-text-primary font-medium">
                  <span className="text-status-caution font-semibold">Zero False-Clean Guarantee:</span> If lyrics
                  cannot be retrieved, CleanPlaylist never guesses or marks a track clean.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. How the Studio Works — 3 Interactive Workbench Cards */}
      <section aria-label="How the Studio Works" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 border-b border-border-subtle pb-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold text-text-primary tracking-tight">
              How the Studio Works
            </h2>
            <p className="text-sm text-text-muted mt-0.5">
              Three connected tools sharing one in-memory Working List—jump straight in.
            </p>
          </div>
          <span className="font-mono text-[11px] text-brand-tint uppercase tracking-wider">
            Core Workflows
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {WORKBENCH_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.id}
                className="flex flex-col justify-between rounded-xl bg-surface-card border border-border-subtle p-6 space-y-4 hover:border-brand-primary/50 transition-colors"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-brand-tint">{card.code}</span>
                    <div className="w-8 h-8 rounded-lg bg-surface-elevated border border-border-subtle flex items-center justify-center text-brand-tint">
                      <Icon className="w-4 h-4" aria-hidden="true" />
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold text-text-primary">{card.title}</h3>
                  <p className="text-xs text-text-secondary leading-relaxed">{card.description}</p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {card.chips.map((chip) => (
                      <span
                        key={chip}
                        className="font-mono text-[11px] px-2 py-0.5 rounded bg-surface-inset text-text-muted border border-border-subtle"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-border-subtle">
                  <button
                    type="button"
                    onClick={() => onNavigateTab(card.id)}
                    className="min-h-[44px] sm:min-h-[36px] inline-flex items-center gap-1.5 text-sm font-semibold text-brand-tint hover:text-text-primary transition-colors rounded-lg px-2 py-1 -ml-2 hover:bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-ring-focus"
                  >
                    <span>{card.cta}</span>
                    <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. Built for Real Moments — 3 Persona Stories */}
      <section aria-label="Built for Real Moments" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 border-b border-border-subtle pb-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold text-text-primary tracking-tight">
              Built for Real Moments
            </h2>
            <p className="text-sm text-text-muted mt-0.5">
              Designed around real family drives, quick parent checks, and classroom queues.
            </p>
          </div>
          <span className="font-mono text-[11px] text-brand-tint uppercase tracking-wider">
            User Journeys
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PERSONA_STORIES.map((story) => (
            <div
              key={story.title}
              className="flex flex-col justify-between rounded-xl bg-surface-inset border border-border-subtle p-6 space-y-4"
            >
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full bg-surface-elevated border border-brand-primary/35 flex items-center justify-center text-brand-tint font-bold text-base shrink-0"
                    aria-hidden="true"
                  >
                    {story.initial}
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-text-primary">{story.title}</h3>
                    <p className="font-mono text-[11px] text-text-muted">{story.person}</p>
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                  &ldquo;{story.quote}&rdquo;
                </p>
              </div>

              <div className="pt-3 border-t border-border-subtle flex items-center justify-between gap-2 font-mono text-[11px]">
                <span className="text-text-muted">{story.footerLeft}</span>
                <span className="text-brand-tint font-medium">{story.footerRight}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. Under the Hood & Bottom CTA Banner */}
      <section aria-label="Under the Hood" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 border-b border-border-subtle pb-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold text-text-primary tracking-tight">
              Under the Hood: Deterministic Precision
            </h2>
            <p className="text-sm text-text-muted mt-0.5">
              Architected around real streaming API rules—no user tracking and zero API-key friction.
            </p>
          </div>
          <span className="font-mono text-[11px] text-brand-tint uppercase tracking-wider">
            Privacy &amp; Architecture
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {ARCHITECTURE_PILLARS.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <div
                key={pillar.title}
                className="p-5 rounded-xl bg-surface-low border border-border-subtle space-y-2.5"
              >
                <div className="flex items-center gap-2 text-brand-tint font-semibold text-base">
                  <Icon className="w-5 h-5 shrink-0" aria-hidden="true" />
                  <h3 className="text-text-primary">{pillar.title}</h3>
                </div>
                <p className="text-xs text-text-muted leading-relaxed">{pillar.description}</p>
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl bg-surface-card border border-brand-primary/40 p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
          <div className="space-y-1 text-center sm:text-left">
            <h3 className="text-xl font-bold text-text-primary">Ready to screen your library?</h3>
            <p className="text-sm text-text-muted">
              Search a song or album, paste a track list, or stitch sources together in seconds.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onNavigateTab('scan')}
              className="min-h-[44px] sm:min-h-[40px] px-5 py-2 rounded-lg bg-brand-primary hover:bg-brand-primary-hover text-brand-foreground text-sm font-semibold transition shadow-md focus:outline-none focus:ring-2 focus:ring-ring-focus"
            >
              Launch Scan &amp; Clean
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('stitch')}
              className="min-h-[44px] sm:min-h-[40px] px-4 py-2 rounded-lg bg-surface-elevated hover:bg-surface-highest text-text-primary border border-border-subtle text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-ring-focus"
            >
              Open Stitch Studio
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
