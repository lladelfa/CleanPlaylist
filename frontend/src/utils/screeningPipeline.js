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
/**
 * True when more than half of the tracks failed their lyric lookup upstream
 * (mirrors the backend `lyrics_service_degraded` rule).
 */
export function isLyricsServiceDegraded(tracks) {
  if (!Array.isArray(tracks) || tracks.length === 0) return false;
  const failed = tracks.filter((t) => t && t.lyrics_lookup === 'upstream_error').length;
  return failed * 2 > tracks.length;
}

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
  let summaryDegraded = false;

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
        if (batchSummary && batchSummary.lyrics_service_degraded === true) {
          summaryDegraded = true;
        }
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
    lyricsServiceDegraded: summaryDegraded || isLyricsServiceDegraded(allTracks),
  };
}

/**
 * Executes the bulk clean replacement pipeline across chunked requests of <= 10 tracks.
 *
 * @param {Object} options
 * @param {Array} options.tracks Flagged tracks to find clean replacements for
 * @param {string} [options.platform="ytmusic"] Active music platform
 * @param {Function} [options.onProgress] Callback receiving ({ processed, total, announcement })
 * @param {Function} [options.onBatchStart] Callback receiving chunk starting replacement search
 * @param {Function} [options.onBatchComplete] Callback receiving ({ results, lyricsById, chunk })
 * @param {Function} [options.onError] Callback receiving Error
 * @returns {Promise<{ results: Object, lyricsById: Object, error?: Error, unprocessedTracks?: Array }>}
 */
export async function runBulkCleanPipeline({
  tracks,
  platform = 'ytmusic',
  signal,
  onProgress,
  onBatchStart,
  onBatchComplete,
  onError,
}) {
  if (!tracks || !Array.isArray(tracks) || tracks.length === 0) {
    return { results: {}, lyricsById: {} };
  }

  const total = tracks.length;
  const chunks = chunkTracks(tracks, 10, 10);
  const allResults = {};
  const allLyricsById = {};
  let processedCount = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (signal?.aborted) {
      const abortErr = new Error('Bulk clean replacement aborted');
      abortErr.name = 'AbortError';
      return {
        results: allResults,
        lyricsById: allLyricsById,
        error: abortErr,
        unprocessedTracks: tracks.slice(processedCount),
      };
    }

    if (onBatchStart) {
      try {
        onBatchStart(chunk);
      } catch (e) {
        console.error('[screeningPipeline:runBulkCleanPipeline] onBatchStart error:', e);
      }
    }

    let batchError = null;
    let batchResults = {};
    let batchLyrics = {};

    try {
      const res = await fetch('/api/replacements/find-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tracks: chunk,
          platform,
        }),
        signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        batchError = new Error(errData.detail || `Bulk replacement request failed with status ${res.status}`);
        batchError.status = res.status;
        if (res.status === 429) {
          batchError.isRateLimit = true;
        }
      } else {
        const data = await res.json();
        batchResults = data.results || {};
        batchLyrics = data.lyrics_by_id || {};
      }
    } catch (networkErr) {
      batchError = networkErr;
    }

    if (batchError) {
      if (onError) {
        try {
          onError(batchError);
        } catch (e) {
          console.error('[screeningPipeline:runBulkCleanPipeline] onError callback failed:', e);
        }
      }

      const remainingTracks = tracks.slice(processedCount);

      return {
        results: allResults,
        lyricsById: allLyricsById,
        error: batchError,
        unprocessedTracks: remainingTracks,
      };
    }

    Object.assign(allResults, batchResults);
    Object.assign(allLyricsById, batchLyrics);
    processedCount += chunk.length;

    if (onProgress) {
      try {
        onProgress({
          processed: processedCount,
          total,
          announcement: `Finding clean edits (${processedCount} of ${total})…`,
        });
      } catch (e) {
        console.error('[screeningPipeline:runBulkCleanPipeline] onProgress callback failed:', e);
      }
    }

    if (onBatchComplete) {
      try {
        onBatchComplete({
          results: batchResults,
          lyricsById: batchLyrics,
          chunk,
        });
      } catch (e) {
        console.error('[screeningPipeline:runBulkCleanPipeline] onBatchComplete callback failed:', e);
      }
    }
  }

  return {
    results: allResults,
    lyricsById: allLyricsById,
  };
}

