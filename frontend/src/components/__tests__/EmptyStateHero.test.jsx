import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
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
});
