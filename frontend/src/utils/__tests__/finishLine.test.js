import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getReadyTracks,
  extractYouTubeVideoIds,
  buildYouTubeWatchVideosUrl,
  launchYouTubeCleanQueue,
} from '../finishLine';

describe('Story 3.4: Universal YouTube Clean Queue Generation & finishLine utility', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('getReadyTracks', () => {
    it('returns empty array when given empty or null inputs', () => {
      expect(getReadyTracks(null)).toEqual([]);
      expect(getReadyTracks(undefined)).toEqual([]);
      expect(getReadyTracks([])).toEqual([]);
    });

    it('identifies verified_clean and clean_swapped tracks as ready', () => {
      const tracks = [
        { id: 't1', title: 'Song 1', verification_status: 'verified_clean' },
        { id: 't2', title: 'Song 2', verification_status: 'clean_swapped' },
        { id: 't3', title: 'Song 3', verification_status: 'flagged' },
        { id: 't4', title: 'Song 4', verification_status: 'unscanned' },
        { id: 't5', title: 'Song 5', verification_status: 'lyrics_unavailable' },
      ];

      const ready = getReadyTracks(tracks);
      expect(ready.map((t) => t.id)).toEqual(['t1', 't2']);
    });

    it('includes kept flagged tracks when in keptTrackIds (Set or Array)', () => {
      const tracks = [
        { id: 't1', title: 'Song 1', verification_status: 'flagged' },
        { id: 't2', title: 'Song 2', verification_status: 'flagged' },
        { id: 't3', title: 'Song 3', verification_status: 'verified_clean' },
      ];

      // Set support
      const readyWithSet = getReadyTracks(tracks, new Set(['t1']));
      expect(readyWithSet.map((t) => t.id)).toEqual(['t1', 't3']);

      // Array support
      const readyWithArray = getReadyTracks(tracks, ['t2']);
      expect(readyWithArray.map((t) => t.id)).toEqual(['t2', 't3']);
    });
  });

  describe('extractYouTubeVideoIds', () => {
    it('extracts native IDs in ytmusic mode including Shorts URLs', () => {
      const readyTracks = [
        { id: 'vid1', title: 'Track 1' },
        { id: 'vid2', title: 'Track 2', video_id: 'vid2_alt' },
        { id: '', title: 'Track 3', video_url: 'https://music.youtube.com/watch?v=vid3' },
        { id: '', title: 'Track 4', video_url: 'https://www.youtube.com/shorts/vid4' },
      ];

      const { videoIds, omittedCount, totalReady } = extractYouTubeVideoIds(readyTracks, 'ytmusic');
      expect(videoIds).toEqual(['vid1', 'vid2_alt', 'vid3', 'vid4']);
      expect(omittedCount).toBe(0);
      expect(totalReady).toBe(4);
    });

    it('extracts ytmusic_video_id in spotify mode and counts omitted tracks lacking YouTube link', () => {
      const readyTracks = [
        { id: 'sp1', title: 'Track 1', ytmusic_video_id: 'yt_1' },
        { id: 'sp2', title: 'Track 2' }, // Missing YouTube counterpart
        { id: 'sp3', title: 'Track 3', ytmusic_video_id: 'yt_3' },
      ];

      const { videoIds, omittedCount, totalReady } = extractYouTubeVideoIds(readyTracks, 'spotify');
      expect(videoIds).toEqual(['yt_1', 'yt_3']);
      expect(omittedCount).toBe(1);
      expect(totalReady).toBe(3);
    });

    it('caps extracted video IDs at 50 and includes excess in omittedCount', () => {
      const readyTracks = Array.from({ length: 60 }, (_, i) => ({
        id: `sp_${i}`,
        title: `Track ${i}`,
        ytmusic_video_id: `yt_${i}`,
      }));

      const { videoIds, omittedCount, totalReady } = extractYouTubeVideoIds(readyTracks, 'spotify');
      expect(videoIds).toHaveLength(50);
      expect(videoIds[0]).toBe('yt_0');
      expect(videoIds[49]).toBe('yt_49');
      expect(omittedCount).toBe(10);
      expect(totalReady).toBe(60);
    });
  });

  describe('buildYouTubeWatchVideosUrl', () => {
    it('formats watch_videos URL with comma-separated IDs and URI encodes special characters', () => {
      expect(buildYouTubeWatchVideosUrl(['idA', 'idB', 'idC'])).toBe(
        'https://www.youtube.com/watch_videos?video_ids=idA,idB,idC'
      );
      expect(buildYouTubeWatchVideosUrl(['id with space', 'id#hash'])).toBe(
        'https://www.youtube.com/watch_videos?video_ids=id%20with%20space,id%23hash'
      );
    });

    it('returns null for empty videoIds', () => {
      expect(buildYouTubeWatchVideosUrl([])).toBeNull();
      expect(buildYouTubeWatchVideosUrl(null)).toBeNull();
    });
  });

  describe('launchYouTubeCleanQueue', () => {
    it('opens clean queue in a new tab and fires telemetry on valid YouTube playback', () => {
      const readyTracks = [
        { id: 'v1', title: 'Clean Song 1', verification_status: 'verified_clean' },
        { id: 'v2', title: 'Clean Song 2', verification_status: 'clean_swapped' },
      ];

      const openSpy = vi.spyOn(window, 'open').mockReturnValue({});
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true });
      const onNotice = vi.fn();

      const result = launchYouTubeCleanQueue({
        readyTracks,
        platform: 'ytmusic',
        onNotice,
      });

      expect(result.success).toBe(true);
      expect(result.videoIds).toEqual(['v1', 'v2']);
      expect(openSpy).toHaveBeenCalledWith(
        'https://www.youtube.com/watch_videos?video_ids=v1,v2',
        '_blank',
        'noopener,noreferrer'
      );
      expect(onNotice).not.toHaveBeenCalled();

      // Telemetry emission
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/telemetry/event',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"play_clean_queue"'),
        })
      );
    });

    it('launches resolved IDs and surfaces amber NoticeBanner when spotify tracks are omitted', () => {
      const readyTracks = [
        { id: 'sp1', title: 'Song 1', ytmusic_video_id: 'yt_1', verification_status: 'verified_clean' },
        { id: 'sp2', title: 'Song 2', verification_status: 'clean_swapped' }, // Missing yt link
        { id: 'sp3', title: 'Song 3', verification_status: 'verified_clean' }, // Missing yt link
      ];

      const openSpy = vi.spyOn(window, 'open').mockReturnValue({});
      const onNotice = vi.fn();

      const result = launchYouTubeCleanQueue({
        readyTracks,
        platform: 'spotify',
        onNotice,
      });

      expect(result.success).toBe(true);
      expect(result.videoIds).toEqual(['yt_1']);
      expect(result.omittedCount).toBe(2);
      expect(openSpy).toHaveBeenCalledWith(
        'https://www.youtube.com/watch_videos?video_ids=yt_1',
        '_blank',
        'noopener,noreferrer'
      );

      expect(onNotice).toHaveBeenCalledWith({
        type: 'caution',
        message: '2 tracks were omitted from the queue due to missing YouTube links.',
      });
    });

    it('blocks opening a broken URL and surfaces caution banner when 0 ready tracks resolve in spotify mode', () => {
      const readyTracks = [
        { id: 'sp1', title: 'Song 1', verification_status: 'verified_clean' }, // No ytmusic_video_id
      ];

      const openSpy = vi.spyOn(window, 'open').mockReturnValue({});
      const onNotice = vi.fn();

      const result = launchYouTubeCleanQueue({
        readyTracks,
        platform: 'spotify',
        onNotice,
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('no_resolved_ids');
      expect(openSpy).not.toHaveBeenCalled();

      expect(onNotice).toHaveBeenCalledWith({
        type: 'caution',
        message: 'No YouTube playback links found. Run lyric scan first to resolve playback links.',
      });
    });

    it('surfaces popup blocked caution notice when window.open returns null', () => {
      const readyTracks = [
        { id: 'v1', title: 'Song 1', verification_status: 'verified_clean' },
      ];

      vi.spyOn(window, 'open').mockReturnValue(null);
      const onNotice = vi.fn();

      const result = launchYouTubeCleanQueue({
        readyTracks,
        platform: 'ytmusic',
        onNotice,
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('popup_blocked');
      expect(onNotice).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'caution',
          message: expect.stringContaining('Popup was blocked'),
        })
      );
    });

    it('does not open window when readyTracks is empty', () => {
      const openSpy = vi.spyOn(window, 'open').mockReturnValue({});
      const onNotice = vi.fn();

      const result = launchYouTubeCleanQueue({
        readyTracks: [],
        platform: 'ytmusic',
        onNotice,
      });

      expect(result.success).toBe(false);
      expect(openSpy).not.toHaveBeenCalled();
    });
  });
});
