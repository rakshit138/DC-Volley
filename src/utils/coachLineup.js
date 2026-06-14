/**
 * Coach roster share & lineup file utilities (from DC_Volley coach line up.html)
 */

const POS_NAMES = ['P1-RB', 'P2-RF', 'P3-MF', 'P4-LF', 'P5-LB', 'P6-MB'];

export function buildCoachRosterShareData({
  teamKey,
  teamName,
  teamColor,
  players,
  courtSide,
  matchInfo,
  pin
}) {
  const pinHash = btoa(`${pin}:dc_volley_${teamName.replace(/\s/g, '').toLowerCase()}`);
  return {
    type: 'dc_volley_coach_roster',
    version: '3.0',
    generatedAt: new Date().toISOString(),
    generatedBy: 'Scorer',
    teamKey,
    courtSide,
    pinHash,
    matchInfo: {
      competition: matchInfo.competition || '',
      matchNumber: matchInfo.matchNumber || '',
      venue: matchInfo.venue || '',
      date: matchInfo.date || '',
      time: matchInfo.time || '',
      division: matchInfo.division || '',
      category: matchInfo.category || ''
    },
    team: { name: teamName, color: teamColor, players }
  };
}

export function downloadCoachRosterJson(data, teamName, matchDate) {
  const jsonString = JSON.stringify(data, null, 2);
  const filename = `CoachRoster_${teamName.replace(/\s+/g, '_')}_${matchDate || new Date().toISOString().split('T')[0]}.json`;
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

export function shareRosterToCoach({
  teamKey,
  teamName,
  teamColor,
  players,
  courtSide,
  matchInfo
}) {
  const validPlayers = (players || []).filter((p) => p.jersey && p.name);
  if (validPlayers.length < 1) {
    window.alert(`❌ NO ROSTER DATA for ${teamName}!\n\nPlease fill in the player roster first.`);
    return null;
  }

  let pin = '';
  while (true) {
    pin = window.prompt(
      `🔒 SET 4-DIGIT PIN for ${teamName} Coach\n\nThis PIN protects the lineup file.\nThe Coach must enter it to access the roster.\n\nEnter a 4-digit PIN (numbers only):`
    );
    if (pin === null) return null;
    pin = pin.trim();
    if (/^\d{4}$/.test(pin)) break;
    window.alert('⚠️ PIN must be exactly 4 digits (e.g. 1234). Try again.');
  }

  const data = buildCoachRosterShareData({
    teamKey,
    teamName,
    teamColor,
    players: validPlayers,
    courtSide,
    matchInfo,
    pin
  });

  const filename = downloadCoachRosterJson(data, teamName, matchInfo.date);

  window.alert(
    `✅ ROSTER SHARED — ${teamName}!\n\nFile: ${filename}\n🔒 Coach PIN: ${pin}\n\n📋 TELL THE COACH:\n1. Open coach_lineup.html\n2. Load this JSON file\n3. Enter the 4-digit PIN: ${pin}\n4. Assign lineup & export CoachLineup_*.json\n5. Send that file back to the Scorer\n\n⚠️ Keep the PIN secret from the opposing team!`
  );

  return { pin, filename };
}

export function parseCoachLineupFile(json) {
  const data = typeof json === 'string' ? JSON.parse(json) : json;

  if (data.type !== 'dc_volley_coach_lineup') {
    throw new Error('This is not a valid Coach Lineup file.\nPlease load a file exported from coach_lineup.html');
  }
  if (!data.lineup || data.lineup.length !== 6) {
    throw new Error('Lineup file is missing or incomplete (need 6 positions).');
  }
  if (data.lineup.some((j) => j === null)) {
    throw new Error('The coach has not filled all 6 positions yet.\nAsk them to complete and re-export.');
  }

  return data;
}

export function buildCoachLineupApprovalPreview(forTeam, teamName, data, rosterPlayers) {
  let bodyText = `Team: ${teamName}\nSubmitted: ${data.submittedAt ? new Date(data.submittedAt).toLocaleString() : 'Unknown'}\n\n`;
  bodyText += '━━━━━━━━━━━━━━━━━━━━\n';
  for (let i = 0; i < 6; i++) {
    const jersey = data.lineup[i];
    const player = (rosterPlayers || []).find((p) => String(p.jersey) === String(jersey));
    const pname = player ? player.name : '(unknown — check roster)';
    const prole = player
      ? player.role === 'captain'
        ? ' (C)'
        : player.role === 'libero1' || player.role === 'libero2'
          ? ' (L)'
          : ''
      : '';
    bodyText += `  ${POS_NAMES[i]}:  #${jersey}  ${pname}${prole}\n`;
  }
  bodyText += '━━━━━━━━━━━━━━━━━━━━';
  return bodyText;
}

/** Extract storable details from coach lineup file (no raw file stored) */
export function extractCoachLineupDetails(data, forTeam, setNumber) {
  return {
    courtSide: data.courtSide || forTeam,
    teamName: data.teamName || '',
    lineup: data.lineup.map(String),
    submittedAt: data.submittedAt || null,
    exportedAt: data.exportedAt || null,
    coachName: data.coachName || '',
    setNumber: setNumber || 1,
    approvedAt: new Date().toISOString()
  };
}
