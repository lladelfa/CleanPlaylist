import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CleanReplacementPickerModal from '../CleanReplacementPickerModal';
import { buildSwappedTrack, buildRevertedTrack } from '../../utils/swapHelpers';

const NORMALIZED_KEYS = [
  'id',
  'title',
  'artist',
  'artists_list',
  'album',
  'duration',
  'duration_seconds',
  'is_explicit',
  'thumbnail',
  'video_url',
];

const originalFlaggedTrack = {
  id: 'orig_1',
  title: 'SICKO MODE',
  artist: 'Travis Scott',
  artists_list: ['Travis Scott'],
  album: 'ASTROWORLD',
  duration: '5:12',
  duration_seconds: 312,
  is_explicit: true,
  thumbnail: 'https://example.com/orig.jpg',
  video_url: 'https://open.spotify.com/track/orig_1',
  verification_status: 'flagged',
  is_flagged: true,
  reasons: ['Marked Explicit by Spotify', 'Found 3 Strong Profanity instance(s)'],
  detected_terms: ['shit'],
  snippets: [{ line_number: 12, text: 'Some explicit line', matched_terms: ['shit'] }],
  total_flagged_count: 3,
  has_lyrics: true,
};

const candidate1 = {
  id: 'cand_1',
  title: 'SICKO MODE (Instrumental)',
  artist: 'Travis Scott',
  artists_list: ['Travis Scott'],
  album: 'ASTROWORLD (Instrumentals)',
  duration: '5:12',
  duration_seconds: 312,
  is_explicit: false,
  thumbnail: 'https://example.com/c1.jpg',
  video_url: 'https://open.spotify.com/track/cand_1',
  confidence_score: 55,
};

const candidate2 = {
  id: 'cand_2',
  title: 'SICKO MODE - Clean',
  artist: 'Travis Scott',
  artists_list: ['Travis Scott'],
  album: 'ASTROWORLD (Clean)',
  duration: '5:14',
  duration_seconds: 314,
  is_explicit: false,
  thumbnail: 'https://example.com/c2.jpg',
  video_url: 'https://open.spotify.com/track/cand_2',
  confidence_score: 118,
};

const candidate3Explicit = {
  id: 'cand_3',
  title: 'SICKO MODE (Radio Cut)',
  artist: 'Travis Scott',
  artists_list: ['Travis Scott'],
  album: 'Single',
  duration: '5:10',
  duration_seconds: 310,
  is_explicit: true,
  thumbnail: 'https://example.com/c3.jpg',
  video_url: 'https://open.spotify.com/track/cand_3',
  confidence_score: 90,
};

