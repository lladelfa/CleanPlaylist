import React, { useState } from 'react';
import { X, ExternalLink, Loader2, CheckCircle2, AlertCircle, Music } from 'lucide-react';

export default function AuthModal({ isOpen, onClose, onAuthenticated }) {
  const [headersRaw, setHeadersRaw] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!headersRaw.trim()) {
      setError("Please paste your headers first.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/headers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headers_raw: headersRaw })
      });

      const data = await res.json();
      if (!res.ok || data.status === 'error') {
        throw new Error(data.message || 'Failed to authenticate');
      }

      setSuccess(true);
      setTimeout(() => {
        onAuthenticated();
        onClose();
        // reset state for next time
        setSuccess(false);
        setHeadersRaw('');
      }, 2000);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-2xl w-full shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition"
          disabled={loading || success}
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
          <Music className="w-6 h-6 text-purple-400" />
          Connect YouTube Music
        </h2>

        {success ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="w-16 h-16 bg-emerald-950 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
            <p className="text-emerald-400 font-medium text-lg">Successfully Connected!</p>
          </div>
        ) : (
          <div className="space-y-6 mt-4">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-sm text-slate-300">
              <p className="mb-3 font-semibold text-white">How to connect your account securely:</p>
              <ol className="list-decimal pl-5 space-y-2">
                <li>Go to <a href="https://music.youtube.com" target="_blank" rel="noreferrer" className="text-purple-400 hover:underline">music.youtube.com</a> and ensure you are logged in.</li>
                <li>Open your browser's Developer Tools (Press <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-xs text-slate-200 font-mono">F12</kbd> or <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-xs text-slate-200 font-mono">Ctrl+Shift+I</kbd>).</li>
                <li>Go to the <strong>Network</strong> tab.</li>
                <li>In the "Filter" box, type <code className="bg-slate-800 px-1.5 py-0.5 rounded text-xs text-slate-200 font-mono">browse</code>.</li>
                <li>If nothing shows up, click any playlist or click the "Home" button on YouTube Music to trigger a new request.</li>
                <li>Click on any request named <code className="bg-slate-800 px-1 rounded text-slate-200">browse?...</code> in the list.</li>
                <li>Under the <strong>Headers</strong> tab for that request, scroll down to the <strong>Request Headers</strong> section.</li>
                <li>Select and copy <strong>everything</strong> in the Request Headers section.</li>
                <li>Paste the copied text into the box below.</li>
              </ol>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">
                Paste Request Headers:
              </label>
              <textarea
                value={headersRaw}
                onChange={(e) => setHeadersRaw(e.target.value)}
                placeholder="accept: */*&#10;accept-language: en-US,en;q=0.9&#10;cookie: VISITOR_INFO1_LIVE=...&#10;..."
                className="w-full h-40 bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-300 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
                spellCheck={false}
              />
            </div>

            {error && (
              <div className="bg-red-950/40 border border-red-900/50 p-3 rounded-lg flex items-start gap-2 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || !headersRaw.trim()}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg flex items-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  'Connect Account'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
