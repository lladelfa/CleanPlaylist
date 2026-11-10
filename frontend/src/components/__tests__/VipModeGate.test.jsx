import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import App from '../../App';

const createLocalStorageMock = () => {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] ?? null),
    setItem: vi.fn((key, value) => {
      store[key] = String(value);
    }),
    removeItem: vi.fn((key) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
};

describe('Story 5.1: VIP Mode Gate, Allowlist Protection & Safe Exit', () => {
  let localStorageMock;

  beforeEach(() => {
    vi.restoreAllMocks();
    localStorageMock = createLocalStorageMock();
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
      configurable: true,
    });
    global.localStorage = localStorageMock;

    window.history.replaceState({}, '', '/');

    global.fetch = vi.fn().mockImplementation((url) => {
      if (url === '/api/spotify/status') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ authenticated: false }),
        });
      }
      if (url === '/api/spotify/logout') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ status: 'success', message: 'Logged out of Spotify' }),
        });
      }
      if (url === '/api/presets') {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              moderate: { name: 'Moderate', description: 'Filters explicit profanity' },
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });
  });

  afterEach(() => {
    localStorageMock.clear();
    window.history.replaceState({}, '', '/');
  });

  it('keeps public visitors in zero-login state with all Spotify login and VIP triggers hidden', async () => {
    render(<App />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/spotify/status');
    });

    // Header VIP controls must not be present
    expect(screen.queryByText('VIP')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /connect spotify/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/spotify connected/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /exit vip mode/i })).not.toBeInTheDocument();

    // ScanTab actions: no "Login to Save" or direct Spotify save actions
    expect(screen.queryByRole('button', { name: /login to save/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save to spotify/i })).not.toBeInTheDocument();

    // Library picker trigger must not be present
    expect(screen.queryByRole('button', { name: /browse library/i })).not.toBeInTheDocument();
  });

  it('activates VIP mode via ?vip=1 query param and persists to localStorage', async () => {
    window.history.replaceState({}, '', '/?vip=1');
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('VIP')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /connect spotify/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /exit vip mode/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /browse library/i })).toBeInTheDocument();

    expect(localStorage.getItem('cp_vip_mode')).toBe('true');
  });

  it('does not activate VIP mode on invalid query param values like ?vip=0', async () => {
    window.history.replaceState({}, '', '/?vip=0');
    render(<App />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/spotify/status');
    });
    expect(screen.queryByText('VIP')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /connect spotify/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /exit vip mode/i })).not.toBeInTheDocument();
    expect(localStorage.getItem('cp_vip_mode')).toBeNull();
  });

  it('activates VIP mode automatically when cp_vip_mode is already in localStorage', async () => {
    localStorage.setItem('cp_vip_mode', 'true');
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('VIP')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /connect spotify/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /exit vip mode/i })).toBeInTheDocument();
  });

  it('activates VIP mode and displays Spotify Connected pill when /api/spotify/status returns authenticated: true', async () => {
    global.fetch.mockImplementation((url) => {
      if (url === '/api/spotify/status') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ authenticated: true }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('VIP')).toBeInTheDocument();
    });

    expect(screen.getByText(/spotify connected/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /exit vip mode/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /connect spotify/i })).not.toBeInTheDocument();
    expect(localStorage.getItem('cp_vip_mode')).toBe('true');
  });

  it('activates VIP mode and sets authenticated state on arrival with ?auth_success=true', async () => {
    window.history.replaceState({}, '', '/?auth_success=true&platform=spotify');
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('VIP')).toBeInTheDocument();
    });

    expect(screen.getByText(/spotify connected/i)).toBeInTheDocument();
    expect(localStorage.getItem('cp_vip_mode')).toBe('true');
    expect(window.location.search).toBe('');
  });

  it('renders a role="alert" NoticeBanner explaining 5-user developer policy when auth_error=allowlist_blocked', async () => {
    window.history.replaceState({}, '', '/?auth_error=allowlist_blocked&platform=spotify');
    render(<App />);

    const alertBanner = await screen.findByRole('alert');
    expect(alertBanner).toBeInTheDocument();
    expect(alertBanner).toHaveTextContent(/Spotify Developer Mode is restricted to 5 allowlisted accounts/i);
    expect(screen.getByRole('button', { name: /exit vip mode/i })).toBeInTheDocument();
  });

  it('renders generic auth_error NoticeBanner and dismiss removes only auth_error parameter', async () => {
    window.history.replaceState({}, '', '/?auth_error=token_expired&vip=1');
    const user = userEvent.setup();

    render(<App />);

    const alertBanner = await screen.findByRole('alert');
    expect(alertBanner).toBeInTheDocument();
    expect(alertBanner).toHaveTextContent(/Spotify authentication error: token_expired/i);

    const dismissBtn = screen.getByRole('button', { name: /dismiss notice/i });
    await user.click(dismissBtn);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    // Verify ?vip=1 was preserved and only auth_error was deleted
    expect(window.location.search).toBe('?vip=1');
  });

  it('clears localStorage, calls POST /api/spotify/logout, resets state, and strips URL params on Exit VIP Mode click', async () => {
    window.history.replaceState({}, '', '/?vip=1&auth_error=allowlist_blocked');
    localStorage.setItem('cp_vip_mode', 'true');

    const user = userEvent.setup();
    render(<App />);

    // Click Exit VIP Mode
    const exitBtns = screen.getAllByRole('button', { name: /exit vip mode/i });
    expect(exitBtns.length).toBeGreaterThan(0);
    await user.click(exitBtns[0]);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/spotify/logout', { method: 'POST' });
    });

    // Local storage must be cleared
    expect(localStorage.getItem('cp_vip_mode')).toBeNull();

    // URL params stripped
    expect(window.location.search).toBe('');

    // State reset: no VIP badge or Exit VIP button
    expect(screen.queryByText('VIP')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /exit vip mode/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('gracefully handles status endpoint failure without crashing', async () => {
    global.fetch.mockImplementation((url) => {
      if (url === '/api/spotify/status') {
        return Promise.reject(new Error('Network error on status'));
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });

    render(<App />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/spotify/status');
    });

    expect(screen.queryByText('VIP')).not.toBeInTheDocument();
  });

  it('gracefully handles logout failure during Exit VIP Mode while still clearing local state', async () => {
    window.history.replaceState({}, '', '/?vip=1');
    localStorage.setItem('cp_vip_mode', 'true');

    global.fetch.mockImplementation((url) => {
      if (url === '/api/spotify/logout') {
        return Promise.reject(new Error('Logout server 500'));
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ authenticated: false }),
      });
    });

    const user = userEvent.setup();
    render(<App />);

    const exitBtn = screen.getByRole('button', { name: /exit vip mode/i });
    await user.click(exitBtn);

    await waitFor(() => {
      expect(localStorage.getItem('cp_vip_mode')).toBeNull();
    });

    expect(screen.queryByText('VIP')).not.toBeInTheDocument();
    expect(window.location.search).toBe('');
  });
});
