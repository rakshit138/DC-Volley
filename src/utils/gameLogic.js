/**
 * Game Logic Utilities
 * Contains all volleyball game rules and logic
 */

/**
 * Determines if a set should auto-complete based on score
 * @param {number} scoreA - Team A score
 * @param {number} scoreB - Team B score
 * @param {number} currentSet - Current set number
 * @param {number} format - Best of 3 or 5
 * @returns {boolean} True if set should complete
 */
export function shouldCompleteSet(scoreA, scoreB, currentSet, format) {
  const isDecidingSet = (format === 5 && currentSet === 5) || (format === 3 && currentSet === 3);
  const target = isDecidingSet ? 15 : 25;
  const lead = 2;
  
  return (scoreA >= target && scoreA - scoreB >= lead) || 
         (scoreB >= target && scoreB - scoreA >= lead);
}

/**
 * Gets the target score for a set
 * @param {number} currentSet - Current set number
 * @param {number} format - Best of 3 or 5
 * @returns {number} Target score (25 or 15)
 */
export function getTargetScore(currentSet, format) {
  const isDecidingSet = (format === 5 && currentSet === 5) || (format === 3 && currentSet === 3);
  return isDecidingSet ? 15 : 25;
}

/**
 * Rotates a lineup clockwise (P1→P6, P2→P1, P3→P2, P4→P3, P5→P4, P6→P5)
 * @param {Array} lineup - Current lineup array
 * @returns {Array} Rotated lineup
 */
export function rotateLineupClockwise(lineup) {
  if (!lineup || lineup.length === 0) return lineup;
  const rotated = [...lineup];
  const first = rotated.shift();
  rotated.push(first);
  return rotated;
}

/**
 * Checks if a position is back row (P1, P5, P6)
 * @param {number} position - Position index (0-5 for P1-P6)
 * @returns {boolean} True if back row
 */
export function isBackRowPosition(position) {
  return position === 0 || position === 4 || position === 5; // P1, P5, P6
}

/**
 * Checks if libero can replace a player at a position
 * @param {number} position - Position index (0-5)
 * @param {string} servingTeam - 'A' or 'B'
 * @param {string} team - Team of the libero
 * @param {boolean} liberoServeEnabled - Whether libero serving is enabled
 * @returns {boolean} True if replacement is allowed
 */
export function canLiberoReplace(position, servingTeam, team, liberoServeEnabled = false) {
  // Libero can only replace back row positions
  if (!isBackRowPosition(position)) {
    return false;
  }
  
  // If at P1 (serving position) and team is serving, check libero serve rule
  if (position === 0 && servingTeam === team) {
    return liberoServeEnabled;
  }
  
  return true;
}

/**
 * Validates substitution rules
 * @param {number} currentSubs - Current substitutions count
 * @param {number} subLimit - Substitution limit per set
 * @returns {Object} { valid: boolean, message?: string }
 */
export function validateSubstitution(currentSubs, subLimit) {
  if (currentSubs >= subLimit) {
    return {
      valid: false,
      message: `Maximum ${subLimit} substitutions per set reached`
    };
  }
  return { valid: true };
}

/**
 * Validates timeout rules
 * @param {number} currentTimeouts - Current timeouts count
 * @returns {Object} { valid: boolean, message?: string }
 */
export function validateTimeout(currentTimeouts) {
  if (currentTimeouts >= 2) {
    return {
      valid: false,
      message: 'Maximum 2 timeouts per set reached'
    };
  }
  return { valid: true };
}

/**
 * Gets libero players from team roster
 * @param {Array} players - Team players array
 * @returns {Array} Libero players
 */
export function getLiberos(players) {
  if (!players || !Array.isArray(players)) return [];
  return players.filter(p => 
    p.role === 'libero1' || 
    p.role === 'libero2' || 
    p.role === 'liberocaptain'
  );
}

/**
 * Checks if a player is a libero
 * @param {Object} player - Player object
 * @returns {boolean} True if libero
 */
export function isLibero(player) {
  if (!player) return false;
  return player.role === 'libero1' || 
         player.role === 'libero2' || 
         player.role === 'liberocaptain';
}

/**
 * Formats time duration
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted time (HH:MM:SS or MM:SS)
 */
