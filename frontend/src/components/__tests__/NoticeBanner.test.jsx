import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import NoticeBanner from '../NoticeBanner';

describe('NoticeBanner', () => {
  it('renders caution banner with message and dismiss button', async () => {
    const handleDismiss = vi.fn();
    const user = userEvent.setup();

    render(
      <NoticeBanner
        type="caution"
        message="Working list capped at 50 tracks (5 tracks omitted)."
        onDismiss={handleDismiss}
      />
    );

    expect(screen.getByText(/Working list capped at 50 tracks \(5 tracks omitted\)\./i)).toBeInTheDocument();
    const dismissBtn = screen.getByRole('button', { name: /dismiss notice/i });
    expect(dismissBtn).toBeInTheDocument();

    await user.click(dismissBtn);
    expect(handleDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders action button and invokes onAction when clicked', async () => {
    const handleAction = vi.fn();
    const user = userEvent.setup();

    render(
      <NoticeBanner
        type="caution"
        message="Rate limit reached"
        actionLabel="Retry"
        onAction={handleAction}
      />
    );

    const actionBtn = screen.getByRole('button', { name: /retry/i });
    await user.click(actionBtn);
    expect(handleAction).toHaveBeenCalledTimes(1);
  });

  it('renders error style banner for error or flagged notices', () => {
    render(
      <NoticeBanner
        type="error"
        message="Failed to load album tracks"
      />
    );

    const banner = screen.getByRole('alert');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent(/Failed to load album tracks/i);
  });
});