describe('swapHelpers: buildSwappedTrack & buildRevertedTrack', () => {
  it('preserves all 10 normalized keys and true original_track across repeated re-swaps and reverts losslessly', () => {
    const swap1 = buildSwappedTrack(originalFlaggedTrack, candidate1, {
      alternatives: [candidate1, candidate2, candidate3Explicit],
    });

    for (const key of NORMALIZED_KEYS) {
      expect(swap1).toHaveProperty(key);
    }
    expect(swap1.id).toBe('cand_1');
    expect(swap1.was_replaced).toBe(true);
    expect(swap1.verification_status).toBe('clean_swapped');
    expect(swap1.is_flagged).toBe(false);
    expect(swap1.original_track.id).toBe('orig_1');
    expect(swap1.original_track.is_flagged).toBe(true);
    expect(swap1.original_track.reasons).toEqual(originalFlaggedTrack.reasons);
    expect(swap1.original_track.snippets).toEqual(originalFlaggedTrack.snippets);

    // Re-swap from candidate1 to candidate2
    const swap2 = buildSwappedTrack(swap1, candidate2, {
      alternatives: [candidate1, candidate2, candidate3Explicit],
    });
    expect(swap2.id).toBe('cand_2');
    expect(swap2.was_replaced).toBe(true);
    // True original track is STILL orig_1, NOT cand_1
    expect(swap2.original_track.id).toBe('orig_1');
    expect(swap2.original_id).toBe('orig_1');
    expect(swap2.original_title).toBe('SICKO MODE');

    // Revert to original
    const reverted = buildRevertedTrack(swap2);
    for (const key of NORMALIZED_KEYS) {
      expect(reverted[key]).toEqual(originalFlaggedTrack[key]);
    }
    expect(reverted.was_replaced).toBeUndefined();
    expect(reverted.original_track).toBeUndefined();
    expect(reverted.verification_status).toBe('flagged');
    expect(reverted.is_flagged).toBe(true);
    expect(reverted.is_explicit).toBe(true);
    expect(reverted.reasons).toEqual(originalFlaggedTrack.reasons);
    expect(reverted.snippets).toEqual(originalFlaggedTrack.snippets);
  });

  it('does not leak ytmusic_video_id or lyrics from originalSnapshot onto candidates lacking them', () => {
    const origWithYtAndLyrics = {
      ...originalFlaggedTrack,
      ytmusic_video_id: 'yt_explicit_orig_999',
      lyrics: 'Explicit original lyrics',
    };
    const candWithoutYtOrLyrics = {
      id: 'cand_no_meta',
      title: 'SICKO MODE - Clean',
      artist: 'Travis Scott',
      artists_list: ['Travis Scott'],
      album: 'ASTROWORLD (Clean)',
      duration: '5:14',
      duration_seconds: 314,
      is_explicit: false,
      thumbnail: 'https://example.com/c2.jpg',
      video_url: 'https://open.spotify.com/track/cand_no_meta',
    };

    const swapped = buildSwappedTrack(origWithYtAndLyrics, candWithoutYtOrLyrics);
    expect(swapped.ytmusic_video_id).toBeNull();
    expect(swapped.lyrics).toBeUndefined();
    expect(swapped.has_lyrics).toBe(false);
    // Original snapshot still retains them for revert
    expect(swapped.original_track.ytmusic_video_id).toBe('yt_explicit_orig_999');
    expect(swapped.original_track.lyrics).toBe('Explicit original lyrics');
  });
});

