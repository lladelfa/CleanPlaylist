import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Design Tokens & Google Fonts (Story 1.1)', () => {
  const indexHtmlPath = path.resolve(__dirname, '../../index.html');
  const indexCssPath = path.resolve(__dirname, '../index.css');

  it('index.html loads Google Fonts Plus Jakarta Sans and JetBrains Mono', () => {
    const html = fs.readFileSync(indexHtmlPath, 'utf-8');
    expect(html).toContain('fonts.googleapis.com');
    expect(html).toMatch(/Plus\+Jakarta\+Sans:.*400.*500.*600.*700/);
    expect(html).toMatch(/JetBrains\+Mono:.*400.*500/);
  });

  it('index.css declares all 30 Obsidian Audio Core design tokens in @theme', () => {
    const css = fs.readFileSync(indexCssPath, 'utf-8');
    expect(css).toContain('@theme');

    const expectedTokens = [
      '--color-surface-inset: #070D1F;',
      '--color-surface-canvas: #0C1324;',
      '--color-surface-low: #151B2D;',
      '--color-surface-card: #191F31;',
      '--color-surface-elevated: #23293C;',
      '--color-surface-highest: #2E3447;',
      '--color-surface-backdrop: #050812;',
      '--color-border-subtle: #2B3247;',
      '--color-border-strong: #4A4455;',
      '--color-ring-focus: #A78BFA;',
      '--color-text-primary: #DCE1FB;',
      '--color-text-secondary: #CCC3D8;',
      '--color-text-muted: #958DA1;',
      '--color-brand-primary: #7C3AED;',
      '--color-brand-primary-hover: #6D28D9;',
      '--color-brand-accent: #6366F1;',
      '--color-brand-tint: #D2BBFF;',
      '--color-brand-foreground: #FFFFFF;',
      '--color-status-clean: #4EDEA3;',
      '--color-status-clean-bg: #062E22;',
      '--color-status-clean-border: #10B981;',
      '--color-status-clean-ink: #022C1E;',
      '--color-status-flagged: #FFB4AB;',
      '--color-status-flagged-bg: #3B0A14;',
      '--color-status-flagged-border: #F43F5E;',
      '--color-status-caution: #FCD34D;',
      '--color-status-caution-bg: #332106;',
      '--color-status-caution-border: #F59E0B;',
      '--color-keyword-mark-bg: #422806;',
      '--color-keyword-mark-fg: #FDE68A;',
    ];

    for (const token of expectedTokens) {
      expect(css.toLowerCase()).toContain(token.toLowerCase());
    }

    expect(css).toContain('--font-sans:');
    expect(css).toContain('Plus Jakarta Sans');
    expect(css).toContain('--font-mono:');
    expect(css).toContain('JetBrains Mono');
  });
});
