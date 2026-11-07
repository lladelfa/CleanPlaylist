import React from 'react';
import { Info, X, ArrowDown, Search } from 'lucide-react';

export default function SpotifyPlaylistHelper({
  onFocusPaste,
  onSearchAlbumsInstead,
  onDismiss,
  className = '',
}) {
  return (
    <section
      aria-label="Spotify Playlist Helper"
      className={`w-full bg-surface-card border border-brand-accent/40 rounded-xl p-4 flex flex-col gap-3.5 shadow-sm transition-all ${className}`}
    >
      {/* Top Banner Row: Info Icon, Title, Description, Actions & Dismiss */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-brand-accent/15 border border-brand-accent/30 flex items-center justify-center text-brand-accent shrink-0 mt-0.5">
            <Info className="w-4 h-4" aria-hidden="true" />
          </div>
          <div className="flex flex-col gap-0.5 min-w-0">
            <h3 className="text-sm font-semibold text-text-primary">
              Public Spotify playlist links require a quick copy-paste (no login needed)
            </h3>
            <p className="text-xs text-text-muted">
              Due to Spotify Web API limitations for zero-login queries, public playlists cannot be crawled anonymously. Use the 3-second desktop clipboard bypass:
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <button
            type="button"
            onClick={onSearchAlbumsInstead}
            className="px-3 py-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-elevated text-xs font-medium transition-colors flex items-center gap-1"
          >
            <Search className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Search Albums Instead</span>
          </button>
          <button
            type="button"
            onClick={onFocusPaste}
            className="px-3 py-1.5 rounded-lg bg-brand-accent/20 border border-brand-accent/40 text-brand-tint hover:bg-brand-accent/30 text-xs font-semibold transition-colors flex items-center gap-1 active:scale-95"
          >
            <span>Focus Paste Box</span>
            <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss helper"
              className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* 3 Step Guidance */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-2 border-t border-border-subtle/50 text-xs">
        <div className="flex items-center gap-2.5 bg-surface-inset/60 p-2.5 rounded-lg border border-border-subtle/40">
          <span className="w-5 h-5 rounded-full bg-surface-elevated text-brand-tint font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
            1
          </span>
          <span className="text-text-primary">Open playlist in Spotify Desktop</span>
        </div>
        <div className="flex items-center gap-2.5 bg-surface-inset/60 p-2.5 rounded-lg border border-border-subtle/40">
          <span className="w-5 h-5 rounded-full bg-surface-elevated text-brand-tint font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
            2
          </span>
          <span className="text-text-primary">
            Select tracks (<kbd className="px-1 py-0.5 rounded bg-surface-elevated font-mono text-[10px]">Ctrl+A</kbd> / <kbd className="px-1 py-0.5 rounded bg-surface-elevated font-mono text-[10px]">Cmd+A</kbd>) &amp; Copy (<kbd className="px-1 py-0.5 rounded bg-surface-elevated font-mono text-[10px]">Ctrl+C</kbd> / <kbd className="px-1 py-0.5 rounded bg-surface-elevated font-mono text-[10px]">Cmd+C</kbd>)
          </span>
        </div>
        <div className="flex items-center gap-2.5 bg-surface-inset/60 p-2.5 rounded-lg border border-border-subtle/40">
          <span className="w-5 h-5 rounded-full bg-surface-elevated text-brand-tint font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
            3
          </span>
          <span className="text-text-primary">Paste track links or Artist - Title lines below</span>
        </div>
      </div>
    </section>
  );
}
