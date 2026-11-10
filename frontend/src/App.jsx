import React, { useState } from 'react';
import GlobalHeader from './components/GlobalHeader';
import PlatformSwitchModal from './components/PlatformSwitchModal';
import ScanTab from './components/ScanTab';
import KeywordsTab from './components/KeywordsTab';
import StitchTab from './components/StitchTab';
import LyricsModal from './components/LyricsModal';

export default function App() {
  const [activeTab, setActiveTab] = useState('scan');
  const [activePlatform, setActivePlatform] = useState('spotify'); // 'spotify' | 'ytmusic'
  const [pendingPlatform, setPendingPlatform] = useState(null);
  const [isSwitchModalOpen, setIsSwitchModalOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [presetsData, setPresetsData] = useState(null);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('auth_success')) {
      setIsAuthenticated(true);
      setActivePlatform(params.get('platform') || 'spotify');
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (params.get('auth_error')) {
      console.error("Auth Error:", params.get('auth_error'));
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      fetch('/api/spotify/status')
        .then(res => res.json())
        .then(data => setIsAuthenticated(data.authenticated))
        .catch(err => console.error("Failed to check auth status", err));
    }

    fetch('/api/presets')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch presets');
        return res.json();
      })
      .then(data => setPresetsData(data))
      .catch(err => console.warn('Failed to load presets, using defaults:', err));
  }, []);

  const [playlist, setPlaylist] = useState(null);
  const [scannedTracks, setScannedTracks] = useState([]);
  const [workingList, setWorkingList] = useState([]);
  const [lyricsByTrackId, setLyricsByTrackId] = useState({});
  const [customBlocklist, setCustomBlocklist] = useState(['explicit', 'fuck', 'shit', 'bitch', 'asshole']);
  const [preset, setPreset] = useState('moderate');
  const [selectedTrackForLyrics, setSelectedTrackForLyrics] = useState(null);
  const [lyricsTriggerEl, setLyricsTriggerEl] = useState(null);
  const [keptTrackIds, setKeptTrackIds] = useState(() => new Set());
  const [isMasked, setIsMasked] = useState(true);
  const [cleanCandidates, setCleanCandidates] = useState({});
  const [swapAnnouncement, setSwapAnnouncement] = useState('');

  const handleToggleMasking = () => {
    setIsMasked(prev => !prev);
  };

  const handleKeepTrack = (trackId) => {
    if (!trackId) return;
    setKeptTrackIds((prev) => {
      const next = new Set(prev);
      next.add(trackId);
      return next;
    });
  };

  const handleOpenLyrics = (track, triggerEl = null) => {
    setLyricsTriggerEl(triggerEl || (typeof document !== 'undefined' ? document.activeElement : null));
    setSelectedTrackForLyrics(track);
  };

  // Sync workingList with scannedTracks when tracks are loaded/scanned
  const handleSetScannedTracks = (tracksOrUpdater) => {
    if (typeof tracksOrUpdater === 'function') {
      setScannedTracks(prev => {
        const next = tracksOrUpdater(prev);
        setWorkingList(next);
        return next;
      });
    } else {
      setScannedTracks(tracksOrUpdater);
      setWorkingList(tracksOrUpdater);
    }
  };

  const handleRequestPlatformChange = (newPlatform) => {
    if (newPlatform === activePlatform) return;
    const isDirty = (workingList && workingList.length > 0) || (scannedTracks && scannedTracks.length > 0);
    if (isDirty) {
      setPendingPlatform(newPlatform);
      setIsSwitchModalOpen(true);
    } else {
      setActivePlatform(newPlatform);
    }
  };

  const handleConfirmPlatformSwitch = () => {
    if (pendingPlatform) {
      setActivePlatform(pendingPlatform);
    }
    setWorkingList([]);
    setScannedTracks([]);
    setPlaylist(null);
    setLyricsByTrackId({});
    setKeptTrackIds(new Set());
    setCleanCandidates({});
    setIsSwitchModalOpen(false);
    setPendingPlatform(null);
  };

  const handleCancelPlatformSwitch = () => {
    setIsSwitchModalOpen(false);
    setPendingPlatform(null);
  };

  const _handleLogout = async () => {
    try {
      await fetch('/api/spotify/logout', { method: 'POST' });
      setIsAuthenticated(false);
      window.location.reload();
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  const handleLogin = async () => {
    try {
      const res = await fetch('/api/spotify/login');
      const data = await res.json();
      if (data.status === 'success') {
        window.location.href = data.url;
      } else {
        alert(data.message || 'Failed to get login URL');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-surface-canvas text-text-primary flex flex-col font-sans">
      <GlobalHeader
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activePlatform={activePlatform}
        onSelectPlatform={handleRequestPlatformChange}
      />

      <PlatformSwitchModal
        isOpen={isSwitchModalOpen}
        targetPlatform={pendingPlatform}
        onConfirm={handleConfirmPlatformSwitch}
        onCancel={handleCancelPlatformSwitch}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'scan' && (
          <ScanTab
            playlist={playlist}
            setPlaylist={setPlaylist}
            scannedTracks={scannedTracks}
            setScannedTracks={handleSetScannedTracks}
            workingList={workingList}
            setWorkingList={setWorkingList}
            lyricsByTrackId={lyricsByTrackId}
            setLyricsByTrackId={setLyricsByTrackId}
            onOpenLyrics={handleOpenLyrics}
            keptTrackIds={keptTrackIds}
            onKeepTrack={handleKeepTrack}
            customBlocklist={customBlocklist}
            setCustomBlocklist={setCustomBlocklist}
            preset={preset}
            setPreset={setPreset}
            presetsData={presetsData}
            isAuthenticated={isAuthenticated}
            onOpenAuth={handleLogin}
            activePlatform={activePlatform}
            onSwitchPlatform={setActivePlatform}
            onRequestPlatformChange={handleRequestPlatformChange}
            isMasked={isMasked}
            onToggleMasking={handleToggleMasking}
            cleanCandidates={cleanCandidates}
            setCleanCandidates={setCleanCandidates}
          />
        )}

        {activeTab === 'keywords' && (
          <KeywordsTab
            playlist={playlist}
            scannedTracks={scannedTracks}
            workingList={workingList}
            lyricsByTrackId={lyricsByTrackId}
            setLyricsByTrackId={setLyricsByTrackId}
            onOpenLyrics={handleOpenLyrics}
            activePlatform={activePlatform}
            onNavigateToScan={() => setActiveTab('scan')}
            isMasked={isMasked}
          />
        )}

        {activeTab === 'stitch' && (
          <StitchTab
            initialPlaylist={playlist}
            initialScannedTracks={scannedTracks}
            activePlatform={activePlatform}
            workingList={workingList}
            lyricsByTrackId={lyricsByTrackId}
            vipMode={isAuthenticated}
            preset={preset}
            customBlocklist={customBlocklist}
          />
        )}
      </main>

      {/* Lyrics Viewer Modal */}
      {selectedTrackForLyrics && (
        <LyricsModal
          track={selectedTrackForLyrics}
          triggerEl={lyricsTriggerEl}
          cleanCandidates={cleanCandidates}
          onClose={() => {
            setSelectedTrackForLyrics(null);
            setLyricsTriggerEl(null);
          }}
          onSwapTrack={(originalTrack, cleanTrack) => {
            const cleanLyrics =
              typeof cleanTrack?.lyrics === 'string'
                ? cleanTrack.lyrics
                : cleanTrack?.id
                ? lyricsByTrackId?.[cleanTrack.id]
                : undefined;
            const swappedTrack = {
              ...originalTrack,
              ...cleanTrack,
              verification_status: 'clean_swapped',
              is_flagged: false,
              reasons: [],
              detected_terms: [],
              snippets: [],
              total_flagged_count: 0,
              is_explicit: false,
              has_lyrics: Boolean(typeof cleanLyrics === 'string' && cleanLyrics.trim()),
              was_replaced: true,
              original_title: originalTrack.title,
              original_id: originalTrack.id,
              original_set_video_id: originalTrack.setVideoId,
            };
            const swapFn = (t) => (t.id === originalTrack.id ? swappedTrack : t);
            handleSetScannedTracks((prev) => prev.map(swapFn));
            setPlaylist((prev) =>
              prev
                ? {
                    ...prev,
                    tracks: (prev.tracks || []).map(swapFn),
                  }
                : prev
            );
            if (cleanTrack?.id && typeof cleanLyrics === 'string') {
              setLyricsByTrackId((prev) => ({
                ...prev,
                [cleanTrack.id]: cleanLyrics,
              }));
            }
            setCleanCandidates((prev) => {
              const updated = { ...prev };
              delete updated[originalTrack.id];
              return updated;
            });
            setSwapAnnouncement(
              `Swapped "${originalTrack.title}" to clean version "${cleanTrack.title || originalTrack.title}".`
            );
          }}
          onApplyReplacement={(cleanTrack) => {
            const originalTrack = selectedTrackForLyrics;
            const cleanLyrics =
              typeof cleanTrack?.lyrics === 'string'
                ? cleanTrack.lyrics
                : cleanTrack?.id
                ? lyricsByTrackId?.[cleanTrack.id]
                : undefined;
            const swappedTrack = {
              ...originalTrack,
              ...cleanTrack,
              verification_status: 'clean_swapped',
              is_flagged: false,
              reasons: [],
              detected_terms: [],
              snippets: [],
              total_flagged_count: 0,
              is_explicit: false,
              has_lyrics: Boolean(typeof cleanLyrics === 'string' && cleanLyrics.trim()),
              was_replaced: true,
              original_title: originalTrack.title,
              original_id: originalTrack.id,
              original_set_video_id: originalTrack.setVideoId,
            };
            const swapFn = (t) => (t.id === originalTrack.id ? swappedTrack : t);
            handleSetScannedTracks((prev) => prev.map(swapFn));
            setPlaylist((prev) =>
              prev
                ? {
                    ...prev,
                    tracks: (prev.tracks || []).map(swapFn),
                  }
                : prev
            );
            if (cleanTrack?.id && typeof cleanLyrics === 'string') {
              setLyricsByTrackId((prev) => ({
                ...prev,
                [cleanTrack.id]: cleanLyrics,
              }));
            }
            setCleanCandidates((prev) => {
              const updated = { ...prev };
              delete updated[originalTrack.id];
              return updated;
            });
            setSwapAnnouncement(
              `Swapped "${originalTrack.title}" to clean version "${cleanTrack.title || originalTrack.title}".`
            );
          }}
          activePlatform={activePlatform}
          lyricsByTrackId={lyricsByTrackId}
          setLyricsByTrackId={setLyricsByTrackId}
          preset={preset}
          presetsData={presetsData}
          customBlocklist={customBlocklist}
          keptTrackIds={keptTrackIds}
          onKeepTrack={handleKeepTrack}
          isMasked={isMasked}
        />
      )}

      {swapAnnouncement && (
        <div aria-live="polite" className="sr-only">
          {swapAnnouncement}
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-border-subtle bg-surface-low py-6 text-center text-xs text-text-muted">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© CleanPlaylist • Designed for Spotify & YouTube Music</p>
          <p className="text-text-muted/80">
            Standalone Local & Cloud Ready • Fast Async Language Engine
          </p>
        </div>
      </footer>
    </div>
  );
}
