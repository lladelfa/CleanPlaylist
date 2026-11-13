import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import GlobalHeader from '../GlobalHeader';

describe('GlobalHeader', () => {
  it('renders strictly 3 navigation tabs with Stitch Studio', () => {
    render(
      <GlobalHeader
        activeTab="scan"
        setActiveTab={() => {}}
        activePlatform="spotify"
        onSelectPlatform={() => {}}
      />
    );

    expect(screen.getByRole('button', { name: /scan & clean/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /keyword search/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /stitch studio/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /stitch playlists/i })).not.toBeInTheDocument();
  });

  it('does not render public login or read-only mode badges', () => {
    const { rerender } = render(
      <GlobalHeader
        activeTab="scan"
        setActiveTab={() => {}}
        activePlatform="spotify"
        onSelectPlatform={() => {}}
      />
    );

    expect(screen.queryByText(/login to spotify/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/read-only mode/i)).not.toBeInTheDocument();

    rerender(
      <GlobalHeader
        activeTab="scan"
        setActiveTab={() => {}}
        activePlatform="ytmusic"
        onSelectPlatform={() => {}}
      />
    );

    expect(screen.queryByText(/login to spotify/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/read-only mode/i)).not.toBeInTheDocument();
  });

  it('switches tabs on tab click', async () => {
    const setActiveTab = vi.fn();
    const user = userEvent.setup();
    render(
      <GlobalHeader
        activeTab="scan"
        setActiveTab={setActiveTab}
        activePlatform="spotify"
        onSelectPlatform={() => {}}
      />
    );

    await user.click(screen.getByRole('button', { name: /stitch studio/i }));
    expect(setActiveTab).toHaveBeenCalledWith('stitch');
  });

  it('renders VIP badge, Connect Spotify button, and Exit VIP Mode button when vipMode={true} and unauthenticated', async () => {
    const onLogin = vi.fn();
    const onExitVip = vi.fn();
    const user = userEvent.setup();

    render(
      <GlobalHeader
        activeTab="scan"
        setActiveTab={() => {}}
        activePlatform="spotify"
        onSelectPlatform={() => {}}
        vipMode={true}
        isAuthenticated={false}
        onLogin={onLogin}
        onExitVip={onExitVip}
      />
    );

    expect(screen.getByText('VIP')).toBeInTheDocument();
    const loginBtn = screen.getByRole('button', { name: /connect spotify/i });
    expect(loginBtn).toBeInTheDocument();
    const exitBtn = screen.getByRole('button', { name: /exit vip mode/i });
    expect(exitBtn).toBeInTheDocument();
    expect(screen.queryByText(/spotify connected/i)).not.toBeInTheDocument();

    await user.click(loginBtn);
    expect(onLogin).toHaveBeenCalledTimes(1);

    await user.click(exitBtn);
    expect(onExitVip).toHaveBeenCalledTimes(1);
  });

  it('renders VIP badge, Spotify Connected pill, and Exit VIP Mode button when vipMode={true} and authenticated', async () => {
    const onExitVip = vi.fn();
    const user = userEvent.setup();

    render(
      <GlobalHeader
        activeTab="scan"
        setActiveTab={() => {}}
        activePlatform="spotify"
        onSelectPlatform={() => {}}
        vipMode={true}
        isAuthenticated={true}
        onExitVip={onExitVip}
      />
    );

    expect(screen.getByText('VIP')).toBeInTheDocument();
    const connectedLabel = screen.getByText(/spotify connected/i);
    expect(connectedLabel).toBeInTheDocument();
    const connectionIndicator = connectedLabel.parentElement.querySelector('[aria-hidden="true"]');
    expect(connectionIndicator).toHaveClass('bg-brand-primary');
    expect(connectionIndicator.className).not.toMatch(/emerald|status-clean/);
    expect(screen.queryByRole('button', { name: /connect spotify/i })).not.toBeInTheDocument();
    const exitBtn = screen.getByRole('button', { name: /exit vip mode/i });
    expect(exitBtn).toBeInTheDocument();

    await user.click(exitBtn);
    expect(onExitVip).toHaveBeenCalledTimes(1);
  });

  it('omits all VIP controls when vipMode={false}', () => {
    render(
      <GlobalHeader
        activeTab="scan"
        setActiveTab={() => {}}
        activePlatform="spotify"
        onSelectPlatform={() => {}}
        vipMode={false}
        isAuthenticated={false}
      />
    );

    expect(screen.queryByText('VIP')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /connect spotify/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/spotify connected/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /exit vip mode/i })).not.toBeInTheDocument();
  });

  it('applies the safe-area top inset to the sticky header', () => {
    render(
      <GlobalHeader
        activeTab="scan"
        setActiveTab={() => {}}
        activePlatform="spotify"
        onSelectPlatform={() => {}}
      />
    );

    const header = screen.getByRole('banner');
    expect(header).toHaveClass('pt-[env(safe-area-inset-top)]');
    expect(header).toHaveClass('sticky');
  });

  it('gives tab buttons a 44px minimum touch target on mobile and 40px from sm up', () => {
    render(
      <GlobalHeader
        activeTab="scan"
        setActiveTab={() => {}}
        activePlatform="spotify"
        onSelectPlatform={() => {}}
      />
    );

    const tab = screen.getByRole('button', { name: /scan & clean/i });
    expect(tab).toHaveClass('min-h-[44px]');
    expect(tab).toHaveClass('sm:min-h-[40px]');
  });
});

describe('index.html viewport', () => {
  it('includes viewport-fit=cover so env(safe-area-inset-*) resolves on notched devices', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    const viewport = html.match(/<meta\s+name="viewport"\s+content="([^"]*)"/);
    expect(viewport).not.toBeNull();
    expect(viewport[1]).toMatch(/viewport-fit=cover/);
  });
});
