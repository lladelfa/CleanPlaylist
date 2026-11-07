import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DEFAULT_PRESET_PROFILES,
  DEFAULT_WORD_CATEGORIES,
  DEFAULT_SUFFIX_PATTERN,
  compileTermPattern,
  evaluateLyrics,
  evaluateTrack,
  reevaluateTracks,
  sendScanCompletedTelemetry,
  searchLyricsKeywords,
} from '../lyricEvaluator';

describe('lyricEvaluator', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Default Presets and Categories', () => {
    it('provides canonical preset profiles and word categories', () => {
      expect(DEFAULT_PRESET_PROFILES).toHaveProperty('kid_safe');
      expect(DEFAULT_PRESET_PROFILES).toHaveProperty('moderate');
      expect(DEFAULT_PRESET_PROFILES).toHaveProperty('slurs_only');
      expect(DEFAULT_PRESET_PROFILES).toHaveProperty('custom');

      expect(DEFAULT_WORD_CATEGORIES).toHaveProperty('slurs');
      expect(DEFAULT_WORD_CATEGORIES).toHaveProperty('strong_profanity');
      expect(DEFAULT_WORD_CATEGORIES).toHaveProperty('mild_profanity');
      expect(DEFAULT_WORD_CATEGORIES).toHaveProperty('sexual');
      expect(DEFAULT_WORD_CATEGORIES).toHaveProperty('substances');

      expect(DEFAULT_SUFFIX_PATTERN).toBe('(?:ing|ed|s|es)?');
    });
  });

  describe('compileTermPattern & Morphological Suffixes', () => {
    it('matches root word case-insensitively with whole word boundaries', () => {
      const regex = compileTermPattern('fuck');
      expect(regex.test('This is fuck')).toBe(true);
      expect(regex.test('FUCK that')).toBe(true);
      // boundary check
      expect(regex.test('unfuckingbelievable')).toBe(false);
    });

    it('matches morphological suffixes for roots ending in consonants (ing, ed, s, es)', () => {
      const regex = compileTermPattern('bitch');
      expect(regex.test('She is bitching')).toBe(true);
      expect(regex.test('All the bitches')).toBe(true);
      expect(regex.test('bitched')).toBe(true);
    });

    it('matches root and morphological suffixes (ing, ed, s, es) without matching truncated word stems', () => {
      const regex = compileTermPattern('coke');
      expect(regex.test('cokes')).toBe(true);
      expect(regex.test('coke')).toBe(true);
      expect(regex.test('cok')).toBe(false);
    });

    it('does not falsely match substrings in unrelated words', () => {
      const regex = compileTermPattern('ass');
      expect(regex.test('classic')).toBe(false);
      expect(regex.test('pass')).toBe(false);
      expect(regex.test('grass')).toBe(false);
      expect(regex.test('ass')).toBe(true);
      expect(regex.test('asses')).toBe(true);
    });
  });

  describe('evaluateLyrics', () => {
    it('returns empty results and has_lyrics: false when lyrics are empty', () => {
      const result = evaluateLyrics('', { preset: 'moderate', isMetadataExplicit: false });
      expect(result.has_lyrics).toBe(false);
      expect(result.is_flagged).toBe(false);
      expect(result.detected_terms).toEqual([]);
      expect(result.total_flagged_count).toBe(0);
      expect(result.snippets).toEqual([]);
    });

    it('flags explicit metadata when lyrics are empty and preset checks metadata', () => {
      const result = evaluateLyrics('', {
        preset: 'moderate',
        isMetadataExplicit: true,
        platform: 'spotify',
      });
      expect(result.has_lyrics).toBe(false);
      expect(result.is_flagged).toBe(true);
      expect(result.reasons).toContain('Marked Explicit by Spotify');
      expect(result.reasons).toContain('Lyrics Unavailable');
    });

    it('identifies profanities, line numbers, snippets, and reasons matching backend format', () => {
      const lyrics = 'Line one is clear\nLine two has shit\nLine three is fine';
      const result = evaluateLyrics(lyrics, { preset: 'moderate' });

      expect(result.has_lyrics).toBe(true);
      expect(result.is_flagged).toBe(true);
      expect(result.total_flagged_count).toBe(1);
      expect(result.detected_terms).toEqual([
        expect.objectContaining({
          word: 'shit',
          category: 'strong_profanity',
          count: 1,
          occurrences: [2],
        }),
      ]);
      expect(result.snippets).toEqual([
        {
          line_number: 2,
          text: 'Line two has shit',
          matched_terms: ['shit'],
        },
      ]);
      expect(result.reasons).toContain('Found 1 Strong Profanity instance(s)');
    });

    it('supports custom blocklist matching', () => {
      const lyrics = 'Drinking a cold beer on Sunday';
      const result = evaluateLyrics(lyrics, {
        preset: 'moderate',
        customBlocklist: ['beer'],
      });

      expect(result.is_flagged).toBe(true);
      expect(result.detected_terms).toEqual([
        expect.objectContaining({
          word: 'beer',
          category: 'custom',
          count: 1,
          occurrences: [1],
        }),
      ]);
      expect(result.reasons).toContain('Found 1 Custom instance(s)');
    });

    it('respects preset differences (moderate vs kid_safe vs slurs_only)', () => {
      const lyrics = 'Damn, this is crazy';

      // 'moderate' does not flag 'mild_profanity'
      const modResult = evaluateLyrics(lyrics, { preset: 'moderate' });
      expect(modResult.is_flagged).toBe(false);

      // 'kid_safe' flags 'mild_profanity'
      const kidResult = evaluateLyrics(lyrics, { preset: 'kid_safe' });
      expect(kidResult.is_flagged).toBe(true);
      expect(kidResult.reasons).toContain('Found 1 Mild Profanity instance(s)');

      // 'slurs_only' flags only slurs
      const slurLyrics = 'Fuck this damn thing';
      const slursResult = evaluateLyrics(slurLyrics, { preset: 'slurs_only' });
      expect(slursResult.is_flagged).toBe(false);
    });
  });

  describe('evaluateTrack & Zero False-Clean State Machine', () => {
    it('marks track with clean lyrics and clean metadata as verified_clean', () => {
      const track = {
        id: 't1',
        title: 'Clean Song',
        is_explicit: false,
        verification_status: 'unscanned',
      };
      const lyrics = 'Sunshine and blue skies all day long';

      const evaluated = evaluateTrack(track, lyrics, { preset: 'moderate' });
      expect(evaluated.verification_status).toBe('verified_clean');
      expect(evaluated.is_flagged).toBe(false);
      expect(evaluated.has_lyrics).toBe(true);
    });

    it('marks track with clean lyrics but explicit metadata as flagged when preset checks metadata', () => {
      const track = {
        id: 't2',
        title: 'Explicit Meta Song',
        is_explicit: true,
        verification_status: 'unscanned',
      };
      const lyrics = 'Sunshine and blue skies all day long';

      const evaluated = evaluateTrack(track, lyrics, {
        preset: 'moderate',
        platform: 'spotify',
      });
      expect(evaluated.verification_status).toBe('flagged');
      expect(evaluated.is_flagged).toBe(true);
      expect(evaluated.reasons).toContain('Marked Explicit by Spotify');
    });

    it('never marks non-explicit missing-lyrics track as verified_clean', () => {
      const track = {
        id: 't3',
        title: 'Missing Lyrics Song',
        is_explicit: false,
        verification_status: 'lyrics_unavailable',
      };

      const evaluated = evaluateTrack(track, null, { preset: 'moderate' });
      expect(evaluated.verification_status).toBe('lyrics_unavailable');
      expect(evaluated.is_flagged).toBe(false);
      expect(evaluated.has_lyrics).toBe(false);
    });

    it('retains unscanned verification_status when staged track has no cached lyrics', () => {
      const track = {
        id: 't4',
        title: 'Staged Unscanned Song',
        is_explicit: false,
        verification_status: 'unscanned',
      };

      const evaluated = evaluateTrack(track, null, { preset: 'moderate' });
      expect(evaluated.verification_status).toBe('unscanned');
      expect(evaluated.is_flagged).toBe(false);
    });

    it('preserves clean_swapped verification_status for swapped tracks', () => {
      const track = {
        id: 't5',
        title: 'Clean Swapped Song',
        is_explicit: false,
        verification_status: 'clean_swapped',
      };
      const lyrics = 'Clean radio edit lyrics';

      const evaluated = evaluateTrack(track, lyrics, { preset: 'moderate' });
      expect(evaluated.verification_status).toBe('clean_swapped');
      expect(evaluated.is_flagged).toBe(false);
    });
  });

  describe('reevaluateTracks & Telemetry', () => {
    it('synchronously re-evaluates cached tracks and returns updated tracks and summary', () => {
      const tracks = [
        { id: '1', title: 'Song 1', is_explicit: false, verification_status: 'verified_clean' },
        { id: '2', title: 'Song 2', is_explicit: false, verification_status: 'unscanned' },
      ];
      const lyricsByTrackId = {
        '1': 'Damn it all to pieces',
      };

      // Moderate preset: 'damn' is mild, not flagged
      const resMod = reevaluateTracks(tracks, {
        lyricsByTrackId,
        preset: 'moderate',
      });
      expect(resMod.tracks[0].verification_status).toBe('verified_clean');
      expect(resMod.tracks[1].verification_status).toBe('unscanned');

      // Kid-safe preset: 'damn' is mild, flagged!
      const resKid = reevaluateTracks(tracks, {
        lyricsByTrackId,
        preset: 'kid_safe',
      });
      expect(resKid.tracks[0].verification_status).toBe('flagged');
      expect(resKid.tracks[0].is_flagged).toBe(true);
      expect(resKid.tracks[1].verification_status).toBe('unscanned');
    });

    it('safely fires telemetry and guards against fetch rejection', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(
        sendScanCompletedTelemetry({
          preset_id: 'moderate',
          track_count: 5,
          flagged_count: 2,
          lyrics_unavailable_count: 1,
        })
      ).resolves.not.toThrow();

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/telemetry/event',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  describe('searchLyricsKeywords', () => {
    it('returns empty matched structure when lyrics are empty or targetKeywords are empty', () => {
      expect(searchLyricsKeywords('', ['money'])).toEqual({
        matched: false,
        total_matches: 0,
        keywords_found: [],
        snippets: [],
      });

      expect(searchLyricsKeywords('Got money in my pocket', [])).toEqual({
        matched: false,
        total_matches: 0,
        keywords_found: [],
        snippets: [],
      });

      expect(searchLyricsKeywords(null, ['drugs'])).toEqual({
        matched: false,
        total_matches: 0,
        keywords_found: [],
        snippets: [],
      });
    });

    it('finds whole-word keywords case-insensitively and returns hit count and snippets', () => {
      const lyrics = 'Line 1: We love the party life\nLine 2: Money talks and money walks\nLine 3: Clean line here';
      const result = searchLyricsKeywords(lyrics, ['money', 'party']);

      expect(result.matched).toBe(true);
      expect(result.total_matches).toBe(3);
      expect(result.keywords_found).toEqual([
        { keyword: 'money', count: 2, lines: [2] },
        { keyword: 'party', count: 1, lines: [1] },
      ]);
      expect(result.snippets).toEqual([
        {
          line_number: 1,
          text: 'Line 1: We love the party life',
          matched_keywords: ['party'],
        },
        {
          line_number: 2,
          text: 'Line 2: Money talks and money walks',
          matched_keywords: ['money'],
        },
      ]);
    });

    it('does not match substrings or partial words', () => {
      const lyrics = 'We are partygoers departing with gunslinger attitude';
      const result = searchLyricsKeywords(lyrics, ['party', 'gun']);

      expect(result.matched).toBe(false);
      expect(result.total_matches).toBe(0);
      expect(result.keywords_found).toEqual([]);
      expect(result.snippets).toEqual([]);
    });

    it('matches multi-word phrases and special regex characters properly', () => {
      const lyrics = 'He drove a fast car into the night\nThen he paid cash (fast)';
      const result = searchLyricsKeywords(lyrics, ['fast car', 'cash']);

      expect(result.matched).toBe(true);
      expect(result.total_matches).toBe(2);
      expect(result.keywords_found).toEqual([
        { keyword: 'fast car', count: 1, lines: [1] },
        { keyword: 'cash', count: 1, lines: [2] },
      ]);
      expect(result.snippets).toHaveLength(2);
    });

    it('handles CRLF line breaks and skips empty lines while preserving line indices', () => {
      const lyrics = 'First line\r\n\r\nThird line has alcohol\r\n';
      const result = searchLyricsKeywords(lyrics, ['alcohol']);

      expect(result.matched).toBe(true);
      expect(result.total_matches).toBe(1);
      expect(result.snippets).toEqual([
        {
          line_number: 3,
          text: 'Third line has alcohol',
          matched_keywords: ['alcohol'],
        },
      ]);
    });
  });
});
