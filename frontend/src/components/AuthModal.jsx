import React, { useState } from 'react';
import { X, ExternalLink, Loader2, AlertCircle, Music } from 'lucide-react';

export default function AuthModal({ isOpen, onClose }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login');
      const data = await res.json();

      if (data.status === 'success') {
        // Redirect the user to Google
        window.location.href = data.url;
      } else {
        throw new Error(data.message || 'Failed to get login URL');
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-2xl w-full shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition"
          disabled={loading}
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
          <Music className="w-6 h-6 text-purple-400" />
          Setup Required
        </h2>

        <div className="space-y-4 mt-4 text-sm text-slate-300">
          <div className="bg-amber-950/40 border border-amber-900/50 p-4 rounded-xl">
            <p className="mb-2">
              To use the seamless <strong>Log in with Google</strong> flow, you must configure your own YouTube Data API credentials in the backend.
            </p>
          </div>

          <ol className="list-decimal pl-5 space-y-2">
            <li>Go to the <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer" className="text-purple-400 hover:underline">Google Cloud Console</a>.</li>
            <li>Create a new project and enable the <strong>YouTube Data API v3</strong>.</li>
            <li>Go to APIs & Services {'>'} Credentials.</li>
            <li>Create credentials {'>'} <strong>OAuth client ID</strong> {'>'} <strong>Web application</strong>.</li>
            <li>Under <strong>Authorized redirect URIs</strong>, add <code className="bg-slate-800 px-1 rounded">http://localhost:8000/api/auth/callback</code> (or your domain).</li>
            <li>Copy the Client ID and Client Secret.</li>
            <li>Create a <code className="bg-slate-800 px-1 rounded">.env</code> file in the <strong>backend</strong> folder of this project.</li>
            <li>Add your credentials to the file:
              <pre className="bg-slate-950 p-2 mt-1 rounded border border-slate-800 text-xs overflow-x-auto text-slate-400">
YOUTUBE_CLIENT_ID=your-client-id.apps.googleusercontent.com<br/>
YOUTUBE_CLIENT_SECRET=your-client-secret
              </pre>
            </li>
            <li>Restart the backend server.</li>
          </ol>

          {error && (
            <div className="bg-red-950/40 border border-red-900/50 p-3 rounded-lg flex items-start gap-2 text-red-400 text-sm mt-4">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          <div className="pt-4 flex justify-end gap-3 border-t border-slate-800 mt-4">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleLogin}
              disabled={loading}
              className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg flex items-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                'I have added credentials, Log In'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
