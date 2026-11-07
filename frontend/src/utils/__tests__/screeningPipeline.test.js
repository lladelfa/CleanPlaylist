import { describe, it, expect, vi, beforeEach } from 'vitest';
import { chunkTracks, runScreeningPipeline } from '../screeningPipeline';

describe('screeningPipeline utility', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('chunkTracks', () => {
    it('returns empty array when given empty tracks', () => {
      expect(chunkTracks([])).toEqual([]);
    });

    it('returns single chunk when tracks <= 10', () => {
      const tracks = Array.from({ length: 8 }, (_, i) => ({ id: `trk_${i}` }));
      const chunks = chunkTracks(tracks);
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toHaveLength(8);
    });

    it('chunks tracks into initial <= 10 and subsequent <= 15 for 25 tracks', () => {
      const tracks = Array.from({ length: 25 }, (_, i) => ({ id: `trk_${i}` }));
      const chunks = chunkTracks(tracks);
      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toHaveLength(10);
      expect(chunks[1]).toHaveLength(15);
    });

    it('chunks tracks into 10, 15, 15 for 40 tracks', () => {
      const tracks = Array.from({ length: 40 }, (_, i) => ({ id: `trk_${i}` }));
      const chunks = chunkTracks(tracks);
      expect(chunks).toHaveLength(3);
      expect(chunks[0]).toHaveLength(10);
      expect(chunks[1]).toHaveLength(15);
      expect(chunks[2]).toHaveLength(15);
    });

    it('guards against invalid subsequentSize <= 0 by returning single array with all tracks', () => {
      const tracks = Array.from({ length: 12 }, (_, i) => ({ id: `trk_${i}` }));
      const chunks = chunkTracks(tracks, 10, 0);
      expect(chunks).toEqual([tracks]);

      const chunksNeg = chunkTracks(tracks, 10, -5);
      expect(chunksNeg).toEqual([tracks]);
    });
  });

  describe('runScreeningPipeline', () => {
    it('progressively scans chunks, calls onBatchStart, onProgress with announcements, and aggregates lyrics', async () => {
      const tracks = Array.from({ length: 25 }, (_, i) => ({
        id: `trk_${i}`,
        title: `Song ${i}`,
        artist: 'Artist',
        duration_seconds: 180,
      }));

      const startedBatches = [];
      const progressUpdates = [];
      const batchResults = [];

      // Mock fetch
      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(async (url, options) => {
        callCount++;
        const body = JSON.parse(options.body);
        const batchTracks = body.tracks.map((t) => ({
          ...t,
          verification_status: 'verified_clean',
          is_flagged: false,
          has_lyrics: true,
          total_flagged_count: 0,
        }));
        const lyricsById = {};
        body.tracks.forEach((t) => {
          lyricsById[t.id] = `Lyrics for ${t.id}`;
        });

        return {
          ok: true,
          json: async () => ({
            tracks: batchTracks,
            summary: {
              total_tracks: batchTracks.length,
              flagged_tracks: 0,
              clean_tracks: batchTracks.length,
            },
            lyrics_by_id: lyricsById,
          }),
        };
      });

      const result = await runScreeningPipeline({
        tracks,
        preset: 'moderate',
        customBlocklist: ['bad'],
        platform: 'spotify',
        onBatchStart: (b) => startedBatches.push(b),
        onProgress: (p) => progressUpdates.push(p),
        onBatchComplete: (b) => batchResults.push(b),
      });

      expect(callCount).toBe(2);
      expect(startedBatches).toHaveLength(2);
      expect(startedBatches[0]).toHaveLength(10);
      expect(startedBatches[1]).toHaveLength(15);

      expect(progressUpdates).toHaveLength(2);
      expect(progressUpdates[0]).toEqual({
        scanned: 10,
        total: 25,
        announcement: 'Scanned 10 of 25 tracks',
      });
      expect(progressUpdates[1]).toEqual({
        scanned: 25,
        total: 25,
        announcement: 'Scanned 25 of 25 tracks',
      });

      expect(batchResults).toHaveLength(2);
      expect(batchResults[0].tracks).toHaveLength(10);
      expect(batchResults[1].tracks).toHaveLength(15);

      expect(result.tracks).toHaveLength(25);
      expect(Object.keys(result.lyricsById)).toHaveLength(25);
      expect(result.lyricsById['trk_0']).toBe('Lyrics for trk_0');
    });

    it('handles HTTP error status gracefully with complete scan envelope fallback fields', async () => {
      const tracks = Array.from({ length: 5 }, (_, i) => ({
        id: `trk_${i}`,
        title: `Song ${i}`,
      }));

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ detail: 'Backend scanning failed' }),
      });

      const errors = [];
      const result = await runScreeningPipeline({
        tracks,
        preset: 'moderate',
        platform: 'ytmusic',
        onError: (err) => errors.push(err),
      });

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('Backend scanning failed');
      expect(result.tracks).toHaveLength(5);
      const fallbackTrack = result.tracks[0];
      expect(fallbackTrack.verification_status).toBe('scan_error');
      expect(fallbackTrack.is_flagged).toBe(false);
      expect(fallbackTrack.detected_terms).toEqual([]);
      expect(fallbackTrack.snippets).toEqual([]);
      expect(fallbackTrack.total_flagged_count).toBe(0);
      expect(fallbackTrack.has_lyrics).toBe(false);
    });

    it('handles network fetch exceptions (TypeError) and preserves envelope fields', async () => {
      const tracks = [{ id: 'net_fail_1', title: 'Network Drop' }];

      global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

      const errors = [];
      const result = await runScreeningPipeline({
        tracks,
        onError: (err) => errors.push(err),
      });

      expect(errors).toHaveLength(1);
      expect(errors[0]).toBeInstanceOf(TypeError);
      expect(result.tracks).toHaveLength(1);
      const fallback = result.tracks[0];
      expect(fallback.verification_status).toBe('scan_error');
      expect(fallback.is_flagged).toBe(false);
      expect(fallback.detected_terms).toEqual([]);
      expect(fallback.snippets).toEqual([]);
      expect(fallback.total_flagged_count).toBe(0);
      expect(fallback.has_lyrics).toBe(false);
      expect(fallback.reasons).toEqual(['Failed to fetch']);
    });

    it('safely handles exceptions thrown inside user consumer callbacks without duplicating tracks', async () => {
      const tracks = [{ id: 'cb_err_1', title: 'Throwing Callback' }];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          tracks: [{ id: 'cb_err_1', verification_status: 'verified_clean' }],
          summary: { total_tracks: 1, flagged_tracks: 0, clean_tracks: 1 },
          lyrics_by_id: {},
        }),
      });

      const throwingCallback = () => {
        throw new Error('Consumer UI crashed');
      };

      const result = await runScreeningPipeline({
        tracks,
        onProgress: throwingCallback,
        onBatchComplete: throwingCallback,
      });

      // Crucial: consumer callback crash does not result in duplicate fallback tracks
      expect(result.tracks).toHaveLength(1);
      expect(result.tracks[0].verification_status).toBe('verified_clean');
    });
  });
});
