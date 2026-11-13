import { describe, expect, it } from 'vitest';
import contract from '../../../../contracts/preset-contract.json';
import { DEFAULT_PRESET_PROFILES } from '../lyricEvaluator';
import { PRESET_COPY } from '../presetCopy';

const sorted = (list) => [...list].sort();

describe('preset micro-copy contract (Story 7.2)', () => {
  it('covers exactly the four canonical preset IDs in the fixture', () => {
    expect(contract.presets.map((p) => p.id).sort()).toEqual(
      ['custom', 'kid_safe', 'moderate', 'slurs_only'],
    );
  });

  it.each(contract.presets)('frontend profile for $id matches the contract rules', (expected) => {
    const profile = DEFAULT_PRESET_PROFILES[expected.id];
    expect(profile).toBeDefined();
    expect(profile.description).toBe(expected.description);
    expect(profile.include_metadata_explicit).toBe(expected.include_metadata_explicit);
    expect(sorted(profile.categories)).toEqual(sorted(expected.categories));
  });

  it.each(contract.presets)('displayed micro-copy for $id matches the contract copy', (expected) => {
    const copy = PRESET_COPY.find((p) => p.id === expected.id);
    expect(copy).toBeDefined();
    expect(copy.summary).toBe(expected.summary);
  });

  it('displays a copy entry for every preset in the contract, and nothing extra', () => {
    expect(PRESET_COPY.map((p) => p.id).sort()).toEqual(contract.presets.map((p) => p.id).sort());
  });

  // Ties copy to rules: a category or metadata-flag change in the fixture fails here
  // unless the summary is updated to match it in the same diff.
  const CATEGORY_COPY = {
    slurs: { mention: /slur/i },
    strong_profanity: { mention: /profanity/i },
    sexual: { mention: /sexual/i },
    substances: { mention: /drug/i },
  };

  it.each(contract.presets)('summary for $id mentions exactly its categories and metadata flag', (expected) => {
    const summary = PRESET_COPY.find((p) => p.id === expected.id).summary;
    for (const [category, { mention }] of Object.entries(CATEGORY_COPY)) {
      if (expected.categories.includes(category)) {
        expect(summary, `${expected.id} should mention ${category}`).toMatch(mention);
      } else {
        expect(summary, `${expected.id} should not mention ${category}`).not.toMatch(mention);
      }
    }
    if (expected.include_metadata_explicit) {
      expect(summary, `${expected.id} should mention tagged explicit tracks`).toMatch(/tagged explicit/i);
    } else {
      expect(summary, `${expected.id} should say it ignores explicit tags`).toMatch(/ignores explicit tags/i);
    }
  });
});
