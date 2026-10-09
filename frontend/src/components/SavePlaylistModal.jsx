import React, { useState } from 'react';
import { X, Save, AlertTriangle, FilePlus, Loader2, CheckCircle2 } from 'lucide-react';

export default function SavePlaylistModal({ isOpen, onClose, playlist, displayedTracks, onSaveSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [saveMode, setSaveMode] = useState('update'); // 'update' or 'new'

  if (!isOpen) return null;

  const handleSave = async () => {
    setLoading(true);
    setError(null);

    try {
      // Find swaps
      const swaps = [];
      displayedTracks.forEach(t => {
        if (t.was_replaced && t.original_set_video_id) {
          swaps.push({
            original_set_video_id: t.original_set_video_id,
            original_video_id: t.original_id, // we should ensure we track this
            new_video_id: t.id
          });
        }
      });

      const final_track_ids = displayedTracks.map(t => t.id);

      const res = await fetch('/api/playlist/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          original_playlist_id: playlist.id,
          playlist_title: playlist.title,
          swaps: swaps,
          final_track_ids: final_track_ids,
          create_new: saveMode === 'new'
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Failed to save playlist');
      }

      setSuccess(true);
      setTimeout(() => {
        onSaveSuccess();
        onClose();
      }, 2000);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl relative">
        <button
          onClick={onClose}
          disabled={loading || success}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition disabled:opacity-50"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-bold text-white mb-4">Save Playlist</h2>

        {success ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <div className="w-16 h-16 bg-emerald-950 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
            <p className="text-emerald-400 font-medium text-lg">Saved Successfully!</p>
          </div>
        ) : (
          <div className="space-y-6">
            <p className="text-slate-300 text-sm">
              You are about to save changes to <span className="font-semibold text-white">{playlist?.title}</span>.
            </p>

            <div className="space-y-3">
              <button
                onClick={() => setSaveMode('update')}
                className={`w-full flex items-start gap-3 p-4 rounded-xl border transition text-left ${
                  saveMode === 'update'
                    ? 'bg-purple-900/30 border-purple-500/50'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className={`mt-0.5 ${saveMode === 'update' ? 'text-purple-400' : 'text-slate-500'}`}>
                  <Save className="w-5 h-5" />
                </div>
                <div>
                  <h3 className={`font-medium ${saveMode === 'update' ? 'text-white' : 'text-slate-300'}`}>
                    Update Original Playlist
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Attempts to replace explicit tracks in your existing playlist. (Only works if you own the playlist).
                  </p>
                </div>
              </button>

              <button
                onClick={() => setSaveMode('new')}
                className={`w-full flex items-start gap-3 p-4 rounded-xl border transition text-left ${
                  saveMode === 'new'
                    ? 'bg-purple-900/30 border-purple-500/50'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className={`mt-0.5 ${saveMode === 'new' ? 'text-purple-400' : 'text-slate-500'}`}>
                  <FilePlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className={`font-medium ${saveMode === 'new' ? 'text-white' : 'text-slate-300'}`}>
                    Create New Clean Playlist
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Creates a new playlist named "{playlist?.title}_clean" with all current tracks.
                  </p>
                </div>
              </button>
            </div>

            {error && (
              <div className="bg-red-950/40 border border-red-900/50 p-3 rounded-lg flex items-start gap-2 text-red-400 text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            <div className="flex gap-3 justify-end pt-4 border-t border-slate-800">
              <button
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg flex items-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Playlist
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
