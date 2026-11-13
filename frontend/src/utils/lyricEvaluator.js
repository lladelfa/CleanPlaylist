/**
 * Client-Side In-Memory Lyric Evaluator.
 *
 * Implements client evaluation engine matching server ScannerService logic:
 * regex compilation with morphological suffixes (?:ing|ed|s|es)?, line-by-line scanning,
 * snippet creation, category aggregation, and zero false-clean state machine.
 */

import { emitTelemetryEvent } from './telemetry';

export const DEFAULT_PRESET_PROFILES = {
  kid_safe: {
    id: 'kid_safe',
    name: 'Kid-Safe / Strict',
    description: 'Filters all profanity, vulgar language, crude humor, substance references, and slurs.',
    include_metadata_explicit: true,
    categories: ['slurs', 'strong_profanity', 'mild_profanity', 'sexual', 'substances'],
  },
  moderate: {
    id: 'moderate',
    name: 'Moderate (Recommended)',
    description: 'Filters standard explicit language, F-bombs, vulgar sexual references, and slurs (allows mild words like damn/hell).',
    include_metadata_explicit: true,
    categories: ['slurs', 'strong_profanity', 'sexual'],
  },
  slurs_only: {
    id: 'slurs_only',
    name: 'Slurs & Hate Speech Only',
    description: 'Flags only discriminatory slurs and severely offensive derogatory terms.',
    include_metadata_explicit: false,
    categories: ['slurs'],
  },
  custom: {
    id: 'custom',
    name: 'Custom Filter',
    description: 'Applies the fixed slur and strong-profanity rules plus your custom blocklist terms. Your blocklist applies under every preset.',
    include_metadata_explicit: true,
    categories: ['slurs', 'strong_profanity'],
  },
};

export const DEFAULT_WORD_CATEGORIES = {
  slurs: [
    'chink', 'coon', 'cunt', 'dyke', 'fag', 'faggot', 'gook', 'kike',
    'nigga', 'nigger', 'retard', 'spic', 'towelhead', 'tranny', 'wetback'
  ],
  strong_profanity: [
    'asshole', 'bastard', 'bitch', 'bitches', 'bitching', 'bullshit', 'cock',
    'dick', 'fuck', 'fucked', 'fucker', 'fucking', 'motherfucker',
    'motherfucking', 'pussy', 'shit', 'shitty', 'slut', 'twat', 'whore'
  ],
  mild_profanity: [
    'ass', 'badass', 'crap', 'dammit', 'damn', 'hell', 'piss', 'pissed'
  ],
  sexual: [
    'blowjob', 'boner', 'boobs', 'clit', 'cum', 'dildo', 'ejaculat',
    'handjob', 'horny', 'masturbat', 'orgasm', 'penis', 'tits', 'vagina'
  ],
  substances: [
    'blunt', 'cocaine', 'codeine', 'coke', 'ecstasy', 'heroin', 'joint',
    'lean', 'meth', 'molly', 'percocet', 'weed', 'xanax'
  ],
};

export const DEFAULT_SUFFIX_PATTERN = '(?:ing|ed|s|es)?';

/**
 * Escapes characters with special meaning in regular expressions.
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Compiles a word into a regex with whole-word boundaries and morphological suffixes.
 */
export function compileTermPattern(word, suffixPattern = DEFAULT_SUFFIX_PATTERN, flags = 'i') {
  const cleaned = (word || '').trim().toLowerCase();
  if (!cleaned) return null;

  const escaped = escapeRegex(cleaned);
  let patternStr;

  if (suffixPattern) {
    patternStr = `\\b${escaped}${suffixPattern}\\b`;
  } else {
    patternStr = `\\b${escaped}\\b`;
  }

  return new RegExp(patternStr, flags);
}

/**
 * Evaluates raw lyrics text against active preset, custom blocklist, and metadata.
 */
