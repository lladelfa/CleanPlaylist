import React, { useState } from 'react';
import { Search, Plus, X, AlertCircle, FileSearch, Sparkles, ChevronDown, ChevronUp, Music2 } from 'lucide-react';
import { searchLyricsKeywords } from '../utils/lyricEvaluator';
import { maskWord } from '../utils/masking';

function renderHighlightedLine(text, matchedKeywords = [], isMasked = false) {
  if (!text) return null;
  if (!matchedKeywords || matchedKeywords.length === 0) {
    return text;
  }
  const sortedKws = [...matchedKeywords].sort((a, b) => b.length - a.length);
  const escapedKws = sortedKws.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const tokenRegex = new RegExp(`(\\b(?:${escapedKws})\\b)`, 'gi');
  const parts = text.split(tokenRegex);

  return parts.map((part, pIdx) => {
    const isMatch = sortedKws.some(kw => kw.toLowerCase() === part.toLowerCase());
    if (isMatch) {
      return (
        <mark
          key={pIdx}
          className="bg-brand-primary/20 text-brand-primary border border-brand-primary/30 font-semibold px-1 py-0.5 rounded mx-0.5"
        >
          {isMasked ? maskWord(part) : part}
        </mark>
      );
    }
    return <React.Fragment key={pIdx}>{part}</React.Fragment>;
  });
}

