import React, { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ScanTab from '../ScanTab';

function StatefulScanTabHarness({ initialTracks = [], activePlatform = 'spotify' }) {
  const [platform, setPlatform] = useState(activePlatform);
  const [scannedTracks, setScannedTracks] = useState(initialTracks);
  const [workingList, setWorkingList] = useState(initialTracks);
  const [playlist, setPlaylist] = useState(
    initialTracks.length > 0
      ? { id: 'test_pl', title: 'Test List', author: 'Tester', tracks: initialTracks }
      : null
  );

  return (
    <ScanTab
      playlist={playlist}
      setPlaylist={setPlaylist}
      scannedTracks={scannedTracks}
      setScannedTracks={(updater) => {
        if (typeof updater === 'function') {
          setScannedTracks((prev) => {
            const next = updater(prev);
            setWorkingList(next);
            return next;
          });
        } else {
          setScannedTracks(updater);
          setWorkingList(updater);
        }
      }}
      workingList={workingList}
      setWorkingList={setWorkingList}
      onOpenLyrics={vi.fn()}
      customBlocklist={[]}
      setCustomBlocklist={vi.fn()}
      preset="moderate"
      setPreset={vi.fn()}
      isAuthenticated={false}
      onOpenAuth={vi.fn()}
      activePlatform={platform}
      onSwitchPlatform={setPlatform}
    />
  );
}

describe('ScanTab - Multi-Line Paste & Catalog Resolve Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('opens PasteTrackListPanel populated when multi-line text is pasted into SmartInputBar', async () => {
    const user = userEvent.setup();
    render(<StatefulScanTabHarness />);

    expect(screen.queryByLabelText(/paste track list panel/i)).not.toBeInTheDocument();

    const input = screen.getByPlaceholderText(/search songs or albums/i);
    await user.click(input);
    await user.paste('Coldplay - Yellow\nQueen - Bohemian Rhapsody');

    expect(screen.getByLabelText(/paste track list panel/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/line counter/i)).toHaveTextContent('2 / 50 lines');
  });

  it('opens PasteTrackListPanel when Paste Track List button is clicked', async () => {
    const user = userEvent.setup();
    render(<StatefulScanTabHarness />);

    const pasteBtn = screen.getByRole('button', { name: /paste track list/i });
    await user.click(pasteBtn);

    expect(screen.getByLabelText(/paste track list panel/i)).toBeInTheDocument();
  });

  it('calls POST /api/catalog/resolve in chunks of <= 15 lines and adds tracks to workingList', async () => {
    const user = userEvent.setup();

    // 20 lines to test chunking (15 + 5)
    const twentyLines = Array.from({ length: 20 }, (_, i) => `Song ${i + 1}`);

    const fetchCalls = [];
    vi.spyOn(global, 'fetch').mockImplementation(async (url, opts) => {
      if (url === '/api/catalog/resolve') {
        const body = JSON.parse(opts.body);
        fetchCalls.push(body);
        return {
          ok: true,
          json: async () => ({
            resolved: body.lines.map((l, idx) => ({
              id: `track_${fetchCalls.length}_${idx}`,
              title: l,
              artist: 'Artist',
              artists_list: ['Artist'],
              album: 'Album',
              duration: '3:00',
              duration_seconds: 180,
              is_explicit: false,
              thumbnail: '',
              video_url: '',
              verification_status: 'unscanned',
              source_platform: 'spotify',
            })),
            unresolved: [],
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    });

    render(<StatefulScanTabHarness />);

    const pasteBtn = screen.getByRole('button', { name: /paste track list/i });
    await user.click(pasteBtn);

    const textarea = screen.getByLabelText(/pasted track list input/i);
    await user.click(textarea);
    await user.paste(twentyLines.join('\n'));

    expect(screen.getByLabelText(/line counter/i)).toHaveTextContent('20 / 50 lines');

    const resolveBtn = screen.getByRole('button', { name: /resolve & add/i });
    await user.click(resolveBtn);

    await waitFor(() => {
      // Should have made 2 chunk calls: batch 1 of 15, batch 2 of 5
      expect(fetchCalls).toHaveLength(2);
      expect(fetchCalls[0].lines).toHaveLength(15);
      expect(fetchCalls[0].platform).toBe('spotify');
      expect(fetchCalls[1].lines).toHaveLength(5);
      expect(fetchCalls[1].platform).toBe('spotify');
    });

    // All 20 tracks should now appear in the working list
    await waitFor(() => {
      expect(screen.getByText('Song 1')).toBeInTheDocument();
      expect(screen.getByText('Song 20')).toBeInTheDocument();
    });
  });

  it('detects cross-platform URLs, surfaces amber NoticeBanner, and prompts PlatformSwitchModal on switch', async () => {
    const user = userEvent.setup();

    vi.spyOn(global, 'fetch').mockImplementation(async (url, _opts) => {
      if (url === '/api/catalog/resolve') {
        return {
          ok: true,
          json: async () => ({
            resolved: [
              {
                id: 'sp_1',
                title: 'Spotify Track',
                artist: 'Artist',
                artists_list: ['Artist'],
                album: 'Album',
                duration: '3:00',
                duration_seconds: 180,
                is_explicit: false,
                thumbnail: '',
                video_url: '',
                verification_status: 'unscanned',
                source_platform: 'spotify',
              },
            ],
            unresolved: [
              {
                line: 'https://music.youtube.com/watch?v=dQw4w9WgXcQ',
                reason: 'wrong_platform',
                target_platform: 'ytmusic',
              },
            ],
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    });

    render(<StatefulScanTabHarness activePlatform="spotify" />);

    // Open paste panel and resolve
    const pasteBtn = screen.getByRole('button', { name: /paste track list/i });
    await user.click(pasteBtn);

    const textarea = screen.getByLabelText(/pasted track list input/i);
    await user.click(textarea);
    await user.paste('Spotify Track\nhttps://music.youtube.com/watch?v=dQw4w9WgXcQ');

    const resolveBtn = screen.getByRole('button', { name: /resolve & add/i });
    await user.click(resolveBtn);

    // Spotify track should be added
    await waitFor(() => {
      expect(screen.getByText('Spotify Track')).toBeInTheDocument();
    });

    // Amber NoticeBanner should be visible with switch button
    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent(/1 track URL is for YouTube Music and was skipped/i);

    const switchBtn = screen.getByRole('button', { name: /switch to youtube music/i });
    expect(switchBtn).toBeInTheDocument();

    // Clicking switch should open PlatformSwitchModal since workingList has 1 item
    await user.click(switchBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/switch platform to youtube music\?/i)).toBeInTheDocument();

    // Confirm switch
    const confirmBtn = screen.getByRole('button', { name: /switch & clear list/i });
    await user.click(confirmBtn);

    // Working list should be cleared
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.queryByText('Spotify Track')).not.toBeInTheDocument();
    });
  });

  it('caps working list at 50 tracks when resolving pasted list that exceeds capacity', async () => {
    const user = userEvent.setup();

    // Already 45 tracks in working list
    const existingTracks = Array.from({ length: 45 }, (_, i) => ({
      id: `existing_${i}`,
      title: `Existing Track ${i}`,
      artist: 'Artist',
      artists_list: ['Artist'],
      album: 'Album',
      duration: '3:00',
      duration_seconds: 180,
      is_explicit: false,
      thumbnail: '',
      video_url: '',
      verification_status: 'unscanned',
      source_platform: 'spotify',
    }));

    vi.spyOn(global, 'fetch').mockImplementation(async (url, opts) => {
      if (url === '/api/catalog/resolve') {
        const body = JSON.parse(opts.body);
        return {
          ok: true,
          json: async () => ({
            resolved: body.lines.map((l, idx) => ({
              id: `new_track_${idx}`,
              title: l,
              artist: 'Artist',
              artists_list: ['Artist'],
              album: 'Album',
              duration: '3:00',
              duration_seconds: 180,
              is_explicit: false,
              thumbnail: '',
              video_url: '',
              verification_status: 'unscanned',
              source_platform: 'spotify',
            })),
            unresolved: [],
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    });

    render(<StatefulScanTabHarness initialTracks={existingTracks} activePlatform="spotify" />);

    const pasteBtn = screen.getByRole('button', { name: /paste track list/i });
    await user.click(pasteBtn);

    const textarea = screen.getByLabelText(/pasted track list input/i);
    await user.click(textarea);
    // Paste 10 new tracks (capacity is 5)
    const newLines = Array.from({ length: 10 }, (_, i) => `New Song ${i}`);
    await user.paste(newLines.join('\n'));

    const resolveBtn = screen.getByRole('button', { name: /resolve & add/i });
    await user.click(resolveBtn);

    // Only 5 tracks should be added (reaching 50 total) and capacity notice shown
    await waitFor(() => {
      expect(screen.getByText('New Song 0')).toBeInTheDocument();
      expect(screen.getByText('New Song 4')).toBeInTheDocument();
      expect(screen.queryByText('New Song 5')).not.toBeInTheDocument();
      expect(screen.getByText(/working list capped at 50 tracks/i)).toBeInTheDocument();
    });
  });

  it('self-deduplicates identical tracks resolved within the same batch', async () => {
    const user = userEvent.setup();

    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      if (url === '/api/catalog/resolve') {
        return {
          ok: true,
          json: async () => ({
            resolved: [
              {
                id: 'same_id_1',
                title: 'Duplicate Track',
                artist: 'Artist',
                artists_list: ['Artist'],
                album: 'Album',
                duration: '3:00',
                duration_seconds: 180,
                is_explicit: false,
                thumbnail: '',
                video_url: '',
                verification_status: 'unscanned',
                source_platform: 'spotify',
              },
              {
                id: 'same_id_1',
                title: 'Duplicate Track',
                artist: 'Artist',
                artists_list: ['Artist'],
                album: 'Album',
                duration: '3:00',
                duration_seconds: 180,
                is_explicit: false,
                thumbnail: '',
                video_url: '',
                verification_status: 'unscanned',
                source_platform: 'spotify',
              },
            ],
            unresolved: [],
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    });

    render(<StatefulScanTabHarness activePlatform="spotify" />);

    const pasteBtn = screen.getByRole('button', { name: /paste track list/i });
    await user.click(pasteBtn);

    const textarea = screen.getByLabelText(/pasted track list input/i);
    await user.click(textarea);
    await user.paste('Duplicate Track\nDuplicate Track');

    const resolveBtn = screen.getByRole('button', { name: /resolve & add/i });
    await user.click(resolveBtn);

    await waitFor(() => {
      const elements = screen.getAllByText('Duplicate Track');
      // Should only appear once in track listing (plus 0 extra duplicates)
      expect(elements).toHaveLength(1);
    });
  });

  it('surfaces a caution NoticeBanner when some lines fail to resolve in a mixed batch', async () => {
    const user = userEvent.setup();

    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      if (url === '/api/catalog/resolve') {
        return {
          ok: true,
          json: async () => ({
            resolved: [
              {
                id: 'sp_valid',
                title: 'Valid Song',
                artist: 'Artist',
                artists_list: ['Artist'],
                album: 'Album',
                duration: '3:00',
                duration_seconds: 180,
                is_explicit: false,
                thumbnail: '',
                video_url: '',
                verification_status: 'unscanned',
                source_platform: 'spotify',
              },
            ],
            unresolved: [
              {
                line: 'Unknown Nonsense Query',
                reason: 'not_found',
              },
            ],
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    });

    render(<StatefulScanTabHarness activePlatform="spotify" />);

    const pasteBtn = screen.getByRole('button', { name: /paste track list/i });
    await user.click(pasteBtn);

    const textarea = screen.getByLabelText(/pasted track list input/i);
    await user.click(textarea);
    await user.paste('Valid Song\nUnknown Nonsense Query');

    const resolveBtn = screen.getByRole('button', { name: /resolve & add/i });
    await user.click(resolveBtn);

    await waitFor(() => {
      expect(screen.getByText('Valid Song')).toBeInTheDocument();
      expect(screen.getByText(/added 1 track\. 1 line could not be resolved\./i)).toBeInTheDocument();
    });
  });

  it('surfaces caution notice when resolving with list already full at 50 tracks', async () => {
    const user = userEvent.setup();
    const fiftyTracks = Array.from({ length: 50 }, (_, i) => ({
      id: `existing_${i}`,
      title: `Song ${i}`,
      artist: 'Artist',
      artists_list: ['Artist'],
      album: 'Album',
      duration: '3:00',
      duration_seconds: 180,
      is_explicit: false,
      thumbnail: '',
      video_url: '',
      verification_status: 'unscanned',
      source_platform: 'spotify',
    }));

    render(<StatefulScanTabHarness initialTracks={fiftyTracks} activePlatform="spotify" />);

    const pasteBtn = screen.getByRole('button', { name: /paste track list/i });
    await user.click(pasteBtn);

    const textarea = screen.getByLabelText(/pasted track list input/i);
    await user.click(textarea);
    await user.paste('Another Song');

    const resolveBtn = screen.getByRole('button', { name: /resolve & add/i });
    await user.click(resolveBtn);

    await waitFor(() => {
      expect(screen.getByText(/working list is at capacity \(50 tracks maximum\)/i)).toBeInTheDocument();
    });
  });

  it('delegates to onRequestPlatformChange directly when provided without local modal', async () => {
    const user = userEvent.setup();
    const handlePlatformChange = vi.fn();

    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      if (url === '/api/catalog/resolve') {
        return {
          ok: true,
          json: async () => ({
            resolved: [],
            unresolved: [
              {
                line: 'https://music.youtube.com/watch?v=dQw4w9WgXcQ',
                reason: 'wrong_platform',
                target_platform: 'ytmusic',
              },
            ],
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    });

    render(
      <ScanTab
        playlist={null}
        setPlaylist={vi.fn()}
        scannedTracks={[{ id: 't1', title: 'Track 1', artist: 'A', duration: '3:00' }]}
        setScannedTracks={vi.fn()}
        workingList={[{ id: 't1', title: 'Track 1', artist: 'A', duration: '3:00' }]}
        setWorkingList={vi.fn()}
        onOpenLyrics={vi.fn()}
        customBlocklist={[]}
        setCustomBlocklist={vi.fn()}
        preset="moderate"
        setPreset={vi.fn()}
        isAuthenticated={false}
        onOpenAuth={vi.fn()}
        activePlatform="spotify"
        onRequestPlatformChange={handlePlatformChange}
      />
    );

    const pasteBtn = screen.getByRole('button', { name: /paste track list/i });
    await user.click(pasteBtn);

    const textarea = screen.getByLabelText(/pasted track list input/i);
    await user.click(textarea);
    await user.paste('https://music.youtube.com/watch?v=dQw4w9WgXcQ');

    const resolveBtn = screen.getByRole('button', { name: /resolve & add/i });
    await user.click(resolveBtn);

    const switchBtn = await screen.findByRole('button', { name: /switch to youtube music/i });
    await user.click(switchBtn);

    expect(handlePlatformChange).toHaveBeenCalledWith('ytmusic');
    // Local modal should NOT be in the document because onRequestPlatformChange was handled
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
