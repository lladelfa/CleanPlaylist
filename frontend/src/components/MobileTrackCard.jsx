import React from 'react';
import { Music, Trash2, FileText, ExternalLink } from 'lucide-react';
import VerificationStatusBadge from './VerificationStatusBadge';
import CleanReplacementControl from './CleanReplacementControl';
import { maskWord, maskText, getTrackFlaggedWords } from '../utils/masking';
import { getTrackCanonicalUrl, isTrackReady } from '../utils/finishLine';

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
  isMasked = true,
  activePlatform = 'spotify',
  keptTrackIds,
}) {
  if (!track) return null;

  const displayDuration = formatDuration(track);
  const wordsToMask = getTrackFlaggedWords(track, track.snippets?.[0]);

  const isReady = isTrackReady(track, keptTrackIds);
  const canonicalUrl = getTrackCanonicalUrl(track, activePlatform) || track.video_url;
  const linkLabel = isReady ? 'Open Clean Track' : 'Open track link';
  const linkTitle = isReady
    ? `Open Clean Track: ${track.title || 'Track'}`
    : `Open track link: ${track.title || 'Track'}`;

  return (
    <article
      className={`w-full max-w-full bg-surface-card border rounded-xl p-3 flex flex-col gap-2.5 transition-all overflow-hidden ${
        track.is_flagged
          ? 'border-status-flagged/40 border-l-2 border-l-status-flagged-border/60 bg-surface-card'
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
                <span className="truncate italic">
                  "{isMasked ? maskText(track.snippets[0].text, wordsToMask, true) : track.snippets[0].text}"
                </span>
              </button>
            ) : track.reasons && track.reasons.length > 0 ? (
              <button
                type="button"
                onClick={(e) => onOpenLyrics && onOpenLyrics(track, e.currentTarget)}
                aria-label="Inspect flagged reasons"
                className="text-[11px] text-status-flagged mt-0.5 truncate text-left hover:underline cursor-pointer"
                title="Inspect flagged reasons"
              >
                {track.reasons
                  .map((reason) => {
                    if (!isMasked || typeof reason !== 'string') return reason;
                    if (!reason.includes(' ')) return maskWord(reason);
                    return maskText(reason, wordsToMask, true);
                  })
                  .join(' • ')}
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

          <CleanReplacementControl
            track={track}
            cleanCandidate={cleanCandidate}
            isSearching={Boolean(isSearchingClean)}
            onFindClean={onFindClean}
            onSwapTrack={onSwapTrack}
            onRemoveTrack={onRemoveTrack}
            variant="mobile"
          />

          {canonicalUrl && (
            <a
              href={canonicalUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={linkTitle}
              aria-label={linkLabel}
              className="min-h-[44px] min-w-[44px] rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-elevated flex items-center justify-center transition-colors"
            >
              <ExternalLink className="w-4 h-4" aria-hidden="true" />
            </a>
          )}

          {cleanCandidate !== 'none' && (
            <button
              type="button"
              onClick={() => onRemoveTrack && onRemoveTrack(track)}
              aria-label="Remove track"
              title="Remove track"
              className="min-h-[44px] min-w-[44px] px-3 py-2 rounded-lg text-text-muted hover:text-status-flagged hover:bg-surface-elevated flex items-center justify-center transition-colors active:scale-95"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
