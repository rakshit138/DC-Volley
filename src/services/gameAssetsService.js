import {
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { compressToMaxBytes, isDataUrl } from '../utils/imageUpload';

const ASSETS_COLLECTION = 'gameAssets';
const GAMES_COLLECTION = 'games';

/** ~28KB per logo × 2 ≪ 1MB Firestore doc limit (Spark/free tier). */
const MAX_LOGO_BYTES = 28000;

function isPermissionDenied(err) {
  return err?.code === 'permission-denied' || /insufficient permissions/i.test(String(err?.message || ''));
}

async function prepareLogo(value) {
  if (!value) return '';
  if (isDataUrl(value)) return compressToMaxBytes(value, MAX_LOGO_BYTES);
  return value;
}

/** Fallback: store compressed logos on the game doc (small enough to stay under 1MB). */
async function saveLogosInline(gameCode, { logoA, logoB } = {}) {
  const ref = doc(db, GAMES_COLLECTION, gameCode);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Game not found');

  const data = snap.data();
  const teams = data.teams ? JSON.parse(JSON.stringify(data.teams)) : { A: {}, B: {} };
  const matchInfo = { ...(data.matchInfo || {}) };

  if (logoA !== undefined) {
    const v = logoA ? await prepareLogo(logoA) : '';
    teams.A = { ...(teams.A || {}), logoData: v };
    matchInfo.logoA = v || null;
  }
  if (logoB !== undefined) {
    const v = logoB ? await prepareLogo(logoB) : '';
    teams.B = { ...(teams.B || {}), logoData: v };
    matchInfo.logoB = v || null;
  }

  await updateDoc(ref, {
    teams,
    matchInfo,
    updatedAt: serverTimestamp()
  });
}

/**
 * Store team logos in gameAssets/{code}. Falls back to inline on games/{code}
 * if rules for gameAssets are not deployed yet (permission-denied).
 */
export async function saveGameAssets(gameCode, { logoA, logoB } = {}) {
  const ref = doc(db, ASSETS_COLLECTION, gameCode);
  const payload = { gameCode, updatedAt: serverTimestamp() };

  if (logoA !== undefined) payload.logoA = logoA ? await prepareLogo(logoA) : '';
  if (logoB !== undefined) payload.logoB = logoB ? await prepareLogo(logoB) : '';

  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, payload);
    } else {
      await setDoc(ref, { ...payload, createdAt: serverTimestamp() });
    }
    return { storage: 'gameAssets' };
  } catch (err) {
    if (!isPermissionDenied(err)) throw err;
    console.warn('[gameAssets] Permission denied — saving compressed logos on game doc instead. Deploy firestore rules to enable gameAssets.', err);
    await saveLogosInline(gameCode, { logoA, logoB });
    return { storage: 'inline', permissionFallback: true };
  }
}

export function listenToGameAssets(gameCode, callback) {
  if (!gameCode) {
    callback(null);
    return () => {};
  }
  const ref = doc(db, ASSETS_COLLECTION, gameCode);
  return onSnapshot(
    ref,
    (snap) => callback(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    (err) => {
      if (isPermissionDenied(err)) {
        // Rules not deployed for gameAssets — inline logos on game doc are used instead
        callback(null);
        return;
      }
      console.error('Error listening to game assets:', err);
      callback(null);
    }
  );
}

/** Merge logos from gameAssets into gameData for UI/export compatibility. */
export function mergeGameWithAssets(gameData, assets) {
  if (!gameData) return null;

  const inlineA = gameData.teams?.A?.logoData || gameData.matchInfo?.logoA || '';
  const inlineB = gameData.teams?.B?.logoData || gameData.matchInfo?.logoB || '';
  const logoA = assets?.logoA || inlineA;
  const logoB = assets?.logoB || inlineB;

  if (!logoA && !logoB) return gameData;

  const teams = gameData.teams ? { ...gameData.teams } : {};
  const matchInfo = { ...(gameData.matchInfo || {}) };

  if (logoA) {
    teams.A = { ...(teams.A || {}), logoData: logoA };
    matchInfo.logoA = logoA;
  }
  if (logoB) {
    teams.B = { ...(teams.B || {}), logoData: logoB };
    matchInfo.logoB = logoB;
  }

  return { ...gameData, teams, matchInfo };
}

export async function resolveLogoForFirestore(_gameCode, _team, logoSource) {
  if (!logoSource) return '';
  return prepareLogo(logoSource);
}
