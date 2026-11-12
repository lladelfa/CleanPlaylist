import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CleanReplacementControl from '../CleanReplacementControl';
import WorkingListWorkbench from '../WorkingListWorkbench';
import MobileTrackCard from '../MobileTrackCard';
import LyricsModal from '../LyricsModal';
import ScanTab from '../ScanTab';

describe('Story 3.2: CleanReplacementControl & Per-Track / In-Modal Swap Workflow', () => {
  const flaggedTrack = {
    id: 'flagged_101',
    title: 'Explicit Hit Song',
    artist: 'Test Artist',
    album: 'Test Album',
    duration: '3:30',
    duration_seconds: 210,
    is_explicit: true,
    is_flagged: true,
    verification_status: 'flagged',
    reasons: ['Found 2 Strong Profanity instance(s)'],
    snippets: [{ line_number: 4, text: 'Some explicit lyric', matched_terms: ['explicit'] }],
    thumbnail: 'https://example.com/art.jpg',
    video_url: 'https://open.spotify.com/track/flagged_101',
  };

  const cleanCandidate = {
    id: 'clean_202',
    title: 'Explicit Hit Song (Radio Edit)',
    artist: 'Test Artist',
    artists_list: ['Test Artist'],
    album: 'Test Album (Clean)',
    duration: '3:28',
    duration_seconds: 208,
    is_explicit: false,
    thumbnail: 'https://example.com/clean_art.jpg',
    video_url: 'https://open.spotify.com/track/clean_202',
    ytmusic_video_id: 'yt_clean_202',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('CleanReplacementControl unit states', () => {
    it('renders "Find Clean Edit" button in initial flagged state and calls onFindClean when clicked', () => {
      const handleFindClean = vi.fn();
      render(
        <CleanReplacementControl
          track={flaggedTrack}
          onFindClean={handleFindClean}
        />
      );

      const findBtn = screen.getByRole('button', { name: /Find Clean Edit/i });
      expect(findBtn).toBeInTheDocument();
      expect(findBtn).not.toBeDisabled();

      fireEvent.click(findBtn);
      expect(handleFindClean).toHaveBeenCalledWith(flaggedTrack);
    });

    it('renders disabled "Searching…" spinner state when isSearching is true', () => {
      render(
        <CleanReplacementControl
          track={flaggedTrack}
          isSearching={true}
          onFindClean={vi.fn()}
        />
      );

      const searchingBtn = screen.getByRole('button', { name: /Searching…/i });
      expect(searchingBtn).toBeInTheDocument();
      expect(searchingBtn).toBeDisabled();
      expect(screen.getByText('Searching…')).toBeInTheDocument();
    });

    it('renders emerald "Swap to Clean" button with clean title and formatted duration difference when candidate is available', () => {
      const handleSwap = vi.fn();
      const { rerender } = render(
        <CleanReplacementControl
          track={flaggedTrack}
          cleanCandidate={cleanCandidate}
          onSwapTrack={handleSwap}
        />
      );

      // cleanCandidate is 208s vs 210s -> -2s
      const swapBtn = screen.getByRole('button', { name: /Swap to Clean/i });
      expect(swapBtn).toBeInTheDocument();
      expect(swapBtn).toHaveTextContent('Swap to Clean');
      expect(swapBtn).toHaveClass('bg-status-clean-bg', 'text-status-clean', 'border-status-clean-border');
      // desktop title in title attribute
      expect(swapBtn).toHaveTextContent('-2s');

      fireEvent.click(swapBtn);
      expect(handleSwap).toHaveBeenCalledWith(flaggedTrack, cleanCandidate);

      // Positive duration diff (+5s)
      rerender(
        <CleanReplacementControl
          track={flaggedTrack}
          cleanCandidate={{ ...cleanCandidate, duration_seconds: 215 }}
          onSwapTrack={handleSwap}
        />
      );
      expect(screen.getByRole('button', { name: /Swap to Clean/i })).toHaveTextContent('+5s');

      // Zero duration diff (0s)
      rerender(
        <CleanReplacementControl
          track={flaggedTrack}
          cleanCandidate={{ ...cleanCandidate, duration_seconds: 210 }}
          onSwapTrack={handleSwap}
        />
      );
      expect(screen.getByRole('button', { name: /Swap to Clean/i })).toHaveTextContent('0s');

      // Missing duration_seconds on candidate -> falls back to 0s instead of -210s
      rerender(
        <CleanReplacementControl
          track={flaggedTrack}
          cleanCandidate={{ ...cleanCandidate, duration_seconds: 0 }}
          onSwapTrack={handleSwap}
        />
      );
      expect(screen.getByRole('button', { name: /Swap to Clean/i })).toHaveTextContent('(0s)');
    });

    it('displays "No clean version found" in muted italic text next to a one-click Remove button when cleanCandidate is "none"', () => {
      const handleRemove = vi.fn();
      render(
        <CleanReplacementControl
          track={flaggedTrack}
          cleanCandidate="none"
          onRemoveTrack={handleRemove}
        />
      );

      const noCleanText = screen.getByText('No clean version found');
      expect(noCleanText).toBeInTheDocument();
      expect(noCleanText).toHaveClass('italic');
      expect(noCleanText).toHaveClass('text-text-muted');

      const removeBtn = screen.getByRole('button', { name: 'Remove track' });
      expect(removeBtn).toBeInTheDocument();
      fireEvent.click(removeBtn);
      expect(handleRemove).toHaveBeenCalledWith(flaggedTrack);
    });
  });

  describe('WorkingListWorkbench & MobileTrackCard integration', () => {
    it('renders CleanReplacementControl states inside WorkingListWorkbench without duplicating Remove track buttons', () => {
      window.innerWidth = 1024;
      const handleRemove = vi.fn();
      const { rerender } = render(
        <WorkingListWorkbench
          tracks={[flaggedTrack]}
          searchingClean={{ [flaggedTrack.id]: true }}
          onFindClean={vi.fn()}
          onSwapTrack={vi.fn()}
          onRemoveTrack={handleRemove}
        />
      );

      expect(screen.getByText('Searching…')).toBeInTheDocument();

      rerender(
        <WorkingListWorkbench
          tracks={[flaggedTrack]}
          cleanCandidates={{ [flaggedTrack.id]: cleanCandidate }}
          onFindClean={vi.fn()}
          onSwapTrack={vi.fn()}
          onRemoveTrack={handleRemove}
        />
      );

      const swapBtn = screen.getByRole('button', { name: /Swap to Clean/i });
      // desktop title in title attribute
      expect(swapBtn).toHaveTextContent('-2s');

      rerender(
        <WorkingListWorkbench
          tracks={[flaggedTrack]}
          cleanCandidates={{ [flaggedTrack.id]: 'none' }}
          onFindClean={vi.fn()}
          onSwapTrack={vi.fn()}
          onRemoveTrack={handleRemove}
        />
      );

      expect(screen.getByText('No clean version found')).toBeInTheDocument();
      const removeBtns = screen.getAllByRole('button', { name: 'Remove track' });
      expect(removeBtns).toHaveLength(1);
    });

    it('renders CleanReplacementControl states inside MobileTrackCard with >=44px touch targets', () => {
      const handleRemove = vi.fn();
      const { rerender } = render(
        <MobileTrackCard
          track={flaggedTrack}
          index={0}
          isSearchingClean={true}
          onFindClean={vi.fn()}
          onSwapTrack={vi.fn()}
          onRemoveTrack={handleRemove}
        />
      );

      expect(screen.getByText('Searching…')).toBeInTheDocument();

      rerender(
        <MobileTrackCard
          track={flaggedTrack}
          index={0}
          cleanCandidate={cleanCandidate}
          onFindClean={vi.fn()}
          onSwapTrack={vi.fn()}
          onRemoveTrack={handleRemove}
        />
      );

      const swapBtn = screen.getByRole('button', { name: /Swap to Clean/i });
      expect(swapBtn).toHaveTextContent('Explicit Hit Song (Radio Edit)');
      expect(swapBtn).toHaveTextContent('-2s');
      expect(swapBtn.className).toMatch(/min-h-\[44px\]/);

      rerender(
        <MobileTrackCard
          track={flaggedTrack}
          index={0}
          cleanCandidate="none"
          onFindClean={vi.fn()}
          onSwapTrack={vi.fn()}
          onRemoveTrack={handleRemove}
        />
      );

      expect(screen.getByText('No clean version found')).toBeInTheDocument();
      const removeBtns = screen.getAllByRole('button', { name: 'Remove track' });
      expect(removeBtns).toHaveLength(1);
    });
  });

  describe('ScanTab end-to-end per-track find & swap workflow', () => {
    function StatefulScanWrapper() {
      const [playlist, setPlaylist] = useState({
        id: 'pl_1',
        title: 'My Playlist',
        tracks: [flaggedTrack],
      });
      const [scannedTracks, setScannedTracks] = useState([flaggedTrack]);
      const [workingList, setWorkingList] = useState([flaggedTrack]);
      const [lyricsByTrackId, setLyricsByTrackId] = useState({
        [flaggedTrack.id]: 'Some explicit lyric',
      });
      const [customBlocklist, setCustomBlocklist] = useState([]);

      return (
        <div>
          <ScanTab
            playlist={playlist}
            setPlaylist={setPlaylist}
            scannedTracks={scannedTracks}
            setScannedTracks={setScannedTracks}
            workingList={workingList}
            setWorkingList={setWorkingList}
            lyricsByTrackId={lyricsByTrackId}
            setLyricsByTrackId={setLyricsByTrackId}
            onOpenLyrics={vi.fn()}
            customBlocklist={customBlocklist}
            setCustomBlocklist={setCustomBlocklist}
            preset="moderate"
            setPreset={vi.fn()}
            isAuthenticated={false}
            activePlatform="spotify"
          />
          <div data-testid="working-list-json">{JSON.stringify(workingList)}</div>
          <div data-testid="lyrics-map-json">{JSON.stringify(lyricsByTrackId)}</div>
        </div>
      );
    }

    it('calls POST /api/replacements/find with platform and track_id, previews candidate, and swaps track with verification_status="clean_swapped", lyricsByTrackId update, and live announcement', async () => {
      const user = userEvent.setup();
      let resolveFetch;
      const fetchPromise = new Promise((resolve) => {
        resolveFetch = resolve;
      });

      const fetchMock = vi.spyOn(global, 'fetch').mockReturnValueOnce(fetchPromise);

      render(<StatefulScanWrapper />);

      const findBtn = screen.getByRole('button', { name: /Find Clean Edit/i });
      await user.click(findBtn);

      // Shows "Searching…" spinner while request is in flight
      expect(screen.getByText('Searching…')).toBeInTheDocument();

      // Verifies request payload includes track_id and platform
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/replacements/find',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            title: flaggedTrack.title,
            artist: flaggedTrack.artist,
            duration_seconds: flaggedTrack.duration_seconds,
            track_id: flaggedTrack.id,
            platform: 'spotify',
          }),
        })
      );

      // Resolve fetch with candidate and clean lyrics
      resolveFetch({
        ok: true,
        json: async () => ({
          found: true,
          clean_candidate: cleanCandidate,
          lyrics_by_id: {
            [cleanCandidate.id]: 'Clean radio edit lyrics here',
          },
        }),
      });

      const swapBtn = await screen.findByRole('button', { name: /Swap to Clean/i });
      // desktop title in title attribute
      expect(swapBtn).toHaveTextContent('-2s');

      await user.click(swapBtn);

      // Verify workingList updated with clean_swapped status and is_flagged: false
      const updatedWorkingList = JSON.parse(screen.getByTestId('working-list-json').textContent);
      expect(updatedWorkingList).toHaveLength(1);
      expect(updatedWorkingList[0].id).toBe('clean_202');
      expect(updatedWorkingList[0].title).toBe('Explicit Hit Song (Radio Edit)');
      expect(updatedWorkingList[0].verification_status).toBe('clean_swapped');
      expect(updatedWorkingList[0].is_flagged).toBe(false);
      expect(updatedWorkingList[0].is_explicit).toBe(false);
      expect(updatedWorkingList[0].ytmusic_video_id).toBe('yt_clean_202');

      // Verify badge in row now shows "Clean Swapped"
      expect(screen.getByText('Clean Swapped')).toBeInTheDocument();

      // Verify lyricsByTrackId updated with clean lyrics
      const updatedLyricsMap = JSON.parse(screen.getByTestId('lyrics-map-json').textContent);
      expect(updatedLyricsMap['clean_202']).toBe('Clean radio edit lyrics here');

      // Verify aria-live polite announcement
      const liveRegion = screen.getByRole('status');
      expect(liveRegion).toHaveTextContent(/Swapped.*Explicit Hit Song.*to clean version/i);
      const cleanSwapConfirmation = screen
        .getAllByText(/Swapped.*Explicit Hit Song.*to clean version/i)
        .find((message) => message.parentElement.className.includes('bg-status-clean-bg'));
      expect(cleanSwapConfirmation).toBeDefined();
      expect(cleanSwapConfirmation.parentElement).toHaveClass(
        'bg-status-clean-bg',
        'border-status-clean-border',
        'text-status-clean'
      );
    });

    it('displays "No clean version found" in ScanTab when /api/replacements/find returns found: false', async () => {
      const user = userEvent.setup();
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          found: false,
          clean_candidate: null,
          lyrics_by_id: {},
        }),
      });

      render(<StatefulScanWrapper />);

      const findBtn = screen.getByRole('button', { name: /Find Clean Edit/i });
      await user.click(findBtn);

      expect(await screen.findByText('No clean version found')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Remove track' })).toBeInTheDocument();
    });

    it('preserves Find Clean Edit button for retry and shows caution notice when /api/replacements/find returns an HTTP error', async () => {
      const user = userEvent.setup();
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ detail: 'Upstream rate limit' }),
      });

      render(<StatefulScanWrapper />);

      const findBtn = screen.getByRole('button', { name: /Find Clean Edit/i });
      await user.click(findBtn);

      expect(await screen.findByText(/Upstream rate limit/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Find Clean Edit/i })).toBeInTheDocument();
      expect(screen.queryByText('No clean version found')).not.toBeInTheDocument();
    });
  });

  describe('LyricsModal in-modal swap workflow', () => {
    it('renders an emerald top banner displaying "Swap to Clean" when a clean candidate is available, updates parent row, and closes the modal', async () => {
      const user = userEvent.setup();
      const handleClose = vi.fn();
      const handleSwapTrack = vi.fn();

      render(
        <LyricsModal
          track={flaggedTrack}
          cleanCandidate={cleanCandidate}
          onClose={handleClose}
          onSwapTrack={handleSwapTrack}
          lyricsByTrackId={{ [flaggedTrack.id]: 'Some explicit lyric' }}
          activePlatform="spotify"
        />
      );

      const bannerSwapBtn = screen.getByRole('button', { name: /Swap to Clean/i });
      expect(bannerSwapBtn).toBeInTheDocument();
      expect(screen.getByText(/Explicit Hit Song \(Radio Edit\)/i)).toBeInTheDocument();
      expect(screen.getByText(/-2s/i)).toBeInTheDocument();

      await user.click(bannerSwapBtn);

      expect(handleSwapTrack).toHaveBeenCalledWith(flaggedTrack, cleanCandidate);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('updates workingList and closes modal when Swap to Clean is clicked via onApplyReplacement fallback', async () => {
      const user = userEvent.setup();
      const handleClose = vi.fn();
      const handleApplyReplacement = vi.fn();

      render(
        <LyricsModal
          track={flaggedTrack}
          cleanCandidate={cleanCandidate}
          onClose={handleClose}
          onApplyReplacement={handleApplyReplacement}
          lyricsByTrackId={{ [flaggedTrack.id]: 'Some explicit lyric' }}
          activePlatform="spotify"
        />
      );

      const bannerSwapBtn = screen.getByRole('button', { name: /Swap to Clean/i });
      await user.click(bannerSwapBtn);

      expect(handleApplyReplacement).toHaveBeenCalledWith(cleanCandidate);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });
});
