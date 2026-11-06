import React, { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ScanTab from '../ScanTab';

describe('ScanTab - Instant Staging & Quota Capping', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  function StatefulScanTabHarness({ initialTracks = [] }) {
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
        activePlatform="spotify"
      />
    );
  }

  it('stages song with unscanned status when Add Song is clicked from preview tray', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      if (url === '/api/catalog/search') {
        return {
          ok: true,
          json: async () => ({
            songs: [
              {
                id: 'sp_test_1',
                title: 'Staged Song',
                artist: 'Test Artist',
                album: 'Test Album',
                duration: '3:30',
                duration_seconds: 210,
                is_explicit: false,
                thumbnail: 'https://example.com/test.jpg',
                video_url: 'https://open.spotify.com/track/sp_test_1',
                verification_status: 'unscanned',
              },
            ],
            albums: [],
          }),
        };
      }
      return { ok: false };
    });

    const user = userEvent.setup();
    render(<StatefulScanTabHarness />);

    const searchInput = screen.getByPlaceholderText(/search songs or albums/i);
    await user.type(searchInput, 'Staged');

    const addSongBtn = await screen.findByRole('button', { name: /add song staged song/i });
    await user.click(addSongBtn);

    const stagedMatches = await screen.findAllByText('Staged Song');
    expect(stagedMatches.length).toBeGreaterThanOrEqual(2);
  });

  it('ignores duplicate track and triggers Already in Working List NoticeBanner', async () => {
    const existingTrack = {
      id: 'sp_existing',
      title: 'Existing Hit',
      artist: 'Artist E',
      album: 'Album E',
      duration: '3:00',
      duration_seconds: 180,
      is_explicit: false,
      thumbnail: '',
      video_url: '',
      verification_status: 'unscanned',
    };

    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      if (url === '/api/catalog/search') {
        return {
          ok: true,
          json: async () => ({
            songs: [existingTrack],
            albums: [],
          }),
        };
      }
      return { ok: false };
    });

    const user = userEvent.setup();
    render(<StatefulScanTabHarness initialTracks={[existingTrack]} />);

    const searchInput = screen.getByPlaceholderText(/search songs or albums/i);
    await user.type(searchInput, 'Existing');

    const addSongBtn = await screen.findByRole('button', { name: /add song existing hit/i });
    await user.click(addSongBtn);

    expect(
      await screen.findByText(/"Existing Hit" is already in Working List\./i)
    ).toBeInTheDocument();
  });

  it('triggers capacity notice when trying to add a song to an already full 50-track list', async () => {
    const fullTracks = Array.from({ length: 50 }, (_, i) => ({
      id: `existing_${i}`,
      title: `Song ${i}`,
      artist: 'Artist',
      album: 'Album',
      duration: '3:00',
      duration_seconds: 180,
      is_explicit: false,
      thumbnail: '',
      video_url: '',
      verification_status: 'unscanned',
    }));

    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      if (url === '/api/catalog/search') {
        return {
          ok: true,
          json: async () => ({
            songs: [
              {
                id: 'sp_extra',
                title: 'Extra Track',
                artist: 'Artist',
                album: 'Album',
                duration: '3:00',
                duration_seconds: 180,
                is_explicit: false,
                thumbnail: '',
                video_url: '',
                verification_status: 'unscanned',
              },
            ],
            albums: [],
          }),
        };
      }
      return { ok: false };
    });

    const user = userEvent.setup();
    render(<StatefulScanTabHarness initialTracks={fullTracks} />);

    const searchInput = screen.getByPlaceholderText(/search songs or albums/i);
    await user.type(searchInput, 'Extra');

    const addSongBtn = await screen.findByRole('button', { name: /add song extra track/i });
    await user.click(addSongBtn);

    expect(
      await screen.findByText(/Working list is at capacity \(50 tracks maximum\)\./i)
    ).toBeInTheDocument();
  });

  it('adds album tracks and displays amber NoticeBanner when capped at 50 tracks', async () => {
    const existingTracks = Array.from({ length: 45 }, (_, i) => ({
      id: `existing_${i}`,
      title: `Song ${i}`,
      artist: 'Artist',
      album: 'Album',
      duration: '3:00',
      duration_seconds: 180,
      is_explicit: false,
      thumbnail: '',
      video_url: '',
      verification_status: 'unscanned',
    }));

    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      if (url === '/api/catalog/search') {
        return {
          ok: true,
          json: async () => ({
            songs: [],
            albums: [
              {
                id: 'alb_1',
                title: 'Mega Album',
                artist: 'Big Artist',
                track_count: 10,
                thumbnail: '',
              },
            ],
          }),
        };
      }
      if (url === '/api/catalog/album') {
        return {
          ok: true,
          json: async () => ({
            id: 'alb_1',
            title: 'Mega Album',
            artist: 'Big Artist',
            track_count: 10,
            tracks: Array.from({ length: 10 }, (_, i) => ({
              id: `album_track_${i}`,
              title: `Album Song ${i}`,
              artist: 'Big Artist',
              album: 'Mega Album',
              duration: '3:00',
              duration_seconds: 180,
              is_explicit: false,
              thumbnail: '',
              video_url: '',
              verification_status: 'unscanned',
            })),
          }),
        };
      }
      return { ok: false };
    });

    const user = userEvent.setup();
    render(<StatefulScanTabHarness initialTracks={existingTracks} />);

    const searchInput = screen.getByPlaceholderText(/search songs or albums/i);
    await user.type(searchInput, 'Mega');

    const addAlbumBtn = await screen.findByRole('button', { name: /add album mega album/i });
    await user.click(addAlbumBtn);

    // 45 + 10 = 55 -> capped at 50 with 5 omitted
    expect(
      await screen.findByText(/Working list capped at 50 tracks \(5 tracks omitted\)\./i)
    ).toBeInTheDocument();
  });
});
