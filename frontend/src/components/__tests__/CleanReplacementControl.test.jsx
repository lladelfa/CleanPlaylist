import React, { useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CleanReplacementControl from '../CleanReplacementControl';
import WorkingListWorkbench from '../WorkingListWorkbench';
import MobileTrackCard from '../MobileTrackCard';
import LyricsModal from '../LyricsModal';
import ScanTab from '../ScanTab';
import App from '../../App';

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

    it('renders "Change / Undo" in LyricsModal for a swapped track and invokes onOpenAlternatives', async () => {
      const user = userEvent.setup();
      const handleClose = vi.fn();
      const handleOpenAlternatives = vi.fn();
      const swappedTrack = {
        ...cleanCandidate,
        was_replaced: true,
        verification_status: 'clean_swapped',
        is_flagged: false,
        original_track: flaggedTrack,
      };

      render(
        <LyricsModal
          track={swappedTrack}
          onClose={handleClose}
          onOpenAlternatives={handleOpenAlternatives}
          lyricsByTrackId={{ [swappedTrack.id]: 'Clean lyrics' }}
          activePlatform="spotify"
        />
      );

      const changeUndoBtn = screen.getByRole('button', { name: /Change \/ Undo|Change or undo/i });
      expect(changeUndoBtn).toBeInTheDocument();
      await user.click(changeUndoBtn);

      expect(handleOpenAlternatives).toHaveBeenCalledWith(swappedTrack, expect.anything());
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('renders pre-swap "Other matches (N)" in LyricsModal and enforces mutual exclusion between swapped and pre-swap banners', async () => {
      const user = userEvent.setup();
      const handleClose = vi.fn();
      const handleOpenAlternatives = vi.fn();
      const alt2 = { ...cleanCandidate, id: 'clean_alt_2', title: 'Alt Clean' };

      const { rerender } = render(
        <LyricsModal
          track={flaggedTrack}
          cleanCandidate={cleanCandidate}
          cleanAlternatives={{ [flaggedTrack.id]: [cleanCandidate, alt2] }}
          onClose={handleClose}
          onSwapTrack={vi.fn()}
          onOpenAlternatives={handleOpenAlternatives}
          lyricsByTrackId={{ [flaggedTrack.id]: 'Some explicit lyric' }}
          activePlatform="spotify"
        />
      );

      // Pre-swap banner shown, swapped banner hidden
      expect(screen.getByRole('region', { name: /Clean replacement available/i })).toBeInTheDocument();
      expect(screen.queryByRole('region', { name: /Clean swap options/i })).not.toBeInTheDocument();

      const otherBtn = screen.getByRole('button', { name: /Other matches \(2\)/i });
      await user.click(otherBtn);
      expect(handleOpenAlternatives).toHaveBeenCalledWith(flaggedTrack, expect.anything());
      expect(handleClose).toHaveBeenCalledTimes(1);

      // Swapped track with cleanCandidate also passed -> only swapped banner renders (mutual exclusion)
      const swappedTrack = {
        ...cleanCandidate,
        was_replaced: true,
        verification_status: 'clean_swapped',
        is_flagged: false,
        original_track: flaggedTrack,
      };
      rerender(
        <LyricsModal
          track={swappedTrack}
          cleanCandidate={cleanCandidate}
          onClose={handleClose}
          onSwapTrack={vi.fn()}
          onOpenAlternatives={handleOpenAlternatives}
          lyricsByTrackId={{ [swappedTrack.id]: 'Clean lyrics' }}
          activePlatform="spotify"
        />
      );

      expect(screen.getByRole('region', { name: /Clean swap options/i })).toBeInTheDocument();
      expect(screen.queryByRole('region', { name: /Clean replacement available/i })).not.toBeInTheDocument();
    });
  });

  describe('Clean swap alternatives, Change / Undo, and Revert workflows', () => {
    const alternateCandidate = {
      id: 'clean_303',
      title: 'Explicit Hit Song (Clean Album Version)',
      artist: 'Test Artist',
      artists_list: ['Test Artist'],
      album: 'Test Album (Clean Deluxe)',
      duration: '3:31',
      duration_seconds: 211,
      is_explicit: false,
      thumbnail: 'https://example.com/clean_art_2.jpg',
      video_url: 'https://open.spotify.com/track/clean_303',
    };

    it('renders "Change / Undo" on swapped tracks and pre-swap "Other matches (N)" only when >= 2 alternatives exist', () => {
      const onOpenAlternatives = vi.fn();
      const { rerender } = render(
        <CleanReplacementControl
          track={flaggedTrack}
          cleanCandidate={cleanCandidate}
          cleanAlternatives={[cleanCandidate]}
          onSwapTrack={vi.fn()}
          onOpenAlternatives={onOpenAlternatives}
        />
      );

      // <= 1 candidate -> no extra trigger
      expect(screen.queryByRole('button', { name: /Other matches/i })).not.toBeInTheDocument();

      // >= 2 candidates -> shows "Other matches (2)"
      rerender(
        <CleanReplacementControl
          track={flaggedTrack}
          cleanCandidate={cleanCandidate}
          cleanAlternatives={[cleanCandidate, alternateCandidate]}
          onSwapTrack={vi.fn()}
          onOpenAlternatives={onOpenAlternatives}
        />
      );

      const otherBtn = screen.getByRole('button', { name: /Other matches \(2\)/i });
      expect(otherBtn).toBeInTheDocument();
      fireEvent.click(otherBtn);
      expect(onOpenAlternatives).toHaveBeenCalledWith(flaggedTrack, expect.anything());

      // Swapped track -> shows "Change / Undo"
      const swappedTrack = {
        ...cleanCandidate,
        was_replaced: true,
        verification_status: 'clean_swapped',
        is_flagged: false,
        original_track: flaggedTrack,
      };
      rerender(
        <CleanReplacementControl
          track={swappedTrack}
          onOpenAlternatives={onOpenAlternatives}
          variant="mobile"
        />
      );

      const changeUndoBtn = screen.getByRole('button', { name: /Change \/ Undo|Change or undo/i });
      expect(changeUndoBtn).toBeInTheDocument();
      expect(changeUndoBtn.className).toMatch(/min-h-\[44px\]/);
      fireEvent.click(changeUndoBtn);
      expect(onOpenAlternatives).toHaveBeenCalledWith(swappedTrack, expect.anything());
    });

    it('supports single find -> swap -> Change / Undo -> pick alternate #2 -> Revert to Original in ScanTab', async () => {
      const user = userEvent.setup();

      function StatefulAlternativesWrapper() {
        const [playlist, setPlaylist] = useState({
          id: 'pl_1',
          title: 'My Playlist',
          tracks: [flaggedTrack],
        });
        const [scannedTracks, setScannedTracks] = useState([flaggedTrack]);
        const [workingList, setWorkingList] = useState([flaggedTrack]);
        const [lyricsByTrackId, setLyricsByTrackId] = useState({});

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
              customBlocklist={[]}
              setCustomBlocklist={vi.fn()}
              preset="moderate"
              setPreset={vi.fn()}
              isAuthenticated={false}
              activePlatform="spotify"
            />
            <div data-testid="working-list-json">{JSON.stringify(workingList)}</div>
            <div data-testid="playlist-json">{JSON.stringify(playlist)}</div>
          </div>
        );
      }

      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          found: true,
          clean_candidate: cleanCandidate,
          clean_alternatives: [cleanCandidate, alternateCandidate],
          lyrics_by_id: {},
        }),
      });

      render(<StatefulAlternativesWrapper />);

      await user.click(screen.getByRole('button', { name: /Find Clean Edit/i }));
      expect(await screen.findByRole('button', { name: /Other matches \(2\)/i })).toBeInTheDocument();

      // Swap to candidate #1
      await user.click(screen.getByRole('button', { name: /Swap to Clean/i }));

      // Open Change / Undo modal
      const changeUndoBtn = await screen.findByRole('button', { name: /Change \/ Undo|Change or undo/i });
      await user.click(changeUndoBtn);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Explicit Hit Song (Clean Album Version)')).toBeInTheDocument();

      // Pick alternate #2
      const useButtons = screen.getAllByRole('button', { name: /Use This Match|Select/i });
      await user.click(useButtons[useButtons.length - 1]);

      // Modal closes; workingList & playlist updated to clean_303 while retaining orig flagged_101
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      let currentList = JSON.parse(screen.getByTestId('working-list-json').textContent);
      expect(currentList[0].id).toBe('clean_303');
      expect(currentList[0].original_track.id).toBe('flagged_101');
      let currentPlaylist = JSON.parse(screen.getByTestId('playlist-json').textContent);
      expect(currentPlaylist.tracks[0].id).toBe('clean_303');

      // Re-open Change / Undo and Revert to Original
      await user.click(screen.getByRole('button', { name: /Change \/ Undo|Change or undo/i }));
      await user.click(screen.getByRole('button', { name: /Revert to Original/i }));

      currentList = JSON.parse(screen.getByTestId('working-list-json').textContent);
      expect(currentList[0].id).toBe('flagged_101');
      expect(currentList[0].is_flagged).toBe(true);
      expect(currentList[0].is_explicit).toBe(true);
      expect(currentList[0].verification_status).toBe('flagged');
      expect(currentList[0].reasons).toEqual(flaggedTrack.reasons);
      expect(currentList[0].snippets).toEqual(flaggedTrack.snippets);
      expect(currentList[0].was_replaced).toBeUndefined();
    });

    it('fetches alternatives on demand via Fetch Other Matches when cached alternatives are empty', async () => {
      const user = userEvent.setup();
      const swappedWithoutCache = {
        ...cleanCandidate,
        was_replaced: true,
        verification_status: 'clean_swapped',
        is_flagged: false,
        reasons: [],
        snippets: [],
        original_track: flaggedTrack,
        original_id: flaggedTrack.id,
        original_title: flaggedTrack.title,
        clean_alternatives: [],
      };

      const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          found: true,
          clean_candidate: cleanCandidate,
          clean_alternatives: [cleanCandidate, alternateCandidate],
          lyrics_by_id: {},
        }),
      });

      render(
        <ScanTab
          playlist={{ id: 'pl_1', title: 'My Playlist', tracks: [swappedWithoutCache] }}
          setPlaylist={vi.fn()}
          scannedTracks={[swappedWithoutCache]}
          setScannedTracks={vi.fn()}
          workingList={[swappedWithoutCache]}
          setWorkingList={vi.fn()}
          lyricsByTrackId={{}}
          setLyricsByTrackId={vi.fn()}
          onOpenLyrics={vi.fn()}
          customBlocklist={[]}
          setCustomBlocklist={vi.fn()}
          preset="moderate"
          setPreset={vi.fn()}
          isAuthenticated={false}
          activePlatform="spotify"
        />
      );

      await user.click(screen.getByRole('button', { name: /Change \/ Undo|Change or undo/i }));
      const fetchBtn = screen.getByRole('button', { name: /Fetch Other Matches/i });
      await user.click(fetchBtn);

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

      expect(await screen.findByText('Explicit Hit Song (Clean Album Version)')).toBeInTheDocument();
    });

    it('renders role="alert" on Fetch Other Matches HTTP error and on empty results', async () => {
      const user = userEvent.setup();
      const swappedWithoutCache = {
        ...cleanCandidate,
        was_replaced: true,
        verification_status: 'clean_swapped',
        is_flagged: false,
        reasons: [],
        snippets: [],
        original_track: flaggedTrack,
        original_id: flaggedTrack.id,
        original_title: flaggedTrack.title,
        clean_alternatives: [],
      };

      const fetchMock = vi
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ detail: 'Catalog search unavailable' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            found: false,
            clean_candidate: null,
            clean_alternatives: [],
            lyrics_by_id: {},
          }),
        });

      render(
        <ScanTab
          playlist={{ id: 'pl_1', title: 'My Playlist', tracks: [swappedWithoutCache] }}
          setPlaylist={vi.fn()}
          scannedTracks={[swappedWithoutCache]}
          setScannedTracks={vi.fn()}
          workingList={[swappedWithoutCache]}
          setWorkingList={vi.fn()}
          lyricsByTrackId={{}}
          setLyricsByTrackId={vi.fn()}
          onOpenLyrics={vi.fn()}
          customBlocklist={[]}
          setCustomBlocklist={vi.fn()}
          preset="moderate"
          setPreset={vi.fn()}
          isAuthenticated={false}
          activePlatform="spotify"
        />
      );

      await user.click(screen.getByRole('button', { name: /Change \/ Undo|Change or undo/i }));

      // 1. HTTP error -> role="alert" with error detail
      await user.click(screen.getByRole('button', { name: /Fetch Other Matches/i }));
      expect(await screen.findByRole('alert')).toHaveTextContent(/Catalog search unavailable/i);

      // 2. Empty results -> role="alert" with no clean matches message
      await user.click(screen.getByRole('button', { name: /Fetch Other Matches/i }));
      expect(await screen.findByRole('alert')).toHaveTextContent(/No clean matches found/i);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('integrates LyricsModal swap + Other matches -> picker -> Revert to Original inside App', async () => {
      const user = userEvent.setup();
      window.innerWidth = 1024;

      vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
        if (url === '/api/spotify/status') {
          return { ok: true, json: async () => ({ authenticated: false }) };
        }
        if (url === '/api/presets') {
          return { ok: true, json: async () => ({ presets: [] }) };
        }
        if (url === '/api/catalog/search') {
          return {
            ok: true,
            json: async () => ({
              songs: [flaggedTrack],
              albums: [],
            }),
          };
        }
        if (url === '/api/replacements/find') {
          return {
            ok: true,
            json: async () => ({
              found: true,
              clean_candidate: cleanCandidate,
              clean_alternatives: [cleanCandidate, alternateCandidate],
              lyrics_by_id: { [cleanCandidate.id]: 'Clean lyrics text' },
            }),
          };
        }
        if (typeof url === 'string' && url.startsWith('/api/lyrics/')) {
          return {
            ok: true,
            json: async () => ({
              has_lyrics: true,
              lyrics: 'Some explicit lyric',
              scan_result: { is_flagged: true, reasons: ['Explicit'], snippets: [] },
            }),
          };
        }
        return { ok: true, json: async () => ({}) };
      });

      render(<App />);

      // Stage track via SmartInputBar search
      const searchInput = screen.getByPlaceholderText(/Search songs or albums/i);
      await user.type(searchInput, 'Explicit Hit Song');
      const addSongBtn = await screen.findByRole('button', { name: /Add Song Explicit Hit Song/i });
      await user.click(addSongBtn);

      // Find clean edit -> populates cleanCandidates + cleanAlternatives
      const findBtn = await screen.findByRole('button', { name: /Find Clean Edit/i });
      await user.click(findBtn);
      await screen.findByRole('button', { name: /Other matches \(2\)/i });

      // Open LyricsModal -> click Other matches (2) -> opens CleanReplacementPickerModal
      await user.click(screen.getByRole('button', { name: /View lyrics/i }));
      const lyricsDialog = await screen.findByRole('dialog');
      const modalOtherBtn = within(lyricsDialog).getByRole('button', { name: /Other matches \(2\)/i });
      await user.click(modalOtherBtn);

      // Picker opens showing both candidates; select alternate #2
      const pickerDialog = await screen.findByRole('dialog');
      expect(within(pickerDialog).getByText('Explicit Hit Song (Clean Album Version)')).toBeInTheDocument();
      const useBtns = within(pickerDialog).getAllByRole('button', { name: /Use This Match/i });
      await user.click(useBtns[useBtns.length - 1]);

      // Track is now swapped; open LyricsModal again -> click Change / Undo -> Revert to Original
      await screen.findByText('Explicit Hit Song (Clean Album Version)');
      await user.click(screen.getByRole('button', { name: /View lyrics/i }));
      const swappedLyricsDialog = await screen.findByRole('dialog');
      const modalChangeBtn = within(swappedLyricsDialog).getByRole('button', { name: /Change \/ Undo/i });
      await user.click(modalChangeBtn);

      const revertPickerDialog = await screen.findByRole('dialog');
      const revertBtn = within(revertPickerDialog).getByRole('button', { name: /Revert to Original/i });
      await user.click(revertBtn);

      // Original track title restored in workbench, and cleanCandidate restored for one-click re-swap
      const workbench = screen.getByRole('region', { name: /Working List Workbench/i });
      expect(await within(workbench).findByText('Explicit Hit Song')).toBeInTheDocument();
      expect(within(workbench).getByRole('button', { name: /Swap to Clean/i })).toBeInTheDocument();
    });
  });
});
