/**
 * finishLine.js
 *
 * Core domain logic for CleanPlaylist finish-line actions:
 * computing ready tracks, extracting YouTube video IDs for universal playback,
 * formatting YouTube clean queues, and handling zero-login playback handoffs.
 */

/**
 * Filter tracks that are approved / ready for playback.
 * A track is ready if:
 * 1. verification_status is 'verified_clean'
 * 2. verification_status is 'clean_swapped'
 * 3. track ID is present in keptTrackIds (explicit user keep action)
 *
 * @param {Array<Object>} tracks
 * @param {Set<string>|Array<string>} [keptTrackIds]
 * @returns {Array<Object>}
 */
export function getReadyTracks(tracks, keptTrackIds) {
  if (!Array.isArray(tracks) || tracks.length === 0) {
    return [];
  }

  const isKept = (id) => {
    if (!id || !keptTrackIds) return false;
    if (keptTrackIds instanceof Set) {
      return keptTrackIds.has(id);
    }
    if (Array.isArray(keptTrackIds)) {
      return keptTrackIds.includes(id);
    }
    return false;
  };

  return tracks.filter((track) => {
    if (!track) return false;
    const status = track.verification_status;
    return (
      status === 'verified_clean' ||
      status === 'clean_swapped' ||
      isKept(track.id)
    );
  });
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

  // Fire-and-forget telemetry event
  try {
    if (typeof fetch === 'function') {
      fetch('/api/telemetry/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_name: 'finish_action_clicked',
          properties: {
            action: 'play_clean_queue',
            platform,
            video_ids_count: videoIds.length,
            omitted_count: omittedCount,
          },
        }),
      }).catch(() => {});
    }
  } catch {
    // Fire-and-forget
  }

  return {
    success: true,
    url,
    videoIds,
    omittedCount,
  };
}
