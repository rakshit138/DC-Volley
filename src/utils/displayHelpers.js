/** 3-letter team abbreviation (scoreboard_display.html parity). */
export function abbrTeamName(name) {
  if (!name) return '???';
  const w = name.replace(/[^A-Za-z\s]/g, '').trim().split(/\s+/).filter(Boolean);
  if (!w.length) return '???';
  if (w.length === 1) return w[0].substring(0, 3).toUpperCase();
  return w.map((x) => x[0]).join('').substring(0, 3).toUpperCase();
}

/** Player name for scoreboard row: "J.SMITH" style. */
export function formatScoreboardPlayerName(name, jersey) {
  const nm = (name || '').toUpperCase().trim();
  if (!nm) return `#${jersey}`;
  const pts = nm.split(/\s+/);
  let d = pts.length > 1 ? `${pts[0][0]}.${pts.slice(1).join(' ')}` : nm;
  if (d.length > 13) d = `${d.substring(0, 13)}…`;
  return d;
}

export function getTeamLogo(gameData, team) {
  if (!gameData) return '';
  return (
    gameData.teams?.[team]?.logoData ||
    gameData.matchInfo?.[`logo${team}`] ||
    ''
  );
}

export function getDisplayTeams(gameData) {
  const swapped = !!gameData?.swapped;
  return {
    leftTeam: swapped ? 'B' : 'A',
    rightTeam: swapped ? 'A' : 'B'
  };
}

export function teamDisplayName(gameData, team) {
  return gameData?.[`team${team}Name`] || gameData?.matchInfo?.[`team${team}Name`] || `Team ${team}`;
}

export function teamDisplayColor(gameData, team) {
  return (
    gameData?.[`team${team}Color`] ||
    gameData?.matchInfo?.[`team${team}Color`] ||
    (team === 'A' ? '#e94560' : '#00d9ff')
  );
}

/** lineup_display.html uses fixed A/B palette for panel titles. */
export function lineupTitleColorClass(team) {
  return team === 'A' ? 'team-a-color' : 'team-b-color';
}
