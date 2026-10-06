import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, CheckCircle, Music2, ExternalLink, RefreshCw } from 'lucide-react';

export default function LyricsModal({ track, onClose, onApplyReplacement }) {
  const [loading, setLoading] = useState(false);
  const [lyricsData, setLyricsData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!track) return;

    // Fetch single track lyrics and scan
    const fetchLyrics = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/scan/track-lyrics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            video_id: track.id,
            is_explicit: track.is_explicit,
            preset: 'moderate'
          })
        });
        if (!res.ok) throw new Error('Failed to load lyrics');
        const data = await res.json();
        setLyricsData(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchLyrics();
  }, [track]);

  if (!track) return null;

  const detectedWords = lyricsData?.scan_result?.detected_terms?.map((t) => t.word.toLowerCase()) || [];

  // Helper to render lyrics with highlights
  const renderLyricsWithHighlights = (rawText) => {
    if (!rawText) return <p className="text-slate-500 italic">No lyrics available for this track.</p>;

    const lines = rawText.split('\n');
    return lines.map((line, idx) => {
      if (!line.trim()) {
        return <div key={idx} className="h-4" />;
      }

      // Check if line contains any detected word
      const words = line.split(/(\s+|[.,!?;:()"])/);
      return (
        <div key={idx} className="flex items-start text-sm hover:bg-slate-800/40 px-2 py-0.5 rounded">
          <span className="text-slate-600 select-none w-8 text-right mr-4 font-mono text-xs pt-0.5">
            {idx + 1}
          </span>
          <span className="text-slate-200">
            {words.map((word, wIdx) => {
              const cleanW = word.toLowerCase().trim();
              const isFlagged = detectedWords.some(dw => cleanW === dw || cleanW.startsWith(dw));
              if (isFlagged) {
                return (
                  <span
                    key={wIdx}
                    className="bg-red-500/20 text-red-300 font-semibold px-1 rounded border border-red-500/40"
                  >
                    {word}
                  </span>
                );
              }
              return <React.Fragment key={wIdx}>{word}</React.Fragment>;
            })}
          </span>
        </div>
      );
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-800 flex items-start justify-between bg-slate-850">
          <div className="flex items-center space-x-4">
            {track.thumbnail ? (
              <img
                src={track.thumbnail}
                alt={track.title}
                className="w-14 h-14 rounded-lg object-cover shadow border border-slate-700"
              />
            ) : (
              <div className="w-14 h-14 rounded-lg bg-slate-800 flex items-center justify-center">
                <Music2 className="w-6 h-6 text-slate-500" />
              </div>
            )}
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-bold text-white line-clamp-1">{track.title}</h3>
                {track.is_explicit && (
                  <span className="bg-red-950 text-red-400 text-xs px-1.5 py-0.5 rounded border border-red-800 font-semibold">
                    E
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-400">{track.artist}</p>
              <a
                href={track.video_url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-purple-400 hover:text-purple-300 inline-flex items-center mt-1 space-x-1"
              >
                <span>Listen on YouTube Music</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <RefreshCw className="w-8 h-8 text-purple-500 animate-spin" />
              <p className="text-sm text-slate-400">Fetching lyrics from YouTube Music...</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-950/40 border border-red-800/60 rounded-xl text-red-300 text-sm">
              <p className="font-semibold">Error Loading Lyrics</p>
              <p className="text-xs text-red-400 mt-1">{error}</p>
            </div>
          )}

          {!loading && lyricsData && (
            <>
              {/* Scan summary banner */}
              <div
                className={`p-3 rounded-xl border flex items-center justify-between text-sm ${
                  lyricsData.scan_result?.is_flagged
                    ? 'bg-red-950/30 border-red-800/50 text-red-300'
                    : 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300'
                }`}
              >
                <div className="flex items-center space-x-2">
                  {lyricsData.scan_result?.is_flagged ? (
                    <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                  ) : (
                    <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                  )}
                  <div>
                    <span className="font-semibold">
                      {lyricsData.scan_result?.is_flagged ? 'Flagged Track' : 'Clean Track'}
                    </span>
                    {lyricsData.scan_result?.reasons?.length > 0 && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        {lyricsData.scan_result.reasons.join(' • ')}
                      </p>
                    )}
                  </div>
                </div>

                {detectedWords.length > 0 && (
                  <div className="flex flex-wrap gap-1 max-w-[50%] justify-end">
                    {detectedWords.slice(0, 5).map((w, i) => (
                      <span
                        key={i}
                        className="text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full border border-red-500/30"
                      >
                        {w}
                      </span>
                    ))}
                    {detectedWords.length > 5 && (
                      <span className="text-xs text-slate-400">+{detectedWords.length - 5} more</span>
                    )}
                  </div>
                )}
              </div>

              {/* Lyrics scroll area */}
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 font-mono text-sm leading-relaxed overflow-x-auto">
                {renderLyricsWithHighlights(lyricsData.lyrics)}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-850 flex justify-between items-center">
          <p className="text-xs text-slate-500">Lyrics provided by YouTube Music service</p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
