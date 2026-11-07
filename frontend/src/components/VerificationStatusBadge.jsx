import React from 'react';
import { CheckCircle2, ShieldAlert, RefreshCw, HelpCircle } from 'lucide-react';

export default function VerificationStatusBadge({
  status,
  track,
  className = '',
}) {
  let resolvedStatus = 'unscanned';
  const s = status ? String(status).toLowerCase() : null;

  if (track) {
    if (track.was_replaced) {
      resolvedStatus = 'clean_swapped';
    } else if (track.is_flagged) {
      resolvedStatus = 'flagged';
    } else if (track.verification_status === 'verified_clean' || track.is_clean) {
      resolvedStatus = 'verified_clean';
    } else if (s && s !== 'unscanned') {
      if (s === 'verified_clean' || s === 'clean') resolvedStatus = 'verified_clean';
      else if (s === 'clean_swapped' || s === 'swapped') resolvedStatus = 'clean_swapped';
      else if (s === 'flagged') resolvedStatus = 'flagged';
    } else if (track.verification_status) {
      const vs = String(track.verification_status).toLowerCase();
      if (vs === 'verified_clean' || vs === 'clean') resolvedStatus = 'verified_clean';
      else if (vs === 'clean_swapped' || vs === 'swapped') resolvedStatus = 'clean_swapped';
      else if (vs === 'flagged') resolvedStatus = 'flagged';
      else resolvedStatus = 'unscanned';
    } else {
      resolvedStatus = 'unscanned';
    }
  } else if (s) {
    if (s === 'verified_clean' || s === 'clean') resolvedStatus = 'verified_clean';
    else if (s === 'clean_swapped' || s === 'swapped') resolvedStatus = 'clean_swapped';
    else if (s === 'flagged') resolvedStatus = 'flagged';
    else resolvedStatus = 'unscanned';
  }

  if (resolvedStatus === 'verified_clean') {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-950/40 border border-emerald-900/50 text-emerald-400 shrink-0 ${className}`}
      >
        <CheckCircle2 className="w-3 h-3 text-emerald-400" aria-hidden="true" />
        <span>Verified Clean</span>
      </span>
    );
  }

  if (resolvedStatus === 'clean_swapped') {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-950/50 border border-emerald-800/60 text-emerald-300 shrink-0 ${className}`}
      >
        <RefreshCw className="w-3 h-3 text-emerald-300" aria-hidden="true" />
        <span>Clean Swapped</span>
      </span>
    );
  }

  if (resolvedStatus === 'flagged') {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-status-flagged/10 border border-status-flagged/30 text-status-flagged shrink-0 ${className}`}
      >
        <ShieldAlert className="w-3 h-3 text-status-flagged" aria-hidden="true" />
        <span>Flagged</span>
      </span>
    );
  }

  // Default: unscanned
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-surface-elevated border border-border-subtle text-text-muted shrink-0 ${className}`}
    >
      <HelpCircle className="w-3 h-3 text-text-muted" aria-hidden="true" />
      <span>Unscanned</span>
    </span>
  );
}
