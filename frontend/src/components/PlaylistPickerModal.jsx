import React, { useCallback, useEffect, useState } from "react";
import {
  X,
  Search,
  ChevronLeft,
  ChevronRight,
  Music,
  Loader2,
  AlertCircle,
  Library,
} from "lucide-react";

const PAGE_LIMIT = 20;

export default function PlaylistPickerModal({
  isOpen,
  onClose,
  onSelectPlaylist,
}) {
  const [playlists, setPlaylists] = useState([]);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [searchFilter, setSearchFilter] = useState("");

  const closeAndReset = useCallback(() => {
    setOffset(0);
    setTotal(0);
    setPlaylists([]);
    setHasNext(false);
    setSearchFilter("");
    setError(null);
    setLoading(false);
    setRetryCount(0);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeAndReset();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeAndReset]);

  useEffect(() => {
    if (!isOpen) return undefined;

    let isCancelled = false;

    const fetchPlaylists = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/spotify/playlists?limit=${PAGE_LIMIT}&offset=${offset}`
        );
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          if (res.status === 401 || res.status === 403) {
            throw new Error(
              "Unable to access your Spotify library. Reconnect your Spotify account, then retry."
            );
          }
          throw new Error(
            errData.detail || "Failed to load your Spotify playlists. Please retry."
          );
        }
        const data = await res.json();
        if (!isCancelled) {
          setPlaylists(data.items || []);
          setTotal(data.total ?? 0);
          setHasNext(Boolean(data.has_next));
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err.message || "Failed to load your Spotify playlists. Please retry.");
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    fetchPlaylists();
    return () => {
      isCancelled = true;
    };
  }, [isOpen, offset, retryCount]);

  if (!isOpen) return null;

  const filteredPlaylists = playlists.filter((playlist) =>
    (playlist.name || "")
      .toLowerCase()
      .includes(searchFilter.trim().toLowerCase())
  );

  const handleSelect = (playlist) => {
    const targetUrl =
      playlist.url || `https://open.spotify.com/playlist/${playlist.id}`;
    onSelectPlaylist(targetUrl);
    closeAndReset();
  };

  const handlePrev = () => {
    if (offset > 0 && !loading) {
      setSearchFilter("");
      setOffset((prev) => Math.max(0, prev - PAGE_LIMIT));
    }
  };

  const handleNext = () => {
    if (hasNext && !loading) {
      setSearchFilter("");
      setOffset((prev) => prev + PAGE_LIMIT);
    }
  };

  const startIdx = total === 0 ? 0 : offset + 1;
  const endIdx = Math.min(offset + playlists.length, total);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-backdrop/80 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) closeAndReset();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="playlist-picker-modal-title"
        className="bg-surface-card border border-border-subtle rounded-2xl p-6 max-w-xl w-full shadow-2xl relative flex flex-col max-h-[85vh]"
      >
        <button
          type="button"
          onClick={closeAndReset}
          aria-label="Close playlist picker"
          className="absolute top-4 right-4 p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-elevated transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-card"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>

        <div className="flex items-center space-x-2.5 mb-4 pr-8">
          <div className="p-2 bg-surface-elevated border border-border-subtle rounded-xl text-brand-primary">
            <Library className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h2
              id="playlist-picker-modal-title"
              className="text-xl font-bold text-text-primary"
            >
              Spotify Playlist Picker
            </h2>
            <p className="text-xs text-text-secondary">
              Browse your library and click a playlist to load it
            </p>
          </div>
        </div>

        <div className="relative mb-4">
          <Search
            className="w-4 h-4 absolute left-3.5 top-3 text-text-muted"
            aria-hidden="true"
          />
          <input
            type="text"
            aria-label="Filter playlists by name"
            placeholder="Filter loaded playlists by name..."
            value={searchFilter}
            onChange={(event) => setSearchFilter(event.target.value)}
            className="w-full bg-surface-inset border border-border-subtle rounded-xl pl-10 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-card"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[260px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-text-secondary space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-brand-primary" aria-hidden="true" />
              <span className="text-sm">Loading your Spotify playlists...</span>
            </div>
          ) : error ? (
            <div
              role="alert"
              className="bg-status-flagged-bg border border-status-flagged-border p-4 rounded-xl flex items-start gap-3 text-status-flagged text-sm"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex-1 space-y-3">
                <p>{error}</p>
                <button
                  type="button"
                  onClick={() => setRetryCount((count) => count + 1)}
                  className="px-3 py-1.5 rounded-lg bg-surface-card border border-border-subtle text-text-primary hover:bg-surface-elevated font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-card"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : filteredPlaylists.length === 0 ? (
            <div className="py-14 text-center text-text-muted text-sm">
              {searchFilter
                ? "No playlists on this page match your filter."
                : "No Spotify playlists found in your library."}
            </div>
          ) : (
            filteredPlaylists.map((playlist) => (
              <button
                key={playlist.id}
                type="button"
                onClick={() => handleSelect(playlist)}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-surface-inset hover:bg-surface-elevated border border-border-subtle hover:border-brand-primary transition text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-card"
              >
                <div className="flex items-center space-x-3 min-w-0">
                  {playlist.thumbnail ? (
                    <img
                      src={playlist.thumbnail}
                      alt=""
                      className="w-12 h-12 rounded-lg object-cover border border-border-subtle shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-surface-elevated border border-border-subtle flex items-center justify-center text-text-muted shrink-0">
                      <Music className="w-5 h-5" aria-hidden="true" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text-primary group-hover:text-brand-primary transition truncate">
                      {playlist.name}
                    </p>
                    <p className="text-xs text-text-secondary truncate">
                      By {playlist.owner || "Unknown"} • {playlist.tracks_total ?? 0} tracks
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        <div className="flex items-center justify-between pt-4 mt-4 border-t border-border-subtle">
          <span className="text-xs text-text-secondary" aria-live="polite">
            {total > 0
              ? `Showing ${startIdx}–${endIdx} of ${total}`
              : "0 playlists"}
          </span>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handlePrev}
              disabled={offset === 0 || loading}
              className="flex items-center space-x-1 px-3 py-1.5 bg-surface-elevated hover:bg-surface-inset text-text-primary text-xs font-medium rounded-lg border border-border-subtle transition disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-card"
            >
              <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Prev</span>
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={!hasNext || loading}
              className="flex items-center space-x-1 px-3 py-1.5 bg-surface-elevated hover:bg-surface-inset text-text-primary text-xs font-medium rounded-lg border border-border-subtle transition disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-card"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
