import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from '../../App';

describe('App Header & Platform Switch Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url === '/api/spotify/status') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ authenticated: false }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });
  });

  it('defaults to spotify and switches immediately when working list is empty', async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /spotify/i })).toHaveAttribute('aria-pressed', 'true');
    });

    const ytBtn = screen.getByRole('button', { name: /youtube music/i });
    await user.click(ytBtn);

    // Modal should NOT be opened since working list is empty
    expect(screen.queryByText(/switching platforms resets the working list/i)).not.toBeInTheDocument();
    expect(ytBtn).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /spotify/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('prompts PlatformSwitchModal when list is dirty, allows cancel, and clears on confirm', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Mock fetch for playlist loading
    global.fetch.mockImplementation((url, _opts) => {
      if (url === '/api/spotify/status') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ authenticated: false }),
        });
      }
      if (url === '/api/playlist/fetch') {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 'pl_1',
              title: 'Test Playlist',
              tracks: [
                {
                  id: 't1',
                  title: 'Track One',
                  artist: 'Artist One',
                  duration: '3:00',
                  is_explicit: false,
                  thumbnail: '',
                  video_url: 'https://example.com/1',
                },
              ],
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });

    // Populate working list by fetching a playlist
    const urlInput = screen.getByPlaceholderText(/search songs or albums|e\.g\. https/i);
    await user.type(urlInput, 'https://music.youtube.com/playlist?list=PLtest123{enter}');

    await waitFor(() => {
      expect(screen.getByText('Track One')).toBeInTheDocument();
    });

    // Try to switch platform to YouTube Music
    const ytBtn = screen.getByRole('button', { name: /youtube music/i });
    await user.click(ytBtn);

    // Modal should be open
    expect(screen.getByText(/switching platforms resets the working list/i)).toBeInTheDocument();
    // Platform should still be spotify
    expect(screen.getByRole('button', { name: /spotify/i })).toHaveAttribute('aria-pressed', 'true');

    // Click Cancel
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByText(/switching platforms resets the working list/i)).not.toBeInTheDocument();
    expect(screen.getByText('Track One')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /spotify/i })).toHaveAttribute('aria-pressed', 'true');

    // Click YouTube Music again, then Confirm
    await user.click(ytBtn);
    expect(screen.getByText(/switching platforms resets the working list/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /switch & clear list/i }));

    // Platform should now be ytmusic, modal closed, and tracks cleared
    await waitFor(() => {
      expect(screen.queryByText(/switching platforms resets the working list/i)).not.toBeInTheDocument();
      expect(ytBtn).toHaveAttribute('aria-pressed', 'true');
      expect(screen.queryByText('Track One')).not.toBeInTheDocument();
    });
  });
});
