import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ScreeningControlsBar from '../ScreeningControlsBar';

describe('ScreeningControlsBar', () => {
  it('renders all four preset pills with accessible text', () => {
    render(
      <ScreeningControlsBar
        preset="moderate"
        onSelectPreset={vi.fn()}
        customBlocklist={[]}
      />
    );

    expect(screen.getByRole('button', { name: /kid safe/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /moderate/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /slurs only/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /custom/i })).toBeInTheDocument();
  });

  it('indicates active preset and invokes callback when switching presets', () => {
    const handleSelectPreset = vi.fn();
    render(
      <ScreeningControlsBar
        preset="moderate"
        onSelectPreset={handleSelectPreset}
        customBlocklist={[]}
      />
    );

    const moderateBtn = screen.getByRole('button', { name: /moderate/i });
    expect(moderateBtn).toHaveAttribute('aria-pressed', 'true');
    expect(moderateBtn.className).toContain('bg-brand-primary');

    const kidSafeBtn = screen.getByRole('button', { name: /kid safe/i });
    expect(kidSafeBtn).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(kidSafeBtn);
    expect(handleSelectPreset).toHaveBeenCalledWith('kid_safe');
  });

  it('renders custom blocklist chips with aria-label="Remove blocklist term {term}" and allows removal', () => {
    const handleRemove = vi.fn();
    render(
      <ScreeningControlsBar
        preset="moderate"
        customBlocklist={['beer', 'whiskey']}
        onRemoveBlocklistTerm={handleRemove}
      />
    );

    expect(screen.getByText('beer')).toBeInTheDocument();
    expect(screen.getByText('whiskey')).toBeInTheDocument();

    const removeBeerBtn = screen.getByRole('button', {
      name: 'Remove blocklist term beer',
    });
    expect(removeBeerBtn).toBeInTheDocument();

    fireEvent.click(removeBeerBtn);
    expect(handleRemove).toHaveBeenCalledWith('beer');
  });

  it('submits a new custom blocklist term on Enter, trimming and lowercasing it', () => {
    const handleAdd = vi.fn();
    render(
      <ScreeningControlsBar
        preset="moderate"
        customBlocklist={['beer']}
        onAddBlocklistTerm={handleAdd}
      />
    );

    const input = screen.getByPlaceholderText(/add custom word/i);
    fireEvent.change(input, { target: { value: '  Tobacco  ' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(handleAdd).toHaveBeenCalledWith('tobacco');
    expect(input.value).toBe('');
  });

  it('ignores duplicate or whitespace-only submissions', () => {
    const handleAdd = vi.fn();
    render(
      <ScreeningControlsBar
        preset="moderate"
        customBlocklist={['beer']}
        onAddBlocklistTerm={handleAdd}
      />
    );

    const input = screen.getByPlaceholderText(/add custom word/i);

    // Whitespace only
    fireEvent.change(input, { target: { value: '    ' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    expect(handleAdd).not.toHaveBeenCalled();

    // Duplicate term (case-insensitive)
    fireEvent.change(input, { target: { value: 'BEER' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    expect(handleAdd).not.toHaveBeenCalled();
    expect(input.value).toBe('');
  });

  it('submits a new custom blocklist term by clicking the Add Word button', () => {
    const handleAdd = vi.fn();
    render(
      <ScreeningControlsBar
        preset="moderate"
        customBlocklist={[]}
        onAddBlocklistTerm={handleAdd}
      />
    );

    const input = screen.getByPlaceholderText(/add custom word/i);
    fireEvent.change(input, { target: { value: 'gambling' } });

    const addWordBtn = screen.getByRole('button', { name: /add blocklist term|add word/i });
    fireEvent.click(addWordBtn);

    expect(handleAdd).toHaveBeenCalledWith('gambling');
    expect(input.value).toBe('');
  });

  it('renders scan button and reflects scanning and progress announcements', () => {
    const handleRunScan = vi.fn();
    const { rerender } = render(
      <ScreeningControlsBar
        preset="moderate"
        customBlocklist={[]}
        onRunScan={handleRunScan}
        scanning={false}
      />
    );

    const scanBtn = screen.getByRole('button', { name: /scan lyrics/i });
    expect(scanBtn).toBeEnabled();

    fireEvent.click(scanBtn);
    expect(handleRunScan).toHaveBeenCalled();

    // Rerender in scanning state
    rerender(
      <ScreeningControlsBar
        preset="moderate"
        customBlocklist={[]}
        onRunScan={handleRunScan}
        scanning={true}
        scanProgressAnnouncement="Scanned 5 of 10 tracks"
      />
    );

    expect(screen.getByRole('button', { name: /scanned 5 of 10 tracks/i })).toBeDisabled();
    const liveRegion = screen.getByRole('status');
    expect(liveRegion).toHaveTextContent('Scanned 5 of 10 tracks');
  });
});
