import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import AboutTab from '../AboutTab';
import { VERIFIED_CLEAN_CAVEAT } from '../../utils/verifiedCleanCaveat';

describe('AboutTab component', () => {
  it('renders the hero brand manifesto and zero-login trust badge', () => {
    render(<AboutTab activePlatform="spotify" onNavigateTab={() => {}} />);

    expect(
      screen.getByRole('heading', { name: /share the music you love/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/informed judgment over blind censorship/i)
    ).toBeInTheDocument();

    const zeroLoginChip = screen.getByText(/100% Zero-Login • \$0 API Keys Required/i);
    expect(zeroLoginChip).toBeInTheDocument();
    expect(zeroLoginChip.closest('div')?.className || '').not.toMatch(/emerald|status-clean/);
  });

  it('contrasts streaming [E] blind spots with all 4 verification statuses and the verified clean caveat', () => {
    render(<AboutTab activePlatform="spotify" onNavigateTab={() => {}} />);

    expect(screen.getByText(/the streaming \[e\] blind spot/i)).toBeInTheDocument();
    expect(screen.getByText(/nostalgia blind spots/i)).toBeInTheDocument();
    expect(screen.getByText(/opaque modern tags/i)).toBeInTheDocument();

    const untaggedBadge = screen.getByText(/untagged in metadata/i);
    expect(untaggedBadge).toBeInTheDocument();
    expect(untaggedBadge.className).not.toMatch(/emerald|status-clean/);

    expect(screen.getByText('Verified Clean')).toBeInTheDocument();
    expect(screen.getByText('Clean Swapped')).toBeInTheDocument();
    expect(screen.getByText('Flagged')).toBeInTheDocument();
    expect(screen.getByText('Lyrics Unavailable')).toBeInTheDocument();
    expect(screen.getByText(/zero false-clean guarantee/i)).toBeInTheDocument();
    expect(screen.getByText(VERIFIED_CLEAN_CAVEAT)).toBeInTheDocument();
  });

  it('enforces brand-primary and brand-foreground contrast tokens on primary CTA buttons', () => {
    render(<AboutTab activePlatform="spotify" onNavigateTab={() => {}} />);

    const heroCta = screen.getByRole('button', { name: /open scan & clean studio/i });
    expect(heroCta).toHaveClass('bg-brand-primary');
    expect(heroCta).toHaveClass('text-brand-foreground');

    const bottomCta = screen.getByRole('button', { name: /launch scan & clean/i });
    expect(bottomCta).toHaveClass('bg-brand-primary');
    expect(bottomCta).toHaveClass('text-brand-foreground');
  });

  it('renders the 3 studio workflow cards with accurate codebase terminology and zero fabricated telemetry', () => {
    render(<AboutTab activePlatform="spotify" onNavigateTab={() => {}} />);

    expect(screen.getByRole('heading', { name: /how the studio works/i })).toBeInTheDocument();
    expect(screen.getByText(/Slurs \+ Strong Language/i)).toBeInTheDocument();
    expect(screen.getAllByText(/line-numbered/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/\bgun\b/i)).toBeInTheDocument();

    expect(screen.queryByText(/timestamp markers/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/timestamped verses/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/version 2\.4\.8/i)).not.toBeInTheDocument();
  });

  it('renders the 3 protagonist stories and 3 under-the-hood zero-login pillars', () => {
    render(<AboutTab activePlatform="spotify" onNavigateTab={() => {}} />);

    expect(screen.getByText(/Randy • Parent of 2/i)).toBeInTheDocument();
    expect(screen.getByText(/Jill • Middle School Mom/i)).toBeInTheDocument();
    expect(screen.getByText(/Ms\. Rivera • 5th Grade Teacher/i)).toBeInTheDocument();

    expect(screen.getByText(/Cross-Platform Lyric Cross-Reference/i)).toBeInTheDocument();
    expect(screen.getByText(/Dual Zero-Auth Finish Line/i)).toBeInTheDocument();
    expect(screen.getByText(/Zero-Login by Design/i)).toBeInTheDocument();
  });

  it('routes studio launcher buttons to scan, keywords, and stitch tabs', async () => {
    const onNavigateTab = vi.fn();
    const user = userEvent.setup();
    render(<AboutTab activePlatform="spotify" onNavigateTab={onNavigateTab} />);

    await user.click(screen.getByRole('button', { name: /open scan & clean studio/i }));
    await user.click(screen.getByRole('button', { name: /try scan & clean/i }));
    await user.click(screen.getByRole('button', { name: /launch scan & clean/i }));
    await user.click(screen.getByRole('button', { name: /open keyword search/i }));
    await user.click(screen.getByRole('button', { name: /explore stitch studio/i }));
    await user.click(screen.getByRole('button', { name: /launch stitch studio/i }));
    await user.click(screen.getByRole('button', { name: /open stitch studio/i }));

    expect(onNavigateTab).toHaveBeenNthCalledWith(1, 'scan');
    expect(onNavigateTab).toHaveBeenNthCalledWith(2, 'scan');
    expect(onNavigateTab).toHaveBeenNthCalledWith(3, 'scan');
    expect(onNavigateTab).toHaveBeenNthCalledWith(4, 'keywords');
    expect(onNavigateTab).toHaveBeenNthCalledWith(5, 'stitch');
    expect(onNavigateTab).toHaveBeenNthCalledWith(6, 'stitch');
    expect(onNavigateTab).toHaveBeenNthCalledWith(7, 'stitch');
  });
});
