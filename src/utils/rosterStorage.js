/**
 * Roster Storage Utilities
 * Handles saving and loading rosters to/from localStorage and JSON files
 */

const ROSTER_STORAGE_KEY = 'dc_volley_rosters';

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
