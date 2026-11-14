import React from 'react';
import {
  CheckCircle2,
  ShieldAlert,
  RefreshCw,
  HelpCircle,
  FileQuestion,
  AlertCircle,
} from 'lucide-react';

export default function VerificationStatusBadge({
  status,
  track,
  className = '',
}) {
  let resolvedStatus = 'unscanned';
  const s = status ? String(status).toLowerCase() : null;

  if (track) {
    const vs = track.verification_status
      ? String(track.verification_status).toLowerCase()
      : null;

    if (track.was_replaced || vs === 'clean_swapped' || vs === 'swapped') {
      resolvedStatus = 'clean_swapped';
    } else if (vs === 'scanning') {
      resolvedStatus = 'scanning';
    } else if (track.is_flagged || vs === 'flagged') {
      resolvedStatus = 'flagged';
    } else if (vs === 'lyrics_unavailable') {
      resolvedStatus = 'lyrics_unavailable';
    } else if (vs === 'verified_clean' || vs === 'clean') {
      resolvedStatus = 'verified_clean';
    } else if (vs === 'scan_error' || vs === 'error') {
      resolvedStatus = 'scan_error';
    } else if (s && s !== 'unscanned') {
      if (s === 'verified_clean' || s === 'clean') resolvedStatus = 'verified_clean';
      else if (s === 'clean_swapped' || s === 'swapped') resolvedStatus = 'clean_swapped';
      else if (s === 'flagged') resolvedStatus = 'flagged';
      else if (s === 'lyrics_unavailable') resolvedStatus = 'lyrics_unavailable';
      else if (s === 'scanning') resolvedStatus = 'scanning';
      else if (s === 'scan_error' || s === 'error') resolvedStatus = 'scan_error';
    } else {
      resolvedStatus = 'unscanned';
    }
  } else if (s) {
    if (s === 'verified_clean' || s === 'clean') resolvedStatus = 'verified_clean';
    else if (s === 'clean_swapped' || s === 'swapped') resolvedStatus = 'clean_swapped';
    else if (s === 'flagged') resolvedStatus = 'flagged';
    else if (s === 'lyrics_unavailable') resolvedStatus = 'lyrics_unavailable';
    else if (s === 'scanning') resolvedStatus = 'scanning';
    else if (s === 'scan_error' || s === 'error') resolvedStatus = 'scan_error';
    else resolvedStatus = 'unscanned';
  }

  if (resolvedStatus === 'verified_clean') {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-status-clean-bg border border-status-clean-border text-status-clean shrink-0 ${className}`}
      >
        <CheckCircle2 className="w-3 h-3 text-status-clean" aria-hidden="true" />
        <span>Verified Clean</span>
      </span>
    );
  }

  if (resolvedStatus === 'clean_swapped') {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-status-clean-bg border border-status-clean-border text-status-clean shrink-0 ${className}`}
      >
        <RefreshCw className="w-3 h-3 text-status-clean" aria-hidden="true" />
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

  if (resolvedStatus === 'lyrics_unavailable') {
    const lookup = track?.lyrics_lookup;

    if (lookup === 'upstream_error') {
      const label = "Couldn't check lyrics: lyrics service error. Try scanning again.";
      return (
        <span
          role="img"
          aria-label={label}
          title={label}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-950/40 border border-rose-900/50 text-rose-400 shrink-0 ${className}`}
        >
          <AlertCircle className="w-3 h-3 text-rose-400" aria-hidden="true" />
          <span>Couldn't check (service error)</span>
        </span>
      );
    }

    if (lookup === 'not_found') {
      const label = 'No lyrics found for this song, so it could not be verified.';
      return (
        <span
          role="img"
          aria-label={label}
          title={label}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-950/40 border border-amber-900/50 text-amber-400 shrink-0 ${className}`}
        >
          <FileQuestion className="w-3 h-3 text-amber-400" aria-hidden="true" />
          <span>No lyrics found</span>
        </span>
      );
    }

    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-950/40 border border-amber-900/50 text-amber-400 shrink-0 ${className}`}
      >
        <FileQuestion className="w-3 h-3 text-amber-400" aria-hidden="true" />
        <span>Lyrics Unavailable</span>
      </span>
    );
  }

  if (resolvedStatus === 'scanning') {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-purple-950/40 border border-purple-800/50 text-purple-300 shrink-0 ${className}`}
      >
        <RefreshCw className="w-3 h-3 text-purple-400 animate-spin" aria-hidden="true" />
        <span>Scanning</span>
      </span>
    );
  }

  if (resolvedStatus === 'scan_error') {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-950/40 border border-rose-900/50 text-rose-400 shrink-0 ${className}`}
      >
        <AlertCircle className="w-3 h-3 text-rose-400" aria-hidden="true" />
        <span>Scan Error</span>
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