export default function KeywordsTab({
  workingList,
  lyricsByTrackId = {},
  setLyricsByTrackId,
  activePlatform = 'ytmusic',
  onNavigateToScan,
  scannedTracks = [],
  playlist: _playlist,
  onOpenLyrics,
  isMasked = true,
}) {
  const [keywords, setKeywords] = useState(['money', 'drugs', 'party', 'alcohol', 'gun']);
  const [inputVal, setInputVal] = useState('');
  const [searching, setSearching] = useState(false);
  const [resultsData, setResultsData] = useState(null);
  const [error, setError] = useState(null);
  const [expandedTracks, setExpandedTracks] = useState({});

  const stagedTracks = workingList !== undefined
    ? (Array.isArray(workingList) ? workingList : [])
    : (Array.isArray(scannedTracks) ? scannedTracks : []);

  const handleAddKeyword = (e) => {
    e.preventDefault();
    if (!inputVal.trim()) return;
    const rawTokens = inputVal.split(/[,;\n]+/);
    const newKeywords = [...keywords];
    rawTokens.forEach(token => {
      const cleaned = token.trim().toLowerCase();
      if (cleaned && !newKeywords.includes(cleaned)) {
        newKeywords.push(cleaned);
      }
    });
    setKeywords(newKeywords);
    setInputVal('');
  };

  const handleRemoveKeyword = (w) => {
    setKeywords(keywords.filter(k => k !== w));
  };

  const toggleExpand = (id) => {
    setExpandedTracks(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleRunSearch = async () => {
    if (!stagedTracks.length) return;
    if (!keywords.length) {
      setError('Please add at least one keyword to search for.');
      return;
    }

    setSearching(true);
    setError(null);

    const cachedLyricsMap = lyricsByTrackId && typeof lyricsByTrackId === 'object' ? lyricsByTrackId : {};
    const uncachedTracks = stagedTracks.filter(t => cachedLyricsMap[t.id] === undefined);
    const newlyFetchedLyrics = {};
    const uncachedResultsMap = {};

    try {
      // Chunk uncached tracks in batches of <= 15
      const CHUNK_SIZE = 15;
      for (let i = 0; i < uncachedTracks.length; i += CHUNK_SIZE) {
        const chunk = uncachedTracks.slice(i, i + CHUNK_SIZE);
        try {
          const res = await fetch('/api/scan/keywords', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tracks: chunk,
              target_keywords: keywords,
              max_tracks: chunk.length,
              platform: activePlatform || 'ytmusic',
            }),
          });

          if (!res.ok) {
            throw new Error('Keyword search failed');
          }

          const data = await res.json();
          if (data.lyrics_by_id) {
            Object.assign(newlyFetchedLyrics, data.lyrics_by_id);
            if (typeof setLyricsByTrackId === 'function') {
              setLyricsByTrackId(prev => ({ ...prev, ...data.lyrics_by_id }));
            }
          }
          if (Array.isArray(data.results)) {
            data.results.forEach(r => {
              uncachedResultsMap[r.id] = r;
            });
          }
        } catch (chunkErr) {
          if (Object.keys(newlyFetchedLyrics).length > 0 && typeof setLyricsByTrackId === 'function') {
            setLyricsByTrackId(prev => ({ ...prev, ...newlyFetchedLyrics }));
          }
          throw chunkErr;
        }
      }

      // Combine cached evaluation and uncached results in original staged order
      const combinedResults = stagedTracks.map(track => {
        const cachedLyrics = cachedLyricsMap[track.id];
        if (cachedLyrics !== undefined) {
          if (cachedLyrics) {
            const evalRes = searchLyricsKeywords(cachedLyrics, keywords);
            return {
              id: track.id,
              title: track.title,
              artist: track.artist,
              thumbnail: track.thumbnail,
              ytmusic_video_id: track.ytmusic_video_id,
              has_lyrics: true,
              matched: evalRes.matched,
              total_matches: evalRes.total_matches,
              keywords_found: evalRes.keywords_found,
              snippets: evalRes.snippets,
            };
          }
          return {
            id: track.id,
            title: track.title,
            artist: track.artist,
            thumbnail: track.thumbnail,
            ytmusic_video_id: track.ytmusic_video_id,
            has_lyrics: false,
            matched: false,
            total_matches: 0,
            keywords_found: [],
            snippets: [],
          };
        }

        const backendRes = uncachedResultsMap[track.id];
        if (backendRes) {
          return backendRes;
        }

        return {
          id: track.id,
          title: track.title,
          artist: track.artist,
          thumbnail: track.thumbnail,
          ytmusic_video_id: track.ytmusic_video_id,
          has_lyrics: false,
          matched: false,
          total_matches: 0,
          keywords_found: [],
          snippets: [],
        };
      });

      const matchedTracksCount = combinedResults.filter(r => r.matched).length;
      const totalOccurrences = combinedResults.reduce((sum, r) => sum + (r.total_matches || 0), 0);
      const lyricsUnavailableCount = combinedResults.filter(r => !r.has_lyrics).length;

      setResultsData({
        summary: {
          keywords_searched: keywords,
          scanned_tracks_count: stagedTracks.length,
          tracks_with_matches: matchedTracksCount,
          total_keyword_occurrences: totalOccurrences,
          lyrics_unavailable_count: lyricsUnavailableCount,
        },
        results: combinedResults,
      });
    } catch (err) {
      setError(err.message || 'Keyword search failed');
    } finally {
      setSearching(false);
    }
  };

  // Empty Working List Studio Card
  if (stagedTracks.length === 0) {
    return (
      <div className="max-w-md mx-auto my-12 text-center p-8 bg-surface-card border border-border-subtle rounded-2xl space-y-4 shadow-xl">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-surface-inset flex items-center justify-center text-brand-primary">
          <Music2 className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-bold text-text-primary">No Tracks in Working List</h2>
          <p className="text-xs text-text-muted">
            Add or import songs in the Scan & Clean tab first to scan their lyrics for target keywords.
          </p>
        </div>
        <button
          type="button"
          onClick={onNavigateToScan}
          aria-label="Add Tracks in Scan & Clean"
          className="w-full sm:w-auto px-6 py-2.5 min-h-[44px] bg-brand-primary hover:bg-brand-primary/90 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center justify-center space-x-2 mx-auto"
        >
          <span>Add Tracks in Scan & Clean</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Accessible live status for search progress */}
      <div aria-live="polite" className="sr-only">
        {searching ? `Searching song lyrics across ${stagedTracks.length} tracks...` : ''}
      </div>

      {/* Search Configuration Card */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 shadow-xl space-y-4">
        <div>
          <h2 className="text-lg font-bold text-text-primary flex items-center space-x-2">
            <FileSearch className="w-5 h-5 text-brand-primary" />
            <span>Keyword Search Workbench</span>
          </h2>
          <p className="text-xs text-text-muted mt-1">
            Scan lyrics across your staged playlist for exact occurrences of specific words or themes without mutating track verification status.
          </p>
        </div>

        {/* Keyword Chips & Input */}
        <div className="space-y-2">
          <label htmlFor="custom-keyword-input" className="block text-xs font-semibold text-text-primary">
            Target Keywords to Identify in Lyrics
          </label>
          <form onSubmit={handleAddKeyword} className="flex flex-col sm:flex-row gap-2">
            <input
              id="custom-keyword-input"
              type="text"
              placeholder="Type a word or phrase (e.g. money, alcohol, fast) and press Enter"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              className="flex-1 bg-surface-inset border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-primary min-h-[44px]"
            />
            <button
              type="submit"
              aria-label="Add keyword"
              className="px-4 py-2 min-h-[44px] bg-surface-elevated hover:bg-surface-card text-text-primary text-xs font-medium rounded-xl border border-border-subtle flex items-center justify-center space-x-1.5 transition"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Add Keyword</span>
            </button>
          </form>

          <div className="flex flex-wrap gap-2 pt-1">
            {keywords.map((kw) => (
              <span
                key={kw}
                className="bg-surface-elevated text-text-primary border border-border-subtle px-3 py-1 rounded-full text-xs font-medium inline-flex items-center space-x-1.5"
              >
                <span>{isMasked ? maskWord(kw) : kw}</span>
                <button
                  type="button"
                  aria-label={`Remove keyword ${kw}`}
                  onClick={() => handleRemoveKeyword(kw)}
                  className="min-h-[44px] min-w-[44px] -my-2 -mr-2 inline-flex items-center justify-center text-text-muted hover:text-text-primary transition"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </span>
            ))}
            {keywords.length === 0 && (
              <span className="text-xs text-text-muted italic">
                No keywords selected. Add at least one keyword to search.
              </span>
            )}
          </div>
        </div>

        {/* Search Action Trigger */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-3 border-t border-border-subtle">
          <p className="text-xs text-text-muted">
            Searching across {stagedTracks.length} song{stagedTracks.length === 1 ? '' : 's'} in working list.
          </p>

          <button
            type="button"
            onClick={handleRunSearch}
            disabled={searching || !stagedTracks.length || !keywords.length}
            aria-label="Search Keywords Across Working List"
            className="flex items-center justify-center space-x-2 px-6 py-2.5 bg-brand-primary hover:bg-brand-primary/90 text-white font-bold text-xs rounded-xl shadow-lg transition disabled:opacity-50 min-h-[44px]"
          >
            {searching ? (
              <Sparkles className="w-4 h-4 animate-spin text-white" aria-hidden="true" />
            ) : (
              <Search className="w-4 h-4 text-white" aria-hidden="true" />
            )}
            <span>{searching ? 'Scanning Song Lyrics...' : 'Search Keywords Across Working List'}</span>
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-950/40 border border-red-800 rounded-xl text-red-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Results View */}
      {resultsData && (
        <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 shadow-xl space-y-4">
          {/* Summary Box */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border-subtle pb-4">
            <div>
              <h3 className="text-lg font-bold text-text-primary">Keyword Search Findings</h3>
              <p className="text-xs text-text-muted mt-0.5">
                Found {resultsData.summary.total_keyword_occurrences} total keyword occurrences across {resultsData.summary.tracks_with_matches} of {resultsData.summary.scanned_tracks_count} songs ({resultsData.summary.lyrics_unavailable_count} without lyrics).
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {resultsData.summary.keywords_searched.map((kw) => (
                <span
                  key={kw}
                  className="bg-surface-elevated text-brand-tint text-xs px-2.5 py-1 rounded-lg border border-border-subtle font-mono"
                >
                  "{isMasked ? maskWord(kw) : kw}"
                </span>
              ))}
            </div>
          </div>

          {/* Results Listing */}
          <div className="space-y-3">
            {resultsData.results
              .filter(r => r.matched)
              .map((item) => {
                const isExpanded = !!expandedTracks[item.id];

                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl border border-border-subtle bg-surface-inset/50 hover:bg-surface-inset transition space-y-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center space-x-3 min-w-0">
                        {item.thumbnail ? (
                          <img
                            src={item.thumbnail}
                            alt={item.title}
                            onClick={() => onOpenLyrics && onOpenLyrics(item)}
                            className={`w-10 h-10 rounded-lg object-cover border border-border-subtle shrink-0 ${onOpenLyrics ? 'cursor-pointer hover:opacity-80' : ''}`}
                          />
                        ) : (
                          <div
                            onClick={() => onOpenLyrics && onOpenLyrics(item)}
                            className={`w-10 h-10 rounded-lg bg-surface-elevated shrink-0 flex items-center justify-center ${onOpenLyrics ? 'cursor-pointer hover:opacity-80' : ''}`}
                          >
                            <Music2 className="w-5 h-5 text-text-muted" aria-hidden="true" />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => onOpenLyrics && onOpenLyrics(item)}
                          disabled={!onOpenLyrics}
                          aria-label={`Open lyrics for ${item.title}`}
                          className={`min-h-[44px] min-w-0 text-left ${onOpenLyrics ? 'hover:underline cursor-pointer' : 'cursor-default'}`}
                        >
                          <p className="text-sm font-semibold text-text-primary truncate">{item.title}</p>
                          <p className="text-xs text-text-muted truncate">{item.artist}</p>
                        </button>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        {/* Keyword Hit Pills */}
                        <div className="flex flex-wrap gap-1">
                          {item.keywords_found.map((kf, i) => (
                            <span
                              key={i}
                              className="text-[11px] bg-brand-primary/10 text-brand-tint px-2.5 py-0.5 rounded-full border border-brand-primary/20 font-semibold"
                            >
                              {isMasked ? maskWord(kf.keyword) : kf.keyword}: {kf.count}x
                            </span>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleExpand(item.id)}
                          aria-expanded={isExpanded}
                          aria-label={`${item.snippets.length} matching lines for ${item.title}`}
                          className="px-3 py-1.5 min-h-[44px] bg-surface-elevated hover:bg-surface-card text-text-primary text-xs font-medium rounded-lg border border-border-subtle flex items-center space-x-1 transition"
                        >
                          <span>{item.snippets.length} matching lines {isExpanded ? '↑' : '↓'}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Expandable Snippets */}
                    {isExpanded && (
                      <div className="pt-2 border-t border-border-subtle space-y-1.5 font-mono text-xs">
                        {item.snippets.map((snip, sIdx) => (
                          <div
                            key={sIdx}
                            className="flex items-start bg-surface-card/80 p-2.5 rounded-lg border border-border-subtle"
                          >
                            <span className="font-mono text-xs text-text-muted select-none w-12 text-right mr-3 shrink-0">
                              [L{String(snip.line_number).padStart(2, '0')}]
                            </span>
                            <span className="text-text-primary break-words flex-1">
                              {renderHighlightedLine(snip.text, snip.matched_keywords, isMasked)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

            {resultsData.results.filter(r => r.matched).length === 0 && (
              <div className="py-8 text-center text-text-muted text-sm">
                No songs in the scanned set contained any of the target keywords.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
