import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FinishLineBar from '../FinishLineBar';

describe('Story 3.4: FinishLineBar Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockTracks = [
    { id: 't1', title: 'Song 1', verification_status: 'verified_clean', ytmusic_video_id: 'yt_1' },
    { id: 't2', title: 'Song 2', verification_status: 'clean_swapped', ytmusic_video_id: 'yt_2' },
    { id: 't3', title: 'Song 3', verification_status: 'flagged' },
  ];

  it('renders ready track count and flagged count', () => {
    render(
      <FinishLineBar
        tracks={mockTracks}
        activePlatform="spotify"
        onNotice={vi.fn()}
      />
    );

    expect(screen.getAllByText(/2 tracks ready/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1 need review/i).length).toBeGreaterThan(0);
  });

  it('includes kept flagged tracks in ready tracks count', () => {
    render(
      <FinishLineBar
        tracks={mockTracks}
        keptTrackIds={new Set(['t3'])}
        activePlatform="spotify"
        onNotice={vi.fn()}
      />
    );

    // Now all 3 tracks are ready (2 clean + 1 kept) and 0 need review
    expect(screen.getAllByText(/3 tracks ready/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/need review/i)).not.toBeInTheDocument();
  });

  it('disables Play Clean Queue when 0 tracks are ready', () => {
    const flaggedOnly = [
      { id: 't1', title: 'Song 1', verification_status: 'flagged' },
    ];

    render(
      <FinishLineBar
        tracks={flaggedOnly}
        activePlatform="spotify"
        onNotice={vi.fn()}
      />
    );

    const playButtons = screen.getAllByRole('button', { name: /play clean queue/i });
    expect(playButtons.length).toBeGreaterThan(0);
    playButtons.forEach((btn) => {
      expect(btn).toBeDisabled();
    });
  });

  it('launches YouTube clean queue when Play Clean Queue is clicked', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => {});
    const onNotice = vi.fn();

    render(
      <FinishLineBar
        tracks={mockTracks}
        activePlatform="spotify"
        onNotice={onNotice}
      />
    );

    const playButtons = screen.getAllByRole('button', { name: /play clean queue/i });
    expect(playButtons[0]).not.toBeDisabled();
    fireEvent.click(playButtons[0]);

    expect(openSpy).toHaveBeenCalledWith(
      'https://www.youtube.com/watch_videos?video_ids=yt_1,yt_2',
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('surfaces caution notice when spotify ready tracks lack YouTube IDs', () => {
    const tracksWithoutYt = [
      { id: 't1', title: 'Song 1', verification_status: 'verified_clean' }, // No ytmusic_video_id
    ];

    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => {});
    const onNotice = vi.fn();

    render(
      <FinishLineBar
        tracks={tracksWithoutYt}
        activePlatform="spotify"
        onNotice={onNotice}
      />
    );

    const playButtons = screen.getAllByRole('button', { name: /play clean queue/i });
    fireEvent.click(playButtons[0]);

    expect(openSpy).not.toHaveBeenCalled();
    expect(onNotice).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'caution',
        message: expect.stringContaining('Run lyric scan first'),
      })
    );
  });
});
