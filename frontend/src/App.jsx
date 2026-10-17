import React, { useState } from 'react';
import Navbar from './components/Navbar';
import ScanTab from './components/ScanTab';
import KeywordsTab from './components/KeywordsTab';
import StitchTab from './components/StitchTab';
import LyricsModal from './components/LyricsModal';
import AuthModal from './components/AuthModal';

export default function App() {
  const [activeTab, setActiveTab] = useState('scan');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  React.useEffect(() => {
    fetch('/api/auth/status')
      .then(res => res.json())
      .then(data => setIsAuthenticated(data.authenticated))
      .catch(err => console.error("Failed to check auth status", err));
  }, []);
  const [playlist, setPlaylist] = useState(null);
  const [scannedTracks, setScannedTracks] = useState([]);
  const [customBlocklist, setCustomBlocklist] = useState(['explicit', 'fuck', 'shit', 'bitch', 'asshole']);
  const [preset, setPreset] = useState('moderate');
  const [selectedTrackForLyrics, setSelectedTrackForLyrics] = useState(null);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isAuthenticated={isAuthenticated}
        onOpenAuth={() => setIsAuthModalOpen(true)}
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
            onOpenAuth={() => setIsAuthModalOpen(true)}
          />
        )}

        {activeTab === 'keywords' && (
          <KeywordsTab
            playlist={playlist}
            scannedTracks={scannedTracks}
            onOpenLyrics={(track) => setSelectedTrackForLyrics(track)}
          />
        )}

        {activeTab === 'stitch' && (
          <StitchTab
            initialPlaylist={playlist}
            initialScannedTracks={scannedTracks}
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
          <p>© CleanPlaylist • Designed for YouTube Music (Google Music)</p>
          <p className="text-slate-600">
            Standalone Local & Cloud Ready • Fast Async Language Engine
          </p>
        </div>
      </footer>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthenticated={() => setIsAuthenticated(true)}
      />
    </div>
  );
}
