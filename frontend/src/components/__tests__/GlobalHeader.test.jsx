import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import GlobalHeader from '../GlobalHeader';

describe('GlobalHeader', () => {
  it('renders strictly 3 navigation tabs with Stitch Studio', () => {
    render(
      <GlobalHeader
        activeTab="scan"
        setActiveTab={() => {}}
        activePlatform="spotify"
        onSelectPlatform={() => {}}
      />
    );

    expect(screen.getByRole('button', { name: /scan & clean/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /keyword search/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /stitch studio/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /stitch playlists/i })).not.toBeInTheDocument();
  });

  it('does not render public login or read-only mode badges', () => {
    const { rerender } = render(
      <GlobalHeader
        activeTab="scan"
        setActiveTab={() => {}}
        activePlatform="spotify"
        onSelectPlatform={() => {}}
      />
    );

    expect(screen.queryByText(/login to spotify/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/read-only mode/i)).not.toBeInTheDocument();

    rerender(
      <GlobalHeader
        activeTab="scan"
        setActiveTab={() => {}}
        activePlatform="ytmusic"
        onSelectPlatform={() => {}}
      />
    );

    expect(screen.queryByText(/login to spotify/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/read-only mode/i)).not.toBeInTheDocument();
  });

  it('switches tabs on tab click', async () => {
    const setActiveTab = vi.fn();
    const user = userEvent.setup();
    render(
      <GlobalHeader
        activeTab="scan"
        setActiveTab={setActiveTab}
        activePlatform="spotify"
        onSelectPlatform={() => {}}
      />
    );

    await user.click(screen.getByRole('button', { name: /stitch studio/i }));
    expect(setActiveTab).toHaveBeenCalledWith('stitch');
  });
});
