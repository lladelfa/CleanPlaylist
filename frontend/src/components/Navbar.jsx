import React from 'react';
import { Disc3, Search, Shuffle, FileText, CheckCircle2, Sparkles, Music } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, isAuthenticated, onOpenAuth }) {
  const tabs = [
    { id: 'scan', label: 'Scan & Clean', icon: Disc3 },
    { id: 'keywords', label: 'Keyword Search', icon: Search },
    { id: 'stitch', label: 'Stitch Playlists', icon: Shuffle },
  ];

  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Disc3 className="h-6 w-6 text-white animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-amber-300 bg-clip-text text-transparent">
                CleanPlaylist
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                YouTube Music
              </span>
            </div>
            <p className="text-xs text-slate-400">Offensive Language Scanner & Playlist Stitcher</p>
          </div>
        </div>

        <nav className="flex items-center space-x-1 sm:space-x-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden lg:inline">{tab.label}</span>
              </button>
            );
          })}

          <div className="h-6 w-px bg-slate-700 mx-2 hidden sm:block"></div>

          {isAuthenticated ? (
            <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-950/40 text-emerald-400 text-sm font-medium rounded-lg border border-emerald-900/50">
              <CheckCircle2 className="w-4 h-4" />
              <span className="hidden sm:inline">Connected</span>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg flex items-center space-x-2 border border-slate-700 transition"
            >
              <Music className="w-4 h-4 text-purple-400" />
              <span className="hidden sm:inline">Connect Account</span>
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
