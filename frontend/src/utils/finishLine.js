/**
 * finishLine.js
 *
 * Core domain logic for CleanPlaylist finish-line actions:
 * computing ready tracks, extracting YouTube video IDs for universal playback,
 * formatting YouTube clean queues, copying clean track links to clipboard,
 * triggering file exports, and handling zero-login playback handoffs.
 */

import { emitTelemetryEvent } from './telemetry';

/**
 * Test whether a track is approved / ready for finish-line playback or export.
 * A track is ready if:
 * 1. verification_status is 'verified_clean'
 * 2. verification_status is 'clean_swapped' or track was replaced
 * 3. track ID is present in keptTrackIds (explicit user keep action)
 *
 * @param {Object} track
 * @param {Set<string>|Array<string>} [keptTrackIds]
 * @returns {boolean}
 */
export function isTrackReady(track, keptTrackIds) {
  if (!track || typeof track !== 'object') {
    return false;
  }
  const status = track.verification_status;
  if (status === 'verified_clean' || status === 'clean_swapped' || track.was_replaced === true) {
    return true;
  }
  if (!keptTrackIds) return false;
  if (keptTrackIds instanceof Set) {
    return keptTrackIds.has(track.id);
  }
  if (Array.isArray(keptTrackIds)) {
    return keptTrackIds.includes(track.id);
  }
  return false;
}

/**
 * Filter tracks that are approved / ready for playback.
 *
 * @param {Array<Object>} tracks
 * @param {Set<string>|Array<string>} [keptTrackIds]
 * @returns {Array<Object>}
 */
export function getReadyTracks(tracks, keptTrackIds) {
  if (!Array.isArray(tracks) || tracks.length === 0) {
    return [];
  }
  return tracks.filter((track) => isTrackReady(track, keptTrackIds));
}

/**
 * Extract YouTube video IDs from ready tracks.
 * - In 'ytmusic' mode: uses native IDs (track.id, track.video_id, track.ytmusic_video_id, or parsed from video_url).
 * - In 'spotify' mode: uses cross-referenced track.ytmusic_video_id or candidate track.video_id.
 * Caps output at 50 IDs and includes capped tracks in omittedCount.
 *
 * @param {Array<Object>} readyTracks
 * @param {string} [platform='spotify']
 * @returns {{ videoIds: string[], omittedCount: number, totalReady: number }}
 */
export function extractYouTubeVideoIds(readyTracks, platform = 'spotify') {
  if (!Array.isArray(readyTracks) || readyTracks.length === 0) {
    return { videoIds: [], omittedCount: 0, totalReady: 0 };
  }

  const totalReady = readyTracks.length;
  const resolvedIds = [];
  let unresolvableCount = 0;

  for (const track of readyTracks) {
    if (!track) {
      unresolvableCount += 1;
      continue;
    }

    let videoId = null;

    if (platform === 'ytmusic') {
      if (track.video_id && typeof track.video_id === 'string' && track.video_id.trim()) {
        videoId = track.video_id.trim();
      } else if (track.ytmusic_video_id && typeof track.ytmusic_video_id === 'string' && track.ytmusic_video_id.trim()) {
        videoId = track.ytmusic_video_id.trim();
      } else if (track.id && typeof track.id === 'string' && track.id.trim() && !track.id.startsWith('http') && !track.id.startsWith('spotify:')) {
        videoId = track.id.trim();
      } else if (track.video_url && typeof track.video_url === 'string') {
        const match = track.video_url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([^&?/\s]+)/);
        if (match && match[1]) {
          videoId = match[1];
        }
      }
    } else {
      // spotify mode: uses cross-referenced ytmusic_video_id or clean candidate video_id
      if (track.ytmusic_video_id && typeof track.ytmusic_video_id === 'string' && track.ytmusic_video_id.trim()) {
        videoId = track.ytmusic_video_id.trim();
      } else if (track.video_id && typeof track.video_id === 'string' && track.video_id.trim() && !track.video_id.startsWith('spotify:')) {
        videoId = track.video_id.trim();
      } else if (track.video_url && typeof track.video_url === 'string') {
        const match = track.video_url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([^&?/\s]+)/);
        if (match && match[1]) {
          videoId = match[1];
        }
      }
    }

    if (videoId) {
      resolvedIds.push(videoId);
    } else {
      unresolvableCount += 1;
    }
  }

  const cappedVideoIds = resolvedIds.slice(0, 50);
  const excessCount = Math.max(0, resolvedIds.length - 50);
  const omittedCount = unresolvableCount + excessCount;

  return {
    videoIds: cappedVideoIds,
    omittedCount,
    totalReady,
  };
}

/**
 * Build a watch_videos queue URL from an array of YouTube video IDs.
 * Validates and URI-encodes each ID.
 *
 * @param {string[]} videoIds
 * @returns {string|null}
 */
