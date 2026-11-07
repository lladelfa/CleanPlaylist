import React from 'react';
import { Music, Trash2, FileText, Sparkles, CheckCircle2, ExternalLink } from 'lucide-react';
import VerificationStatusBadge from './VerificationStatusBadge';

function formatDuration(track) {
  if (track?.duration) return track.duration;
  if (typeof track?.duration_seconds === 'number' && track.duration_seconds > 0) {
    const mins = Math.floor(track.duration_seconds / 60);
    const secs = String(Math.floor(track.duration_seconds % 60)).padStart(2, '0');
    return `${mins}:${secs}`;
  }
  return '0:00';
}

export default function MobileTrackCard({
  track,
  index,
  onRemoveTrack,
  onOpenLyrics,
  cleanCandidate,
  isSearchingClean,
  onFindClean,
  onSwapTrack,
  className = '',
}) {
  if (!track) return null;

  const displayDuration = formatDuration(track);

  return (
    <article
      className={`w-full max-w-full bg-surface-card border rounded-xl p-3 flex flex-col gap-2.5 transition-all overflow-hidden ${
        track.is_flagged
          ? 'border-status-flagged/40 bg-surface-card'
          : 'border-border-subtle bg-surface-card'
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-2.5 min-w-0">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {/* Index or Artwork */}
          {track.thumbnail ? (
            <img
              src={track.thumbnail}
              alt={track.title || 'Track artwork'}
              className="w-11 h-11 rounded-lg object-cover border border-border-subtle shrink-0 bg-surface-elevated"
            />
          ) : (
            <div className="w-11 h-11 rounded-lg bg-surface-elevated border border-border-subtle shrink-0 flex items-center justify-center text-text-muted">
              <Music className="w-5 h-5" aria-hidden="true" />
            </div>
          )}

          {/* Title, Artist, Album */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h4 className="text-sm font-semibold text-text-primary truncate">
                {track.title || 'Untitled Track'}
              </h4>
              {track.is_explicit && (
                <span className="bg-status-flagged/20 text-status-flagged text-[10px] px-1 py-0.2 rounded border border-status-flagged/40 font-bold shrink-0">
                  E
                </span>
              )}
            </div>
            <p className="text-xs text-text-muted truncate">
              {track.artist || 'Unknown Artist'}
            </p>
            {track.album && (
              <p className="text-[11px] text-text-muted/80 truncate">
                {track.album}
              </p>
            )}
            {track.snippets && track.snippets.length > 0 ? (
              <button
                type="button"
                onClick={(e) => onOpenLyrics && onOpenLyrics(track, e.currentTarget)}
                aria-label="Inspect lyric snippet"
                className="text-[11px] text-status-flagged mt-0.5 truncate text-left hover:underline cursor-pointer flex items-center gap-1 max-w-full"
                title="Inspect lyric snippet"
              >
                {typeof track.snippets[0].line_number === 'number' && (
                  <span className="font-mono text-[10px] opacity-80 shrink-0">
                    L{String(track.snippets[0].line_number).padStart(2, '0')}:
                  </span>
                )}
                <span className="truncate italic">"{track.snippets[0].text}"</span>
              </button>
            ) : track.reasons && track.reasons.length > 0 ? (
              <button
                type="button"
                onClick={(e) => onOpenLyrics && onOpenLyrics(track, e.currentTarget)}
                aria-label="Inspect flagged reasons"
                className="text-[11px] text-status-flagged mt-0.5 truncate text-left hover:underline cursor-pointer"
                title="Inspect flagged reasons"
              >
                {track.reasons.join(' • ')}
              </button>
            ) : null}
          </div>
        </div>

        {/* Status Badge */}
        <div className="shrink-0 pt-0.5">
          <VerificationStatusBadge
            track={track}
            status={track.verification_status}
          />
        </div>
      </div>

      {/* Bottom Info & Touch Action Row */}
      <div className="flex items-center justify-between pt-2 border-t border-border-subtle/50 text-xs text-text-muted min-w-0 flex-wrap gap-2">
        <div className="flex items-center gap-2 font-mono">
          {typeof index === 'number' && (
            <span className="text-[11px] text-text-muted">#{index + 1}</span>
          )}
          <span>{displayDuration}</span>
        </div>

        {/* Touch Actions >= 44px min touch target */}
        <div className="flex items-center gap-1.5 ml-auto">
          {onOpenLyrics && (
            <button
              type="button"
              onClick={(e) => onOpenLyrics(track, e.currentTarget)}
              aria-label="View lyrics"
              title="View lyrics"
              className="min-h-[44px] min-w-[44px] px-2.5 py-1.5 rounded-lg bg-surface-elevated hover:bg-surface-highest text-text-muted hover:text-text-primary flex items-center justify-center gap-1 transition-colors"
            >
              <FileText className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="text-xs">Lyrics</span>
            </button>
          )}

          {track.is_flagged && !cleanCandidate && onFindClean && (
            <button
              type="button"
              onClick={() => onFindClean(track)}
              disabled={isSearchingClean}
              className="min-h-[44px] min-w-[44px] px-2.5 py-1.5 rounded-lg bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-tint border border-brand-primary/30 flex items-center justify-center gap-1 text-xs transition-colors disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{isSearchingClean ? 'Searching...' : 'Find Clean'}</span>
            </button>
          )}

          {cleanCandidate && cleanCandidate !== 'none' && onSwapTrack && (
            <button
              type="button"
              onClick={() => onSwapTrack(track, cleanCandidate)}
              className="min-h-[44px] min-w-[44px] px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-1 text-xs font-semibold shadow transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Swap</span>
            </button>
          )}

          {cleanCandidate === 'none' && (
            <span className="text-[11px] text-text-muted italic px-1">
              No clean version
            </span>
          )}

          {track.video_url && (
            <a
              href={track.video_url}
              target="_blank"
              rel="noreferrer"
              title="Open track link"
              aria-label="Open track link"
              className="min-h-[44px] min-w-[44px] rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-elevated flex items-center justify-center transition-colors"
            >
              <ExternalLink className="w-4 h-4" aria-hidden="true" />
            </a>
          )}

          <button
            type="button"
            onClick={() => onRemoveTrack && onRemoveTrack(track)}
            aria-label="Remove track"
            title="Remove track"
            className="min-h-[44px] min-w-[44px] px-3 py-2 rounded-lg text-text-muted hover:text-status-flagged hover:bg-surface-elevated flex items-center justify-center transition-colors active:scale-95"
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}
