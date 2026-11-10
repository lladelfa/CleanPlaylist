import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FinishLineBar from '../FinishLineBar';

describe('FinishLineBar Component', () => {
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

    expect(screen.getAllByText(/3 tracks ready/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/need review/i)).not.toBeInTheDocument();
  });

  it('disables Play Clean Queue and Copy buttons when 0 tracks are ready', () => {
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

    const copyButtons = screen.getAllByRole('button', { name: /copy clean track links/i });
    expect(copyButtons.length).toBeGreaterThan(0);
    copyButtons.forEach((btn) => {
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

  describe('Story 3.5: Desktop & Mobile Finishing Actions', () => {
    it('renders desktop primary Copy CTA with Spotify Desktop paste instruction hint', () => {
      render(
        <FinishLineBar
          tracks={mockTracks}
          activePlatform="spotify"
          onNotice={vi.fn()}
        />
      );

      // Desktop primary CTA copy button
      const copyButtons = screen.getAllByRole('button', { name: /copy clean track links/i });
      expect(copyButtons.length).toBeGreaterThan(0);

      // Monospace paste hint
      expect(screen.getByText(/Ctrl\+V \/ Cmd\+V in Spotify Desktop/i)).toBeInTheDocument();
    });

    it('copies clean links to clipboard and announces notice when Copy Clean Track Links is clicked', async () => {
      const onNotice = vi.fn();
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock,
        },
      });

      render(
        <FinishLineBar
          tracks={mockTracks}
          activePlatform="spotify"
          onNotice={onNotice}
        />
      );

      const copyButtons = screen.getAllByRole('button', { name: /copy clean track links/i });
      fireEvent.click(copyButtons[0]);

      await waitFor(() => {
        expect(writeTextMock).toHaveBeenCalledWith(
          'https://open.spotify.com/track/t1\nhttps://open.spotify.com/track/t2'
        );
        expect(onNotice).toHaveBeenCalledWith({
          type: 'success',
          message: 'Copied 2 Clean Track Links',
        });
      });
    });

    it('opens Export popover and triggers export action on format selection', async () => {
      const onNotice = vi.fn();
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        blob: vi.fn().mockResolvedValue(new Blob(['test'], { type: 'text/csv' })),
        headers: new Headers({ 'Content-Disposition': 'attachment; filename="Export.csv"' }),
      });
      global.fetch = fetchMock;

      render(
        <FinishLineBar
          tracks={mockTracks}
          activePlatform="spotify"
          playlistTitle="Party Mix"
          onNotice={onNotice}
        />
      );

      // Open export menu
      const exportButtons = screen.getAllByRole('button', { name: /export/i });
      fireEvent.click(exportButtons[0]);

      // Popover options appear
      const csvButtons = screen.getAllByRole('button', { name: /export as csv/i });
      expect(csvButtons.length).toBeGreaterThan(0);
      expect(screen.getAllByRole('button', { name: /export as m3u8/i }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole('button', { name: /export as json/i }).length).toBeGreaterThan(0);

      // Click CSV export
      fireEvent.click(csvButtons[0]);

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          '/api/export',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('"format":"csv"'),
          })
        );
      });
    });

    it('closes export popover when clicking outside or pressing Escape', () => {
      render(
        <FinishLineBar
          tracks={mockTracks}
          activePlatform="spotify"
          onNotice={vi.fn()}
        />
      );

      const exportButtons = screen.getAllByRole('button', { name: /export/i });
      fireEvent.click(exportButtons[0]);
      expect(screen.getAllByRole('button', { name: /export as csv/i }).length).toBeGreaterThan(0);

      // Press Escape
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByRole('button', { name: /export as csv/i })).not.toBeInTheDocument();
    });
  });
});
