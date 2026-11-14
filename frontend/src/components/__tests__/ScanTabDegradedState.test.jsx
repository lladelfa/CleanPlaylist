import React, { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ScanTab from '../ScanTab';

const baseTracks = () => [
  { id: 't1', title: 'One', artist: 'A', artists_list: ['A'], verification_status: 'unscanned' },
  { id: 't2', title: 'Two', artist: 'B', artists_list: ['B'], verification_status: 'unscanned' },
  { id: 't3', title: 'Three', artist: 'C', artists_list: ['C'], verification_status: 'unscanned' },
];

function Wrapper({ initialTracks = baseTracks() }) {
  const [playlist, setPlaylist] = useState({ id: 'pl', title: 'L', tracks: initialTracks });
  const [scannedTracks, setScannedTracks] = useState(initialTracks);
  const [workingList, setWorkingList] = useState(initialTracks);
  const [lyricsByTrackId, setLyricsByTrackId] = useState({});
  const [customBlocklist, setCustomBlocklist] = useState([]);
  const [preset, setPreset] = useState('moderate');
  return (
    <ScanTab
      playlist={playlist}
      setPlaylist={setPlaylist}
      scannedTracks={scannedTracks}
      setScannedTracks={(u) => {
        setScannedTracks(u);
        setWorkingList(u);
      }}
      workingList={workingList}
      setWorkingList={setWorkingList}
      lyricsByTrackId={lyricsByTrackId}
      setLyricsByTrackId={setLyricsByTrackId}
      customBlocklist={customBlocklist}
      setCustomBlocklist={setCustomBlocklist}
      preset={preset}
      setPreset={setPreset}
      presetsData={null}
      isAuthenticated
      onOpenAuth={vi.fn()}
      onOpenLyrics={vi.fn()}
      activePlatform="ytmusic"
    />
  );
}

const scanned = (t, lookup) => ({
  ...t,
  verification_status: lookup === 'found' ? 'verified_clean' : 'lyrics_unavailable',
  is_flagged: false,
  has_lyrics: lookup === 'found',
  lyrics_lookup: lookup,
  reasons: [],
  detected_terms: [],
  snippets: [],
  total_flagged_count: 0,
});

describe('Story 7.7: ScanTab degraded lyrics service messaging', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shows one warning banner with Retry Scan when the response is degraded', async () => {
    global.fetch = vi.fn().mockImplementation(async (url, opts) => {
      const body = JSON.parse(opts.body);
      return {
        ok: true,
        json: async () => ({
          tracks: body.tracks.map((t) => scanned(t, 'upstream_error')),
          summary: { lyrics_service_degraded: true },
          lyrics_by_id: {},
        }),
      };
    });
    render(<Wrapper />);
    fireEvent.click(screen.getByRole('button', { name: /scan lyrics/i }));

    const banner = await screen.findByText(/lyrics source is having trouble/i);
    expect(banner).toBeInTheDocument();
    expect(screen.getAllByText(/lyrics source is having trouble/i)).toHaveLength(1);
    expect(screen.getByRole('button', { name: /retry scan/i })).toBeInTheDocument();
    expect(banner.closest('[role="alert"], [role="status"]').className).not.toMatch(/status-clean/);
  });

  it('shows no banner when songs simply have no lyrics (not_found)', async () => {
    global.fetch = vi.fn().mockImplementation(async (url, opts) => {
      const body = JSON.parse(opts.body);
      return {
        ok: true,
        json: async () => ({
          tracks: body.tracks.map((t) => scanned(t, 'not_found')),
          summary: { lyrics_service_degraded: false },
          lyrics_by_id: {},
        }),
      };
    });
    render(<Wrapper />);
    fireEvent.click(screen.getByRole('button', { name: /scan lyrics/i }));
    await waitFor(() => expect(screen.getAllByText(/scan complete/i).length).toBeGreaterThan(0));
    expect(screen.queryByText(/lyrics source is having trouble/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /retry scan/i })).not.toBeInTheDocument();
  });

  it('Retry Scan re-requests only upstream_error tracks and keeps other results', async () => {
    const calls = [];
    global.fetch = vi.fn().mockImplementation(async (url, opts) => {
      const body = JSON.parse(opts.body);
      calls.push(body.tracks.map((t) => t.id));
      const first = calls.length === 1;
      return {
        ok: true,
        json: async () => ({
          tracks: body.tracks.map((t) =>
            scanned(t, first ? (t.id === 't3' ? 'found' : 'upstream_error') : 'found')
          ),
          summary: { lyrics_service_degraded: first },
          lyrics_by_id: {},
        }),
      };
    });
    render(<Wrapper />);
    fireEvent.click(screen.getByRole('button', { name: /scan lyrics/i }));
    fireEvent.click(await screen.findByRole('button', { name: /retry scan/i }));

    await waitFor(() => expect(calls).toHaveLength(2));
    expect([...calls[0]].sort()).toEqual(['t1', 't2', 't3']);
    expect([...calls[1]].sort()).toEqual(['t1', 't2']);
    await waitFor(() =>
      expect(screen.queryByText(/lyrics source is having trouble/i)).not.toBeInTheDocument()
    );
    expect(screen.getAllByText('Verified Clean').length).toBeGreaterThanOrEqual(3);
  });
});
