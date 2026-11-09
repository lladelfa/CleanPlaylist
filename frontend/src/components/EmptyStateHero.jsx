import React from 'react';
import { Music, Sliders, Sparkles } from 'lucide-react';

const STEPS = [
  {
    step: '01',
    title: 'Source Music',
    description: 'Search catalog, paste multi-line list, or paste a playlist link',
    icon: Music,
  },
  {
    step: '02',
    title: 'Screen Rules',
    description: 'Select Kid Safe, Moderate, or Slurs Only',
    icon: Sliders,
  },
  {
    step: '03',
    title: 'Clean Swaps',
    description: 'One-click swap explicit tracks with verified clean cuts',
    icon: Sparkles,
  },
];

export default function EmptyStateHero({ className = '' }) {
  return (
    <section
      role="region"
      aria-label="How CleanPlaylist works"
      className={`bg-surface-card border border-border-subtle rounded-2xl p-6 sm:p-8 shadow-xl ${className}`}
    >
      <div className="text-center max-w-xl mx-auto mb-8">
        <span className="inline-block px-2.5 py-0.5 rounded-full bg-surface-elevated border border-border-subtle text-brand-tint text-[11px] font-mono uppercase tracking-wider mb-2">
          Ready to Screen
        </span>
        <h2 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight">
          Stage your tracks and screen in 3 steps
        </h2>
        <p className="text-sm text-text-muted mt-1">
          Add songs from Spotify or YouTube Music, apply your sensitivity rules, and replace explicit content seamlessly.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
        {STEPS.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.step}
              className="bg-surface-inset border border-border-subtle rounded-xl p-5 flex flex-col items-start relative group transition-colors hover:border-brand-primary/40"
            >
              <div className="flex items-center justify-between w-full mb-3">
                <span className="font-mono text-xs font-semibold text-brand-tint px-2 py-0.5 rounded bg-surface-elevated border border-border-subtle">
                  {s.step}
                </span>
                <div className="p-2 rounded-lg bg-surface-elevated text-brand-primary">
                  <Icon className="w-4 h-4" aria-hidden="true" />
                </div>
              </div>
              <h3 className="text-base font-semibold text-text-primary mb-1">
                {s.title}
              </h3>
              <p className="text-xs text-text-muted leading-relaxed">
                {s.description}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
