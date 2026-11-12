import React, { useState, useEffect, useRef } from 'react';
import { X, Save, AlertTriangle, FilePlus, Loader2, CheckCircle2, ShieldCheck, Lock, Globe } from 'lucide-react';
import { emitTelemetryEvent } from '../utils/telemetry';

export default function SavePlaylistModal({
  isOpen,
  onClose,
  playlist,
  displayedTracks = [],
  onSaveSuccess,
  activePlatform,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [saveMode, setSaveMode] = useState('new'); // 'new' or 'update'
  const [playlistTitle, setPlaylistTitle] = useState(() => `${playlist?.title || 'Playlist'} (Clean)`);
  const [isPrivate, setIsPrivate] = useState(true);

  const prevIsOpenRef = useRef(isOpen);

  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      setPlaylistTitle(`${playlist?.title || 'Playlist'} (Clean)`);
      setSaveMode('new');
      setIsPrivate(true);
      setError(null);
      setSuccess(false);
      setLoading(false);
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, playlist]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !loading && !success) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, success, onClose]);

  if (!isOpen) return null;

  const canOverwrite = Boolean(
    playlist?.id &&
    playlist?.canOverwrite !== false &&
    playlist?.can_overwrite !== false &&
    playlist?.is_owner !== false
  );

  const totalTracks = displayedTracks.length;
  const cleanTracksCount = displayedTracks.filter(
    (t) => !t.is_explicit || t.was_replaced || t.verification_status === 'verified_clean' || t.verification_status === 'swapped'
  ).length;

  const isTitleValid = saveMode === 'update' || playlistTitle.trim().length > 0;

  const handleSave = async () => {
    if (!isTitleValid || loading) return;

    setLoading(true);
    setError(null);

    try {
      const final_track_ids = displayedTracks.map((t) => t.id);
      const endpoint = activePlatform === 'spotify' ? '/api/spotify/playlist/save' : '/api/ytmusic/playlist/save';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          original_playlist_id: playlist?.id,
          playlist_title: saveMode === 'new' ? playlistTitle.trim() : (playlist?.title || ''),
          final_track_ids: final_track_ids,
          create_new: saveMode === 'new',
          is_public: !isPrivate,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to save playlist');
      }

      emitTelemetryEvent('finish_action_clicked', {
        platform: activePlatform || 'spotify',
        vip_mode: true,
        action: 'vip_spotify_save',
      });

      setSuccess(true);
      setTimeout(() => {
        if (onSaveSuccess) onSaveSuccess();
        onClose();
      }, 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !loading && !success) {
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-playlist-modal-title"
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-backdrop/80 backdrop-blur-sm"
    >
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-6 max-w-md w-full shadow-2xl relative text-text-primary">
        <button
          type="button"
          onClick={onClose}
          disabled={loading || success}
          aria-label="Close save dialog"
          className="absolute top-4 right-4 text-text-muted hover:text-text-primary transition disabled:opacity-50"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center justify-between mb-4 pr-6">
          <h2 id="save-playlist-modal-title" className="text-xl font-bold text-text-primary">
            Save Playlist
          </h2>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-status-clean-bg text-status-clean border border-status-clean-border/40">
            <ShieldCheck className="w-3.5 h-3.5 text-status-clean" />
            <span>
              {totalTracks} tracks ({cleanTracksCount} clean)
            </span>
          </div>
        </div>

        {success ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <div className="w-16 h-16 bg-surface-elevated border border-border-subtle rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-text-secondary" />
            </div>
            <p className="text-text-primary font-semibold text-lg">Saved Successfully!</p>
          </div>
        ) : (
          <div className="space-y-5">
            <p className="text-text-secondary text-sm">
              Save your sanitized tracks to Spotify library.
            </p>

            <div className="space-y-3">
              {/* Option 1: Create New */}
              <button
                type="button"
                role="button"
                aria-label="Create New Clean Playlist"
                aria-pressed={saveMode === 'new'}
                onClick={() => setSaveMode('new')}
                className={`w-full flex items-start gap-3 p-3.5 rounded-xl border transition text-left ${
                  saveMode === 'new'
                    ? 'bg-brand-primary/10 border-brand-primary text-text-primary'
                    : 'bg-surface-canvas/60 border-border-subtle hover:border-border-strong text-text-secondary'
                }`}
              >
                <div className={`mt-0.5 ${saveMode === 'new' ? 'text-brand-tint' : 'text-text-muted'}`}>
                  <FilePlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">Create New Clean Playlist</h3>
                  <p className="text-xs text-text-muted mt-0.5">
                    Creates a new playlist in your library with all current tracks.
                  </p>
                </div>
              </button>

              {/* Title input & Privacy toggle for Create New */}
              {saveMode === 'new' && (
                <div className="p-3.5 rounded-xl bg-surface-canvas/50 border border-border-subtle space-y-3">
                  <div>
                    <label htmlFor="playlist-title-input" className="block text-xs font-medium text-text-secondary mb-1">
                      Playlist Name
                    </label>
                    <input
                      id="playlist-title-input"
                      type="text"
                      value={playlistTitle}
                      onChange={(e) => setPlaylistTitle(e.target.value)}
                      aria-label="Playlist title"
                      placeholder="Playlist title"
                      className="w-full bg-surface-canvas border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-ring-focus transition"
                    />
                    {!isTitleValid && (
                      <p className="text-xs text-status-flagged mt-1">Playlist name is required.</p>
                    )}
                  </div>

                  <label className="flex items-center justify-between p-2.5 rounded-lg bg-surface-canvas/80 border border-border-subtle cursor-pointer select-none">
                    <div className="flex items-center gap-2">
                      {isPrivate ? <Lock className="w-4 h-4 text-text-muted" /> : <Globe className="w-4 h-4 text-text-muted" />}
                      <div>
                        <span className="text-xs font-medium text-text-primary block">Private Playlist</span>
                        <span className="text-[11px] text-text-muted">Keep this playlist private in your library</span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={isPrivate}
                      onChange={(e) => setIsPrivate(e.target.checked)}
                      aria-label="Private playlist"
                      className="w-4 h-4 rounded border-border-subtle bg-surface-canvas text-brand-primary focus:ring-ring-focus accent-brand-primary"
                    />
                  </label>
                </div>
              )}

              {/* Option 2: Update Original */}
              <button
                type="button"
                role="button"
                aria-label="Update Original Playlist"
                aria-pressed={saveMode === 'update'}
                disabled={!canOverwrite || loading || success}
                onClick={() => canOverwrite && setSaveMode('update')}
                className={`w-full flex items-start gap-3 p-3.5 rounded-xl border transition text-left ${
                  !canOverwrite
                    ? 'opacity-50 cursor-not-allowed bg-surface-canvas/20 border-border-subtle'
                    : saveMode === 'update'
                    ? 'bg-brand-primary/10 border-brand-primary text-text-primary'
                    : 'bg-surface-canvas/60 border-border-subtle hover:border-border-strong text-text-secondary'
                }`}
              >
                <div className={`mt-0.5 ${saveMode === 'update' ? 'text-brand-tint' : 'text-text-muted'}`}>
                  <Save className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">Update Original Playlist</h3>
                  <p className="text-xs text-text-muted mt-0.5">
                    Replaces tracks in your existing playlist.{' '}
                    {!canOverwrite && <span className="text-status-caution font-medium">(Only works if you own the playlist)</span>}
                  </p>
                </div>
              </button>

              {/* Destructive warning for Update Original */}
              {saveMode === 'update' && (
                <div className="bg-status-caution-bg border border-status-caution-border/40 p-3 rounded-lg flex items-start gap-2 text-status-caution text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-status-caution" />
                  <p>Warning: This will overwrite tracks in your existing playlist. This action cannot be undone.</p>
                </div>
              )}
            </div>

            {error && (
              <div role="alert" className="bg-status-flagged-bg border border-status-flagged-border/40 p-3 rounded-lg flex items-start gap-2 text-status-flagged text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            <div className="flex gap-3 justify-end pt-4 border-t border-border-subtle">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                aria-label="Cancel"
                className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text-primary transition disabled:opacity-50 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={loading || !isTitleValid}
                aria-label="Save Playlist"
                className="px-4 py-2 bg-brand-primary hover:bg-brand-primary-hover text-white text-sm font-medium rounded-lg flex items-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Playlist</span>
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
