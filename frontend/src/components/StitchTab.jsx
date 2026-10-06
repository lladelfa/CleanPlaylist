import React, { useState } from 'react';
import {
  Shuffle, Plus, Trash2, Download, CheckCircle2, ShieldAlert,
  Sliders, Music, FileSpreadsheet, FileCode, Sparkles, RefreshCw
} from 'lucide-react';

export default function StitchTab({ initialPlaylist, initialScannedTracks }) {
  const [playlistPool, setPlaylistPool] = useState(
    initialPlaylist ? [{ ...initialPlaylist, tracks: initialScannedTracks || initialPlaylist.tracks }] : []
  );
  const [newUrl, setNewUrl] = useState('');
  const [loadingNew, setLoadingNew] = useState(false);
  const [orderMode, setOrderMode] = useState('sequential');
  const [dedupMode, setDedupMode] = useState('exact_id');
  const [cleanMode, setCleanMode] = useState('replace_clean_or_drop');
  const [playlistTitle, setPlaylistTitle] = useState('My Clean Stitched Playlist');
  const [stitching, setStitching] = useState(false);
  const [stitchedResult, setStitchedResult] = useState(null);
  const [error, setError] = useState(null);

  // Sync if initialPlaylist changed
  React.useEffect(() => {
    if (initialPlaylist && !playlistPool.some(p => p.id === initialPlaylist.id)) {
      setPlaylistPool(prev => [
        ...prev,
        { ...initialPlaylist, tracks: initialScannedTracks || initialPlaylist.tracks }
      ]);
    }
  }, [initialPlaylist, initialScannedTracks]);

  const handleAddPlaylist = async () => {
    if (!newUrl.trim()) return;

    setLoadingNew(true);
    setError(null);
    try {
      const res = await fetch('/api/playlist/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url_or_id: newUrl, limit: 100 })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to fetch playlist');
      }
      const data = await res.json();
      setPlaylistPool(prev => [...prev, data]);
      setNewUrl('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingNew(false);
    }
  };

  const handleRemovePlaylist = (idx) => {
    setPlaylistPool(prev => prev.filter((_, i) => i !== idx));
  };

  const handleStitch = async () => {
    if (playlistPool.length === 0) {
      setError('Please add at least one playlist to stitch.');
      return;
    }

    setStitching(true);
    setError(null);
    try {
      const res = await fetch('/api/stitch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playlists: playlistPool,
          order_mode: orderMode,
          deduplication_mode: dedupMode,
          clean_mode: cleanMode
        })
      });
      if (!res.ok) throw new Error('Stitching failed');
      const data = await res.json();
      setStitchedResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setStitching(false);
    }
  };

  const handleExport = async (format) => {
    if (!stitchedResult?.tracks?.length) return;

    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format: format,
          tracks: stitchedResult.tracks,
          playlist_title: playlistTitle
        })
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
    <div className="space-y-6">
      {/* 1. Playlist Sources Pool */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <Shuffle className="w-5 h-5 text-purple-400" />
            <span>Playlist Stitching Studio</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Add multiple YouTube Music playlists together into a single cohesive, cleaned collection.
          </p>
        </div>

        {/* Input to add another playlist */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Paste another YouTube Music Playlist URL..."
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button
            onClick={handleAddPlaylist}
            disabled={loadingNew}
            className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs rounded-xl flex items-center space-x-1.5 transition disabled:opacity-50"
          >
            {loadingNew ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            <span>Add Playlist</span>
          </button>
        </div>

        {/* Current Pool Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
          {playlistPool.map((pl, idx) => (
            <div
              key={idx}
              className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex items-center justify-between"
            >
              <div className="flex items-center space-x-3 min-w-0">
                {pl.thumbnail ? (
                  <img src={pl.thumbnail} alt="" className="w-10 h-10 rounded-lg object-cover border border-slate-800 shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                    <Music className="w-4 h-4 text-slate-500" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white truncate">{pl.title}</p>
                  <p className="text-[11px] text-slate-400">{pl.tracks?.length || 0} tracks</p>
                </div>
              </div>
              <button
                onClick={() => handleRemovePlaylist(idx)}
                className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-800 transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}

          {playlistPool.length === 0 && (
            <div className="col-span-full py-6 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
              No playlists added yet. Load one in "Scan & Clean" or paste a URL above!
            </div>
          )}
        </div>
      </div>

      {/* 2. Stitching & Clean Configuration */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
          <Sliders className="w-4 h-4 text-purple-400" />
          <h3 className="font-semibold text-sm text-slate-200">Merge & Filter Settings</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Order Mode */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Track Ordering</label>
            <select
              value={orderMode}
              onChange={(e) => setOrderMode(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200"
            >
              <option value="sequential">Sequential (Playlist 1 then 2)</option>
              <option value="interleave">Interleaved (Alternating tracks)</option>
              <option value="title_asc">Alphabetical by Song Title</option>
              <option value="artist_asc">Alphabetical by Artist</option>
            </select>
          </div>

          {/* Deduplication Mode */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Deduplication</label>
            <select
              value={dedupMode}
              onChange={(e) => setDedupMode(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200"
            >
              <option value="exact_id">Remove Exact Duplicate Video IDs</option>
              <option value="title_artist">Fuzzy Deduplicate (Same Title & Artist)</option>
              <option value="none">Allow All Duplicates</option>
            </select>
          </div>

          {/* Clean Rules */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Offensive / Explicit Filter</label>
            <select
              value={cleanMode}
              onChange={(e) => setCleanMode(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200"
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
              placeholder="Unified Playlist Name..."
              value={playlistTitle}
              onChange={(e) => setPlaylistTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200"
            />
          </div>

          <button
            onClick={handleStitch}
            disabled={stitching || playlistPool.length === 0}
            className="flex items-center justify-center space-x-2 px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs rounded-xl shadow-lg transition disabled:opacity-50"
          >
            {stitching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>{stitching ? 'Stitching...' : 'Stitch Playlists'}</span>
          </button>
        </div>

        {error && (
          <p className="text-xs text-red-400 bg-red-950/40 p-2.5 rounded-lg border border-red-800">
            {error}
          </p>
        )}
      </div>

      {/* 3. Stitched Results & Export */}
      {stitchedResult && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          {/* Stats Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-lg font-bold text-white">{playlistTitle}</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Unified playlist ready • {stitchedResult.stats.final_track_count} final tracks
              </p>
            </div>

            {/* Export Buttons */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleExport('m3u')}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium rounded-xl flex items-center space-x-1.5 shadow"
                title="Download M3U8 Playlist File"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export M3U8</span>
              </button>
              <button
                onClick={() => handleExport('csv')}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl flex items-center space-x-1.5 border border-slate-700"
                title="Download CSV Spreadsheet"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span>CSV</span>
              </button>
              <button
                onClick={() => handleExport('json')}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl flex items-center space-x-1.5 border border-slate-700"
                title="Download JSON Data"
              >
                <FileCode className="w-3.5 h-3.5 text-blue-400" />
                <span>JSON</span>
              </button>
            </div>
          </div>

          {/* Stat Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
              <span className="block text-xs text-slate-400">Total Input Tracks</span>
              <span className="text-lg font-bold text-white">{stitchedResult.stats.total_input_tracks}</span>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
              <span className="block text-xs text-slate-400">Duplicates Removed</span>
              <span className="text-lg font-bold text-amber-400">{stitchedResult.stats.duplicates_removed}</span>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
              <span className="block text-xs text-slate-400">Replaced with Clean</span>
              <span className="text-lg font-bold text-emerald-400">{stitchedResult.stats.tracks_replaced}</span>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
              <span className="block text-xs text-slate-400">Explicit Dropped</span>
              <span className="text-lg font-bold text-red-400">{stitchedResult.stats.tracks_dropped}</span>
            </div>
          </div>

          {/* Stitched Track List */}
          <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
            {stitchedResult.tracks.map((t, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2.5 bg-slate-950/60 rounded-xl border border-slate-800/80 hover:bg-slate-850 text-xs"
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <span className="text-slate-500 font-mono w-6 text-right select-none">{idx + 1}</span>
                  {t.thumbnail ? (
                    <img src={t.thumbnail} alt="" className="w-8 h-8 rounded-lg object-cover border border-slate-800 shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-slate-800 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-white truncate">{t.title}</p>
                    <p className="text-slate-400 truncate">{t.artist}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  {t.source_playlist_title && (
                    <span className="hidden sm:inline bg-slate-800 text-slate-400 px-2 py-0.5 rounded text-[10px]">
                      {t.source_playlist_title}
                    </span>
                  )}
                  {t.replaced_original && (
                    <span className="bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded text-[10px] border border-emerald-800">
                      Clean Swap
                    </span>
                  )}
                  <span className="text-slate-500 font-mono">{t.duration}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
