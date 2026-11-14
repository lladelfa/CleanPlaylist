import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import EmptyStateHero from '../EmptyStateHero';

describe('EmptyStateHero component', () => {
  it('renders the 3-step visual narrative with correct headings and descriptions', () => {
    render(<EmptyStateHero />);

    expect(screen.getByRole('region', { name: /how cleanplaylist works/i })).toBeInTheDocument();

    // Step 1: Source Music
    expect(screen.getByText('01')).toBeInTheDocument();
    expect(screen.getByText('Source Music')).toBeInTheDocument();
    expect(
      screen.getByText(/Search catalog, paste multi-line list, or paste a playlist link/i)
    ).toBeInTheDocument();

    // Step 2: Screen Rules
    expect(screen.getByText('02')).toBeInTheDocument();
    expect(screen.getByText('Screen Rules')).toBeInTheDocument();
    expect(
      screen.getByText(/Select Kid Safe, Moderate, or Slurs Only/i)
    ).toBeInTheDocument();

    // Step 3: Clean Swaps
    expect(screen.getByText('03')).toBeInTheDocument();
    expect(screen.getByText('Clean Swaps')).toBeInTheDocument();
    expect(
      screen.getByText(/One-click swap explicit tracks with verified clean cuts/i)
    ).toBeInTheDocument();
  });

  it('calls onOpenAbout when the About & How It Works link button is clicked', async () => {
    const onOpenAbout = vi.fn();
    const user = userEvent.setup();
    render(<EmptyStateHero onOpenAbout={onOpenAbout} />);

    const aboutBtn = screen.getByRole('button', {
      name: /learn how cleanplaylist works & why \[e\] badges fail/i,
    });
    await user.click(aboutBtn);

    expect(onOpenAbout).toHaveBeenCalledTimes(1);
  });
});
