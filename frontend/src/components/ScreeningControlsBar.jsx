import React, { useEffect, useId, useRef, useState } from 'react';
import { Sparkles, RefreshCw, Plus, X, SlidersHorizontal, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { maskWord } from '../utils/masking';
import { PRESET_COPY as PRESETS } from '../utils/presetCopy';

const FALLBACK_PRESET_ID = 'moderate';
const BLOCKLIST_NOTE = 'Your blocklist words are flagged under every preset.';

// Unknown ids resolve to Moderate, matching the lyricEvaluator.js fallback.
const resolvePreset = (presetId) =>
  PRESETS.find((p) => p.id === presetId) || PRESETS.find((p) => p.id === FALLBACK_PRESET_ID);

export default function ScreeningControlsBar({
  preset = 'moderate',
  onSelectPreset,
  setPreset,
  customBlocklist = [],
  onAddBlocklistTerm,
  onRemoveBlocklistTerm,
  setCustomBlocklist,
  onRunScan,
  scanning = false,
  scanProgressAnnouncement = '',
  disabled = false,
  isMasked = true,
  onToggleMasking,
  onBulkClean,
  bulkCleaning = false,
  bulkCleanProgress = '',
  flaggedCount = 0,
}) {
  const [inputValue, setInputValue] = useState('');
  const [policyAnnouncement, setPolicyAnnouncement] = useState('');
  const descriptionIdBase = useId();
  const activePreset = resolvePreset(preset);
  const lastSeenPresetRef = useRef(activePreset.id);

  useEffect(() => {
    if (lastSeenPresetRef.current === activePreset.id) return;
    lastSeenPresetRef.current = activePreset.id;
    setPolicyAnnouncement(`Active threshold: ${activePreset.label} — ${activePreset.summary}`);
  }, [activePreset]);

  const handlePresetClick = (presetId) => {
    if (onSelectPreset) {
      onSelectPreset(presetId);
    } else if (setPreset) {
      setPreset(presetId);
    }
  };

  const handleAddTerm = (rawTerm) => {
    const term = (rawTerm || '').trim().toLowerCase();
    if (!term) return;

    const currentList = Array.isArray(customBlocklist) ? customBlocklist : [];
    if (currentList.some((t) => typeof t === 'string' && t.toLowerCase() === term)) {
      setInputValue('');
      return;
    }

    if (onAddBlocklistTerm) {
      onAddBlocklistTerm(term);
    } else if (setCustomBlocklist) {
      setCustomBlocklist((prev) => [...prev, term]);
    }

    setInputValue('');
  };

  const handleRemoveTerm = (termToRemove) => {
    if (onRemoveBlocklistTerm) {
      onRemoveBlocklistTerm(termToRemove);
    } else if (setCustomBlocklist) {
      setCustomBlocklist((prev) => prev.filter((t) => t !== termToRemove));
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTerm(inputValue);
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    handleAddTerm(inputValue);
  };

  const scanButtonLabel = scanning
    ? scanProgressAnnouncement || 'Scanning Lyrics...'
    : 'Scan Lyrics';

  const bulkCleanLabel = bulkCleaning
    ? bulkCleanProgress || 'Finding clean edits…'
    : 'Find & Swap All Clean Versions';

  const isBulkDisabled = bulkCleaning || scanning || disabled || flaggedCount === 0;

  return (
    <section
      aria-label="Screening Console"
      className="bg-surface-inset border border-border-strong rounded-2xl p-5 shadow-xl space-y-4"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border-subtle pb-3">
        <div className="flex flex-col gap-1.5">
          <span className="inline-flex self-start items-center px-2 py-0.5 rounded bg-surface-elevated border border-border-subtle text-[11px] font-mono font-semibold uppercase tracking-wider text-brand-tint">
            02 / SCREENING RULES
          </span>
          <div className="flex items-center space-x-2">
            <SlidersHorizontal className="w-5 h-5 text-brand-primary" />
            <h3 className="font-semibold text-text-primary text-sm sm:text-base">
              Screening & Preset Controls
            </h3>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleMasking}
            aria-label="Toggle profanity masking"
            aria-pressed={isMasked}
            className="bg-surface-elevated hover:bg-surface-elevated/80 text-text-muted hover:text-text-primary border border-border-subtle p-2 rounded-xl flex items-center gap-1.5 transition text-xs cursor-pointer min-h-[44px]"
          >
            {isMasked ? (
              <EyeOff className="w-4 h-4" aria-hidden="true" />
            ) : (
              <Eye className="w-4 h-4" aria-hidden="true" />
            )}
            <span>{isMasked ? 'Masked' : 'Unmasked'}</span>
          </button>
          <span className="text-xs text-text-muted hidden sm:inline">
            Choose sensitivity & custom blocklist
          </span>
        </div>
      </div>

      {/* Preset Pills and Scan Action */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Presets Segment */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Sensitivity Preset
          </span>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Sensitivity Presets">
            {PRESETS.map((p) => {
              const isActive = activePreset.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={isActive}
                  aria-describedby={`${descriptionIdBase}-${p.id}`}
                  title={p.summary}
                  disabled={scanning || bulkCleaning || disabled}
                  onClick={() => handlePresetClick(p.id)}
                  className={`px-4 py-2 min-h-[44px] rounded-full text-xs sm:text-sm font-medium transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    isActive
                      ? 'bg-brand-primary text-white shadow-md shadow-brand-primary/25'
                      : 'bg-surface-elevated text-text-muted hover:text-text-primary hover:bg-surface-elevated/80'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <div className="sr-only">
            {PRESETS.map((p) => (
              <span key={p.id} id={`${descriptionIdBase}-${p.id}`}>
                {p.summary}
              </span>
            ))}
          </div>
          <div
            data-testid="active-policy-indicator"
            className="flex items-start gap-2 min-w-0 max-w-full rounded-xl border border-border-subtle bg-surface-elevated px-3 py-2 text-xs text-text-muted"
          >
            <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-brand-primary" aria-hidden="true" />
            <div className="min-w-0 break-words space-y-0.5">
              <p>
                <span className="font-semibold text-text-primary">
                  Active policy: {activePreset.label}
                </span>
                <span> — {activePreset.summary}</span>
              </p>
              <p className="text-text-muted">{BLOCKLIST_NOTE}</p>
            </div>
          </div>
          <div data-testid="policy-announcement" aria-live="polite" aria-atomic="true" className="sr-only">
            {policyAnnouncement}
          </div>
        </div>

        {/* Actions Segment */}
        <div className="flex flex-wrap items-center gap-3 justify-end shrink-0">
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="sr-only"
          >
            {bulkCleaning ? bulkCleanProgress : scanProgressAnnouncement}
          </div>

          {/* Bulk Clean Replacement Button */}
          <button
            type="button"
            onClick={onBulkClean}
            disabled={isBulkDisabled}
            aria-label={bulkCleanLabel}
            className="flex items-center justify-center space-x-2 px-5 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-white font-semibold text-xs sm:text-sm rounded-xl transition shadow-lg shadow-brand-primary/20 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed min-h-[44px]"
          >
            {bulkCleaning ? (
              <RefreshCw className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
            ) : (
              <Sparkles className="w-4 h-4 shrink-0" aria-hidden="true" />
            )}
            <span>{bulkCleanLabel}</span>
          </button>

          {/* Scan Trigger Button */}
          <button
            type="button"
            onClick={onRunScan}
            disabled={scanning || bulkCleaning || disabled}
            aria-label={scanButtonLabel}
            className="flex items-center justify-center space-x-2 px-6 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-white font-medium text-xs sm:text-sm rounded-xl transition shadow-lg shadow-brand-primary/20 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed min-h-[44px]"
          >
            {scanning ? (
              <RefreshCw className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
            ) : (
              <Sparkles className="w-4 h-4 shrink-0" aria-hidden="true" />
            )}
            <span>{scanButtonLabel}</span>
          </button>
        </div>
      </div>

      {/* Custom Blocklist Section */}
      <div className="pt-2 space-y-2.5">
        <label
          htmlFor="custom-blocklist-input"
          className="block text-xs font-semibold text-text-muted uppercase tracking-wider"
        >
          Custom Keyword Blocklist (words you want flagged specifically)
        </label>
        <form onSubmit={handleFormSubmit} className="flex gap-2">
          <input
            id="custom-blocklist-input"
            type="text"
            placeholder="Add custom word (e.g. beer, tobacco) and press Enter"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={scanning || bulkCleaning || disabled}
            aria-label="Add custom blocklist term"
            className="flex-1 min-h-[44px] bg-surface-elevated border border-border-subtle rounded-xl px-3.5 py-2 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={scanning || bulkCleaning || disabled}
            aria-label="Add blocklist term"
            className="min-h-[44px] px-4 py-2 bg-surface-elevated hover:bg-surface-elevated/80 text-text-primary text-xs font-medium rounded-xl border border-border-subtle flex items-center space-x-1.5 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Add Word</span>
          </button>
        </form>

        {/* Chips */}
        {Array.isArray(customBlocklist) && customBlocklist.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1" aria-label="Active custom blocklist terms">
            {customBlocklist.map((term) => (
              <span
                key={term}
                className="inline-flex items-center space-x-1.5 bg-surface-elevated border border-border-subtle text-text-primary text-xs px-3 py-1 rounded-full shadow-sm"
              >
                <span>{isMasked ? maskWord(term) : term}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveTerm(term)}
                  disabled={scanning || bulkCleaning || disabled}
                  aria-label={`Remove blocklist term ${term}`}
                  className="text-text-muted hover:text-text-primary transition min-h-[44px] min-w-[44px] -my-2 -mr-2 inline-flex items-center justify-center rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
