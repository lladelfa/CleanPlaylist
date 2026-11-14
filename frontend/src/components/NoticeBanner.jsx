import React from 'react';
import { AlertTriangle, AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export default function NoticeBanner({
  type = 'caution', // 'caution' | 'warning' | 'error' | 'flagged' | 'rate_limit' | 'success' | 'clean' | 'info'
  message,
  chips = [],
  actionLabel,
  onAction,
  onDismiss,
  dismissLabel = 'Dismiss notice',
  className = '',
}) {
  const isError = type === 'error' || type === 'flagged';
  const isClean = type === 'clean';
  const isCaution = type === 'caution' || type === 'warning' || type === 'rate_limit';

  let bannerStyles = 'bg-status-caution-bg border-status-caution-border text-status-caution';
  let IconComponent = AlertTriangle;

  if (isError) {
    bannerStyles = 'bg-status-flagged-bg border-status-flagged-border text-status-flagged';
    IconComponent = AlertCircle;
  } else if (isClean) {
    bannerStyles = 'bg-status-clean-bg border-status-clean-border text-status-clean';
    IconComponent = CheckCircle2;
  } else if (!isCaution) {
    bannerStyles = 'bg-surface-elevated border-border-subtle text-text-primary';
    IconComponent = Info;
  }

  const role = isError || isCaution ? 'alert' : 'status';
  const ariaLive = isError || isCaution ? 'assertive' : 'polite';

  return (
    <div
      role={role}
      aria-live={ariaLive}
      aria-atomic="true"
      className={`rounded-lg border px-4 py-3 flex items-center justify-between gap-3 text-sm shadow-sm transition-all ${bannerStyles} ${className}`}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <IconComponent className="w-[18px] h-[18px] shrink-0" aria-hidden="true" />
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="font-medium leading-relaxed break-words">{message}</span>
          {chips && chips.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {chips.map((chip, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded bg-surface-card border border-border-subtle text-xs font-mono text-text-primary"
                >
                  {chip}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="min-h-[44px] px-3 py-1 rounded bg-surface-elevated hover:bg-surface-highest text-text-primary border border-border-subtle text-xs font-semibold transition-colors"
          >
            {actionLabel}
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label={dismissLabel}
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded hover:bg-surface-card/40 transition-colors opacity-80 hover:opacity-100"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
