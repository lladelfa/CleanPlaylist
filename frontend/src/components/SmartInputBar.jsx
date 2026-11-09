import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Plus, Music, Disc, Loader2, Sparkles, X, Library } from 'lucide-react';
import { isSpotifyPlaylistUrl, isYouTubePlaylist } from '../utils/inputParser';
import SpotifyPlaylistHelper from './SpotifyPlaylistHelper';

const SAMPLE_CHIPS = [
  { label: '90s Hip-Hop Sample', query: '90s Hip-Hop' },
  { label: 'Parent Test Sample', query: 'Clean Pop Hits' },
  { label: 'Top Pop Hits', query: 'Top Pop Hits' },
];

export default function SmartInputBar({
  activePlatform = 'spotify',
  onAddSong,
  onAddAlbum,
  onOpenPastePanel,
  onSpotifyPlaylistDetected,
  onLoadPlaylist,
  onOpenLibraryPicker,
  vipMode = false,
  isLoading = false,
  className = '',
}) {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [showPlaylistHelper, setShowPlaylistHelper] = useState(false);
  const inputRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const abortControllerRef = useRef(null);
  const onLoadPlaylistRef = useRef(onLoadPlaylist);
  useEffect(() => {
    onLoadPlaylistRef.current = onLoadPlaylist;
  }, [onLoadPlaylist]);
  const onSpotifyPlaylistDetectedRef = useRef(onSpotifyPlaylistDetected);
  useEffect(() => {
    onSpotifyPlaylistDetectedRef.current = onSpotifyPlaylistDetected;
  }, [onSpotifyPlaylistDetected]);

  const platformLabel = activePlatform === 'spotify' ? 'Spotify' : 'YouTube Music';

  // Clear stale results on platform switch
  useEffect(() => {
    setResults(null);
    setError(null);
    setIsSearching(false);
    setShowPlaylistHelper(false);
  }, [activePlatform]);

  const executeSearch = useCallback(
    async (searchQuery) => {
      const trimmed = searchQuery.trim();
      if (!trimmed) {
        setResults(null);
        setIsSearching(false);
        return;
      }

      if (isYouTubePlaylist(trimmed)) {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        setResults(null);
        setIsSearching(false);
        setShowPlaylistHelper(false);
        return;
      }

      if (isSpotifyPlaylistUrl(trimmed) && (!vipMode || onLoadPlaylistRef.current)) {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        setResults(null);
        setIsSearching(false);
        if (!vipMode) {
          setShowPlaylistHelper(true);
          if (onSpotifyPlaylistDetectedRef.current) {
            onSpotifyPlaylistDetectedRef.current(trimmed);
          }
        }
        return;
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setIsSearching(true);
      setError(null);

      try {
        const res = await fetch('/api/catalog/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: trimmed,
            platform: activePlatform,
            limit: 10,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || 'Catalog search failed');
        }

        const data = await res.json();
        setResults(data);
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(err.message);
          setResults(null);
        }
      } finally {
        setIsSearching(false);
      }
    },
    [activePlatform, vipMode]
  );

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!query.trim()) {
      return;
    }

    if (isSpotifyPlaylistUrl(query) && !vipMode) {
      setShowPlaylistHelper(true);
      setResults(null);
      setIsSearching(false);
      if (onSpotifyPlaylistDetectedRef.current) {
        onSpotifyPlaylistDetectedRef.current(query);
      }
      return;
    }

    if (isYouTubePlaylist(query) || (vipMode && isSpotifyPlaylistUrl(query) && onLoadPlaylistRef.current)) {
      setResults(null);
      setIsSearching(false);
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      executeSearch(query);
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query, executeSearch, vipMode]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    if (!val.trim()) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      setResults(null);
      setIsSearching(false);
      setShowPlaylistHelper(false);
      return;
    }

    if (isSpotifyPlaylistUrl(val) && !vipMode) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      setResults(null);
      setIsSearching(false);
      setShowPlaylistHelper(true);
      if (onSpotifyPlaylistDetectedRef.current) {
        onSpotifyPlaylistDetected(val);
      }
      return;
    }

    setShowPlaylistHelper(false);
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData?.getData('text') || '';
    if (pasted.includes('\n')) {
      e.preventDefault();
      handleClear();
      if (onOpenPastePanel) {
        onOpenPastePanel(pasted);
      }
      return;
    }

    if (isYouTubePlaylist(pasted)) {
      e.preventDefault();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      setResults(null);
      setIsSearching(false);
      setShowPlaylistHelper(false);
      if (onLoadPlaylistRef.current) {
        onLoadPlaylistRef.current(pasted.trim());
        setQuery('');
      }
      return;
    }

    if (isSpotifyPlaylistUrl(pasted)) {
      e.preventDefault();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      setResults(null);
      setIsSearching(false);
      if (!vipMode) {
        setShowPlaylistHelper(true);
        setQuery(pasted);
        if (onSpotifyPlaylistDetectedRef.current) {
          onSpotifyPlaylistDetectedRef.current(pasted.trim());
        }
      } else if (onLoadPlaylistRef.current) {
        setShowPlaylistHelper(false);
        onLoadPlaylistRef.current(pasted.trim());
        setQuery('');
      }
      return;
    }

  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      const trimmed = query.trim();
      if (!trimmed) return;

      if (isYouTubePlaylist(trimmed)) {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        setResults(null);
        setIsSearching(false);
        setShowPlaylistHelper(false);
        if (onLoadPlaylistRef.current) {
          onLoadPlaylistRef.current(trimmed);
          setQuery('');
        }
        return;
      }

      if (isSpotifyPlaylistUrl(trimmed)) {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        setResults(null);
        setIsSearching(false);
        if (!vipMode) {
          setShowPlaylistHelper(true);
          if (onSpotifyPlaylistDetectedRef.current) {
            onSpotifyPlaylistDetectedRef.current(trimmed);
          }
        } else if (onLoadPlaylistRef.current) {
          setShowPlaylistHelper(false);
          onLoadPlaylistRef.current(trimmed);
          setQuery('');
        } else {
          executeSearch(query);
        }
        return;
      }

      executeSearch(query);
    } else if (e.key === 'Escape') {
      handleClear();
    }
  };

  const handleChipClick = (chipQuery) => {
    setQuery(chipQuery);
    setShowPlaylistHelper(false);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    executeSearch(chipQuery);
  };

  const handleClear = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setQuery('');
    setResults(null);
    setIsSearching(false);
    setShowPlaylistHelper(false);
  };

  const totalResults =
    (results?.songs?.length || 0) + (results?.albums?.length || 0);
  const isTrayOpen = Boolean(results && totalResults > 0);

  return (
    <section
      aria-label="Smart Input Bar"
      className={`bg-surface-card rounded-lg border border-border-subtle p-5 shadow-xl relative transition-all ${className}`}
    >
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
        {/* Search Input Box */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-muted">
            <Search className="w-5 h-5" aria-hidden="true" />
          </div>

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            aria-label="Search catalog or paste"
            aria-expanded={isTrayOpen}
            aria-controls="catalog-matches-tray"
            placeholder="Search songs or albums, paste a playlist URL, or paste a track list..."
            className="w-full pl-10 pr-10 sm:pr-48 py-2.5 bg-surface-inset border border-border-subtle rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-ring-focus transition-all"
          />

          <div className="absolute inset-y-0 right-3 flex items-center gap-2">
            {(isSearching || isLoading) ? (
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-surface-elevated border border-border-subtle text-xs font-mono text-brand-tint">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-primary" aria-hidden="true" />
                <span className="hidden sm:inline">
                  {isLoading ? 'Loading Playlist...' : `Matching ${platformLabel} Catalog`}
                </span>
              </span>
            ) : query.trim() ? (
              <button
                type="button"
                onClick={handleClear}
                aria-label="Clear search input"
                className="p-1 rounded hover:bg-surface-elevated text-text-muted hover:text-text-primary transition-colors"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>

        {/* Optional Action Button (e.g. Paste Track List) */}
        {onOpenPastePanel && (
          <button
            type="button"
            onClick={() => onOpenPastePanel && onOpenPastePanel('')}
            aria-label="Paste Track List"
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-surface-elevated hover:bg-surface-highest border border-border-subtle rounded-lg text-sm font-medium text-text-primary hover:text-brand-tint transition-all whitespace-nowrap active:scale-[0.98]"
          >
            <Sparkles className="w-4 h-4 text-brand-tint" aria-hidden="true" />
            <span>Paste Track List</span>
          </button>
        )}

        {/* Spotify VIP Library Picker Button */}
        {activePlatform === 'spotify' && vipMode && onOpenLibraryPicker && (
          <button
            type="button"
            onClick={onOpenLibraryPicker}
            aria-label="Browse Library"
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-surface-elevated hover:bg-surface-highest border border-border-subtle rounded-lg text-sm font-medium text-brand-tint hover:text-brand-primary transition-all whitespace-nowrap active:scale-[0.98]"
          >
            <Library className="w-4 h-4 text-brand-primary" aria-hidden="true" />
            <span>Browse Library</span>
          </button>
        )}
      </div>

      {/* Guided Spotify Playlist Copy Helper Banner */}
      {showPlaylistHelper && (
        <div className="mt-3.5">
          <SpotifyPlaylistHelper
            onFocusPaste={() => onOpenPastePanel && onOpenPastePanel('')}
            onSearchAlbumsInstead={() => {
              setQuery('');
              setShowPlaylistHelper(false);
              setResults(null);
              inputRef.current?.focus();
            }}
            onDismiss={() => setShowPlaylistHelper(false)}
          />
        </div>
      )}

      {/* Sample Chips when empty and no helper */}
      {!query.trim() && !results && !showPlaylistHelper && (
        <div className="mt-3.5 pt-3 border-t border-border-subtle/40 flex items-center gap-2 flex-wrap text-xs text-text-muted">
          <span className="font-mono uppercase tracking-wider text-[11px] text-text-muted">
            Quick Samples:
          </span>
          {SAMPLE_CHIPS.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => handleChipClick(chip.query)}
              className="px-2.5 py-1 rounded-full bg-surface-elevated hover:bg-surface-highest border border-border-subtle text-text-primary hover:text-brand-tint transition-colors text-xs font-medium"
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="mt-3 text-xs text-status-flagged font-medium" role="alert">
          {error}
        </div>
      )}

      {/* Instant Catalog Matches Tray */}
      {isTrayOpen && (
        <div
          id="catalog-matches-tray"
          className="mt-3.5 bg-surface-inset rounded-lg border border-border-subtle p-3.5 transition-all"
        >
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-xs font-mono uppercase tracking-wider text-text-muted">
              Instant Catalog Matches
            </span>
            <span className="text-xs font-mono text-brand-tint font-medium">
              {totalResults} relevant results found
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Left Column: Songs */}
            <div className="space-y-2">
              <div className="text-[11px] font-mono uppercase tracking-wider text-text-muted px-1">
                Songs ({results.songs?.length || 0})
              </div>
              {results.songs && results.songs.length > 0 ? (
                results.songs.map((song) => (
                  <div
                    key={song.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-surface-card/70 hover:bg-surface-card border border-border-subtle/50 hover:border-border-subtle transition-colors gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {song.thumbnail ? (
                        <img
                          src={song.thumbnail}
                          alt={song.title}
                          className="w-9 h-9 rounded object-cover border border-border-subtle shrink-0 bg-surface-low"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded border border-border-subtle flex items-center justify-center bg-surface-low shrink-0 text-text-muted">
                          <Music className="w-4 h-4" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-text-primary truncate">
                          {song.title}
                        </p>
                        <p className="text-[11px] font-mono text-text-muted truncate">
                          {song.artist} {song.album ? `• ${song.album}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      {song.duration && (
                        <span className="text-xs font-mono text-text-muted">
                          {song.duration}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => onAddSong && onAddSong(song)}
                        aria-label={`Add Song ${song.title}`}
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-semibold transition-colors active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Add Song</span>
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-text-muted italic px-1">No song matches.</p>
              )}
            </div>

            {/* Right Column: Albums */}
            <div className="space-y-2">
              <div className="text-[11px] font-mono uppercase tracking-wider text-text-muted px-1">
                Albums ({results.albums?.length || 0})
              </div>
              {results.albums && results.albums.length > 0 ? (
                results.albums.map((album) => (
                  <div
                    key={album.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-surface-card/70 hover:bg-surface-card border border-border-subtle/50 hover:border-border-subtle transition-colors gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {album.thumbnail ? (
                        <img
                          src={album.thumbnail}
                          alt={album.title}
                          className="w-9 h-9 rounded object-cover border border-border-subtle shrink-0 bg-surface-low"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded border border-border-subtle flex items-center justify-center bg-surface-low shrink-0 text-text-muted">
                          <Disc className="w-4 h-4" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-text-primary truncate">
                          {album.title}
                        </p>
                        <p className="text-[11px] font-mono text-text-muted truncate">
                          {album.artist}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="text-xs font-mono text-text-muted">
                        {album.track_count ? `${album.track_count} tracks` : 'Album'}
                      </span>
                      <button
                        type="button"
                        onClick={() => onAddAlbum && onAddAlbum(album)}
                        aria-label={`Add Album ${album.title}`}
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-surface-elevated hover:bg-surface-highest border border-border-subtle text-text-primary text-xs font-semibold transition-colors active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Add Album</span>
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-text-muted italic px-1">No album matches.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
