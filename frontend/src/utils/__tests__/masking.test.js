import { describe, it, expect } from 'vitest';
import { maskWord, maskText, getTrackFlaggedWords } from '../masking';

describe('maskWord formatting helper', () => {
  it('masks standard words preserving the first character followed by asterisks', () => {
    expect(maskWord('fuck')).toBe('f***');
    expect(maskWord('shit')).toBe('s***');
    expect(maskWord('bitch')).toBe('b****');
    expect(maskWord('asshole')).toBe('a******');
  });

  it('preserves casing of the initial character', () => {
    expect(maskWord('Shit')).toBe('S***');
    expect(maskWord('FUCK')).toBe('F***');
  });

  it('keeps single-character tokens unchanged', () => {
    expect(maskWord('f')).toBe('f');
    expect(maskWord('A')).toBe('A');
  });

  it('handles astral Unicode characters and surrogate pairs safely with Array.from', () => {
    // Emoji is 2 UTF-16 code units, but 1 astral character
    expect(maskWord('🔥fire')).toBe('🔥****');
    expect(maskWord('💩')).toBe('💩');
  });

  it('handles empty or non-string inputs safely by returning an empty string', () => {
    expect(maskWord('')).toBe('');
    expect(maskWord(null)).toBe('');
    expect(maskWord(undefined)).toBe('');
    expect(maskWord(123)).toBe('');
  });

  it('masks multi-word phrases by masking each word token individually', () => {
    expect(maskWord('holy shit')).toBe('h*** s***');
    expect(maskWord('bad   word')).toBe('b**   w***');
  });
});

describe('maskText snippet and line helper', () => {
  it('masks target words within a text snippet when isMasked is true', () => {
    const text = "Don't give a fuck";
    expect(maskText(text, ['fuck'], true)).toBe("Don't give a f***");
  });

  it('returns original text unchanged when isMasked is false', () => {
    const text = "Don't give a fuck";
    expect(maskText(text, ['fuck'], false)).toBe("Don't give a fuck");
  });

  it('returns original text unchanged when wordsToMask is empty or missing', () => {
    const text = "Don't give a fuck";
    expect(maskText(text, [], true)).toBe("Don't give a fuck");
    expect(maskText(text, null, true)).toBe("Don't give a fuck");
    expect(maskText(text, undefined, true)).toBe("Don't give a fuck");
  });

  it('handles empty or falsy text gracefully', () => {
    expect(maskText('', ['fuck'], true)).toBe('');
    expect(maskText(null, ['fuck'], true)).toBe('');
    expect(maskText(undefined, ['fuck'], true)).toBe('');
  });

  it('preserves casing and matches case-insensitively', () => {
    const text = "I give NO FUCK and no Shit";
    expect(maskText(text, ['fuck', 'shit'], true)).toBe("I give NO F*** and no S***");
  });

  it('respects word boundaries so substrings are not erroneously masked', () => {
    const text = "The assassin will pass the grass";
    expect(maskText(text, ['ass'], true)).toBe("The assassin will pass the grass");
  });

  it('handles surrounding punctuation and line breaks cleanly', () => {
    const text = "What the fuck?! (shit) [damn]...";
    expect(maskText(text, ['fuck', 'shit', 'damn'], true)).toBe("What the f***?! (s***) [d***]...");
  });

  it('supports multi-word phrases in wordsToMask', () => {
    const text = "He uttered a bad word in class";
    expect(maskText(text, ['bad word'], true)).toBe("He uttered a b** w*** in class");
  });
});

describe('getTrackFlaggedWords helper', () => {
  it('extracts unique flagged terms from snippets, detected_terms, and snippet matched_terms', () => {
    const track = {
      snippets: [
        { line_number: 1, matched_terms: ['shit', 'bitch'] },
        { line_number: 2, matched_keywords: ['money'] },
      ],
      detected_terms: [{ word: 'asshole' }, 'cunt'],
    };

    const words = getTrackFlaggedWords(track);
    expect(words).toContain('shit');
    expect(words).toContain('bitch');
    expect(words).toContain('money');
    expect(words).toContain('asshole');
    expect(words).toContain('cunt');
  });

  it('handles empty or missing track fields gracefully', () => {
    expect(getTrackFlaggedWords(null)).toEqual([]);
    expect(getTrackFlaggedWords({})).toEqual([]);
    expect(getTrackFlaggedWords({ snippets: [] })).toEqual([]);
  });
});
