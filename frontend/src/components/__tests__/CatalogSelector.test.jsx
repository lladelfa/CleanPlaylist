import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import CatalogSelector from '../CatalogSelector';

describe('CatalogSelector', () => {
  it('renders both Spotify and YouTube Music options', () => {
    render(<CatalogSelector activePlatform="spotify" onSelectPlatform={() => {}} />);
    expect(screen.getByRole('button', { name: /spotify/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /youtube music/i })).toBeInTheDocument();
  });

  it('indicates the active platform styling', () => {
    const { rerender } = render(<CatalogSelector activePlatform="spotify" onSelectPlatform={() => {}} />);
    const spotifyBtn = screen.getByRole('button', { name: /spotify/i });
    const ytBtn = screen.getByRole('button', { name: /youtube music/i });

    expect(spotifyBtn).toHaveAttribute('aria-pressed', 'true');
    expect(ytBtn).toHaveAttribute('aria-pressed', 'false');

    rerender(<CatalogSelector activePlatform="ytmusic" onSelectPlatform={() => {}} />);
    expect(spotifyBtn).toHaveAttribute('aria-pressed', 'false');
    expect(ytBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('calls onSelectPlatform when inactive segment is clicked', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<CatalogSelector activePlatform="spotify" onSelectPlatform={onSelect} />);

    await user.click(screen.getByRole('button', { name: /youtube music/i }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('ytmusic');
  });

  it('does not trigger onSelectPlatform if active segment is clicked again', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<CatalogSelector activePlatform="spotify" onSelectPlatform={onSelect} />);

    await user.click(screen.getByRole('button', { name: /spotify/i }));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('supports ArrowRight and ArrowLeft keyboard navigation', () => {
    const onSelect = vi.fn();
    render(<CatalogSelector activePlatform="spotify" onSelectPlatform={onSelect} />);

    const spotifyBtn = screen.getByRole('button', { name: /spotify/i });
    fireEvent.keyDown(spotifyBtn, { key: 'ArrowRight' });

    expect(onSelect).toHaveBeenCalledWith('ytmusic');
  });
});
