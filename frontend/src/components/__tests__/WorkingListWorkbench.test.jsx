import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import WorkingListWorkbench from '../WorkingListWorkbench';

describe('WorkingListWorkbench component', () => {
  const sampleTracks = [
    {
      id: 'track_1',
      title: 'First Song',
      artist: 'First Artist',
      album: 'First Album',
      duration: '3:30',
      duration_seconds: 210,
      thumbnail: 'https://example.com/art1.jpg',
      verification_status: 'unscanned',
    },
    {
      id: 'track_2',
      title: 'Second Song',
      artist: 'Second Artist',
      album: '',
      thumbnail: '',
      verification_status: 'unscanned',
    },
  ];

  const originalInnerWidth = window.innerWidth;

  beforeEach(() => {
    window.innerWidth = 1024;
  });

  afterEach(() => {
    window.innerWidth = originalInnerWidth;
  });

  it('renders nothing or returns null when workingList is empty', () => {
    const { container, rerender } = render(<WorkingListWorkbench tracks={[]} />);
    expect(container.firstChild).toBeNull();

    rerender(<WorkingListWorkbench tracks={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders header with track count and "Clear List" button', () => {
    const handleClear = vi.fn();
    render(
      <WorkingListWorkbench
        tracks={sampleTracks}
        onClearList={handleClear}
      />
    );

    expect(screen.getByText(/Working List/i)).toBeInTheDocument();
    expect(screen.getByText(/2 \/ 50 tracks/i)).toBeInTheDocument();

    const clearBtn = screen.getByRole('button', { name: /Clear List/i });
    expect(clearBtn).toBeInTheDocument();
    fireEvent.click(clearBtn);
    expect(handleClear).toHaveBeenCalledTimes(1);
  });

  it('renders dense 6-column desktop table with column headers and track data on desktop (>= 768px)', () => {
    window.innerWidth = 1024;
    render(<WorkingListWorkbench tracks={sampleTracks} />);

    // Table elements
    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();

    // Check headers
    const headers = screen.getAllByRole('columnheader');
    expect(headers).toHaveLength(6);
    expect(headers[0]).toHaveTextContent('#');
    expect(headers[1]).toHaveTextContent(/Title & Artist/i);
    expect(headers[2]).toHaveTextContent(/Album/i);
    expect(headers[3]).toHaveTextContent(/Duration/i);
    expect(headers[4]).toHaveTextContent(/Status/i);
    expect(headers[5]).toHaveTextContent(/Actions/i);

    // Track 1
    expect(screen.getByText('First Song')).toBeInTheDocument();
    expect(screen.getByText('First Artist')).toBeInTheDocument();
    expect(screen.getByText('First Album')).toBeInTheDocument();
    expect(screen.getByText('3:30')).toBeInTheDocument();

    // Fallbacks for Track 2 (empty thumbnail, missing duration)
    expect(screen.getByText('Second Song')).toBeInTheDocument();
    expect(screen.getByText('0:00')).toBeInTheDocument();

    // VerificationStatusBadge "Unscanned"
    const badges = screen.getAllByText('Unscanned');
    expect(badges.length).toBeGreaterThan(0);
  });

  it('adapts to stacked MobileTrackCard components below 768px with min 44px touch targets', () => {
    window.innerWidth = 500;
    const handleRemove = vi.fn();

    render(
      <WorkingListWorkbench
        tracks={sampleTracks}
        onRemoveTrack={handleRemove}
      />
    );

    // Table should not be rendered on mobile
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    // Tracks rendered as cards
    expect(screen.getByText('First Song')).toBeInTheDocument();
    expect(screen.getByText('Second Song')).toBeInTheDocument();

    // Remove buttons have >= 44px touch target
    const removeBtns = screen.getAllByRole('button', { name: 'Remove track' });
    expect(removeBtns).toHaveLength(2);
    expect(removeBtns[0].className).toMatch(/min-h-\[44px\]/);
    expect(removeBtns[0].className).toMatch(/min-w-\[44px\]/);

    fireEvent.click(removeBtns[0]);
    expect(handleRemove).toHaveBeenCalledWith(sampleTracks[0]);
  });

  it('allows removing an individual track with aria-label="Remove track"', () => {
    window.innerWidth = 1024;
    const handleRemove = vi.fn();
    render(
      <WorkingListWorkbench
        tracks={sampleTracks}
        onRemoveTrack={handleRemove}
      />
    );

    const removeBtns = screen.getAllByRole('button', { name: 'Remove track' });
    expect(removeBtns).toHaveLength(2);

    fireEvent.click(removeBtns[0]);
    expect(handleRemove).toHaveBeenCalledWith(sampleTracks[0]);
  });

  it('calls onOpenLyrics with track and trigger element when clicking snippet button', () => {
    window.innerWidth = 1024;
    const handleOpenLyrics = vi.fn();
    const tracksWithSnippet = [
      {
        ...sampleTracks[0],
        is_flagged: true,
        verification_status: 'flagged',
        snippets: [{ line_number: 12, text: 'explicit lyric here', matched_terms: ['explicit'] }],
        reasons: ['Found 1 Strong Profanity instance(s)'],
      },
    ];

    render(
      <WorkingListWorkbench
        tracks={tracksWithSnippet}
        onOpenLyrics={handleOpenLyrics}
        isMasked={false}
      />
    );

    const snippetBtn = screen.getByRole('button', { name: 'Inspect lyric snippet' });
    expect(snippetBtn).toBeInTheDocument();
    expect(screen.getByText('L12:')).toBeInTheDocument();
    expect(screen.getByText('"explicit lyric here"')).toBeInTheDocument();

    fireEvent.click(snippetBtn);
    expect(handleOpenLyrics).toHaveBeenCalledTimes(1);
    expect(handleOpenLyrics).toHaveBeenCalledWith(tracksWithSnippet[0], snippetBtn);
  });

  it('defaults isMasked to true when rendered without isMasked prop', () => {
    window.innerWidth = 1024;
    const tracksWithSnippet = [
      {
        ...sampleTracks[0],
        is_flagged: true,
        snippets: [{ line_number: 14, text: "Don't give a fuck", matched_terms: ['fuck'] }],
      },
    ];

    render(<WorkingListWorkbench tracks={tracksWithSnippet} />);
    expect(screen.getByText('"Don\'t give a f***"')).toBeInTheDocument();
  });

  it('masks snippet text and flagged reasons when isMasked is true', () => {
    window.innerWidth = 1024;
    const tracksWithSnippet = [
      {
        ...sampleTracks[0],
        id: 'track_snippet_masked',
        is_flagged: true,
        verification_status: 'flagged',
        snippets: [{ line_number: 14, text: "Don't give a fuck", matched_terms: ['fuck'] }],
      },
      {
        ...sampleTracks[1],
        id: 'track_reason_masked',
        is_flagged: true,
        verification_status: 'flagged',
        snippets: [],
        reasons: ['bitch'],
      },
    ];

    const { rerender } = render(
      <WorkingListWorkbench
        tracks={tracksWithSnippet}
        isMasked={true}
      />
    );

    expect(screen.getByText('"Don\'t give a f***"')).toBeInTheDocument();
    expect(screen.getByText('b****')).toBeInTheDocument();

    rerender(
      <WorkingListWorkbench
        tracks={tracksWithSnippet}
        isMasked={false}
      />
    );

    expect(screen.getByText('"Don\'t give a fuck"')).toBeInTheDocument();
    expect(screen.getByText('bitch')).toBeInTheDocument();
  });

  it('renders masked snippets in mobile card view when window.innerWidth < 768 and isMasked is true', () => {
    window.innerWidth = 500;
    const tracksWithSnippet = [
      {
        ...sampleTracks[0],
        id: 'track_mobile_masked',
        is_flagged: true,
        verification_status: 'flagged',
        snippets: [{ line_number: 8, text: 'No bullshit allowed', matched_terms: ['bullshit'] }],
      },
    ];

    render(
      <WorkingListWorkbench
        tracks={tracksWithSnippet}
        isMasked={true}
      />
    );

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText('"No b******* allowed"')).toBeInTheDocument();
  });
});
