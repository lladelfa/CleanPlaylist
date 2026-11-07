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

    const trackClean = { is_flagged: false, is_clean: true };
    rerender(<VerificationStatusBadge track={trackClean} />);
    expect(screen.getByText('Verified Clean')).toBeInTheDocument();
  });

  it('prioritizes track state when status="unscanned" so replaced or flagged tracks display correct badge', () => {
    const trackSwapped = { was_replaced: true, is_flagged: false };
    const { rerender } = render(<VerificationStatusBadge status="unscanned" track={trackSwapped} />);
    expect(screen.getByText('Clean Swapped')).toBeInTheDocument();

    const trackFlagged = { is_flagged: true };
    rerender(<VerificationStatusBadge status="unscanned" track={trackFlagged} />);
    expect(screen.getByText('Flagged')).toBeInTheDocument();
  });
});