export function evaluateLyrics(lyrics, options = {}) {
  const {
    preset = 'moderate',
    presets = DEFAULT_PRESET_PROFILES,
    categories = DEFAULT_WORD_CATEGORIES,
    suffixPattern = DEFAULT_SUFFIX_PATTERN,
    customBlocklist = [],
    isMetadataExplicit = false,
    platform = 'ytmusic',
  } = options;

  const presetConfig = presets[preset] || presets.moderate || DEFAULT_PRESET_PROFILES.moderate;
  const activeCategories = presetConfig.categories || ['slurs', 'strong_profanity'];
  const includeMetadata = presetConfig.include_metadata_explicit !== false;

  const detectedTerms = {};
  const snippets = [];
  const reasons = [];

  const platformName = (platform || '').toLowerCase() === 'spotify' ? 'Spotify' : 'YouTube Music';

  // 1. Metadata check
  if (includeMetadata && isMetadataExplicit) {
    reasons.push(`Marked Explicit by ${platformName}`);
  }

  const hasLyrics = Boolean(typeof lyrics === 'string' && lyrics.trim());
  if (!hasLyrics) {
    const noLyricReasons = [...reasons];
    if (includeMetadata && isMetadataExplicit) {
      if (!noLyricReasons.includes('Lyrics Unavailable')) {
        noLyricReasons.push('Lyrics Unavailable');
      }
    }
    return {
      is_flagged: noLyricReasons.length > 0,
      reasons: noLyricReasons,
      detected_terms: [],
      total_flagged_count: 0,
      snippets: [],
      has_lyrics: false,
    };
  }

  const lines = lyrics.split(/\r?\n/);

  // Compile category patterns
  const categoryPatterns = [];
  for (const cat of activeCategories) {
    const wordList = categories[cat] || [];
    for (const word of wordList) {
      const pat = compileTermPattern(word, suffixPattern, 'gi');
      if (pat) {
        categoryPatterns.push({ category: cat, root: word, regex: pat });
      }
    }
  }

  // Compile custom blocklist patterns (exact word boundary matching without suffixes, matching server scanner_service.py)
  const customPatterns = [];
  if (Array.isArray(customBlocklist)) {
    for (const word of customBlocklist) {
      if (typeof word === 'string') {
        const cleaned = word.trim().toLowerCase();
        if (cleaned) {
          const pat = compileTermPattern(cleaned, null, 'gi');
          if (pat) {
            customPatterns.push({ category: 'custom', root: cleaned, regex: pat });
          }
        }
      }
    }
  }

  // Line by line scanning
  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    const lineStr = line.trim();
    if (!lineStr) return;

    const lineMatches = [];

    // Check category patterns
    for (const { category, regex } of categoryPatterns) {
      regex.lastIndex = 0;
      let match;
      while ((match = regex.exec(lineStr)) !== null) {
        if (match[0].length === 0) {
          regex.lastIndex++;
        }
        const matchedText = match[0].toLowerCase();
        lineMatches.push({ category, term: matchedText });

        if (!detectedTerms[matchedText]) {
          detectedTerms[matchedText] = {
            word: matchedText,
            category,
            count: 0,
            occurrences: [],
          };
        }
        detectedTerms[matchedText].count += 1;
        detectedTerms[matchedText].occurrences.push(lineNum);
      }
    }

    // Check custom patterns
    for (const { category, regex } of customPatterns) {
      regex.lastIndex = 0;
      let match;
      while ((match = regex.exec(lineStr)) !== null) {
        if (match[0].length === 0) {
          regex.lastIndex++;
        }
        const matchedText = match[0].toLowerCase();
        lineMatches.push({ category, term: matchedText });

        if (!detectedTerms[matchedText]) {
          detectedTerms[matchedText] = {
            word: matchedText,
            category: 'custom',
            count: 0,
            occurrences: [],
          };
        }
        detectedTerms[matchedText].count += 1;
        detectedTerms[matchedText].occurrences.push(lineNum);
      }
    }

    if (lineMatches.length > 0) {
      snippets.push({
        line_number: lineNum,
        text: lineStr,
        matched_terms: lineMatches.map((m) => m.term),
      });
    }
  });

  // Summarize category reasons
  if (Object.keys(detectedTerms).length > 0) {
    const catCounts = {};
    for (const item of Object.values(detectedTerms)) {
      catCounts[item.category] = (catCounts[item.category] || 0) + item.count;
    }

    for (const [cat, count] of Object.entries(catCounts)) {
      const label = cat
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
      reasons.push(`Found ${count} ${label} instance(s)`);
    }
  }

  const totalFlags = Object.values(detectedTerms).reduce((acc, item) => acc + item.count, 0);
  const isFlagged = reasons.length > 0 || (includeMetadata && isMetadataExplicit);

  return {
    is_flagged: isFlagged,
    reasons,
    detected_terms: Object.values(detectedTerms),
    total_flagged_count: totalFlags,
    snippets,
    has_lyrics: true,
  };
}

