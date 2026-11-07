import React, { useState } from 'react';
import { Sparkles, RefreshCw, Plus, X, SlidersHorizontal } from 'lucide-react';

const PRESETS = [
  { id: 'kid_safe', label: 'Kid Safe' },
  { id: 'moderate', label: 'Moderate' },
  { id: 'slurs_only', label: 'Slurs Only' },
  { id: 'custom', label: 'Custom' },
];

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
}) {
  const [inputValue, setInputValue] = useState('');

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

  return (
    <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 shadow-xl space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border-subtle pb-3">
        <div className="flex items-center space-x-2">
          <SlidersHorizontal className="w-5 h-5 text-brand-primary" />
          <h3 className="font-semibold text-text-primary text-sm sm:text-base">
            Screening & Preset Controls
          </h3>
        </div>
        <span className="text-xs text-text-muted">
          Choose sensitivity & custom blocklist
        </span>
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
              const isActive = preset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={isActive}
                  disabled={scanning || disabled}
                  onClick={() => handlePresetClick(p.id)}
                  className={`px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
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
        </div>

        {/* Scan Trigger Button */}
        <div className="flex flex-col justify-end shrink-0">
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="sr-only"
          >
            {scanProgressAnnouncement}
          </div>
          <button
            type="button"
            onClick={onRunScan}
            disabled={scanning || disabled}
            aria-label={scanButtonLabel}
            className="flex items-center justify-center space-x-2 px-6 py-2.5 bg-brand-primary hover:bg-brand-primary/90 text-white font-medium text-sm rounded-xl transition shadow-lg shadow-brand-primary/20 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            {scanning ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
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
            disabled={scanning || disabled}
            aria-label="Add custom blocklist term"
            className="flex-1 bg-surface-elevated border border-border-subtle rounded-xl px-3.5 py-2 text-xs text-text-primary placeholder-text-muted/60 focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={scanning || disabled}
            aria-label="Add blocklist term"
            className="px-4 py-2 bg-surface-elevated hover:bg-surface-elevated/80 text-text-primary text-xs font-medium rounded-xl border border-border-subtle flex items-center space-x-1.5 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-3.5 h-3.5" />
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
                <span>{term}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveTerm(term)}
                  disabled={scanning || disabled}
                  aria-label={`Remove blocklist term ${term}`}
                  className="text-text-muted hover:text-text-primary transition p-0.5 rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
