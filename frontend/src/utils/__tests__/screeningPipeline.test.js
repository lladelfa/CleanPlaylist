import { describe, it, expect, vi, beforeEach } from 'vitest';
import { chunkTracks, runScreeningPipeline, runBulkCleanPipeline } from '../screeningPipeline';

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

  describe('runBulkCleanPipeline', () => {
    it('returns empty results when given empty tracks', async () => {
      const result = await runBulkCleanPipeline({ tracks: [] });
      expect(result).toEqual({ results: {}, lyricsById: {} });
    });

    it('chunks tracks into batches of <= 10, calls POST /api/replacements/find-batch, and aggregates results', async () => {
      const tracks = Array.from({ length: 15 }, (_, i) => ({
        id: `trk_${i}`,
        title: `Explicit Song ${i}`,
        artist: 'Artist',
        duration_seconds: 180,
      }));

      const progressUpdates = [];
      const batchStarts = [];
      const batchCompletes = [];

      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(async (url, options) => {
        callCount++;
        expect(url).toBe('/api/replacements/find-batch');
        const body = JSON.parse(options.body);
        expect(body.platform).toBe('spotify');
        expect(body.tracks.length).toBeLessThanOrEqual(10);

        const results = {};
        const lyricsById = {};
        body.tracks.forEach((t, idx) => {
          if (idx % 2 === 0) {
            results[t.id] = {
              id: `clean_${t.id}`,
              title: `${t.title} (Clean)`,
              artist: t.artist,
              duration_seconds: 180,
              is_explicit: false,
            };
            lyricsById[`clean_${t.id}`] = `Clean lyrics for ${t.id}`;
          } else {
            results[t.id] = null;
          }
        });

        return {
          ok: true,
          json: async () => ({ results, lyrics_by_id: lyricsById }),
        };
      });

      const outcome = await runBulkCleanPipeline({
        tracks,
        platform: 'spotify',
        onProgress: (p) => progressUpdates.push(p),
        onBatchStart: (b) => batchStarts.push(b),
        onBatchComplete: (b) => batchCompletes.push(b),
      });

      expect(callCount).toBe(2);
      expect(batchStarts).toHaveLength(2);
      expect(batchStarts[0]).toHaveLength(10);
      expect(batchStarts[1]).toHaveLength(5);

      expect(progressUpdates).toHaveLength(2);
      expect(progressUpdates[0]).toEqual({
        processed: 10,
        total: 15,
        announcement: 'Finding clean edits (10 of 15)…',
      });
      expect(progressUpdates[1]).toEqual({
        processed: 15,
        total: 15,
        announcement: 'Finding clean edits (15 of 15)…',
      });

      expect(batchCompletes).toHaveLength(2);
      expect(Object.keys(outcome.results)).toHaveLength(15);
      expect(outcome.results['trk_0'].title).toBe('Explicit Song 0 (Clean)');
      expect(outcome.results['trk_1']).toBeNull();
      expect(outcome.lyricsById['clean_trk_0']).toBe('Clean lyrics for trk_0');
    });

    it('halts cleanly on HTTP 429 rate limit, preserves already-completed results, and reports error', async () => {
      const tracks = Array.from({ length: 15 }, (_, i) => ({
        id: `trk_${i}`,
        title: `Song ${i}`,
        artist: 'Artist',
        duration_seconds: 180,
      }));

      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(async (url, options) => {
        callCount++;
        const body = JSON.parse(options.body);
        if (callCount === 1) {
          const results = {};
          body.tracks.forEach((t) => {
            results[t.id] = { id: `clean_${t.id}`, title: `${t.title} (Clean)` };
          });
          return {
            ok: true,
            json: async () => ({ results, lyrics_by_id: {} }),
          };
        }
        return {
          ok: false,
          status: 429,
          json: async () => ({ detail: 'Rate limit reached' }),
        };
      });

      const errors = [];
      const outcome = await runBulkCleanPipeline({
        tracks,
        platform: 'spotify',
        onError: (err) => errors.push(err),
      });

      expect(callCount).toBe(2);
      expect(errors).toHaveLength(1);
      expect(errors[0].status).toBe(429);
      expect(errors[0].isRateLimit).toBe(true);

      // Crucial: results from chunk 1 are preserved
      expect(Object.keys(outcome.results)).toHaveLength(10);
      expect(outcome.results['trk_0'].id).toBe('clean_trk_0');
      expect(outcome.error).toBeDefined();
      expect(outcome.unprocessedTracks).toHaveLength(5);
    });

    it('aborts cleanly when AbortSignal is triggered', async () => {
      const tracks = Array.from({ length: 20 }, (_, i) => ({
        id: `trk_${i}`,
        title: `Song ${i}`,
        artist: 'Artist',
        duration_seconds: 180,
      }));

      const controller = new AbortController();
      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(async (url, options) => {
        callCount++;
        // Abort after first chunk
        controller.abort();
        const body = JSON.parse(options.body);
        const results = {};
        body.tracks.forEach((t) => {
          results[t.id] = { id: `clean_${t.id}`, title: `${t.title} (Clean)` };
        });
        return {
          ok: true,
          json: async () => ({ results, lyrics_by_id: {} }),
        };
      });

      const outcome = await runBulkCleanPipeline({
        tracks,
        signal: controller.signal,
      });

      expect(callCount).toBe(1);
      expect(outcome.error).toBeDefined();
      expect(outcome.error.name).toBe('AbortError');
      expect(Object.keys(outcome.results)).toHaveLength(10);
      expect(outcome.unprocessedTracks).toHaveLength(10);
    });

    it('safely handles user callback exceptions without crashing pipeline', async () => {
      const tracks = [{ id: 'trk_0', title: 'Song 0', artist: 'Artist' }];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: { trk_0: { id: 'clean_0', title: 'Clean 0' } },
          lyrics_by_id: {},
        }),
      });

      const throwingFn = () => {
        throw new Error('Callback failed');
      };

      const outcome = await runBulkCleanPipeline({
        tracks,
        onProgress: throwingFn,
        onBatchComplete: throwingFn,
        onBatchStart: throwingFn,
      });

      expect(outcome.results['trk_0'].id).toBe('clean_0');
    });
  });
});
