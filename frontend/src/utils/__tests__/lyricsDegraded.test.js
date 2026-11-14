import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isLyricsServiceDegraded,
  runScreeningPipeline,
  runStitchPreScreeningPipeline,
} from '../screeningPipeline';
import { reevaluateTracks } from '../lyricEvaluator';

const okJson = (body) => ({ ok: true, json: async () => body });

describe('Story 7.7: lyrics degraded signal', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('isLyricsServiceDegraded is true only when more than half of tracks are upstream_error', () => {
    const mk = (...l) => l.map((lyrics_lookup, i) => ({ id: `t${i}`, lyrics_lookup }));
    expect(isLyricsServiceDegraded(mk('upstream_error', 'upstream_error', 'found'))).toBe(true);
    expect(isLyricsServiceDegraded(mk('upstream_error', 'found'))).toBe(false);
    expect(isLyricsServiceDegraded(mk('not_found', 'not_found'))).toBe(false);
    expect(isLyricsServiceDegraded([])).toBe(false);
    expect(isLyricsServiceDegraded(null)).toBe(false);
  });

  it('runScreeningPipeline reports lyricsServiceDegraded from the backend summary flag', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      okJson({
        tracks: [{ id: 'a', verification_status: 'lyrics_unavailable', lyrics_lookup: 'upstream_error' }],
        summary: { lyrics_service_degraded: true },
        lyrics_by_id: {},
      })
    );
    const result = await runScreeningPipeline({ tracks: [{ id: 'a', title: 'A', artist: 'X' }], preset: 'moderate' });
    expect(result.lyricsServiceDegraded).toBe(true);
    expect(result.tracks[0].lyrics_lookup).toBe('upstream_error');
  });

  it('runScreeningPipeline reports not degraded when tracks are healthy', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      okJson({ tracks: [{ id: 'a', verification_status: 'verified_clean', lyrics_lookup: 'found' }], summary: {}, lyrics_by_id: {} })
    );
    const result = await runScreeningPipeline({ tracks: [{ id: 'a', title: 'A', artist: 'X' }], preset: 'moderate' });
    expect(result.lyricsServiceDegraded).toBe(false);
  });

  it('stitch pre-screen re-scans screened tracks whose lyrics_lookup is upstream_error and skips the rest', async () => {
    const sentIds = [];
    global.fetch = vi.fn().mockImplementation(async (url, opts) => {
      if (url.includes('/api/scan/playlist')) {
        const body = JSON.parse(opts.body);
        sentIds.push(...body.tracks.map((t) => t.id));
        return okJson({
          tracks: body.tracks.map((t) => ({ ...t, verification_status: 'verified_clean', is_flagged: false, lyrics_lookup: 'found' })),
          summary: { lyrics_service_degraded: false },
          lyrics_by_id: {},
        });
      }
      return okJson({});
    });
    const pool = [
      {
        id: 'pl',
        title: 'P',
        type: 'playlist',
        tracks: [
          { id: 'ok', title: 'Ok', artist: 'A', verification_status: 'verified_clean', is_flagged: false, lyrics_lookup: 'found' },
          { id: 'bad', title: 'Bad', artist: 'A', verification_status: 'lyrics_unavailable', is_flagged: false, lyrics_lookup: 'upstream_error' },
        ],
      },
    ];
    const result = await runStitchPreScreeningPipeline({ playlistPool: pool, cleanMode: 'keep_all', platform: 'ytmusic', preset: 'moderate' });
    expect(sentIds).toEqual(['bad']);
    expect(result.lyricsServiceDegraded).toBe(false);
  });

  it('stitch pre-screen reports lyricsServiceDegraded when the scan response says so', async () => {
    global.fetch = vi.fn().mockImplementation(async (url, opts) => {
      if (url.includes('/api/scan/playlist')) {
        const body = JSON.parse(opts.body);
        return okJson({
          tracks: body.tracks.map((t) => ({ ...t, verification_status: 'lyrics_unavailable', is_flagged: false, lyrics_lookup: 'upstream_error' })),
          summary: { lyrics_service_degraded: true },
          lyrics_by_id: {},
        });
      }
      return okJson({});
    });
    const pool = [{ id: 'pl', title: 'P', type: 'playlist', tracks: [{ id: 'a', title: 'A', artist: 'X' }] }];
    const result = await runStitchPreScreeningPipeline({ playlistPool: pool, cleanMode: 'keep_all', platform: 'ytmusic', preset: 'moderate' });
    expect(result.lyricsServiceDegraded).toBe(true);
  });

  it('re-evaluation preserves each track lyrics_lookup value', () => {
    const tracks = [
      { id: 'a', title: 'A', artist: 'X', lyrics_lookup: 'upstream_error', verification_status: 'lyrics_unavailable' },
      { id: 'b', title: 'B', artist: 'X', lyrics_lookup: 'found', verification_status: 'verified_clean' },
      { id: 'c', title: 'C', artist: 'X', lyrics_lookup: 'not_found', verification_status: 'lyrics_unavailable' },
    ];
    const { tracks: out } = reevaluateTracks(tracks, { lyricsByTrackId: { b: 'sunshine' }, preset: 'kid_safe' });
    expect(out.map((t) => t.lyrics_lookup)).toEqual(['upstream_error', 'found', 'not_found']);
    expect(out[0].verification_status).not.toBe('verified_clean');
  });
});
