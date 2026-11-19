import React from 'react';
import { BookOpen, Disc3, Search, Shuffle } from 'lucide-react';
import CatalogSelector from './CatalogSelector';

/**
 * GlobalHeader
 * Unified studio header with 4 tabs (Scan & Clean, Keyword Search, Stitch Studio, About),
 * electric violet branding across both platforms, and integrated CatalogSelector.
 * Public login / Read-Only badges are intentionally removed per zero-login architecture.
 */
export default function GlobalHeader({
  activeTab,
  setActiveTab,
  activePlatform,
  onSelectPlatform,
  vipMode = false,
  isAuthenticated = false,
  onLogin = () => {},
  onExitVip = () => {},
}) {
  const tabs = [
    { id: 'scan', label: 'Scan & Clean', mobileLabel: 'Scan', icon: Disc3 },
    { id: 'keywords', label: 'Keyword Search', mobileLabel: 'Keywords', icon: Search },
    { id: 'stitch', label: 'Stitch Studio', mobileLabel: 'Stitch', icon: Shuffle },
    { id: 'about', label: 'About', mobileLabel: 'About', icon: BookOpen },
  ];

  return (
    <header className="sticky top-0 z-40 h-auto pt-[env(safe-area-inset-top)] bg-surface-low/95 backdrop-blur border-b border-border-subtle">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 min-h-14 py-2 md:h-14 md:py-0 flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-4">
        {/* Brand & Catalog Context */}
        <div className="flex items-center justify-between md:justify-start gap-2 sm:gap-4 w-full md:w-auto shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-brand-primary/20 border border-brand-primary/40 flex items-center justify-center shadow-md shadow-brand-primary/10 shrink-0">
              <Disc3 className="h-4 w-4 sm:h-5 sm:w-5 text-brand-tint animate-spin-slow" aria-hidden="true" />
            </div>
            <span className="text-base sm:text-xl font-bold text-text-primary tracking-tight truncate">
              CleanPlaylist
            </span>
          </div>
          <CatalogSelector
            activePlatform={activePlatform}
            onSelectPlatform={onSelectPlatform}
          />
        </div>

        {/* Studio Navigation Tabs & VIP Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between md:justify-end gap-2 sm:gap-3 w-full md:w-auto">
          <nav
            role="navigation"
            aria-label="Studio Navigation"
            className="grid grid-cols-4 gap-1.5 w-full md:w-auto md:flex md:items-center md:space-x-2"
          >
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-label={tab.label}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => setActiveTab(tab.id)}
                  className={`min-h-[44px] sm:min-h-[40px] flex items-center justify-center gap-1.5 sm:space-x-2 px-2 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-ring-focus ${
                    isActive
                      ? 'bg-surface-elevated text-brand-tint border border-brand-primary/30 shadow-sm'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="md:hidden truncate">{tab.mobileLabel}</span>
                  <span className="hidden md:inline">{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {vipMode && (
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border-subtle pt-2 sm:border-t-0 sm:pt-0 sm:border-l sm:pl-3">
              <span className="bg-brand-primary/20 text-brand-tint border border-brand-primary/40 text-xs px-2 py-0.5 rounded-full font-mono font-semibold">
                VIP
              </span>
              {isAuthenticated ? (
                <div className="bg-surface-elevated text-text-secondary border border-border-subtle text-xs px-2.5 py-1 rounded-lg flex items-center gap-1.5 min-h-[44px] sm:min-h-0">
                  <span className="w-2 h-2 rounded-full bg-brand-primary inline-block" aria-hidden="true" />
                  <span>Spotify Connected</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onLogin}
                  aria-label="Connect Spotify"
                  className="bg-surface-elevated hover:bg-surface-highest text-text-primary border border-border-subtle text-xs px-3 py-1.5 rounded-lg font-medium transition min-h-[44px] sm:min-h-0 flex items-center"
                >
                  Connect Spotify
                </button>
              )}
              <button
                type="button"
                onClick={onExitVip}
                aria-label="Exit VIP Mode"
                className="text-text-muted hover:text-text-primary text-xs px-2.5 py-1 rounded-lg border border-transparent hover:border-border-subtle transition min-h-[44px] sm:min-h-0 flex items-center"
              >
                Exit VIP Mode
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