/**
 * Evaluates a single track against lyrics and metadata following the Zero False-Clean state machine.
 */
export function evaluateTrack(track, lyrics, options = {}) {
  const {
    preset = 'moderate',
    presets = DEFAULT_PRESET_PROFILES,
    platform = 'ytmusic',
  } = options;

  const presetConfig = presets[preset] || presets.moderate || DEFAULT_PRESET_PROFILES.moderate;
  const includeMetadata = presetConfig.include_metadata_explicit !== false;
  const isExplicit = Boolean(track.is_explicit);
  const platformName = (platform || '').toLowerCase() === 'spotify' ? 'Spotify' : 'YouTube Music';

  // Clean swapped tracks (via verification_status or was_replaced) are preserved clean
  const isCleanSwapped = track.verification_status === 'clean_swapped' || track.was_replaced === true;
  if (isCleanSwapped) {
    return {
      ...track,
      is_flagged: false,
      reasons: [],
      detected_terms: [],
      total_flagged_count: 0,
      snippets: [],
      verification_status: 'clean_swapped',
    };
  }

  const hasLyrics = Boolean(typeof lyrics === 'string' && lyrics.trim());

  if (hasLyrics) {
    const scanResult = evaluateLyrics(lyrics, {
      ...options,
      isMetadataExplicit: isExplicit,
      platform,
    });

    let verificationStatus;
    if (
      scanResult.is_flagged ||
      (isExplicit && includeMetadata) ||
      scanResult.total_flagged_count > 0
    ) {
      verificationStatus = 'flagged';
    } else {
      verificationStatus = 'verified_clean';
    }

    return {
      ...track,
      is_flagged: scanResult.is_flagged,
      reasons: scanResult.reasons,
      detected_terms: scanResult.detected_terms,
      total_flagged_count: scanResult.total_flagged_count,
      snippets: scanResult.snippets,
      has_lyrics: true,
      verification_status: verificationStatus,
    };
  }

  // Missing or absent lyrics
  let verificationStatus;
  let isFlagged = false;
  let reasons = [];

  if (track.verification_status === 'unscanned') {
    verificationStatus = 'unscanned';
    isFlagged = Boolean(isExplicit && includeMetadata);
    reasons = isFlagged ? [`Marked Explicit by ${platformName}`] : [];
  } else {
    // Previously scanned or explicit check
    if (isExplicit && includeMetadata) {
      verificationStatus = 'flagged';
      isFlagged = true;
      reasons = [`Marked Explicit by ${platformName}`, 'Lyrics Unavailable'];
    } else {
      verificationStatus = 'lyrics_unavailable';
      isFlagged = false;
      reasons = [];
    }
  }

  return {
    ...track,
    is_flagged: isFlagged,
    reasons,
    detected_terms: [],
    total_flagged_count: 0,
    snippets: [],
    has_lyrics: false,
    verification_status: verificationStatus,
  };
}

