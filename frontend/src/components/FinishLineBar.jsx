import React, { useState, useRef, useEffect } from 'react';
import {
  CheckCircle2,
  Play,
  PlayCircle,
  Copy,
  Check,
  Download,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import {
  getReadyTracks,
  launchYouTubeCleanQueue,
  copyCleanTrackLinks,
  exportCleanPlaylistFile,
} from '../utils/finishLine';

export default function FinishLineBar({
  tracks = [],
  keptTrackIds,
  activePlatform = 'spotify',
  vipMode = false,
  playlistTitle = 'Clean Playlist',
  primaryAction = 'copy',
  onNotice,
  className = '',
}) {
  const [isCopied, setIsCopied] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const desktopExportRef = useRef(null);
  const mobileExportRef = useRef(null);
  const copyTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

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

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    if (!exportMenuOpen) return;

    const handleClickOutside = (e) => {
      const inDesktop = desktopExportRef.current && desktopExportRef.current.contains(e.target);
      const inMobile = mobileExportRef.current && mobileExportRef.current.contains(e.target);
      if (!inDesktop && !inMobile) {
        setExportMenuOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setExportMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [exportMenuOpen]);

  // Don't render the dock if there are no tracks in the list at all
  if (!Array.isArray(tracks) || tracks.length === 0) {
    return null;
  }

  const handlePlayCleanQueue = () => {
    launchYouTubeCleanQueue({
      readyTracks,
      platform: activePlatform,
      vipMode,
      onNotice,
      openWindow: true,
    });
  };

  const handleCopyLinks = async () => {
    const result = await copyCleanTrackLinks({
      readyTracks,
      platform: activePlatform,
      vipMode,
      onNotice,
    });

    if (result.success) {
      setIsCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => {
        setIsCopied(false);
      }, 2000);
    }
  };

  const handleExportFormat = async (format) => {
    setExportMenuOpen(false);
    setIsExporting(true);
    await exportCleanPlaylistFile({
      readyTracks,
      format,
      playlistTitle,
      platform: activePlatform,
      vipMode,
      onNotice,
    });
    setIsExporting(false);
  };

  const desktopPasteHint =
    activePlatform === 'spotify'
      ? 'Ctrl+V / Cmd+V in Spotify Desktop'
      : 'Paste links in YouTube Music';

  const renderDesktopExportPopover = () => (
    <div className="relative" ref={desktopExportRef}>
      <button
        type="button"
        onClick={() => setExportMenuOpen((prev) => !prev)}
        disabled={readyCount === 0 || isExporting}
        aria-label="Export options"
        aria-haspopup="true"
        aria-expanded={exportMenuOpen}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-elevated hover:bg-surface-highest text-text-primary border border-border-subtle text-sm font-semibold transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
      >
        {isExporting ? (
          <Loader2 className="w-4 h-4 text-text-muted animate-spin shrink-0" aria-hidden="true" />
        ) : (
          <Download className="w-4 h-4 text-text-muted shrink-0" aria-hidden="true" />
        )}
        <span>Export</span>
        <ChevronDown className="w-3.5 h-3.5 text-text-muted" aria-hidden="true" />
      </button>

      {exportMenuOpen && (
        <div
          aria-label="Export format options"
          className="absolute bottom-full mb-2 right-0 bg-surface-card border border-border-subtle rounded-xl shadow-xl p-1.5 min-w-[150px] flex flex-col gap-1 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150"
        >
          <button
            type="button"
            onClick={() => handleExportFormat('csv')}
            aria-label="Export as CSV"
            className="w-full text-left px-3 py-2 text-xs text-text-primary hover:bg-surface-elevated rounded-lg transition-colors font-medium flex items-center justify-between"
          >
            <span>CSV</span>
            <span className="text-[10px] text-text-muted font-mono">.csv</span>
          </button>
          <button
            type="button"
            onClick={() => handleExportFormat('m3u8')}
            aria-label="Export as M3U8"
            className="w-full text-left px-3 py-2 text-xs text-text-primary hover:bg-surface-elevated rounded-lg transition-colors font-medium flex items-center justify-between"
          >
            <span>M3U8</span>
            <span className="text-[10px] text-text-muted font-mono">.m3u8</span>
          </button>
          <button
            type="button"
            onClick={() => handleExportFormat('json')}
            aria-label="Export as JSON"
            className="w-full text-left px-3 py-2 text-xs text-text-primary hover:bg-surface-elevated rounded-lg transition-colors font-medium flex items-center justify-between"
          >
            <span>JSON</span>
            <span className="text-[10px] text-text-muted font-mono">.json</span>
          </button>
        </div>
      )}
    </div>
  );

  return (
    <footer
      aria-label="Finish Line Controls"
      className={`fixed bottom-0 left-0 right-0 z-40 bg-surface-inset/95 backdrop-blur-md border-t border-border-subtle px-4 md:px-8 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-2xl transition-all ${className}`}
    >
      {/* Mobile Layout (< 768px): Primary CTA inverts to full-width Play Clean Queue on top */}
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

        {/* Secondary Actions Row below it on Mobile */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyLinks}
            disabled={readyCount === 0}
            aria-label="Copy Clean Track Links"
            className="flex-1 min-h-[42px] px-3 rounded-xl bg-surface-elevated hover:bg-surface-highest text-text-primary border border-border-subtle font-medium text-xs flex items-center justify-center gap-1.5 transition disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
          >
            {isCopied ? (
              <>
                <Check className="w-4 h-4 text-text-secondary shrink-0" aria-hidden="true" />
                <span className="text-text-primary font-semibold">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-text-muted shrink-0" aria-hidden="true" />
                <span>Copy Clean Track Links</span>
              </>
            )}
          </button>

          {/* Export Dropdown Popover on Mobile */}
          <div className="relative" ref={mobileExportRef}>
            <button
              type="button"
              onClick={() => setExportMenuOpen((prev) => !prev)}
              disabled={readyCount === 0 || isExporting}
              aria-label="Export options"
              aria-haspopup="true"
              aria-expanded={exportMenuOpen}
              className="min-h-[42px] px-3 rounded-xl bg-surface-elevated hover:bg-surface-highest text-text-primary border border-border-subtle font-medium text-xs flex items-center justify-center gap-1 transition disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 text-text-muted animate-spin shrink-0" aria-hidden="true" />
              ) : (
                <Download className="w-4 h-4 text-text-muted shrink-0" aria-hidden="true" />
              )}
              <span>Export</span>
              <ChevronDown className="w-3.5 h-3.5 text-text-muted" aria-hidden="true" />
            </button>

            {exportMenuOpen && (
              <div
                aria-label="Export format options"
                className="absolute bottom-full mb-2 right-0 bg-surface-card border border-border-subtle rounded-xl shadow-xl p-1.5 min-w-[150px] flex flex-col gap-1 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150"
              >
                <button
                  type="button"
                  onClick={() => handleExportFormat('csv')}
                  aria-label="Export as CSV"
                  className="w-full text-left px-3 py-2 text-xs text-text-primary hover:bg-surface-elevated rounded-lg transition-colors font-medium flex items-center justify-between"
                >
                  <span>CSV</span>
                  <span className="text-[10px] text-text-muted font-mono">.csv</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExportFormat('m3u8')}
                  aria-label="Export as M3U8"
                  className="w-full text-left px-3 py-2 text-xs text-text-primary hover:bg-surface-elevated rounded-lg transition-colors font-medium flex items-center justify-between"
                >
                  <span>M3U8</span>
                  <span className="text-[10px] text-text-muted font-mono">.m3u8</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExportFormat('json')}
                  aria-label="Export as JSON"
                  className="w-full text-left px-3 py-2 text-xs text-text-primary hover:bg-surface-elevated rounded-lg transition-colors font-medium flex items-center justify-between"
                >
                  <span>JSON</span>
                  <span className="text-[10px] text-text-muted font-mono">.json</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Desktop Layout (>= 768px): Primary CTA is electric violet Copy Clean Track Links stacked above paste hint */}
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
          {primaryAction === 'play' ? (
            <>
              {/* Secondary Action: Copy Clean Track Links */}
              <button
                type="button"
                onClick={handleCopyLinks}
                disabled={readyCount === 0}
                aria-label="Copy Clean Track Links"
                title={desktopPasteHint}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-elevated hover:bg-surface-highest text-text-primary border border-border-subtle text-sm font-semibold transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {isCopied ? (
                  <>
                    <Check className="w-4 h-4 text-text-secondary shrink-0" aria-hidden="true" />
                    <span className="text-text-primary font-semibold">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-text-muted shrink-0" aria-hidden="true" />
                    <span>Copy Clean Track Links</span>
                  </>
                )}
              </button>

              {/* Secondary Action: Export ▾ Popover */}
              {renderDesktopExportPopover()}

              {/* Primary Studio CTA on Desktop: Electric Violet Play Clean Queue */}
              <button
                type="button"
                onClick={handlePlayCleanQueue}
                disabled={readyCount === 0}
                aria-label="Play Clean Queue"
                data-testid="desktop-primary-play-btn"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-primary hover:bg-brand-primary-hover text-white text-sm font-semibold transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-brand-primary/20"
              >
                <Play className="w-4 h-4 fill-current" aria-hidden="true" />
                <span>Play Clean Queue</span>
              </button>
            </>
          ) : (
            <>
              {/* Secondary Action: Play Clean Queue */}
              <button
                type="button"
                onClick={handlePlayCleanQueue}
                disabled={readyCount === 0}
                aria-label="Play Clean Queue"
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface-elevated hover:bg-surface-highest text-text-primary border border-border-subtle text-sm font-semibold transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                <PlayCircle className="w-4 h-4 text-text-muted" aria-hidden="true" />
                <span>Play Clean Queue</span>
              </button>

              {/* Secondary Action: Export ▾ Popover */}
              {renderDesktopExportPopover()}

              {/* Primary Studio CTA on Desktop: Electric Violet Copy Clean Track Links stacked above paste hint */}
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={handleCopyLinks}
                  disabled={readyCount === 0}
                  aria-label="Copy Clean Track Links"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-primary hover:bg-brand-primary-hover text-white text-sm font-semibold transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-brand-primary/20"
                >
                  {isCopied ? (
                    <>
                      <Check className="w-4 h-4 text-white" aria-hidden="true" />
                      <span>Copied Links!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-white" aria-hidden="true" />
                      <span>Copy Clean Track Links</span>
                    </>
                  )}
                </button>
                <span className="font-mono text-[10px] text-text-muted text-center tracking-tight mt-0.5">
                  {desktopPasteHint}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </footer>
  );
}
