import React, { useState } from 'react';
import Navbar from './components/Navbar';
import ScanTab from './components/ScanTab';
import KeywordsTab from './components/KeywordsTab';
import StitchTab from './components/StitchTab';
import LyricsModal from './components/LyricsModal';

export default function App() {
  const [activeTab, setActiveTab] = useState('scan');
  const [activePlatform, setActivePlatform] = useState('spotify'); // 'spotify' | 'ytmusic'
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
  const [customBlocklist, setCustomBlocklist] = useState(['explicit', 'fuck', 'shit', 'bitch', 'asshole']);
  const [preset, setPreset] = useState('moderate');
  const [selectedTrackForLyrics, setSelectedTrackForLyrics] = useState(null);

  const handleLogout = async () => {
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activePlatform={activePlatform}
        setActivePlatform={setActivePlatform}
        isAuthenticated={isAuthenticated}
        onOpenAuth={handleLogin}
        onLogout={handleLogout}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'scan' && (
          <ScanTab
            playlist={playlist}
            setPlaylist={setPlaylist}
            scannedTracks={scannedTracks}
            setScannedTracks={setScannedTracks}
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
            setScannedTracks(prev =>
              prev.map(t => (t.id === selectedTrackForLyrics.id ? cleanTrack : t))
            );
            setSelectedTrackForLyrics(null);
          }}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© CleanPlaylist • Designed for Spotify & YouTube Music</p>
          <p className="text-slate-600">
            Standalone Local & Cloud Ready • Fast Async Language Engine
          </p>
        </div>
      </footer>
    </div>
  );
}
