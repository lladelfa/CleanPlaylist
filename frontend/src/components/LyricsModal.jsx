import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { X, AlertTriangle, CheckCircle, Music2, ExternalLink, RefreshCw, ChevronUp, ChevronDown, ArrowLeftRight } from 'lucide-react';
import { evaluateLyrics } from '../utils/lyricEvaluator';
import { maskWord, maskText } from '../utils/masking';
import { VERIFIED_CLEAN_CAVEAT, isVerifiedCleanTrack } from '../utils/verifiedCleanCaveat';
function formatDurationDelta(originalTrack, candidateTrack) {
  const origSec = Number(originalTrack?.duration_seconds) || 0;
  const candSec = Number(candidateTrack?.duration_seconds) || 0;
  if (origSec <= 0 || candSec <= 0) return '0s';
  const diff = Math.round(candSec - origSec);
  if (diff > 0) return `+${diff}s`;
  if (diff < 0) return `${diff}s`;
  return '0s';
}

const EMPTY_OBJECT = {};
const EMPTY_ARRAY = [];

export default function LyricsModal({
  track,
  onClose,
  onApplyReplacement,
  onSwapTrack,
  cleanCandidate,
  cleanCandidates = EMPTY_OBJECT,
  activePlatform,
  lyricsByTrackId = EMPTY_OBJECT,
  setLyricsByTrackId,
  preset = 'moderate',
  presetsData,
  customBlocklist = EMPTY_ARRAY,
  keptTrackIds,
  onKeepTrack,
  triggerEl,
  triggerRef,
  isMasked = true,
}) {
  const [loading, setLoading] = useState(false);
  const [fetchedLyricsData, setFetchedLyricsData] = useState(null);
  const [error, setError] = useState(null);
  const [currentFlagIndex, setCurrentFlagIndex] = useState(0);

  const dialogRef = useRef(null);
  const lineRefs = useRef({});
  const previousActiveElement = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const trackId = track?.id;
  const cachedLyrics = lyricsByTrackId?.[trackId] ?? (track?.lyrics !== undefined ? track.lyrics : null);

  const presetsMap = useMemo(() => {
    if (!presetsData?.presets) return undefined;
    if (Array.isArray(presetsData.presets)) {
      return Object.fromEntries(presetsData.presets.map((p) => [p.id, p]));
    }
    return presetsData.presets;
  }, [presetsData]);

  const cachedLyricsData = useMemo(() => {
    if (cachedLyrics === null || cachedLyrics === undefined) return null;
    const hasLyrics = Boolean(typeof cachedLyrics === 'string' && cachedLyrics.trim());
    const evalResult = evaluateLyrics(cachedLyrics, {
      preset,
      presets: presetsMap,
      categories: presetsData?.categories,
      suffixPattern: presetsData?.morphological_suffix_pattern,
      customBlocklist,
      isMetadataExplicit: Boolean(track?.is_explicit),
      platform: activePlatform || track?.platform || 'ytmusic',
    });
    return {
      has_lyrics: hasLyrics,
      lyrics: cachedLyrics,
      scan_result: evalResult,
    };
  }, [cachedLyrics, preset, presetsMap, presetsData?.categories, presetsData?.morphological_suffix_pattern, customBlocklist, track?.is_explicit, track?.platform, activePlatform]);

  const lyricsData = cachedLyricsData || fetchedLyricsData;

  // Capture original trigger if passed or focused
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

  // Focus trap & Escape key handler
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

    window.addEventListener('keydown', handleKeyDown);

    // Initial focus into dialog
    const timeoutId = setTimeout(() => {
      if (dialogRef.current) {
        const closeBtn = dialogRef.current.querySelector('button[aria-label="Close modal"]');
        if (closeBtn) {
          closeBtn.focus();
        } else {
          dialogRef.current.focus();
        }
      }
    }, 0);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timeoutId);
    };
  }, [track, handleClose]);

  // Fetch uncached lyrics from API
  useEffect(() => {
    if (!trackId) return;

    if (cachedLyrics !== null && cachedLyrics !== undefined) {
      return;
    }

    let isCancelled = false;
    const fetchLyrics = async () => {
      setLoading(true);
      setError(null);
      try {
        const platform = activePlatform || track?.platform || 'ytmusic';
        const res = await fetch('/api/scan/track-lyrics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            video_id: trackId,
            title: track?.title,
            artist: track?.artist,
            duration: track?.duration,
            duration_seconds: track?.duration_seconds,
            ytmusic_video_id: track?.ytmusic_video_id,
            is_explicit: Boolean(track?.is_explicit),
            preset: preset || 'moderate',
            custom_blocklist: customBlocklist || [],
            platform,
          }),
        });

        if (!res.ok) throw new Error('Failed to load lyrics');
        const data = await res.json();
        if (isCancelled) return;

        setFetchedLyricsData(data);
        if (setLyricsByTrackId) {
          setLyricsByTrackId((prev) => ({ ...prev, [trackId]: data.lyrics || '' }));
        }
      } catch (err) {
        if (!isCancelled) setError(err.message);
      } finally {
        if (!isCancelled) {
          setLoading(false);
          setCurrentFlagIndex(0);
        }
      }
    };

    fetchLyrics();

    return () => {
      isCancelled = true;
    };
  }, [
    trackId,
    cachedLyrics,
    preset,
    customBlocklist,
    activePlatform,
    track?.is_explicit,
    track?.title,
    track?.artist,
    track?.duration,
    track?.duration_seconds,
    track?.ytmusic_video_id,
    track?.platform,
    setLyricsByTrackId,
  ]);

  // Extract detected words and flagged line numbers
  const detectedWords = useMemo(() => {
    const words = new Set();
    if (lyricsData?.scan_result?.detected_terms) {
      for (const term of lyricsData.scan_result.detected_terms) {
        if (typeof term.word === 'string' && term.word.trim().length > 0) {
          words.add(term.word.trim().toLowerCase());
        }
      }
    }
    if (lyricsData?.scan_result?.snippets) {
      for (const snip of lyricsData.scan_result.snippets) {
        if (Array.isArray(snip.matched_terms)) {
          for (const mt of snip.matched_terms) {
            if (typeof mt === 'string' && mt.trim().length > 0) {
              words.add(mt.trim().toLowerCase());
            }
          }
        }
      }
    }
    return Array.from(words);
  }, [lyricsData]);

  const flaggedLineNumbers = useMemo(() => {
    const lineSet = new Set();
    if (lyricsData?.scan_result?.snippets) {
      for (const snip of lyricsData.scan_result.snippets) {
        if (typeof snip.line_number === 'number') {
          lineSet.add(snip.line_number);
        }
      }
    }
    if (lyricsData?.scan_result?.detected_terms) {
      for (const term of lyricsData.scan_result.detected_terms) {
        if (Array.isArray(term.occurrences)) {
          for (const occ of term.occurrences) {
            lineSet.add(occ);
          }
        }
      }
    }
    return Array.from(lineSet).sort((a, b) => a - b);
  }, [lyricsData]);

  const totalFlaggedLines = flaggedLineNumbers.length;

  const scrollToFlag = (targetIndex) => {
    if (totalFlaggedLines === 0) return;
    const lineNum = flaggedLineNumbers[targetIndex];
    const el = lineRefs.current[lineNum];
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handlePrevFlag = () => {
    if (totalFlaggedLines === 0) return;
    const nextIdx = currentFlagIndex > 0 ? currentFlagIndex - 1 : totalFlaggedLines - 1;
    setCurrentFlagIndex(nextIdx);
    scrollToFlag(nextIdx);
  };

  const handleNextFlag = () => {
    if (totalFlaggedLines === 0) return;
    const nextIdx = (currentFlagIndex + 1) % totalFlaggedLines;
    setCurrentFlagIndex(nextIdx);
    scrollToFlag(nextIdx);
  };

  const isKept = Boolean(
    keptTrackIds instanceof Set
      ? keptTrackIds.has(track?.id)
      : Array.isArray(keptTrackIds) && keptTrackIds.includes(track?.id)
  );

  const handleKeepAction = () => {
    if (track?.id && onKeepTrack) {
      onKeepTrack(track.id);
    }
    handleClose();
  };

  const resolvedCleanCandidate =
    cleanCandidate ?? cleanCandidates?.[trackId] ?? track?.clean_candidate ?? null;

  const handleModalSwap = () => {
    if (!resolvedCleanCandidate || typeof resolvedCleanCandidate !== 'object') return;
    if (onSwapTrack) {
      onSwapTrack(track, resolvedCleanCandidate);
    } else if (onApplyReplacement) {
      onApplyReplacement(resolvedCleanCandidate);
    }
    handleClose();
  };

  if (!track) return null;

  const isSpotify = (activePlatform || track.platform || '').toLowerCase() === 'spotify';
  const attributionText = isSpotify
    ? 'Lyrics cross-referenced via YouTube Music'
    : 'Lyrics provided by YouTube Music service';

  const renderLyricsContent = (rawText) => {
    if (!rawText || !rawText.trim()) {
      return (
        <div className="py-12 text-center text-text-muted">
          <p className="italic">No lyrics available for this track.</p>
        </div>
      );
    }

    const lines = rawText.trimEnd().split(/\r?\n/);

    return (
      <div className="space-y-1 font-mono text-xs sm:text-sm">
        {lines.map((line, idx) => {
          const lineNum = idx + 1;
          const lineLabel = `L${String(lineNum).padStart(2, '0')}`;
          const isFlaggedLine = flaggedLineNumbers.includes(lineNum);

          if (!line.trim()) {
            return (
              <div
                key={idx}
                ref={(el) => {
                  if (el) lineRefs.current[lineNum] = el;
                }}
                className="flex items-center py-0.5"
              >
                <span className="w-10 text-right pr-3 mr-3 font-mono text-xs text-text-muted border-r border-border-subtle/40 select-none">
                  {lineLabel}
                </span>
                <span className="h-4" />
              </div>
            );
          }

          // Split line into words and tokens
          const tokens = line.split(/(\s+|[.,!?;:()"])/);

          return (
            <div
              key={idx}
              ref={(el) => {
                if (el) lineRefs.current[lineNum] = el;
              }}
              className={`flex items-start rounded transition-colors ${
                isFlaggedLine
                  ? 'border-l-2 border-status-flagged-border bg-status-flagged-bg/30 px-1.5 py-0.5'
                  : 'hover:bg-surface-elevated/40 px-1.5 py-0.5'
              }`}
            >
              <span className="w-10 text-right pr-3 mr-3 font-mono text-xs text-text-muted border-r border-border-subtle/40 select-none pt-0.5 shrink-0">
                {lineLabel}
              </span>
              <span className="text-text-primary leading-relaxed break-words flex-1">
                {tokens.map((token, tIdx) => {
                  const cleanToken = token.toLowerCase().trim();
                  const isWordFlagged = Boolean(cleanToken && detectedWords.includes(cleanToken));

                  if (isWordFlagged) {
                    return (
                      <span
                        key={tIdx}
                        className="bg-status-flagged-bg border border-status-flagged-border text-status-flagged px-1.5 py-0.5 rounded text-xs font-mono font-semibold inline-block mx-0.5"
                      >
                        {isMasked ? maskWord(token) : token}
                      </span>
                    );
                  }
                  return <React.Fragment key={tIdx}>{token}</React.Fragment>;
                })}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

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
        aria-labelledby="lyrics-modal-title"
        className="bg-surface-card border border-border-subtle rounded-2xl shadow-2xl overflow-hidden max-w-2xl w-full max-h-[85vh] flex flex-col"
        tabIndex={-1}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border-subtle flex items-start justify-between bg-surface-card shrink-0">
          <div className="flex items-center space-x-3.5 min-w-0">
            {track.thumbnail ? (
              <img
                src={track.thumbnail}
                alt={track.title || 'Track artwork'}
                className="w-12 h-12 rounded-lg object-cover shadow border border-border-subtle shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-surface-elevated border border-border-subtle flex items-center justify-center shrink-0">
                <Music2 className="w-5 h-5 text-text-muted" aria-hidden="true" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <h3
                  id="lyrics-modal-title"
                  className="text-base sm:text-lg font-bold text-text-primary truncate"
                >
                  {track.title || 'Untitled Track'}
                </h3>
                {track.is_explicit && (
                  <span className="bg-status-flagged-bg text-status-flagged text-[10px] px-1.5 py-0.5 rounded border border-status-flagged-border font-semibold shrink-0">
                    E
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-text-muted truncate mt-0.5">
                {track.artist || 'Unknown Artist'}
              </p>
              {track.video_url && (
                <a
                  href={track.video_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-brand-tint hover:text-brand-primary inline-flex items-center mt-1 space-x-1"
                >
                  <span>Listen on YouTube Music</span>
                  <ExternalLink className="w-3 h-3" aria-hidden="true" />
                </a>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close modal"
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-text-muted hover:text-text-primary rounded-lg hover:bg-surface-elevated transition-colors ml-2"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Story 7.9: Verified Clean caveat */}
        {isVerifiedCleanTrack(track) && (
          <p className="px-4 sm:px-5 py-2 text-xs text-text-muted border-b border-border-subtle shrink-0">
            {VERIFIED_CLEAN_CAVEAT}
          </p>
        )}

        {/* Emerald Clean Replacement Top Banner */}
        {resolvedCleanCandidate && typeof resolvedCleanCandidate === 'object' && (
          <div
            role="region"
            aria-label="Clean replacement available"
            className="px-4 py-3 bg-status-clean-bg/80 border-b border-status-clean-border flex flex-wrap items-center justify-between gap-3 shrink-0"
          >
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-status-clean flex items-center gap-1.5">
                <ArrowLeftRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Clean Replacement Available</span>
              </p>
              <p className="text-xs text-text-primary truncate mt-0.5">
                {resolvedCleanCandidate.title || track.title} ({formatDurationDelta(track, resolvedCleanCandidate)})
              </p>
            </div>
            <button
              type="button"
              onClick={handleModalSwap}
              className="min-h-[44px] px-3.5 py-1.5 rounded-lg bg-status-clean hover:bg-status-clean/90 text-status-clean-ink border border-status-clean-border text-xs font-semibold shadow transition-colors inline-flex items-center gap-1.5 shrink-0"
            >
              <ArrowLeftRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Swap to Clean</span>
            </button>
          </div>
        )}

        {/* Telemetry / Flag Jumpers Bar */}
        <div className="px-4 py-2 bg-surface-elevated/60 border-b border-border-subtle flex items-center justify-between text-xs text-text-muted shrink-0">
          <div className="flex items-center space-x-2 font-mono">
            {totalFlaggedLines > 0 ? (
              <span className="text-text-primary font-semibold">
                Flag {currentFlagIndex + 1} of {totalFlaggedLines}
              </span>
            ) : (
              <span>No flags</span>
            )}
            {lyricsData?.scan_result?.total_flagged_count ? (
              <span className="text-text-muted">
                ({lyricsData.scan_result.total_flagged_count} word violation
                {lyricsData.scan_result.total_flagged_count === 1 ? '' : 's'})
              </span>
            ) : null}
          </div>

          <div className="flex items-center space-x-1">
            <button
              type="button"
              onClick={handlePrevFlag}
              disabled={totalFlaggedLines === 0}
              aria-label="Previous flagged line"
              title="Previous flagged line"
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded text-text-muted hover:text-text-primary hover:bg-surface-highest disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronUp className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={handleNextFlag}
              disabled={totalFlaggedLines === 0}
              aria-label="Next flagged line"
              title="Next flagged line"
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded text-text-muted hover:text-text-primary hover:bg-surface-highest disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronDown className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <RefreshCw className="w-7 h-7 text-brand-primary animate-spin" aria-hidden="true" />
              <p className="text-sm text-text-muted">Fetching lyrics from YouTube Music...</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-status-flagged-bg/40 border border-status-flagged-border/60 rounded-xl text-status-flagged text-sm">
              <p className="font-semibold">Error Loading Lyrics</p>
              <p className="text-xs text-text-muted mt-1">{error}</p>
            </div>
          )}

          {!loading && lyricsData && (
            <>
              {/* Scan summary banner */}
              <div
                className={`p-3 rounded-xl border flex items-center justify-between text-xs sm:text-sm ${
                  lyricsData.scan_result?.is_flagged
                    ? 'bg-status-flagged-bg/30 border-status-flagged-border text-status-flagged'
                    : 'bg-status-clean-bg/30 border-status-clean-border text-status-clean'
                }`}
              >
                <div className="flex items-center space-x-2">
                  {lyricsData.scan_result?.is_flagged ? (
                    <AlertTriangle className="w-4 h-4 text-status-flagged shrink-0" aria-hidden="true" />
                  ) : (
                    <CheckCircle className="w-4 h-4 text-status-clean shrink-0" aria-hidden="true" />
                  )}
                  <div>
                    <span className="font-semibold">
                      {lyricsData.scan_result?.is_flagged ? 'Flagged Track' : 'Clean Track'}
                    </span>
                    {lyricsData.scan_result?.reasons?.length > 0 && (
                      <p className="text-[11px] text-text-muted mt-0.5">
                        {lyricsData.scan_result.reasons.map((r) => (typeof r !== 'string' ? r : (!r.includes(' ') ? (isMasked ? maskWord(r) : r) : maskText(r, detectedWords, isMasked)))).join(' • ')}
                      </p>
                    )}
                  </div>
                </div>

                {detectedWords.length > 0 && (
                  <div className="flex flex-wrap gap-1 max-w-[50%] justify-end">
                    {detectedWords.slice(0, 5).map((w, i) => (
                      <span
                        key={i}
                        className="text-[11px] bg-status-flagged-bg border border-status-flagged-border text-status-flagged px-1.5 py-0.5 rounded font-mono"
                      >
                        {isMasked ? maskWord(w) : w}
                      </span>
                    ))}
                    {detectedWords.length > 5 && (
                      <span className="text-[11px] text-text-muted">
                        +{detectedWords.length - 5} more
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Lyrics scroll view */}
              <div className="bg-surface-inset p-4 rounded-xl border border-border-subtle overflow-x-auto">
                {renderLyricsContent(lyricsData.lyrics)}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border-subtle bg-surface-card flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
          <p className="text-xs text-text-muted">{attributionText}</p>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleKeepAction}
              className="min-h-[44px] text-text-muted hover:text-text-primary hover:bg-surface-elevated px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            >
              {isKept ? 'Kept Flagged Track' : 'Keep Flagged Track'}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="min-h-[44px] px-4 py-1.5 bg-surface-elevated hover:bg-surface-highest text-text-primary text-sm font-medium rounded-lg transition-colors border border-border-subtle"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