/**
 * Re-evaluates tracks in memory client-side with zero network calls to scanning endpoints.
 */
export function reevaluateTracks(tracks, options = {}) {
  const {
    lyricsByTrackId = {},
    preset: _preset = 'moderate',
  } = options || {};

  const safeLyricsMap = lyricsByTrackId && typeof lyricsByTrackId === 'object' ? lyricsByTrackId : {};

  if (!Array.isArray(tracks) || tracks.length === 0) {
    return {
      tracks: [],
      summary: { total: 0, flagged: 0, clean: 0, lyricsUnavailable: 0 },
    };
  }

  const updatedTracks = tracks.map((track) => {
    if (!track) return track;
    const cachedLyrics = safeLyricsMap[track.id];
    return evaluateTrack(track, cachedLyrics, options);
  });

  const flaggedCount = updatedTracks.filter((t) => t.is_flagged).length;
  const cleanCount = updatedTracks.filter((t) => t.verification_status === 'verified_clean').length;
  const lyricsUnavailableCount = updatedTracks.filter(
    (t) => t.verification_status === 'lyrics_unavailable'
  ).length;

  const summary = {
    total: updatedTracks.length,
    flagged: flaggedCount,
    clean: cleanCount,
    lyricsUnavailable: lyricsUnavailableCount,
  };

  return {
    tracks: updatedTracks,
    summary,
  };
}

/**
 * Sends scan_completed telemetry event in a safe, fire-and-forget fashion conforming to AD-9 schema.
 */
export async function sendScanCompletedTelemetry(payload) {
  emitTelemetryEvent('scan_completed', payload);
}

/**
 * In-memory keyword search across lyrics lines using whole-word regex matching.
 * Returns { matched, total_matches, keywords_found, snippets }.
 */
export function searchLyricsKeywords(lyrics, targetKeywords = []) {
  if (!lyrics || typeof lyrics !== 'string' || !Array.isArray(targetKeywords) || targetKeywords.length === 0) {
    return {
      matched: false,
      total_matches: 0,
      keywords_found: [],
      snippets: [],
    };
  }

  const cleanKeywords = [];
  const patterns = [];
  const keywordStats = {};

  for (const kw of targetKeywords) {
    if (typeof kw !== 'string') continue;
    const cleaned = kw.trim().toLowerCase();
    if (!cleaned) continue;
    if (keywordStats[cleaned]) continue;

    const escaped = escapeRegex(cleaned);
    const pattern = new RegExp(`\\b${escaped}\\b`, 'gi');
    patterns.push({ keyword: cleaned, pattern });
    cleanKeywords.push(cleaned);
    keywordStats[cleaned] = {
      keyword: cleaned,
      count: 0,
      lines: [],
    };
  }

  if (cleanKeywords.length === 0) {
    return {
      matched: false,
      total_matches: 0,
      keywords_found: [],
      snippets: [],
    };
  }

  const lines = lyrics.split(/\r?\n|\r/);
  const snippets = [];

  lines.forEach((line, idx) => {
    const lineNumber = idx + 1;
    const lineStr = line.trim();
    if (!lineStr) return;

    const lineHits = [];

    patterns.forEach(({ keyword, pattern }) => {
      pattern.lastIndex = 0;
      const matches = lineStr.match(pattern);
      if (matches && matches.length > 0) {
        keywordStats[keyword].count += matches.length;
        keywordStats[keyword].lines.push(lineNumber);
        lineHits.push(keyword);
      }
    });

    if (lineHits.length > 0) {
      snippets.push({
        line_number: lineNumber,
        text: lineStr,
        matched_keywords: lineHits,
      });
    }
  });

  const keywordsFound = Object.values(keywordStats).filter((k) => k.count > 0);
  const totalMatches = keywordsFound.reduce((sum, k) => sum + k.count, 0);

  return {
    matched: totalMatches > 0,
    total_matches: totalMatches,
    keywords_found: keywordsFound,
    snippets,
  };
}
