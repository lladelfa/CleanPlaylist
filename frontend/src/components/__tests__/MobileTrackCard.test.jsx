import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MobileTrackCard from '../MobileTrackCard';

describe('MobileTrackCard component', () => {
  const sampleTrack = {
    id: 'sp_123',
    title: 'Mr. Brightside',
    artist: 'The Killers',
    album: 'Hot Fuss',
    duration: '3:42',
    duration_seconds: 222,
    thumbnail: 'https://example.com/art.jpg',
    verification_status: 'unscanned',
  };

  it('renders track info, cover art, duration, and status badge', () => {
    render(<MobileTrackCard track={sampleTrack} index={0} />);

    expect(screen.getByText('Mr. Brightside')).toBeInTheDocument();
    expect(screen.getByText('The Killers')).toBeInTheDocument();
    expect(screen.getByText(/Hot Fuss/)).toBeInTheDocument();
    expect(screen.getByText('3:42')).toBeInTheDocument();
    expect(screen.getByText('Unscanned')).toBeInTheDocument();

    const img = screen.getByRole('img', { name: 'Mr. Brightside' });
    expect(img).toHaveAttribute('src', 'https://example.com/art.jpg');
  });

  it('provides a remove button with aria-label="Remove track" and >=44px touch target', () => {
    const handleRemove = vi.fn();
    render(<MobileTrackCard track={sampleTrack} index={0} onRemoveTrack={handleRemove} />);

    const removeBtn = screen.getByRole('button', { name: 'Remove track' });
    expect(removeBtn).toBeInTheDocument();
    expect(removeBtn.className).toMatch(/min-h-\[44px\]/);
    expect(removeBtn.className).toMatch(/min-w-\[44px\]/);

    fireEvent.click(removeBtn);
    expect(handleRemove).toHaveBeenCalledWith(sampleTrack);
  });

  it('renders fallback placeholder icon and 0:00 duration when fields are missing', () => {
    const incompleteTrack = {
      id: 'sp_empty',
      title: 'Unknown Title',
      artist: 'Unknown Artist',
    };

    render(<MobileTrackCard track={incompleteTrack} index={1} />);

    expect(screen.getByText('Unknown Title')).toBeInTheDocument();
    expect(screen.getByText('Unknown Artist')).toBeInTheDocument();
    expect(screen.getByText('0:00')).toBeInTheDocument();
    expect(screen.getByText('Unscanned')).toBeInTheDocument();
    // No img element, renders music placeholder icon
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('calls onOpenLyrics with track and trigger element when clicking snippet button', () => {
    const handleOpenLyrics = vi.fn();
    const flaggedTrack = {
      ...sampleTrack,
      is_flagged: true,
      verification_status: 'flagged',
      snippets: [{ line_number: 7, text: 'flagged mobile lyrics', matched_terms: ['flagged'] }],
      reasons: ['Found 1 Strong Profanity instance(s)'],
    };

    render(
      <MobileTrackCard
        track={flaggedTrack}
        index={0}
        onOpenLyrics={handleOpenLyrics}
        isMasked={false}
      />
    );

    const snippetBtn = screen.getByRole('button', { name: 'Inspect lyric snippet' });
    expect(snippetBtn).toBeInTheDocument();
    expect(screen.getByText('L07:')).toBeInTheDocument();
    expect(screen.getByText('"flagged mobile lyrics"')).toBeInTheDocument();

    fireEvent.click(snippetBtn);
    expect(handleOpenLyrics).toHaveBeenCalledTimes(1);
    expect(handleOpenLyrics).toHaveBeenCalledWith(flaggedTrack, snippetBtn);
  });

  it('defaults isMasked to true when rendered without isMasked prop', () => {
    const flaggedTrack = {
      ...sampleTrack,
      is_flagged: true,
      verification_status: 'flagged',
      snippets: [{ line_number: 7, text: "Don't give a fuck", matched_terms: ['fuck'] }],
    };

    render(
      <MobileTrackCard
        track={flaggedTrack}
        index={0}
      />
    );

    expect(screen.getByText('"Don\'t give a f***"')).toBeInTheDocument();
  });

  it('applies rose accent rail (border-l-2 border-l-status-flagged-border/60) when track is flagged and omits it when clean', () => {
    const flaggedTrack = { ...sampleTrack, is_flagged: true };
    const cleanTrack = { ...sampleTrack, is_flagged: false };

    const { rerender } = render(<MobileTrackCard track={flaggedTrack} index={0} />);
    const card = screen.getByRole('article');
    expect(card).toHaveClass('border-l-2');
    expect(card).toHaveClass('border-l-status-flagged-border/60');

    rerender(<MobileTrackCard track={cleanTrack} index={0} />);
    expect(card).not.toHaveClass('border-l-status-flagged-border/60');
  });

  it('masks snippet text and flagged reasons when isMasked is true', () => {
    const flaggedTrack = {
      ...sampleTrack,
      is_flagged: true,
      verification_status: 'flagged',
      snippets: [{ line_number: 7, text: "Don't give a fuck", matched_terms: ['fuck'] }],
    };

    const { rerender } = render(
      <MobileTrackCard
        track={flaggedTrack}
        index={0}
        isMasked={true}
      />
    );

    expect(screen.getByText('"Don\'t give a f***"')).toBeInTheDocument();

    rerender(
      <MobileTrackCard
        track={flaggedTrack}
        index={0}
        isMasked={false}
      />
    );

    expect(screen.getByText('"Don\'t give a fuck"')).toBeInTheDocument();
  });
});
