import React, { useState, useEffect } from 'react';
import { X, ExternalLink, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export default function AuthModal({ isOpen, onClose, onAuthenticated }) {
  const [step, setStep] = useState(1);
  const [authData, setAuthData] = useState(null);
  const [error, setError] = useState(null);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    if (isOpen && step === 1) {
      startAuthFlow();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const startAuthFlow = async () => {
    try {
      setError(null);
      const res = await fetch('/api/auth/start', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to start auth flow');
      const data = await res.json();
      setAuthData(data);
      setStep(2);
      startPolling(data.user_code, data.interval || 5);
    } catch (err) {
      setError(err.message);
    }
  };

  const startPolling = (userCode, intervalSeconds) => {
    setPolling(true);
    const intervalId = setInterval(async () => {
      try {
        const res = await fetch('/api/auth/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_code: userCode })
        });
        const data = await res.json();

        if (data.status === 'success') {
          clearInterval(intervalId);
          setPolling(false);
          setStep(3);

          // Re-init YTMusic with auth
          await fetch('/api/auth/init_yt', { method: 'POST' });

          setTimeout(() => {
            onAuthenticated();
            onClose();
          }, 2000);
        } else if (data.status === 'error') {
          clearInterval(intervalId);
          setPolling(false);
          setError(data.message);
        }
      } catch (err) {
        // Keep polling on network errors
      }
    }, intervalSeconds * 1000);

    // Cleanup on unmount or modal close
    return () => clearInterval(intervalId);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-bold text-white mb-2">Connect YouTube Music</h2>

        {step === 1 && (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="w-8 h-8 text-purple-500 animate-spin mb-4" />
            <p className="text-slate-300">Preparing authentication...</p>
          </div>
        )}

        {step === 2 && authData && (
          <div className="space-y-6 mt-4">
            <p className="text-sm text-slate-300">
              To save playlists, you need to authorize this app to manage your YouTube Music account.
            </p>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-center">
              <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-2">
                1. Go to this URL on any device
              </p>
              <a
                href={authData.verification_url}
                target="_blank"
                rel="noreferrer"
                className="text-purple-400 hover:text-purple-300 font-medium flex items-center justify-center gap-1.5"
              >
                {authData.verification_url}
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-center">
              <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-2">
                2. Enter this code
              </p>
              <p className="text-3xl font-mono tracking-widest text-white">
                {authData.user_code}
              </p>
            </div>

            {error ? (
              <div className="bg-red-950/40 border border-red-900/50 p-3 rounded-lg flex items-start gap-2 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 text-slate-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                <p>Waiting for you to authorize...</p>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <div className="w-16 h-16 bg-emerald-950 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
            <p className="text-emerald-400 font-medium text-lg">Successfully Connected!</p>
            <p className="text-slate-400 text-sm">Returning to app...</p>
          </div>
        )}
      </div>
    </div>
  );
}
