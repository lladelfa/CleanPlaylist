import React, { useState, useEffect } from 'react';
import { Trash2, Music, FileText, ExternalLink } from 'lucide-react';
import VerificationStatusBadge from './VerificationStatusBadge';
import MobileTrackCard from './MobileTrackCard';
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

export default function WorkingListWorkbench({
  tracks = [],
  onRemoveTrack,
  onClearList,
  onOpenLyrics,
  cleanCandidates = {},
  searchingClean = {},
  onFindClean,
  onSwapTrack,
  keptTrackIds,
  _onKeepTrack,
  className = '',
  isMasked = true,
  title = 'Working List',
  subtitle = '',
  totalTrackCount,
  headerActions = null,
  toolbar = null,
  activePlatform = 'spotify',
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
  const effectiveTotalCount = Number.isFinite(totalTrackCount) && totalTrackCount >= 0 ? totalTrackCount : validTracks.length;

  if (validTracks.length === 0 && effectiveTotalCount <= 0) {
    return null;
  }

  return (
    <section
      aria-label="Working List Workbench"
      className={`bg-surface-card rounded-2xl border border-border-subtle overflow-hidden shadow-2xl ${className}`}
    >
      {/* Workbench Header */}
      <div className="p-4 md:p-5 border-b border-border-subtle flex items-center justify-between flex-wrap gap-3 bg-surface-inset/30">
        <div className="flex flex-col gap-1.5">
          <span className="inline-flex self-start items-center px-2 py-0.5 rounded bg-surface-elevated border border-border-subtle text-[11px] font-mono font-semibold uppercase tracking-wider text-brand-tint">
            03 / TRACK WORKBENCH
          </span>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-lg font-bold text-text-primary tracking-tight">
              {title || 'Working List'}
            </h2>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-surface-elevated border border-border-subtle text-text-muted">
              {effectiveTotalCount} / 50 tracks
            </span>
          </div>
          {subtitle && (
            <p className="text-xs text-text-muted">{subtitle}</p>
          )}
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          {headerActions}

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
      </div>

      {/* Optional Filter & Search Toolbar */}
      {toolbar && (
        <div className="px-4 md:px-5 py-3 border-b border-border-subtle bg-surface-inset/40">
          {toolbar}
        </div>
      )}

      {validTracks.length === 0 ? (
        <div className="py-12 text-center text-text-muted text-sm">
          No tracks match the selected filter.
        </div>
      ) : (
        <>
          {/* Desktop View: Dense 6-column Table (>= 768px) */}
          {!isMobile && (
            <div className="hidden md:block overflow-x-hidden">
              <table className="table-fixed w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border-subtle text-[11px] font-mono text-text-muted uppercase tracking-wider bg-surface-inset/80">
                    <th scope="col" className="py-2.5 px-3 w-10 text-center">#</th>
                    <th scope="col" className="py-2.5 px-3">Title &amp; Artist</th>
                    <th scope="col" className="py-2.5 px-3 w-[18%] hidden lg:table-cell">Album</th>
                    <th scope="col" className="py-2.5 px-3 w-16 text-right">Duration</th>
                    <th scope="col" className="py-2.5 px-3 w-[20%] lg:w-[15%]">Status</th>
                    <th scope="col" className="py-2.5 px-3 w-[28%] lg:w-[22%] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/40 text-xs">
                  {validTracks.map((track, idx) => {
                    const cleanCand = cleanCandidates[track.id];
                    const isSearching = searchingClean[track.id];
                    const wordsToMask = getTrackFlaggedWords(track, track.snippets?.[0]);
                    const isReady = isTrackReady(track, keptTrackIds);
                    const canonicalUrl = getTrackCanonicalUrl(track, activePlatform) || track.video_url;
                    const linkLabel = isReady ? 'Open Clean Track' : 'Open track link';
                    const linkTitle = isReady
                      ? `Open Clean Track: ${track.title || 'Track'}`
                      : `Open track link: ${track.title || 'Track'}`;

                    return (
                      <tr
                        key={track.id || idx}
                        className={`hover:bg-surface-elevated/40 transition-colors ${
                          track.is_flagged ? 'border-l-2 border-l-status-flagged-border/60 bg-status-flagged/5' : ''
                        }`}
                      >
                        {/* 1. Index # */}
                        <td
                          className={`py-2.5 px-3 text-center font-mono text-text-muted text-[11px] ${
                            track.is_flagged ? 'border-l-2 border-l-status-flagged-border/60' : ''
                          }`}
                        >
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

                            <CleanReplacementControl
                              track={track}
                              cleanCandidate={cleanCand}
                              isSearching={Boolean(isSearching)}
                              onFindClean={onFindClean}
                              onSwapTrack={onSwapTrack}
                              onRemoveTrack={onRemoveTrack}
                              variant="desktop"
                            />

                            {canonicalUrl && (
                              <a
                                href={canonicalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={linkTitle}
                                aria-label={linkLabel}
                                className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-elevated rounded transition-colors"
                              >
                                <ExternalLink className="w-4 h-4" aria-hidden="true" />
                              </a>
                            )}

                            {cleanCand !== 'none' && (
                              <button
                                type="button"
                                onClick={() => onRemoveTrack && onRemoveTrack(track)}
                                aria-label="Remove track"
                                title="Remove track"
                                className="p-1.5 text-text-muted hover:text-status-flagged hover:bg-surface-elevated rounded transition-colors"
                              >
                                <Trash2 className="w-4 h-4" aria-hidden="true" />
                              </button>
                            )}
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
                  activePlatform={activePlatform}
                  keptTrackIds={keptTrackIds}
                />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
