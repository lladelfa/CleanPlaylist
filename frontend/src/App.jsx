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
  }, []);

  const [playlist, setPlaylist] = useState(null);
  const [scannedTracks, setScannedTracks] = useState([]);
  const [workingList, setWorkingList] = useState([]);
  const [_lyricsByTrackId, setLyricsByTrackId] = useState({});
  const [customBlocklist, setCustomBlocklist] = useState(['explicit', 'fuck', 'shit', 'bitch', 'asshole']);
  const [preset, setPreset] = useState('moderate');
  const [selectedTrackForLyrics, setSelectedTrackForLyrics] = useState(null);

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
            onOpenLyrics={(track) => setSelectedTrackForLyrics(track)}
            customBlocklist={customBlocklist}
            setCustomBlocklist={setCustomBlocklist}
            preset={preset}
            setPreset={setPreset}
            isAuthenticated={isAuthenticated}
            onOpenAuth={handleLogin}
            activePlatform={activePlatform}
          />
        )}

        {activeTab === 'keywords' && (
          <KeywordsTab
            playlist={playlist}
            scannedTracks={scannedTracks}
            onOpenLyrics={(track) => setSelectedTrackForLyrics(track)}
            activePlatform={activePlatform}
          />
        )}

        {activeTab === 'stitch' && (
          <StitchTab
            initialPlaylist={playlist}
            initialScannedTracks={scannedTracks}
            activePlatform={activePlatform}
          />
        )}
      </main>

      {/* Lyrics Viewer Modal */}
      {selectedTrackForLyrics && (
        <LyricsModal
          track={selectedTrackForLyrics}
          onClose={() => setSelectedTrackForLyrics(null)}
          onApplyReplacement={(cleanTrack) => {
            handleSetScannedTracks(prev =>
              prev.map(t => (t.id === selectedTrackForLyrics.id ? cleanTrack : t))
            );
            setSelectedTrackForLyrics(null);
          }}
        />
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
