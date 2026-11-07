import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SmartInputBar from '../SmartInputBar';

const mockSongs = [
  {
    id: 'sp_track_1',
    title: 'Juicy',
    artist: 'The Notorious B.I.G.',
    album: 'Ready to Die',
    duration: '4:11',
    duration_seconds: 251,
    is_explicit: true,
    thumbnail: 'https://example.com/juicy.jpg',
    video_url: 'https://open.spotify.com/track/sp_track_1',
    verification_status: 'unscanned',
  },
];

const mockAlbums = [
  {
    id: 'sp_album_1',
    title: 'Illmatic',
    artist: 'Nas',
    track_count: 10,
    thumbnail: 'https://example.com/illmatic.jpg',
  },
];

describe('SmartInputBar', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders search input and sample chips when query is empty', () => {
    render(
      <SmartInputBar
        activePlatform="spotify"
        onAddSong={vi.fn()}
        onAddAlbum={vi.fn()}
      />
    );

    expect(
      screen.getByPlaceholderText(/search songs or albums/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /90s Hip-Hop Sample/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Parent Test Sample/i })).toBeInTheDocument();
  });

  it('populates search and triggers query when sample chip is clicked', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ songs: mockSongs, albums: mockAlbums }),
    });

    const user = userEvent.setup();
    render(
      <SmartInputBar
        activePlatform="spotify"
        onAddSong={vi.fn()}
        onAddAlbum={vi.fn()}
      />
    );

    const chip = screen.getByRole('button', { name: /90s Hip-Hop Sample/i });
    await user.click(chip);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/catalog/search',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            query: '90s Hip-Hop',
            platform: 'spotify',
            limit: 10,
          }),
        })
      );
    });

    expect(await screen.findByText('Juicy')).toBeInTheDocument();
    expect(screen.getByText('Illmatic')).toBeInTheDocument();
  });

  it('debounces user typing and displays 2-column preview tray', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ songs: mockSongs, albums: mockAlbums }),
    });

    const user = userEvent.setup();
    render(
      <SmartInputBar
        activePlatform="spotify"
        onAddSong={vi.fn()}
        onAddAlbum={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText(/search songs or albums/i);
    await user.type(input, 'Juicy');

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });

    expect(await screen.findByText(/Instant Catalog Matches/i)).toBeInTheDocument();
    expect(screen.getByText('Juicy')).toBeInTheDocument();
    expect(screen.getByText(/The Notorious B\.I\.G\./i)).toBeInTheDocument();
    expect(screen.getByText('Illmatic')).toBeInTheDocument();
  });

  it('searches immediately when Enter key is pressed', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ songs: mockSongs, albums: [] }),
    });

    const user = userEvent.setup();
    render(
      <SmartInputBar
        activePlatform="spotify"
        onAddSong={vi.fn()}
        onAddAlbum={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText(/search songs or albums/i);
    await user.type(input, 'Instant{Enter}');

    expect(fetchSpy).toHaveBeenCalled();
    expect(await screen.findByText('Juicy')).toBeInTheDocument();
  });

  it('clears query and tray when clear button is clicked or Escape is pressed', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ songs: mockSongs, albums: [] }),
    });

    const user = userEvent.setup();
    render(
      <SmartInputBar
        activePlatform="spotify"
        onAddSong={vi.fn()}
        onAddAlbum={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText(/search songs or albums/i);
    await user.type(input, 'Juicy');

    expect(await screen.findByText('Juicy')).toBeInTheDocument();

    const clearBtn = screen.getByRole('button', { name: /clear search input/i });
    await user.click(clearBtn);

    expect(screen.queryByText(/Instant Catalog Matches/i)).not.toBeInTheDocument();
    expect(input.value).toBe('');
  });

  it('renders error message when catalog search endpoint fails', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      json: async () => ({ detail: 'Catalog service timeout' }),
    });

    const user = userEvent.setup();
    render(
      <SmartInputBar
        activePlatform="spotify"
        onAddSong={vi.fn()}
        onAddAlbum={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText(/search songs or albums/i);
    await user.type(input, 'TimeoutTest{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent(/Catalog service timeout/i);
  });

  it('calls onAddSong when Add Song is clicked', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ songs: mockSongs, albums: [] }),
    });

    const handleAddSong = vi.fn();
    const user = userEvent.setup();

    render(
      <SmartInputBar
        activePlatform="spotify"
        onAddSong={handleAddSong}
        onAddAlbum={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText(/search songs or albums/i);
    await user.type(input, 'Juicy');

    const addSongBtn = await screen.findByRole('button', { name: /add song/i });
    await user.click(addSongBtn);

    expect(handleAddSong).toHaveBeenCalledWith(mockSongs[0]);
  });

  it('calls onAddAlbum when Add Album is clicked', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ songs: [], albums: mockAlbums }),
    });

    const handleAddAlbum = vi.fn();
    const user = userEvent.setup();

    render(
      <SmartInputBar
        activePlatform="spotify"
        onAddSong={vi.fn()}
        onAddAlbum={handleAddAlbum}
      />
    );

    const input = screen.getByPlaceholderText(/search songs or albums/i);
    await user.type(input, 'Illmatic');

    const addAlbumBtn = await screen.findByRole('button', { name: /add album/i });
    await user.click(addAlbumBtn);

    expect(handleAddAlbum).toHaveBeenCalledWith(mockAlbums[0]);
  });

  it('intercepts multi-line paste and delegates to onOpenPastePanel', async () => {
    const handleOpenPastePanel = vi.fn();
    const user = userEvent.setup();

    render(
      <SmartInputBar
        activePlatform="spotify"
        onAddSong={vi.fn()}
        onAddAlbum={vi.fn()}
        onOpenPastePanel={handleOpenPastePanel}
      />
    );

    const input = screen.getByPlaceholderText(/search songs or albums/i);
    await user.click(input);
    await user.paste('Song One\nSong Two');

    expect(handleOpenPastePanel).toHaveBeenCalledWith('Song One\nSong Two');
    expect(input.value).toBe('');
  });

  it('intercepts Spotify playlist URL client-side with 0 network calls and displays SpotifyPlaylistHelper', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');
    const handleOpenPastePanel = vi.fn();
    const user = userEvent.setup();

    render(
      <SmartInputBar
        activePlatform="spotify"
        onAddSong={vi.fn()}
        onAddAlbum={vi.fn()}
        onOpenPastePanel={handleOpenPastePanel}
      />
    );

    const input = screen.getByPlaceholderText(/search songs or albums/i);
    await user.click(input);
    await user.paste('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M');

    // 0 fetch calls made
    expect(fetchSpy).not.toHaveBeenCalled();

    // SpotifyPlaylistHelper banner rendered
    expect(
      screen.getByText(/Public Spotify playlist links require a quick copy-paste/i)
    ).toBeInTheDocument();

    // Clicking "Focus Paste Box" calls onOpenPastePanel
    const focusPasteBtn = screen.getByRole('button', { name: /Focus Paste Box/i });
    await user.click(focusPasteBtn);
    expect(handleOpenPastePanel).toHaveBeenCalledWith('');

    // Clicking "Search Albums Instead" clears query and dismisses helper
    const searchAlbumsBtn = screen.getByRole('button', { name: /Search Albums Instead/i });
    await user.click(searchAlbumsBtn);
    expect(input.value).toBe('');
    expect(
      screen.queryByText(/Public Spotify playlist links require a quick copy-paste/i)
    ).not.toBeInTheDocument();
  });

  it('allows Spotify playlist URLs to proceed to catalog search when vipMode={true}', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ songs: mockSongs, albums: [] }),
    });

    const user = userEvent.setup();
    render(
      <SmartInputBar
        activePlatform="spotify"
        vipMode={true}
        onAddSong={vi.fn()}
        onAddAlbum={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText(/search songs or albums/i);
    await user.click(input);
    await user.type(input, 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M{Enter}');

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/catalog/search',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          query: 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M',
          platform: 'spotify',
          limit: 10,
        }),
      })
    );

    expect(
      screen.queryByText(/Public Spotify playlist links require a quick copy-paste/i)
    ).not.toBeInTheDocument();
  });
});
