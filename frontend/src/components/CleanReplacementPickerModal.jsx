import React, { useEffect, useRef, useCallback } from 'react';
import {
  X,
  Music2,
  ExternalLink,
  RotateCcw,
  RefreshCw,
  Check,
  ArrowLeftRight,
} from 'lucide-react';
import { formatDurationDelta } from '../utils/swapHelpers';
import { getTrackCanonicalUrl } from '../utils/finishLine';

function formatTrackDuration(track) {
  if (track?.duration) return track.duration;
  if (typeof track?.duration_seconds === 'number' && track.duration_seconds > 0) {
    const mins = Math.floor(track.duration_seconds / 60);
    const secs = String(Math.floor(track.duration_seconds % 60)).padStart(2, '0');
    return `${mins}:${secs}`;
  }
  return '0:00';
}

export default function CleanReplacementPickerModal({
  track,
  alternatives = [],
  activePlatform = 'spotify',
  isFetching = false,
  fetchError = null,
  onSelectAlternative,
  onRevert,
  onFetchAlternatives,
  onClose,
  triggerEl,
  triggerRef,
}) {
  const dialogRef = useRef(null);
  const previousActiveElement = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (triggerRef?.current) {
      previousActiveElement.current = triggerRef.current;
    } else if (triggerEl) {
      previousActiveElement.current = triggerEl;
    } else if (!previousActiveElement.current && typeof document !== 'undefined') {
      previousActiveElement.current = document.activeElement;
    }
  }, [triggerEl, triggerRef]);

  const handleClose = useCallback(() => {
    onCloseRef.current?.();
    if (previousActiveElement.current && typeof previousActiveElement.current.focus === 'function') {
      try {
        previousActiveElement.current.focus();
      } catch {
        // Safe fallback in test environments
      }
    }
  }, []);

  useEffect(() => {
    if (!track) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
        return;
      }

      if (e.key === 'Tab') {
        if (!dialogRef.current) return;
        const focusableSelectors = [
          'button:not([disabled])',
          'a[href]',
          'input:not([disabled])',
          'select:not([disabled])',
          'textarea:not([disabled])',
          '[tabindex]:not([tabindex="-1"])',
        ].join(', ');

        const focusables = Array.from(dialogRef.current.querySelectorAll(focusableSelectors));
        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (!dialogRef.current.contains(document.activeElement)) {
          e.preventDefault();
          if (e.shiftKey) {
            last.focus();
          } else {
            first.focus();
          }
          return;
        }

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    if (dialogRef.current && typeof dialogRef.current.focus === 'function') {
      dialogRef.current.focus();
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [track, handleClose]);

  if (!track) return null;

  const isSwapped = Boolean(track.was_replaced || track.verification_status === 'clean_swapped');
  const originalTrack = track.original_track || track;
  const candidateList = Array.isArray(alternatives) ? alternatives.slice(0, 5) : [];
  const platformLabel = activePlatform === 'spotify' ? 'Spotify' : 'YouTube Music';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-backdrop/80 backdrop-blur-md animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="clean-picker-modal-title"
        tabIndex={-1}
        className="bg-surface-card border border-border-subtle rounded-2xl shadow-2xl overflow-hidden max-w-2xl w-full max-h-[85vh] flex flex-col focus:outline-none"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border-subtle flex items-start justify-between bg-surface-card shrink-0">
          <div className="min-w-0 flex-1 pr-3">
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 text-brand-tint shrink-0" aria-hidden="true" />
              <h3
                id="clean-picker-modal-title"
                className="text-base sm:text-lg font-bold text-text-primary truncate"
              >
                {isSwapped ? 'Change or Undo Clean Swap' : 'Choose Clean Match'}
              </h3>
            </div>
            <p className="text-xs text-text-muted mt-1 truncate">
              Original:{' '}
              <span className="text-text-secondary font-medium">
                {originalTrack.title || 'Untitled Track'}
              </span>
              {originalTrack.artist ? ` — ${originalTrack.artist}` : ''}
              {originalTrack.duration_seconds > 0 || originalTrack.duration
                ? ` (${formatTrackDuration(originalTrack)})`
                : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close modal"
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-text-muted hover:text-text-primary rounded-lg hover:bg-surface-elevated transition-colors shrink-0"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Body: Ranked Alternatives List */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3 bg-surface-inset/30">
          {fetchError && (
            <div
              role="alert"
              className="px-3.5 py-2.5 rounded-xl bg-status-flagged-bg/60 border border-status-flagged-border text-status-flagged text-xs"
            >
              {fetchError}
            </div>
          )}

          {candidateList.length === 0 ? (
            <div className="py-8 px-4 text-center bg-surface-card rounded-xl border border-border-subtle space-y-3">
              <p className="text-sm text-text-muted">
                No cached alternative matches are available for this track.
              </p>
              {onFetchAlternatives && (
                <button
                  type="button"
                  onClick={() => onFetchAlternatives(track)}
                  disabled={isFetching}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-brand-primary hover:bg-brand-primary-hover disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors shadow"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`}
                    aria-hidden="true"
                  />
                  <span>{isFetching ? 'Fetching Matches…' : 'Fetch Other Matches'}</span>
                </button>
              )}
            </div>
          ) : (
            <ul className="space-y-2.5" aria-label="Ranked replacement candidates">
              {candidateList.map((candidate, idx) => {
                const isCurrent = isSwapped && candidate.id === track.id;
                const deltaLabel = formatDurationDelta(originalTrack, candidate);
                const canonicalUrl =
                  getTrackCanonicalUrl(candidate, activePlatform) || candidate.video_url;

                return (
                  <li
                    key={candidate.id || idx}
                    className={`p-3 rounded-xl border transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isCurrent
                        ? 'bg-status-clean-bg/40 border-status-clean-border'
                        : 'bg-surface-card border-border-subtle hover:border-brand-primary/40'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="text-[11px] font-mono font-semibold text-text-muted w-5 shrink-0 text-center">
                        #{idx + 1}
                      </span>

                      {candidate.thumbnail ? (
                        <img
                          src={candidate.thumbnail}
                          alt={candidate.title || 'Candidate artwork'}
                          className="w-11 h-11 rounded-lg object-cover border border-border-subtle shrink-0 bg-surface-elevated"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-lg bg-surface-elevated border border-border-subtle flex items-center justify-center shrink-0">
                          <Music2 className="w-5 h-5 text-text-muted" aria-hidden="true" />
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-semibold text-text-primary truncate">
                            {candidate.title || 'Untitled Track'}
                          </span>
                          {candidate.is_explicit && (
                            <span
                              title="Marked Explicit"
                              className="bg-status-flagged-bg text-status-flagged text-[10px] px-1.5 py-0.5 rounded border border-status-flagged-border font-bold shrink-0"
                            >
                              E
                            </span>
                          )}
                          {isCurrent && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-status-clean-bg text-status-clean border border-status-clean-border text-[10px] font-semibold shrink-0">
                              <Check className="w-3 h-3" aria-hidden="true" />
                              Current
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-text-muted truncate">
                          {candidate.artist || 'Unknown Artist'}
                          {candidate.album ? ` • ${candidate.album}` : ''}
                        </p>
                        <p className="text-[11px] font-mono text-text-muted mt-0.5">
                          {formatTrackDuration(candidate)} ({deltaLabel})
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 justify-end">
                      {canonicalUrl && (
                        <a
                          href={canonicalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Verify ${candidate.title || 'track'} on ${platformLabel}`}
                          title={`Open on ${platformLabel}`}
                          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg bg-surface-elevated hover:bg-surface-highest text-text-muted hover:text-text-primary border border-border-subtle transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" aria-hidden="true" />
                        </a>
                      )}

                      <button
                        type="button"
                        disabled={isCurrent}
                        onClick={() => {
                          if (!isCurrent && onSelectAlternative) {
                            onSelectAlternative(track, candidate);
                          }
                        }}
                        className={`min-h-[44px] px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1.5 shrink-0 ${
                          isCurrent
                            ? 'bg-surface-elevated text-text-muted border border-border-subtle opacity-75 cursor-not-allowed'
                            : 'bg-brand-primary hover:bg-brand-primary-hover text-white shadow'
                        }`}
                      >
                        <span>{isCurrent ? 'Selected' : 'Use This Match'}</span>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {isSwapped && candidateList.length === 1 && onFetchAlternatives && (
            <div className="pt-2 flex justify-center">
              <button
                type="button"
                onClick={() => onFetchAlternatives(track)}
                disabled={isFetching}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-surface-elevated hover:bg-surface-highest disabled:opacity-60 disabled:cursor-not-allowed text-brand-tint border border-border-subtle text-xs font-semibold inline-flex items-center gap-2 transition-colors"
              >
                <RefreshCw
                  className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                <span>{isFetching ? 'Fetching Matches…' : 'Fetch Other Matches'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-border-subtle bg-surface-card flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div>
            {isSwapped && track.original_track && onRevert && (
              <button
                type="button"
                onClick={() => onRevert(track)}
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-surface-elevated hover:bg-status-flagged-bg/50 text-text-primary hover:text-status-flagged border border-border-subtle hover:border-status-flagged-border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Revert to Original</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-surface-elevated hover:bg-surface-highest text-text-secondary hover:text-text-primary border border-border-subtle text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
