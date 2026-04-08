import { FieldValue } from 'firebase/firestore';

/**
 * Firestore rejects `undefined` anywhere in writes. Strip undefined from objects,
 * and map undefined array elements to null.
 */
export function sanitizeFirestoreWrite(value) {
  if (value === undefined) {
    return null;
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (value instanceof Date) {
    return value;
  }
  if (typeof value.toDate === 'function') {
    return value;
  }
  if (value instanceof FieldValue) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((el) => sanitizeFirestoreWrite(el === undefined ? null : el));
  }
  const out = {};
  for (const key of Object.keys(value)) {
    const v = value[key];
    if (v === undefined) {
      continue;
    }
    out[key] = sanitizeFirestoreWrite(v);
  }
  return out;
}