export function formatDuration(seconds) {
  if (!seconds || seconds < 0) return '00:00';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Calculates match duration
 * @param {Date|string} startTime - Match start time
 * @returns {number} Duration in seconds
 */
export function calculateMatchDuration(startTime) {
  if (!startTime) return 0;
  const start = new Date(startTime);
  const now = new Date();
  return Math.floor((now - start) / 1000);
}

/**
 * Calculates set duration
 * @param {Date|string} startTime - Set start time
 * @returns {number} Duration in seconds
 */
export function calculateSetDuration(startTime) {
  if (!startTime) return 0;
  const start = new Date(startTime);
  const now = new Date();
  return Math.floor((now - start) / 1000);
}

/**
 * Validates rotation order
 * @param {Array} lineup - Current lineup array
 * @param {Array} previousLineup - Previous lineup array (before rotation)
 * @returns {Object} { valid: boolean, message?: string }
 */
export function validateRotation(lineup, previousLineup) {
  if (!lineup || lineup.length !== 6) {
    return {
      valid: false,
      message: 'Lineup must have exactly 6 players'
    };
  }

  if (!previousLineup || previousLineup.length !== 6) {
    return { valid: true }; // Can't validate without previous state
  }

  // Check for duplicates
  const jerseys = lineup.filter(Boolean);
  const uniqueJerseys = new Set(jerseys);
  if (jerseys.length !== uniqueJerseys.size) {
    return {
      valid: false,
      message: 'Duplicate players found in lineup'
    };
  }

  // Validate rotation: should be clockwise (P1→P6, P2→P1, P3→P2, P4→P3, P5→P4, P6→P5)
  const expectedRotation = [...previousLineup];
  const first = expectedRotation.shift();
  expectedRotation.push(first);

  // Allow for libero replacements, so check if it's a valid rotation OR libero replacement
  const isExactRotation = JSON.stringify(lineup) === JSON.stringify(expectedRotation);
  
  if (!isExactRotation) {
    // Check if difference is due to libero replacement (only back row positions can differ)
    const backRowIndices = [0, 4, 5];
    let differences = 0;
    let frontRowDiff = false;
    
    for (let i = 0; i < 6; i++) {
      if (lineup[i] !== expectedRotation[i]) {
        differences++;
        if (!backRowIndices.includes(i)) {
          frontRowDiff = true;
        }
      }
    }
    
    // If front row differs, it's not a valid rotation
    if (frontRowDiff && differences > 1) {
      return {
        valid: false,
        message: 'Invalid rotation: Front row positions cannot change during rotation'
      };
    }
  }

  return { valid: true };
}

/**
 * Validates lineup completeness
 * @param {Array} lineup - Lineup array
 * @param {Array} players - Available players
 * @returns {Object} { valid: boolean, message?: string }
 */
export function validateLineupCompleteness(lineup, players) {
  if (!lineup || lineup.length !== 6) {
    return {
      valid: false,
      message: 'Lineup must have exactly 6 positions'
    };
  }

  // Check all positions are filled
  const emptyPositions = lineup.filter(p => !p || p === null || p === '').length;
  if (emptyPositions > 0) {
    return {
      valid: false,
      message: `${emptyPositions} position(s) are empty`
    };
  }

  // Check all players exist in roster
  const playerJerseys = new Set(players.map(p => String(p.jersey)));
  const invalidPlayers = lineup.filter(j => j && !playerJerseys.has(String(j)));
  
  if (invalidPlayers.length > 0) {
    return {
      valid: false,
      message: `Invalid player(s) in lineup: ${invalidPlayers.join(', ')}`
    };
  }

  // Check for duplicates
  const jerseys = lineup.filter(Boolean).map(String);
  const uniqueJerseys = new Set(jerseys);
  if (jerseys.length !== uniqueJerseys.size) {
    return {
      valid: false,
      message: 'Duplicate players found in lineup'
    };
  }

  return { valid: true };
}

/**
 * Validates libero position during rotation
 * @param {Array} lineup - Current lineup
 * @param {Array} players - Team players
 * @param {number} position - Position index (0-5)
 * @param {string} servingTeam - 'A' or 'B'
 * @param {string} team - Team of the libero
 * @returns {Object} { valid: boolean, message?: string }
 */
export function validateLiberoPosition(lineup, players, position, servingTeam, team) {
  if (position < 0 || position >= 6) {
    return {
      valid: false,
      message: 'Invalid position index'
    };
  }

  const jersey = lineup[position];
  if (!jersey) return { valid: true };

  const player = players.find(p => String(p.jersey) === String(jersey));
  if (!player) return { valid: true };

  const isLiberoPlayer = isLibero(player);

  // Libero can only be in back row (P1, P5, P6)
  if (isLiberoPlayer && !isBackRowPosition(position)) {
    return {
      valid: false,
      message: `Libero cannot be in front row position P${position + 1}`
    };
  }

  // Libero cannot serve (P1 when team is serving)
  if (isLiberoPlayer && position === 0 && servingTeam === team) {
    return {
      valid: false,
      message: 'Libero cannot serve (FIVB rule)'
    };
  }

  return { valid: true };
}

/**
 * Validates that only one libero is on court
 * @param {Array} lineup - Current lineup
 * @param {Array} players - Team players
 * @returns {Object} { valid: boolean, message?: string, liberoCount?: number }
 */
export function validateSingleLiberoOnCourt(lineup, players) {
  const liberoJerseys = new Set();
  lineup.forEach(jersey => {
    if (jersey) {
      const player = players.find(p => String(p.jersey) === String(jersey));
      if (player && isLibero(player)) {
        liberoJerseys.add(String(jersey));
      }
    }
  });

  if (liberoJerseys.size > 1) {
    return {
      valid: false,
      message: 'Only one libero can be on court at a time',
      liberoCount: liberoJerseys.size
    };
  }

  return { valid: true, liberoCount: liberoJerseys.size };
}
