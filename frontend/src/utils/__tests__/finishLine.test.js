import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isTrackReady,
  getReadyTracks,
  extractYouTubeVideoIds,
  buildYouTubeWatchVideosUrl,
  launchYouTubeCleanQueue,
  getTrackCanonicalUrl,
  formatCleanTrackLinks,
  copyCleanTrackLinks,
  exportCleanPlaylistFile,
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

  describe('Story 3.5: Clean Track Deep Links, Clipboard Copy, & Offline Exports', () => {
    describe('isTrackReady', () => {
      it('returns false for null or non-object track', () => {
        expect(isTrackReady(null)).toBe(false);
        expect(isTrackReady(undefined)).toBe(false);
        expect(isTrackReady('not an object')).toBe(false);
      });

      it('returns true for verified_clean or clean_swapped or was_replaced tracks', () => {
        expect(isTrackReady({ id: 't1', verification_status: 'verified_clean' })).toBe(true);
        expect(isTrackReady({ id: 't2', verification_status: 'clean_swapped' })).toBe(true);
        expect(isTrackReady({ id: 't3', was_replaced: true })).toBe(true);
      });

      it('returns true if track is in keptTrackIds Set or Array', () => {
        expect(isTrackReady({ id: 't4', verification_status: 'flagged' }, new Set(['t4']))).toBe(true);
        expect(isTrackReady({ id: 't5', verification_status: 'flagged' }, ['t5'])).toBe(true);
        expect(isTrackReady({ id: 't6', verification_status: 'flagged' }, new Set(['other']))).toBe(false);
      });
    });

    describe('getTrackCanonicalUrl', () => {
      it('returns null for null or missing track', () => {
        expect(getTrackCanonicalUrl(null)).toBeNull();
        expect(getTrackCanonicalUrl({})).toBeNull();
      });

      it('constructs Spotify track URL stripping spotify:track: prefix', () => {
        expect(getTrackCanonicalUrl({ id: 'spotify:track:4cOdK2wGLETKBW3PvgPWqT' }, 'spotify')).toBe(
          'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT'
        );
        expect(getTrackCanonicalUrl({ id: '4cOdK2wGLETKBW3PvgPWqT' }, 'spotify')).toBe(
          'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT'
        );
      });

      it('preserves existing open.spotify.com video_url', () => {
        expect(
          getTrackCanonicalUrl(
            { id: '123', video_url: 'https://open.spotify.com/track/canonical123' },
            'spotify'
          )
        ).toBe('https://open.spotify.com/track/canonical123');
      });

      it('constructs YouTube Music track URL using id, video_id, or parsed video_url', () => {
        expect(getTrackCanonicalUrl({ id: 'xyz789' }, 'ytmusic')).toBe(
          'https://music.youtube.com/watch?v=xyz789'
        );
        expect(getTrackCanonicalUrl({ id: '', video_id: 'vid123' }, 'ytmusic')).toBe(
          'https://music.youtube.com/watch?v=vid123'
        );
        expect(
          getTrackCanonicalUrl(
            { id: '', video_url: 'https://music.youtube.com/watch?v=customUrl' },
            'ytmusic'
          )
        ).toBe('https://music.youtube.com/watch?v=customUrl');
      });
    });

    describe('formatCleanTrackLinks', () => {
      it('joins canonical URLs with newline and zero trailing whitespace', () => {
        const readyTracks = [
          { id: 'sp1', title: 'Song 1' },
          { id: 'sp2', title: 'Song 2' },
        ];
        const formatted = formatCleanTrackLinks(readyTracks, 'spotify');
        expect(formatted).toBe(
          'https://open.spotify.com/track/sp1\nhttps://open.spotify.com/track/sp2'
        );
        expect(formatted.endsWith('\n')).toBe(false);
      });

      it('returns empty string when readyTracks is empty', () => {
        expect(formatCleanTrackLinks([], 'spotify')).toBe('');
        expect(formatCleanTrackLinks(null, 'spotify')).toBe('');
      });
    });

    describe('copyCleanTrackLinks', () => {
      it('writes formatted URLs to clipboard and announces confirmation notice', async () => {
        const readyTracks = [
          { id: 'sp1', title: 'Song 1' },
          { id: 'sp2', title: 'Song 2' },
        ];
        const writeTextMock = vi.fn().mockResolvedValue(undefined);
        const onNotice = vi.fn();
        const fetchMock = vi.fn().mockResolvedValue({ ok: true });
        global.fetch = fetchMock;

        const result = await copyCleanTrackLinks({
          readyTracks,
          platform: 'spotify',
          onNotice,
          clipboard: { writeText: writeTextMock },
        });

        expect(result.success).toBe(true);
        expect(result.count).toBe(2);
        expect(writeTextMock).toHaveBeenCalledWith(
          'https://open.spotify.com/track/sp1\nhttps://open.spotify.com/track/sp2'
        );
        expect(onNotice).toHaveBeenCalledWith({
          type: 'success',
          message: 'Copied 2 Clean Track Links',
        });
        expect(fetchMock).toHaveBeenCalledWith(
          '/api/telemetry/event',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('"action":"copy_clean_links"'),
          })
        );
      });

      it('handles empty ready tracks with caution notice', async () => {
        const onNotice = vi.fn();
        const writeTextMock = vi.fn();

        const result = await copyCleanTrackLinks({
          readyTracks: [],
          platform: 'spotify',
          onNotice,
          clipboard: { writeText: writeTextMock },
        });

        expect(result.success).toBe(false);
        expect(writeTextMock).not.toHaveBeenCalled();
        expect(onNotice).toHaveBeenCalledWith({
          type: 'caution',
          message: 'No ready tracks available to copy.',
        });
      });

      it('surfaces caution notice when clipboard writing fails', async () => {
        const readyTracks = [{ id: 'sp1', title: 'Song 1' }];
        const writeTextMock = vi.fn().mockRejectedValue(new Error('Permission denied'));
        const onNotice = vi.fn();

        const result = await copyCleanTrackLinks({
          readyTracks,
          platform: 'spotify',
          onNotice,
          clipboard: { writeText: writeTextMock },
        });

        expect(result.success).toBe(false);
        expect(onNotice).toHaveBeenCalledWith({
          type: 'caution',
          message: 'Failed to copy links to clipboard.',
        });
      });
    });

    describe('exportCleanPlaylistFile', () => {
      it('POSTs /api/export and triggers file download', async () => {
        const readyTracks = [{ id: 'sp1', title: 'Song 1' }];
        const mockBlob = new Blob(['sample,csv'], { type: 'text/csv' });
        const fetchFn = vi.fn().mockResolvedValue({
          ok: true,
          blob: vi.fn().mockResolvedValue(mockBlob),
          headers: new Headers({
            'Content-Disposition': 'attachment; filename="CleanPlaylist.csv"',
          }),
        });
        const onNotice = vi.fn();

        const appendChildSpy = vi.spyOn(document.body, 'appendChild');
        const removeChildSpy = vi.spyOn(document.body, 'removeChild');
        globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
        globalThis.URL.revokeObjectURL = vi.fn();

        const result = await exportCleanPlaylistFile({
          readyTracks,
          format: 'csv',
          playlistTitle: 'CleanPlaylist',
          platform: 'spotify',
          onNotice,
          fetchFn,
        });

        expect(result.success).toBe(true);
        expect(fetchFn).toHaveBeenCalledWith(
          '/api/export',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({
              tracks: readyTracks,
              format: 'csv',
              playlist_title: 'CleanPlaylist',
              platform: 'spotify',
            }),
          })
        );
        expect(globalThis.URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
        expect(appendChildSpy).toHaveBeenCalled();
        expect(removeChildSpy).toHaveBeenCalled();
        expect(onNotice).toHaveBeenCalledWith({
          type: 'success',
          message: 'Exported Clean Playlist successfully',
        });
      });

      it('surfaces error notice when export API fails', async () => {
        const fetchFn = vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          json: vi.fn().mockResolvedValue({ detail: 'Export failed' }),
        });
        const onNotice = vi.fn();

        const result = await exportCleanPlaylistFile({
          readyTracks: [{ id: 'sp1' }],
          format: 'm3u8',
          onNotice,
          fetchFn,
        });

        expect(result.success).toBe(false);
        expect(onNotice).toHaveBeenCalledWith({
          type: 'caution',
          message: 'Export failed. Please try again.',
        });
      });
    });
  });
});
