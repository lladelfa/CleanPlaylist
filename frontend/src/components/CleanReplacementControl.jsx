import React from 'react';
import { Sparkles, RefreshCw, ArrowLeftRight, Trash2, RotateCcw } from 'lucide-react';
import { formatDurationDelta } from '../utils/swapHelpers';

export default function CleanReplacementControl({
  track,
  cleanCandidate,
  cleanAlternatives = [],
  isSearching = false,
  onFindClean,
  onSwapTrack,
  onOpenAlternatives,
  onRemoveTrack,
  showRemoveOnNoMatch = true,
  variant = 'desktop',
}) {
  if (!track) return null;

  const isMobile = variant === 'mobile';
  const isSwapped = Boolean(track.was_replaced || track.verification_status === 'clean_swapped');

  if (isSwapped && onOpenAlternatives) {
    return (
      <button
        type="button"
        onClick={(e) => onOpenAlternatives(track, e.currentTarget)}
        aria-label="Change / Undo"
        title="Change match or revert to original track"
        className={
          isMobile
            ? 'min-h-[44px] min-w-[44px] px-2.5 py-1.5 rounded-lg bg-surface-elevated hover:bg-surface-highest text-text-secondary hover:text-text-primary border border-border-subtle flex items-center justify-center gap-1.5 text-xs font-medium transition-colors'
            : 'px-2.5 py-1 rounded-lg bg-surface-elevated hover:bg-surface-highest text-text-secondary hover:text-text-primary border border-border-subtle text-xs font-medium inline-flex items-center gap-1.5 shrink-0 transition-colors'
        }
      >
        <RotateCcw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>Change / Undo</span>
      </button>
    );
  }

  if (cleanCandidate === 'none') {
    return (
      <div className="inline-flex items-center gap-1.5 shrink-0">
        <span className="text-[11px] text-text-muted italic">
          No clean version found
        </span>
        {showRemoveOnNoMatch && (
          <button
            type="button"
            onClick={() => onRemoveTrack && onRemoveTrack(track)}
            aria-label="Remove track"
            title="Remove track"
            className={`${
              isMobile ? 'min-h-[44px] min-w-[44px] px-2.5 py-1.5' : 'px-2 py-1'
            } rounded-lg text-text-muted hover:text-status-flagged hover:bg-surface-elevated inline-flex items-center gap-1 text-xs transition-colors`}
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Remove</span>
          </button>
        )}
      </div>
    );
  }

  if (cleanCandidate && typeof cleanCandidate === 'object') {
    const deltaLabel = formatDurationDelta(track, cleanCandidate);
    const candTitle = cleanCandidate.title || track.title || 'Clean Edit';
    const altCount = Array.isArray(cleanAlternatives) ? cleanAlternatives.length : 0;

    return (
      <div className="inline-flex items-center gap-1.5 shrink-0 flex-wrap">
        <button
          type="button"
          onClick={() => onSwapTrack && onSwapTrack(track, cleanCandidate)}
          aria-label="Swap to Clean"
          title={`Swap to Clean: ${candTitle} (${deltaLabel})`}
          className={
            isMobile
              ? 'min-h-[44px] min-w-[44px] px-3 py-1.5 rounded-lg bg-status-clean hover:bg-status-clean/90 text-status-clean-ink border border-status-clean-border flex items-center justify-center gap-1.5 text-xs font-semibold shadow transition-colors max-w-full'
              : 'px-2.5 py-1 rounded-lg bg-status-clean-bg hover:bg-status-clean/20 text-status-clean border border-status-clean-border text-xs font-semibold transition-colors inline-flex items-center gap-1 shrink-0'
          }
        >
          <ArrowLeftRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span className="shrink-0">Swap to Clean</span>
          {isMobile && (
            <span className="truncate font-normal opacity-90 text-[11px]">
              • {candTitle}
            </span>
          )}
          <span className="shrink-0 font-mono font-normal opacity-90 text-[11px]">
            ({deltaLabel})
          </span>
        </button>

        {altCount >= 2 && onOpenAlternatives && (
          <button
            type="button"
            onClick={(e) => onOpenAlternatives(track, e.currentTarget)}
            aria-label={`Other matches (${altCount})`}
            title={`Choose from ${altCount} clean matches`}
            className={
              isMobile
                ? 'min-h-[44px] min-w-[44px] px-2.5 py-1.5 rounded-lg bg-surface-elevated hover:bg-surface-highest text-brand-tint border border-border-subtle flex items-center justify-center text-xs font-medium transition-colors'
                : 'px-2 py-1 rounded-lg bg-surface-elevated hover:bg-surface-highest text-brand-tint border border-border-subtle text-xs font-medium inline-flex items-center shrink-0 transition-colors'
            }
          >
            <span>Other matches ({altCount})</span>
          </button>
        )}
      </div>
    );
  }

  if (isSearching) {
    return (
      <button
        type="button"
        disabled
        aria-label="Searching…"
        className={
          isMobile
            ? 'min-h-[44px] min-w-[44px] px-2.5 py-1.5 rounded-lg bg-surface-elevated text-text-muted border border-border-subtle flex items-center justify-center gap-1.5 text-xs opacity-75 cursor-not-allowed'
            : 'px-2.5 py-1 rounded-lg bg-surface-elevated text-text-muted border border-border-subtle text-xs font-medium inline-flex items-center gap-1.5 shrink-0 opacity-75 cursor-not-allowed'
        }
      >
        <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" aria-hidden="true" />
        <span>Searching…</span>
      </button>
    );
  }

  if (track.is_flagged && onFindClean) {
    return (
      <button
        type="button"
        onClick={() => onFindClean(track)}
        title="Find Clean Edit"
        aria-label="Find Clean Edit"
        className={
          isMobile
            ? 'min-h-[44px] min-w-[44px] px-2.5 py-1.5 rounded-lg bg-surface-elevated hover:bg-surface-highest text-brand-tint border border-border-subtle flex items-center justify-center gap-1.5 text-xs font-medium transition-colors'
            : 'px-2 py-1 rounded-lg bg-surface-elevated hover:bg-surface-highest text-brand-tint border border-border-subtle text-xs font-medium transition-colors inline-flex items-center gap-1 shrink-0'
        }
      >
        <Sparkles className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>Find Clean Edit</span>
      </button>
    );
  }

  return null;
}