describe('CleanReplacementPickerModal', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const swappedTrack = buildSwappedTrack(originalFlaggedTrack, candidate1, {
    alternatives: [candidate1, candidate2, candidate3Explicit],
  });

  it('renders ranked candidates with metadata, duration delta, explicit badge, external links, Current pill, and allows selecting any candidate', async () => {
    const user = userEvent.setup();
    const onSelectAlternative = vi.fn();
    const onRevert = vi.fn();
    const onClose = vi.fn();

    render(
      <CleanReplacementPickerModal
        track={swappedTrack}
        alternatives={[candidate1, candidate2, candidate3Explicit]}
        activePlatform="spotify"
        onSelectAlternative={onSelectAlternative}
        onRevert={onRevert}
        onClose={onClose}
      />
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');

    // Shows all 3 candidates
    expect(screen.getByText('SICKO MODE (Instrumental)')).toBeInTheDocument();
    expect(screen.getByText('SICKO MODE - Clean')).toBeInTheDocument();
    expect(screen.getByText('SICKO MODE (Radio Cut)')).toBeInTheDocument();

    // Duration deltas vs original (312s): 0s, +2s, -2s
    expect(screen.getByText(/0s/)).toBeInTheDocument();
    expect(screen.getByText(/\+2s/)).toBeInTheDocument();
    expect(screen.getByText(/-2s/)).toBeInTheDocument();

    // Current pill shown on candidate1
    expect(screen.getByText('Current')).toBeInTheDocument();

    // Explicit badge shown honestly on candidate3Explicit, and still freely selectable
    expect(screen.getByText('E')).toBeInTheDocument();

    // External verification links present
    const links = screen.getAllByRole('link');
    expect(links.length).toBeGreaterThanOrEqual(3);
    expect(links[0]).toHaveAttribute('href', 'https://open.spotify.com/track/cand_1');

    // Select candidate3Explicit (never blocked!)
    const selectButtons = screen.getAllByRole('button', { name: /Use This Match|Select/i });
    expect(selectButtons.length).toBeGreaterThanOrEqual(2);
    selectButtons.forEach((btn) => {
      expect(btn.className).toMatch(/min-h-\[44px\]/);
    });

    await user.click(selectButtons[selectButtons.length - 1]);
    expect(onSelectAlternative).toHaveBeenCalledWith(swappedTrack, candidate3Explicit);

    // Revert to Original button
    const revertBtn = screen.getByRole('button', { name: /Revert to Original/i });
    expect(revertBtn).toBeInTheDocument();
    expect(revertBtn.className).toMatch(/min-h-\[44px\]/);
    await user.click(revertBtn);
    expect(onRevert).toHaveBeenCalledWith(swappedTrack);
  });

  it('hides Revert to Original for pre-swap tracks and shows Fetch Other Matches when alternatives are empty', async () => {
    const user = userEvent.setup();
    const onFetchAlternatives = vi.fn();

    render(
      <CleanReplacementPickerModal
        track={originalFlaggedTrack}
        alternatives={[]}
        activePlatform="spotify"
        onSelectAlternative={vi.fn()}
        onRevert={vi.fn()}
        onFetchAlternatives={onFetchAlternatives}
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: /Revert to Original/i })).not.toBeInTheDocument();
    const fetchBtn = screen.getByRole('button', { name: /Fetch Other Matches/i });
    expect(fetchBtn).toBeInTheDocument();
    expect(fetchBtn.className).toMatch(/min-h-\[44px\]/);

    await user.click(fetchBtn);
    expect(onFetchAlternatives).toHaveBeenCalledWith(originalFlaggedTrack);
  });

  it('closes on Escape key and restores focus to triggerEl, and closes on backdrop click', () => {
    const triggerBtn = document.createElement('button');
    document.body.appendChild(triggerBtn);
    const focusSpy = vi.spyOn(triggerBtn, 'focus');
    const onClose = vi.fn();

    render(
      <CleanReplacementPickerModal
        track={swappedTrack}
        alternatives={[candidate1, candidate2]}
        triggerEl={triggerBtn}
        onSelectAlternative={vi.fn()}
        onRevert={vi.fn()}
        onClose={onClose}
      />
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(focusSpy).toHaveBeenCalled();

    // Backdrop click closes modal
    const dialog = screen.getByRole('dialog');
    fireEvent.click(dialog.parentElement);
    expect(onClose).toHaveBeenCalledTimes(2);

    document.body.removeChild(triggerBtn);
  });

  it('renders disabled Selected button for current candidate and shows Fetch Other Matches when swapped with 1 cached match', async () => {
    const user = userEvent.setup();
    const onSelectAlternative = vi.fn();
    const onFetchAlternatives = vi.fn();

    render(
      <CleanReplacementPickerModal
        track={swappedTrack}
        alternatives={[candidate1]}
        activePlatform="spotify"
        onSelectAlternative={onSelectAlternative}
        onRevert={vi.fn()}
        onFetchAlternatives={onFetchAlternatives}
        onClose={vi.fn()}
      />
    );

    const selectedBtn = screen.getByRole('button', { name: /^Selected$/i });
    expect(selectedBtn).toBeDisabled();
    await user.click(selectedBtn);
    expect(onSelectAlternative).not.toHaveBeenCalled();

    const fetchBtn = screen.getByRole('button', { name: /Fetch Other Matches/i });
    expect(fetchBtn).toBeInTheDocument();
    await user.click(fetchBtn);
    expect(onFetchAlternatives).toHaveBeenCalledWith(swappedTrack);
  });

  it('traps Tab and Shift+Tab focus within the dialog', () => {
    render(
      <CleanReplacementPickerModal
        track={swappedTrack}
        alternatives={[candidate1, candidate2]}
        activePlatform="spotify"
        onSelectAlternative={vi.fn()}
        onRevert={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const dialog = screen.getByRole('dialog');
    const focusables = Array.from(
      dialog.querySelectorAll(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    );
    expect(focusables.length).toBeGreaterThanOrEqual(2);
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    // Tab on last element wraps to first
    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(first);

    // Shift+Tab on first element wraps to last
    first.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });
});