export function buildYouTubeWatchVideosUrl(videoIds) {
  if (!Array.isArray(videoIds) || videoIds.length === 0) {
    return null;
  }
  const validIds = videoIds
    .filter((id) => typeof id === 'string' && id.trim().length > 0)
    .map((id) => encodeURIComponent(id.trim()));

  if (validIds.length === 0) {
    return null;
  }

  return `https://www.youtube.com/watch_videos?video_ids=${validIds.join(',')}`;
}

/**
 * Orchestrate launching the YouTube Clean Queue.
 *
 * @param {Object} options
 * @param {Array<Object>} options.readyTracks
 * @param {string} [options.platform='spotify']
 * @param {Function} [options.onNotice]
 * @param {boolean} [options.openWindow=true]
 * @returns {{ success: boolean, url?: string, videoIds?: string[], omittedCount?: number, reason?: string }}
 */
export function launchYouTubeCleanQueue({
  readyTracks = [],
  platform = 'spotify',
  onNotice,
  openWindow = true,
  vipMode = false,
}) {
  if (!Array.isArray(readyTracks) || readyTracks.length === 0) {
    return { success: false, reason: 'empty_ready_tracks' };
  }

  const { videoIds, omittedCount } = extractYouTubeVideoIds(readyTracks, platform);

  if (videoIds.length === 0) {
    if (platform === 'spotify') {
      if (typeof onNotice === 'function') {
        onNotice({
          type: 'caution',
          message: 'No YouTube playback links found. Run lyric scan first to resolve playback links.',
        });
      }
    } else {
      if (typeof onNotice === 'function') {
        onNotice({
          type: 'caution',
          message: 'No playable YouTube video IDs found.',
        });
      }
    }
    return { success: false, reason: 'no_resolved_ids' };
  }

  const url = buildYouTubeWatchVideosUrl(videoIds);

  if (openWindow && typeof window !== 'undefined' && typeof window.open === 'function') {
    const newWin = window.open(url, '_blank', 'noopener,noreferrer');
    if (!newWin && typeof onNotice === 'function') {
      onNotice({
        type: 'caution',
        message: 'Popup was blocked by your browser. Please allow popups for CleanPlaylist to launch the YouTube queue.',
      });
      return { success: false, reason: 'popup_blocked', url, videoIds };
    }
  }

  if (omittedCount > 0 && typeof onNotice === 'function') {
    onNotice({
      type: 'caution',
      message: `${omittedCount} ${omittedCount === 1 ? 'track was' : 'tracks were'} omitted from the queue due to missing YouTube links.`,
    });
  }

  // Fire-and-forget telemetry event conforming to AD-9 schema
  emitTelemetryEvent('finish_action_clicked', {
    platform,
    vip_mode: vipMode,
    action: 'play_clean_queue',
  });

  return {
    success: true,
    url,
    videoIds,
    omittedCount,
  };
}

/**
 * Return canonical deep-link URL for a track on the given platform.
 *
 * @param {Object} track
 * @param {string} [platform='spotify']
 * @returns {string|null}
 */
export function getTrackCanonicalUrl(track, platform = 'spotify') {
  if (!track || typeof track !== 'object') {
    return null;
  }

  if (platform === 'spotify') {
    if (
      track.video_url &&
      typeof track.video_url === 'string' &&
      track.video_url.includes('open.spotify.com/track/')
    ) {
      return track.video_url;
    }
    const rawId = track.id || track.track_id || track.uri;
    if (rawId && typeof rawId === 'string' && rawId.trim()) {
      const trimmed = rawId.trim();
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        return trimmed.includes('open.spotify.com/track/') ? trimmed : null;
      }
      const cleanId = trimmed.replace(/^spotify:track:/, '').trim();
      if (cleanId) {
        return `https://open.spotify.com/track/${cleanId}`;
      }
    }
    return track.video_url && typeof track.video_url === 'string' && track.video_url.includes('open.spotify.com/track/')
      ? track.video_url
      : null;
  } else {
    // ytmusic platform
    if (
      track.video_url &&
      typeof track.video_url === 'string' &&
      (track.video_url.includes('music.youtube.com') || track.video_url.includes('youtube.com'))
    ) {
      return track.video_url;
    }
    const rawId = track.id || track.video_id || track.ytmusic_video_id;
    if (rawId && typeof rawId === 'string' && rawId.trim()) {
      const cleanId = rawId.trim();
      if (!cleanId.startsWith('http') && !cleanId.startsWith('spotify:')) {
        return `https://music.youtube.com/watch?v=${cleanId}`;
      }
    }
    return track.video_url && typeof track.video_url === 'string' ? track.video_url : null;
  }
}

/**
 * Format canonical track links for ready tracks, separated by newlines with no trailing whitespace.
 *
 * @param {Array<Object>} readyTracks
 * @param {string} [platform='spotify']
 * @returns {string}
 */
