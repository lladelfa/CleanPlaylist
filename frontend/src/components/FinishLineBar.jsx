import React from 'react';
import { CheckCircle2, Play, PlayCircle } from 'lucide-react';
import { getReadyTracks, launchYouTubeCleanQueue } from '../utils/finishLine';

export default function FinishLineBar({
  tracks = [],
  keptTrackIds,
  activePlatform = 'spotify',
  onNotice,
  className = '',
}) {
  const readyTracks = getReadyTracks(tracks, keptTrackIds);
  const readyCount = readyTracks.length;

  const isKept = (id) => {
    if (!id || !keptTrackIds) return false;
    if (keptTrackIds instanceof Set) return keptTrackIds.has(id);
    if (Array.isArray(keptTrackIds)) return keptTrackIds.includes(id);
    return false;
  };

  const flaggedCount = tracks.filter(
    (t) =>
      t &&
      (t.is_flagged || t.verification_status === 'flagged') &&
      t.verification_status !== 'clean_swapped' &&
      !isKept(t.id)
  ).length;

  // Don't render the dock if there are no tracks in the list at all
  if (!Array.isArray(tracks) || tracks.length === 0) {
    return null;
  }

  const handlePlayCleanQueue = () => {
    launchYouTubeCleanQueue({
      readyTracks,
      platform: activePlatform,
      onNotice,
      openWindow: true,
    });
  };

  return (
    <footer
      aria-label="Finish Line Controls"
      className={`fixed bottom-0 left-0 right-0 z-40 bg-surface-inset/95 backdrop-blur-md border-t border-border-subtle px-4 md:px-8 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-2xl transition-all ${className}`}
    >
      {/* Mobile Layout (< 768px) */}
      <div className="flex flex-col gap-2.5 md:hidden">
        {flaggedCount > 0 && (
          <div
            aria-live="polite"
            aria-atomic="true"
            className="flex items-center justify-between text-xs"
          >
            <span className="text-text-muted">{readyCount} tracks ready</span>
            <span className="text-status-flagged font-medium">{flaggedCount} need review</span>
          </div>
        )}

        {/* Primary CTA Full-Width on Mobile */}
        <button
          type="button"
          onClick={handlePlayCleanQueue}
          disabled={readyCount === 0}
          aria-label={`Play Clean Queue (${readyCount})`}
          className="w-full min-h-[46px] rounded-xl bg-brand-primary hover:bg-brand-primary-hover text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-brand-primary/25 active:scale-[0.98] transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Play className="w-4 h-4 fill-current" aria-hidden="true" />
          <span>Play Clean Queue ({readyCount})</span>
        </button>
      </div>

      {/* Desktop Layout (>= 768px) */}
      <div className="hidden md:flex items-center justify-between gap-4">
        {/* Left: Status Summary */}
        <div
          aria-live="polite"
          aria-atomic="true"
          className="flex items-center gap-3"
        >
          <div className="w-8 h-8 rounded-full bg-status-clean-bg border border-status-clean-border/40 flex items-center justify-center text-status-clean shrink-0">
            <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <span>
                {readyCount} {readyCount === 1 ? 'track' : 'tracks'} ready
              </span>
              {flaggedCount > 0 && (
                <>
                  <span className="text-border-subtle">•</span>
                  <span className="text-status-flagged font-normal text-xs">
                    {flaggedCount} need review
                  </span>
                </>
              )}
            </p>
            <p className="text-xs text-text-muted">
              All audio matches verified against high-compliance radio screening filters
            </p>
          </div>
        </div>

        {/* Right: Actions Cluster */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handlePlayCleanQueue}
            disabled={readyCount === 0}
            aria-label="Play Clean Queue"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-primary hover:bg-brand-primary-hover text-white text-sm font-semibold transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-brand-primary/20"
          >
            <PlayCircle className="w-4 h-4 text-white" aria-hidden="true" />
            <span>Play Clean Queue</span>
          </button>
        </div>
      </div>
    </footer>
  );
}
