import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ScanTab from '../ScanTab';

describe('Story 3.3: One-Click Bulk Clean Replacement in Scan & Clean', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const createMockTrack = (id, title, isFlagged = true, isExplicit = true) => ({
    id,
    title,
    artist: 'Test Artist',
    artists_list: ['Test Artist'],
    album: 'Test Album',
    duration: '3:00',
    duration_seconds: 180,
    is_explicit: isExplicit,
    thumbnail: 'https://example.com/thumb.jpg',
    video_url: `https://open.spotify.com/track/${id}`,
    verification_status: isFlagged ? 'flagged' : 'verified_clean',
    is_flagged: isFlagged,
    reasons: isFlagged ? ['Marked Explicit by Spotify'] : [],
    detected_terms: [],
    snippets: [],
    has_lyrics: true,
  });

  it('runs chunked bulk clean replacement, updates resolvable tracks to clean_swapped, leaves unresolvable tracks flagged, and announces summary', async () => {
    // 12 flagged tracks: 10 in chunk 1, 2 in chunk 2
    const initialTracks = Array.from({ length: 12 }, (_, i) =>
      createMockTrack(`trk_${i}`, `Explicit Song ${i}`, true, true)
    );

    let workingListState = [...initialTracks];
    const setWorkingList = vi.fn((updater) => {
      workingListState = typeof updater === 'function' ? updater(workingListState) : updater;
    });

    let lyricsState = {};
    const setLyricsByTrackId = vi.fn((updater) => {
      lyricsState = typeof updater === 'function' ? updater(lyricsState) : updater;
    });

    let cleanCandidatesState = {};
    const setCleanCandidates = vi.fn((updater) => {
      cleanCandidatesState = typeof updater === 'function' ? updater(cleanCandidatesState) : updater;
    });

    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(async (url, options) => {
      if (url === '/api/presets') {
        return {
          ok: true,
          json: async () => ({ presets: {} }),
        };
      }
      if (url === '/api/replacements/find-batch') {
        callCount++;
        const body = JSON.parse(options.body);
        expect(body.platform).toBe('spotify');
        expect(body.tracks.length).toBeLessThanOrEqual(10);

        const results = {};
        const lyricsById = {};
        body.tracks.forEach((t) => {
          // Say trk_11 has no clean candidate, all others have one
          if (t.id === 'trk_11') {
            results[t.id] = null;
          } else {
            results[t.id] = {
              id: `clean_${t.id}`,
              title: `${t.title} (Clean)`,
              artist: t.artist,
              duration_seconds: 180,
              is_explicit: false,
              video_url: `https://open.spotify.com/track/clean_${t.id}`,
            };
            lyricsById[`clean_${t.id}`] = `Clean lyrics for ${t.id}`;
          }
        });

        return {
          ok: true,
          json: async () => ({
            results,
            lyrics_by_id: lyricsById,
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    });

    render(
      <ScanTab
        workingList={workingListState}
        setWorkingList={setWorkingList}
        scannedTracks={workingListState}
        setScannedTracks={vi.fn()}
        lyricsByTrackId={lyricsState}
        setLyricsByTrackId={setLyricsByTrackId}
        cleanCandidates={cleanCandidatesState}
        setCleanCandidates={setCleanCandidates}
        activePlatform="spotify"
      />
    );

    // 1. Bulk clean button should be present and enabled with 12 flagged tracks
    const bulkButton = screen.getByRole('button', { name: /find & swap all clean versions/i });
    expect(bulkButton).toBeInTheDocument();
    expect(bulkButton).toBeEnabled();

    // 2. Click button to start bulk replacement
    fireEvent.click(bulkButton);

    // 3. Wait for bulk replacement to complete
    await waitFor(() => {
      expect(callCount).toBe(2);
    });

    await waitFor(() => {
      // Summary NoticeBanner announces: Swapped 11 of 12 flagged tracks; 1 still needs review
      const matches = screen.getAllByText(/swapped 11 of 12 flagged tracks; 1 still needs review/i);
      expect(matches.length).toBeGreaterThan(0);
    });

    // 4. Check that 11 tracks became clean_swapped and trk_11 remained flagged
    const swappedCount = workingListState.filter((t) => t.verification_status === 'clean_swapped').length;
    expect(swappedCount).toBe(11);

    const unfoundTrack = workingListState.find((t) => t.id === 'trk_11');
    expect(unfoundTrack.verification_status).toBe('flagged');
    expect(unfoundTrack.is_flagged).toBe(true);

    // Clean candidates should have "none" for trk_11
    expect(cleanCandidatesState['trk_11']).toBe('none');

    // Clean lyrics should be stored in lyricsByTrackId
    expect(lyricsState['clean_trk_0']).toBe('Clean lyrics for trk_0');
  });

  it('halts on HTTP 429, preserves earlier swapped tracks, shows retryable pause banner, and allows retrying remaining tracks', async () => {
    // 15 flagged tracks: chunk 1 (10 tracks), chunk 2 (5 tracks)
    const initialTracks = Array.from({ length: 15 }, (_, i) =>
      createMockTrack(`trk_${i}`, `Song ${i}`, true, true)
    );

    let workingListState = [...initialTracks];
    const setWorkingList = vi.fn((updater) => {
      workingListState = typeof updater === 'function' ? updater(workingListState) : updater;
    });

    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(async (url, options) => {
      if (url === '/api/presets') {
        return { ok: true, json: async () => ({ presets: {} }) };
      }
      if (url === '/api/replacements/find-batch') {
        callCount++;
        const body = JSON.parse(options.body);

        // First call succeeds with 10 tracks
        if (callCount === 1) {
          const results = {};
          body.tracks.forEach((t) => {
            results[t.id] = {
              id: `clean_${t.id}`,
              title: `${t.title} (Clean)`,
              artist: t.artist,
              duration_seconds: 180,
              is_explicit: false,
            };
          });
          return {
            ok: true,
            json: async () => ({ results, lyrics_by_id: {} }),
          };
        }

        // Second call fails with 429
        if (callCount === 2) {
          return {
            ok: false,
            status: 429,
            json: async () => ({ detail: 'Rate limit exceeded' }),
          };
        }

        // Third call (retry of remaining 5 tracks) succeeds
        if (callCount === 3) {
          const results = {};
          body.tracks.forEach((t) => {
            results[t.id] = {
              id: `clean_${t.id}`,
              title: `${t.title} (Clean)`,
              artist: t.artist,
              duration_seconds: 180,
              is_explicit: false,
            };
          });
          return {
            ok: true,
            json: async () => ({ results, lyrics_by_id: {} }),
          };
        }
      }
      return { ok: true, json: async () => ({}) };
    });

    render(
      <ScanTab
        workingList={workingListState}
        setWorkingList={setWorkingList}
        scannedTracks={workingListState}
        setScannedTracks={vi.fn()}
        lyricsByTrackId={{}}
        setLyricsByTrackId={vi.fn()}
        cleanCandidates={{}}
        setCleanCandidates={vi.fn()}
        activePlatform="spotify"
      />
    );

    const bulkButton = screen.getByRole('button', { name: /find & swap all clean versions/i });
    fireEvent.click(bulkButton);

    // Wait for 429 pause banner
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getAllByText(/rate limit reached|paused/i).length).toBeGreaterThan(0);
    });

    // Verify first 10 tracks were swapped in memory
    const swappedCount = workingListState.filter((t) => t.verification_status === 'clean_swapped').length;
    expect(swappedCount).toBe(10);

    // Verify Retry button is present in the pause banner
    const retryBtn = screen.getByRole('button', { name: /retry/i });
    expect(retryBtn).toBeInTheDocument();

    // Click Retry
    fireEvent.click(retryBtn);

    // Wait for completion after retry
    await waitFor(() => {
      expect(callCount).toBe(3);
    });

    await waitFor(() => {
      const matches = screen.getAllByText(/swapped all 15 flagged tracks to clean versions/i);
      expect(matches.length).toBeGreaterThan(0);
    });

    const finalSwapped = workingListState.filter((t) => t.verification_status === 'clean_swapped').length;
    expect(finalSwapped).toBe(15);
  });

  it('renders a caution banner when zero clean versions are found for flagged tracks', async () => {
    const initialTracks = [
      createMockTrack('trk_unfound_1', 'Explicit Song 1', true, true),
      createMockTrack('trk_unfound_2', 'Explicit Song 2', true, true),
    ];

    global.fetch = vi.fn().mockImplementation(async (url) => {
      if (url === '/api/presets') return { ok: true, json: async () => ({ presets: {} }) };
      if (url === '/api/replacements/find-batch') {
        return {
          ok: true,
          json: async () => ({
            results: { trk_unfound_1: null, trk_unfound_2: null },
            lyrics_by_id: {},
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    });

    render(
      <ScanTab
        workingList={initialTracks}
        setWorkingList={vi.fn()}
        scannedTracks={initialTracks}
        setScannedTracks={vi.fn()}
        lyricsByTrackId={{}}
        setLyricsByTrackId={vi.fn()}
        cleanCandidates={{}}
        setCleanCandidates={vi.fn()}
        activePlatform="spotify"
      />
    );

    const bulkBtn = screen.getByRole('button', { name: /find & swap all clean versions/i });
    fireEvent.click(bulkBtn);

    await waitFor(() => {
      const matches = screen.getAllByText(/swapped 0 of 2 flagged tracks; 2 still need review/i);
      expect(matches.length).toBeGreaterThan(0);
    });

    // Caution banner rendered rather than clean banner
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('handles 500 server error cleanly with a retryable pause banner', async () => {
    const initialTracks = [createMockTrack('trk_err_1', 'Song 1', true, true)];

    let attempt = 0;
    global.fetch = vi.fn().mockImplementation(async (url) => {
      if (url === '/api/presets') return { ok: true, json: async () => ({ presets: {} }) };
      if (url === '/api/replacements/find-batch') {
        attempt++;
        if (attempt === 1) {
          return {
            ok: false,
            status: 500,
            json: async () => ({ detail: 'Internal Server Error' }),
          };
        }
        return {
          ok: true,
          json: async () => ({
            results: {
              trk_err_1: {
                id: 'clean_trk_err_1',
                title: 'Song 1 (Clean)',
                artist: 'Test Artist',
                duration_seconds: 180,
                is_explicit: false,
              },
            },
            lyrics_by_id: {},
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    });

    let workingListState = [...initialTracks];
    const setWorkingList = vi.fn((updater) => {
      workingListState = typeof updater === 'function' ? updater(workingListState) : updater;
    });

    render(
      <ScanTab
        workingList={workingListState}
        setWorkingList={setWorkingList}
        scannedTracks={workingListState}
        setScannedTracks={vi.fn()}
        lyricsByTrackId={{}}
        setLyricsByTrackId={vi.fn()}
        cleanCandidates={{}}
        setCleanCandidates={vi.fn()}
        activePlatform="spotify"
      />
    );

    const bulkBtn = screen.getByRole('button', { name: /find & swap all clean versions/i });
    fireEvent.click(bulkBtn);

    // Alert banner with retry
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    // Click retry
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => {
      const matches = screen.getAllByText(/swapped all 1 flagged tracks to clean versions/i);
      expect(matches.length).toBeGreaterThan(0);
    });

    expect(workingListState[0].verification_status).toBe('clean_swapped');
  });
});
