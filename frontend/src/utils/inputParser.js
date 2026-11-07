/**
 * Utility functions for input parsing, URL classification, and tracklist line extraction.
 */

export function isMultiLine(text) {
  return typeof text === 'string' && text.includes('\n');
}

export function parseTrackListLines(text) {
  if (typeof text !== 'string') return [];
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function isSpotifyUrl(urlOrUri) {
  if (typeof urlOrUri !== 'string') return false;
  const raw = urlOrUri.trim().toLowerCase();
  return raw.includes('spotify.com') || raw.startsWith('spotify:');
}

export function isSpotifyPlaylistUrl(urlOrUri) {
  if (typeof urlOrUri !== 'string') return false;
  const raw = urlOrUri.trim().toLowerCase();
  if (!raw) return false;
  if (raw.startsWith('spotify:playlist:')) return true;
  return /(?:open\.spotify\.com\/(?:intl-[a-z0-9_-]+\/)?(?:user\/[^/]+\/)?playlist\/)/i.test(raw);
}

export function isYouTubeUrl(url) {
  if (typeof url !== 'string') return false;
  const raw = url.trim().toLowerCase();
  return (
    raw.includes('music.youtube.com') ||
    raw.includes('youtube.com') ||
    raw.includes('youtu.be')
  );
}

export function classifyInput(input, activePlatform = 'spotify') {
  if (!input || typeof input !== 'string') {
    return { type: 'empty', isCrossPlatform: false, targetPlatform: null };
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return { type: 'empty', isCrossPlatform: false, targetPlatform: null };
  }
  if (isMultiLine(trimmed)) {
    return {
      type: 'multiline',
      isCrossPlatform: false,
      targetPlatform: null,
      lines: parseTrackListLines(trimmed),
    };
  }

  const isSp = isSpotifyUrl(trimmed);
  const isYt = isYouTubeUrl(trimmed);

  if (activePlatform === 'spotify') {
    if (isYt) {
      return { type: 'url', isCrossPlatform: true, targetPlatform: 'ytmusic' };
    }
    if (isSp) {
      return { type: 'url', isCrossPlatform: false, targetPlatform: 'spotify' };
    }
  } else {
    // activePlatform === 'ytmusic'
    if (isSp) {
      return { type: 'url', isCrossPlatform: true, targetPlatform: 'spotify' };
    }
    if (isYt) {
      return { type: 'url', isCrossPlatform: false, targetPlatform: 'ytmusic' };
    }
  }

  return { type: 'query', isCrossPlatform: false, targetPlatform: null };
}
