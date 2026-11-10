import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import StitchTab from '../StitchTab';

describe('Story 4.1: StitchTab Multi-Source Input Pool & 50-Track Quota Bar', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn();
  });

  const mockWorkingList = [
    { id: 'track-1', title: 'Song One', artist: 'Artist A', duration_seconds: 180 },
    { id: 'track-2', title: 'Song Two', artist: 'Artist B', duration_seconds: 200 },
  ];

  const mockLyricsByTrackId = {
    'track-1': 'Clean lyrics for song one',
    'track-2': 'Explicit lyrics for song two',
  };

  it('renders all 4 source triggers and the combined quota meter', () => {
    render(
      <StitchTab
        workingList={[]}
        lyricsByTrackId={{}}
        activePlatform="ytmusic"
      />
    );

    // 1. YouTube playlist URL input and button
    expect(screen.getByPlaceholderText(/youtube music playlist url/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add playlist/i })).toBeInTheDocument();

    // 2. Searched album trigger
    expect(screen.getByRole('button', { name: /search album/i })).toBeInTheDocument();

    // 3. Paste track list trigger
    expect(screen.getByRole('button', { name: /paste track list/i })).toBeInTheDocument();

    // 4. Add Current Working List trigger (disabled when empty)
    const addWorkingListBtn = screen.getByRole('button', { name: /add current working list/i });
    expect(addWorkingListBtn).toBeInTheDocument();
    expect(addWorkingListBtn).toBeDisabled();

    // Combined track quota meter
    expect(screen.getByText(/combined track quota:\s*0\s*\/\s*50\s*staged/i)).toBeInTheDocument();
  });

  it('enables Add Current Working List when workingList has tracks and adds an isolated snapshot preserving cached lyrics', () => {
    render(
      <StitchTab
        initialPlaylist={{ id: 'initial-pl', title: 'My Initial Playlist' }}
        workingList={mockWorkingList}
        lyricsByTrackId={mockLyricsByTrackId}
        activePlatform="ytmusic"
      />
    );

    const addWorkingListBtn = screen.getByRole('button', { name: /add current working list/i });
    expect(addWorkingListBtn).not.toBeDisabled();

    fireEvent.click(addWorkingListBtn);

    // Renders source card
    expect(screen.getByText('Working List (My Initial Playlist)')).toBeInTheDocument();
    expect(screen.getByText(/2 tracks/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remove source working list/i })).toBeInTheDocument();

    // Quota updates live
    expect(screen.getByText(/combined track quota:\s*2\s*\/\s*50\s*staged/i)).toBeInTheDocument();
  });

  it('fetches and adds a YouTube Music playlist URL to the pool', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'yt-pl-123',
        title: 'Classroom Pop Hits',
        tracks: [
          { id: 'yt-1', title: 'Happy Song', artist: 'Singer' },
          { id: 'yt-2', title: 'Joy Dance', artist: 'Dancer' },
          { id: 'yt-3', title: 'Sunny Day', artist: 'Band' },
        ],
      }),
    });

    render(
      <StitchTab
        workingList={[]}
        lyricsByTrackId={{}}
        activePlatform="ytmusic"
      />
    );

    const input = screen.getByPlaceholderText(/youtube music playlist url/i);
    const addBtn = screen.getByRole('button', { name: /add playlist/i });

    fireEvent.change(input, { target: { value: 'https://music.youtube.com/playlist?list=PL123' } });
    fireEvent.click(addBtn);

    await waitFor(() => {
      expect(screen.getByText('Classroom Pop Hits')).toBeInTheDocument();
    });

    expect(screen.getByText('3 tracks')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remove source classroom pop hits/i })).toBeInTheDocument();
    expect(screen.getByText(/combined track quota:\s*3\s*\/\s*50\s*staged/i)).toBeInTheDocument();
  });

  it('searches and adds an album to the pool', async () => {
    // Mock catalog search response
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        songs: [],
        albums: [
          { id: 'album-99', title: 'Greatest Hits', artist: 'The Band' },
        ],
      }),
    });

    // Mock catalog album tracks response
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'album-99',
        title: 'Greatest Hits',
        artist: 'The Band',
        tracks: [
          { id: 't-1', title: 'Hit 1', artist: 'The Band' },
          { id: 't-2', title: 'Hit 2', artist: 'The Band' },
        ],
      }),
    });

    render(
      <StitchTab
        workingList={[]}
        lyricsByTrackId={{}}
        activePlatform="ytmusic"
      />
    );

    // Open album search modal/tray
    const searchAlbumBtn = screen.getByRole('button', { name: /search album/i });
    fireEvent.click(searchAlbumBtn);

    // Search input appears
    const searchInput = screen.getByPlaceholderText(/search album name/i);
    fireEvent.change(searchInput, { target: { value: 'Greatest Hits' } });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));

    await waitFor(() => {
      expect(screen.getByText('Greatest Hits')).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/catalog/search',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'Greatest Hits',
          platform: 'ytmusic',
          limit: 10,
        }),
      })
    );

    // Click to add album
    const addAlbumItemBtn = screen.getByRole('button', { name: /add album greatest hits/i });
    fireEvent.click(addAlbumItemBtn);

    await waitFor(() => {
      expect(screen.getByText(/combined track quota:\s*2\s*\/\s*50\s*staged/i)).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/catalog/album',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          album_id: 'album-99',
          platform: 'ytmusic',
        }),
      })
    );
  });

  it('opens PasteTrackListPanel and stages pasted songs as a source card', async () => {
    render(
      <StitchTab
        workingList={[]}
        lyricsByTrackId={{}}
        activePlatform="ytmusic"
      />
    );

    const pasteTrigger = screen.getByRole('button', { name: /paste track list/i });
    fireEvent.click(pasteTrigger);

    // Paste panel opened
    expect(screen.getByRole('region', { name: /paste track list panel/i })).toBeInTheDocument();

    const textarea = screen.getByRole('textbox', { name: /pasted track list input/i });
    fireEvent.change(textarea, { target: { value: 'Song Alpha - Artist One\nSong Beta - Artist Two\nSong Gamma' } });

    // Submit paste
    const stageBtn = screen.getByRole('button', { name: /resolve & add/i });
    fireEvent.click(stageBtn);

    // Check source card
    await waitFor(() => {
      expect(screen.getByText(/pasted track list/i)).toBeInTheDocument();
      expect(screen.getAllByText(/3 tracks/i).length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getByText(/combined track quota:\s*3\s*\/\s*50\s*staged/i)).toBeInTheDocument();
  });

  it('allows removing sources and updates the quota meter', () => {
    render(
      <StitchTab
        workingList={mockWorkingList}
        lyricsByTrackId={mockLyricsByTrackId}
        activePlatform="ytmusic"
      />
    );

    // Add working list
    fireEvent.click(screen.getByRole('button', { name: /add current working list/i }));
    expect(screen.getByText(/combined track quota:\s*2\s*\/\s*50\s*staged/i)).toBeInTheDocument();

    // Remove source
    const removeBtn = screen.getByRole('button', { name: /remove source.*working list/i });
    fireEvent.click(removeBtn);

    expect(screen.queryByText(/2 tracks/i)).not.toBeInTheDocument();
    expect(screen.getByText(/combined track quota:\s*0\s*\/\s*50\s*staged/i)).toBeInTheDocument();
  });

  it('displays caution amber styling and NoticeBanner when quota exceeds 50 staged tracks in public mode', async () => {
    // 55 tracks in a playlist
    const bigTrackList = Array.from({ length: 55 }, (_, i) => ({
      id: `big-${i}`,
      title: `Song ${i}`,
      artist: `Artist ${i}`,
    }));

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'big-pl',
        title: 'Huge Playlist',
        tracks: bigTrackList,
      }),
    });

    render(
      <StitchTab
        workingList={[]}
        lyricsByTrackId={{}}
        activePlatform="ytmusic"
        vipMode={false}
      />
    );

    const input = screen.getByPlaceholderText(/youtube music playlist url/i);
    const addBtn = screen.getByRole('button', { name: /add playlist/i });

    fireEvent.change(input, { target: { value: 'https://music.youtube.com/playlist?list=PLHuge' } });
    fireEvent.click(addBtn);

    await waitFor(() => {
      expect(screen.getByText(/combined track quota:\s*55\s*\/\s*50\s*staged/i)).toBeInTheDocument();
    });

    // Truncation warning notice banner is displayed
    expect(screen.getByText(/exceed.*50.*quota.*truncat/i)).toBeInTheDocument();
  });

  it('handles stitch execution, surfaces stats badges and track rows, and exports playlist', async () => {
    // Mock endpoints for pre-screening and stitch
    global.fetch.mockImplementation(async (url) => {
      if (url.includes('/api/scan/playlist')) {
        return {
          ok: true,
          json: async () => ({
            tracks: mockWorkingList.map((t) => ({ ...t, verification_status: 'verified_clean', is_flagged: false })),
            lyrics_by_id: {},
          }),
        };
      }
      if (url.includes('/api/stitch')) {
        return {
          ok: true,
          json: async () => ({
            tracks: [
              { id: 'stitched-1', title: 'Stitched Clean Song', artist: 'Clean Artist', verification_status: 'clean_swapped' },
              { id: 'stitched-2', title: 'Clean Jam', artist: 'Groove Band', verification_status: 'verified_clean' },
            ],
            stats: {
              initial_total_tracks: 2,
              duplicates_removed: 0,
              tracks_replaced: 1,
              tracks_dropped: 0,
              final_track_count: 2,
            },
          }),
        };
      }
      if (url.includes('/api/export')) {
        const mockBlob = new Blob(['sample-data'], { type: 'text/plain' });
        return {
          ok: true,
          blob: async () => mockBlob,
        };
      }
      return { ok: false, status: 404 };
    });

    render(
      <StitchTab
        workingList={mockWorkingList}
        lyricsByTrackId={mockLyricsByTrackId}
        activePlatform="ytmusic"
      />
    );

    // Add working list
    fireEvent.click(screen.getByRole('button', { name: /add current working list/i }));

    // Trigger Stitch
    const stitchBtn = screen.getByRole('button', { name: /stitch playlists/i });
    fireEvent.click(stitchBtn);

    await waitFor(() => {
      expect(screen.getByRole('region', { name: /stitched clean queue/i })).toBeInTheDocument();
    });

    // Check stats badges
    expect(screen.getByText('Duplicates Removed')).toBeInTheDocument();
    expect(screen.getByText('Replaced Clean')).toBeInTheDocument();
    expect(screen.getByText('Stitched Clean Song')).toBeInTheDocument();
    expect(screen.getByText('Clean Swapped')).toBeInTheDocument();

    // 2. Mock export response
    const mockBlob = new Blob(['sample-data'], { type: 'text/plain' });
    global.fetch.mockResolvedValueOnce({
      ok: true,
      blob: async () => mockBlob,
    });

    window.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    window.URL.revokeObjectURL = vi.fn();

    const exportM3uBtn = screen.getByRole('button', { name: /export m3u8/i });
    fireEvent.click(exportM3uBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/export',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"format":"m3u"'),
        })
      );
    });
  });

  describe('Story 4.2: Automated Stitch Pre-Screening Pipeline & Batch Clean Enforcement', () => {
    it('executes pre-screening pipeline on stitch: resolves pasted lines, scans uncached tracks, finds clean replacements, and passes manual_replacements to /api/stitch', async () => {
      global.fetch.mockImplementation(async (url, options) => {
        if (url.includes('/api/catalog/resolve')) {
          return {
            ok: true,
            json: async () => ({
              resolved: [
                { id: 'res-song-1', title: 'Song One', artist: 'Artist A', duration_seconds: 180 },
              ],
              unresolved: [
                { line: 'Unknown Unresolvable Song', reason: 'not_found' },
              ],
            }),
          };
        }
        if (url.includes('/api/scan/playlist')) {
          const body = JSON.parse(options.body);
          return {
            ok: true,
            json: async () => ({
              tracks: body.tracks.map((t) => ({
                ...t,
                verification_status: t.id === 'track-2' ? 'flagged_explicit' : 'verified_clean',
                is_flagged: t.id === 'track-2',
                reasons: t.id === 'track-2' ? ['Explicit lyrics'] : [],
              })),
              lyrics_by_id: { 'track-2': 'explicit lyrics text' },
              summary: {},
            }),
          };
        }
        if (url.includes('/api/replacements/find-batch')) {
          return {
            ok: true,
            json: async () => ({
              results: {
                'track-2': { id: 'clean-track-2', title: 'Song Two (Clean Edit)', artist: 'Artist B' },
              },
              lyrics_by_id: { 'clean-track-2': 'clean lyrics' },
            }),
          };
        }
        if (url.includes('/api/stitch')) {
          const body = JSON.parse(options.body);
          return {
            ok: true,
            json: async () => ({
              tracks: [
                { id: 'clean-track-2', title: 'Song Two (Clean Edit)', artist: 'Artist B', verification_status: 'clean_swapped' },
                { id: 'res-song-1', title: 'Song One', artist: 'Artist A', verification_status: 'verified_clean' },
              ],
              stats: {
                initial_total_tracks: 2,
                duplicates_removed: 0,
                tracks_replaced: 1,
                tracks_dropped: 0,
                final_track_count: 2,
              },
              echoed_manual_replacements: body.manual_replacements,
            }),
          };
        }
        return { ok: false, status: 404 };
      });

      render(
        <StitchTab
          initialPlaylist={{
            id: 'paste-src',
            title: 'Pasted Requests',
            type: 'paste',
            rawLines: ['Song One', 'Unknown Unresolvable Song'],
            tracks: [
              { id: 'p-1', title: 'Song One' },
              { id: 'p-2', title: 'Unknown Unresolvable Song' },
            ],
          }}
          workingList={mockWorkingList}
          lyricsByTrackId={mockLyricsByTrackId}
          activePlatform="ytmusic"
        />
      );

      // Add working list source
      fireEvent.click(screen.getByRole('button', { name: /add current working list/i }));

      // Click Stitch & Clean button
      const stitchBtn = screen.getByRole('button', { name: /stitch/i });
      fireEvent.click(stitchBtn);

      // Wait for pre-screening and stitch to complete
      await waitFor(() => {
        expect(screen.getByRole('region', { name: /stitched clean queue/i })).toBeInTheDocument();
      });

      // Verify unresolved lines banner surfaced
      expect(screen.getByText(/could not be resolved/i)).toBeInTheDocument();
      expect(screen.getByText(/Unknown Unresolvable Song/i)).toBeInTheDocument();

      // Verify stitch request payload sent manual_replacements
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/stitch',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"clean-track-2"'),
        })
      );
    });

    it('pauses cleanly and surfaces retry banner with accessible retry button when HTTP 429 rate limit occurs', async () => {
      let scanCallCount = 0;
      global.fetch.mockImplementation(async (url) => {
        if (url.includes('/api/scan/playlist')) {
          scanCallCount++;
          if (scanCallCount === 1) {
            return {
              ok: false,
              status: 429,
              json: async () => ({ detail: 'Rate limit exceeded: too many scan requests' }),
            };
          }
          return {
            ok: true,
            json: async () => ({
              tracks: [
                { id: 'track-1', verification_status: 'verified_clean', is_flagged: false },
              ],
              lyrics_by_id: {},
            }),
          };
        }
        if (url.includes('/api/stitch')) {
          return {
            ok: true,
            json: async () => ({
              tracks: [{ id: 'track-1', title: 'Song One', artist: 'Artist A' }],
              stats: { final_track_count: 1 },
            }),
          };
        }
        return { ok: false, status: 404 };
      });

      render(
        <StitchTab
          workingList={[{ id: 'track-1', title: 'Song One', artist: 'Artist A' }]}
          lyricsByTrackId={{}}
          activePlatform="ytmusic"
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /add current working list/i }));

      const stitchBtn = screen.getByRole('button', { name: /stitch/i });
      fireEvent.click(stitchBtn);

      // Expect rate limit retry banner to appear
      await waitFor(() => {
        expect(screen.getByText(/rate limit/i)).toBeInTheDocument();
      });

      const retryBtn = screen.getByRole('button', { name: /retry pre-screening/i });
      expect(retryBtn).toBeInTheDocument();

      // Ensure staged pool was not cleared
      expect(screen.getByRole('button', { name: /remove source current working list/i })).toBeInTheDocument();

      // Click retry button
      fireEvent.click(retryBtn);

      // Successfully completes stitch on retry
      await waitFor(() => {
        expect(screen.getByRole('region', { name: /stitched clean queue/i })).toBeInTheDocument();
      });
    });
  });

  describe('Story 4.4: Stitched Clean Output Workbench & Isolated Finish Line Handoff', () => {
    const mockStitchedResponse = {
      tracks: [
        {
          id: 'track-1',
          title: 'Clean Hit One',
          artist: 'Pop Star',
          duration: '3:20',
          duration_seconds: 200,
          verification_status: 'verified_clean',
          source_playlist_title: 'Summer Hits',
          video_url: 'https://music.youtube.com/watch?v=track-1',
        },
        {
          id: 'track-2',
          title: 'Clean Hit Two (Clean Edit)',
          artist: 'Rapper A',
          duration: '2:45',
          duration_seconds: 165,
          verification_status: 'clean_swapped',
          source_playlist_title: 'Pasted Song Requests',
          video_url: 'https://music.youtube.com/watch?v=track-2',
          replaced_original: { id: 'orig-2', title: 'Explicit Hit Two', artist: 'Rapper A' },
        },
      ],
      stats: {
        total_input_tracks: 3,
        initial_total_tracks: 3,
        duplicates_removed: 0,
        tracks_replaced: 1,
        tracks_dropped: 1,
        final_track_count: 2,
      },
    };

    const setupFetchMock = (customStitchResponse = mockStitchedResponse) => {
      global.fetch.mockImplementation(async (url) => {
        if (url.includes('/api/scan/playlist')) {
          return {
            ok: true,
            json: async () => ({
              tracks: [
                { id: 'track-1', title: 'Clean Hit One', artist: 'Pop Star', verification_status: 'verified_clean' },
              ],
              lyrics_by_id: {},
              summary: {},
            }),
          };
        }
        if (url.includes('/api/catalog/resolve')) {
          return {
            ok: true,
            json: async () => ({
              resolved: [{ id: 'track-1', title: 'Song One', artist: 'Artist A', verification_status: 'verified_clean' }],
              unresolved: [{ line: 'Typo Song That Does Not Exist - Unknown Artist', raw: '...' }],
            }),
          };
        }
        if (url.includes('/api/replacements/find-batch')) {
          return {
            ok: true,
            json: async () => ({ results: {}, lyrics_by_id: {} }),
          };
        }
        if (url.includes('/api/stitch')) {
          return {
            ok: true,
            json: async () => customStitchResponse,
          };
        }
        return { ok: true, json: async () => ({}) };
      });
    };

    it('renders summary pills displaying all 5 metrics', async () => {
      setupFetchMock();

      render(
        <StitchTab
          initialPlaylist={{
            id: 'p1',
            title: 'Summer Hits',
            tracks: [{ id: 'track-1', title: 'Clean Hit One', artist: 'Pop Star', verification_status: 'verified_clean' }],
          }}
          workingList={[]}
          activePlatform="ytmusic"
        />
      );

      const stitchBtn = screen.getByRole('button', { name: /stitch playlists & clean/i });
      fireEvent.click(stitchBtn);

      await waitFor(() => {
        expect(screen.getByRole('region', { name: /stitched clean queue/i })).toBeInTheDocument();
      });

      const outputRegion = screen.getByRole('region', { name: /stitched clean queue/i });

      // 5 summary pills
      expect(within(outputRegion).getByText(/total input/i)).toBeInTheDocument();
      expect(within(outputRegion).getByText(/duplicates removed/i)).toBeInTheDocument();
      expect(within(outputRegion).getByText(/replaced clean/i)).toBeInTheDocument();
      expect(within(outputRegion).getByText(/dropped flagged/i)).toBeInTheDocument();
      expect(within(outputRegion).getByText(/final track count/i)).toBeInTheDocument();
      expect(within(outputRegion).getByText('3')).toBeInTheDocument(); // total input
      expect(within(outputRegion).getAllByText('2').length).toBeGreaterThan(0); // final tracks
    });

    it('displays dismissible amber NoticeBanner listing skipped lines when pasted song lines had typos', async () => {
      setupFetchMock();

      render(
        <StitchTab
          workingList={[]}
          activePlatform="ytmusic"
        />
      );

      // Open paste panel and add valid + typo lines
      fireEvent.click(screen.getByRole('button', { name: /paste track list/i }));
      const textarea = screen.getByRole('textbox', { name: /pasted track list input/i });
      fireEvent.change(textarea, { target: { value: 'Artist A - Song One\nTypo Song That Does Not Exist - Unknown Artist' } });
      fireEvent.click(screen.getByRole('button', { name: /resolve & add/i }));

      // Click stitch
      const stitchBtn = screen.getByRole('button', { name: /stitch playlists & clean/i });
      fireEvent.click(stitchBtn);

      await waitFor(() => {
        expect(screen.getByRole('region', { name: /stitched clean queue/i })).toBeInTheDocument();
      });

      // NoticeBanner with skipped lines should be visible in the output area
      expect(screen.getByText(/could not be resolved and were omitted/i)).toBeInTheDocument();
      expect(screen.getByText(/Typo Song That Does Not Exist/i)).toBeInTheDocument();
    });

    it('renders stitched output table rows with origin badge, title, artist, duration, VerificationStatusBadge, and link', async () => {
      setupFetchMock();

      render(
        <StitchTab
          initialPlaylist={{
            id: 'p1',
            title: 'Summer Hits',
            tracks: [{ id: 'track-1', title: 'Clean Hit One', artist: 'Pop Star', verification_status: 'verified_clean' }],
          }}
          workingList={[]}
          activePlatform="ytmusic"
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /stitch playlists & clean/i }));

      await waitFor(() => {
        expect(screen.getByRole('region', { name: /stitched clean queue/i })).toBeInTheDocument();
      });

      const outputRegion = screen.getByRole('region', { name: /stitched clean queue/i });

      // Origin badges
      expect(within(outputRegion).getByText('Summer Hits')).toBeInTheDocument();
      expect(within(outputRegion).getByText('Pasted Song Requests')).toBeInTheDocument();

      // Titles & Artists
      expect(within(outputRegion).getByText('Clean Hit One')).toBeInTheDocument();
      expect(within(outputRegion).getByText('Pop Star')).toBeInTheDocument();
      expect(within(outputRegion).getByText('Clean Hit Two (Clean Edit)')).toBeInTheDocument();
      expect(within(outputRegion).getByText('Rapper A')).toBeInTheDocument();

      // Durations
      expect(within(outputRegion).getByText('3:20')).toBeInTheDocument();
      expect(within(outputRegion).getByText('2:45')).toBeInTheDocument();

      // VerificationStatusBadges
      expect(within(outputRegion).getByText('Verified Clean')).toBeInTheDocument();
      expect(within(outputRegion).getByText('Clean Swapped')).toBeInTheDocument();

      // External links
      const link1 = within(outputRegion).getByRole('link', { name: /open clean hit one/i });
      expect(link1).toHaveAttribute('href', expect.stringContaining('youtube.com'));
    });

    it('renders FinishLineBar operating strictly on stitchedResult.tracks with Play Clean Queue as primary action without modifying workingList', async () => {
      const originalWorkingList = [
        { id: 'working-1', title: 'Original Staged Song', artist: 'Artist X', verification_status: 'verified_clean' },
      ];

      setupFetchMock();

      render(
        <StitchTab
          initialPlaylist={{
            id: 'p1',
            title: 'Summer Hits',
            tracks: [{ id: 'track-1', title: 'Clean Hit One', artist: 'Pop Star', verification_status: 'verified_clean' }],
          }}
          workingList={originalWorkingList}
          activePlatform="ytmusic"
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /stitch playlists & clean/i }));

      await waitFor(() => {
        expect(screen.getByRole('region', { name: /stitched clean queue/i })).toBeInTheDocument();
      });

      // FinishLineBar should render 2 ready tracks (from stitchedResult.tracks, NOT 1 from workingList)
      expect(screen.getByText(/2 tracks ready/i)).toBeInTheDocument();

      // Primary action should be Play Clean Queue
      const playButtons = screen.getAllByRole('button', { name: /play clean queue/i });
      expect(playButtons.length).toBeGreaterThan(0);
      const desktopPlayBtn = playButtons.find((btn) => btn.className.includes('bg-brand-primary'));
      expect(desktopPlayBtn).toBeDefined();

      // Secondary action Copy Clean Track Links should be present
      expect(screen.getAllByRole('button', { name: /copy clean track links/i }).length).toBeGreaterThan(0);

      // Verify original workingList was untouched (length still 1)
      expect(originalWorkingList.length).toBe(1);
      expect(originalWorkingList[0].id).toBe('working-1');
    });
  });
});
