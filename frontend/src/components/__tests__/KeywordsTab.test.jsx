import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import KeywordsTab from '../KeywordsTab';

describe('KeywordsTab', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders centered empty state card with CTA when workingList is empty', async () => {
    const onNavigateToScan = vi.fn();
    render(
      <KeywordsTab
        workingList={[]}
        lyricsByTrackId={{}}
        setLyricsByTrackId={vi.fn()}
        onNavigateToScan={onNavigateToScan}
        activePlatform="ytmusic"
      />
    );

    expect(screen.getByText(/No Tracks in Working List/i)).toBeInTheDocument();
    const ctaButton = screen.getByRole('button', { name: /Add Tracks in Scan & Clean/i });
    expect(ctaButton).toBeInTheDocument();

    await userEvent.click(ctaButton);
    expect(onNavigateToScan).toHaveBeenCalledTimes(1);
  });

  it('renders starter theme chips and allows adding and removing keywords', async () => {
    const tracks = [
      { id: 't1', title: 'Song One', artist: 'Artist One' }
    ];

    render(
      <KeywordsTab
        workingList={tracks}
        lyricsByTrackId={{}}
        setLyricsByTrackId={vi.fn()}
        onNavigateToScan={vi.fn()}
        activePlatform="ytmusic"
      />
    );

    // Starter chips
    expect(screen.getByText('money')).toBeInTheDocument();
    expect(screen.getByText('drugs')).toBeInTheDocument();
    expect(screen.getByText('party')).toBeInTheDocument();
    expect(screen.getByText('alcohol')).toBeInTheDocument();
    expect(screen.getByText('gun')).toBeInTheDocument();

    // Remove "party"
    const removePartyBtn = screen.getByRole('button', { name: /remove keyword party/i });
    await userEvent.click(removePartyBtn);
    expect(screen.queryByText('party')).not.toBeInTheDocument();

    // Add custom keyword "hustle"
    const input = screen.getByPlaceholderText(/type a word or phrase/i);
    await userEvent.type(input, 'hustle');
    const addBtn = screen.getByRole('button', { name: /add keyword/i });
    await userEvent.click(addBtn);

    expect(screen.getByText('hustle')).toBeInTheDocument();
    expect(input.value).toBe('');
  });

  it('performs instant in-memory search with 0 network calls when all tracks are cached', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');
    const tracks = [
      { id: 't1', title: 'Cash Flow', artist: 'Rapper A' },
      { id: 't2', title: 'Peace', artist: 'Singer B' },
    ];
    const lyricsByTrackId = {
      t1: 'I need money and more money\nEvery day we hustle',
      t2: 'Quiet mornings without worries',
    };

    render(
      <KeywordsTab
        workingList={tracks}
        lyricsByTrackId={lyricsByTrackId}
        setLyricsByTrackId={vi.fn()}
        onNavigateToScan={vi.fn()}
        activePlatform="spotify"
      />
    );

    const searchBtn = screen.getByRole('button', { name: /search keywords/i });
    await userEvent.click(searchBtn);

    // 0 fetch calls because all tracks are in lyricsByTrackId!
    expect(fetchSpy).not.toHaveBeenCalled();

    // Summary assertions
    expect(screen.getByText(/Keyword Search Findings/i)).toBeInTheDocument();
    expect(screen.getByText(/Found 2 total keyword occurrences across 1 of 2 songs/i)).toBeInTheDocument();
    expect(screen.getByText('Cash Flow')).toBeInTheDocument();
    expect(screen.getByText(/money: 2x/i)).toBeInTheDocument();
  });

  it('performs chunked backend search in batches of <= 15 for uncached tracks', async () => {
    // Generate 18 uncached tracks to test chunking
    const tracks = Array.from({ length: 18 }, (_, i) => ({
      id: `track_${i + 1}`,
      title: `Song ${i + 1}`,
      artist: `Artist ${i + 1}`,
    }));

    const mockFetch = vi.fn().mockImplementation((url, options) => {
      const body = JSON.parse(options.body);
      const isChunk1 = body.tracks.length === 15;
      return Promise.resolve({
        ok: true,
        json: async () => ({
          summary: {
            keywords_searched: body.target_keywords,
            scanned_tracks_count: body.tracks.length,
            tracks_with_matches: isChunk1 ? 1 : 0,
            total_keyword_occurrences: isChunk1 ? 2 : 0,
            lyrics_unavailable_count: 0,
          },
          results: body.tracks.map((t, idx) => ({
            id: t.id,
            title: t.title,
            artist: t.artist,
            has_lyrics: true,
            matched: isChunk1 && idx === 0,
            total_matches: isChunk1 && idx === 0 ? 2 : 0,
            keywords_found: isChunk1 && idx === 0 ? [{ keyword: 'money', count: 2, lines: [1] }] : [],
            snippets: isChunk1 && idx === 0 ? [{ line_number: 1, text: 'Got money and money', matched_keywords: ['money'] }] : [],
          })),
          lyrics_by_id: Object.fromEntries(body.tracks.map(t => [t.id, `Lyrics for ${t.title}`])),
        }),
      });
    });
    global.fetch = mockFetch;

    const setLyricsByTrackId = vi.fn();

    render(
      <KeywordsTab
        workingList={tracks}
        lyricsByTrackId={{}}
        setLyricsByTrackId={setLyricsByTrackId}
        onNavigateToScan={vi.fn()}
        activePlatform="spotify"
      />
    );

    const searchBtn = screen.getByRole('button', { name: /search keywords/i });
    await userEvent.click(searchBtn);

    await waitFor(() => {
      // 18 tracks chunked in batches of <= 15 means 2 fetch requests (15 and 3)
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    const firstCallBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(firstCallBody.tracks).toHaveLength(15);
    expect(firstCallBody.platform).toBe('spotify');

    const secondCallBody = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(secondCallBody.tracks).toHaveLength(3);
    expect(secondCallBody.platform).toBe('spotify');

    // setLyricsByTrackId should have been called to cache resolved lyrics
    expect(setLyricsByTrackId).toHaveBeenCalled();
  });

  it('expands line excerpts showing monospace line numbers and highlighted mark elements', async () => {
    const tracks = [
      { id: 't1', title: 'Party All Night', artist: 'DJ Fun' }
    ];
    const lyricsByTrackId = {
      t1: 'Line one\nTonight is a big party with loud music\nLine three is after the party\n'
    };

    render(
      <KeywordsTab
        workingList={tracks}
        lyricsByTrackId={lyricsByTrackId}
        setLyricsByTrackId={vi.fn()}
        onNavigateToScan={vi.fn()}
        activePlatform="ytmusic"
      />
    );

    const searchBtn = screen.getByRole('button', { name: /search keywords/i });
    await userEvent.click(searchBtn);

    expect(screen.getByText('Party All Night')).toBeInTheDocument();
    // Expand button
    const expandBtn = screen.getByRole('button', { name: /2 matching lines/i });
    expect(expandBtn).toBeInTheDocument();

    await userEvent.click(expandBtn);

    // Monospace line markers
    expect(screen.getByText('[L02]')).toBeInTheDocument();
    expect(screen.getByText('[L03]')).toBeInTheDocument();

    // Mark tags
    const marks = document.querySelectorAll('mark');
    expect(marks.length).toBeGreaterThanOrEqual(2);
    expect(marks[0].textContent.toLowerCase()).toBe('party');
  });

  it('performs hybrid search for mixed cached and uncached tracks maintaining original track order', async () => {
    const tracks = [
      { id: 't1', title: 'First Cached', artist: 'Artist 1' },
      { id: 't2', title: 'Second Uncached', artist: 'Artist 2' },
      { id: 't3', title: 'Third Cached', artist: 'Artist 3' },
    ];
    const lyricsByTrackId = {
      t1: 'I have some money in the bag',
      t3: 'Big party tonight at the venue',
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        summary: {
          keywords_searched: ['money', 'drugs', 'party', 'alcohol', 'gun'],
          scanned_tracks_count: 1,
          tracks_with_matches: 1,
          total_keyword_occurrences: 1,
          lyrics_unavailable_count: 0,
        },
        results: [
          {
            id: 't2',
            title: 'Second Uncached',
            artist: 'Artist 2',
            has_lyrics: true,
            matched: true,
            total_matches: 1,
            keywords_found: [{ keyword: 'gun', count: 1, lines: [1] }],
            snippets: [{ line_number: 1, text: 'Watch out for the gun', matched_keywords: ['gun'] }],
          },
        ],
        lyrics_by_id: { t2: 'Watch out for the gun' },
      }),
    });
    global.fetch = mockFetch;

    render(
      <KeywordsTab
        workingList={tracks}
        lyricsByTrackId={lyricsByTrackId}
        setLyricsByTrackId={vi.fn()}
        onNavigateToScan={vi.fn()}
        activePlatform="ytmusic"
      />
    );

    const searchBtn = screen.getByRole('button', { name: /search keywords/i });
    await userEvent.click(searchBtn);

    // Only t2 was uncached, so fetch called with only t2
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(fetchBody.tracks).toEqual([{ id: 't2', title: 'Second Uncached', artist: 'Artist 2' }]);

    // Verify all 3 matched and render in original order
    const titles = screen.getAllByText(/Cached|Uncached/).map(el => el.textContent);
    expect(titles).toEqual(['First Cached', 'Second Uncached', 'Third Cached']);
  });

  it('displays summary banner with (N without lyrics) when tracks have unavailable lyrics', async () => {
    const tracks = [
      { id: 't_missing', title: 'Instrumental Track', artist: 'Ambient Artist' }
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        summary: {
          keywords_searched: ['money'],
          scanned_tracks_count: 1,
          tracks_with_matches: 0,
          total_keyword_occurrences: 0,
          lyrics_unavailable_count: 1,
        },
        results: [
          {
            id: 't_missing',
            title: 'Instrumental Track',
            artist: 'Ambient Artist',
            has_lyrics: false,
            matched: false,
            total_matches: 0,
            keywords_found: [],
            snippets: [],
          },
        ],
        lyrics_by_id: { t_missing: '' },
      }),
    });

    render(
      <KeywordsTab
        workingList={tracks}
        lyricsByTrackId={{}}
        setLyricsByTrackId={vi.fn()}
        onNavigateToScan={vi.fn()}
        activePlatform="ytmusic"
      />
    );

    const searchBtn = screen.getByRole('button', { name: /search keywords/i });
    await userEvent.click(searchBtn);

    expect(screen.getByText(/Found 0 total keyword occurrences across 0 of 1 songs \(1 without lyrics\)/i)).toBeInTheDocument();
  });

  it('displays empty findings message when no target keywords match across tracks', async () => {
    const tracks = [
      { id: 't_clean', title: 'Gentle Breeze', artist: 'Nature Sounds' }
    ];
    const lyricsByTrackId = {
      t_clean: 'Soft winds blowing through the forest trees\nPeace and serenity everywhere'
    };

    render(
      <KeywordsTab
        workingList={tracks}
        lyricsByTrackId={lyricsByTrackId}
        setLyricsByTrackId={vi.fn()}
        onNavigateToScan={vi.fn()}
        activePlatform="ytmusic"
      />
    );

    const searchBtn = screen.getByRole('button', { name: /search keywords/i });
    await userEvent.click(searchBtn);

    expect(screen.getByText(/No songs in the scanned set contained any of the target keywords/i)).toBeInTheDocument();
  });

  it('supports comma-separated keyword inputs and calls onOpenLyrics when track title is clicked', async () => {
    const onOpenLyrics = vi.fn();
    const tracks = [
      { id: 't1', title: 'Hustle Hard', artist: 'Dreamer' }
    ];
    const lyricsByTrackId = {
      t1: 'Work hard every day and hustle'
    };

    render(
      <KeywordsTab
        workingList={tracks}
        lyricsByTrackId={lyricsByTrackId}
        setLyricsByTrackId={vi.fn()}
        onNavigateToScan={vi.fn()}
        onOpenLyrics={onOpenLyrics}
        activePlatform="ytmusic"
      />
    );

    // Comma-separated input
    const input = screen.getByPlaceholderText(/type a word or phrase/i);
    await userEvent.type(input, 'hustle, grind, power');
    const addBtn = screen.getByRole('button', { name: /add keyword/i });
    await userEvent.click(addBtn);

    expect(screen.getByText('hustle')).toBeInTheDocument();
    expect(screen.getByText('grind')).toBeInTheDocument();
    expect(screen.getByText('power')).toBeInTheDocument();

    // Run search
    const searchBtn = screen.getByRole('button', { name: /search keywords/i });
    await userEvent.click(searchBtn);

    // Click track title
    const trackBtn = screen.getByRole('button', { name: /open lyrics for Hustle Hard/i });
    await userEvent.click(trackBtn);
    expect(onOpenLyrics).toHaveBeenCalledWith(expect.objectContaining({ id: 't1', title: 'Hustle Hard' }));
  });
});
