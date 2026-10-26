import React from 'react';
import { Disc3, Search, Shuffle, FileText, CheckCircle2, Music, LogOut, Disc } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, activePlatform, setActivePlatform, isAuthenticated, onOpenAuth, onLogout }) {
  const tabs = [
    { id: 'scan', label: 'Scan & Clean', icon: Disc3 },
    { id: 'keywords', label: 'Keyword Search', icon: Search },
    { id: 'stitch', label: 'Stitch Playlists', icon: Shuffle },
  ];

  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center shadow-lg ${
            activePlatform === 'spotify'
              ? 'bg-gradient-to-tr from-green-500 to-emerald-400 shadow-green-500/20'
              : 'bg-gradient-to-tr from-purple-600 to-pink-500 shadow-purple-500/20'
          }`}>
            <Disc3 className="h-6 w-6 text-white animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className={`text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r ${
                activePlatform === 'spotify' ? 'from-green-400 to-emerald-300' : 'from-purple-400 via-pink-400 to-amber-300'
              }`}>
                CleanPlaylist
              </span>
            </div>

            {/* Platform Toggle */}
            <div className="flex bg-slate-950 rounded-md p-0.5 mt-0.5 border border-slate-800 w-fit">
               <button
                 onClick={() => setActivePlatform('spotify')}
                 className={`px-2 py-0.5 text-[10px] font-bold rounded flex items-center gap-1 ${activePlatform === 'spotify' ? 'bg-green-600/20 text-green-400' : 'text-slate-500 hover:text-slate-300'}`}
               >
                 Spotify
               </button>
               <button
                 onClick={() => setActivePlatform('ytmusic')}
                 className={`px-2 py-0.5 text-[10px] font-bold rounded flex items-center gap-1 ${activePlatform === 'ytmusic' ? 'bg-purple-600/20 text-purple-400' : 'text-slate-500 hover:text-slate-300'}`}
               >
                 YouTube Music
               </button>
            </div>
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
                    ? (activePlatform === 'spotify' ? 'bg-green-600 text-white shadow-md shadow-green-600/30' : 'bg-purple-600 text-white shadow-md shadow-purple-600/30')
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden lg:inline">{tab.label}</span>
              </button>
            );
          })}

          <div className="h-6 w-px bg-slate-700 mx-2 hidden sm:block"></div>

          {activePlatform === 'spotify' ? (
             isAuthenticated ? (
               <div className="flex items-center space-x-2">
                 <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-950/40 text-emerald-400 text-sm font-medium rounded-lg border border-emerald-900/50">
                   <CheckCircle2 className="w-4 h-4" />
                   <span className="hidden sm:inline">Connected</span>
                 </div>
                 <button
                   onClick={onLogout}
                   title="Disconnect Account"
                   className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-red-400 rounded-lg transition"
                 >
                   <LogOut className="w-4 h-4" />
                 </button>
               </div>
             ) : (
               <button
                 onClick={onOpenAuth}
                 className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg flex items-center space-x-2 border border-slate-700 transition hover:border-green-500/50 hover:text-green-400"
               >
                 <Disc className="w-4 h-4" />
                 <span className="hidden sm:inline">Login to Spotify</span>
               </button>
             )
          ) : (
            <div className="px-3 py-1.5 bg-slate-800/50 text-slate-400 text-xs font-medium rounded-lg border border-slate-800/50 flex items-center gap-1.5">
               <span>Read-Only Mode</span>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
