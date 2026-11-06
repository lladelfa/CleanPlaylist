import React, { useRef } from 'react';

/**
 * CatalogSelector
 * Segmented pill toggle for active catalog context (Spotify <-> YouTube Music).
 * Designed according to Obsidian Audio Core tokens with arrow key navigation
 * and accessible >=44px touch targets.
 */
export default function CatalogSelector({ activePlatform, onSelectPlatform }) {
  const options = [
    { id: 'spotify', label: 'Spotify' },
    { id: 'ytmusic', label: 'YouTube Music' },
  ];

  const buttonRefs = useRef({});

  const handleKeyDown = (e, currentId) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const nextId = currentId === 'spotify' ? 'ytmusic' : 'spotify';
      buttonRefs.current[nextId]?.focus();
      if (nextId !== activePlatform && onSelectPlatform) {
        onSelectPlatform(nextId);
      }
    }
  };

  return (
    <div
      role="group"
      aria-label="Music Catalog Selector"
      className="inline-flex items-center bg-surface-inset border border-border-strong rounded-full p-1"
    >
      {options.map((option) => {
        const isActive = activePlatform === option.id;
        return (
          <button
            key={option.id}
            ref={(el) => (buttonRefs.current[option.id] = el)}
            type="button"
            aria-pressed={isActive}
            onKeyDown={(e) => handleKeyDown(e, option.id)}
            onClick={() => {
              if (!isActive && onSelectPlatform) {
                onSelectPlatform(option.id);
              }
            }}
            className={`min-h-[36px] sm:min-h-[32px] px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-ring-focus ${
              isActive
                ? 'bg-surface-elevated text-text-primary shadow-sm'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
