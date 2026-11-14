export const VERIFIED_CLEAN_CAVEAT =
  'Based on the lyrics we could find and your selected preset. You make the final call.';

export const CAVEAT_DISMISSED_KEY = 'cp_verified_clean_caveat_dismissed';

export function isVerifiedCleanTrack(track) {
  if (!track || track.is_flagged || track.was_replaced) return false;
  const vs = String(track.verification_status || '').toLowerCase();
  return vs === 'verified_clean' || vs === 'clean';
}
