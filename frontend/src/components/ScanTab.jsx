import React, { useState } from 'react';
import {
  Search, AlertCircle, CheckCircle2, ShieldAlert, Sparkles,
  ArrowRight, FileText, ExternalLink, RefreshCw, Filter, SlidersHorizontal, Plus, X, Save
} from 'lucide-react';

import SavePlaylistModal from './SavePlaylistModal';

export default function ScanTab({
  playlist,
  setPlaylist,
  scannedTracks,
  setScannedTracks,
  onOpenLyrics,
  customBlocklist,
  setCustomBlocklist,
  preset,
  setPreset,
  isAuthenticated,
  onOpenAuth
}) {
  const [urlInput, setUrlInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [deepScan, setDeepScan] = useState(false);
  const [newKeyword, setNewKeyword] = useState('');
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'flagged' | 'clean'
  const [searchQuery, setSearchQuery] = useState('');
  const [cleanCandidates, setCleanCandidates] = useState({});
  const [searchingClean, setSearchingClean] = useState({});
  const [statusMessage, setStatusMessage] = useState(null);

  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);

  // Sample playlists for instant testing
  const samplePlaylists = [
    { label: 'Top Hits Sample', url: 'https://music.youtube.com/playlist?list=PLq9HLaXrThm0pOPOiFHy8a0WHlsIwRANk' },
    { label: 'Popular Pop', url: 'https://music.youtube.com/playlist?list=PLGW0Is3f0CKuxqGlK13w5h4r-62mHJR1Y' }
  ];

  const handleFetchPlaylist = async (urlToFetch) => {
    const targetUrl = urlToFetch || urlInput;
    if (!targetUrl.trim()) return;

    setLoading(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/playlist/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url_or_id: targetUrl, limit: 100 })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to fetch playlist');
      }
      const data = await res.json();
      setPlaylist(data);
      // Initialize scanned tracks with default explicit tag
      const initial = data.tracks.map(t => ({
        ...t,
        is_flagged: t.is_explicit,
        reasons: t.is_explicit ? ['Marked Explicit by YouTube Music'] : [],
        detected_terms: [],
        snippets: [],
        has_lyrics: false
      }));
      setScannedTracks(initial);
      setStatusMessage({ type: 'success', text: `Loaded "${data.title}" with ${data.tracks.length} tracks.` });
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleRunScan = async () => {
    if (!scannedTracks.length) return;

    setScanning(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/scan/playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tracks: scannedTracks,
          preset: preset,
          custom_blocklist: customBlocklist,
          deep_scan_lyrics: deepScan,
          max_deep_scan: 25
        })
      });
      if (!res.ok) throw new Error('Scanning failed');
      const data = await res.json();
      setScannedTracks(data.tracks);
      setStatusMessage({
        type: 'success',
        text: `Scan complete: ${data.summary.flagged_tracks} flagged tracks found out of ${data.summary.total_tracks} tracks.`
      });
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setScanning(false);
    }
  };

  const handleFindClean = async (track) => {
    setSearchingClean(prev => ({ ...prev, [track.id]: true }));
    try {
      const res = await fetch('/api/replacements/find', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: track.title,
          artist: track.artist,
          duration_seconds: track.duration_seconds || 0
        })
      });
      const data = await res.json();
      if (data.found && data.clean_candidate) {
        setCleanCandidates(prev => ({ ...prev, [track.id]: data.clean_candidate }));
      } else {
        setCleanCandidates(prev => ({ ...prev, [track.id]: 'none' }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSearchingClean(prev => ({ ...prev, [track.id]: false }));
    }
  };

  const handleSwapTrack = (originalTrack, cleanTrack) => {
    setScannedTracks(prev =>
      prev.map(t => {
        if (t.id === originalTrack.id) {
          return {
            ...cleanTrack,
            is_flagged: false,
            reasons: [],
            is_explicit: false,
            was_replaced: true,
            original_title: originalTrack.title,
            original_id: originalTrack.id,
            original_set_video_id: originalTrack.setVideoId
          };
        }
        return t;
      })
    );
    setCleanCandidates(prev => {
      const updated = { ...prev };
      delete updated[originalTrack.id];
      return updated;
    });
  };

  const handleAddKeyword = (e) => {
    e.preventDefault();
    if (!newKeyword.trim()) return;
    const word = newKeyword.trim().toLowerCase();
    if (!customBlocklist.includes(word)) {
      setCustomBlocklist([...customBlocklist, word]);
    }
    setNewKeyword('');
  };

  const handleRemoveKeyword = (word) => {
    setCustomBlocklist(customBlocklist.filter(w => w !== word));
  };

  // Filtered tracks
  const displayedTracks = scannedTracks.filter(t => {
    const matchesFilter =
      filterMode === 'all' ||
      (filterMode === 'flagged' && t.is_flagged) ||
      (filterMode === 'clean' && !t.is_flagged);

    const matchesSearch =
      searchQuery === '' ||
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.artist.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  const flaggedCount = scannedTracks.filter(t => t.is_flagged).length;
  const cleanCount = scannedTracks.length - flaggedCount;

  return (
    <div className="space-y-6">
      {/* 1. Playlist Input Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <label className="block text-sm font-semibold text-slate-200 mb-2">
          YouTube Music Playlist URL or Playlist ID
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="e.g. https://music.youtube.com/playlist?list=PL... or PL..."
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
            />
          </div>
          <button
            onClick={() => handleFetchPlaylist()}
            disabled={loading}
            className="flex items-center justify-center space-x-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-medium text-sm rounded-xl transition shadow-lg shadow-purple-600/30 disabled:opacity-50"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            <span>{loading ? 'Fetching...' : 'Load Playlist'}</span>
          </button>
        </div>

        {/* Quick sample chips */}
        <div className="mt-3 flex items-center space-x-2 text-xs text-slate-400 flex-wrap gap-2">
          <span>Try a sample:</span>
          {samplePlaylists.map((sample, idx) => (
            <button
              key={idx}
              onClick={() => {
                setUrlInput(sample.url);
                handleFetchPlaylist(sample.url);
              }}
              className="bg-slate-800 hover:bg-slate-700 text-purple-300 px-2.5 py-1 rounded-lg border border-slate-700 transition"
            >
              {sample.label}
            </button>
          ))}
        </div>

        {statusMessage && (
          <div
            className={`mt-4 p-3 rounded-xl border text-sm flex items-center space-x-2 ${
              statusMessage.type === 'error'
                ? 'bg-red-950/40 border-red-800 text-red-300'
                : 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
            }`}
          >
            {statusMessage.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}
      </div>

      {/* 2. Filter & Preset Settings (shown when playlist loaded) */}
      {playlist && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <SlidersHorizontal className="w-5 h-5 text-purple-400" />
              <h3 className="font-semibold text-slate-200">Scan & Content Settings</h3>
            </div>
            <span className="text-xs text-slate-400">Choose sensitivity & custom blocklist</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Preset Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Filter Preset</label>
              <select
                value={preset}
                onChange={(e) => setPreset(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="moderate">Moderate (Standard Explicit & Slurs)</option>
                <option value="kid_safe">Kid-Safe / Strict (All profanity & vulgarity)</option>
                <option value="slurs_only">Slurs & Hate Speech Only</option>
                <option value="custom">Custom Blocklist Only</option>
              </select>
            </div>

            {/* Deep Scan Toggle */}
            <div className="flex flex-col justify-end">
              <label className="flex items-center space-x-2 cursor-pointer bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={deepScan}
                  onChange={(e) => setDeepScan(e.target.checked)}
                  className="rounded text-purple-600 focus:ring-purple-500"
                />
                <span className="text-slate-200 text-xs font-medium">
                  Deep Lyric Scan (fetches full lyrics)
                </span>
              </label>
            </div>

            {/* Action Button */}
            <div className="flex flex-col justify-end">
              <button
                onClick={handleRunScan}
                disabled={scanning}
                className="flex items-center justify-center space-x-2 w-full py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-medium text-sm rounded-xl transition shadow-lg shadow-purple-600/20 disabled:opacity-50"
              >
                {scanning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span>{scanning ? 'Analyzing Songs...' : 'Run Content Scan'}</span>
              </button>
            </div>
          </div>

          {/* Custom Keywords Blocklist */}
          <div className="pt-2">
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Custom Keyword Blocklist (words you want flagged specifically)
            </label>
            <form onSubmit={handleAddKeyword} className="flex gap-2 mb-2">
              <input
                type="text"
                placeholder="Add custom word (e.g. beer, gun, shut up) and press Enter"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl flex items-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Word</span>
              </button>
            </form>

            {customBlocklist.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {customBlocklist.map((word) => (
                  <span
                    key={word}
                    className="inline-flex items-center space-x-1 bg-purple-950/60 text-purple-300 text-xs px-2.5 py-1 rounded-full border border-purple-800/60"
                  >
                    <span>{word}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveKeyword(word)}
                      className="hover:text-purple-100"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Scanned Tracks Results */}
      {playlist && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          {/* Header Stats */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-xl font-bold text-white">{playlist.title}</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                By {playlist.author} • {scannedTracks.length} tracks total
              </p>
            </div>

            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-1.5 bg-red-950/40 text-red-400 text-xs px-3 py-1.5 rounded-xl border border-red-900/50 hidden sm:flex">
                <ShieldAlert className="w-4 h-4" />
                <span className="font-semibold">{flaggedCount} Flagged</span>
              </div>
              <div className="flex items-center space-x-1.5 bg-emerald-950/40 text-emerald-400 text-xs px-3 py-1.5 rounded-xl border border-emerald-900/50 hidden sm:flex">
                <CheckCircle2 className="w-4 h-4" />
                <span className="font-semibold">{cleanCount} Clean</span>
              </div>

              {isAuthenticated ? (
                <button
                  onClick={() => setIsSaveModalOpen(true)}
                  className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-xl flex items-center space-x-2 transition shadow"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Playlist...</span>
                </button>
              ) : (
                <button
                  onClick={onOpenAuth}
                  className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-xl flex items-center space-x-2 border border-slate-700 transition"
                >
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span>Connect to Save</span>
                </button>
              )}
            </div>
          </div>

          {/* Controls: Filter & Search */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="flex space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800 w-full sm:w-auto">
              <button
                onClick={() => setFilterMode('all')}
                className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                  filterMode === 'all' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                All ({scannedTracks.length})
              </button>
              <button
                onClick={() => setFilterMode('flagged')}
                className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                  filterMode === 'flagged' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Flagged ({flaggedCount})
              </button>
              <button
                onClick={() => setFilterMode('clean')}
                className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                  filterMode === 'clean' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Clean ({cleanCount})
              </button>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search tracks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* Track List */}
          <div className="space-y-2">
            {displayedTracks.map((track, idx) => {
              const cleanCand = cleanCandidates[track.id];
              const isSearching = searchingClean[track.id];

              return (
                <div
                  key={track.id || idx}
                  className={`p-3 rounded-xl border transition flex flex-col md:flex-row items-start md:items-center justify-between gap-3 ${
                    track.is_flagged
                      ? 'bg-red-950/15 border-red-900/40 hover:bg-red-950/25'
                      : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-850'
                  }`}
                >
                  {/* Left: Thumbnail & Song Info */}
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <span className="text-slate-500 text-xs font-mono w-6 text-right select-none">
                      {idx + 1}
                    </span>
                    {track.thumbnail ? (
                      <img
                        src={track.thumbnail}
                        alt={track.title}
                        className="w-10 h-10 rounded-lg object-cover border border-slate-800 shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-slate-800 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-semibold text-white truncate">{track.title}</p>
                        {track.is_explicit && (
                          <span className="bg-red-950 text-red-400 text-[10px] px-1 py-0.2 rounded border border-red-800 font-bold shrink-0">
                            E
                          </span>
                        )}
                        {track.was_replaced && (
                          <span className="bg-emerald-950 text-emerald-300 text-[10px] px-1.5 py-0.5 rounded border border-emerald-800 font-medium shrink-0">
                            Swapped Clean
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 truncate">{track.artist}</p>
                      {track.reasons?.length > 0 && (
                        <p className="text-[11px] text-red-400 mt-0.5">
                          {track.reasons.join(' • ')}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Middle / Right: Actions & Clean Replacement */}
                  <div className="flex items-center space-x-2 shrink-0 self-end md:self-center">
                    <span className="text-xs text-slate-500 font-mono hidden sm:inline mr-2">
                      {track.duration}
                    </span>

                    {/* View Lyrics */}
                    <button
                      onClick={() => onOpenLyrics(track)}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg flex items-center space-x-1 transition"
                    >
                      <FileText className="w-3.5 h-3.5 text-slate-400" />
                      <span>Lyrics</span>
                    </button>

                    {/* Clean Replacement Search for Flagged Tracks */}
                    {track.is_flagged && !cleanCand && (
                      <button
                        onClick={() => handleFindClean(track)}
                        disabled={isSearching}
                        className="px-2.5 py-1.5 bg-purple-950/80 hover:bg-purple-900 border border-purple-800/60 text-purple-200 text-xs font-medium rounded-lg flex items-center space-x-1 transition disabled:opacity-50"
                      >
                        {isSearching ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                        )}
                        <span>{isSearching ? 'Searching...' : 'Find Clean Edit'}</span>
                      </button>
                    )}

                    {/* Candidate found */}
                    {cleanCand && cleanCand !== 'none' && (
                      <button
                        onClick={() => handleSwapTrack(track, cleanCand)}
                        className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg flex items-center space-x-1 shadow transition"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Swap to Clean</span>
                      </button>
                    )}

                    {cleanCand === 'none' && (
                      <span className="text-[11px] text-slate-500 italic">No clean version found</span>
                    )}

                    <a
                      href={track.video_url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 text-slate-500 hover:text-slate-300 transition"
                      title="Open in YouTube Music"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              );
            })}

            {displayedTracks.length === 0 && (
              <div className="py-12 text-center text-slate-500 text-sm">
                No tracks match the selected filter.
              </div>
            )}
          </div>
        </div>
      )}

      <SavePlaylistModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        playlist={playlist}
        displayedTracks={scannedTracks}
        onSaveSuccess={() => {
          setStatusMessage({ type: 'success', text: 'Playlist saved successfully!' });
        }}
      />
    </div>
  );
}
