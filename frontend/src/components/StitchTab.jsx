import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Shuffle, Plus, Trash2, Download,
  Sliders, Music, Disc, ListMusic, Library, RefreshCw, Sparkles,
  Search, X, FileSpreadsheet, ExternalLink
} from 'lucide-react';
import NoticeBanner from './NoticeBanner';
import PasteTrackListPanel from './PasteTrackListPanel';
import VerificationStatusBadge from './VerificationStatusBadge';
import FinishLineBar from './FinishLineBar';
import { runStitchPreScreeningPipeline } from '../utils/screeningPipeline';
import { getTrackCanonicalUrl } from '../utils/finishLine';

function formatDuration(track) {
  if (typeof track?.duration === 'string' && track.duration.includes(':')) {
    return track.duration;
  }
  if (typeof track?.duration_seconds === 'number' && track.duration_seconds > 0) {
    const mins = Math.floor(track.duration_seconds / 60);
    const secs = String(Math.floor(track.duration_seconds % 60)).padStart(2, '0');
    return `${mins}:${secs}`;
  }
  return typeof track?.duration === 'string' ? track.duration : '0:00';
}

export default function StitchTab({
  initialPlaylist,
  initialScannedTracks,
  activePlatform = 'ytmusic',
  workingList = [],
  lyricsByTrackId = {},
  vipMode = false,
  preset = 'moderate',
  customBlocklist = [],
  onNotice,
}) {
  const abortControllerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const [playlistPool, setPlaylistPool] = useState(
    initialPlaylist
      ? [
          {
            ...initialPlaylist,
            tracks: initialScannedTracks || initialPlaylist.tracks || [],
            type: initialPlaylist.type || 'playlist',
          },
        ]
      : []
  );

  const [stitchLyricsCache, setStitchLyricsCache] = useState({});
  const [screeningProgressText, setScreeningProgressText] = useState(null);
  const [unresolvedLinesNotice, setUnresolvedLinesNotice] = useState([]);
  const [rateLimitError, setRateLimitError] = useState(null);
  const [newUrl, setNewUrl] = useState('');
  const [loadingNew, setLoadingNew] = useState(false);

  // Paste Panel State
  const [isPasteOpen, setIsPasteOpen] = useState(false);

  // Album Search State
  const [showAlbumSearch, setShowAlbumSearch] = useState(false);
  const [albumQuery, setAlbumQuery] = useState('');
  const [albumResults, setAlbumResults] = useState([]);
  const [isSearchingAlbums, setIsSearchingAlbums] = useState(false);
  const [loadingAlbumId, setLoadingAlbumId] = useState(null);

  // Merge & Stitch Settings
  const [orderMode, setOrderMode] = useState('sequential');
  const [dedupMode, setDedupMode] = useState('exact_id');
  const [cleanMode, setCleanMode] = useState('replace_clean_or_drop');
  const [playlistTitle, setPlaylistTitle] = useState('My Clean Stitched Playlist');
  const [stitching, setStitching] = useState(false);
  const [stitchedResult, setStitchedResult] = useState(null);
  const [error, setError] = useState(null);

  // Sync if initialPlaylist changed
  useEffect(() => {
    if (!initialPlaylist) return;
    setPlaylistPool((prev) => {
      if (prev.some((p) => p.id === initialPlaylist.id)) return prev;
      return [
        ...prev,
        {
          ...initialPlaylist,
          tracks: initialScannedTracks || initialPlaylist.tracks || [],
          type: initialPlaylist.type || 'playlist',
        },
      ];
    });
  }, [initialPlaylist, initialScannedTracks]);

  // Combined Track Quota calculations
  const totalTracks = useMemo(() => {
    return playlistPool.reduce((sum, p) => sum + (p.tracks?.length || 0), 0);
  }, [playlistPool]);

  const quotaCap = 50;
  const isOverQuota = !vipMode && totalTracks > quotaCap;
  const quotaPercent = Math.min(100, Math.round((totalTracks / quotaCap) * 100));

  // Trigger 1: Add YouTube Music Playlist URL
  const handleAddPlaylist = async () => {
    const trimmed = newUrl.trim();
    if (!trimmed) return;

    setLoadingNew(true);
    setError(null);
    try {
      const res = await fetch('/api/playlist/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url_or_id: trimmed,
          limit: 100,
          platform: activePlatform || 'ytmusic',
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to fetch playlist');
      }
      const data = await res.json();
      setPlaylistPool((prev) => [
        ...prev,
        {
          id: data.id || `yt-${Date.now()}`,
          title: data.title || 'YouTube Playlist',
          tracks: data.tracks || [],
          type: 'playlist',
          thumbnail: data.thumbnail || null,
        },
      ]);
      setNewUrl('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingNew(false);
    }
  };

  // Trigger 2: Searched Album
  const handleSearchAlbums = async (e) => {
    if (e) e.preventDefault();
    const trimmed = albumQuery.trim();
    if (!trimmed) return;

    setIsSearchingAlbums(true);
    setError(null);
    try {
      const res = await fetch('/api/catalog/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: trimmed,
          platform: activePlatform || 'ytmusic',
          limit: 10,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to search albums');
      }
      const data = await res.json();
      setAlbumResults(data.albums || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSearchingAlbums(false);
    }
  };

  const handleSelectAlbum = async (album) => {
    setLoadingAlbumId(album.id);
    setError(null);
    try {
      const res = await fetch('/api/catalog/album', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          album_id: album.id,
          platform: activePlatform || 'ytmusic',
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to load album tracks');
      }
      const data = await res.json();
      setPlaylistPool((prev) => [
        ...prev,
        {
          id: data.id || album.id,
          title: data.title || album.title,
          artist: data.artist || album.artist,
          tracks: data.tracks || [],
          type: 'album',
          thumbnail: data.thumbnail || album.thumbnail || null,
        },
      ]);
      setShowAlbumSearch(false);
      setAlbumQuery('');
      setAlbumResults([]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingAlbumId(null);
    }
  };

  // Trigger 3: Paste Track List
  const handlePasteResolve = (lines) => {
    if (!lines || lines.length === 0) return;
    const newSource = {
      id: `paste-${Date.now()}`,
      title: `Pasted Track List (${lines.length} tracks)`,
      tracks: lines.map((line, idx) => ({
        id: `paste-${idx}-${Date.now()}`,
        title: line,
        artist: 'Unknown',
      })),
      type: 'paste',
      rawLines: lines,
    };
    setPlaylistPool((prev) => [...prev, newSource]);
    setIsPasteOpen(false);
  };

  // Trigger 4: Add Current Working List (1-Click)
  const handleAddWorkingList = () => {
    if (!workingList || workingList.length === 0) return;

    const sourceTitle = initialPlaylist?.title
      ? `Working List (${initialPlaylist.title})`
      : 'Current Working List';

    const newSource = {
      id: `working-list-${Date.now()}`,
      title: sourceTitle,
      tracks: [...workingList],
      type: 'working_list',
      thumbnail: initialPlaylist?.thumbnail || null,
    };

    setPlaylistPool((prev) => [...prev, newSource]);

    // Preserve any cached lyrics in local stitch lyrics cache
    if (lyricsByTrackId) {
      setStitchLyricsCache((prev) => {
        const next = { ...prev };
        workingList.forEach((t) => {
          if (t?.id && lyricsByTrackId[t.id]) {
            next[t.id] = lyricsByTrackId[t.id];
          }
        });
        return next;
      });
    }
  };

  // Remove source
  const handleRemoveSource = (idx) => {
    setPlaylistPool((prev) => prev.filter((_, i) => i !== idx));
  };

  // Stitch Execution with Automated Pre-Screening Pipeline
  const handleStitch = async () => {
    if (playlistPool.length === 0) {
      setError('Please add at least one playlist to stitch.');
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setStitching(true);
    setError(null);
    setRateLimitError(null);
    setScreeningProgressText('Starting pre-screening…');

    try {
      // 1. Run Automated Stitch Pre-Screening Pipeline
      const preScreenResult = await runStitchPreScreeningPipeline({
        playlistPool,
        cleanMode,
        platform: activePlatform || 'ytmusic',
        preset,
        customBlocklist,
        cachedLyrics: stitchLyricsCache,
        signal,
        onProgress: ({ announcement }) => {
          setScreeningProgressText(announcement);
        },
        onError: (err) => {
          console.warn('[StitchTab] Pre-screening warning:', err);
        },
      });

      // 2. Surface any unresolved lines without blocking valid tracks
      if (preScreenResult.unresolvedLines && preScreenResult.unresolvedLines.length > 0) {
        setUnresolvedLinesNotice(preScreenResult.unresolvedLines);
      } else {
        setUnresolvedLinesNotice([]);
      }

      // 3. Handle rate limit pause cleanly
      if (
        preScreenResult.status === 'rate_limited' ||
        preScreenResult.error?.isRateLimit ||
        preScreenResult.error?.status === 429
      ) {
        setRateLimitError(preScreenResult.error || new Error('Rate limit encountered'));
        if (preScreenResult.sources) {
          setPlaylistPool(preScreenResult.sources);
        }
        if (preScreenResult.lyricsById) {
          setStitchLyricsCache(preScreenResult.lyricsById);
        }
        return;
      }

      if (preScreenResult.status === 'error' && preScreenResult.error) {
        throw preScreenResult.error;
      }

      // 4. Update pool with resolved tracks & screened metadata, and save lyrics
      if (preScreenResult.sources) {
        setPlaylistPool(preScreenResult.sources);
      }
      if (preScreenResult.lyricsById) {
        setStitchLyricsCache(preScreenResult.lyricsById);
      }

      setScreeningProgressText('Merging playlists…');

      // 5. Invoke backend stitch engine with manual_replacements
      const res = await fetch('/api/stitch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playlists: preScreenResult.sources || playlistPool,
          order_mode: orderMode,
          deduplication_mode: dedupMode,
          clean_mode: cleanMode,
          manual_replacements: preScreenResult.manualReplacements || {},
          platform: activePlatform || 'ytmusic',
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Stitching failed');
      }

      const data = await res.json();
      setStitchedResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setStitching(false);
      setScreeningProgressText(null);
    }
  };

  const handleRetryPreScreening = () => {
    handleStitch();
  };

  // Export
  const handleExport = async (format) => {
    if (!stitchedResult?.tracks?.length) return;
    setError(null);

    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format: format,
          tracks: stitchedResult.tracks,
          playlist_title: playlistTitle,
          platform: activePlatform || 'ytmusic',
        }),
      });
      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = format === 'm3u' ? 'm3u8' : format;
      a.download = `${playlistTitle.toLowerCase().replace(/\s+/g, '_')}.${ext}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className={`space-y-6 ${stitchedResult?.tracks?.length > 0 ? 'pb-36 md:pb-24' : ''}`}>
      {/* 1. Multi-Source Input Pool Card */}
      <section
        aria-label="Multi-Source Input Pool"
        className="bg-surface-card border border-border-subtle rounded-2xl p-5 shadow-xl space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-text-primary flex items-center space-x-2">
              <Shuffle className="w-5 h-5 text-brand-primary" aria-hidden="true" />
              <span>Playlist Stitching Studio</span>
            </h2>
            <p className="text-xs text-text-muted mt-1">
              Merge multiple music sources into a single cohesive, cleaned collection up to a 50-track quota.
            </p>
          </div>

          {/* Trigger 4: Add Current Working List */}
          <button
            type="button"
            onClick={handleAddWorkingList}
            disabled={!workingList || workingList.length === 0}
            aria-label="Add Current Working List"
            className="px-4 py-2.5 bg-surface-elevated hover:bg-surface-card text-text-primary border border-border-subtle font-medium text-xs rounded-xl flex items-center space-x-2 transition disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            <Library className="w-4 h-4 text-brand-primary" aria-hidden="true" />
            <span>Add Current Working List</span>
            {workingList && workingList.length > 0 && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-inset text-text-muted">
                {workingList.length}
              </span>
            )}
          </button>
        </div>

        {/* Track Quota Progress Meter */}
        <div className="space-y-2 pt-1 border-t border-border-subtle">
          <div className="flex items-center justify-between text-xs">
            <span
              className={`font-medium ${
                isOverQuota ? 'text-status-caution font-semibold' : 'text-text-secondary'
              }`}
            >
              Combined Track Quota: {totalTracks} / {quotaCap} Staged
            </span>
            <span className="text-text-muted font-mono text-[11px]">
              {quotaPercent}%
            </span>
          </div>
          <div
            role="progressbar"
            aria-label="Combined Track Quota"
            aria-valuenow={totalTracks}
            aria-valuemin={0}
            aria-valuemax={quotaCap}
            className="w-full h-2 rounded-full bg-surface-inset overflow-hidden border border-border-subtle"
          >
            <div
              className={`h-full transition-all duration-300 ${
                isOverQuota ? 'bg-status-caution' : 'bg-brand-primary'
              }`}
              style={{ width: `${quotaPercent}%` }}
            />
          </div>

          {/* Inline Caution Notice when quota exceeded in public mode */}
          {isOverQuota && (
            <NoticeBanner
              type="caution"
              message="Combined staged tracks exceed 50-track quota. Public Stitch Studio will truncate output to the first 50 tracks during merge unless tracks are removed."
              className="mt-2"
            />
          )}
        </div>

        {/* Source Ingest Controls (Triggers 1, 2, 3) */}
        <div className="space-y-3 pt-2 border-t border-border-subtle">
          <div className="flex flex-col sm:flex-row gap-2">
            {/* Trigger 1: YouTube Music Playlist URL Input */}
            <div className="flex-1 flex gap-2">
              <input
                type="text"
                aria-label="YouTube Music Playlist URL"
                placeholder="Paste YouTube Music Playlist URL..."
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddPlaylist();
                  }
                }}
                className="flex-1 bg-surface-inset border border-border-subtle rounded-xl px-4 py-2.5 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-primary"
              />
              <button
                type="button"
                onClick={handleAddPlaylist}
                disabled={loadingNew || !newUrl.trim()}
                aria-label="Add Playlist"
                className="px-4 py-2.5 bg-brand-primary hover:bg-brand-hover text-white font-medium text-xs rounded-xl flex items-center space-x-1.5 transition disabled:opacity-50 shrink-0"
              >
                {loadingNew ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                <span>Add Playlist</span>
              </button>
            </div>

            {/* Quick Action Triggers: Album Search & Paste */}
            <div className="flex items-center gap-2">
              {/* Trigger 2: Search Album */}
              <button
                type="button"
                onClick={() => setShowAlbumSearch((prev) => !prev)}
                aria-label="Search Album"
                className={`px-3 py-2.5 border font-medium text-xs rounded-xl flex items-center space-x-1.5 transition ${
                  showAlbumSearch
                    ? 'bg-brand-primary text-white border-brand-primary'
                    : 'bg-surface-elevated hover:bg-surface-card text-text-primary border-border-subtle'
                }`}
              >
                <Disc className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Search Album</span>
              </button>

              {/* Trigger 3: Paste Track List */}
              <button
                type="button"
                onClick={() => setIsPasteOpen(true)}
                aria-label="Paste Track List"
                className="px-3 py-2.5 bg-surface-elevated hover:bg-surface-card text-text-primary border border-border-subtle font-medium text-xs rounded-xl flex items-center space-x-1.5 transition"
              >
                <ListMusic className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Paste Track List</span>
              </button>
            </div>
          </div>

          {/* Searched Album Panel */}
          {showAlbumSearch && (
            <div className="bg-surface-inset border border-border-subtle rounded-xl p-3 space-y-3">
              <form onSubmit={handleSearchAlbums} className="flex gap-2">
                <input
                  type="text"
                  aria-label="Search album name"
                  placeholder="Search album name..."
                  value={albumQuery}
                  onChange={(e) => setAlbumQuery(e.target.value)}
                  className="flex-1 bg-surface-card border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
                <button
                  type="submit"
                  disabled={isSearchingAlbums || !albumQuery.trim()}
                  aria-label="Search"
                  className="px-3 py-2 bg-brand-primary hover:bg-brand-hover text-white text-xs font-medium rounded-lg flex items-center space-x-1.5 transition disabled:opacity-50"
                >
                  {isSearchingAlbums ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Search className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                  <span>Search</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAlbumSearch(false)}
                  aria-label="Close album search"
                  className="p-2 text-text-muted hover:text-text-primary rounded-lg"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </form>

              {albumResults.length > 0 && (
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {albumResults.map((album) => (
                    <div
                      key={album.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-surface-card border border-border-subtle hover:border-border-default transition text-xs"
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        {album.thumbnail ? (
                          <img
                            src={album.thumbnail}
                            alt=""
                            className="w-8 h-8 rounded object-cover border border-border-subtle shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded bg-surface-elevated flex items-center justify-center shrink-0">
                            <Disc className="w-4 h-4 text-text-muted" aria-hidden="true" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-text-primary truncate">{album.title}</p>
                          <p className="text-[11px] text-text-muted truncate">{album.artist}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSelectAlbum(album)}
                        disabled={loadingAlbumId === album.id}
                        aria-label={`Add album ${album.title}`}
                        className="px-2.5 py-1.5 bg-brand-primary hover:bg-brand-hover text-white text-[11px] font-medium rounded-md flex items-center space-x-1 transition disabled:opacity-50 shrink-0"
                      >
                        {loadingAlbumId === album.id ? (
                          <RefreshCw className="w-3 h-3 animate-spin" aria-hidden="true" />
                        ) : (
                          <Plus className="w-3 h-3" aria-hidden="true" />
                        )}
                        <span>Add</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Paste Track List Modal / Panel */}
        <PasteTrackListPanel
          isOpen={isPasteOpen}
          onClose={() => setIsPasteOpen(false)}
          onResolve={handlePasteResolve}
        />

        {/* 2-Column Source Cards Grid */}
        <div className="space-y-2 pt-2 border-t border-border-subtle">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Staged Sources ({playlistPool.length})
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {playlistPool.map((source, idx) => (
              <div
                key={source.id || idx}
                className="bg-surface-elevated border border-border-subtle rounded-xl p-3 flex items-center justify-between gap-3 shadow-sm hover:border-border-default transition"
              >
                <div className="flex items-center space-x-3 min-w-0">
                  {source.thumbnail ? (
                    <img
                      src={source.thumbnail}
                      alt=""
                      className="w-10 h-10 rounded-lg object-cover border border-border-subtle shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-surface-inset border border-border-subtle flex items-center justify-center shrink-0">
                      {source.type === 'album' ? (
                        <Disc className="w-5 h-5 text-text-muted" aria-hidden="true" />
                      ) : source.type === 'paste' ? (
                        <ListMusic className="w-5 h-5 text-text-muted" aria-hidden="true" />
                      ) : source.type === 'working_list' ? (
                        <Library className="w-5 h-5 text-brand-primary" aria-hidden="true" />
                      ) : (
                        <Music className="w-5 h-5 text-text-muted" aria-hidden="true" />
                      )}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-text-primary truncate">{source.title}</p>
                    <p className="text-[11px] text-text-muted">
                      {source.tracks?.length || 0} tracks
                      {source.artist ? ` • ${source.artist}` : ''}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveSource(idx)}
                  aria-label={`Remove source ${source.title}`}
                  className="text-text-muted hover:text-status-danger p-1.5 rounded-lg hover:bg-surface-inset transition shrink-0"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            ))}

            {playlistPool.length === 0 && (
              <div className="col-span-full py-8 text-center text-text-muted text-xs border border-dashed border-border-subtle rounded-xl bg-surface-inset">
                No sources added to the pool yet. Add a YouTube Music playlist, search an album, paste a song list, or add your current working list above!
              </div>
            )}
          </div>
        </div>

        {error && (
          <p className="text-xs text-status-danger bg-status-danger-bg p-2.5 rounded-lg border border-status-danger-border">
            {error}
          </p>
        )}

        {!stitchedResult && unresolvedLinesNotice.length > 0 && (
          <NoticeBanner
            type="caution"
            message={`${unresolvedLinesNotice.length} pasted song request(s) could not be resolved and were omitted: ${unresolvedLinesNotice.map((u) => u.line).join(', ')}`}
            onDismiss={() => setUnresolvedLinesNotice([])}
            className="mt-2"
          />
        )}

        {rateLimitError && (
          <NoticeBanner
            type="warning"
            message="Rate limit encountered during pre-screening. Evaluated progress has been saved. Please wait a moment and try again."
            actionLabel="Retry Pre-Screening"
            onAction={handleRetryPreScreening}
            onDismiss={() => setRateLimitError(null)}
            className="mt-2"
          />
        )}
      </section>

      {/* 2. Merge & Stitch Configuration */}
      <section
        aria-label="Merge & Filter Settings"
        className="bg-surface-card border border-border-subtle rounded-2xl p-5 shadow-xl space-y-4"
      >
        <div className="sr-only" aria-live="polite">
          {screeningProgressText}
        </div>

        <div className="flex items-center space-x-2 border-b border-border-subtle pb-3">
          <Sliders className="w-4 h-4 text-brand-primary" aria-hidden="true" />
          <h3 className="font-semibold text-sm text-text-primary">Merge & Filter Settings</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Order Mode */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Track Ordering</label>
            <select
              value={orderMode}
              onChange={(e) => setOrderMode(e.target.value)}
              className="w-full bg-surface-inset border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary"
            >
              <option value="sequential">Sequential (Playlist 1 then 2)</option>
              <option value="interleave">Interleaved (Alternating tracks)</option>
              <option value="title_asc">Alphabetical by Song Title</option>
              <option value="artist_asc">Alphabetical by Artist</option>
            </select>
          </div>

          {/* Deduplication Mode */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Deduplication</label>
            <select
              value={dedupMode}
              onChange={(e) => setDedupMode(e.target.value)}
              className="w-full bg-surface-inset border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary"
            >
              <option value="exact_id">Remove Exact Duplicate Video IDs</option>
              <option value="title_artist">Fuzzy Deduplicate (Same Title & Artist)</option>
              <option value="none">Allow All Duplicates</option>
            </select>
          </div>

          {/* Clean Rules */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Offensive / Explicit Filter</label>
            <select
              value={cleanMode}
              onChange={(e) => setCleanMode(e.target.value)}
              className="w-full bg-surface-inset border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary"
            >
              <option value="replace_clean_or_drop">Swap with Clean Version, or Drop</option>
              <option value="replace_clean_or_keep">Swap with Clean Version, or Keep</option>
              <option value="exclude_flagged">Strict Clean (Drop all flagged)</option>
              <option value="keep_all">Keep All (No filtering)</option>
            </select>
          </div>
        </div>

        {/* Playlist Name Input & Stitch Trigger */}
        <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex-1">
            <input
              type="text"
              aria-label="Unified Playlist Name"
              placeholder="Unified Playlist Name..."
              value={playlistTitle}
              onChange={(e) => setPlaylistTitle(e.target.value)}
              className="w-full bg-surface-inset border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary"
            />
          </div>

          <button
            type="button"
            aria-label={stitching ? (screeningProgressText || 'Stitching in progress') : 'Stitch Playlists & Clean'}
            onClick={handleStitch}
            disabled={stitching || playlistPool.length === 0}
            className="flex items-center justify-center space-x-2 px-6 py-2.5 bg-brand-primary hover:bg-brand-hover text-white font-semibold text-xs rounded-xl shadow-lg transition disabled:opacity-50"
          >
            {stitching ? <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Sparkles className="w-4 h-4" aria-hidden="true" />}
            <span>{stitching ? (screeningProgressText || 'Stitching...') : 'Stitch Playlists & Clean'}</span>
          </button>
        </div>
      </section>

      {/* 3. Stitched Results & Export */}
      {stitchedResult && (
        <section
          aria-label="Stitched Clean Queue"
          className="bg-surface-card border border-border-subtle rounded-2xl p-5 shadow-xl space-y-4"
        >
          {/* Stats Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border-subtle pb-4">
            <div>
              <h3 className="text-lg font-bold text-text-primary">{playlistTitle}</h3>
              <p className="text-xs text-text-muted mt-0.5">
                Unified playlist ready • {stitchedResult.stats?.final_track_count || stitchedResult.tracks?.length || 0} final tracks
              </p>
            </div>

            {/* Export Buttons */}
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => handleExport('m3u')}
                className="px-3 py-1.5 bg-brand-primary hover:bg-brand-hover text-white text-xs font-medium rounded-xl flex items-center space-x-1.5 shadow"
                title="Download M3U8 Playlist File"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Export M3U8</span>
              </button>
              <button
                type="button"
                onClick={() => handleExport('csv')}
                className="px-3 py-1.5 bg-surface-elevated hover:bg-surface-card text-text-primary text-xs font-medium rounded-xl flex items-center space-x-1.5 border border-border-subtle"
                title="Download CSV Spreadsheet"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-status-clean" aria-hidden="true" />
                <span>CSV</span>
              </button>
            </div>
          </div>

          {/* Merge Statistics 5-Pill Summary */}
          {stitchedResult.stats && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 py-3 border-b border-border-subtle">
              <div className="bg-surface-elevated border border-border-subtle p-3 rounded-xl text-center">
                <p className="text-[11px] text-text-muted">Total Input</p>
                <p className="text-lg font-bold text-text-primary">
                  {stitchedResult.stats.initial_total_tracks ?? stitchedResult.stats.total_input_tracks ?? stitchedResult.tracks?.length ?? 0}
                </p>
              </div>
              <div className="bg-surface-elevated border border-border-subtle p-3 rounded-xl text-center">
                <p className="text-[11px] text-text-muted">Duplicates Removed</p>
                <p className="text-lg font-bold text-brand-tint">
                  {stitchedResult.stats.duplicates_removed ?? 0}
                </p>
              </div>
              <div className="bg-surface-elevated border border-border-subtle p-3 rounded-xl text-center">
                <p className="text-[11px] text-text-muted">Replaced Clean</p>
                <p className="text-lg font-bold text-status-clean">
                  {stitchedResult.stats.tracks_replaced ?? 0}
                </p>
              </div>
              <div className="bg-surface-elevated border border-border-subtle p-3 rounded-xl text-center">
                <p className="text-[11px] text-text-muted">Dropped Flagged</p>
                <p className="text-lg font-bold text-status-danger">
                  {stitchedResult.stats.tracks_dropped ?? 0}
                </p>
              </div>
              <div className="bg-surface-elevated border border-border-subtle p-3 rounded-xl text-center col-span-2 sm:col-span-1">
                <p className="text-[11px] text-text-muted">Final Track Count</p>
                <p className="text-lg font-bold text-brand-primary">
                  {stitchedResult.stats.final_track_count ?? stitchedResult.tracks?.length ?? 0}
                </p>
              </div>
            </div>
          )}

          {/* Skipped / Unresolved Lines NoticeBanner */}
          {unresolvedLinesNotice.length > 0 && (
            <NoticeBanner
              type="warning"
              message={`${unresolvedLinesNotice.length} pasted song request(s) could not be resolved and were omitted: ${unresolvedLinesNotice.map((u) => u.line || u).join(', ')}`}
              onDismiss={() => setUnresolvedLinesNotice([])}
              className="mt-2"
            />
          )}

          {/* Stitched Output Track Table */}
          {stitchedResult.tracks && stitchedResult.tracks.length > 0 && (
            <div className="divide-y divide-border-subtle border border-border-subtle/50 rounded-xl overflow-hidden bg-surface-inset/30">
              <div className="max-h-96 overflow-y-auto divide-y divide-border-subtle/40">
                {stitchedResult.tracks.map((track, i) => {
                  const trackUrl = getTrackCanonicalUrl(track, activePlatform);
                  return (
                    <div
                      key={`${track.id || 'track'}-${i}`}
                      className="flex items-center justify-between gap-3 p-3 hover:bg-surface-elevated/40 transition-colors text-xs"
                    >
                      {/* Left: Index & Origin & Title/Artist */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="text-[11px] font-mono text-text-muted w-6 text-right shrink-0">
                          {i + 1}
                        </span>

                        {/* Origin Badge */}
                        {track.source_playlist_title && (
                          <span
                            className="text-[10px] px-2 py-0.5 rounded-md bg-surface-elevated text-text-secondary border border-border-subtle shrink-0 truncate max-w-[140px]"
                            title={track.source_playlist_title}
                          >
                            {track.source_playlist_title}
                          </span>
                        )}

                        {/* Title & Artist */}
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-text-primary truncate">{track.title}</p>
                          <p className="text-[11px] text-text-muted truncate">{track.artist}</p>
                        </div>
                      </div>

                      {/* Right: Duration, VerificationStatusBadge, Link */}
                      <div className="flex items-center gap-2.5 shrink-0">
                        <span className="text-[11px] font-mono text-text-muted">
                          {formatDuration(track)}
                        </span>

                        <VerificationStatusBadge track={track} />

                        {trackUrl && (
                          <a
                            href={trackUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Open ${track.title} on ${activePlatform === 'spotify' ? 'Spotify' : 'YouTube Music'}`}
                            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {/* 4. Isolated Finish Line Bar for Stitched Result */}
      {stitchedResult?.tracks?.length > 0 && (
        <FinishLineBar
          tracks={stitchedResult.tracks}
          activePlatform={activePlatform}
          playlistTitle={playlistTitle}
          primaryAction="play"
          onNotice={onNotice}
          className="mt-6"
        />
      )}
    </div>
  );
}
