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
      const successMessage = screen.getByText(/saved successfully/i);
      expect(successMessage).toBeInTheDocument();
      expect(successMessage).toHaveClass('text-text-primary');
      expect(successMessage.className).not.toContain('status-clean');
      const successIconSurface = successMessage.parentElement.querySelector('div');
      expect(successIconSurface).toHaveClass('bg-surface-elevated', 'border-border-subtle');
      expect(successIconSurface.querySelector('svg')).toHaveClass('text-text-secondary');
    });

    // Advance timer for redirect/close callback
    vi.advanceTimersByTime(2000);
    expect(onSaveSuccess).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('emits finish_action_clicked telemetry with vip_spotify_save on successful save', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const hookSpy = vi.fn();
    window.__CP_ANALYTICS_HOOK__ = hookSpy;

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
      />
    );

    const saveBtn = screen.getByRole('button', { name: /save playlist/i });
    await user.click(saveBtn);

    expect(hookSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'finish_action_clicked',
        action: 'vip_spotify_save',
        vip_mode: true,
      })
    );
    delete window.__CP_ANALYTICS_HOOK__;
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

// Story 7.10: focus management (focus-in, trap, Escape, focus return)
describe('SavePlaylistModal focus management', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function Harness() {
    const [open, setOpen] = React.useState(false);
    return (
      <div>
        <button type="button" onClick={() => setOpen(true)}>Open save</button>
        <SavePlaylistModal
          isOpen={open}
          onClose={() => setOpen(false)}
          playlist={{ id: 'pl_1', title: 'Mix', canOverwrite: true }}
          displayedTracks={[]}
          activePlatform="spotify"
        />
      </div>
    );
  }

  async function openModal() {
    const user = userEvent.setup();
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Open save' });
    await user.click(opener);
    return { user, opener };
  }

  it('exposes dialog semantics and an accessible name', async () => {
    await openModal();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName();
  });

  it('moves focus into the dialog on open', async () => {
    await openModal();
    expect(screen.getByPlaceholderText('Playlist title')).toHaveFocus();
  });

  it('locks body scroll while open and restores it on close', async () => {
    const { user } = await openModal();
    expect(document.body.style.overflow).toBe('hidden');
    await user.keyboard('{Escape}');
    expect(document.body.style.overflow).toBe('');
  });

  it('wraps Tab from the last focusable to the first and Shift+Tab back', async () => {
    const { user } = await openModal();
    const dialog = screen.getByRole('dialog');
    const focusables = Array.from(
      dialog.querySelectorAll('button:not([disabled]), input:not([disabled])')
    );
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    last.focus();
    await user.tab();
    expect(document.activeElement).toBe(first);
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(last);
  });

  it('closes on Escape and returns focus to the opener', async () => {
    const { user, opener } = await openModal();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('does not throw when the opener is unmounted before close', async () => {
    const { user, opener } = await openModal();
    opener.remove();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('SavePlaylistModal Escape guard', () => {
  it('ignores Escape while on the success state', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <SavePlaylistModal
        isOpen={true}
        onClose={onClose}
        playlist={{ id: 'pl_1', title: 'Mix', canOverwrite: true }}
        displayedTracks={[]}
        activePlatform="spotify"
      />
    );
    await user.click(screen.getByRole('button', { name: /^save playlist$/i }));
    await screen.findByText(/saved successfully/i);
    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });
});