export function formatCleanTrackLinks(readyTracks, platform = 'spotify') {
  if (!Array.isArray(readyTracks) || readyTracks.length === 0) {
    return '';
  }
  const urls = readyTracks
    .map((track) => getTrackCanonicalUrl(track, platform))
    .filter((url) => typeof url === 'string' && url.length > 0);

  return urls.join('\n');
}

/**
 * Copy clean track URLs formatted for instant Spotify Desktop (Ctrl+V / Cmd+V) paste
 * or YouTube Music sharing onto the clipboard.
 *
 * @param {Object} options
 * @param {Array<Object>} options.readyTracks
 * @param {string} [options.platform='spotify']
 * @param {Function} [options.onNotice]
 * @param {Object} [options.clipboard]
 * @returns {Promise<{ success: boolean, count?: number, linksText?: string, reason?: string, error?: any }>}
 */
export async function copyCleanTrackLinks({
  readyTracks = [],
  platform = 'spotify',
  onNotice,
  clipboard = globalThis.navigator?.clipboard,
  vipMode = false,
}) {
  if (!Array.isArray(readyTracks) || readyTracks.length === 0) {
    if (typeof onNotice === 'function') {
      onNotice({
        type: 'caution',
        message: 'No ready tracks available to copy.',
      });
    }
    return { success: false, reason: 'no_ready_tracks' };
  }

  const linksText = formatCleanTrackLinks(readyTracks, platform);
  if (!linksText) {
    if (typeof onNotice === 'function') {
      onNotice({
        type: 'caution',
        message: 'No valid clean track links found.',
      });
    }
    return { success: false, reason: 'no_valid_links' };
  }

  try {
    if (!clipboard || typeof clipboard.writeText !== 'function') {
      throw new Error('Clipboard API unavailable');
    }
    await clipboard.writeText(linksText);
    const count = linksText.split('\n').filter(Boolean).length;

    if (typeof onNotice === 'function') {
      onNotice({
        type: 'success',
        message: `Copied ${count} Clean Track Links`,
      });
    }

    // Fire-and-forget telemetry event conforming to AD-9 schema
    emitTelemetryEvent('finish_action_clicked', {
      platform,
      vip_mode: vipMode,
      action: 'copy_clean_links',
    });

    return {
      success: true,
      count,
      linksText,
    };
  } catch (err) {
    if (typeof onNotice === 'function') {
      onNotice({
        type: 'caution',
        message: 'Failed to copy links to clipboard.',
      });
    }
    return {
      success: false,
      reason: 'clipboard_write_failed',
      error: err,
    };
  }
}

/**
 * Export ready tracks as CSV, M3U8, or JSON file via POST /api/export.
 *
 * @param {Object} options
 * @param {Array<Object>} options.readyTracks
 * @param {string} [options.format='csv']
 * @param {string} [options.playlistTitle='Clean Playlist']
 * @param {string} [options.platform='spotify']
 * @param {Function} [options.onNotice]
 * @param {Function} [options.fetchFn]
 * @returns {Promise<{ success: boolean, format?: string, filename?: string, reason?: string, error?: any }>}
 */
export async function exportCleanPlaylistFile({
  readyTracks = [],
  format = 'csv',
  playlistTitle = 'Clean Playlist',
  platform = 'spotify',
  onNotice,
  fetchFn = globalThis.fetch,
  vipMode = false,
}) {
  if (!Array.isArray(readyTracks) || readyTracks.length === 0) {
    if (typeof onNotice === 'function') {
      onNotice({
        type: 'caution',
        message: 'No tracks available to export.',
      });
    }
    return { success: false, reason: 'no_ready_tracks' };
  }

  try {
    const res = await fetchFn('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tracks: readyTracks,
        format,
        playlist_title: playlistTitle,
        platform,
      }),
    });

    if (!res.ok) {
      throw new Error(`Export request failed with status ${res.status}`);
    }

    const blob = await res.blob();
    let filename = `${playlistTitle || 'CleanPlaylist'}.${format === 'm3u8' ? 'm3u8' : format}`;
    const disposition = res.headers?.get?.('Content-Disposition');
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^"]+)"?/);
      if (match && match[1]) {
        filename = match[1];
      }
    }

    if (typeof document !== 'undefined' && typeof window !== 'undefined') {
      const downloadUrl = (globalThis.URL || window.URL).createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      (globalThis.URL || window.URL).revokeObjectURL(downloadUrl);
    }

    if (typeof onNotice === 'function') {
      onNotice({
        type: 'success',
        message: 'Exported Clean Playlist successfully',
      });
    }

    // Fire-and-forget telemetry event conforming to AD-9 schema
    emitTelemetryEvent('finish_action_clicked', {
      platform,
      vip_mode: vipMode,
      action: 'file_export',
    });

    return {
      success: true,
      format,
      filename,
    };
  } catch (err) {
    if (typeof onNotice === 'function') {
      onNotice({
        type: 'caution',
        message: 'Export failed. Please try again.',
      });
    }
    return {
      success: false,
      reason: 'export_failed',
      error: err,
    };
  }
}
