import React, { useState } from 'react';
import { Search, Plus, X, AlertCircle, FileSearch, Sparkles, ChevronDown, ChevronUp, Music2 } from 'lucide-react';

export default function KeywordsTab({ playlist, scannedTracks, onOpenLyrics }) {
  const [keywords, setKeywords] = useState(['money', 'drugs', 'party', 'alcohol', 'gun']);
  const [inputVal, setInputVal] = useState('');
  const [maxTracks, setMaxTracks] = useState(25);
  const [searching, setSearching] = useState(false);
  const [resultsData, setResultsData] = useState(null);
  const [error, setError] = useState(null);
  const [expandedTracks, setExpandedTracks] = useState({});

  const handleAddKeyword = (e) => {
    e.preventDefault();
    if (!inputVal.trim()) return;
    const w = inputVal.trim().toLowerCase();
    if (!keywords.includes(w)) {
      setKeywords([...keywords, w]);
    }
    setInputVal('');
  };

  const handleRemoveKeyword = (w) => {
    setKeywords(keywords.filter(k => k !== w));
  };

  const handleRunSearch = async () => {
    if (!scannedTracks.length) return;
    if (!keywords.length) {
      setError('Please add at least one keyword to search for.');
      return;
    }

    setSearching(true);
    setError(null);
    try {
      const res = await fetch('/api/scan/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tracks: scannedTracks,
          target_keywords: keywords,
          max_tracks: maxTracks
        })
      });
      if (!res.ok) throw new Error('Keyword search failed');
      const data = await res.json();
      setResultsData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSearching(false);
    }
  };

  const toggleExpand = (id) => {
    setExpandedTracks(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-6">
      {/* Search Configuration Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <FileSearch className="w-5 h-5 text-purple-400" />
            <span>Target Keyword Identifier & Lyric Search</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Scan the lyrics of playlist tracks for exact occurrences of specific words or themes.
          </p>
        </div>

        {/* Keyword Chips & Input */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Target Keywords to Identify in Lyrics
          </label>
          <form onSubmit={handleAddKeyword} className="flex gap-2 mb-2">
            <input
              type="text"
              placeholder="Type a word or phrase (e.g. money, alcohol, fast) and press Enter"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl flex items-center space-x-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </form>

          <div className="flex flex-wrap gap-1.5 mt-2">
            {keywords.map((kw) => (
              <span
                key={kw}
                className="inline-flex items-center space-x-1.5 bg-amber-500/10 text-amber-300 text-xs px-3 py-1 rounded-full border border-amber-500/30"
              >
                <span>{kw}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveKeyword(kw)}
                  className="hover:text-amber-100"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Scan Scope & Trigger */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-3 border-t border-slate-800">
          <div className="flex items-center space-x-3 text-xs text-slate-400">
            <span>Scan lyrics for up to:</span>
            <select
              value={maxTracks}
              onChange={(e) => setMaxTracks(Number(e.target.value))}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 text-xs"
            >
              <option value={15}>15 tracks</option>
              <option value={25}>25 tracks (Recommended)</option>
              <option value={50}>50 tracks</option>
            </select>
          </div>

          <button
            onClick={handleRunSearch}
            disabled={searching || !scannedTracks.length}
            className="flex items-center justify-center space-x-2 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-pink-500 hover:from-amber-400 hover:to-pink-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition disabled:opacity-50"
          >
            {searching ? (
              <Sparkles className="w-4 h-4 animate-spin text-slate-950" />
            ) : (
              <Search className="w-4 h-4 text-slate-950" />
            )}
            <span>{searching ? 'Scanning Song Lyrics...' : 'Search Keywords Across Playlist'}</span>
          </button>
        </div>

        {!scannedTracks.length && (
          <p className="text-xs text-slate-500 italic">
            Please load a playlist in the "Scan & Clean" tab first to search its lyrics.
          </p>
        )}

        {error && (
          <div className="p-3 bg-red-950/40 border border-red-800 rounded-xl text-red-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Results View */}
      {resultsData && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          {/* Summary Box */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-lg font-bold text-white">Keyword Search Findings</h3>
              <p className="text-xs text-slate-400">
                Found {resultsData.summary.total_keyword_occurrences} total keyword occurrences across {resultsData.summary.tracks_with_matches} of {resultsData.summary.scanned_tracks_count} songs.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {resultsData.summary.keywords_searched.map((kw) => (
                <span
                  key={kw}
                  className="bg-slate-800 text-amber-300 text-xs px-2.5 py-1 rounded-lg border border-slate-700 font-mono"
                >
                  "{kw}"
                </span>
              ))}
            </div>
          </div>

          {/* Results Listing */}
          <div className="space-y-3">
            {resultsData.results
              .filter(r => r.matched)
              .map((item) => {
                const isExpanded = expandedTracks[item.id];

                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl border border-amber-900/30 bg-amber-950/10 hover:bg-amber-950/20 transition space-y-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center space-x-3 min-w-0">
                        {item.thumbnail ? (
                          <img
                            src={item.thumbnail}
                            alt={item.title}
                            className="w-10 h-10 rounded-lg object-cover border border-slate-800 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-slate-800 shrink-0 flex items-center justify-center">
                            <Music2 className="w-5 h-5 text-slate-500" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{item.title}</p>
                          <p className="text-xs text-slate-400 truncate">{item.artist}</p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        {/* Keyword Hit Pills */}
                        <div className="hidden sm:flex flex-wrap gap-1">
                          {item.keywords_found.map((kf, i) => (
                            <span
                              key={i}
                              className="text-[11px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30 font-semibold"
                            >
                              {kf.keyword}: {kf.count}x
                            </span>
                          ))}
                        </div>

                        <button
                          onClick={() => toggleExpand(item.id)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg flex items-center space-x-1"
                        >
                          <span>{item.snippets.length} Line(s)</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Expandable Snippets */}
                    {isExpanded && (
                      <div className="pt-2 border-t border-slate-800/80 space-y-1.5 font-mono text-xs">
                        {item.snippets.map((snip, sIdx) => (
                          <div
                            key={sIdx}
                            className="flex items-start bg-slate-950/70 p-2 rounded-lg border border-slate-800"
                          >
                            <span className="text-slate-500 select-none w-10 text-right mr-3 font-semibold">
                              L{snip.line_number}:
                            </span>
                            <span className="text-slate-200">
                              {snip.text.split(/(\s+|[.,!?;:()"])/).map((word, wIdx) => {
                                const clean = word.toLowerCase().trim();
                                const isMatched = snip.matched_keywords?.includes(clean);
                                return isMatched ? (
                                  <mark
                                    key={wIdx}
                                    className="bg-amber-400 text-slate-950 font-bold px-1 rounded mx-0.5"
                                  >
                                    {word}
                                  </mark>
                                ) : (
                                  <React.Fragment key={wIdx}>{word}</React.Fragment>
                                );
                              })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

            {resultsData.results.filter(r => r.matched).length === 0 && (
              <div className="py-8 text-center text-slate-500 text-sm">
                No songs in the scanned set contained any of the target keywords.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
