import {
  collection,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  updateDoc,
  serverTimestamp,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { db } from '../firebase/config';

const GAMES_COLLECTION = 'games';

/**
 * Creates a new game document in Firestore
 * @param {string} gameCode - Unique 6-character game code
 * @param {Object} gameData - Initial game data
 * @returns {Promise<void>}
 */
export async function createGame(gameCode, gameData) {
  const gameRef = doc(db, GAMES_COLLECTION, gameCode);
  
  const gameDoc = {
    ...gameData,
    gameCode,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    status: gameData.status || 'LIVE', // LIVE or FINISHED
    currentSet: gameData.currentSet || 1,
    sets: gameData.sets || [],
    setsWon: gameData.setsWon || {
      A: 0,
      B: 0
    },
    sanctionSystem: gameData.sanctionSystem || {
      misconduct: { A: [], B: [] },
      delay: { A: { count: 0, log: [] }, B: { count: 0, log: [] } }
    }
  };

  await setDoc(gameRef, gameDoc);
  return gameCode;
}

/**
 * Retrieves a game by its code
 * @param {string} gameCode - Game code to look up
 * @returns {Promise<Object|null>} Game data or null if not found
 */
export async function getGameByCode(gameCode) {
  const gameRef = doc(db, GAMES_COLLECTION, gameCode);
  const gameSnap = await getDoc(gameRef);
  
  if (gameSnap.exists()) {
    return { id: gameSnap.id, ...gameSnap.data() };
  }
  
  return null;
}

/**
 * Sets up a real-time listener for game updates
 * @param {string} gameCode - Game code to listen to
 * @param {Function} callback - Callback function called on updates
 * @returns {Function} Unsubscribe function
 */
export function listenToGame(gameCode, callback) {
  const gameRef = doc(db, GAMES_COLLECTION, gameCode);
  
  return onSnapshot(gameRef, (snapshot) => {
    if (snapshot.exists()) {
      callback({ id: snapshot.id, ...snapshot.data() });
    } else {
      callback(null);
    }
  }, (error) => {
    console.error('Error listening to game:', error);
    callback(null);
  });
}

/**
 * Updates the score for a team in the current set
 * @param {string} gameCode - Game code
 * @param {string} team - 'A' or 'B'
 * @param {number} increment - Score increment (usually 1 or -1 for undo)
 * @returns {Promise<void>}
 */
export async function updateScore(gameCode, team, increment = 1) {
  const gameRef = doc(db, GAMES_COLLECTION, gameCode);
  const gameSnap = await getDoc(gameRef);
  
  if (!gameSnap.exists()) {
    throw new Error('Game not found');
  }
  
  const gameData = gameSnap.data();
  const currentSet = gameData.currentSet || 1;
  
  // Ensure sets array exists and has current set
  let sets = gameData.sets || [];
  if (!sets[currentSet - 1]) {
    sets[currentSet - 1] = {
      setNumber: currentSet,
      score: { A: 0, B: 0 },
      serving: gameData.serving || 'A',
      timeouts: { A: [], B: [] },
      substitutions: { A: [], B: [] },
      startTime: new Date()
    };
  }
  
  const set = sets[currentSet - 1];
  const newScore = (set.score[team] || 0) + increment;
  
  // Prevent negative scores
  if (newScore < 0) {
    throw new Error('Score cannot be negative');
  }
  
  // Update the score
  set.score[team] = newScore;
  
  // Update serving team (alternates after each point)
  set.serving = team;
  
  // Update sets array
  sets[currentSet - 1] = set;
  
  await updateDoc(gameRef, {
    sets,
    updatedAt: serverTimestamp()
  });
}

/**
 * Marks a set as won and moves to next set
 * @param {string} gameCode - Game code
 * @param {string} winner - 'A' or 'B'
 * @returns {Promise<void>}
 */
export async function updateSets(gameCode, winner) {
  const gameRef = doc(db, GAMES_COLLECTION, gameCode);
  const gameSnap = await getDoc(gameRef);
  
  if (!gameSnap.exists()) {
    throw new Error('Game not found');
  }
  
  const gameData = gameSnap.data();
  const currentSet = gameData.currentSet || 1;
  let sets = gameData.sets || [];
  
  // Mark current set as won
  if (sets[currentSet - 1]) {
    sets[currentSet - 1].winner = winner;
    sets[currentSet - 1].endTime = new Date();
  }
  
  // Update sets won count
  const setsWon = gameData.setsWon || { A: 0, B: 0 };
  setsWon[winner] = (setsWon[winner] || 0) + 1;
  
  // Determine if match is finished (format can be string from Firestore)
  const format = Number(gameData.format) || 3;
  const setsToWin = Math.ceil(format / 2);
  const isFinished = setsWon[winner] >= setsToWin;
  
  // Move to next set if not finished (e.g. best of 5: win set 2 -> go to set 3)
  const nextSet = isFinished ? currentSet : currentSet + 1;
  
  // Ensure sets array is long enough before writing
  while (sets.length < nextSet) sets.push(null);
  if (!isFinished && !sets[nextSet - 1]) {
    sets[nextSet - 1] = {
      setNumber: nextSet,
      score: { A: 0, B: 0 },
      serving: winner === 'A' ? 'B' : 'A', // Other team serves first
      timeouts: { A: [], B: [] },
      substitutions: { A: [], B: [] },
      startTime: new Date()
    };
  }
  
  await updateDoc(gameRef, {
    sets,
    setsWon,
    currentSet: nextSet,
    status: isFinished ? 'FINISHED' : 'LIVE',
    updatedAt: serverTimestamp()
  });
}

/**
 * Marks the game as finished
 * @param {string} gameCode - Game code
 * @returns {Promise<void>}
 */
export async function markGameFinished(gameCode) {
  const gameRef = doc(db, GAMES_COLLECTION, gameCode);
  
  await updateDoc(gameRef, {
    status: 'FINISHED',
    finishedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

/**
 * Updates the lineup for a team
 * @param {string} gameCode - Game code
 * @param {string} team - 'A' or 'B'
 * @param {Object} lineup - Lineup data
 * @returns {Promise<void>}
 */
export async function updateLineup(gameCode, team, lineup) {
  const gameRef = doc(db, GAMES_COLLECTION, gameCode);
  const gameSnap = await getDoc(gameRef);
  
  if (!gameSnap.exists()) {
    throw new Error('Game not found');
  }
  
  const gameData = gameSnap.data();
  const teams = gameData.teams || {};
  
  if (!teams[team]) {
    teams[team] = {};
  }
  
  teams[team].lineup = lineup;
  
  await updateDoc(gameRef, {
    teams,
    updatedAt: serverTimestamp()
  });
}

/**
 * Records a timeout for a team in the current set (max 2 per set per team)
 * @param {string} gameCode - Game code
 * @param {string} team - 'A' or 'B'
 * @returns {Promise<{ ok: boolean, message?: string }>}
 */
export async function recordTimeout(gameCode, team) {
  const gameRef = doc(db, GAMES_COLLECTION, gameCode);
  const gameSnap = await getDoc(gameRef);

  if (!gameSnap.exists()) {
    throw new Error('Game not found');
  }

  const gameData = gameSnap.data();
  const currentSet = gameData.currentSet || 1;
  let sets = [...(gameData.sets || [])];

  if (!sets[currentSet - 1]) {
    throw new Error('No current set');
  }

  const set = sets[currentSet - 1];
  if (!set.timeouts) set.timeouts = { A: [], B: [] };
  if (set.timeouts[team].length >= 2) {
    return { ok: false, message: 'Maximum 2 timeouts per set' };
  }

  set.timeouts[team].push({
    time: Date.now(),
    score: {
      A: set.score?.A ?? 0,
      B: set.score?.B ?? 0
    }
  });
  sets[currentSet - 1] = set;

  await updateDoc(gameRef, {
    sets,
    updatedAt: serverTimestamp()
  });
  return { ok: true };
}

/**
 * Records a substitution and updates the lineup
 * @param {string} gameCode - Game code
 * @param {string} team - 'A' or 'B'
 * @param {string} playerOut - Jersey number of player going out
 * @param {string} playerIn - Jersey number of player coming in
 * @returns {Promise<{ ok: boolean, message?: string }>}
 */
export async function recordSubstitution(gameCode, team, playerOut, playerIn) {
  const gameRef = doc(db, GAMES_COLLECTION, gameCode);
  const gameSnap = await getDoc(gameRef);

  if (!gameSnap.exists()) {
    throw new Error('Game not found');
  }

  const gameData = gameSnap.data();
  const currentSet = gameData.currentSet || 1;
  const subLimit = Number(gameData.subLimit) || 6;
  const sets = [...(gameData.sets || [])];
  const teams = gameData.teams ? { ...gameData.teams } : { A: { players: [], lineup: [] }, B: { players: [], lineup: [] } };

  if (!teams[team] || !Array.isArray(teams[team].lineup)) {
    throw new Error('Team or lineup not found');
  }

  if (!sets[currentSet - 1]) {
    throw new Error('No current set');
  }

  const set = sets[currentSet - 1];
  if (!set.substitutions) set.substitutions = { A: [], B: [] };
  if (set.substitutions[team].length >= subLimit) {
    return { ok: false, message: `Maximum ${subLimit} substitutions per set reached` };
  }

  const lineup = [...teams[team].lineup];
  while (lineup.length < 6) lineup.push(null);
  const posIndex = lineup.indexOf(String(playerOut));
  if (posIndex === -1) {
    return { ok: false, message: 'Player not found on court' };
  }

  set.substitutions[team].push({
    time: Date.now(),
    score: { A: set.score?.A ?? 0, B: set.score?.B ?? 0 },
    playerOut: String(playerOut),
    playerIn: String(playerIn),
    position: posIndex + 1
  });
  lineup[posIndex] = String(playerIn);
  teams[team].lineup = lineup;
  sets[currentSet - 1] = set;

  await updateDoc(gameRef, {
    sets,
    teams,
    updatedAt: serverTimestamp()
  });
  return { ok: true };
}

/**
 * Updates team officials and signatures (captain, coach, refs). Can also update team names.
 * @param {string} gameCode - Game code
 * @param {Object} officials - { coachA, asstCoachA, medicalA, trainerA, coachB, ... signatures: { captainSignA1, ... }, teamAName?, teamBName? }
 */
export async function updateOfficials(gameCode, officials) {
  const gameRef = doc(db, GAMES_COLLECTION, gameCode);
  const gameSnap = await getDoc(gameRef);

  if (!gameSnap.exists()) {
    throw new Error('Game not found');
  }

  const gameData = gameSnap.data();
  const { teamAName: oTeamA, teamBName: oTeamB, ...rest } = officials;
  const existingOfficials = gameData.officials || {};
  const merged = {
    ...existingOfficials,
    ...rest,
    signatures: { ...(existingOfficials.signatures || {}), ...(officials.signatures || {}) }
  };

  const updatePayload = {
    officials: merged,
    officialsSavedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  if (oTeamA != null) updatePayload.teamAName = oTeamA;
  if (oTeamB != null) updatePayload.teamBName = oTeamB;

  await updateDoc(gameRef, updatePayload);
}

/**
 * Toggle swap sides (which team is displayed on left/right). Used by referee and display views.
 * @param {string} gameCode - Game code
 * @returns {Promise<void>}
 */
export async function updateGameSwapped(gameCode) {
  const gameRef = doc(db, GAMES_COLLECTION, gameCode);
  const gameSnap = await getDoc(gameRef);
  if (!gameSnap.exists()) throw new Error('Game not found');
  const gameData = gameSnap.data();
  const current = !!gameData.swapped;
  await updateDoc(gameRef, {
    swapped: !current,
    updatedAt: serverTimestamp()
  });
}

/**
 * Manual rotation: rotate team lineup clockwise (P1→P6, P2→P1, …). For corrections only.
 * @param {string} gameCode - Game code
 * @param {string} team - 'A' or 'B'
 */
export async function rotateLineup(gameCode, team) {
  const gameRef = doc(db, GAMES_COLLECTION, gameCode);
  const gameSnap = await getDoc(gameRef);
  if (!gameSnap.exists()) throw new Error('Game not found');
  const gameData = gameSnap.data();
  const teams = gameData.teams ? { ...gameData.teams } : { A: { players: [], lineup: [] }, B: { players: [], lineup: [] } };
  if (!teams[team] || !Array.isArray(teams[team].lineup)) throw new Error('Team or lineup not found');
  const lineup = [...teams[team].lineup];
  if (lineup.length === 0) throw new Error('Lineup is empty');
  const first = lineup.shift();
  lineup.push(first);
  teams[team].lineup = lineup;
  await updateDoc(gameRef, {
    teams,
    updatedAt: serverTimestamp()
  });
}

/**
 * Libero replacement: put libero at a court position (does not count toward sub limit)
 * @param {string} gameCode - Game code
 * @param {string} team - 'A' or 'B'
 * @param {number} positionIndex - 0-5 (P1-P6)
 * @param {string} liberoJersey - Jersey number of libero
 */
export async function recordLiberoReplacement(gameCode, team, positionIndex, liberoJersey) {
  const gameRef = doc(db, GAMES_COLLECTION, gameCode);
  const gameSnap = await getDoc(gameRef);

  if (!gameSnap.exists()) {
    throw new Error('Game not found');
  }

  const gameData = gameSnap.data();
  const teams = gameData.teams ? { ...gameData.teams } : { A: { players: [], lineup: [] }, B: { players: [], lineup: [] } };
  if (!teams[team] || !Array.isArray(teams[team].lineup)) {
    throw new Error('Team or lineup not found');
  }

  const lineup = [...teams[team].lineup];
  while (lineup.length < 6) lineup.push(null);
  if (positionIndex < 0 || positionIndex >= 6) {
    throw new Error('Invalid position');
  }
  lineup[positionIndex] = String(liberoJersey);
  teams[team].lineup = lineup;

  await updateDoc(gameRef, {
    teams,
    updatedAt: serverTimestamp()
  });
}

/**
 * Undoes the last score change
 * @param {string} gameCode - Game code
 * @returns {Promise<void>}
 */
export async function undoLastPoint(gameCode) {
  const gameRef = doc(db, GAMES_COLLECTION, gameCode);
  const gameSnap = await getDoc(gameRef);
  
  if (!gameSnap.exists()) {
    throw new Error('Game not found');
  }
  
  const gameData = gameSnap.data();
  const currentSet = gameData.currentSet || 1;
  const sets = gameData.sets || [];
  
  if (!sets[currentSet - 1]) {
    throw new Error('No set data found');
  }
  
  const set = sets[currentSet - 1];
  
  // Simple undo: decrement the serving team's score
  // In a more complex implementation, you might track history
  const servingTeam = set.serving || 'A';
  const currentScore = set.score[servingTeam] || 0;
  
  if (currentScore > 0) {
    set.score[servingTeam] = currentScore - 1;
    // Toggle serving team
    set.serving = servingTeam === 'A' ? 'B' : 'A';
    
    sets[currentSet - 1] = set;
    
    await updateDoc(gameRef, {
      sets,
      updatedAt: serverTimestamp()
    });
  }
}

/**
 * Record a sanction (misconduct or delay). Optionally adds a point for the opponent for P/DP.
 * @param {string} gameCode - Game code
 * @param {string} team - 'A' or 'B' (sanctioned team)
 * @param {'misconduct'|'delay'} module - sanction module
 * @param {Object} payload - misconduct: { type: 'W'|'P'|'EXP'|'DISQ', personType: 'player'|'coach', person: jersey or 'coach', reason?, notes? } or delay: { type: 'DW'|'DP' }
 */
export async function recordSanction(gameCode, team, module, payload) {
  const gameRef = doc(db, GAMES_COLLECTION, gameCode);
  const gameSnap = await getDoc(gameRef);
  if (!gameSnap.exists()) throw new Error('Game not found');

  const gameData = gameSnap.data();
  const currentSet = gameData.currentSet || 1;
  const sets = [...(gameData.sets || [])];
  const set = sets[currentSet - 1];
  if (!set || !set.score) throw new Error('No current set');

  const score = { A: set.score.A || 0, B: set.score.B || 0 };
  const sanctionSystem = gameData.sanctionSystem || {
    misconduct: { A: [], B: [] },
    delay: { A: { count: 0, log: [] }, B: { count: 0, log: [] } }
  };

  const opp = team === 'A' ? 'B' : 'A';
  const addPointForOpponent = (payload.type === 'P' || payload.type === 'EXP' || payload.type === 'DISQ' || payload.type === 'DP');

  if (module === 'misconduct') {
    const list = [...(sanctionSystem.misconduct?.[team] || [])];
    list.push({
      set: currentSet,
      time: new Date().toISOString(),
      type: payload.type,
      personType: payload.personType || 'player',
      person: payload.person ?? '',
      reason: payload.reason || '',
      notes: payload.notes || '',
      score: { ...score }
    });
    sanctionSystem.misconduct = sanctionSystem.misconduct || { A: [], B: [] };
    sanctionSystem.misconduct[team] = list;
  } else {
    const delayData = sanctionSystem.delay?.[team] || { count: 0, log: [] };
    const log = [...(delayData.log || [])];
    log.push({
      set: currentSet,
      time: new Date().toISOString(),
      type: payload.type,
      score: { ...score }
    });
    sanctionSystem.delay = sanctionSystem.delay || { A: { count: 0, log: [] }, B: { count: 0, log: [] } };
    sanctionSystem.delay[team] = { count: (delayData.count || 0) + 1, log };
  }

  const updateData = { sanctionSystem, updatedAt: serverTimestamp() };
  if (addPointForOpponent) {
    set.score[opp] = (set.score[opp] || 0) + 1;
    sets[currentSet - 1] = set;
    updateData.sets = sets;
  }

  await updateDoc(gameRef, updateData);
  return { ok: true, addPoint: addPointForOpponent };
}
