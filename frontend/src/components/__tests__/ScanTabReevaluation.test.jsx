import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ScanTab from '../ScanTab';

describe('ScanTab - In-Memory Screening & Preset Re-Evaluation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  function StatefulScanTabWrapper({
    initialTracks,
    initialLyrics = {},
    initialPreset = 'moderate',
    initialBlocklist = [],
    presetsData = null,
  }) {
    const [playlist, setPlaylist] = useState({
      id: 'pl_test',
      title: 'Evaluation Test List',
      tracks: initialTracks,
    });
    const [scannedTracks, setScannedTracks] = useState(initialTracks);
    const [workingList, setWorkingList] = useState(initialTracks);
    const [lyricsByTrackId, setLyricsByTrackId] = useState(initialLyrics);
    const [customBlocklist, setCustomBlocklist] = useState(initialBlocklist);
    const [preset, setPreset] = useState(initialPreset);

    return (
      <ScanTab
        playlist={playlist}
        setPlaylist={setPlaylist}
        scannedTracks={scannedTracks}
        setScannedTracks={setScannedTracks}
        workingList={workingList}
        setWorkingList={setWorkingList}
        lyricsByTrackId={lyricsByTrackId}
        setLyricsByTrackId={setLyricsByTrackId}
        customBlocklist={customBlocklist}
        setCustomBlocklist={setCustomBlocklist}
        preset={preset}
        setPreset={setPreset}
        presetsData={presetsData}
        isAuthenticated={true}
        onOpenAuth={vi.fn()}
        onOpenLyrics={vi.fn()}
        activePlatform="spotify"
      />
    );
  }

  it('re-evaluates cached tracks client-side with ZERO network calls to /api/scan/* on preset change', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');

    // Track 1 contains "damn", which is mild profanity (clean in moderate, flagged in kid_safe)
    const initialTracks = [
      {
        id: 'track_mild',
        title: 'Mild Song',
        artist: 'Artist M',
        is_explicit: false,
        is_flagged: false,
        verification_status: 'verified_clean',
        reasons: [],
      },
    ];
    const initialLyrics = {
      track_mild: 'Damn this rainy weather',
    };

    render(
      <StatefulScanTabWrapper
        initialTracks={initialTracks}
        initialLyrics={initialLyrics}
        initialPreset="moderate"
      />
    );

    // Initial state: Moderate -> 0 Flagged, 1 Clean
    expect(screen.getByText(/1 Clean/i)).toBeInTheDocument();
    expect(screen.getByText(/0 Flagged/i)).toBeInTheDocument();

    // Switch preset to "Kid Safe"
    const kidSafeBtn = screen.getByRole('button', { name: /kid safe/i });
    fireEvent.click(kidSafeBtn);

    // Immediately updates to flagged in memory
    expect(screen.getByText(/1 Flagged/i)).toBeInTheDocument();
    expect(screen.getByText(/0 Clean/i)).toBeInTheDocument();

    // Crucial constraint: NEVER call /api/scan/* when re-evaluating cached lyrics
    const scanCalls = fetchSpy.mock.calls.filter((call) =>
      typeof call[0] === 'string' && call[0].includes('/api/scan/')
    );
    expect(scanCalls).toHaveLength(0);
  });

  it('re-evaluates cached tracks when adding and removing custom blocklist terms', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');

    const initialTracks = [
      {
        id: 'track_beverage',
        title: 'Sunny Porch',
        artist: 'Artist P',
        is_explicit: false,
        is_flagged: false,
        verification_status: 'verified_clean',
        reasons: [],
      },
    ];
    const initialLyrics = {
      track_beverage: 'Sipping a cold beer on the porch',
    };

    render(
      <StatefulScanTabWrapper
        initialTracks={initialTracks}
        initialLyrics={initialLyrics}
        initialPreset="moderate"
        initialBlocklist={[]}
      />
    );

    // Initially clean
    expect(screen.getByText(/1 Clean/i)).toBeInTheDocument();
    expect(screen.getByText(/0 Flagged/i)).toBeInTheDocument();

    // Add "beer " (with trailing whitespace) to custom blocklist
    const input = screen.getByPlaceholderText(/add custom word/i);
    fireEvent.change(input, { target: { value: 'beer ' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    // Should immediately flag in memory
    expect(screen.getByText(/1 Flagged/i)).toBeInTheDocument();
    expect(screen.getByText(/0 Clean/i)).toBeInTheDocument();

    // Chip should exist with accessible remove label
    const removeChip = screen.getByRole('button', {
      name: 'Remove blocklist term beer',
    });
    expect(removeChip).toBeInTheDocument();

    // Remove the chip
    fireEvent.click(removeChip);

    // Should immediately return to clean in memory
    expect(screen.getByText(/1 Clean/i)).toBeInTheDocument();
    expect(screen.getByText(/0 Flagged/i)).toBeInTheDocument();

    // No scan API calls
    const scanCalls = fetchSpy.mock.calls.filter((call) =>
      typeof call[0] === 'string' && call[0].includes('/api/scan/')
    );
    expect(scanCalls).toHaveLength(0);
  });

  it('never marks non-explicit missing-lyrics track as verified_clean on preset switch', async () => {
    const initialTracks = [
      {
        id: 'track_nolyrics',
        title: 'Instrumental Song',
        artist: 'Artist I',
        is_explicit: false,
        is_flagged: false,
        verification_status: 'lyrics_unavailable',
        reasons: [],
      },
      {
        id: 'track_unscanned',
        title: 'Awaiting Song',
        artist: 'Artist U',
        is_explicit: false,
        is_flagged: false,
        verification_status: 'unscanned',
        reasons: [],
      },
    ];

    render(
      <StatefulScanTabWrapper
        initialTracks={initialTracks}
        initialLyrics={{}} // No cached lyrics
        initialPreset="moderate"
      />
    );

    // Switch to Slurs Only
    const slursOnlyBtn = screen.getByRole('button', { name: /slurs only/i });
    fireEvent.click(slursOnlyBtn);

    // 0 Flagged, and non-explicit missing lyrics must NEVER be marked verified clean
    expect(screen.getByText(/0 Flagged/i)).toBeInTheDocument();
    expect(screen.queryByText(/verified clean/i)).not.toBeInTheDocument();
    expect(screen.getByText(/lyrics unavailable/i)).toBeInTheDocument();
    expect(screen.getByText('Unscanned')).toBeInTheDocument();
  });

  it('preserves clean_swapped state for tracks with was_replaced: true upon preset switch', async () => {
    const initialTracks = [
      {
        id: 'track_swapped',
        title: 'Clean Replacement Song',
        artist: 'Artist C',
        is_explicit: false,
        is_flagged: false,
        was_replaced: true,
        verification_status: 'clean_swapped',
        reasons: [],
      },
    ];

    render(
      <StatefulScanTabWrapper
        initialTracks={initialTracks}
        initialLyrics={{}}
        initialPreset="moderate"
      />
    );

    const kidSafeBtn = screen.getByRole('button', { name: /kid safe/i });
    fireEvent.click(kidSafeBtn);

    // Track must remain clean swapped and not marked flagged or lyrics_unavailable
    expect(screen.getByText(/clean swapped/i)).toBeInTheDocument();
    expect(screen.getByText(/0 Flagged/i)).toBeInTheDocument();
  });

  it('unpacks and applies custom categories from presetsData when passed to ScanTab', async () => {
    const mockPresetsData = {
      presets: [
        {
          id: 'moderate',
          name: 'Moderate',
          categories: ['custom_slang'],
          include_metadata_explicit: true,
        },
        {
          id: 'kid_safe',
          name: 'Kid Safe',
          categories: ['custom_slang'],
          include_metadata_explicit: true,
        },
      ],
      categories: {
        custom_slang: ['wack'],
      },
      morphological_suffix_pattern: '(?:ing|ed|s|es)?',
    };

    const initialTracks = [
      {
        id: 'track_slang',
        title: 'Slang Track',
        artist: 'Artist S',
        is_explicit: false,
        is_flagged: false,
        verification_status: 'verified_clean',
        reasons: [],
      },
    ];
    const initialLyrics = {
      track_slang: 'That is totally wack and boring',
    };

    render(
      <StatefulScanTabWrapper
        initialTracks={initialTracks}
        initialLyrics={initialLyrics}
        initialPreset="moderate"
        presetsData={mockPresetsData}
      />
    );

    // Switch to Kid Safe
    const kidSafeBtn = screen.getByRole('button', { name: /kid safe/i });
    fireEvent.click(kidSafeBtn);

    // With custom_slang in kid_safe preset, "wack" is flagged immediately
    expect(screen.getByText(/1 Flagged/i)).toBeInTheDocument();
    expect(screen.getByText(/0 Clean/i)).toBeInTheDocument();
  });
});
