// Display micro-copy for the screening preset pills. Checked against the shared
// contract in contracts/preset-contract.json by presetContract.test.js (Story 7.2).
export const PRESET_COPY = [
  {
    id: 'kid_safe',
    label: 'Kid Safe',
    summary:
      'Strictest: flags slurs, all profanity, sexual terms, and drug references, plus tracks tagged explicit.',
  },
  {
    id: 'moderate',
    label: 'Moderate',
    summary:
      'Radio-edit rules: flags slurs, strong profanity, and sexual terms, plus tracks tagged explicit; allows mild words like damn/hell.',
  },
  {
    id: 'slurs_only',
    label: 'Slurs Only',
    summary:
      'Flags only slurs and hate speech; allows other explicit lyrics and ignores explicit tags.',
  },
  {
    id: 'custom',
    label: 'Custom',
    summary: 'Slurs and strong profanity, plus tracks tagged explicit.',
  },
];
