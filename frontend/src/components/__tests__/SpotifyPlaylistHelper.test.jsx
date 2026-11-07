import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SpotifyPlaylistHelper from '../SpotifyPlaylistHelper';

describe('SpotifyPlaylistHelper component', () => {
  it('renders studio-indigo container and 3-step desktop copy instructions', () => {
    render(<SpotifyPlaylistHelper />);

    // Headline and explanation
    expect(
      screen.getByText(/Public Spotify playlist links require a quick copy-paste/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/desktop clipboard/i)).toBeInTheDocument();

    // 3 steps
    expect(screen.getByText(/Open playlist in Spotify Desktop/i)).toBeInTheDocument();
    expect(screen.getByText(/Select tracks/i)).toBeInTheDocument();
    expect(screen.getByText(/Paste track links or/i)).toBeInTheDocument();

    // Action buttons
    expect(screen.getByRole('button', { name: /Focus Paste Box/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Search Albums Instead/i })).toBeInTheDocument();
  });

  it('triggers onFocusPaste callback when "Focus Paste Box" is clicked', () => {
    const handleFocusPaste = vi.fn();
    render(<SpotifyPlaylistHelper onFocusPaste={handleFocusPaste} />);

    fireEvent.click(screen.getByRole('button', { name: /Focus Paste Box/i }));
    expect(handleFocusPaste).toHaveBeenCalledTimes(1);
  });

  it('triggers onSearchAlbumsInstead callback when "Search Albums Instead" is clicked', () => {
    const handleSearchAlbums = vi.fn();
    render(<SpotifyPlaylistHelper onSearchAlbumsInstead={handleSearchAlbums} />);

    fireEvent.click(screen.getByRole('button', { name: /Search Albums Instead/i }));
    expect(handleSearchAlbums).toHaveBeenCalledTimes(1);
  });

  it('triggers onDismiss callback when dismiss button is clicked', () => {
    const handleDismiss = vi.fn();
    render(<SpotifyPlaylistHelper onDismiss={handleDismiss} />);

    const dismissBtn = screen.getByRole('button', { name: /Dismiss helper/i });
    fireEvent.click(dismissBtn);
    expect(handleDismiss).toHaveBeenCalledTimes(1);
  });
});
