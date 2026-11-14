import React, { useState, useEffect, useMemo } from 'react';
import { AlertTriangle, X, Loader2, ListMusic } from 'lucide-react';
import { parseTrackListLines } from '../utils/inputParser';

export default function PasteTrackListPanel({
  isOpen,
  onClose,
  onResolve,
  initialText = '',
  isLoading = false,
  className = '',
}) {
  const [rawText, setRawText] = useState(typeof initialText === 'string' ? initialText : '');

  // Sync initialText when panel opens or initialText changes
  useEffect(() => {
    if (isOpen) {
      setRawText(typeof initialText === 'string' ? initialText : '');
    }
  }, [isOpen, initialText]);

  const nonEmptyLines = useMemo(() => {
    return parseTrackListLines(rawText);
  }, [rawText]);

  const lineCount = nonEmptyLines.length;
  const isOverLimit = lineCount > 50;
  const safeText = typeof rawText === 'string' ? rawText : '';
  const rawLinesCount = Math.max(safeText.split('\n').length, 1);

  if (!isOpen) return null;

  const handleResolveClick = () => {
    if (lineCount === 0 || isLoading) return;
    const linesToProcess = nonEmptyLines.slice(0, 50);
    onResolve(linesToProcess);
  };

  return (
    <section
      aria-label="Paste Track List Panel"
      className={`bg-surface-card rounded-xl border border-border-subtle p-5 shadow-2xl transition-all ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border-subtle mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-surface-elevated text-brand-tint border border-border-subtle">
            <ListMusic className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-text-primary">Paste Track List</h3>
            <p className="text-xs text-text-muted">
              Paste song titles or track URLs (one per line). Up to 50 tracks.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Live Line Counter */}
          <span
            aria-label="Line counter"
            className={`px-2.5 py-1 rounded text-xs font-mono font-medium border transition-colors ${
              isOverLimit
                ? 'bg-status-caution-bg text-status-caution border-status-caution-border'
                : 'bg-surface-elevated text-text-secondary border-border-subtle'
            }`}
          >
            {lineCount} / 50 lines
          </span>

          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            aria-label="Close paste panel"
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors disabled:opacity-50 disabled:pointer-events-none"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Truncation Warning */}
      {isOverLimit && (
        <div
          role="alert"
          className="mb-3 p-3 rounded-lg bg-status-caution-bg border border-status-caution-border text-status-caution text-xs flex items-center gap-2"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>
            List exceeds 50 lines. Only the first 50 lines will be resolved ({lineCount - 50} lines omitted).
          </span>
        </div>
      )}

      {/* Textarea with Line Numbers Gutter */}
      <div className="relative flex rounded-lg border border-border-subtle bg-surface-inset overflow-hidden focus-within:border-brand-primary focus-within:ring-1 focus-within:ring-ring-focus">
        {/* Line Numbers Gutter */}
        <div
          aria-hidden="true"
          className="select-none py-3 px-2 bg-surface-elevated/50 border-r border-border-subtle text-right font-mono text-xs text-text-muted leading-6 min-w-[2.5rem]"
        >
          {Array.from({ length: rawLinesCount }).map((_, idx) => (
            <div key={idx}>{idx + 1}</div>
          ))}
        </div>

        {/* Text Area */}
        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder={`The Killers - Mr. Brightside\nColdplay - Yellow\nhttps://open.spotify.com/track/...\nQueen - Bohemian Rhapsody`}
          rows={Math.min(Math.max(rawLinesCount, 6), 14)}
          aria-label="Pasted track list input"
          wrap="off"
          disabled={isLoading}
          className="flex-1 p-3 bg-transparent text-sm text-text-primary font-mono placeholder:text-text-muted focus:outline-none resize-y leading-6 whitespace-pre overflow-x-auto disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>

      {/* Action Footer */}
      <div className="mt-4 flex items-center justify-end gap-3 pt-3 border-t border-border-subtle">
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          aria-label="Cancel paste"
          className="px-4 py-2 rounded-lg text-sm font-medium bg-surface-elevated text-text-secondary hover:text-text-primary border border-border-subtle transition-colors disabled:opacity-50 disabled:pointer-events-none"
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={handleResolveClick}
          disabled={lineCount === 0 || isLoading}
          aria-label="Resolve & Add"
          className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold bg-brand-primary text-brand-foreground hover:bg-brand-primary-hover disabled:opacity-50 disabled:pointer-events-none transition-all shadow-md shadow-brand-primary/20"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              <span>Resolving...</span>
            </>
          ) : (
            <span>Resolve & Add</span>
          )}
        </button>
      </div>
    </section>
  );
}
