/**
 * Utility helpers for masking explicit profanity tokens and lyric snippets.
 */

export function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Masks a single word (or space-separated phrase) keeping the initial character
 * followed by asterisks (e.g. "fuck" -> "f***", "shit" -> "s***").
 * Single-character tokens remain unchanged. Uses Array.from for astral Unicode safety.
 *
 * @param {string} word - Raw word to mask.
 * @returns {string} Obfuscated string or empty string if input is falsy/invalid.
 */
export function maskWord(word) {
  if (!word || typeof word !== 'string') {
    return '';
  }

  // Handle multi-word phrases if present
  if (/\s/.test(word)) {
    return word
      .split(/(\s+)/)
      .map((part) => {
        if (/^\s+$/.test(part)) return part;
        const chars = Array.from(part);
        return chars.length <= 1 ? part : `${chars[0]}${'*'.repeat(chars.length - 1)}`;
      })
      .join('');
  }

  const chars = Array.from(word);
  if (chars.length <= 1) {
    return word;
  }

  return `${chars[0]}${'*'.repeat(chars.length - 1)}`;
}

/**
 * Masks occurrences of specified words in a text snippet or lyrics line
 * using whole-word boundaries while preserving casing and surrounding punctuation.
 *
 * @param {string} text - The input line or snippet text.
 * @param {string[]} wordsToMask - Array of explicit words/phrases to obfuscate.
 * @param {boolean} isMasked - Whether masking is enabled (defaults to true).
 * @returns {string} Text with explicit words replaced by masked equivalents.
 */
export function maskText(text, wordsToMask = [], isMasked = true) {
  if (!text || typeof text !== 'string') {
    return text || '';
  }

  if (!isMasked || !Array.isArray(wordsToMask) || wordsToMask.length === 0) {
    return text;
  }

  const validWords = wordsToMask
    .filter((w) => typeof w === 'string' && w.trim().length > 0)
    .map((w) => w.trim())
    .sort((a, b) => b.length - a.length);

  if (validWords.length === 0) {
    return text;
  }

  const pattern = validWords.map(escapeRegex).join('|');
  const regex = new RegExp(`\\b(${pattern})\\b`, 'gi');

  return text.replace(regex, (match) => maskWord(match));
}

/**
 * Extracts all unique flagged words from a track and its snippets.
 *
 * @param {Object} track - Track object possibly containing snippets, reasons, or detected_terms.
 * @param {Object} [snippet] - Optional specific snippet containing matched_terms or matched_keywords.
 * @returns {string[]} Array of unique flagged words.
 */
export function getTrackFlaggedWords(track, snippet) {
  const words = new Set();
  if (snippet?.matched_terms && Array.isArray(snippet.matched_terms)) {
    snippet.matched_terms.forEach((w) => typeof w === 'string' && words.add(w));
  }
  if (snippet?.matched_keywords && Array.isArray(snippet.matched_keywords)) {
    snippet.matched_keywords.forEach((w) => typeof w === 'string' && words.add(w));
  }
  if (track?.snippets && Array.isArray(track.snippets)) {
    track.snippets.forEach((s) => {
      if (Array.isArray(s?.matched_terms)) {
        s.matched_terms.forEach((w) => typeof w === 'string' && words.add(w));
      }
      if (Array.isArray(s?.matched_keywords)) {
        s.matched_keywords.forEach((w) => typeof w === 'string' && words.add(w));
      }
    });
  }
  if (Array.isArray(track?.detected_terms)) {
    track.detected_terms.forEach((t) => {
      const term = typeof t === 'string' ? t : t?.word;
      if (typeof term === 'string') words.add(term);
    });
  } else if (track?.detected_terms && typeof track.detected_terms === 'object') {
    Object.keys(track.detected_terms).forEach((w) => words.add(w));
  }
  return Array.from(words);
}
