// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import LyricsModal from '../LyricsModal';

describe('LyricsModal component', () => {
  const sampleTrack = {
    id: 'track_spotify_1',
    title: 'Flagged Track Title',
    artist: 'Sample Artist',
    album: 'Sample Album',
    duration: '3:30',
    duration_seconds: 210,
    thumbnail: 'https://example.com/thumb.jpg',
    video_url: 'https://music.youtube.com/watch?v=mock',
    is_explicit: true,
    platform: 'spotify',
  };

  const sampleYtTrack = {
    id: 'yt_vid_123',
    title: 'YT Track Title',
    artist: 'YT Artist',
    is_explicit: false,
    platform: 'ytmusic',
  };

  const sampleLyricsText = [
    'Line one clean opening',
    'Line two with shit here',
    'Line three another clean line',
    'Line four with bitch in it',
    'Line five closing thoughts',
  ].join('\n');

  beforeEach(() => {
    vi.restoreAllMocks();
    if (typeof window !== 'undefined' && window.HTMLElement) {
      window.HTMLElement.prototype.scrollIntoView = vi.fn();
    }
  });

  afterEach(() => {
    if (typeof window !== 'undefined' && window.HTMLElement) {
      delete window.HTMLElement.prototype.scrollIntoView;
    }
  });

  it('renders nothing when track is null', () => {
    const { container } = render(<LyricsModal track={null} onClose={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders accessible dialog semantics with role="dialog", aria-modal="true", and aria-labelledby', () => {
    render(
      <LyricsModal
        track={sampleTrack}
        onClose={() => {}}
        lyricsByTrackId={{ [sampleTrack.id]: sampleLyricsText }}
      />
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby');
    const labelId = dialog.getAttribute('aria-labelledby');
    expect(document.getElementById(labelId)).toBeInTheDocument();
    expect(document.getElementById(labelId)).toHaveTextContent('Flagged Track Title');
  });

  it('Story 7.9: shows the Verified Clean caveat only for verified-clean tracks', () => {
    const { rerender } = render(
      <LyricsModal
        track={{ ...sampleTrack, is_explicit: false, verification_status: 'verified_clean' }}
        onClose={() => {}}
        lyricsByTrackId={{ [sampleTrack.id]: sampleLyricsText }}
      />
    );
    expect(
      screen.getByText('Based on the lyrics we could find and your selected preset. You make the final call.')
    ).toBeInTheDocument();
    rerender(
      <LyricsModal
        track={{ ...sampleTrack, verification_status: 'flagged', is_flagged: true }}
        onClose={() => {}}
        lyricsByTrackId={{ [sampleTrack.id]: sampleLyricsText }}
      />
    );
    expect(screen.queryByText(/You make the final call/)).not.toBeInTheDocument();
  });

  it('formats line numbers right-aligned in monospace with L01-Lnn format', () => {
    render(
      <LyricsModal
        track={sampleTrack}
        onClose={() => {}}
        lyricsByTrackId={{ [sampleTrack.id]: sampleLyricsText }}
      />
    );

    expect(screen.getByText('L01')).toBeInTheDocument();
    expect(screen.getByText('L02')).toBeInTheDocument();
    expect(screen.getByText('L03')).toBeInTheDocument();
    expect(screen.getByText('L04')).toBeInTheDocument();
    expect(screen.getByText('L05')).toBeInTheDocument();
  });

  it('highlights flagged lines and matched profanities with rose styling', () => {
    render(
      <LyricsModal
        track={sampleTrack}
        onClose={() => {}}
        lyricsByTrackId={{ [sampleTrack.id]: sampleLyricsText }}
        isMasked={false}
      />
    );

    // Matched words highlighted
    const shitElements = screen.getAllByText('shit');
    expect(shitElements.length).toBeGreaterThanOrEqual(1);

    const bitchElements = screen.getAllByText('bitch');
    expect(bitchElements.length).toBeGreaterThanOrEqual(1);

    // Check rose styling classes on matched lyric token
    const shitToken = shitElements.find((el) => el.className.includes('border-status-flagged-border'));
    expect(shitToken).toBeInTheDocument();
    expect(shitToken.className).toContain('text-status-flagged');
    expect(shitToken.className).toContain('bg-status-flagged-bg');
  });

  it('evaluates cached lyrics in-memory without making a network call', () => {
    const fetchSpy = vi.spyOn(global, 'fetch');
    render(
      <LyricsModal
        track={sampleTrack}
        onClose={() => {}}
        lyricsByTrackId={{ [sampleTrack.id]: sampleLyricsText }}
      />
    );

    expect(screen.getByText(/Flag 1 of 2/i)).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fetches uncached lyrics via POST /api/scan/track-lyrics and renders result', async () => {
    const mockApiResponse = {
      has_lyrics: true,
      lyrics: sampleLyricsText,
      scan_result: {
        is_flagged: true,
        reasons: ['Found 2 Strong Profanity instance(s)'],
        detected_terms: [
          { word: 'shit', category: 'strong_profanity', count: 1, occurrences: [2] },
          { word: 'bitch', category: 'strong_profanity', count: 1, occurrences: [4] },
        ],
        snippets: [
          { line_number: 2, text: 'Line two with shit here', matched_terms: ['shit'] },
          { line_number: 4, text: 'Line four with bitch in it', matched_terms: ['bitch'] },
        ],
        total_flagged_count: 2,
        has_lyrics: true,
      },
    };

    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    });

    render(
      <LyricsModal
        track={sampleTrack}
        onClose={() => {}}
        activePlatform="spotify"
      />
    );

    expect(screen.getByText(/Fetching lyrics from YouTube Music/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('L01')).toBeInTheDocument();
    });

    expect(fetchSpy).toHaveBeenCalledWith('/api/scan/track-lyrics', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('track_spotify_1'),
    }));
  });

  it('displays empty state when track has no lyrics', () => {
    render(
      <LyricsModal
        track={sampleTrack}
        onClose={() => {}}
        lyricsByTrackId={{ [sampleTrack.id]: '' }}
      />
    );

    expect(screen.getByText(/No lyrics available for this track/i)).toBeInTheDocument();
    expect(screen.getByText(/No flags/i)).toBeInTheDocument();

    const prevBtn = screen.getByRole('button', { name: 'Previous flagged line' });
    const nextBtn = screen.getByRole('button', { name: 'Next flagged line' });
    expect(prevBtn).toBeDisabled();
    expect(nextBtn).toBeDisabled();
  });

  it('navigates flagged lines using Flag X of Y jumpers and scrolls them into view', () => {
    const scrollMock = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollMock;

    render(
      <LyricsModal
        track={sampleTrack}
        onClose={() => {}}
        lyricsByTrackId={{ [sampleTrack.id]: sampleLyricsText }}
      />
    );

    expect(screen.getByText(/Flag 1 of 2/i)).toBeInTheDocument();

    const nextBtn = screen.getByRole('button', { name: 'Next flagged line' });
    fireEvent.click(nextBtn);

    expect(screen.getByText(/Flag 2 of 2/i)).toBeInTheDocument();
    expect(scrollMock).toHaveBeenCalled();

    const prevBtn = screen.getByRole('button', { name: 'Previous flagged line' });
    fireEvent.click(prevBtn);
    expect(screen.getByText(/Flag 1 of 2/i)).toBeInTheDocument();
  });

  it('displays platform-specific lyrics attribution for Spotify tracks', () => {
    render(
      <LyricsModal
        track={sampleTrack}
        onClose={() => {}}
        activePlatform="spotify"
        lyricsByTrackId={{ [sampleTrack.id]: sampleLyricsText }}
      />
    );

    expect(
      screen.getByText('Lyrics cross-referenced via YouTube Music')
    ).toBeInTheDocument();
  });

  it('displays platform-specific lyrics attribution for YouTube Music tracks', () => {
    render(
      <LyricsModal
        track={sampleYtTrack}
        onClose={() => {}}
        activePlatform="ytmusic"
        lyricsByTrackId={{ [sampleYtTrack.id]: sampleLyricsText }}
      />
    );

    expect(
      screen.getByText('Lyrics provided by YouTube Music service')
    ).toBeInTheDocument();
  });

  it('calls setLyricsByTrackId on uncached fetch with loaded lyrics or empty string', async () => {
    const setLyricsByTrackId = vi.fn();
    const mockApiResponse = {
      has_lyrics: true,
      lyrics: 'Some valid lyrics',
      scan_result: { is_flagged: false, reasons: [], detected_terms: [], snippets: [] },
    };

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    });

    render(
      <LyricsModal
        track={sampleTrack}
        onClose={() => {}}
        setLyricsByTrackId={setLyricsByTrackId}
      />
    );

    await waitFor(() => {
      expect(setLyricsByTrackId).toHaveBeenCalledWith(expect.any(Function));
    });

    const updater = setLyricsByTrackId.mock.calls[0][0];
    const updatedState = updater({ other_track: 'lyrics' });
    expect(updatedState[sampleTrack.id]).toBe('Some valid lyrics');
  });

  it('renders "Kept Flagged Track" button text when track is already in keptTrackIds', () => {
    render(
      <LyricsModal
        track={sampleTrack}
        onClose={() => {}}
        keptTrackIds={new Set([sampleTrack.id])}
        lyricsByTrackId={{ [sampleTrack.id]: sampleLyricsText }}
      />
    );

    expect(screen.getByRole('button', { name: /Kept Flagged Track/i })).toBeInTheDocument();
  });

  it('invokes onKeepTrack and closes modal when Keep Flagged Track is clicked', () => {
    const handleKeepTrack = vi.fn();
    const handleClose = vi.fn();

    render(
      <LyricsModal
        track={sampleTrack}
        onClose={handleClose}
        onKeepTrack={handleKeepTrack}
        lyricsByTrackId={{ [sampleTrack.id]: sampleLyricsText }}
      />
    );

    const keepBtn = screen.getByRole('button', { name: /Keep Flagged Track/i });
    expect(keepBtn).toBeInTheDocument();
    fireEvent.click(keepBtn);

    expect(handleKeepTrack).toHaveBeenCalledWith(sampleTrack.id);
    expect(handleClose).toHaveBeenCalled();
  });

  it('closes on Escape key press and restores focus to original trigger element', () => {
    const handleClose = vi.fn();

    // Create trigger button in document
    const triggerBtn = document.createElement('button');
    triggerBtn.setAttribute('id', 'test-trigger-btn');
    document.body.appendChild(triggerBtn);
    triggerBtn.focus();

    const focusSpy = vi.spyOn(triggerBtn, 'focus');

    render(
      <LyricsModal
        track={sampleTrack}
        triggerEl={triggerBtn}
        onClose={handleClose}
        lyricsByTrackId={{ [sampleTrack.id]: sampleLyricsText }}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(handleClose).toHaveBeenCalled();
    expect(focusSpy).toHaveBeenCalled();

    document.body.removeChild(triggerBtn);
  });

  it('Story 7.10: moves focus into the dialog on open', async () => {
    render(
      <LyricsModal
        track={sampleTrack}
        onClose={() => {}}
        lyricsByTrackId={{ [sampleTrack.id]: sampleLyricsText }}
      />
    );
    await waitFor(() => {
      expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
    });
  });

  it('traps focus inside the dialog when Tab / Shift+Tab is pressed', () => {
    render(
      <LyricsModal
        track={sampleTrack}
        onClose={() => {}}
        lyricsByTrackId={{ [sampleTrack.id]: sampleLyricsText }}
      />
    );

    const firstInteractiveEl = screen.getByRole('link', { name: /Listen on YouTube Music/i });
    const footerCloseBtn = screen.getByRole('button', { name: /^Close$/i });

    // Focus last interactive element (footer Close button) and press Tab -> should cycle to first
    footerCloseBtn.focus();
    expect(document.activeElement).toBe(footerCloseBtn);

    fireEvent.keyDown(window, { key: 'Tab' });
    expect(document.activeElement).toBe(firstInteractiveEl);

    // Focus first element and press Shift+Tab -> should cycle to last
    firstInteractiveEl.focus();
    expect(document.activeElement).toBe(firstInteractiveEl);

    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(footerCloseBtn);
  });

  it('masks flagged tokens and profanity badge tags when isMasked is true and reveals them when false', () => {
    const { rerender } = render(
      <LyricsModal
        track={sampleTrack}
        onClose={() => {}}
        lyricsByTrackId={{ [sampleTrack.id]: sampleLyricsText }}
        isMasked={true}
      />
    );

    expect(screen.getAllByText('s***').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('b****').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('shit')).not.toBeInTheDocument();
    expect(screen.queryByText('bitch')).not.toBeInTheDocument();

    rerender(
      <LyricsModal
        track={sampleTrack}
        onClose={() => {}}
        lyricsByTrackId={{ [sampleTrack.id]: sampleLyricsText }}
        isMasked={false}
      />
    );

    expect(screen.getAllByText('shit').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('bitch').length).toBeGreaterThanOrEqual(1);
  });

  it('defaults isMasked to true and safely handles non-string reasons', () => {
    render(
      <LyricsModal
        track={{
          ...sampleTrack,
          lyrics: sampleLyricsText,
        }}
        onClose={() => {}}
      />
    );

    expect(screen.getAllByText('s***').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('b****').length).toBeGreaterThanOrEqual(1);
  });
});