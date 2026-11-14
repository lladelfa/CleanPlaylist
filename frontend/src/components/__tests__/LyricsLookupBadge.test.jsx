import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import VerificationStatusBadge from '../VerificationStatusBadge';

describe('Story 7.7: lyrics lookup badge variants', () => {
  it('shows "Couldn\'t check (service error)" with aria-label for upstream_error', () => {
    render(<VerificationStatusBadge track={{ verification_status: 'lyrics_unavailable', lyrics_lookup: 'upstream_error' }} />);
    expect(screen.getByText("Couldn't check (service error)")).toBeInTheDocument();
    expect(screen.getByLabelText(/couldn't check lyrics: lyrics service error/i)).toBeInTheDocument();
    expect(screen.queryByText('Verified Clean')).not.toBeInTheDocument();
  });

  it('shows "No lyrics found" with aria-label for not_found', () => {
    render(<VerificationStatusBadge track={{ verification_status: 'lyrics_unavailable', lyrics_lookup: 'not_found' }} />);
    expect(screen.getByText('No lyrics found')).toBeInTheDocument();
    expect(screen.getByLabelText(/no lyrics found for this song/i)).toBeInTheDocument();
  });

  it('keeps "Lyrics Unavailable" when no lookup outcome is present', () => {
    render(<VerificationStatusBadge track={{ verification_status: 'lyrics_unavailable' }} />);
    expect(screen.getByText('Lyrics Unavailable')).toBeInTheDocument();
  });

  it('still shows Flagged for an explicit track whose lookup failed', () => {
    render(<VerificationStatusBadge track={{ verification_status: 'flagged', is_flagged: true, lyrics_lookup: 'upstream_error' }} />);
    expect(screen.getByText('Flagged')).toBeInTheDocument();
  });

  it('never uses clean emerald tokens for the service-error variant', () => {
    render(<VerificationStatusBadge track={{ verification_status: 'lyrics_unavailable', lyrics_lookup: 'upstream_error' }} />);
    const badge = screen.getByLabelText(/couldn't check lyrics/i);
    expect(badge.className).not.toMatch(/status-clean/);
  });
});
