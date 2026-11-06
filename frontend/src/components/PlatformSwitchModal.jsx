import React, { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * PlatformSwitchModal
 * Confirmation modal when switching active platform with a non-empty working list.
 * Explains that switching platform resets the working list and scan results.
 * Implements accessible focus trapping, focus restoration, and scroll locking.
 */
export default function PlatformSwitchModal({
  isOpen,
  targetPlatform,
  onConfirm,
  onCancel,
}) {
  const cancelBtnRef = useRef(null);
  const confirmBtnRef = useRef(null);
  const previouslyFocusedElementRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      previouslyFocusedElementRef.current = document.activeElement;
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      // Focus cancel button on open
      cancelBtnRef.current?.focus();

      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
        } else if (e.key === 'Tab') {
          // Focus trap between Cancel and Switch & Clear List
          const focusable = [cancelBtnRef.current, confirmBtnRef.current].filter(Boolean);
          if (focusable.length < 2) return;

          const first = focusable[0];
          const last = focusable[focusable.length - 1];

          if (e.shiftKey) {
            if (document.activeElement === first) {
              e.preventDefault();
              last.focus();
            }
          } else {
            if (document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = originalOverflow;
        if (previouslyFocusedElementRef.current && typeof previouslyFocusedElementRef.current.focus === 'function') {
          previouslyFocusedElementRef.current.focus();
        }
      };
    }
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const targetLabel = targetPlatform === 'ytmusic' ? 'YouTube Music' : 'Spotify';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="switch-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-backdrop/80 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onCancel();
        }
      }}
    >
      <div className="bg-surface-card border border-border-subtle rounded-xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start gap-4">
          <div className="p-2.5 rounded-xl bg-status-caution-bg border border-status-caution-border text-status-caution shrink-0">
            <AlertTriangle className="w-6 h-6" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <h2 id="switch-modal-title" className="text-lg font-bold text-text-primary">
              Switch Platform to {targetLabel}?
            </h2>
            <p className="mt-2 text-sm text-text-muted leading-relaxed">
              Switching platforms resets the working list, clears all scanned tracks, and resets lyrics cache. Staged tracks cannot be carried across music platforms.
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            ref={cancelBtnRef}
            type="button"
            onClick={onCancel}
            className="min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium bg-surface-elevated text-text-secondary hover:text-text-primary border border-border-subtle transition focus:outline-none focus:ring-2 focus:ring-ring-focus"
          >
            Cancel
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={onConfirm}
            className="min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium bg-brand-primary text-brand-foreground hover:bg-brand-primary-hover transition shadow-md shadow-brand-primary/20 focus:outline-none focus:ring-2 focus:ring-ring-focus"
          >
            Switch & Clear List
          </button>
        </div>
      </div>
    </div>
  );
}
