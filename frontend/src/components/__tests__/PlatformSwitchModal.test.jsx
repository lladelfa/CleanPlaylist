import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import PlatformSwitchModal from '../PlatformSwitchModal';

describe('PlatformSwitchModal', () => {
  it('renders caution message and action buttons when open', () => {
    render(
      <PlatformSwitchModal
        isOpen={true}
        targetPlatform="ytmusic"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    );

    expect(screen.getByRole('heading', { name: /switch platform/i })).toBeInTheDocument();
    expect(
      screen.getByText(/switching platforms resets the working list/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /switch & clear list/i })).toBeInTheDocument();
  });

  it('does not render anything when isOpen is false', () => {
    const { container } = render(
      <PlatformSwitchModal
        isOpen={false}
        targetPlatform="ytmusic"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('calls onCancel when Cancel is clicked', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(
      <PlatformSwitchModal
        isOpen={true}
        targetPlatform="ytmusic"
        onConfirm={() => {}}
        onCancel={onCancel}
      />
    );

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onConfirm when Switch & Clear List is clicked', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(
      <PlatformSwitchModal
        isOpen={true}
        targetPlatform="ytmusic"
        onConfirm={onConfirm}
        onCancel={() => {}}
      />
    );

    await user.click(screen.getByRole('button', { name: /switch & clear list/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when Escape key is pressed', () => {
    const onCancel = vi.fn();
    render(
      <PlatformSwitchModal
        isOpen={true}
        targetPlatform="ytmusic"
        onConfirm={() => {}}
        onCancel={onCancel}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when clicking outside dialog on backdrop', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(
      <PlatformSwitchModal
        isOpen={true}
        targetPlatform="ytmusic"
        onConfirm={() => {}}
        onCancel={onCancel}
      />
    );

    const dialogBackdrop = screen.getByRole('dialog');
    await user.click(dialogBackdrop);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('locks body scroll when open and unlocks on close', () => {
    const { unmount } = render(
      <PlatformSwitchModal
        isOpen={true}
        targetPlatform="ytmusic"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    );

    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });
});
