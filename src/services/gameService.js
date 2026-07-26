import {
  collection,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  updateDoc,
  serverTimestamp,
  Timestamp,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { saveGameAssets } from './gameAssetsService';
import { allowsP1Replacement } from '../utils/liberoServe';
import { sanitizeFirestoreWrite } from '../utils/firestoreSanitize';

const GAMES_COLLECTION = 'games';

/** Remove inline logo blobs from game payload — logos live in gameAssets/{code}. */
function stripInlineLogos(data) {
  if (!data) return data;
  const next = { ...data };
  if (next.teams) {
    next.teams = JSON.parse(JSON.stringify(next.teams));
    ['A', 'B', 'team1', 'team2'].forEach((key) => {
      if (next.teams[key]?.logoData) delete next.teams[key].logoData;
    });
  }
  if (next.matchInfo) {
    next.matchInfo = { ...next.matchInfo };
    delete next.matchInfo.logoA;
    delete next.matchInfo.logoB;
  }
  return next;
}

export function defaultChallengeSystem() {
  return {
    challenges: { A: 2, B: 2 },
    log: [],
    awaitingDecision: false,
    pendingTeam: null,
    pendingType: null,
    pendingScore: null,
    lastRallyRolledBack: false
  };
}

function buildSanctionSnapshot(gameData, sanctionSystem) {
  const ss = sanctionSystem || gameData.sanctionSystem || {};
  return JSON.parse(
    JSON.stringify({
      misconduct: ss.misconduct,
      delay: ss.delay,
      expelled: ss.expelled || { A: [], B: [] },
      disqualified: ss.disqualified,
      coachExpelled: ss.coachExpelled || { A: false, B: false },
      coachDisqualified: ss.coachDisqualified,
      sanctionsA: gameData.sanctionsA || 0,
      sanctionsB: gameData.sanctionsB || 0
    })
  );
}

function applyPointToTeamInMemory({
  gameData,
  sets,
  teams,
  team,
  currentSet,
  actionHistory,
  matchSummary,
  includeSanctionSnapshot = true
}) {
  const format = Number(gameData.format) || 3;
  const set = sets[currentSet - 1];
  const previousScore = { A: set.score?.A || 0, B: set.score?.B || 0 };
  const previousServing = set.serving || 'A';
  const previousLineupA = teams.A?.lineup ? [...teams.A.lineup] : [];
  const previousLineupB = teams.B?.lineup ? [...teams.B.lineup] : [];
  const previousLiberoReplacementsA = gameData.liberoReplacements?.A
    ? JSON.parse(JSON.stringify(gameData.liberoReplacements.A))
    : [];
  const previousLiberoReplacementsB = gameData.liberoReplacements?.B
    ? JSON.parse(JSON.stringify(gameData.liberoReplacements.B))
    : [];
  const previousSummaryLength = (matchSummary || []).length;

  const actionToSave = {
    type: 'point',
    team,
    previousScore,
    previousServing,
    previousLineupA,
    previousLineupB,
    previousLiberoReplacementsA,
    previousLiberoReplacementsB,
    setNumber: currentSet,
    previousSummaryLength
  };
  if (includeSanctionSnapshot) {
    actionToSave.sanctionSnapshot = buildSanctionSnapshot(gameData, gameData.sanctionSystem);
  }

  set.score[team] = (set.score[team] || 0) + 1;
  const updatedScore = { A: set.score.A || 0, B: set.score.B || 0 };

  const serviceChanged = set.serving !== team;
  if (serviceChanged) {
    set.serving = team;
    if (teams[team]?.lineup?.length > 0) {
      const lineup = [...teams[team].lineup];
      while (lineup.length < 6) lineup.push(null);
      const first = lineup.shift();
      lineup.push(first);
      teams[team].lineup = lineup;
    }
  }

  const scoreA = set.score.A || 0;
  const scoreB = set.score.B || 0;
  const isDecidingSet = (format === 5 && currentSet === 5) || (format === 3 && currentSet === 3);
  const target = isDecidingSet ? 15 : 25;
  const lead = 2;

  let completed = false;
  let winner = null;
  let setsWon = { ...(gameData.setsWon || { A: 0, B: 0 }) };
  let status = gameData.status || 'LIVE';
  let awaitingNextSet = gameData.awaitingNextSet || false;
  let setBreakStartedAt = gameData.setBreakStartedAt || null;

  const summary = [...(matchSummary || [])];
  summary.push({
    type: 'POINT',
    team,
    setNumber: currentSet,
    description: `Point scored by Team ${team}`,
    score: updatedScore,
    timestamp: new Date()
  });

  const updatedActionHistory = [...(actionHistory || []), actionToSave];
  if (updatedActionHistory.length > 50) updatedActionHistory.shift();

  if ((scoreA >= target && scoreA - scoreB >= lead) || (scoreB >= target && scoreB - scoreA >= lead)) {
    completed = true;
    winner = scoreA > scoreB ? 'A' : 'B';
    set.winner = winner;
    set.endTime = new Date();
    setsWon[winner] = (setsWon[winner] || 0) + 1;
    const setsToWin = Math.ceil(format / 2);
    const isFinished = setsWon[winner] >= setsToWin;
    status = isFinished ? 'FINISHED' : 'LIVE';
    awaitingNextSet = !isFinished;
    setBreakStartedAt = !isFinished ? new Date() : null;
    summary.push({
      type: 'SET_WON',
      team: winner,
      setNumber: currentSet,
      description: `Set ${currentSet} won by Team ${winner}`,
      score: updatedScore,
      timestamp: new Date()
    });
    sets[currentSet - 1] = set;
    return {
      completed,
      winner,
      matchFinished: isFinished,
      sets,
      teams,
      setsWon,
      actionHistory: updatedActionHistory,
      matchSummary: summary,
      status,
      awaitingNextSet,
      setBreakStartedAt
    };
  }

  sets[currentSet - 1] = set;
  return {
    completed: false,
    sets,
    teams,
    setsWon,
    actionHistory: updatedActionHistory,
    matchSummary: summary,
    status,
    awaitingNextSet,
    setBreakStartedAt
  };
}

/**
 * Creates a new game document in Firestore
 * @param {string} gameCode - Unique 6-character game code
 * @param {Object} gameData - Initial game data
 * @returns {Promise<void>}
 */
export async function createGame(gameCode, gameData) {
  const gameRef = doc(db, GAMES_COLLECTION, gameCode);
  const cleaned = stripInlineLogos(gameData);
  const { sets: rawSets = [], ...rest } = cleaned;
  // Firestore does not allow serverTimestamp() inside array elements — use Timestamp.now() for set 1 start.
  const sets = (rawSets || []).map((s, i) => {
    if (i === 0) {
      const { startTime: _omitStart, ...row } = s || {};
      return { ...row, startTime: Timestamp.now() };
    }
    return s;
  });

  const gameDoc = {
    ...rest,
    gameCode,
    sets,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    /** Set at creation so referee panel does not force the officials modal open again */
    officialsSavedAt: serverTimestamp(),
    /** Clock anchor for "live" play — after setup/officials; used if set.startTime missing */
    playStartedAt: serverTimestamp(),
    status: rest.status || 'LIVE',
    currentSet: rest.currentSet || 1,
    setsWon: rest.setsWon || {
      A: 0,
      B: 0
    },
    sanctionSystem: rest.sanctionSystem || {
      misconduct: { A: [], B: [] },
      delay: { A: { count: 0, log: [] }, B: { count: 0, log: [] } },
      expelled: { A: [], B: [] }, // [{jersey, set}] - cleared next set
      disqualified: { A: [], B: [] }, // [{jersey}] - entire match
      coachExpelled: { A: false, B: false },
      coachDisqualified: { A: false, B: false }
    },
    challengeSystem: rest.challengeSystem || defaultChallengeSystem(),
    coachLineupsBySet: rest.coachLineupsBySet || {},
    coachLineupLockedA: rest.coachLineupLockedA || false,
    coachLineupLockedB: rest.coachLineupLockedB || false
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
  
  await updateDoc(gameRef, {
    sets,
    setsWon,
    currentSet,
    awaitingNextSet: !isFinished,
    setBreakStartedAt: !isFinished ? serverTimestamp() : null,
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

  // Save action to history BEFORE making changes
  const actionHistory = gameData.actionHistory || [];
  const actionToSave = {
    type: 'timeout',
    team: team,
    setNumber: currentSet
  };
  
  set.timeouts[team].push({
    time: Date.now(),
    score: {
      A: set.score?.A ?? 0,
      B: set.score?.B ?? 0
    }
  });
  sets[currentSet - 1] = set;

  // Update action history (keep last 50 actions)
  const updatedActionHistory = [...actionHistory, actionToSave];
  if (updatedActionHistory.length > 50) {
    updatedActionHistory.shift();
  }

  const matchSummary = gameData.matchSummary || [];
  matchSummary.push({
    type: 'TIMEOUT',
    team,
    setNumber: currentSet,
    description: `Timeout requested by Team ${team}`,
    score: { A: set.score?.A ?? 0, B: set.score?.B ?? 0 },
    timestamp: new Date()
  });

  await updateDoc(gameRef, {
    sets,
    actionHistory: updatedActionHistory,
    matchSummary,
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
  if (!set.substitutionTracking) set.substitutionTracking = { A: {}, B: {} };
  if (!set.completedSubstitutions) set.completedSubstitutions = { A: [], B: [] };
  
  const playerOutStr = String(playerOut);
  const playerInStr = String(playerIn);

  // Expulsion & disqualification: replacement uses the normal substitution path (counts toward limit, pairing rules apply).
  // At the sub cap, replacing an expelled-this-set or disqualified player is still allowed.
  const sanctionSystem = gameData.sanctionSystem || {};
  const disqList = sanctionSystem.disqualified?.[team] || [];
  const expList = sanctionSystem.expelled?.[team] || [];
  const isDisqualified = disqList.some((e) => String(e.jersey) === playerOutStr);
  const isExpelledThisSet = expList.some((e) => String(e.jersey) === playerOutStr && e.set === currentSet);

  // Count completed substitutions (FIVB rule: each substitution action counts)
  const actualSubCount = (set.substitutions[team] || []).length;
  if (actualSubCount >= subLimit && !isDisqualified && !isExpelledThisSet) {
    return { ok: false, message: `❌ MAXIMUM SUBSTITUTIONS REACHED\n\nYou have already used all ${subLimit} regular substitutions for this set.\n\n🚑 For injuries, use the "Exceptional Substitution" button instead.\n\nExceptional substitutions do NOT count toward the substitution limit.` };
  }

  // Rule 1: Once a player has completed their substitution, they CANNOT go out again (exact HTML)
  if ((set.completedSubstitutions[team] || []).includes(playerOutStr)) {
    return { ok: false, message: `❌ INVALID SUBSTITUTION!\n\nFIVB Rule: Player #${playerOutStr} has completed their substitution.\n\nAfter completing a substitution (OUT then back IN with same player), both players cannot be substituted again in this set.` };
  }

  // Rule 2: If playerOut is already paired, they can ONLY sub with their paired player
  if (set.substitutionTracking[team]?.[playerOutStr]) {
    const pairedPlayer = set.substitutionTracking[team][playerOutStr].pairedWith;
    if (pairedPlayer !== playerInStr) {
      return { ok: false, message: `❌ INVALID SUBSTITUTION!\n\nFIVB Rule: Player #${playerOutStr} is paired with Player #${pairedPlayer}.\n\nPlayer #${playerOutStr} can ONLY substitute with Player #${pairedPlayer} (not with Player #${playerInStr}).` };
    }
  }

  // Rule 3: If playerIn is already paired, they can ONLY sub with their paired player
  if (set.substitutionTracking[team]?.[playerInStr]) {
    const pairedPlayer = set.substitutionTracking[team][playerInStr].pairedWith;
    if (pairedPlayer !== playerOutStr) {
      return { ok: false, message: `❌ INVALID SUBSTITUTION!\n\nFIVB Rule: Player #${playerInStr} is paired with Player #${pairedPlayer}.\n\nPlayer #${playerInStr} can ONLY substitute with Player #${pairedPlayer} (not with Player #${playerOutStr}).` };
    }
  }

  // Save action to history BEFORE making changes
  const actionHistory = gameData.actionHistory || [];
  const previousLineup = teams[team].lineup ? [...teams[team].lineup] : [];
  const previousSubstitutionTracking = set.substitutionTracking?.[team] 
    ? JSON.parse(JSON.stringify(set.substitutionTracking[team]))
    : {};
  const previousCompletedSubstitutions = set.completedSubstitutions?.[team] 
    ? [...set.completedSubstitutions[team]]
    : [];
  
  const lineup = [...teams[team].lineup];
  while (lineup.length < 6) lineup.push(null);
  const posIndex = lineup.findIndex((j) => String(j) === playerOutStr);
  if (posIndex === -1) {
    return { ok: false, message: 'Player not found on court' };
  }
  
  // Check if this is a return substitution (player coming back)
  const isReturning = set.substitutionTracking[team]?.[playerOutStr] && 
                      set.substitutionTracking[team][playerOutStr].pairedWith === playerInStr;
  
  if (isReturning) {
    // This completes the substitution for BOTH players
    if (!set.substitutionTracking[team][playerOutStr]) {
      set.substitutionTracking[team][playerOutStr] = {};
    }
    if (!set.substitutionTracking[team][playerInStr]) {
      set.substitutionTracking[team][playerInStr] = {};
    }
    set.substitutionTracking[team][playerOutStr].completed = true;
    set.substitutionTracking[team][playerInStr].completed = true;
    
    // Mark both as completed
    if (!set.completedSubstitutions[team].includes(playerInStr)) {
      set.completedSubstitutions[team].push(playerInStr);
    }
    if (!set.completedSubstitutions[team].includes(playerOutStr)) {
      set.completedSubstitutions[team].push(playerOutStr);
    }
  } else {
    // New pairing
    if (!set.substitutionTracking[team]) {
      set.substitutionTracking[team] = {};
    }
    set.substitutionTracking[team][playerOutStr] = {
      pairedWith: playerInStr,
      completed: false
    };
    set.substitutionTracking[team][playerInStr] = {
      pairedWith: playerOutStr,
      completed: false
    };
  }

  set.substitutions[team].push({
    time: Date.now(),
    score: { A: set.score?.A ?? 0, B: set.score?.B ?? 0 },
    playerOut: playerOutStr,
    playerIn: playerInStr,
    position: posIndex + 1
  });
  lineup[posIndex] = playerInStr;
  teams[team].lineup = lineup;
  sets[currentSet - 1] = set;

  // Save action to history
  const actionToSave = {
    type: 'substitution',
    team: team,
    playerOut: playerOutStr,
    playerIn: playerInStr,
    position: posIndex + 1,
    setNumber: currentSet,
    previousLineup: previousLineup,
    previousSubstitutionTracking: previousSubstitutionTracking,
    previousCompletedSubstitutions: previousCompletedSubstitutions
  };
  
  // Update action history (keep last 50 actions)
  const updatedActionHistory = [...actionHistory, actionToSave];
  if (updatedActionHistory.length > 50) {
    updatedActionHistory.shift();
  }

  const matchSummary = gameData.matchSummary || [];
  matchSummary.push({
    type: 'SUBSTITUTION',
    team,
    setNumber: currentSet,
    description: `Substitution Team ${team}: #${playerOutStr} OUT, #${playerInStr} IN`,
    score: { A: set.score?.A ?? 0, B: set.score?.B ?? 0 },
    timestamp: new Date()
  });

  await updateDoc(gameRef, {
    sets,
    teams,
    actionHistory: updatedActionHistory,
    matchSummary,
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
  
  // Save action to history BEFORE making changes
  const actionHistory = gameData.actionHistory || [];
  const previousLineup = teams[team].lineup ? [...teams[team].lineup] : [];
  const previousLiberoReplacements = gameData.liberoReplacements?.[team] 
    ? JSON.parse(JSON.stringify(gameData.liberoReplacements[team]))
    : [];
  
  const lineup = [...teams[team].lineup];
  if (lineup.length === 0) throw new Error('Lineup is empty');
  const first = lineup.shift();
  lineup.push(first);
  teams[team].lineup = lineup;
  
  // Save action to history
  const actionToSave = {
    type: 'rotation',
    team: team,
    previousLineup: previousLineup,
    previousLiberoReplacements: previousLiberoReplacements
  };
  
  // Update action history (keep last 50 actions)
  const updatedActionHistory = [...actionHistory, actionToSave];
  if (updatedActionHistory.length > 50) {
    updatedActionHistory.shift();
  }
  
  await updateDoc(gameRef, {
    teams,
    actionHistory: updatedActionHistory,
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
 * Undoes the last action (point, timeout, substitution, libero, rotation, etc.)
 * Matches original HTML undoPoint() function exactly
 * @param {string} gameCode - Game code
 * @returns {Promise<{ ok: boolean, message?: string }>}
 */
export async function undoLastPoint(gameCode) {
  const gameRef = doc(db, GAMES_COLLECTION, gameCode);
  const gameSnap = await getDoc(gameRef);
  
  if (!gameSnap.exists()) {
    throw new Error('Game not found');
  }
  
  const gameData = gameSnap.data();
  const actionHistory = gameData.actionHistory || [];
  
  if (actionHistory.length === 0) {
    return { ok: false, message: 'No actions to undo' };
  }

  const lastAction = actionHistory[actionHistory.length - 1];
  const updatedActionHistory = actionHistory.slice(0, -1);

  // Fix #2: Undo "start next set" using explicit history entry (old path wrongly popped a point from history).
  if (lastAction.type === 'nextSet') {
    let sets = [...(gameData.sets || [])];
    let teams = gameData.teams ? { ...gameData.teams } : { A: { players: [], lineup: [] }, B: { players: [], lineup: [] } };
    sets.pop();
    const la = lastAction;
    teams.A.lineup = [...(la.previousLineupA || [])];
    teams.B.lineup = [...(la.previousLineupB || [])];
    while (teams.A.lineup.length < 6) teams.A.lineup.push(null);
    while (teams.B.lineup.length < 6) teams.B.lineup.push(null);
    const liberoReplacements = {
      A: la.previousLiberoReplacementsA ? JSON.parse(JSON.stringify(la.previousLiberoReplacementsA)) : [],
      B: la.previousLiberoReplacementsB ? JSON.parse(JSON.stringify(la.previousLiberoReplacementsB)) : []
    };
    await updateDoc(gameRef, {
      sets,
      teams,
      liberoReplacements,
      currentSet: la.previousCurrentSet,
      awaitingNextSet: true,
      setBreakStartedAt: serverTimestamp(),
      actionHistory: updatedActionHistory,
      updatedAt: serverTimestamp()
    });
    return {
      ok: true,
      message: `Undone: Canceled starting set ${(la.previousCurrentSet || 0) + 1} — complete lineup setup again.`,
      reopenedNextSetSetup: true
    };
  }

  const currentSet = gameData.currentSet || 1;
  let sets = [...(gameData.sets || [])];
  let teams = gameData.teams ? { ...gameData.teams } : { A: { players: [], lineup: [] }, B: { players: [], lineup: [] } };
  
  if (lastAction.type === 'point') {
    const set = sets[currentSet - 1];
    if (!set) {
      return { ok: false, message: 'No current set' };
    }
    
    set.score = { ...lastAction.previousScore };
    set.serving = lastAction.previousServing;
    teams.A.lineup = lastAction.previousLineupA ? [...lastAction.previousLineupA] : [];
    teams.B.lineup = lastAction.previousLineupB ? [...lastAction.previousLineupB] : [];
    
    const liberoReplacements = {
      A: lastAction.previousLiberoReplacementsA ? JSON.parse(JSON.stringify(lastAction.previousLiberoReplacementsA)) : [],
      B: lastAction.previousLiberoReplacementsB ? JSON.parse(JSON.stringify(lastAction.previousLiberoReplacementsB)) : []
    };
    
    const matchSummary = gameData.matchSummary || [];
    const restoredSummary = lastAction.previousSummaryLength !== undefined 
      ? matchSummary.slice(0, lastAction.previousSummaryLength)
      : matchSummary;
    
    let sanctionSystem = gameData.sanctionSystem;
    if (lastAction.sanctionSnapshot) {
      sanctionSystem = JSON.parse(JSON.stringify(lastAction.sanctionSnapshot));
    }
    
    let setsWon = gameData.setsWon || { A: 0, B: 0 };
    if (set.winner) {
      const winner = set.winner;
      delete set.winner;
      delete set.endTime;
      if (setsWon[winner] > 0) {
        setsWon[winner] = setsWon[winner] - 1;
      }
    }
    
    sets[currentSet - 1] = set;

    const pointUndoPayload = {
      sets,
      setsWon,
      teams,
      liberoReplacements,
      matchSummary: restoredSummary,
      sanctionSystem,
      actionHistory: updatedActionHistory,
      status: 'LIVE',
      currentSet: currentSet,
      updatedAt: serverTimestamp()
    };
    // After removing a set win (or fixing a stuck "awaiting next set" state), allow play in this set again
    if (!set.winner) {
      pointUndoPayload.awaitingNextSet = false;
      pointUndoPayload.setBreakStartedAt = null;
    }

    await updateDoc(gameRef, pointUndoPayload);

    return { ok: true, message: `Undone: Point for Team ${lastAction.team}, score restored to ${lastAction.previousScore.A}-${lastAction.previousScore.B}` };
  } else if (lastAction.type === 'timeout') {
    const set = sets[currentSet - 1];
    if (set && set.timeouts && set.timeouts[lastAction.team]) {
      set.timeouts[lastAction.team].pop();
      sets[currentSet - 1] = set;
      
      await updateDoc(gameRef, {
        sets,
        actionHistory: updatedActionHistory,
        updatedAt: serverTimestamp()
      });
      
      return { ok: true, message: `Undone: Timeout for Team ${lastAction.team}` };
    }
  } else if (lastAction.type === 'substitution') {
    const set = sets[currentSet - 1];
    if (set && set.substitutions && set.substitutions[lastAction.team]) {
      set.substitutions[lastAction.team].pop();
      teams[lastAction.team].lineup = lastAction.previousLineup ? [...lastAction.previousLineup] : teams[lastAction.team].lineup;
      
      if (lastAction.previousSubstitutionTracking) {
        if (!set.substitutionTracking) set.substitutionTracking = { A: {}, B: {} };
        set.substitutionTracking[lastAction.team] = JSON.parse(JSON.stringify(lastAction.previousSubstitutionTracking));
      }
      
      if (lastAction.previousCompletedSubstitutions) {
        if (!set.completedSubstitutions) set.completedSubstitutions = { A: [], B: [] };
        set.completedSubstitutions[lastAction.team] = [...lastAction.previousCompletedSubstitutions];
      }
      
      sets[currentSet - 1] = set;
      
      await updateDoc(gameRef, {
        sets,
        teams,
        actionHistory: updatedActionHistory,
        updatedAt: serverTimestamp()
      });
      
      return { ok: true, message: `Undone: Substitution for Team ${lastAction.team}` };
    }
  } else if (lastAction.type === 'libero') {
    // Remove libero replacement from tracking
    const liberoReplacements = gameData.liberoReplacements || { A: [], B: [] };
    liberoReplacements[lastAction.team] = (liberoReplacements[lastAction.team] || []).filter(r => 
      !(r.libero === String(lastAction.libero) && r.originalPlayer === String(lastAction.originalPlayer))
    );
    
    // Restore original player in lineup
    const posIndex = teams[lastAction.team].lineup.indexOf(String(lastAction.libero));
    if (posIndex !== -1) {
      teams[lastAction.team].lineup[posIndex] = String(lastAction.originalPlayer);
    }
    
    await updateDoc(gameRef, {
      teams,
      liberoReplacements,
      actionHistory: updatedActionHistory,
      updatedAt: serverTimestamp()
    });
    
    return { ok: true, message: `Undone: Libero replacement for Team ${lastAction.team}` };
  } else if (lastAction.type === 'exceptionalSubstitution') {
    const set = sets[currentSet - 1];
    if (set && set.exceptionalSubstitutions && set.exceptionalSubstitutions[lastAction.team]) {
      // Remove last exceptional substitution
      set.exceptionalSubstitutions[lastAction.team].pop();
      
      // Restore lineup
      teams[lastAction.team].lineup = lastAction.previousLineup ? [...lastAction.previousLineup] : teams[lastAction.team].lineup;
      
      sets[currentSet - 1] = set;
      
      await updateDoc(gameRef, {
        sets,
        teams,
        actionHistory: updatedActionHistory,
        updatedAt: serverTimestamp()
      });
      
      return { ok: true, message: `Undone: Exceptional substitution for Team ${lastAction.team}` };
    }
  } else if (lastAction.type === 'rotation') {
    teams[lastAction.team].lineup = lastAction.previousLineup ? [...lastAction.previousLineup] : teams[lastAction.team].lineup;
    
    const liberoReplacements = gameData.liberoReplacements || { A: [], B: [] };
    if (lastAction.previousLiberoReplacements) {
      liberoReplacements[lastAction.team] = JSON.parse(JSON.stringify(lastAction.previousLiberoReplacements));
    }
    
    await updateDoc(gameRef, {
      teams,
      liberoReplacements,
      actionHistory: updatedActionHistory,
      updatedAt: serverTimestamp()
    });
    
    return { ok: true, message: `Undone: Manual rotation for Team ${lastAction.team}` };
  }
  
  // If action type not handled, just remove from history
  await updateDoc(gameRef, {
    actionHistory: updatedActionHistory,
    updatedAt: serverTimestamp()
  });
  
  return { ok: true, message: 'Action undone' };
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
    delay: { A: { count: 0, log: [] }, B: { count: 0, log: [] } },
    expelled: { A: [], B: [] },
    disqualified: { A: [], B: [] },
    coachExpelled: { A: false, B: false },
    coachDisqualified: { A: false, B: false }
  };

  const opp = team === 'A' ? 'B' : 'A';
  // FIVB: only Penalty (P) and Delay Penalty (DP) award a point to the opponent
  const addPointForOpponent =
    (module === 'misconduct' && payload.type === 'P') ||
    (module === 'delay' && payload.type === 'DP');
  const matchSummary = gameData.matchSummary || [];

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
    
    // If DISQ (disqualification), add to disqualified list
    if (payload.type === 'DISQ' && payload.personType === 'player') {
      sanctionSystem.disqualified = sanctionSystem.disqualified || { A: [], B: [] };
      const disqList = [...(sanctionSystem.disqualified[team] || [])];
      if (!disqList.find(e => String(e.jersey) === String(payload.person))) {
        disqList.push({ jersey: String(payload.person), set: currentSet, time: new Date().toISOString() });
        sanctionSystem.disqualified[team] = disqList;
      }
    } else if (payload.type === 'DISQ' && payload.personType === 'coach') {
      sanctionSystem.coachDisqualified = sanctionSystem.coachDisqualified || { A: false, B: false };
      sanctionSystem.coachDisqualified[team] = true;
    }
    if (payload.type === 'EXP' && payload.personType === 'player') {
      sanctionSystem.expelled = sanctionSystem.expelled || { A: [], B: [] };
      const ex = [...(sanctionSystem.expelled[team] || [])];
      if (!ex.some((e) => String(e.jersey) === String(payload.person) && e.set === currentSet)) {
        ex.push({ jersey: String(payload.person), set: currentSet });
        sanctionSystem.expelled[team] = ex;
      }
    } else if (payload.type === 'EXP' && payload.personType === 'coach') {
      sanctionSystem.coachExpelled = sanctionSystem.coachExpelled || { A: false, B: false };
      sanctionSystem.coachExpelled[team] = true;
    }
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

  matchSummary.push({
    type: module === 'misconduct' ? 'SANCTION_MISCONDUCT' : 'SANCTION_DELAY',
    team,
    setNumber: currentSet,
    description: module === 'misconduct'
      ? `Sanction (${payload.type}) Team ${team} ${payload.personType === 'coach' ? 'Coach' : `#${payload.person}`}`
      : `Delay sanction (${payload.type}) Team ${team}`,
    score: { ...score },
    timestamp: new Date()
  });

  // If awarding penalty point, handle it like a regular point (save history, rotate, check set completion)
  if (addPointForOpponent) {
    const teams = gameData.teams
      ? JSON.parse(JSON.stringify(gameData.teams))
      : { A: { players: [], lineup: [] }, B: { players: [], lineup: [] } };
    // Save action to history BEFORE making changes (like original HTML awardPenaltyPoint)
    const actionHistory = gameData.actionHistory || [];
    const previousScore = { A: set.score?.A || 0, B: set.score?.B || 0 };
    const previousServing = set.serving || 'A';
    const previousLineupA = teams.A?.lineup ? [...teams.A.lineup] : [];
    const previousLineupB = teams.B?.lineup ? [...teams.B.lineup] : [];
    const previousLiberoReplacementsA = gameData.liberoReplacements?.A ? JSON.parse(JSON.stringify(gameData.liberoReplacements.A)) : [];
    const previousLiberoReplacementsB = gameData.liberoReplacements?.B ? JSON.parse(JSON.stringify(gameData.liberoReplacements.B)) : [];
    const previousSummaryLength = (gameData.matchSummary || []).length;
    
    // Create sanction snapshot for undo
    const sanctionSnapshot = JSON.parse(JSON.stringify({
      misconduct: sanctionSystem.misconduct,
      delay: sanctionSystem.delay,
      expelled: sanctionSystem.expelled || { A: [], B: [] },
      disqualified: sanctionSystem.disqualified,
      coachExpelled: sanctionSystem.coachExpelled || { A: false, B: false },
      coachDisqualified: sanctionSystem.coachDisqualified,
      sanctionsA: gameData.sanctionsA || 0,
      sanctionsB: gameData.sanctionsB || 0
    }));
    
    const actionToSave = {
      type: 'point',
      team: opp,
      previousScore: previousScore,
      previousServing: previousServing,
      previousLineupA: previousLineupA,
      previousLineupB: previousLineupB,
      previousLiberoReplacementsA: previousLiberoReplacementsA,
      previousLiberoReplacementsB: previousLiberoReplacementsB,
      setNumber: currentSet,
      previousSummaryLength: previousSummaryLength,
      sanctionSnapshot: sanctionSnapshot
    };
    
    // Increment opponent's score
    set.score[opp] = (set.score[opp] || 0) + 1;
    
    // If service is changing, rotate the team that now gets to serve (FIVB rule)
    const serviceChanged = set.serving !== opp;
    if (serviceChanged) {
      set.serving = opp;
      // Rotate the team that gained serve (clockwise: P1→P6, P2→P1, etc.)
      if (teams[opp] && Array.isArray(teams[opp].lineup) && teams[opp].lineup.length > 0) {
        const lineup = [...teams[opp].lineup];
        while (lineup.length < 6) lineup.push(null);
        const first = lineup.shift();
        lineup.push(first);
        teams[opp].lineup = lineup;
      }
    }
    
    // Check for set completion (same logic as addPoint)
    const format = Number(gameData.format) || 3;
    const scoreA = set.score.A || 0;
    const scoreB = set.score.B || 0;
    const isDecidingSet = (format === 5 && currentSet === 5) || (format === 3 && currentSet === 3);
    const target = isDecidingSet ? 15 : 25;
    const lead = 2;
    
    let completed = false;
    let winner = null;
    
    if ((scoreA >= target && scoreA - scoreB >= lead) || 
        (scoreB >= target && scoreB - scoreA >= lead)) {
      completed = true;
      winner = scoreA > scoreB ? 'A' : 'B';
      
      // Mark set as won
      set.winner = winner;
      set.endTime = new Date();
      
      // Update sets won
      const setsWon = gameData.setsWon || { A: 0, B: 0 };
      setsWon[winner] = (setsWon[winner] || 0) + 1;
      
      // Check if match is finished
      const setsToWin = Math.ceil(format / 2);
      const isFinished = setsWon[winner] >= setsToWin;
      
      sets[currentSet - 1] = set;
      
      // Update action history
      const updatedActionHistory = [...actionHistory, actionToSave];
      if (updatedActionHistory.length > 50) {
        updatedActionHistory.shift();
      }
      
      await updateDoc(gameRef, {
        sets,
        setsWon,
        teams,
        sanctionSystem,
        actionHistory: updatedActionHistory,
        matchSummary,
        status: isFinished ? 'FINISHED' : 'LIVE',
        currentSet,
        awaitingNextSet: !isFinished,
        setBreakStartedAt: !isFinished ? serverTimestamp() : null,
        updatedAt: serverTimestamp()
      });
      
      return { ok: true, addPoint: true, setCompleted: true, winner, matchFinished: isFinished, promptSubstitution: null };
    }
    
    sets[currentSet - 1] = set;
    
    // Update action history
    const updatedActionHistory = [...actionHistory, actionToSave];
    if (updatedActionHistory.length > 50) {
      updatedActionHistory.shift();
    }
    
    await updateDoc(gameRef, {
      sets,
      teams,
      sanctionSystem,
      actionHistory: updatedActionHistory,
      matchSummary,
      updatedAt: serverTimestamp()
    });
    
    return { ok: true, addPoint: true, serviceChanged, promptSubstitution: null };
  }

  // No penalty point - just update sanction system
  await updateDoc(gameRef, { sanctionSystem, matchSummary, updatedAt: serverTimestamp() });
  // Fix #5/#6: After expulsion or disqualification of a player, referee UI should open substitution flow.
  const promptSubstitution =
    module === 'misconduct' &&
    payload.personType === 'player' &&
    (payload.type === 'EXP' || payload.type === 'DISQ')
      ? { team, playerOut: String(payload.person) }
      : null;
  return { ok: true, addPoint: false, promptSubstitution };
}

/**
 * Adds a point to a team with automatic rotation and set completion logic
 * @param {string} gameCode - Game code
 * @param {string} team - 'A' or 'B'
 * @param {boolean} rallyActive - Whether rally is active
 * @returns {Promise<{ completed: boolean, winner?: string }>}
 */
export async function addPoint(gameCode, team, rallyActive = false) {
  if (!rallyActive) {
    throw new Error('Rally must be active to add points');
  }

  const gameRef = doc(db, GAMES_COLLECTION, gameCode);
  const gameSnap = await getDoc(gameRef);
  
  if (!gameSnap.exists()) {
    throw new Error('Game not found');
  }
  
  const gameData = gameSnap.data();
  if (gameData.awaitingNextSet) {
    throw new Error('This set is finished. Use Set Up Next Set (or Undo) before scoring.');
  }
  const currentSet = gameData.currentSet || 1;
  const format = Number(gameData.format) || 3;
  let sets = [...(gameData.sets || [])];
  let teams = gameData.teams ? { ...gameData.teams } : { A: { players: [], lineup: [] }, B: { players: [], lineup: [] } };
  
  if (!sets[currentSet - 1]) {
    throw new Error('No current set');
  }
  
  const set = sets[currentSet - 1];
  if (set.winner) {
    throw new Error('This set is complete. Set up the next set before scoring.');
  }
  const opponent = team === 'A' ? 'B' : 'A';
  
  // Save action to history BEFORE making changes (like original HTML)
  const actionHistory = gameData.actionHistory || [];
  const previousScore = { A: set.score?.A || 0, B: set.score?.B || 0 };
  const previousServing = set.serving || 'A';
  const previousLineupA = teams.A?.lineup ? [...teams.A.lineup] : [];
  const previousLineupB = teams.B?.lineup ? [...teams.B.lineup] : [];
  const previousLiberoReplacementsA = gameData.liberoReplacements?.A ? JSON.parse(JSON.stringify(gameData.liberoReplacements.A)) : [];
  const previousLiberoReplacementsB = gameData.liberoReplacements?.B ? JSON.parse(JSON.stringify(gameData.liberoReplacements.B)) : [];
  const previousSummaryLength = (gameData.matchSummary || []).length;
  const sanctionSnapshot = buildSanctionSnapshot(gameData, gameData.sanctionSystem);

  const actionToSave = {
    type: 'point',
    team: team,
    previousScore: previousScore,
    previousServing: previousServing,
    previousLineupA: previousLineupA,
    previousLineupB: previousLineupB,
    previousLiberoReplacementsA: previousLiberoReplacementsA,
    previousLiberoReplacementsB: previousLiberoReplacementsB,
    setNumber: currentSet,
    previousSummaryLength: previousSummaryLength,
    sanctionSnapshot
  };
  
  // Increment score
  set.score[team] = (set.score[team] || 0) + 1;
  const updatedScore = { A: set.score.A || 0, B: set.score.B || 0 };
  
  // Check if service changes (team gains serve)
  const serviceChanged = set.serving !== team;
  if (serviceChanged) {
    set.serving = team;
    // Rotate the team that gained serve (clockwise: P1→P6, P2→P1, etc.)
    if (teams[team] && Array.isArray(teams[team].lineup) && teams[team].lineup.length > 0) {
      const lineup = [...teams[team].lineup];
      // Ensure lineup has 6 positions
      while (lineup.length < 6) lineup.push(null);
      
      // Rotate clockwise
      const first = lineup.shift();
      lineup.push(first);
      teams[team].lineup = lineup;
    }
  }
  
  // Check for set completion
  const scoreA = set.score.A || 0;
  const scoreB = set.score.B || 0;
  const isDecidingSet = (format === 5 && currentSet === 5) || (format === 3 && currentSet === 3);
  const target = isDecidingSet ? 15 : 25;
  const lead = 2;
  
  let completed = false;
  let winner = null;
  
  if ((scoreA >= target && scoreA - scoreB >= lead) || 
      (scoreB >= target && scoreB - scoreA >= lead)) {
    completed = true;
    winner = scoreA > scoreB ? 'A' : 'B';
    
    // Mark set as won
    set.winner = winner;
    set.endTime = new Date();
    
    // Update sets won
    const setsWon = gameData.setsWon || { A: 0, B: 0 };
    setsWon[winner] = (setsWon[winner] || 0) + 1;
    
    // Check if match is finished
    const setsToWin = Math.ceil(format / 2);
    const isFinished = setsWon[winner] >= setsToWin;
    
    sets[currentSet - 1] = set;
    
    // Update action history (keep last 50 actions)
    const updatedActionHistory = [...actionHistory, actionToSave];
    if (updatedActionHistory.length > 50) {
      updatedActionHistory.shift();
    }
    
    const matchSummary = gameData.matchSummary || [];
    matchSummary.push({
      type: 'POINT',
      team,
      setNumber: currentSet,
      description: `Point scored by Team ${team}`,
      score: updatedScore,
      timestamp: new Date()
    });
    matchSummary.push({
      type: 'SET_WON',
      team: winner,
      setNumber: currentSet,
      description: `Set ${currentSet} won by Team ${winner}`,
      score: updatedScore,
      timestamp: new Date()
    });

    await updateDoc(gameRef, {
      sets,
      setsWon,
      teams,
      actionHistory: updatedActionHistory,
      matchSummary,
      status: isFinished ? 'FINISHED' : 'LIVE',
      currentSet,
      awaitingNextSet: !isFinished,
      setBreakStartedAt: !isFinished ? serverTimestamp() : null,
      updatedAt: serverTimestamp()
    });
    
    return { completed: true, winner, matchFinished: isFinished };
  }
  
  sets[currentSet - 1] = set;
  
  // Update action history (keep last 50 actions)
  const updatedActionHistory = [...actionHistory, actionToSave];
  if (updatedActionHistory.length > 50) {
    updatedActionHistory.shift();
  }
  
  const matchSummary = gameData.matchSummary || [];
  matchSummary.push({
    type: 'POINT',
    team,
    setNumber: currentSet,
    description: `Point scored by Team ${team}`,
    score: updatedScore,
    timestamp: new Date()
  });

  await updateDoc(gameRef, {
    sets,
    teams,
    actionHistory: updatedActionHistory,
    matchSummary,
    updatedAt: serverTimestamp()
  });
  
  return { completed: false };
}

/**
 * Records an exceptional substitution (injury, doesn't count toward limit)
 * @param {string} gameCode - Game code
 * @param {string} team - 'A' or 'B'
 * @param {string} playerOut - Jersey number of injured player
 * @param {string} playerIn - Jersey number of replacement
 * @param {string} [userRemarks] - Optional free-text remarks (stored and shown on reports)
 * @returns {Promise<{ ok: boolean, message?: string }>}
 */
export async function recordExceptionalSubstitution(gameCode, team, playerOut, playerIn, userRemarks) {
  const gameRef = doc(db, GAMES_COLLECTION, gameCode);
  const gameSnap = await getDoc(gameRef);
  
  if (!gameSnap.exists()) {
    throw new Error('Game not found');
  }
  
  const gameData = gameSnap.data();
  const currentSet = gameData.currentSet || 1;
  const sets = [...(gameData.sets || [])];
  const teams = gameData.teams ? { ...gameData.teams } : { A: { players: [], lineup: [] }, B: { players: [], lineup: [] } };
  
  if (!teams[team] || !Array.isArray(teams[team].lineup)) {
    throw new Error('Team or lineup not found');
  }
  
  if (!sets[currentSet - 1]) {
    throw new Error('No current set');
  }
  
  const set = sets[currentSet - 1];
  
  // Save action to history BEFORE making changes
  const actionHistory = gameData.actionHistory || [];
  const previousLineup = teams[team].lineup ? [...teams[team].lineup] : [];
  
  const lineup = [...teams[team].lineup];
  while (lineup.length < 6) lineup.push(null);
  
  const posIndex = lineup.findIndex((j) => String(j) === String(playerOut));
  if (posIndex === -1) {
    return { ok: false, message: 'Player not found on court' };
  }

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
  const otherTeam = team === 'A' ? 'B' : 'A';
  const scoreText = (set.score?.[team] ?? 0) + ':' + (set.score?.[otherTeam] ?? 0);
  const autoRemark = `Exceptional substitution: #${playerOut} replaced by #${playerIn} (injury) – Set ${currentSet} at ${scoreText}`;
  const remarksTrim = typeof userRemarks === 'string' ? userRemarks.trim() : '';
  const remarkCombined =
    remarksTrim.length > 0 ? `${autoRemark} | Remarks: ${remarksTrim}` : autoRemark;

  // Add to exceptional substitutions (separate from regular, exact HTML format)
  if (!set.exceptionalSubstitutions) {
    set.exceptionalSubstitutions = { A: [], B: [] };
  }
  const excSubRow = {
    time: Date.now(),
    score: { A: set.score?.A ?? 0, B: set.score?.B ?? 0 },
    playerOut: String(playerOut),
    playerIn: String(playerIn),
    position: posIndex + 1,
    timestamp: timeStr,
    setNumber: currentSet,
    remark: remarkCombined,
    tag: 'E'
  };
  if (remarksTrim.length > 0) {
    excSubRow.remarks = remarksTrim;
  }
  set.exceptionalSubstitutions[team].push(excSubRow);
  
  // Update lineup
  lineup[posIndex] = String(playerIn);
  teams[team].lineup = lineup;
  
  // Track injured player (locked for match)
  const injuredPlayers = gameData.injuredPlayers || { A: [], B: [] };
  if (!injuredPlayers[team].includes(String(playerOut))) {
    injuredPlayers[team].push(String(playerOut));
  }
  
  sets[currentSet - 1] = set;
  
  // Save action to history
  const actionToSave = {
    type: 'exceptionalSubstitution',
    team: team,
    playerOut: String(playerOut),
    playerIn: String(playerIn),
    position: posIndex + 1,
    setNumber: currentSet,
    previousLineup: previousLineup
  };
  if (remarksTrim.length > 0) {
    actionToSave.remarks = remarksTrim;
  }
  
  // Update action history (keep last 50 actions)
  const updatedActionHistory = [...actionHistory, actionToSave];
  if (updatedActionHistory.length > 50) {
    updatedActionHistory.shift();
  }
  
  const matchSummary = gameData.matchSummary || [];
  matchSummary.push({
    type: 'EXCEPTIONAL_SUBSTITUTION',
    team,
    setNumber: currentSet,
    description:
      remarksTrim.length > 0
        ? `Exceptional substitution Team ${team}: #${playerOut} OUT (injury), #${playerIn} IN — ${remarksTrim}`
        : `Exceptional substitution Team ${team}: #${playerOut} OUT (injury), #${playerIn} IN`,
    score: { A: set.score?.A ?? 0, B: set.score?.B ?? 0 },
    timestamp: new Date()
  });

  await updateDoc(
    gameRef,
    sanitizeFirestoreWrite({
      sets,
      teams,
      injuredPlayers,
      actionHistory: updatedActionHistory,
      matchSummary,
      updatedAt: serverTimestamp()
    })
  );

  return { ok: true };
}

/**
 * Records libero replacement with tracking
 * @param {string} gameCode - Game code
 * @param {string} team - 'A' or 'B'
 * @param {string} liberoJersey - Libero jersey number
 * @param {string} playerOutJersey - Original player jersey
 * @param {number} position - Position (1-6)
 * @returns {Promise<{ ok: boolean, message?: string }>}
 */
export async function recordLiberoReplacementWithTracking(gameCode, team, liberoJersey, playerOutJersey, position) {
  const gameRef = doc(db, GAMES_COLLECTION, gameCode);
  const gameSnap = await getDoc(gameRef);
  
  if (!gameSnap.exists()) {
    throw new Error('Game not found');
  }
  
  const gameData = gameSnap.data();
  const currentSet = gameData.currentSet || 1;
  const sets = [...(gameData.sets || [])];
  const teams = gameData.teams ? { ...gameData.teams } : { A: { players: [], lineup: [] }, B: { players: [], lineup: [] } };
  
  if (!teams[team] || !Array.isArray(teams[team].lineup)) {
    throw new Error('Team or lineup not found');
  }
  
  if (!sets[currentSet - 1]) {
    throw new Error('No current set');
  }
  
  const set = sets[currentSet - 1];
  const serving = set.serving || 'A';
  const teamName = gameData[`team${team}Name`] || gameData.teamAName || gameData.teamBName || `Team ${team}`;

  // FIVB Rule: Libero CANNOT serve unless LiberoServe designates this player (exact HTML logic)
  const posIndex = position - 1;
  if (posIndex === 0 && serving === team) {
    const canServe = allowsP1Replacement(
      team,
      playerOutJersey,
      1,
      gameData.liberoServeConfig || {},
      gameData
    );
    if (!canServe) {
      return {
        ok: false,
        message: `⛔ LIBERO CANNOT SERVE!\n\nFIVB Rule: The Libero is NOT allowed to serve.\n\nPosition P1 (Right Back) is currently the serving position for ${teamName}.\n\nTo allow libero serving: in the lineup setup, select a designated player under the Libero Serving Rule option.`
      };
    }
  }

  if (posIndex < 0 || posIndex >= 6) {
    return { ok: false, message: 'Invalid position' };
  }

  // Save action to history BEFORE making changes
  const actionHistory = gameData.actionHistory || [];
  const previousLineup = teams[team].lineup ? [...teams[team].lineup] : [];
  const previousLiberoReplacements = gameData.liberoReplacements?.[team]
    ? JSON.parse(JSON.stringify(gameData.liberoReplacements[team]))
    : [];

  const lineup = [...teams[team].lineup];
  while (lineup.length < 6) lineup.push(null);

  // Update lineup
  lineup[posIndex] = String(liberoJersey);
  teams[team].lineup = lineup;
  
  // Track libero replacement
  if (!gameData.liberoReplacements) {
    gameData.liberoReplacements = { A: [], B: [] };
  }
  
  const replacements = [...(gameData.liberoReplacements[team] || [])];
  // Remove existing replacement for this libero if any
  const existingIndex = replacements.findIndex(r => r.libero === String(liberoJersey));
  if (existingIndex >= 0) {
    replacements.splice(existingIndex, 1);
  }
  
  replacements.push({
    libero: String(liberoJersey),
    originalPlayer: String(playerOutJersey),
    position: position,
    set: currentSet
  });
  
  gameData.liberoReplacements[team] = replacements;
  sets[currentSet - 1] = set;
  
  // Save action to history
  const actionToSave = {
    type: 'libero',
    team: team,
    libero: String(liberoJersey),
    originalPlayer: String(playerOutJersey),
    position: position,
    setNumber: currentSet
  };
  
  // Update action history (keep last 50 actions)
  const updatedActionHistory = [...actionHistory, actionToSave];
  if (updatedActionHistory.length > 50) {
    updatedActionHistory.shift();
  }
  
  const matchSummary = gameData.matchSummary || [];
  // Fix #2/#7: Structured libero fields for export + history (replacement = libero entering for a back-row player)
  matchSummary.push({
    type: 'LIBERO_REPLACEMENT',
    liberoAction: 'replacement',
    team,
    setNumber: currentSet,
    liberoJersey: String(liberoJersey),
    playerOutJersey: String(playerOutJersey),
    playerInJersey: String(liberoJersey),
    position: position != null ? Number(position) : null,
    description: `Libero Team ${team}: #${liberoJersey} replaces #${playerOutJersey} at P${position}`,
    score: { A: set.score?.A ?? 0, B: set.score?.B ?? 0 },
    timestamp: new Date()
  });

  await updateDoc(gameRef, {
    sets,
    teams,
    liberoReplacements: gameData.liberoReplacements,
    actionHistory: updatedActionHistory,
    matchSummary,
    updatedAt: serverTimestamp()
  });
  
  return { ok: true };
}

/**
 * Removes libero from court (brings back original player)
 * @param {string} gameCode - Game code
 * @param {string} team - 'A' or 'B'
 * @param {string} liberoJersey - Libero jersey number
 * @returns {Promise<{ ok: boolean, message?: string }>}
 */
export async function removeLiberoFromCourt(gameCode, team, liberoJersey) {
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
  
  // Save action to history BEFORE making changes
  const actionHistory = gameData.actionHistory || [];
  const previousLineup = teams[team].lineup ? [...teams[team].lineup] : [];
  const previousLiberoReplacements = gameData.liberoReplacements?.[team] 
    ? JSON.parse(JSON.stringify(gameData.liberoReplacements[team]))
    : [];
  
  const liberoReplacements = gameData.liberoReplacements || { A: [], B: [] };
  const replacement = (liberoReplacements[team] || []).find(r => r.libero === String(liberoJersey));
  
  if (!replacement) {
    return { ok: false, message: 'Libero replacement not found' };
  }
  
  const lineup = [...teams[team].lineup];
  while (lineup.length < 6) lineup.push(null);
  
  // Libero may have rotated to a different position (e.g. front row); find current index (like HTML confirmAutoLiberoExit)
  const posIndex = lineup.findIndex(j => j != null && String(j) === String(liberoJersey));
  if (posIndex === -1) {
    return { ok: false, message: 'Libero not found in lineup' };
  }
  
  // Restore original player at the position where the libero currently is
  lineup[posIndex] = String(replacement.originalPlayer);
  teams[team].lineup = lineup;
  
  // Remove from replacements
  const updatedReplacements = liberoReplacements[team].filter(r => r.libero !== String(liberoJersey));
  liberoReplacements[team] = updatedReplacements;
  
  // Save action to history (position = current position where libero was removed)
  const actionToSave = {
    type: 'libero',
    team: team,
    libero: String(liberoJersey),
    originalPlayer: String(replacement.originalPlayer),
    position: posIndex + 1,
    setNumber: gameData.currentSet || 1
  };
  
  // Update action history (keep last 50 actions)
  const updatedActionHistory = [...actionHistory, actionToSave];
  if (updatedActionHistory.length > 50) {
    updatedActionHistory.shift();
  }
  
  const currentSet = gameData.currentSet || 1;
  const currentSetData = gameData.sets?.[currentSet - 1];
  const matchSummary = gameData.matchSummary || [];
  matchSummary.push({
    type: 'LIBERO_EXIT',
    liberoAction: 'exit',
    team,
    setNumber: currentSet,
    liberoJersey: String(liberoJersey),
    playerOutJersey: String(liberoJersey),
    playerInJersey: String(replacement.originalPlayer),
    position: posIndex + 1,
    description: `Libero exit Team ${team}: #${liberoJersey} out, #${replacement.originalPlayer} restored`,
    score: {
      A: currentSetData?.score?.A ?? 0,
      B: currentSetData?.score?.B ?? 0
    },
    timestamp: new Date()
  });

  await updateDoc(gameRef, {
    teams,
    liberoReplacements,
    actionHistory: updatedActionHistory,
    matchSummary,
    updatedAt: serverTimestamp()
  });
  
  return { ok: true };
}

/**
 * Sets up next set with new lineup
 * @param {string} gameCode - Game code
 * @param {Object} lineups - { A: [...], B: [...] } starting lineups for next set
 * @param {string} firstServer - 'A' or 'B'
 * @returns {Promise<void>}
 */
export async function setupNextSet(gameCode, lineups, firstServer) {
  const gameRef = doc(db, GAMES_COLLECTION, gameCode);
  const gameSnap = await getDoc(gameRef);
  
  if (!gameSnap.exists()) {
    throw new Error('Game not found');
  }
  
  const gameData = gameSnap.data();
  const currentSet = gameData.currentSet || 1;
  const nextSet = currentSet + 1;
  let sets = [...(gameData.sets || [])];
  const teams = gameData.teams ? { ...gameData.teams } : { A: { players: [], lineup: [] }, B: { players: [], lineup: [] } };
  const sanctionSystem = gameData.sanctionSystem || {};
  const injuredPlayers = gameData.injuredPlayers || { A: [], B: [] };
  const disqualifiedA = new Set((sanctionSystem.disqualified?.A || []).map((e) => String(e.jersey)));
  const disqualifiedB = new Set((sanctionSystem.disqualified?.B || []).map((e) => String(e.jersey)));
  const lockedA = new Set([...(injuredPlayers.A || []).map(String), ...disqualifiedA]);
  const lockedB = new Set([...(injuredPlayers.B || []).map(String), ...disqualifiedB]);
  const safeLineupA = (lineups.A || []).map((j) => (j != null && lockedA.has(String(j)) ? null : j));
  const safeLineupB = (lineups.B || []).map((j) => (j != null && lockedB.has(String(j)) ? null : j));
  if (safeLineupA.filter(Boolean).length !== 6 || safeLineupB.filter(Boolean).length !== 6) {
    throw new Error('Lineup contains ineligible players (injured/disqualified).');
  }
  
  // Ensure sets array is long enough
  while (sets.length < nextSet) {
    sets.push(null);
  }
  
  // Create new set
  sets[nextSet - 1] = {
    setNumber: nextSet,
    score: { A: 0, B: 0 },
    serving: firstServer,
    timeouts: { A: [], B: [] },
    substitutions: { A: [], B: [] },
    exceptionalSubstitutions: { A: [], B: [] },
    substitutionTracking: { A: {}, B: {} },
    completedSubstitutions: { A: [], B: [] },
    startingLineup: {
      A: safeLineupA,
      B: safeLineupB
    },
    startTime: new Date()
  };
  
  // Update team lineups
  teams.A.lineup = safeLineupA;
  teams.B.lineup = safeLineupB;

  // Fix #2: Record explicit undo anchor so Undo restores set number, lineups, libero state, and re-opens next-set flow.
  const prevActionHistory = gameData.actionHistory || [];
  const nextSetAction = {
    type: 'nextSet',
    previousCurrentSet: currentSet,
    previousLineupA: [...(gameData.teams?.A?.lineup || [])],
    previousLineupB: [...(gameData.teams?.B?.lineup || [])],
    previousLiberoReplacementsA: JSON.parse(JSON.stringify(gameData.liberoReplacements?.A || [])),
    previousLiberoReplacementsB: JSON.parse(JSON.stringify(gameData.liberoReplacements?.B || []))
  };
  while (nextSetAction.previousLineupA.length < 6) nextSetAction.previousLineupA.push(null);
  while (nextSetAction.previousLineupB.length < 6) nextSetAction.previousLineupB.push(null);
  const mergedHistory = [...prevActionHistory, nextSetAction];
  if (mergedHistory.length > 50) mergedHistory.shift();

  const prevChallenge = gameData.challengeSystem || defaultChallengeSystem();
  const challengeSystem = {
    ...prevChallenge,
    challenges: { A: 2, B: 2 },
    awaitingDecision: false,
    pendingTeam: null,
    pendingType: null,
    pendingScore: null,
    lastRallyRolledBack: false
  };

  // Keep setBreakStartedAt until the first "Start rally" of this new set (cleared in updateRallyState).
  await updateDoc(gameRef, {
    sets,
    teams,
    currentSet: nextSet,
    awaitingNextSet: false,
    actionHistory: mergedHistory,
    challengeSystem,
    coachLineupLockedA: false,
    coachLineupLockedB: false,
    updatedAt: serverTimestamp()
  });
}

/**
 * Records match history event
 * @param {string} gameCode - Game code
 * @param {Object} event - Event data
 * @returns {Promise<void>}
 */
export async function addMatchHistoryEvent(gameCode, event) {
  const gameRef = doc(db, GAMES_COLLECTION, gameCode);
  const gameSnap = await getDoc(gameRef);
  
  if (!gameSnap.exists()) {
    throw new Error('Game not found');
  }
  
  const gameData = gameSnap.data();
  const matchSummary = gameData.matchSummary || [];
  
  matchSummary.push({
    ...event,
    timestamp: new Date()
  });
  
  await updateDoc(gameRef, {
    matchSummary,
    updatedAt: serverTimestamp()
  });
}

/**
 * Updates rally state
 * @param {string} gameCode - Game code
 * @param {boolean} rallyActive - Whether rally is active
 * @returns {Promise<void>}
 */
export async function updateRallyState(gameCode, rallyActive) {
  const gameRef = doc(db, GAMES_COLLECTION, gameCode);
  const gameSnap = await getDoc(gameRef);
  if (!gameSnap.exists()) {
    throw new Error('Game not found');
  }
  const gameData = gameSnap.data();
  if (rallyActive) {
    if (gameData.awaitingNextSet) {
      throw new Error('Set break in progress. Set up the next set before starting a rally.');
    }
    const currentSet = gameData.currentSet || 1;
    const sets = [...(gameData.sets || [])];
    const row = sets[currentSet - 1];
    if (row?.winner) {
      throw new Error('This set is complete. Set up the next set before starting a rally.');
    }
    // Per-set clock: anchor on first "Start rally" in this set (Timestamp.now — no serverTimestamp in array elements)
    if (row && !row.setClockStartedAt) {
      sets[currentSet - 1] = { ...row, setClockStartedAt: Timestamp.now() };
      await updateDoc(gameRef, {
        sets,
        rallyActive,
        setBreakStartedAt: null,
        updatedAt: serverTimestamp()
      });
      return;
    }
  }

  await updateDoc(gameRef, {
    rallyActive,
    ...(rallyActive ? { setBreakStartedAt: null } : {}),
    updatedAt: serverTimestamp()
  });
}

/**
 * Request a video challenge (stores pending state in Firestore)
 */
export async function requestChallenge(gameCode, team, type) {
  const gameRef = doc(db, GAMES_COLLECTION, gameCode);
  const gameSnap = await getDoc(gameRef);
  if (!gameSnap.exists()) throw new Error('Game not found');

  const gameData = gameSnap.data();
  const cs = gameData.challengeSystem || defaultChallengeSystem();
  if (cs.awaitingDecision) throw new Error('Pending challenge not yet decided!');
  if (!team || !type) throw new Error('Select team and challenge type');
  if ((cs.challenges?.[team] ?? 0) <= 0) throw new Error(`Team ${team} has no challenges left`);

  const currentSet = gameData.currentSet || 1;
  const set = gameData.sets?.[currentSet - 1];
  const pendingScore = set ? { A: set.score?.A || 0, B: set.score?.B || 0 } : null;

  await updateDoc(gameRef, {
    challengeSystem: {
      ...cs,
      awaitingDecision: true,
      pendingTeam: team,
      pendingType: type,
      pendingScore,
      lastRallyRolledBack: false
    },
    updatedAt: serverTimestamp()
  });
  return { ok: true };
}

/**
 * Resolve a pending challenge (UNSUCCESSFUL or SUCCESSFUL with rally rollback)
 */
export async function resolveChallenge(gameCode, result) {
  const gameRef = doc(db, GAMES_COLLECTION, gameCode);
  const gameSnap = await getDoc(gameRef);
  if (!gameSnap.exists()) throw new Error('Game not found');

  const gameData = gameSnap.data();
  const cs = gameData.challengeSystem || defaultChallengeSystem();
  if (!cs.awaitingDecision) throw new Error('No pending challenge');

  const team = cs.pendingTeam;
  const type = cs.pendingType;
  const currentSet = gameData.currentSet || 1;
  const teamAName = gameData.teamAName || 'Team A';
  const teamBName = gameData.teamBName || 'Team B';
  const teamName = team === 'A' ? teamAName : teamBName;
  const opponentName = team === 'A' ? teamBName : teamAName;

  const entry = {
    set: currentSet,
    team,
    teamName,
    type,
    result,
    timestamp: new Date().toLocaleTimeString(),
    scoreAtChallenge: cs.pendingScore || null,
    opponentName
  };

  let matchSummary = [...(gameData.matchSummary || [])];
  let challengeSystem = { ...cs };

  if (result === 'UNSUCCESSFUL') {
    challengeSystem.challenges = {
      ...challengeSystem.challenges,
      [team]: Math.max(0, (challengeSystem.challenges?.[team] ?? 0) - 1)
    };
    entry.action = 'CONFIRMED';
    challengeSystem.log = [entry, ...(challengeSystem.log || [])];
    challengeSystem.awaitingDecision = false;
    challengeSystem.pendingTeam = null;
    challengeSystem.pendingType = null;
    challengeSystem.pendingScore = null;
    challengeSystem.lastRallyRolledBack = false;

    matchSummary.push({
      type: 'CHALLENGE',
      team,
      setNumber: currentSet,
      description: `🚩 ${teamName} Challenge UNSUCCESSFUL (${type}) — Decision stands, -1 challenge`,
      score: cs.pendingScore || undefined,
      timestamp: new Date()
    });

    await updateDoc(gameRef, {
      challengeSystem,
      matchSummary,
      updatedAt: serverTimestamp()
    });
    return { ok: true, result: 'UNSUCCESSFUL' };
  }

  if (challengeSystem.lastRallyRolledBack) {
    throw new Error('This rally was already rolled back!');
  }

  let sets = [...(gameData.sets || [])];
  let teams = gameData.teams ? JSON.parse(JSON.stringify(gameData.teams)) : { A: { players: [], lineup: [] }, B: { players: [], lineup: [] } };
  let actionHistory = [...(gameData.actionHistory || [])];
  let liberoReplacements = {
    A: gameData.liberoReplacements?.A ? JSON.parse(JSON.stringify(gameData.liberoReplacements.A)) : [],
    B: gameData.liberoReplacements?.B ? JSON.parse(JSON.stringify(gameData.liberoReplacements.B)) : []
  };
  let sanctionSystem = gameData.sanctionSystem
    ? JSON.parse(JSON.stringify(gameData.sanctionSystem))
    : undefined;
  let setsWon = { ...(gameData.setsWon || { A: 0, B: 0 }) };
  let status = gameData.status || 'LIVE';
  let awaitingNextSet = gameData.awaitingNextSet || false;
  let setBreakStartedAt = gameData.setBreakStartedAt || null;

  let lastPointIdx = -1;
  for (let hi = actionHistory.length - 1; hi >= 0; hi--) {
    if (actionHistory[hi].type === 'point') {
      lastPointIdx = hi;
      break;
    }
  }
  if (lastPointIdx === -1) throw new Error('No point action found in history to roll back');

  const snapshot = actionHistory[lastPointIdx];
  const set = sets[currentSet - 1];
  if (!set) throw new Error('Current set not found');

  set.score = { ...snapshot.previousScore };
  set.serving = snapshot.previousServing;
  teams.A.lineup = snapshot.previousLineupA ? [...snapshot.previousLineupA] : [];
  teams.B.lineup = snapshot.previousLineupB ? [...snapshot.previousLineupB] : [];
  liberoReplacements.A = snapshot.previousLiberoReplacementsA
    ? JSON.parse(JSON.stringify(snapshot.previousLiberoReplacementsA))
    : [];
  liberoReplacements.B = snapshot.previousLiberoReplacementsB
    ? JSON.parse(JSON.stringify(snapshot.previousLiberoReplacementsB))
    : [];

  if (snapshot.sanctionSnapshot) {
    sanctionSystem = JSON.parse(JSON.stringify(snapshot.sanctionSnapshot));
  }

  if (snapshot.previousSummaryLength !== undefined) {
    matchSummary = matchSummary.slice(0, snapshot.previousSummaryLength);
  }

  if (set.winner) {
    const winner = set.winner;
    delete set.winner;
    delete set.endTime;
    if (setsWon[winner] > 0) setsWon[winner] -= 1;
  }
  status = 'LIVE';
  awaitingNextSet = false;
  setBreakStartedAt = null;

  actionHistory = actionHistory.slice(0, lastPointIdx);
  sets[currentSet - 1] = set;

  const pointResult = applyPointToTeamInMemory({
    gameData: { ...gameData, setsWon, status, awaitingNextSet, setBreakStartedAt, sanctionSystem },
    sets,
    teams,
    team,
    currentSet,
    actionHistory,
    matchSummary
  });

  entry.action = 'REVERTED';
  entry.preRallyScoreA = snapshot.previousScore.A;
  entry.preRallyScoreB = snapshot.previousScore.B;
  entry.preRallyServing = snapshot.previousServing;

  challengeSystem.log = [entry, ...(challengeSystem.log || [])];
  challengeSystem.awaitingDecision = false;
  challengeSystem.pendingTeam = null;
  challengeSystem.pendingType = null;
  challengeSystem.pendingScore = null;
  challengeSystem.lastRallyRolledBack = true;

  const challengeSummary = {
    type: 'CHALLENGE',
    team,
    setNumber: currentSet,
    description: `🚩 ${teamName} Challenge SUCCESSFUL (${type}) — rally reversed | Point & service awarded to ${teamName}`,
    score: pointResult.matchSummary?.[pointResult.matchSummary.length - 1]?.score,
    timestamp: new Date()
  };
  pointResult.matchSummary.push(challengeSummary);

  const updatePayload = {
    sets: pointResult.sets,
    teams: pointResult.teams,
    setsWon: pointResult.setsWon,
    actionHistory: pointResult.actionHistory,
    matchSummary: pointResult.matchSummary,
    liberoReplacements,
    challengeSystem,
    status: pointResult.status,
    awaitingNextSet: pointResult.awaitingNextSet,
    updatedAt: serverTimestamp()
  };
  if (sanctionSystem) updatePayload.sanctionSystem = sanctionSystem;
  if (pointResult.awaitingNextSet) {
    updatePayload.setBreakStartedAt = serverTimestamp();
  } else {
    updatePayload.setBreakStartedAt = null;
  }

  await updateDoc(gameRef, updatePayload);
  return { ok: true, result: 'SUCCESSFUL', setCompleted: pointResult.completed };
}

/**
 * Clears a stuck pending challenge (e.g. after rollback error) so a new one can be requested.
 */
export async function cancelPendingChallenge(gameCode) {
  const gameRef = doc(db, GAMES_COLLECTION, gameCode);
  const gameSnap = await getDoc(gameRef);
  if (!gameSnap.exists()) throw new Error('Game not found');

  const gameData = gameSnap.data();
  const cs = gameData.challengeSystem || defaultChallengeSystem();
  if (!cs.awaitingDecision) return { ok: true };

  await updateDoc(gameRef, {
    challengeSystem: {
      ...cs,
      awaitingDecision: false,
      pendingTeam: null,
      pendingType: null,
      pendingScore: null
    },
    updatedAt: serverTimestamp()
  });
  return { ok: true };
}

/**
 * Save approved coach lineup details to Firestore (parsed data only, not the file)
 */
export async function saveCoachLineupApproval(gameCode, forTeam, details) {
  const gameRef = doc(db, GAMES_COLLECTION, gameCode);
  const gameSnap = await getDoc(gameRef);
  if (!gameSnap.exists()) throw new Error('Game not found');

  const gameData = gameSnap.data();
  const setKey = String(details.setNumber || gameData.currentSet || 1);
  const coachLineupsBySet = { ...(gameData.coachLineupsBySet || {}) };
  coachLineupsBySet[setKey] = {
    ...(coachLineupsBySet[setKey] || {}),
    [forTeam]: details
  };

  const lockField = forTeam === 'A' ? 'coachLineupLockedA' : 'coachLineupLockedB';
  await updateDoc(gameRef, {
    coachLineupsBySet,
    [lockField]: true,
    updatedAt: serverTimestamp()
  });
  return { ok: true };
}

/**
 * Libero ↔ Libero exchange (FIVB: second libero replaces on-court libero, same originalPlayer).
 */
export async function performLiberoSwap(gameCode, team) {
  const gameRef = doc(db, GAMES_COLLECTION, gameCode);
  const gameSnap = await getDoc(gameRef);
  if (!gameSnap.exists()) throw new Error('Game not found');

  const gameData = gameSnap.data();
  const currentSet = gameData.currentSet || 1;
  const sets = [...(gameData.sets || [])];
  const teams = gameData.teams ? { ...gameData.teams } : { A: { players: [], lineup: [] }, B: { players: [], lineup: [] } };
  const t = teams[team];
  if (!t?.players || !t?.lineup) {
    return { ok: false, message: 'Exchange not possible.' };
  }

  const teamName = gameData[`team${team}Name`] || `Team ${team}`;
  const liberos = t.players.filter((p) => p.role === 'libero1' || p.role === 'libero2');
  const lineup = [...t.lineup];
  while (lineup.length < 6) lineup.push(null);

  const onCourtLib = liberos.find((p) => lineup.some((j) => String(j) === String(p.jersey)));
  const benchLib = onCourtLib ? liberos.find((p) => String(p.jersey) !== String(onCourtLib.jersey)) : null;
  if (!onCourtLib || !benchLib) {
    return { ok: false, message: 'Exchange not possible.' };
  }

  const liberoReplacements = gameData.liberoReplacements
    ? JSON.parse(JSON.stringify(gameData.liberoReplacements))
    : { A: [], B: [] };
  if (!liberoReplacements[team]) liberoReplacements[team] = [];

  const rec = liberoReplacements[team].find((r) => String(r.libero) === String(onCourtLib.jersey));
  if (!rec) {
    return { ok: false, message: 'Error: active Libero replacement record not found.' };
  }

  const posIndex = lineup.findIndex((j) => String(j) === String(onCourtLib.jersey));
  if (posIndex === -1) {
    return { ok: false, message: 'Error: Libero not found in lineup.' };
  }

  const previousLineup = [...lineup];
  const previousLiberoReplacements = JSON.parse(JSON.stringify(liberoReplacements[team]));

  lineup[posIndex] = String(benchLib.jersey);
  teams[team].lineup = lineup;
  rec.libero = String(benchLib.jersey);

  const set = sets[currentSet - 1];
  const opp = team === 'A' ? 'B' : 'A';
  const scoreText = set?.score
    ? `${set.score[team] ?? 0}:${set.score[opp] ?? 0}`
    : '0:0';

  const inBadge = benchLib.role === 'libero1' ? 'L1' : 'L2';
  const outBadge = onCourtLib.role === 'libero1' ? 'L1' : 'L2';
  const description =
    `${teamName} Libero #${benchLib.jersey} ${benchLib.name || ''} (${inBadge})` +
    ` replaces Libero #${onCourtLib.jersey} ${onCourtLib.name || ''} (${outBadge})` +
    ` in P${rec.position} at ${scoreText}`;

  const actionHistory = gameData.actionHistory || [];
  actionHistory.push({
    type: 'libero_swap',
    team,
    previousLineup,
    previousLiberoReplacements,
    setNumber: currentSet
  });
  if (actionHistory.length > 50) actionHistory.shift();

  const matchSummary = [...(gameData.matchSummary || [])];
  matchSummary.push({
    type: 'Libero',
    liberoAction: 'libero_swap',
    team,
    setNumber: currentSet,
    liberoJersey: String(benchLib.jersey),
    playerOutJersey: String(onCourtLib.jersey),
    position: rec.position,
    description,
    score: set?.score ? { A: set.score.A ?? 0, B: set.score.B ?? 0 } : { A: 0, B: 0 },
    timestamp: new Date()
  });

  await updateDoc(gameRef, {
    teams,
    liberoReplacements,
    actionHistory,
    matchSummary,
    updatedAt: serverTimestamp()
  });

  return {
    ok: true,
    message: `🔁 Libero exchange complete!\nOUT: LIBERO #${onCourtLib.jersey} ${onCourtLib.name || ''}\nIN: LIBERO #${benchLib.jersey} ${benchLib.name || ''}\nScore: ${scoreText}`
  };
}

/**
 * Save Fair Play ratings (1–5 stars per team).
 */
export async function saveFairPlay(gameCode, fairPlay) {
  const gameRef = doc(db, GAMES_COLLECTION, gameCode);
  const gameSnap = await getDoc(gameRef);
  if (!gameSnap.exists()) throw new Error('Game not found');

  const gameData = gameSnap.data();
  const teamAName = gameData.teamAName || 'Team A';
  const teamBName = gameData.teamBName || 'Team B';
  const payload = {
    teamA: fairPlay.teamA || 0,
    teamB: fairPlay.teamB || 0,
    remarks: fairPlay.remarks || ''
  };

  const matchSummary = [...(gameData.matchSummary || [])];
  matchSummary.push({
    type: 'FAIR PLAY',
    team: null,
    description: `${teamAName}: ${payload.teamA}/5 · ${teamBName}: ${payload.teamB}/5${payload.remarks ? ` · ${payload.remarks}` : ''}`,
    timestamp: new Date()
  });

  await updateDoc(gameRef, {
    fairPlay: payload,
    matchSummary,
    updatedAt: serverTimestamp()
  });

  return { ok: true };
}

/**
 * Declare match forfeit — ends match, records winner.
 */
export async function declareForfeit(gameCode, { team, reason, remarks }) {
  const gameRef = doc(db, GAMES_COLLECTION, gameCode);
  const gameSnap = await getDoc(gameRef);
  if (!gameSnap.exists()) throw new Error('Game not found');

  const gameData = gameSnap.data();
  const winner = team === 'A' ? 'B' : 'A';
  const teamName = gameData[`team${team}Name`] || `Team ${team}`;
  const winnerName = gameData[`team${winner}Name`] || `Team ${winner}`;
  const timestamp = new Date().toLocaleString();

  const forfeit = {
    declared: true,
    team,
    winner,
    reason,
    remarks: remarks || '',
    timestamp
  };

  const matchSummary = [...(gameData.matchSummary || [])];
  matchSummary.push({
    type: 'FORFEIT',
    team,
    description: `${teamName} forfeits the match · Reason: ${reason}${remarks ? ` · ${remarks}` : ''} · Winner: ${winnerName}`,
    timestamp: new Date()
  });

  const setsWon = { ...(gameData.setsWon || { A: 0, B: 0 }) };
  if (setsWon[winner] < 1) setsWon[winner] = Math.max(setsWon[winner], 1);

  await updateDoc(gameRef, {
    forfeit,
    matchSummary,
    setsWon,
    status: 'FINISHED',
    matchEndReason: 'forfeit',
    finishedAt: serverTimestamp(),
    rallyActive: false,
    updatedAt: serverTimestamp()
  });

  return { ok: true, winner, winnerName, teamName };
}

/**
 * Update team logos — stored in gameAssets/{code}, not in the main game doc.
 */
export async function updateTeamLogos(gameCode, { logoA, logoB }) {
  await saveGameAssets(gameCode, {
    ...(logoA !== undefined ? { logoA } : {}),
    ...(logoB !== undefined ? { logoB } : {})
  });

  // Remove legacy inline logos from main doc if they exist (older games)
  const gameRef = doc(db, GAMES_COLLECTION, gameCode);
  const gameSnap = await getDoc(gameRef);
  if (!gameSnap.exists()) throw new Error('Game not found');

  const gameData = gameSnap.data();
  const teams = gameData.teams ? JSON.parse(JSON.stringify(gameData.teams)) : null;
  let dirty = false;
  if (teams) {
    ['A', 'B'].forEach((key) => {
      if (teams[key]?.logoData) {
        delete teams[key].logoData;
        dirty = true;
      }
    });
  }
  const matchInfo = gameData.matchInfo ? { ...gameData.matchInfo } : null;
  if (matchInfo && (matchInfo.logoA || matchInfo.logoB)) {
    delete matchInfo.logoA;
    delete matchInfo.logoB;
    dirty = true;
  }
  if (dirty) {
    await updateDoc(gameRef, {
      ...(teams ? { teams } : {}),
      ...(matchInfo ? { matchInfo } : {}),
      updatedAt: serverTimestamp()
    });
  }

  return { ok: true };
}