/**
 * Automated Stitch Pre-Screening Pipeline.
 *
 * Orchestrates pre-screening across multiple staged sources:
 * 1. Resolves pasted lines via POST /api/catalog/resolve, collecting unresolved lines
 *    without blocking valid tracks.
 * 2. Runs chunked lyric scanning across all uncached tracks via POST /api/scan/playlist.
 * 3. Queries POST /api/replacements/find-batch across flagged tracks if cleanMode requires replacements.
 * 4. Maps non-null clean replacement candidates into manual_replacements.
 * 5. Fails soft on HTTP 429 or network errors, returning rate_limited status and retaining evaluated tracks.
 *
 * @param {Object} options
 * @param {Array} options.playlistPool Staged sources
 * @param {string} [options.cleanMode="replace_clean_or_drop"]
 * @param {string} [options.platform="ytmusic"]
 * @param {string} [options.preset="moderate"]
 * @param {Array<string>} [options.customBlocklist=[]]
 * @param {Object} [options.cachedLyrics={}]
 * @param {AbortSignal} [options.signal]
 * @param {Function} [options.onProgress] Callback receiving ({ phase, scanned, total, announcement })
 * @param {Function} [options.onError] Callback receiving Error
 * @returns {Promise<{ status: string, sources: Array, allTracks: Array, lyricsById: Object, manualReplacements: Object, unresolvedLines: Array, error?: Error }>}
 */
