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
    expect(screen.getByRole('button', { name: /slurs \+ strong language/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /scan lyrics/i })).toHaveClass(
      'bg-brand-primary',
      'hover:bg-brand-primary-hover'
    );
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
        isMasked={false}
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

  it('renders masking toggle button with aria-label="Toggle profanity masking", aria-pressed, and toggles on click', () => {
    const handleToggle = vi.fn();
    const { rerender } = render(
      <ScreeningControlsBar
        preset="moderate"
        customBlocklist={['fuck', 'shit']}
        isMasked={true}
        onToggleMasking={handleToggle}
      />
    );

    const toggleBtn = screen.getByRole('button', { name: 'Toggle profanity masking' });
    expect(toggleBtn).toBeInTheDocument();
    expect(toggleBtn).toHaveTextContent('Masked');
    expect(toggleBtn).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(toggleBtn);
    expect(handleToggle).toHaveBeenCalledTimes(1);

    // Rerender unmasked
    rerender(
      <ScreeningControlsBar
        preset="moderate"
        customBlocklist={['fuck', 'shit']}
        isMasked={false}
        onToggleMasking={handleToggle}
      />
    );

    expect(toggleBtn).toHaveTextContent('Unmasked');
    expect(toggleBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('defaults isMasked to true when rendered without isMasked prop', () => {
    render(
      <ScreeningControlsBar
        preset="moderate"
        customBlocklist={['beer']}
      />
    );

    expect(screen.getByText('b***')).toBeInTheDocument();
    const toggleBtn = screen.getByRole('button', { name: 'Toggle profanity masking' });
    expect(toggleBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('renders Zone 2 sunken console styling (bg-surface-inset, border-border-strong) and 02 / SCREENING RULES eyebrow badge', () => {
    const { container } = render(
      <ScreeningControlsBar
        preset="moderate"
        customBlocklist={[]}
      />
    );

    expect(screen.getByText('02 / SCREENING RULES')).toBeInTheDocument();
    const regionEl = screen.getByRole('region', { name: 'Screening Console' });
    expect(regionEl).toBe(container.firstChild);
    expect(regionEl).toHaveClass('bg-surface-inset');
    expect(regionEl).toHaveClass('border-border-strong');
  });

  it('masks custom blocklist chips when isMasked is true and keeps them unmasked when false', () => {
    const handleRemove = vi.fn();
    const { rerender } = render(
      <ScreeningControlsBar
        preset="moderate"
        customBlocklist={['bitch', 'asshole', 'f']}
        isMasked={true}
        onRemoveBlocklistTerm={handleRemove}
      />
    );

    // Masked chips
    expect(screen.getByText('b****')).toBeInTheDocument();
    expect(screen.getByText('a******')).toBeInTheDocument();
    expect(screen.getByText('f')).toBeInTheDocument();

    // Removing still uses literal term
    const removeBitchBtn = screen.getByRole('button', { name: 'Remove blocklist term bitch' });
    expect(removeBitchBtn).toBeInTheDocument();
    fireEvent.click(removeBitchBtn);
    expect(handleRemove).toHaveBeenCalledWith('bitch');

    // Rerender with isMasked=false
    rerender(
      <ScreeningControlsBar
        preset="moderate"
        customBlocklist={['bitch', 'asshole', 'f']}
        isMasked={false}
        onRemoveBlocklistTerm={handleRemove}
      />
    );

    expect(screen.getByText('bitch')).toBeInTheDocument();
    expect(screen.getByText('asshole')).toBeInTheDocument();
  });

  describe('Story 3.3: Bulk Clean Replacement button in ScreeningControlsBar', () => {
    it('renders "Find & Swap All Clean Versions" button and disables it when flaggedCount is 0', () => {
      const handleBulkClean = vi.fn();
      render(
        <ScreeningControlsBar
          preset="moderate"
          customBlocklist={[]}
          flaggedCount={0}
          onBulkClean={handleBulkClean}
        />
      );

      const bulkBtn = screen.getByRole('button', { name: /find & swap all clean versions/i });
      expect(bulkBtn).toBeInTheDocument();
      expect(bulkBtn).toBeDisabled();

      fireEvent.click(bulkBtn);
      expect(handleBulkClean).not.toHaveBeenCalled();
    });

    it('enables "Find & Swap All Clean Versions" when flaggedCount > 0 and calls onBulkClean on click', () => {
      const handleBulkClean = vi.fn();
      render(
        <ScreeningControlsBar
          preset="moderate"
          customBlocklist={[]}
          flaggedCount={5}
          onBulkClean={handleBulkClean}
        />
      );

      const bulkBtn = screen.getByRole('button', { name: /find & swap all clean versions/i });
      expect(bulkBtn).toBeEnabled();
      expect(bulkBtn).toHaveClass('bg-brand-primary', 'hover:bg-brand-primary-hover');
      expect(bulkBtn.className).not.toContain('status-clean');

      fireEvent.click(bulkBtn);
      expect(handleBulkClean).toHaveBeenCalledTimes(1);
    });

    it('displays animated progress and disables button when bulkCleaning is true', () => {
      const handleBulkClean = vi.fn();
      render(
        <ScreeningControlsBar
          preset="moderate"
          customBlocklist={[]}
          flaggedCount={8}
          bulkCleaning={true}
          bulkCleanProgress="Finding clean edits (4 of 8)…"
          onBulkClean={handleBulkClean}
        />
      );

      const bulkBtn = screen.getByRole('button', { name: /finding clean edits \(4 of 8\)…/i });
      expect(bulkBtn).toBeInTheDocument();
      expect(bulkBtn).toBeDisabled();
      expect(bulkBtn).toHaveTextContent('Finding clean edits (4 of 8)…');
    });

    it('disables "Find & Swap All Clean Versions" while scanning is in progress', () => {
      render(
        <ScreeningControlsBar
          preset="moderate"
          customBlocklist={[]}
          flaggedCount={4}
          scanning={true}
          onBulkClean={vi.fn()}
        />
      );

      const bulkBtn = screen.getByRole('button', { name: /find & swap all clean versions/i });
      expect(bulkBtn).toBeDisabled();
    });

    it('disables preset pills and custom blocklist inputs when bulkCleaning is true', () => {
      render(
        <ScreeningControlsBar
          preset="moderate"
          customBlocklist={['tobacco']}
          flaggedCount={3}
          bulkCleaning={true}
        />
      );

      expect(screen.getByRole('button', { name: /kid safe/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /moderate/i })).toBeDisabled();
      expect(screen.getByPlaceholderText(/add custom word/i)).toBeDisabled();
      expect(screen.getByRole('button', { name: /add blocklist term/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /remove blocklist term tobacco/i })).toBeDisabled();
    });

    it('disables bulk clean button when disabled prop is true', () => {
      render(
        <ScreeningControlsBar
          preset="moderate"
          customBlocklist={[]}
          flaggedCount={5}
          disabled={true}
        />
      );

      const bulkBtn = screen.getByRole('button', { name: /find & swap all clean versions/i });
      expect(bulkBtn).toBeDisabled();
    });
  });

  describe('Story 6.4: Preset micro-explainers & policy badging', () => {
    const SUMMARIES = {
      kid_safe:
        'Strictest: flags slurs, all profanity, sexual terms, and drug references, plus tracks tagged explicit.',
      moderate:
        'Radio-edit rules: flags slurs, strong profanity, and sexual terms, plus tracks tagged explicit; allows mild words like damn/hell.',
      slurs_only:
        'Flags only slurs and hate speech; allows other explicit lyrics and ignores explicit tags.',
      custom:
        'Applies the fixed slur and strong-profanity rules plus your custom blocklist terms, which apply under every preset. Also flags tracks tagged explicit.',
    };
    const BLOCKLIST_NOTE = 'Your blocklist words are flagged under every preset.';

    const getIndicator = () => screen.getByTestId('active-policy-indicator');
    const getPolicyLiveRegion = () => screen.getByTestId('policy-announcement');

    it('gives each preset pill an accessible description equal to its micro-copy, keeping the label as name', () => {
      render(<ScreeningControlsBar preset="moderate" customBlocklist={[]} />);

      const kid = screen.getByRole('button', { name: 'Kid Safe' });
      const mod = screen.getByRole('button', { name: 'Moderate' });
      const slurs = screen.getByRole('button', { name: 'Slurs Only' });
      const custom = screen.getByRole('button', { name: 'Slurs + Strong Language' });

      expect(kid).toHaveAccessibleDescription(SUMMARIES.kid_safe);
      expect(mod).toHaveAccessibleDescription(SUMMARIES.moderate);
      expect(slurs).toHaveAccessibleDescription(SUMMARIES.slurs_only);
      expect(custom).toHaveAccessibleDescription(SUMMARIES.custom);
      expect(kid).toHaveAttribute('title', SUMMARIES.kid_safe);
      expect(kid.className).toContain('min-h-[44px]');
    });

    it('renders the active policy indicator for the initial preset with an empty live region', () => {
      render(<ScreeningControlsBar preset="moderate" customBlocklist={[]} />);

      const indicator = getIndicator();
      expect(indicator).toHaveTextContent('Active policy: Moderate');
      expect(indicator).toHaveTextContent(SUMMARIES.moderate);
      expect(getPolicyLiveRegion()).toHaveTextContent('');
      expect(getPolicyLiveRegion()).toHaveAttribute('aria-live', 'polite');
      expect(getPolicyLiveRegion()).toHaveAttribute('aria-atomic', 'true');
      expect(getPolicyLiveRegion()).not.toHaveAttribute('role');
    });

    it('updates the indicator and announces the new threshold after a preset change', () => {
      const handleSelectPreset = vi.fn();
      const { rerender } = render(
        <ScreeningControlsBar
          preset="moderate"
          onSelectPreset={handleSelectPreset}
          customBlocklist={[]}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Kid Safe' }));
      expect(handleSelectPreset).toHaveBeenCalledWith('kid_safe');

      rerender(
        <ScreeningControlsBar
          preset="kid_safe"
          onSelectPreset={handleSelectPreset}
          customBlocklist={[]}
        />
      );

      expect(getIndicator()).toHaveTextContent('Active policy: Kid Safe');
      expect(getIndicator()).toHaveTextContent(SUMMARIES.kid_safe);
      expect(getPolicyLiveRegion()).toHaveTextContent(
        `Active threshold: Kid Safe — ${SUMMARIES.kid_safe}`
      );
      expect(screen.getByRole('button', { name: 'Kid Safe' })).toHaveAttribute(
        'aria-pressed',
        'true'
      );
    });

    it('does not announce on rerender when the preset is unchanged', () => {
      const { rerender } = render(
        <ScreeningControlsBar preset="moderate" customBlocklist={[]} />
      );
      rerender(<ScreeningControlsBar preset="moderate" customBlocklist={['beer']} />);
      expect(getPolicyLiveRegion()).toHaveTextContent('');
    });

    it('falls back to Moderate for an unknown preset id and marks the Moderate pill pressed', () => {
      render(<ScreeningControlsBar preset="legacy_x" customBlocklist={[]} />);

      expect(getIndicator()).toHaveTextContent('Active policy: Moderate');
      expect(getIndicator()).toHaveTextContent(SUMMARIES.moderate);
      expect(screen.getByRole('button', { name: 'Moderate' })).toHaveAttribute(
        'aria-pressed',
        'true'
      );
      expect(screen.getByRole('button', { name: 'Slurs + Strong Language' })).toHaveAttribute(
        'aria-pressed',
        'false'
      );
    });

    it('shows the descriptive label in the active policy line for the custom preset id', () => {
      render(<ScreeningControlsBar preset="custom" customBlocklist={[]} />);
      expect(getIndicator()).toHaveTextContent('Active policy: Slurs + Strong Language');
      expect(screen.queryByRole('button', { name: 'Custom' })).not.toBeInTheDocument();
    });

    it.each(['kid_safe', 'moderate', 'slurs_only', 'custom'])(
      'includes the blocklist note under preset %s',
      (presetId) => {
        render(<ScreeningControlsBar preset={presetId} customBlocklist={[]} />);
        expect(getIndicator()).toHaveTextContent(BLOCKLIST_NOTE);
      }
    );

    it('keeps the indicator visible and off clean-state emerald styling', () => {
      render(<ScreeningControlsBar preset="slurs_only" customBlocklist={[]} />);

      const indicator = getIndicator();
      const nodes = [indicator, ...indicator.querySelectorAll('*')];
      nodes.forEach((node) => {
        const cls = node.getAttribute('class') || '';
        expect(cls).not.toMatch(/status-clean|emerald|#4EDEA3|#10B981/i);
        expect(cls.split(/\s+/)).not.toContain('sr-only');
        expect(cls.split(/\s+/)).not.toContain('hidden');
        expect(cls.split(/\s+/)).not.toContain('invisible');
      });
      expect(indicator).toBeVisible();
    });
  });
});
