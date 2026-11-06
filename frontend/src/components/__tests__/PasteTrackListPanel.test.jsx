import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import PasteTrackListPanel from '../PasteTrackListPanel';

describe('PasteTrackListPanel Component', () => {
  it('does not render when isOpen is false', () => {
    render(
      <PasteTrackListPanel
        isOpen={false}
        onClose={vi.fn()}
        onResolve={vi.fn()}
      />
    );
    expect(screen.queryByLabelText(/paste track list panel/i)).not.toBeInTheDocument();
  });

  it('renders with initialText and live line counter ignoring empty lines', () => {
    const text = 'Song One\n\n  \nSong Two\nSong Three';
    render(
      <PasteTrackListPanel
        isOpen={true}
        initialText={text}
        onClose={vi.fn()}
        onResolve={vi.fn()}
      />
    );

    expect(screen.getByLabelText(/line counter/i)).toHaveTextContent('3 / 50 lines');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('updates line count live as user types and strips whitespace-only lines', async () => {
    const user = userEvent.setup();
    render(
      <PasteTrackListPanel
        isOpen={true}
        onClose={vi.fn()}
        onResolve={vi.fn()}
      />
    );

    const textarea = screen.getByLabelText(/pasted track list input/i);
    expect(screen.getByLabelText(/line counter/i)).toHaveTextContent('0 / 50 lines');

    await user.type(textarea, 'Track 1{Enter}   {Enter}Track 2');
    expect(screen.getByLabelText(/line counter/i)).toHaveTextContent('2 / 50 lines');
  });

  it('shows amber truncation warning when non-empty lines exceed 50 and limits resolve to 50', async () => {
    const user = userEvent.setup();
    const mockResolve = vi.fn();

    // 55 lines
    const fiftyFiveLines = Array.from({ length: 55 }, (_, i) => `Song ${i + 1}`).join('\n');

    render(
      <PasteTrackListPanel
        isOpen={true}
        initialText={fiftyFiveLines}
        onClose={vi.fn()}
        onResolve={mockResolve}
      />
    );

    expect(screen.getByLabelText(/line counter/i)).toHaveTextContent('55 / 50 lines');
    const warning = screen.getByRole('alert');
    expect(warning).toHaveTextContent(/list exceeds 50 lines/i);
    expect(warning).toHaveTextContent(/5 lines omitted/i);

    const resolveBtn = screen.getByRole('button', { name: /resolve & add/i });
    expect(resolveBtn).not.toBeDisabled();
    await user.click(resolveBtn);

    expect(mockResolve).toHaveBeenCalledTimes(1);
    const resolvedLines = mockResolve.mock.calls[0][0];
    expect(resolvedLines).toHaveLength(50);
    expect(resolvedLines[0]).toBe('Song 1');
    expect(resolvedLines[49]).toBe('Song 50');
  });

  it('disables Resolve & Add when input is empty or only whitespace', () => {
    render(
      <PasteTrackListPanel
        isOpen={true}
        initialText={'   \n   \n   '}
        onClose={vi.fn()}
        onResolve={vi.fn()}
      />
    );

    const resolveBtn = screen.getByRole('button', { name: /resolve & add/i });
    expect(resolveBtn).toBeDisabled();
  });

  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup();
    const mockClose = vi.fn();

    render(
      <PasteTrackListPanel
        isOpen={true}
        onClose={mockClose}
        onResolve={vi.fn()}
      />
    );

    const cancelBtn = screen.getByRole('button', { name: /cancel paste/i });
    await user.click(cancelBtn);
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it('sets wrap="off" and disables controls when isLoading is true', () => {
    render(
      <PasteTrackListPanel
        isOpen={true}
        initialText="Song A"
        isLoading={true}
        onClose={vi.fn()}
        onResolve={vi.fn()}
      />
    );

    const textarea = screen.getByLabelText(/pasted track list input/i);
    expect(textarea).toHaveAttribute('wrap', 'off');
    expect(textarea).toBeDisabled();

    expect(screen.getByRole('button', { name: /cancel paste/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /close paste panel/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /resolve & add/i })).toBeDisabled();
  });
});
