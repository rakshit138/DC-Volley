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

/** ~28KB per logo × 2 ≪ 1MB Firestore doc limit (Spark/free tier). */
const MAX_LOGO_BYTES = 28000;

async function prepareLogo(value) {
  if (!value) return '';
  if (isDataUrl(value)) return compressToMaxBytes(value, MAX_LOGO_BYTES);
  return value;
}

/**
 * Store team logos in a separate Firestore doc so the main game doc stays small.
 * No Firebase Storage required.
 */
export async function saveGameAssets(gameCode, { logoA, logoB } = {}) {
  const ref = doc(db, ASSETS_COLLECTION, gameCode);
  const payload = { gameCode, updatedAt: serverTimestamp() };

  if (logoA !== undefined) payload.logoA = logoA ? await prepareLogo(logoA) : '';
  if (logoB !== undefined) payload.logoB = logoB ? await prepareLogo(logoB) : '';

  const snap = await getDoc(ref);
  if (snap.exists()) {
    await updateDoc(ref, payload);
  } else {
    await setDoc(ref, { ...payload, createdAt: serverTimestamp() });
  }

  return payload;
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
