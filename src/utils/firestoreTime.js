/**
 * Convert Firestore Timestamp, Date, plain { seconds }, ISO string, or number (ms) to Date.
 * Handles JSON-serialized Firestore values where `toDate` is missing.
 */
export function firestoreTimeToDate(ts) {
  if (ts == null || ts === '') return null;
  try {
    if (typeof ts.toDate === 'function') {
      const d = ts.toDate();
      return Number.isNaN(d.getTime()) ? null : d;
    }
    if (ts instanceof Date) return Number.isNaN(ts.getTime()) ? null : ts;
    if (typeof ts === 'object') {
      const sec = ts.seconds ?? ts._seconds;
      if (typeof sec === 'number' && Number.isFinite(sec)) {
        const ns = ts.nanoseconds ?? ts._nanoseconds ?? 0;
        return new Date(sec * 1000 + ns / 1e6);
      }
    }
    if (typeof ts === 'number' && Number.isFinite(ts)) {
      const d = new Date(ts);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    const d2 = new Date(ts);
    return Number.isNaN(d2.getTime()) ? null : d2;
  } catch {
    return null;
  }
}

/** Latest SET_WON event timestamp for a set (fallback when set.endTime is missing). */
export function matchSummarySetWonTime(matchSummary, setNumber) {
  let best = null;
  (matchSummary || []).forEach((e) => {
    if (String(e.type || '').toUpperCase() !== 'SET_WON') return;
    const sn = e.setNumber != null ? Number(e.setNumber) : e.set != null ? Number(e.set) : NaN;
    if (Number.isNaN(sn) || sn !== setNumber) return;
    const d = firestoreTimeToDate(e.timestamp);
    if (d && (!best || d.getTime() > best.getTime())) best = d;
  });
  return best;
}
