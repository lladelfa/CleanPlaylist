import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import VerificationStatusBadge from '../VerificationStatusBadge';

describe('VerificationStatusBadge component', () => {
  it('renders "Unscanned" in neutral mono style by default', () => {
    render(<VerificationStatusBadge />);
    const badge = screen.getByText('Unscanned');
    expect(badge).toBeInTheDocument();
  });

  it('renders "Unscanned" when status="unscanned"', () => {
    render(<VerificationStatusBadge status="unscanned" />);
    expect(screen.getByText('Unscanned')).toBeInTheDocument();
  });

  it('renders "Verified Clean" in emerald style when status="verified_clean" or "clean"', () => {
    const { rerender } = render(<VerificationStatusBadge status="verified_clean" />);
    expect(screen.getByText('Verified Clean')).toBeInTheDocument();

    rerender(<VerificationStatusBadge status="clean" />);
    expect(screen.getByText('Verified Clean')).toBeInTheDocument();
  });

  it('renders "Clean Swapped" in emerald style when status="clean_swapped" or "swapped"', () => {
    const { rerender } = render(<VerificationStatusBadge status="clean_swapped" />);
    expect(screen.getByText('Clean Swapped')).toBeInTheDocument();

    rerender(<VerificationStatusBadge status="swapped" />);
    expect(screen.getByText('Clean Swapped')).toBeInTheDocument();
  });

  it('renders "Flagged" in flagged/red style when status="flagged"', () => {
    render(<VerificationStatusBadge status="flagged" />);
    expect(screen.getByText('Flagged')).toBeInTheDocument();
  });

  it('renders "Lyrics Unavailable" in amber style when status="lyrics_unavailable"', () => {
    render(<VerificationStatusBadge status="lyrics_unavailable" />);
    const badge = screen.getByText('Lyrics Unavailable');
    expect(badge).toBeInTheDocument();
  });

  it('renders "Scanning" in spinner style when status="scanning"', () => {
    render(<VerificationStatusBadge status="scanning" />);
    const badge = screen.getByText('Scanning');
    expect(badge).toBeInTheDocument();
  });

  it('renders "Scan Error" in rose style when status="scan_error"', () => {
    render(<VerificationStatusBadge status="scan_error" />);
    const badge = screen.getByText('Scan Error');
    expect(badge).toBeInTheDocument();
  });

  it('determines status correctly from track object', () => {
    const trackUnscanned = { verification_status: 'unscanned' };
    const { rerender } = render(<VerificationStatusBadge track={trackUnscanned} />);
    expect(screen.getByText('Unscanned')).toBeInTheDocument();

    const trackSwapped = { was_replaced: true };
    rerender(<VerificationStatusBadge track={trackSwapped} />);
    expect(screen.getByText('Clean Swapped')).toBeInTheDocument();

    const trackFlagged = { is_flagged: true };
    rerender(<VerificationStatusBadge track={trackFlagged} />);
    expect(screen.getByText('Flagged')).toBeInTheDocument();

    const trackClean = { is_flagged: false, verification_status: 'verified_clean' };
    rerender(<VerificationStatusBadge track={trackClean} />);
    expect(screen.getByText('Verified Clean')).toBeInTheDocument();

    const trackLyricsUnavailable = { is_flagged: false, verification_status: 'lyrics_unavailable' };
    rerender(<VerificationStatusBadge track={trackLyricsUnavailable} />);
    expect(screen.getByText('Lyrics Unavailable')).toBeInTheDocument();

    const trackScanning = { verification_status: 'scanning' };
    rerender(<VerificationStatusBadge track={trackScanning} />);
    expect(screen.getByText('Scanning')).toBeInTheDocument();

    const trackError = { verification_status: 'scan_error' };
    rerender(<VerificationStatusBadge track={trackError} />);
    expect(screen.getByText('Scan Error')).toBeInTheDocument();

    // Does not allow legacy track.is_clean to bypass without verification_status: 'verified_clean'
    const trackLegacyClean = { is_clean: true };
    rerender(<VerificationStatusBadge track={trackLegacyClean} />);
    expect(screen.queryByText('Verified Clean')).not.toBeInTheDocument();
    expect(screen.getByText('Unscanned')).toBeInTheDocument();
  });

  it('prioritizes track state when status="unscanned" so replaced or flagged tracks display correct badge', () => {
    const trackSwapped = { was_replaced: true, is_flagged: false };
    const { rerender } = render(<VerificationStatusBadge status="unscanned" track={trackSwapped} />);
    expect(screen.getByText('Clean Swapped')).toBeInTheDocument();

    const trackFlagged = { is_flagged: true };
    rerender(<VerificationStatusBadge status="unscanned" track={trackFlagged} />);
    expect(screen.getByText('Flagged')).toBeInTheDocument();

    const trackLyricsUnavailable = { is_flagged: false, verification_status: 'lyrics_unavailable' };
    rerender(<VerificationStatusBadge status="unscanned" track={trackLyricsUnavailable} />);
    expect(screen.getByText('Lyrics Unavailable')).toBeInTheDocument();

    const trackError = { verification_status: 'scan_error' };
    rerender(<VerificationStatusBadge status="unscanned" track={trackError} />);
    expect(screen.getByText('Scan Error')).toBeInTheDocument();
  });
});
