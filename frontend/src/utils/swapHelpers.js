/**
 * Helpers for lossless clean-track swapping, re-swapping, and reverting.
 * Preserves all 10 normalized track keys and the true original unswapped snapshot
 * across repeated candidate switches.
 */

export function formatDurationDelta(originalTrack, candidateTrack) {
  const origSec = Number(originalTrack?.duration_seconds) || 0;
  const candSec = Number(candidateTrack?.duration_seconds) || 0;
  if (origSec <= 0 || candSec <= 0) return '0s';
  const diff = Math.round(candSec - origSec);
  if (diff > 0) return `+${diff}s`;
  if (diff < 0) return `${diff}s`;
  return '0s';
}

function extractOriginalSnapshot(track) {
  if (!track || typeof track !== 'object') return null;
  if (track.was_replaced && track.original_track && typeof track.original_track === 'object') {
    return { ...track.original_track };
  }
  const {
    original_track: _ot,
    was_replaced: _wr,
    clean_alternatives: _ca,
    original_title: _otitle,
    original_id: _oid,
    original_set_video_id: _osvid,
    ...cleanSnapshot
  } = track;
  return cleanSnapshot;
}

/**
 * Builds a swapped track object from either an original flagged track or an already-swapped track.
 * Preserves the true original unswapped track snapshot in `original_track` across re-swaps.
 */
export function buildSwappedTrack(currentTrack, candidate, { lyricsByTrackId, alternatives } = {}) {
  const originalSnapshot = extractOriginalSnapshot(currentTrack) || {};
  const cleanLyrics =
    typeof candidate?.lyrics === 'string'
      ? candidate.lyrics
      : candidate?.id
      ? lyricsByTrackId?.[candidate.id]
      : undefined;

  const resolvedAlternatives =
    Array.isArray(alternatives) && alternatives.length > 0
      ? alternatives
      : Array.isArray(currentTrack?.clean_alternatives)
      ? currentTrack.clean_alternatives
      : [];

  const durationSeconds =
    candidate?.duration_seconds !== undefined
      ? candidate.duration_seconds
      : originalSnapshot.duration_seconds ?? 0;

  return {
    ...originalSnapshot,
    ...candidate,
    id: candidate?.id ?? originalSnapshot.id,
    title: candidate?.title ?? originalSnapshot.title ?? '',
    artist: candidate?.artist ?? originalSnapshot.artist ?? '',
    artists_list:
      Array.isArray(candidate?.artists_list)
        ? candidate.artists_list
        : originalSnapshot.artists_list ?? [],
    album: candidate?.album !== undefined ? candidate.album : originalSnapshot.album ?? '',
    duration: candidate?.duration !== undefined ? candidate.duration : originalSnapshot.duration ?? '',
    duration_seconds: durationSeconds,
    is_explicit: Boolean(candidate?.is_explicit),
    thumbnail:
      candidate?.thumbnail !== undefined ? candidate.thumbnail : originalSnapshot.thumbnail ?? null,
    video_url:
      candidate?.video_url !== undefined ? candidate.video_url : originalSnapshot.video_url ?? '',
    verification_status: 'clean_swapped',
    is_flagged: false,
    reasons: [],
    detected_terms: [],
    snippets: [],
    total_flagged_count: 0,
    ytmusic_video_id: candidate?.ytmusic_video_id ?? null,
    lyrics: typeof cleanLyrics === 'string' ? cleanLyrics : undefined,
    has_lyrics: Boolean(typeof cleanLyrics === 'string' && cleanLyrics.trim()),
    was_replaced: true,
    original_track: originalSnapshot,
    original_title: originalSnapshot.title,
    original_id: originalSnapshot.id,
    original_set_video_id: originalSnapshot.setVideoId,
    clean_alternatives: resolvedAlternatives,
  };
}

/**
 * Restores a swapped track back to its exact original unswapped snapshot,
 * clearing `was_replaced` and preserving original screening metadata.
 */
export function buildRevertedTrack(swappedTrack) {
  if (!swappedTrack || !swappedTrack.original_track) {
    return swappedTrack;
  }
  const {
    was_replaced: _wr,
    original_track: _ot,
    original_title: _otitle,
    original_id: _oid,
    original_set_video_id: _osvid,
    clean_alternatives: _ca,
    ...restored
  } = swappedTrack.original_track;

  return { ...restored };
}
