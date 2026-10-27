import React, { useState, useEffect } from "react";
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
  const [hasPrev, setHasPrev] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchFilter, setSearchFilter] = useState("");

  useEffect(() => {
    if (!isOpen) return;

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
          throw new Error(
            errData.detail || "Failed to load your Spotify playlists"
          );
        }
        const data = await res.json();
        if (!isCancelled) {
          setPlaylists(data.items || []);
          setTotal(data.total ?? 0);
          setHasNext(Boolean(data.has_next));
          setHasPrev(Boolean(data.has_prev));
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err.message);
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
  }, [isOpen, offset]);

  if (!isOpen) return null;

  const filteredPlaylists = playlists.filter((pl) =>
    (pl.name || "").toLowerCase().includes(searchFilter.trim().toLowerCase())
  );

  const handleSelect = (playlist) => {
    const targetUrl =
      playlist.url || `https://open.spotify.com/playlist/${playlist.id}`;
    onSelectPlaylist(targetUrl);
    onClose();
  };

  const handlePrev = () => {
    if (hasPrev && offset >= PAGE_LIMIT) {
      setSearchFilter("");
      setOffset((prev) => Math.max(0, prev - PAGE_LIMIT));
    }
  };

  const handleNext = () => {
    if (hasNext) {
      setSearchFilter("");
      setOffset((prev) => prev + PAGE_LIMIT);
    }
  };

  const startIdx = total === 0 ? 0 : offset + 1;
  const endIdx = Math.min(offset + playlists.length, total);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-xl w-full shadow-2xl relative flex flex-col max-h-[85vh]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center space-x-2.5 mb-4">
          <div className="p-2 bg-green-950/60 border border-green-800/60 rounded-xl text-green-400">
            <Library className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">
              Spotify Playlist Picker
            </h2>
            <p className="text-xs text-slate-400">
              Browse your library and click a playlist to load it
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative mb-4">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
          <input
            type="text"
            placeholder="Filter loaded playlists by name..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* Playlist List Body */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[260px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-green-400" />
              <span className="text-sm">Loading your Spotify playlists...</span>
            </div>
          ) : error ? (
            <div className="bg-red-950/40 border border-red-900/50 p-4 rounded-xl flex items-start space-x-2 text-red-300 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          ) : filteredPlaylists.length === 0 ? (
            <div className="py-14 text-center text-slate-500 text-sm">
              {searchFilter
                ? "No playlists on this page match your filter."
                : "No Spotify playlists found in your library."}
            </div>
          ) : (
            filteredPlaylists.map((pl) => (
              <button
                key={pl.id}
                type="button"
                onClick={() => handleSelect(pl)}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800 hover:border-green-600/50 transition text-left group"
              >
                <div className="flex items-center space-x-3 min-w-0">
                  {pl.thumbnail ? (
                    <img
                      src={pl.thumbnail}
                      alt={pl.name}
                      className="w-12 h-12 rounded-lg object-cover border border-slate-800 shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center text-slate-500 shrink-0">
                      <Music className="w-5 h-5" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white group-hover:text-green-400 transition truncate">
                      {pl.name}
                    </p>
                    <p className="text-xs text-slate-400 truncate">
                      By {pl.owner || "Unknown"} • {pl.tracks_total ?? 0} tracks
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Pagination Footer */}
        <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-800">
          <span className="text-xs text-slate-400">
            {total > 0
              ? `Showing ${startIdx}–${endIdx} of ${total}`
              : "0 playlists"}
          </span>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handlePrev}
              disabled={!hasPrev || loading}
              className="flex items-center space-x-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={!hasNext || loading}
              className="flex items-center space-x-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

