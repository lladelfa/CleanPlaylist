import React, { useState, useEffect } from 'react';
import { Trash2, Music, FileText, Sparkles, CheckCircle2, ExternalLink } from 'lucide-react';
import VerificationStatusBadge from './VerificationStatusBadge';
import MobileTrackCard from './MobileTrackCard';
import { maskWord, maskText, getTrackFlaggedWords } from '../utils/masking';

function formatDuration(track) {
  if (track?.duration) return track.duration;
  if (typeof track?.duration_seconds === 'number' && track.duration_seconds > 0) {
    const mins = Math.floor(track.duration_seconds / 60);
    const secs = String(Math.floor(track.duration_seconds % 60)).padStart(2, '0');
    return `${mins}:${secs}`;
  }
  return '0:00';
}

export default function WorkingListWorkbench({
  tracks = [],
  onRemoveTrack,
  onClearList,
  onOpenLyrics,
  cleanCandidates = {},
  searchingClean = {},
  onFindClean,
  onSwapTrack,
  _keptTrackIds,
  _onKeepTrack,
  className = '',
  isMasked = true,
}) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' && typeof window.innerWidth === 'number'
      ? window.innerWidth < 768
      : false
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const validTracks = Array.isArray(tracks) ? tracks.filter(Boolean) : [];

  if (validTracks.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Working List Workbench"
      className={`bg-surface-card rounded-xl border border-border-subtle overflow-hidden shadow-xl ${className}`}
    >
      {/* Workbench Header */}
      <div className="p-4 md:p-5 border-b border-border-subtle flex items-center justify-between flex-wrap gap-3 bg-surface-inset/30">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-text-primary tracking-tight">
            Working List
          </h2>
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-surface-elevated border border-border-subtle text-text-muted">
            {validTracks.length} / 50 tracks
          </span>
        </div>

        {/* Clear List Button */}
        {onClearList && (
          <button
            type="button"
            onClick={onClearList}
            aria-label="Clear List"
            className="flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] sm:min-h-0 rounded-lg bg-surface-elevated hover:bg-surface-highest border border-border-subtle text-text-muted hover:text-status-flagged text-xs font-medium transition-colors active:scale-95"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Clear List</span>
          </button>
        )}
      </div>

      {/* Desktop View: Dense 6-column Table (>= 768px) */}
      {!isMobile && (
        <div className="hidden md:block overflow-x-hidden">
          <table className="table-fixed w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border-subtle text-[11px] font-mono text-text-muted uppercase tracking-wider bg-surface-inset/60">
                <th scope="col" className="py-2.5 px-3 w-10 text-center">#</th>
                <th scope="col" className="py-2.5 px-3">Title &amp; Artist</th>
                <th scope="col" className="py-2.5 px-3 w-[18%] hidden lg:table-cell">Album</th>
                <th scope="col" className="py-2.5 px-3 w-16 text-right">Duration</th>
                <th scope="col" className="py-2.5 px-3 w-[22%] lg:w-[18%]">Status</th>
                <th scope="col" className="py-2.5 px-3 w-[26%] lg:w-[16%] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle/40 text-xs">
              {validTracks.map((track, idx) => {
                const cleanCand = cleanCandidates[track.id];
                const isSearching = searchingClean[track.id];
                const wordsToMask = getTrackFlaggedWords(track, track.snippets?.[0]);

                return (
                  <tr
                    key={track.id || idx}
                    className={`hover:bg-surface-elevated/40 transition-colors ${
                      track.is_flagged ? 'bg-status-flagged/5' : ''
                    }`}
                  >
                    {/* 1. Index # */}
                    <td className="py-2.5 px-3 text-center font-mono text-text-muted text-[11px]">
                      {idx + 1}
                    </td>

                    {/* 2. Cover Art + Title & Artist */}
                    <td className="py-2.5 px-3 min-w-0">
                      <div className="flex items-center gap-3 min-w-0">
                        {track.thumbnail ? (
                          <img
                            src={track.thumbnail}
                            alt={track.title || 'Track artwork'}
                            className="w-10 h-10 rounded object-cover border border-border-subtle shrink-0 bg-surface-elevated"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded border border-border-subtle flex items-center justify-center bg-surface-elevated shrink-0 text-text-muted">
                            <Music className="w-5 h-5" aria-hidden="true" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <p
                              className="font-semibold text-text-primary truncate"
                              title={track.title || 'Untitled Track'}
                            >
                              {track.title || 'Untitled Track'}
                            </p>
                            {track.is_explicit && (
                              <span className="bg-status-flagged/20 text-status-flagged text-[10px] px-1 py-0.2 rounded border border-status-flagged/40 font-bold shrink-0">
                                E
                              </span>
                            )}
                          </div>
                          <p
                            className="text-text-muted truncate text-[11px]"
                            title={track.artist || 'Unknown Artist'}
                          >
                            {track.artist || 'Unknown Artist'}
                          </p>
                          {track.album ? (
                            <p
                              className="block lg:hidden text-text-muted/80 truncate text-[10px]"
                              title={track.album}
                            >
                              {track.album}
                            </p>
                          ) : null}
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
                              className="text-[11px] text-status-flagged mt-0.5 truncate text-left hover:underline cursor-pointer block max-w-full"
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
                    </td>

                    {/* 3. Album */}
                    <td className="py-2.5 px-3 text-text-muted truncate hidden lg:table-cell">
                      {track.album || '—'}
                    </td>

                    {/* 4. Duration */}
                    <td className="py-2.5 px-3 text-right font-mono text-text-muted text-[11px]">
                      {formatDuration(track)}
                    </td>

                    {/* 5. Verification Status Badge */}
                    <td className="py-2.5 px-3">
                      <VerificationStatusBadge
                        track={track}
                        status={track.verification_status}
                      />
                    </td>

                    {/* 6. Actions */}
                    <td className="py-2.5 px-3 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5 flex-nowrap min-w-0">
                        {onOpenLyrics && (
                          <button
                            type="button"
                            onClick={(e) => onOpenLyrics(track, e.currentTarget)}
                            title="View Lyrics"
                            aria-label="View lyrics"
                            className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-elevated rounded transition-colors"
                          >
                            <FileText className="w-4 h-4" aria-hidden="true" />
                          </button>
                        )}

                        {track.is_flagged && !cleanCand && onFindClean && (
                          <button
                            type="button"
                            onClick={() => onFindClean(track)}
                            disabled={isSearching}
                            title="Find Clean Edit"
                            aria-label="Find Clean Edit"
                            className="px-2 py-1 rounded bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-tint border border-brand-primary/30 text-xs font-medium transition-colors disabled:opacity-50 inline-flex items-center gap-1 shrink-0"
                          >
                            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>{isSearching ? '...' : 'Clean'}</span>
                          </button>
                        )}

                        {cleanCand && cleanCand !== 'none' && onSwapTrack && (
                          <button
                            type="button"
                            onClick={() => onSwapTrack(track, cleanCand)}
                            title="Swap to Clean"
                            aria-label="Swap to Clean"
                            className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow transition-colors inline-flex items-center gap-1 shrink-0"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Swap</span>
                          </button>
                        )}

                        {cleanCand === 'none' && (
                          <span className="text-[10px] text-text-muted italic">
                            No clean
                          </span>
                        )}

                        {track.video_url && (
                          <a
                            href={track.video_url}
                            target="_blank"
                            rel="noreferrer"
                            title="Open track link"
                            aria-label="Open track link"
                            className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-elevated rounded transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" aria-hidden="true" />
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={() => onRemoveTrack && onRemoveTrack(track)}
                          aria-label="Remove track"
                          title="Remove track"
                          className="p-1.5 text-text-muted hover:text-status-flagged hover:bg-surface-elevated rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile View: Stacked MobileTrackCard components (< 768px) */}
      {isMobile && (
        <div className="block md:hidden p-3 space-y-2.5">
          {validTracks.map((track, idx) => (
            <MobileTrackCard
              key={track.id || idx}
              track={track}
              index={idx}
              isMasked={isMasked}
              onRemoveTrack={onRemoveTrack}
              onOpenLyrics={onOpenLyrics}
              cleanCandidate={cleanCandidates[track.id]}
              isSearchingClean={searchingClean[track.id]}
              onFindClean={onFindClean}
              onSwapTrack={onSwapTrack}
            />
          ))}
        </div>
      )}
    </section>
  );
}
