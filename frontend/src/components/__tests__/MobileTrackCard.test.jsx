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
});
