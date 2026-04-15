/**
 * Save match data to JSON file
 * @param {Object} gameData - Complete game data from Firestore
 * @returns {Promise<void>}
 */
export function saveMatch(gameData) {
  if (!gameData) {
    throw new Error('No match data to save');
  }

  // Create save data object matching original HTML format
  const saveData = {
    version: '1.0',
    savedAt: new Date().toISOString(),
    gameData: {
      matchInfo: {
        date: gameData.matchDate || gameData.date || new Date().toISOString().split('T')[0],
        time: gameData.matchTime || gameData.time || new Date().toTimeString().slice(0, 5),
        city: gameData.city || '',
        countryCode: gameData.countryCode || '',
        division: gameData.division || '',
        category: gameData.category || '',
        pool: gameData.pool || '',
        competition: gameData.competition || '',
        matchNumber: gameData.matchNumber || '',
        venue: gameData.venue || '',
        format: gameData.format || '3',
        subLimit: gameData.subLimit || '6',
        teamAName: gameData.teamAName || 'Team A',
        teamBName: gameData.teamBName || 'Team B',
        teamAColor: gameData.teamAColor || '#ff6b6b',
        teamBColor: gameData.teamBColor || '#4ecdc4',
        ref1: gameData.officials?.ref1 || '',
        ref2: gameData.officials?.ref2 || '',
        scorer: gameData.officials?.scorer || '',
        assistScorer: gameData.officials?.assistScorer || ''
      },
      coinToss: gameData.coinToss || null,
      decidingSetToss: gameData.decidingSetToss || null,
      teams: gameData.teams || { A: { players: [], lineup: [] }, B: { players: [], lineup: [] } },
      sets: gameData.sets || [],
      matchSummary: gameData.matchSummary || [],
      currentSet: gameData.currentSet || 1,
      swapped: gameData.swapped || false,
      startTime: gameData.createdAt ? (gameData.createdAt.toDate ? gameData.createdAt.toDate() : new Date(gameData.createdAt)) : new Date(),
      matchEnded: gameData.status === 'FINISHED',
      liberoReplacements: gameData.liberoReplacements || { A: [], B: [] },
      liberoServeConfig: gameData.liberoServeConfig || { A: { enabled: false }, B: { enabled: false } },
      sanctionSystem: gameData.sanctionSystem || {
        misconduct: { A: [], B: [] },
        delay: { A: { count: 0, log: [] }, B: { count: 0, log: [] } },
        disqualified: { A: [], B: [] },
        coachDisqualified: { A: false, B: false }
      },
      officials: gameData.officials || {},
      injuredPlayers: gameData.injuredPlayers || { A: [], B: [] }
    }
  };

  // Convert to JSON string
  const jsonString = JSON.stringify(saveData, null, 2);

  // Create filename with team names and date
  const teamA = gameData.teamAName || 'TeamA';
  const teamB = gameData.teamBName || 'TeamB';
  const date = gameData.matchDate || gameData.date || new Date().toISOString().split('T')[0];
  const filename = `VolleySync_Match_${teamA}_vs_${teamB}_${date}.json`;

  // Create download link
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return filename;
}

/**
 * Load match data from JSON file
 * @param {File} file - File object from file input
 * @returns {Promise<Object>} Parsed match data
 */
export function loadMatch(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No file selected'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const loadedData = JSON.parse(e.target.result);

        // Validate the loaded data
        if (!loadedData.gameData || !loadedData.gameData.matchInfo) {
          reject(new Error('Invalid file: This does not appear to be a valid match save file.'));
          return;
        }

        // Return the loaded data in a format compatible with Firestore
        const gameData = loadedData.gameData;
        
        // Convert to Firestore-compatible format
        const firestoreData = {
          // Match info fields
          matchDate: gameData.matchInfo.date,
          matchTime: gameData.matchInfo.time,
          date: gameData.matchInfo.date,
          time: gameData.matchInfo.time,
          city: gameData.matchInfo.city,
          countryCode: gameData.matchInfo.countryCode,
          division: gameData.matchInfo.division,
          category: gameData.matchInfo.category,
          pool: gameData.matchInfo.pool,
          competition: gameData.matchInfo.competition,
          matchNumber: gameData.matchInfo.matchNumber,
          venue: gameData.matchInfo.venue,
          format: gameData.matchInfo.format,
          subLimit: gameData.matchInfo.subLimit,
          teamAName: gameData.matchInfo.teamAName,
          teamBName: gameData.matchInfo.teamBName,
          teamAColor: gameData.matchInfo.teamAColor,
          teamBColor: gameData.matchInfo.teamBColor,
          
          // Game state
          coinToss: gameData.coinToss,
          decidingSetToss: gameData.decidingSetToss,
          teams: gameData.teams,
          sets: gameData.sets,
          matchSummary: gameData.matchSummary || [],
          currentSet: gameData.currentSet || 1,
          swapped: gameData.swapped || false,
          status: gameData.matchEnded ? 'FINISHED' : 'LIVE',
          liberoReplacements: gameData.liberoReplacements || { A: [], B: [] },
          liberoServeConfig: gameData.liberoServeConfig || { A: { enabled: false }, B: { enabled: false } },
          sanctionSystem: gameData.sanctionSystem || {
            misconduct: { A: [], B: [] },
            delay: { A: { count: 0, log: [] }, B: { count: 0, log: [] } },
            disqualified: { A: [], B: [] },
            coachDisqualified: { A: false, B: false }
          },
          officials: gameData.officials || {},
          injuredPlayers: gameData.injuredPlayers || { A: [], B: [] },
          
          // Timestamps
          createdAt: gameData.startTime ? new Date(gameData.startTime) : new Date(),
          updatedAt: new Date()
        };

        resolve({
          filename: file.name,
          gameData: firestoreData,
          originalData: loadedData
        });
      } catch (error) {
        reject(new Error(`Error loading file: ${error.message}. Please check that this is a valid match save file.`));
      }
    };

    reader.onerror = () => {
      reject(new Error('Error reading file'));
    };

    reader.readAsText(file);
  });
}