export async function runStitchPreScreeningPipeline({
  playlistPool = [],
  cleanMode = 'replace_clean_or_drop',
  platform = 'ytmusic',
  preset = 'moderate',
  customBlocklist = [],
  cachedLyrics = {},
  signal,
  onProgress,
  onError,
}) {
  if (!playlistPool || playlistPool.length === 0) {
    return {
      status: 'complete',
      sources: [],
      allTracks: [],
      lyricsById: {},
      manualReplacements: {},
      unresolvedLines: [],
      error: null,
    };
  }

  // Clone sources shallowly so we don't mutate input objects directly
  const sources = playlistPool.map((p) => ({
    ...p,
    tracks: p.tracks ? [...p.tracks] : [],
  }));

  const allLyricsById = { ...cachedLyrics };
  const unresolvedLines = [];
  const manualReplacements = {};

  // Step 1: Resolve pasted sources via POST /api/catalog/resolve
  for (const source of sources) {
    if (signal?.aborted) {
      const abortErr = new Error('Pre-screening aborted');
      abortErr.name = 'AbortError';
      return {
        status: 'aborted',
        sources,
        allTracks: [],
        lyricsById: allLyricsById,
        manualReplacements,
        unresolvedLines,
        error: abortErr,
      };
    }

    if (
      !source.resolved &&
      (source.type === 'paste' || source.rawLines) &&
      source.rawLines &&
      source.rawLines.length > 0
    ) {
      // Lines beyond 50 are surfaced as unresolved so user is notified of truncation
      if (source.rawLines.length > 50) {
        const truncated = source.rawLines.slice(50).map((line) => ({
          line,
          reason: 'limit_exceeded',
        }));
        unresolvedLines.push(...truncated);
      }

      if (onProgress) {
        try {
          onProgress({
            phase: 'resolve',
            announcement: `Resolving pasted tracks for ${source.title}…`,
          });
        } catch (e) {
          console.error('[runStitchPreScreeningPipeline] onProgress error:', e);
        }
      }
      try {
        const res = await fetch('/api/catalog/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lines: source.rawLines.slice(0, 50),
            platform,
          }),
          signal,
        });

        if (res.status === 429) {
          const rateErr = new Error('Rate limit exceeded during line resolution');
          rateErr.status = 429;
          rateErr.isRateLimit = true;
          if (onError) {
            try { onError(rateErr); } catch (e) { console.error(e); }
          }
          return {
            status: 'rate_limited',
            sources,
            allTracks: [],
            lyricsById: allLyricsById,
            manualReplacements,
            unresolvedLines,
            error: rateErr,
          };
        }

        if (res.ok) {
          const data = await res.json();
          const resolvedTracks = data.resolved || [];
          const unresolved = data.unresolved || [];
          if (unresolved.length > 0) {
            unresolvedLines.push(...unresolved);
          }
          source.tracks = resolvedTracks;
          source.resolved = true;
        } else {
          const errData = await res.json().catch(() => ({}));
          const err = new Error(errData.detail || `Resolve failed with status ${res.status}`);
          err.status = res.status;
          if (onError) {
            try { onError(err); } catch (e) { console.error(e); }
          }
        }
      } catch (e) {
        if (e.name === 'AbortError') throw e;
        if (onError) {
          try { onError(e); } catch (cbErr) { console.error(cbErr); }
        }
      }
    }
  }

  // Helper to map screened tracks back into sources
  const applyScreenedToSources = (screenedList) => {
    const screenedMap = new Map();
    for (const t of screenedList) {
      if (t?.id) screenedMap.set(t.id, t);
    }
    for (const s of sources) {
      s.tracks = s.tracks.map((t) => (t?.id && screenedMap.has(t.id) ? screenedMap.get(t.id) : t));
    }
  };

  // Step 2: Lyric & profanity scanning across all uncached source tracks
  const tracksToScan = [];
  const seenTrackIds = new Set();

  for (const source of sources) {
    for (const track of source.tracks) {
      if (!track || !track.id) continue;
      // Skip unresolved temporary paste placeholder IDs
      if (typeof track.id === 'string' && track.id.startsWith('paste-')) continue;

      if (
        track.verification_status &&
        track.is_flagged !== undefined &&
        track.lyrics_lookup !== 'upstream_error'
      ) {
        // already screened (lookups that failed upstream are retried)
      } else if (!seenTrackIds.has(track.id)) {
        seenTrackIds.add(track.id);
        tracksToScan.push(track);
      }
    }
  }

  const screenedTracks = [];
  let summaryDegraded = false;
  if (tracksToScan.length > 0) {
    if (onProgress) {
      try {
        onProgress({
          phase: 'scan',
          scanned: 0,
          total: tracksToScan.length,
          announcement: `Screening lyrics for ${tracksToScan.length} tracks…`,
        });
      } catch (e) {
        console.error('[runStitchPreScreeningPipeline] onProgress error:', e);
      }
    }

    const chunks = chunkTracks(tracksToScan, 10, 15);
    let scannedCount = 0;

    for (const chunk of chunks) {
      if (signal?.aborted) {
        applyScreenedToSources(screenedTracks);
        const abortErr = new Error('Pre-screening aborted');
        abortErr.name = 'AbortError';
        return {
          status: 'aborted',
          sources,
          allTracks: screenedTracks,
          lyricsById: allLyricsById,
          manualReplacements,
          unresolvedLines,
          error: abortErr,
        };
      }

      let batchRes;
      try {
        batchRes = await fetch('/api/scan/playlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tracks: chunk,
            preset,
            custom_blocklist: customBlocklist,
            platform,
            deep_scan_lyrics: true,
          }),
          signal,
        });
      } catch (netErr) {
        applyScreenedToSources(screenedTracks);
        if (onError) {
          try { onError(netErr); } catch (e) { console.error(e); }
        }
        return {
          status: 'error',
          sources,
          allTracks: screenedTracks,
          lyricsById: allLyricsById,
          manualReplacements,
          unresolvedLines,
          error: netErr,
        };
      }

      if (batchRes.status === 429) {
        applyScreenedToSources(screenedTracks);
        const rateErr = new Error('Rate limit exceeded during lyric scan');
        rateErr.status = 429;
        rateErr.isRateLimit = true;
        if (onError) {
          try { onError(rateErr); } catch (e) { console.error(e); }
        }
        return {
          status: 'rate_limited',
          sources,
          allTracks: screenedTracks,
          lyricsById: allLyricsById,
          manualReplacements,
          unresolvedLines,
          error: rateErr,
        };
      }

      if (!batchRes.ok) {
        const errData = await batchRes.json().catch(() => ({}));
        const scanErr = new Error(errData.detail || `Scan request failed with status ${batchRes.status}`);
        scanErr.status = batchRes.status;
        if (onError) {
          try { onError(scanErr); } catch (e) { console.error(e); }
        }
        const fallback = chunk.map((t) => ({
          ...t,
          verification_status: 'scan_error',
          is_flagged: false,
          reasons: [scanErr.message || 'Scan error'],
          detected_terms: [],
          snippets: [],
          total_flagged_count: 0,
          has_lyrics: false,
        }));
        screenedTracks.push(...fallback);
      } else {
        const data = await batchRes.json();
        const batchScanned = data.tracks || [];
        screenedTracks.push(...batchScanned);
        if (data.summary && data.summary.lyrics_service_degraded === true) {
          summaryDegraded = true;
        }
        if (data.lyrics_by_id) {
          Object.assign(allLyricsById, data.lyrics_by_id);
        }
      }

      scannedCount += chunk.length;
      if (onProgress) {
        try {
          onProgress({
            phase: 'scan',
            scanned: scannedCount,
            total: tracksToScan.length,
            announcement: `Screened ${scannedCount} of ${tracksToScan.length} tracks…`,
          });
        } catch (e) {
          console.error('[runStitchPreScreeningPipeline] onProgress error:', e);
        }
      }
    }
  }

  // Update source tracks with screened metadata
  applyScreenedToSources(screenedTracks);

  const allCurrentTracks = sources.flatMap((s) => s.tracks);

  // Step 3: Batch Clean Replacements if cleanMode requires them
  const requiresReplacements =
    cleanMode === 'replace_clean_or_drop' || cleanMode === 'replace_clean_or_keep';

  if (requiresReplacements) {
    const flaggedTracks = allCurrentTracks.filter((t) => t.is_flagged);
    if (flaggedTracks.length > 0) {
      if (onProgress) {
        try {
          onProgress({
            phase: 'replacements',
            current: 0,
            total: flaggedTracks.length,
            announcement: `Finding clean replacements for ${flaggedTracks.length} flagged tracks…`,
          });
        } catch (e) {
          console.error('[runStitchPreScreeningPipeline] onProgress error:', e);
        }
      }

      const bulkOutcome = await runBulkCleanPipeline({
        tracks: flaggedTracks,
        platform,
        signal,
        onProgress: ({ processed, total, announcement }) => {
          if (onProgress) {
            try {
              onProgress({ phase: 'replacements', current: processed, total, announcement });
            } catch (e) {
              console.error('[runStitchPreScreeningPipeline] onProgress error:', e);
            }
          }
        },
        onError,
      });

      // Map any completed replacements before rate-limit or error exit
      if (bulkOutcome.results) {
        for (const [origId, cand] of Object.entries(bulkOutcome.results)) {
          if (cand) {
            manualReplacements[origId] = cand;
          }
        }
      }
      if (bulkOutcome.lyricsById) {
        Object.assign(allLyricsById, bulkOutcome.lyricsById);
      }

      if (bulkOutcome.error?.isRateLimit || bulkOutcome.error?.status === 429) {
        const rateErr = bulkOutcome.error;
        rateErr.status = 429;
        rateErr.isRateLimit = true;
        return {
          status: 'rate_limited',
          sources,
          allTracks: allCurrentTracks,
          lyricsById: allLyricsById,
          manualReplacements,
          unresolvedLines,
          error: rateErr,
        };
      }

      if (bulkOutcome.error) {
        return {
          status: 'error',
          sources,
          allTracks: allCurrentTracks,
          lyricsById: allLyricsById,
          manualReplacements,
          unresolvedLines,
          error: bulkOutcome.error,
        };
      }
    }
  }

  return {
    status: 'complete',
    sources,
    allTracks: allCurrentTracks,
    lyricsById: allLyricsById,
    manualReplacements,
    unresolvedLines,
    error: null,
    lyricsServiceDegraded: summaryDegraded || isLyricsServiceDegraded(screenedTracks),
  };
}
