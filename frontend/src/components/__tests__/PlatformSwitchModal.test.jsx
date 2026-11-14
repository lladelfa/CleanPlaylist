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

// Story 7.10: focus management (focus-in, trap, Escape, focus return)
describe('PlatformSwitchModal focus management', () => {
  function Harness() {
    const [open, setOpen] = React.useState(false);
    return (
      <div>
        <button type="button" onClick={() => setOpen(true)}>Switch platform</button>
        <PlatformSwitchModal
          isOpen={open}
          targetPlatform="ytmusic"
          onConfirm={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </div>
    );
  }

  async function openModal() {
    const user = userEvent.setup();
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Switch platform' });
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
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
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
