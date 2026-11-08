import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SavePlaylistModal from '../SavePlaylistModal';

describe('SavePlaylistModal', () => {
  const mockPlaylist = {
    id: 'pl_123',
    title: 'Party Vibes',
    canOverwrite: true,
  };

  const mockTracks = [
    { id: 't1', title: 'Song 1', is_explicit: false, verification_status: 'verified_clean' },
    { id: 't2', title: 'Song 2', is_explicit: false, verification_status: 'verified_clean' },
    { id: 't3', title: 'Song 3', is_explicit: true, was_replaced: true, verification_status: 'swapped' },
  ];

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <SavePlaylistModal
        isOpen={false}
        onClose={vi.fn()}
        playlist={mockPlaylist}
        displayedTracks={mockTracks}
        activePlatform="spotify"
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders with Obsidian tokens, default clean title, verified badge, and private toggle', () => {
    render(
      <SavePlaylistModal
        isOpen={true}
        onClose={vi.fn()}
        playlist={mockPlaylist}
        displayedTracks={mockTracks}
        activePlatform="spotify"
      />
    );

    expect(screen.getByRole('heading', { name: /save playlist/i })).toBeInTheDocument();
    // Default title input prefilled with '<Title> (Clean)'
    const titleInput = screen.getByRole('textbox', { name: /playlist title|playlist name/i });
    expect(titleInput).toHaveValue('Party Vibes (Clean)');

    // Private toggle checked by default
    const privateToggle = screen.getByRole('checkbox', { name: /private playlist/i });
    expect(privateToggle).toBeChecked();

    // Clean track badge
    expect(screen.getByText(/3 clean/i)).toBeInTheDocument();

    // Both mode buttons/cards rendered
    expect(screen.getByRole('button', { name: /create new clean playlist/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /update original playlist/i })).toBeInTheDocument();
  });

  it('allows editing title and disabling save when title is empty', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <SavePlaylistModal
        isOpen={true}
        onClose={vi.fn()}
        playlist={mockPlaylist}
        displayedTracks={mockTracks}
        activePlatform="spotify"
      />
    );

    const titleInput = screen.getByRole('textbox', { name: /playlist title|playlist name/i });
    const saveBtn = screen.getByRole('button', { name: /save playlist/i });

    expect(saveBtn).not.toBeDisabled();

    // Clear input
    await user.clear(titleInput);
    expect(saveBtn).toBeDisabled();

    // Type new title
    await user.type(titleInput, 'My Custom Clean Mix');
    expect(titleInput).toHaveValue('My Custom Clean Mix');
    expect(saveBtn).not.toBeDisabled();
  });

  it('submits create new playlist with updated title and privacy toggle', async () => {
    const onSaveSuccess = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'success', playlist_id: 'new_pl_789' }),
    });

    render(
      <SavePlaylistModal
        isOpen={true}
        onClose={onClose}
        playlist={mockPlaylist}
        displayedTracks={mockTracks}
        onSaveSuccess={onSaveSuccess}
        activePlatform="spotify"
      />
    );

    const titleInput = screen.getByRole('textbox', { name: /playlist title|playlist name/i });
    await user.clear(titleInput);
    await user.type(titleInput, 'Edited Clean Mix');

    // Uncheck private toggle -> is_public: true
    const privateToggle = screen.getByRole('checkbox', { name: /private playlist/i });
    await user.click(privateToggle);
    expect(privateToggle).not.toBeChecked();

    const saveBtn = screen.getByRole('button', { name: /save playlist/i });
    await user.click(saveBtn);

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/spotify/playlist/save',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          original_playlist_id: 'pl_123',
          playlist_title: 'Edited Clean Mix',
          final_track_ids: ['t1', 't2', 't3'],
          create_new: true,
          is_public: true,
        }),
      })
    );

    // Shows success message
    await waitFor(() => {
      expect(screen.getByText(/saved successfully/i)).toBeInTheDocument();
    });

    // Advance timer for redirect/close callback
    vi.advanceTimersByTime(2000);
    expect(onSaveSuccess).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('shows destructive warning and sends update payload when Update Original is selected', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'success', playlist_id: 'pl_123' }),
    });

    render(
      <SavePlaylistModal
        isOpen={true}
        onClose={vi.fn()}
        playlist={mockPlaylist}
        displayedTracks={mockTracks}
        activePlatform="spotify"
      />
    );

    // Switch to Update mode
    const updateCard = screen.getByRole('button', { name: /update original playlist/i });
    await user.click(updateCard);

    // Destructive warning should be visible
    expect(screen.getByText(/warning: this will overwrite tracks in your existing playlist/i)).toBeInTheDocument();

    const saveBtn = screen.getByRole('button', { name: /save playlist/i });
    await user.click(saveBtn);

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/spotify/playlist/save',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          original_playlist_id: 'pl_123',
          playlist_title: 'Party Vibes',
          final_track_ids: ['t1', 't2', 't3'],
          create_new: false,
          is_public: false,
        }),
      })
    );
  });

  it('disables update option when canOverwrite is false', () => {
    const unownedPlaylist = {
      ...mockPlaylist,
      canOverwrite: false,
    };

    render(
      <SavePlaylistModal
        isOpen={true}
        onClose={vi.fn()}
        playlist={unownedPlaylist}
        displayedTracks={mockTracks}
        activePlatform="spotify"
      />
    );

    const updateCard = screen.getByRole('button', { name: /update original playlist/i });
    expect(updateCard).toBeDisabled();
    expect(screen.getByText(/\(only works if you own the playlist\)/i)).toBeInTheDocument();
  });

  it('displays error alert on failure and does not call onSaveSuccess', async () => {
    const onSaveSuccess = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ detail: 'Spotify API: 403 Forbidden' }),
    });

    render(
      <SavePlaylistModal
        isOpen={true}
        onClose={vi.fn()}
        playlist={mockPlaylist}
        displayedTracks={mockTracks}
        onSaveSuccess={onSaveSuccess}
        activePlatform="spotify"
      />
    );

    const saveBtn = screen.getByRole('button', { name: /save playlist/i });
    await user.click(saveBtn);

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent(/Spotify API: 403 Forbidden/i);
    });

    expect(onSaveSuccess).not.toHaveBeenCalled();
  });
});
