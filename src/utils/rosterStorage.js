/**
 * Roster Storage Utilities
 * Handles saving and loading rosters to/from localStorage and JSON files
 */
import { doc, getDoc, setDoc, serverTimestamp, collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';

const ROSTER_STORAGE_KEY = 'dc_volley_rosters';

export function createTeamRosterId(teamName) {
  return String(teamName || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown-team';
}

/**
 * Save roster to localStorage
 * @param {Object} rosterData - Roster data to save
 * @returns {string} Saved roster ID
 */
export function saveRosterToLocalStorage(rosterData) {
  try {
    const savedRosters = getSavedRosters();
    const rosterId = rosterData.id || `roster_${Date.now()}`;
    
    const rosterToSave = {
      ...rosterData,
      id: rosterId,
      savedAt: new Date().toISOString(),
      version: '1.0',
      type: 'roster'
    };
    
    savedRosters[rosterId] = rosterToSave;
    localStorage.setItem(ROSTER_STORAGE_KEY, JSON.stringify(savedRosters));
    
    return rosterId;
  } catch (error) {
    console.error('Error saving roster to localStorage:', error);
    throw new Error('Failed to save roster to localStorage');
  }
}

/**
 * Get all saved rosters from localStorage
 * @returns {Object} Object of saved rosters keyed by ID
 */
export function getSavedRosters() {
  try {
    const stored = localStorage.getItem(ROSTER_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error('Error reading rosters from localStorage:', error);
    return {};
  }
}

/**
 * Load a roster from localStorage by ID
 * @param {string} rosterId - Roster ID
 * @returns {Object|null} Roster data or null if not found
 */
export function loadRosterFromLocalStorage(rosterId) {
  try {
    const savedRosters = getSavedRosters();
    return savedRosters[rosterId] || null;
  } catch (error) {
    console.error('Error loading roster from localStorage:', error);
    return null;
  }
}

/**
 * Delete a roster from localStorage
 * @param {string} rosterId - Roster ID to delete
 */
export function deleteRosterFromLocalStorage(rosterId) {
  try {
    const savedRosters = getSavedRosters();
    delete savedRosters[rosterId];
    localStorage.setItem(ROSTER_STORAGE_KEY, JSON.stringify(savedRosters));
  } catch (error) {
    console.error('Error deleting roster from localStorage:', error);
    throw new Error('Failed to delete roster');
  }
}

/**
 * Export roster as JSON file
 * @param {Object} rosterData - Roster data to export
 * @param {string} filename - Optional filename
 */
export function exportRosterAsJSON(rosterData, filename = null) {
  try {
    const exportData = {
      ...rosterData,
      version: '1.0',
      type: 'roster',
      exportedAt: new Date().toISOString()
    };
    
    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const team1 = rosterData.matchInfo?.team1Name || rosterData.teams?.team1?.name || 'Team1';
    const team2 = rosterData.matchInfo?.team2Name || rosterData.teams?.team2?.name || 'Team2';
    const date = new Date().toISOString().split('T')[0];
    const defaultFilename = `Roster_${team1}_vs_${team2}_${date}.json`;
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || defaultFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    return defaultFilename;
  } catch (error) {
    console.error('Error exporting roster:', error);
    throw new Error('Failed to export roster');
  }
}

/**
 * Import roster from JSON file
 * @param {File} file - File to import
 * @returns {Promise<Object>} Parsed roster data
 */
export function importRosterFromJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const loadedData = JSON.parse(e.target.result);
        
        // Validate roster file
        if (loadedData.type !== 'roster' || !loadedData.teams) {
          reject(new Error('Invalid roster file. This does not appear to be a valid roster save file.'));
          return;
        }
        
        resolve(loadedData);
      } catch (error) {
        reject(new Error('Failed to parse roster file. Please ensure it is a valid JSON file.'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsText(file);
  });
}

/**
 * Create roster data structure from game setup
 * @param {Object} matchInfo - Match information
 * @param {Object} teams - Teams data with rosters
 * @param {Object} officials - Officials data
 * @returns {Object} Formatted roster data
 */
export function createRosterData(matchInfo, teams, officials = {}) {
  return {
    version: '1.0',
    type: 'roster',
    savedAt: new Date().toISOString(),
    matchInfo: {
      team1Name: matchInfo.team1Name || teams?.team1?.name || '',
      team2Name: matchInfo.team2Name || teams?.team2?.name || '',
      competition: matchInfo.competition || '',
      venue: matchInfo.venue || '',
      date: matchInfo.date || '',
      time: matchInfo.time || ''
    },
    teams: {
      team1: teams?.team1 || { players: [], lineup: [] },
      team2: teams?.team2 || { players: [], lineup: [] }
    },
    officials: officials || {}
  };
}

export async function saveTeamRostersToFirebase(team1Name, team2Name, rosterData) {
  const team1Id = createTeamRosterId(team1Name);
  const team2Id = createTeamRosterId(team2Name);
  const team1Players = rosterData?.teams?.team1?.players || [];
  const team2Players = rosterData?.teams?.team2?.players || [];

  await Promise.all([
    setDoc(doc(db, 'teamRosters', team1Id), {
      teamId: team1Id,
      teamName: team1Name || '',
      players: team1Players,
      updatedAt: serverTimestamp()
    }, { merge: true }),
    setDoc(doc(db, 'teamRosters', team2Id), {
      teamId: team2Id,
      teamName: team2Name || '',
      players: team2Players,
      updatedAt: serverTimestamp()
    }, { merge: true })
  ]);
}

export async function loadTeamRosterFromFirebase(teamName) {
  const teamId = createTeamRosterId(teamName);
  const snap = await getDoc(doc(db, 'teamRosters', teamId));
  if (!snap.exists()) return null;
  return snap.data();
}

export async function saveSingleTeamRosterToFirebase(teamName, players) {
  const teamId = createTeamRosterId(teamName);
  try {
    await setDoc(
      doc(db, 'teamRosters', teamId),
      {
        teamId,
        teamName: teamName || '',
        players: Array.isArray(players) ? players : [],
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
    return { ok: true, teamId };
  } catch (err) {
    const msg = err?.code ? `${err.code}: ${err.message}` : (err?.message || String(err));
    throw new Error(`Firebase save failed (${teamId}). ${msg}`);
  }
}

export async function loadSingleTeamRosterFromFirebase(teamName) {
  const teamId = createTeamRosterId(teamName);
  try {
    const snap = await getDoc(doc(db, 'teamRosters', teamId));
    if (!snap.exists()) return null;
    return snap.data();
  } catch (err) {
    const msg = err?.code ? `${err.code}: ${err.message}` : (err?.message || String(err));
    throw new Error(`Firebase load failed (${teamId}). ${msg}`);
  }
}

/**
 * Fix #1: List all team roster documents from Firestore (saved teams API).
 * @returns {Promise<Array<{ teamId: string, teamName: string, players: array }>>}
 */
export async function listTeamRostersFromFirebase() {
  try {
    const snap = await getDocs(collection(db, 'teamRosters'));
    const rows = [];
    snap.forEach((d) => {
      const data = d.data() || {};
      rows.push({
        teamId: data.teamId || d.id,
        teamName: data.teamName || data.teamId || d.id || 'Team',
        players: Array.isArray(data.players) ? data.players : []
      });
    });
    return rows.sort((a, b) => String(a.teamName || '').localeCompare(String(b.teamName || ''), undefined, { sensitivity: 'base' }));
  } catch (err) {
    console.error('listTeamRostersFromFirebase:', err);
    return [];
  }
}

/**
 * Fix #1: Expand full match roster saves into selectable single-team rows for the picker modal.
 */
export function buildLocalSavedTeamSlots(savedRostersMap) {
  const rows = [];
  const values = savedRostersMap && typeof savedRostersMap === 'object' ? Object.values(savedRostersMap) : [];
  values.forEach((roster) => {
    if (!roster?.id) return;
    const t1p = roster.teams?.team1?.players;
    if (Array.isArray(t1p) && t1p.some((p) => p?.jersey && p?.name)) {
      rows.push({
        key: `local:${roster.id}:t1`,
        sourceLabel: 'Local save',
        teamName: roster.matchInfo?.team1Name || 'Team 1',
        players: t1p,
        subtitle: `${roster.matchInfo?.competition || 'Saved roster'} · ${roster.savedAt ? new Date(roster.savedAt).toLocaleDateString() : ''}`
      });
    }
    const t2p = roster.teams?.team2?.players;
    if (Array.isArray(t2p) && t2p.some((p) => p?.jersey && p?.name)) {
      rows.push({
        key: `local:${roster.id}:t2`,
        sourceLabel: 'Local save',
        teamName: roster.matchInfo?.team2Name || 'Team 2',
        players: t2p,
        subtitle: `${roster.matchInfo?.competition || 'Saved roster'} · ${roster.savedAt ? new Date(roster.savedAt).toLocaleDateString() : ''}`
      });
    }
  });
  return rows;
}
