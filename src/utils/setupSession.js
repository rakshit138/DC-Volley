/**
 * Tracks when the user began "new game" setup (rosters, lineups, officials).
 * Used for match duration on the referee panel — separate from set duration,
 * which starts when the game document is created (after officials).
 */
const KEY = 'dc_volley_prep_session_started_at';

export function markPrepSessionStart() {
  sessionStorage.setItem(KEY, new Date().toISOString());
}

/** If the user opened /game-setup without going through Home, start prep time on first visit. */
export function ensurePrepSessionStart() {
  if (!sessionStorage.getItem(KEY)) {
    markPrepSessionStart();
  }
}

/** @returns {Date | null} */
export function getPrepSessionStart() {
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}
