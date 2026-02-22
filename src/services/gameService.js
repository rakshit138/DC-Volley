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
    status: 'LIVE', // LIVE or FINISHED
    currentSet: 1,
    sets: [],
    setsWon: {
      A: 0,
      B: 0
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
      startTime: serverTimestamp()
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
    sets[currentSet - 1].endTime = serverTimestamp();
  }
  
  // Update sets won count
  const setsWon = gameData.setsWon || { A: 0, B: 0 };
  setsWon[winner] = (setsWon[winner] || 0) + 1;
  
  // Determine if match is finished
  const format = gameData.format || 3; // Best of 3 or 5
  const setsToWin = Math.ceil(format / 2);
  const isFinished = setsWon[winner] >= setsToWin;
  
  // Move to next set if not finished
  const nextSet = isFinished ? currentSet : currentSet + 1;
  
  // Initialize next set if not finished
  if (!isFinished && !sets[nextSet - 1]) {
    sets[nextSet - 1] = {
      setNumber: nextSet,
      score: { A: 0, B: 0 },
      serving: winner === 'A' ? 'B' : 'A', // Other team serves first
      timeouts: { A: [], B: [] },
      substitutions: { A: [], B: [] },
      startTime: serverTimestamp()
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
