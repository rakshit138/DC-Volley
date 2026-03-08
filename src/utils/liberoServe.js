/**
 * LiberoServe - Libero Optional Serving (FIVB Rule 7.3.2 variant)
 * Allows libero to serve for a designated player
 */

/**
 * Check if libero can replace a player at P1 while team is serving
 * @param {string} team - 'A' or 'B'
 * @param {string|number} jersey - Jersey of player being replaced
 * @param {number} position - 1-based position (1=P1, 2=P2, ..., 6=P6)
 * @param {Object} liberoServeConfig - { A: { enabled: bool, designatedJersey: string }, B: {...} }
 * @param {Object} gameData - Full game data including sets and substitutionTracking
 * @returns {boolean} - true if libero can serve for this player
 */
export function allowsP1Replacement(team, jersey, position, liberoServeConfig, gameData) {
  if (!liberoServeConfig || !liberoServeConfig[team]) return false;
  const config = liberoServeConfig[team];
  if (!config.enabled || !config.designatedJersey) return false;
  
  const playerJersey = String(jersey);
  const designated = String(config.designatedJersey);
  
  // Direct match: this IS the designated player
  if (playerJersey === designated) return true;
  
  // Check if this player is a substitute for the designated player
  // by tracing the substitution chain
  const currentSet = gameData.currentSet || 1;
  const set = gameData.sets?.[currentSet - 1];
  if (!set || !set.substitutionTracking || !set.substitutionTracking[team]) {
    return false;
  }
  
  const tracking = set.substitutionTracking[team];
  
  // Walk the substitution chain
  let current = playerJersey;
  const visited = {};
  let maxDepth = 10;
  
  while (maxDepth-- > 0) {
    if (visited[current]) break;
    visited[current] = true;
    
    if (current === designated) return true;
    
    // Check if current player has a pairing
    const record = tracking[current];
    if (!record || !record.pairedWith) break;
    
    current = String(record.pairedWith);
  }
  
  return false;
}

/**
 * Validate that if a libero is in P1 of serving team, they replaced the designated player
 * @param {Object} gameData - Full game data
 * @param {Object} liberoServeConfig - Libero serve configuration
 * @returns {{ valid: boolean, message?: string }}
 */
export function validateServeStart(gameData, liberoServeConfig) {
  const currentSet = gameData.currentSet || 1;
  const set = gameData.sets?.[currentSet - 1];
  if (!set) return { valid: true };
  
  const servingTeam = set.serving;
  if (!liberoServeConfig || !liberoServeConfig[servingTeam]) return { valid: true };
  
  const config = liberoServeConfig[servingTeam];
  if (!config.enabled || !config.designatedJersey) return { valid: true };
  
  const lineup = gameData.teams?.[servingTeam]?.lineup || [];
  if (lineup.length === 0) return { valid: true };
  
  const p1Jersey = String(lineup[0]);
  const players = gameData.teams?.[servingTeam]?.players || [];
  const p1Player = players.find(p => String(p.jersey) === p1Jersey);
  
  // P1 is not a libero → nothing to check
  if (!p1Player || (p1Player.role !== 'libero1' && p1Player.role !== 'libero2' && p1Player.role !== 'liberocaptain')) {
    return { valid: true };
  }
  
  // P1 IS a libero. Find who they replaced
  const replacements = gameData.liberoReplacements?.[servingTeam] || [];
  const p1Record = replacements.find(r => r.position === 1 || String(r.libero) === p1Jersey);
  
  if (!p1Record) {
    const teamName = gameData[`team${servingTeam}Name`] || `Team ${servingTeam}`;
    const libName = `#${p1Player.jersey} ${p1Player.name || ''}`;
    return {
      valid: false,
      message: `🚫 ILLEGAL SERVE - Libero Serving Violation\n\nTeam: ${teamName}\nLibero ${libName} is in P1 (server position).\n\nLibero may only serve when the designated player is in P1 as the replaced player.\n\nPlease restore the original P1 player before starting the rally.`
    };
  }
  
  const originalJersey = String(p1Record.originalPlayer);
  const designated = String(config.designatedJersey);
  
  // Direct match
  if (originalJersey === designated) return { valid: true };
  
  // Check substitution chain
  const tracking = set.substitutionTracking && set.substitutionTracking[servingTeam];
  if (!tracking) {
    const teamName = gameData[`team${servingTeam}Name`] || `Team ${servingTeam}`;
    const libName = `#${p1Player.jersey} ${p1Player.name || ''}`;
    return {
      valid: false,
      message: `🚫 ILLEGAL SERVE - Libero Serving Violation\n\nTeam: ${teamName}\nLibero ${libName} is in P1 (server position).\n\nLibero may only serve when the designated player is in P1 as the replaced player.\n\nPlease restore the original P1 player before starting the rally.`
    };
  }
  
  // Walk chain to see if originalPlayer connects to designated
  let current = originalJersey;
  const visited = {};
  let maxDepth = 10;
  
  while (maxDepth-- > 0) {
    if (visited[current]) break;
    visited[current] = true;
    if (current === designated) return { valid: true };
    
    const record = tracking[current];
    if (!record || !record.pairedWith) break;
    current = String(record.pairedWith);
  }
  
  // Violation
  const teamName = gameData[`team${servingTeam}Name`] || `Team ${servingTeam}`;
  const libName = `#${p1Player.jersey} ${p1Player.name || ''}`;
  return {
    valid: false,
    message: `🚫 ILLEGAL SERVE - Libero Serving Violation\n\nTeam: ${teamName}\nLibero ${libName} is in P1 (server position).\n\nLibero may only serve when the designated player is in P1 as the replaced player.\n\nPlease restore the original P1 player before starting the rally.`
  };
}
