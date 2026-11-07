/**
 * Progressive Categorized Lyric Screening Pipeline.
 *
 * Chunks playlist scan requests into an initial batch of <= 10 tracks
 * followed by subsequent batches of <= 15 tracks. Provides progressive updates,
 * aria-live polite progress announcements, and lyrics dictionary aggregation.
 */

/**
 * Chunks an array of tracks into an initial chunk (<= initialSize)
 * and subsequent chunks (<= subsequentSize).
 *
 * @param {Array} tracks
 * @param {number} initialSize Default 10
 * @param {number} subsequentSize Default 15
 * @returns {Array<Array>} Array of track chunks
 */
export function chunkTracks(tracks, initialSize = 10, subsequentSize = 15) {
  if (!tracks || !Array.isArray(tracks) || tracks.length === 0) {
    return [];
  }

  if (subsequentSize <= 0) {
    return [tracks];
  }

  const chunks = [];
  const firstChunk = tracks.slice(0, initialSize);
  chunks.push(firstChunk);

  let currentIndex = initialSize;
  while (currentIndex < tracks.length) {
    chunks.push(tracks.slice(currentIndex, currentIndex + subsequentSize));
    currentIndex += subsequentSize;
  }

  return chunks;
}

/**
 * Executes the progressive screening pipeline across chunked requests.
 *
 * @param {Object} options
 * @param {Array} options.tracks Staged tracks to scan
 * @param {string} [options.preset="moderate"] Filter preset profile
 * @param {Array<string>} [options.customBlocklist=[]] Custom terms to flag
 * @param {string} [options.platform="ytmusic"] Active music platform
 * @param {Function} [options.onProgress] Callback receiving ({ scanned, total, announcement })
 * @param {Function} [options.onBatchStart] Callback receiving chunk starting scan
 * @param {Function} [options.onBatchComplete] Callback receiving ({ tracks, lyricsById, summary, error })
 * @param {Function} [options.onError] Callback receiving Error
 * @returns {Promise<{ tracks: Array, lyricsById: Object }>}
 */
export async function runScreeningPipeline({
  tracks,
  preset = 'moderate',
  customBlocklist = [],
  platform = 'ytmusic',
  onProgress,
  onBatchStart,
  onBatchComplete,
  onError,
}) {
  if (!tracks || !Array.isArray(tracks) || tracks.length === 0) {
    return { tracks: [], lyricsById: {} };
  }

  const total = tracks.length;
  const chunks = chunkTracks(tracks, 10, 15);
  const allTracks = [];
  const allLyricsById = {};
  let totalScanned = 0;

  for (const chunk of chunks) {
    if (onBatchStart) {
      try {
        onBatchStart(chunk);
      } catch (e) {
        console.error('[screeningPipeline] onBatchStart error:', e);
      }
    }

    let batchTracks = null;
    let batchLyrics = {};
    let batchSummary = null;
    let batchError = null;

    try {
      const res = await fetch('/api/scan/playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tracks: chunk,
          preset,
          custom_blocklist: customBlocklist,
          platform,
          deep_scan_lyrics: true,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        batchError = new Error(errData.detail || `Scan request failed with status ${res.status}`);
      } else {
        const data = await res.json();
        batchTracks = data.tracks || [];
        batchLyrics = data.lyrics_by_id || {};
        batchSummary = data.summary;
      }
    } catch (networkErr) {
      batchError = networkErr;
    }

    if (batchError) {
      if (onError) {
        try {
          onError(batchError);
        } catch (e) {
          console.error('[screeningPipeline] onError callback failed:', e);
        }
      }

      const fallbackTracks = chunk.map((t) => ({
        ...t,
        verification_status: 'scan_error',
        is_flagged: false,
        reasons: [batchError.message || 'Scan error'],
        detected_terms: [],
        snippets: [],
        total_flagged_count: 0,
        has_lyrics: false,
      }));

      allTracks.push(...fallbackTracks);
      totalScanned += fallbackTracks.length;

      if (onProgress) {
        try {
          onProgress({
            scanned: totalScanned,
            total,
            announcement: `Scanned ${totalScanned} of ${total} tracks`,
          });
        } catch (e) {
          console.error('[screeningPipeline] onProgress callback failed:', e);
        }
      }
      if (onBatchComplete) {
        try {
          onBatchComplete({
            tracks: fallbackTracks,
            lyricsById: {},
            error: batchError,
          });
        } catch (e) {
          console.error('[screeningPipeline] onBatchComplete callback failed:', e);
        }
      }
    } else {
      allTracks.push(...batchTracks);
      Object.assign(allLyricsById, batchLyrics);
      totalScanned += batchTracks.length;

      if (onProgress) {
        try {
          onProgress({
            scanned: totalScanned,
            total,
            announcement: `Scanned ${totalScanned} of ${total} tracks`,
          });
        } catch (e) {
          console.error('[screeningPipeline] onProgress callback failed:', e);
        }
      }
      if (onBatchComplete) {
        try {
          onBatchComplete({
            tracks: batchTracks,
            lyricsById: batchLyrics,
            summary: batchSummary,
          });
        } catch (e) {
          console.error('[screeningPipeline] onBatchComplete callback failed:', e);
        }
      }
    }
  }

  return {
    tracks: allTracks,
    lyricsById: allLyricsById,
  };
}
