/**
 * Generate FIVB Match Report as HTML — same structure and style as match_report_generator.html.
 * @param {Object} gameData - Firestore game document (will be normalized to match report shape)
 * @returns {string} Full HTML document string
 */
export function generateMatchReportHtml(gameData) {
  if (!gameData) return '<!DOCTYPE html><html><body><p>No match data.</p></body></html>';
  const g = normalizeGameDataForReport(gameData);
  if (!g) return '<!DOCTYPE html><html><body><p>Invalid match data.</p></body></html>';
  return buildReportHTML(g);
}

/**
 * Normalize Firestore game doc to the shape expected by the report (matchInfo, teams, sets, officials, etc.)
 * Uses the actual document fields from Firestore (live data).
 */
function normalizeGameDataForReport(doc) {
  if (!doc || typeof doc !== 'object') return null;
  const teams = doc.teams || { A: { players: [], lineup: [] }, B: { players: [], lineup: [] } };
  const sets = (doc.sets || []).map((s) => ({
    ...s,
    score: s.score || { A: 0, B: 0 },
    startingLineup: s.startingLineup || { A: [], B: [] },
    substitutions: s.substitutions || { A: [], B: [] },
    exceptionalSubstitutions: s.exceptionalSubstitutions || { A: [], B: [] },
    timeouts: s.timeouts || { A: [], B: [] }
  }));

  const officials = doc.officials || {};
  const matchInfo = {
    competition: doc.competition || 'N/A',
    matchNumber: doc.matchNumber || 'N/A',
    venue: doc.venue || 'N/A',
    city: doc.city || 'N/A',
    countryCode: doc.countryCode || 'N/A',
    date: doc.matchDate || doc.date || 'N/A',
    time: doc.matchTime || doc.time || 'N/A',
    division: doc.division || 'N/A',
    category: doc.category || 'N/A',
    pool: doc.pool || 'N/A',
    format: doc.format != null ? doc.format : 'N/A',
    subLimit: doc.subLimit != null ? doc.subLimit : 6,
    teamAName: doc.teamAName || 'Team A',
    teamBName: doc.teamBName || 'Team B',
    ref1: officials.ref1 || '',
    ref2: officials.ref2 || '',
    scorer: officials.scorer || '',
    assistScorer: officials.assistScorer || ''
  };

  return {
    gameCode: doc.gameCode || '',
    matchInfo,
    teams: {
      A: { players: teams.A?.players || [], lineup: teams.A?.lineup || [] },
      B: { players: teams.B?.players || [], lineup: teams.B?.lineup || [] }
    },
    sets,
    officials: {
      coachA: officials.coachA || '',
      asstCoachA: officials.asstCoachA || '',
      medicalA: officials.medicalA || '',
      trainerA: officials.trainerA || '',
      coachB: officials.coachB || '',
      asstCoachB: officials.asstCoachB || '',
      medicalB: officials.medicalB || '',
      trainerB: officials.trainerB || '',
      signatures: officials.signatures || {}
    },
    sanctionSystem: doc.sanctionSystem || null,
    sanctions: doc.sanctions || null,
    matchSummary: doc.matchSummary || [],
    injuredPlayers: doc.injuredPlayers || { A: [], B: [] }
  };
}

function buildReportHTML(gameData) {
  const setsWonA = gameData.sets.filter((s) => s.winner === 'A').length;
  const setsWonB = gameData.sets.filter((s) => s.winner === 'B').length;
  const winner =
    setsWonA > setsWonB ? gameData.matchInfo.teamAName : gameData.matchInfo.teamBName;

  const subLimit =
    gameData.matchInfo.subLimit ||
    gameData.matchInfo.subLimitPerSet ||
    6;

  let sanctionsCountA = 0;
  let sanctionsCountB = 0;
  if (gameData.sanctionSystem) {
    sanctionsCountA =
      (gameData.sanctionSystem.misconduct?.A || []).length +
      (gameData.sanctionSystem.delay?.A?.log || []).length;
    sanctionsCountB =
      (gameData.sanctionSystem.misconduct?.B || []).length +
      (gameData.sanctionSystem.delay?.B?.log || []).length;
  } else {
    sanctionsCountA = gameData.sanctions?.A?.length || 0;
    sanctionsCountB = gameData.sanctions?.B?.length || 0;
  }

  const officialSigs = gameData.officials?.signatures || {};
  function sigImg(key) {
    return officialSigs[key]
      ? '<img src="' + officialSigs[key] + '" alt="Signature" style="max-width:100%;height:auto;max-height:50px;background:#fff;border:1px solid #333;display:block;">'
      : '';
  }

  function getPlayerName(team, jersey) {
    const players = gameData.teams[team]?.players || [];
    const p = players.find((x) => String(x.jersey) === String(jersey));
    return p ? '#' + jersey + ' ' + p.name : '#' + (jersey || 'N/A');
  }

  function scoreDisplay(scoreObj, team) {
    if (!scoreObj || typeof scoreObj !== 'object') return 'N/A';
    const opp = team === 'A' ? 'B' : 'A';
    return (
      (scoreObj[team] !== undefined ? scoreObj[team] : '?') +
      '-' +
      (scoreObj[opp] !== undefined ? scoreObj[opp] : '?')
    );
  }

  let captainA = '';
  let captainB = '';
  if (gameData.teams.A?.players) {
    const capA = gameData.teams.A.players.find((p) => p.role === 'captain' || p.role === 'liberocaptain');
    if (capA) captainA = '#' + capA.jersey + ' ' + capA.name;
  }
  if (gameData.teams.B?.players) {
    const capB = gameData.teams.B.players.find((p) => p.role === 'captain' || p.role === 'liberocaptain');
    if (capB) captainB = '#' + capB.jersey + ' ' + capB.name;
  }

  const coachA = gameData.officials.coachA || '';
  const asstCoachA = gameData.officials.asstCoachA || '';
  const medicalA = gameData.officials.medicalA || '';
  const trainerA = gameData.officials.trainerA || '';
  const coachB = gameData.officials.coachB || '';
  const asstCoachB = gameData.officials.asstCoachB || '';
  const medicalB = gameData.officials.medicalB || '';
  const trainerB = gameData.officials.trainerB || '';

  const typeNames = {
    W: '🟨 Yellow Card (Warning)',
    P: '🟥 Red Card (Penalty)',
    EXP: '🟨🟥 Expulsion',
    DISQ: '🟥❌ Disqualification',
    DW: '⏱ Delay Warning',
    DP: '⏱🟥 Delay Penalty',
    delay: '⏱ Delay Warning',
    delay_penalty: '⏱🟥 Delay Penalty',
    misconduct_warning: '🟨 Yellow Card',
    misconduct_penalty: '🟥 Red Card',
    misconduct_expulsion: '🟨🟥 Expulsion',
    misconduct_disqualification: '🟥❌ Disqualification'
  };

  function fmtScore(scoreObj, team) {
    if (!scoreObj || scoreObj.A === undefined) return '—';
    if (team) {
      const myScore = team === 'A' ? scoreObj.A : scoreObj.B;
      const oppScore = team === 'A' ? scoreObj.B : scoreObj.A;
      return myScore + ' – ' + oppScore;
    }
    return scoreObj.A + ' – ' + scoreObj.B;
  }

  function getAllSanctions() {
    const list = [];
    if (gameData.sanctionSystem) {
      ['A', 'B'].forEach((team) => {
        (gameData.sanctionSystem?.misconduct?.[team] || []).forEach((r) => {
          list.push({
            team,
            set: r.set,
            time: r.time,
            type: r.type,
            person: r.personType === 'coach' ? 'Coach/Staff' : '#' + r.person,
            reason: r.reason || '',
            notes: r.notes || '',
            score: r.score
          });
        });
        const delayLog = gameData.sanctionSystem.delay?.[team]?.log || [];
        delayLog.forEach((r) => {
          list.push({
            team,
            set: r.set,
            time: r.time,
            type: r.type,
            person: 'Team',
            reason: '',
            notes: '',
            score: r.score
          });
        });
      });
      list.sort((a, b) => ((a.time || '') > (b.time || '') ? 1 : -1));
    } else if (gameData.sanctions) {
      ['A', 'B'].forEach((team) => {
        (gameData.sanctions[team] || []).forEach((s) => {
          list.push({
            team,
            set: s.set,
            time: s.time || '',
            type: s.type,
            person: s.player || 'Team',
            reason: '',
            notes: s.notes || '',
            score: s.score
          });
        });
      });
    }
    return list;
  }

  // Same CSS as match_report_generator.html
  let html = '<!DOCTYPE html>\n<html>\n<head>\n<meta charset="UTF-8">\n<title>FIVB Match Report</title>\n<style>\n';
  html += 'body{font-family:Arial,sans-serif;margin:40px;background:#f5f5f5;}';
  html += '.container{max-width:1100px;margin:0 auto;background:white;padding:40px;box-shadow:0 0 20px rgba(0,0,0,0.1);}';
  html += 'h1{text-align:center;color:#1e3c72;border-bottom:3px solid #1e3c72;padding-bottom:15px;margin-bottom:20px;}';
  html += 'h2{color:#2a5298;border-bottom:2px solid #ddd;padding-bottom:8px;margin-top:30px;margin-bottom:10px;}';
  html += 'h3{color:#444;margin-top:18px;margin-bottom:5px;}';
  html += 'table{width:100%;border-collapse:collapse;margin:8px 0 18px 0;}';
  html += 'th,td{border:1px solid #ddd;padding:10px 12px;text-align:left;}';
  html += 'th{background:#1e3c72;color:white;font-weight:bold;}';
  html += '.team-a{background:#ffe6e6;}.team-b{background:#e6f3ff;}.center{text-align:center;}';
  html += '.info-grid{display:grid;grid-template-columns:220px 1fr;gap:8px;margin:12px 0;}';
  html += '.info-label{font-weight:bold;color:#555;}';
  html += '.sig-cell{height:60px;border-bottom:2px solid #333!important;background:#fafafa;vertical-align:bottom;padding:5px 10px!important;}';
  html += '.no-data{text-align:center;padding:12px;color:#888;font-style:italic;border:1px solid #eee;border-radius:4px;margin:5px 0;}';
  html += '.totals-row{background:#e8f4f8;font-weight:bold;border-top:2px solid #1e3c72;}';
  html += '.injured-row{background:#fff3cd;color:#856404;font-style:italic;}';
  html += '@media print{body{margin:0;background:white;}.container{box-shadow:none;padding:20px;}}';
  html += '\n</style>\n</head>\n<body>\n<div class="container">\n';

  html += '<h1>🏐 FIVB Official Match Report</h1>\n';

  html += '<h2>Match Information</h2>\n<div class="info-grid">\n';
  html += '<div class="info-label">Competition:</div><div>' + (gameData.matchInfo.competition || 'N/A') + '</div>\n';
  html += '<div class="info-label">Match Number:</div><div>' + (gameData.matchInfo.matchNumber || 'N/A') + '</div>\n';
  html += '<div class="info-label">Venue:</div><div>' + (gameData.matchInfo.venue || 'N/A') + '</div>\n';
  html += '<div class="info-label">City:</div><div>' + (gameData.matchInfo.city || 'N/A') + '</div>\n';
  html += '<div class="info-label">Country Code:</div><div>' + (gameData.matchInfo.countryCode || 'N/A') + '</div>\n';
  html += '<div class="info-label">Date:</div><div>' + (gameData.matchInfo.date || 'N/A') + '</div>\n';
  html += '<div class="info-label">Time:</div><div>' + (gameData.matchInfo.time || 'N/A') + '</div>\n';
  html += '<div class="info-label">Division:</div><div>' + (gameData.matchInfo.division || 'N/A') + '</div>\n';
  html += '<div class="info-label">Category:</div><div>' + (gameData.matchInfo.category || 'N/A') + '</div>\n';
  html += '<div class="info-label">Pool / Phase:</div><div>' + (gameData.matchInfo.pool || 'N/A') + '</div>\n';
  html += '<div class="info-label">Format:</div><div>Best of ' + (gameData.matchInfo.format || 'N/A') + '</div>\n';
  html += '<div class="info-label">Substitution Limit:</div><div>' + subLimit + ' per set</div>\n';
  html += '</div>\n';

  html += '<h2>Match Result</h2>\n<table>\n';
  html += '<tr><th class="team-a" style="width:35%">' + gameData.matchInfo.teamAName + '</th><th class="center" style="width:30%">Sets</th><th class="team-b" style="width:35%">' + gameData.matchInfo.teamBName + '</th></tr>\n';
  html += '<tr><td class="team-a center" style="font-size:28px;font-weight:bold;">' + setsWonA + '</td><td class="center" style="font-size:20px;font-weight:bold;">vs</td><td class="team-b center" style="font-size:28px;font-weight:bold;">' + setsWonB + '</td></tr>\n';
  html += '<tr><td colspan="3" class="center" style="background:#fff9c4;font-size:20px;font-weight:bold;">🏆 WINNER: ' + winner + '</td></tr>\n';
  html += '<tr><td class="team-a center"><strong>Sanctions: ' + sanctionsCountA + '</strong></td><td class="center"><strong>Total Sanctions</strong></td><td class="team-b center"><strong>Sanctions: ' + sanctionsCountB + '</strong></td></tr>\n';
  html += '</table>\n';

  html += '<h2>Set-by-Set Scores</h2>\n<table>\n';
  html += '<tr><th>Set</th><th class="team-a">' + gameData.matchInfo.teamAName + '</th><th class="center">Score</th><th class="team-b">' + gameData.matchInfo.teamBName + '</th><th>Duration</th><th>Winner</th></tr>\n';

  function formatDuration(startTime, endTime) {
    if (!startTime || !endTime) return 'N/A';
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    const ms = end - start;
    if (isNaN(ms) || ms < 0) return 'N/A';
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    if (m === 0) return '0:' + (s < 10 ? '0' : '') + s + ' min';
    return m + ':' + (s < 10 ? '0' : '') + s + ' min';
  }
  function totalDurationSeconds(setsData) {
    let totalSec = 0;
    setsData.forEach((set) => {
      if (!set.endTime || !set.startTime) return;
      const ms = new Date(set.endTime).getTime() - new Date(set.startTime).getTime();
      if (!isNaN(ms) && ms >= 0) totalSec += Math.floor(ms / 1000);
    });
    return totalSec;
  }

  let totalPointsA = 0;
  let totalPointsB = 0;
  gameData.sets.forEach((set, idx) => {
    if (!set.winner && set.score.A === 0 && set.score.B === 0) return;
    totalPointsA += set.score.A || 0;
    totalPointsB += set.score.B || 0;
    const durStr = formatDuration(set.startTime, set.endTime);
    const setWinner = set.winner ? (set.winner === 'A' ? gameData.matchInfo.teamAName : gameData.matchInfo.teamBName) : '-';
    html += '<tr><td class="center"><strong>Set ' + (idx + 1) + '</strong></td>';
    html += '<td class="team-a center">' + set.score.A + '</td>';
    html += '<td class="center">' + set.score.A + ' - ' + set.score.B + '</td>';
    html += '<td class="team-b center">' + set.score.B + '</td>';
    html += '<td class="center">' + durStr + '</td>';
    html += '<td class="center">' + setWinner + '</td></tr>\n';
  });
  const totalSec = totalDurationSeconds(gameData.sets);
  const totalDurStr = totalSec > 0
    ? (totalSec < 60 ? '0:' + String(totalSec).padStart(2, '0') + ' min' : Math.floor(totalSec / 60) + ':' + String(totalSec % 60).padStart(2, '0') + ' min')
    : '0 min';
  html += '<tr class="totals-row"><td class="center">TOTALS</td><td class="team-a center">' + totalPointsA + '</td><td class="center">' + totalDurStr + '</td><td class="team-b center">' + totalPointsB + '</td><td></td><td></td></tr>\n';
  html += '</table>\n';

  gameData.sets.forEach((set, setIdx) => {
    if (!set.winner && set.score.A === 0 && set.score.B === 0) return;

    const durStr = formatDuration(set.startTime, set.endTime);
    const startFmt = set.startTime ? new Date(set.startTime).toLocaleTimeString() : 'N/A';
    const endFmt = set.endTime ? new Date(set.endTime).toLocaleTimeString() : 'N/A';

    html += '<h2>Set ' + (setIdx + 1) + ' Details</h2>\n';
    html += '<div class="info-grid">';
    html += '<div class="info-label">Start Time:</div><div>' + startFmt + '</div>';
    html += '<div class="info-label">End Time:</div><div>' + endFmt + '</div>';
    html += '<div class="info-label">Duration:</div><div>' + durStr + '</div>';
    html += '<div class="info-label">Final Score:</div><div>' + gameData.matchInfo.teamAName + ' ' + set.score.A + ' – ' + set.score.B + ' ' + gameData.matchInfo.teamBName + '</div>';
    html += '</div>\n';

    const lineupAForSet = (set.startingLineup?.A && set.startingLineup.A.length > 0)
      ? set.startingLineup.A
      : (setIdx === 0 ? (gameData.teams?.A?.lineup || []) : []);
    const lineupBForSet = (set.startingLineup?.B && set.startingLineup.B.length > 0)
      ? set.startingLineup.B
      : (setIdx === 0 ? (gameData.teams?.B?.lineup || []) : []);
    const hasLineup = (lineupAForSet.length > 0 || lineupBForSet.length > 0);
    if (hasLineup) {
      html += '<h3>Starting Lineup</h3>\n<table>\n';
      html += '<tr><th>Position</th><th class="team-a">' + gameData.matchInfo.teamAName + '</th><th class="team-b">' + gameData.matchInfo.teamBName + '</th></tr>\n';
      for (let pos = 0; pos < 6; pos++) {
        const jA = lineupAForSet[pos] != null ? lineupAForSet[pos] : null;
        const jB = lineupBForSet[pos] != null ? lineupBForSet[pos] : null;
        html += '<tr><td class="center"><strong>P' + (pos + 1) + '</strong></td>';
        html += '<td class="team-a">' + (jA ? getPlayerName('A', jA) : '-') + '</td>';
        html += '<td class="team-b">' + (jB ? getPlayerName('B', jB) : '-') + '</td></tr>\n';
      }
      html += '</table>\n';
    }

    const subsA = set.substitutions?.A || [];
    const subsB = set.substitutions?.B || [];
    html += '<h3>Substitutions</h3>\n';
    if (subsA.length > 0 || subsB.length > 0) {
      html += '<table>\n<tr><th>Team</th><th>Score</th><th>Player OUT</th><th>Player IN</th></tr>\n';
      ['A', 'B'].forEach((team) => {
        const subs = team === 'A' ? subsA : subsB;
        const teamName = team === 'A' ? gameData.matchInfo.teamAName : gameData.matchInfo.teamBName;
        subs.forEach((sub) => {
          html += '<tr><td class="team-' + team.toLowerCase() + '">' + teamName + '</td>';
          html += '<td class="center">' + scoreDisplay(sub.score, team) + '</td>';
          html += '<td>' + getPlayerName(team, sub.playerOut) + '</td>';
          html += '<td>' + getPlayerName(team, sub.playerIn) + '</td></tr>\n';
        });
      });
      html += '<tr class="totals-row"><td colspan="2" style="color:#1e3c72;">TOTAL SUBSTITUTIONS</td>';
      html += '<td class="team-a center">' + gameData.matchInfo.teamAName + ': ' + subsA.length + ' / ' + subLimit + '</td>';
      html += '<td class="team-b center">' + gameData.matchInfo.teamBName + ': ' + subsB.length + ' / ' + subLimit + '</td></tr>\n';
      html += '</table>\n';
    } else {
      html += '<p class="no-data">No substitutions recorded for this set.</p>\n';
    }

    const excA = set.exceptionalSubstitutions?.A || [];
    const excB = set.exceptionalSubstitutions?.B || [];
    html += '<h3>Exceptional Substitutions (Injury)</h3>\n';
    if (excA.length > 0 || excB.length > 0) {
      html += '<table>\n<tr><th>Team</th><th>Score</th><th>Player OUT (Injured)</th><th>Player IN</th><th>Remark</th></tr>\n';
      ['A', 'B'].forEach((team) => {
        const excSubs = team === 'A' ? excA : excB;
        const teamName = team === 'A' ? gameData.matchInfo.teamAName : gameData.matchInfo.teamBName;
        excSubs.forEach((sub) => {
          html += '<tr><td class="team-' + team.toLowerCase() + '">' + teamName + '</td>';
          html += '<td class="center">' + scoreDisplay(sub.score, team) + '</td>';
          html += '<td>' + getPlayerName(team, sub.playerOut) + '</td>';
          html += '<td>' + getPlayerName(team, sub.playerIn) + '</td>';
          html += '<td>' + (sub.remark || 'Injury') + '</td></tr>\n';
        });
      });
      html += '</table>\n';
    } else {
      html += '<p class="no-data">No exceptional substitutions recorded for this set.</p>\n';
    }

    const libA = [];
    const libB = [];
    if (gameData.matchSummary && gameData.matchSummary.length > 0) {
      const liberoEventsA = gameData.matchSummary.filter((e) => e.type === 'Libero' && e.team === 'A' && e.setNumber === setIdx + 1);
      const liberoEventsB = gameData.matchSummary.filter((e) => e.type === 'Libero' && e.team === 'B' && e.setNumber === setIdx + 1);
      const parseDesc = (e) => {
        const match = e.description?.match(/#(\d+)\s+([A-Z\.\s]+)\s*\([LI\d]+\)\s+replaces\s+#(\d+)\s+([A-Z\.\s]+)\s+in\s+(P\d+)\s+at\s+(\d+):(\d+)/);
        if (match)
          return { libero: match[1], liberoName: match[2].trim(), originalPlayer: match[3], originalName: match[4].trim(), position: match[5], scoreA: match[6], scoreB: match[7] };
        return null;
      };
      liberoEventsA.forEach((e) => { const r = parseDesc(e); if (r) libA.push(r); });
      liberoEventsB.forEach((e) => { const r = parseDesc(e); if (r) libB.push(r); });
    }

    html += '<h3>Libero Replacements</h3>\n';
    if (libA.length > 0 || libB.length > 0) {
      html += '<table>\n<tr><th>Team</th><th>Score</th><th>Libero IN</th><th>Player OUT</th><th>Position</th></tr>\n';
      ['A', 'B'].forEach((team) => {
        const reps = team === 'A' ? libA : libB;
        const teamName = team === 'A' ? gameData.matchInfo.teamAName : gameData.matchInfo.teamBName;
        reps.forEach((rep) => {
          const scoreD = rep.scoreA + '-' + rep.scoreB;
          html += '<tr><td class="team-' + team.toLowerCase() + '">' + teamName + '</td>';
          html += '<td class="center">' + scoreD + '</td>';
          html += '<td>#' + rep.libero + ' ' + rep.liberoName + '</td>';
          html += '<td>#' + rep.originalPlayer + ' ' + rep.originalName + '</td>';
          html += '<td class="center">' + rep.position + '</td></tr>\n';
        });
      });
      html += '</table>\n';
    } else {
      html += '<p class="no-data">No libero replacements recorded for this set.</p>\n';
    }

    const toA = set.timeouts?.A || [];
    const toB = set.timeouts?.B || [];
    html += '<h3>Timeouts</h3>\n';
    if (toA.length > 0 || toB.length > 0) {
      html += '<table>\n<tr><th>Team</th><th>Score When Called</th></tr>\n';
      ['A', 'B'].forEach((team) => {
        const tos = team === 'A' ? toA : toB;
        const teamName = team === 'A' ? gameData.matchInfo.teamAName : gameData.matchInfo.teamBName;
        tos.forEach((to) => {
          html += '<tr><td class="team-' + team.toLowerCase() + '">' + teamName + '</td>';
          html += '<td class="center">' + scoreDisplay(to.score, team) + '</td></tr>\n';
        });
      });
      html += '</table>\n';
    } else {
      html += '<p class="no-data">No timeouts recorded for this set.</p>\n';
    }

    const setSanctions = getAllSanctions().filter((s) => s.set === setIdx + 1);
    html += '<h3>Sanctions</h3>\n';
    if (setSanctions.length > 0) {
      html += '<table>\n<tr><th>Time</th><th>Team</th><th>Score at Time</th><th>Player/Coach</th><th>Type</th><th>Reason / Notes</th></tr>\n';
      setSanctions.forEach((s) => {
        const teamName = s.team === 'A' ? gameData.matchInfo.teamAName : gameData.matchInfo.teamBName;
        const tdClass = 'class="team-' + s.team.toLowerCase() + '"';
        html += '<tr>';
        html += '<td class="center">' + (s.time || '—') + '</td>';
        html += '<td ' + tdClass + '>' + teamName + '</td>';
        html += '<td class="center" style="font-weight:bold;color:#1e3c72">' + fmtScore(s.score, s.team) + '</td>';
        html += '<td class="center">' + s.person + '</td>';
        html += '<td>' + (typeNames[s.type] || s.type || 'N/A') + '</td>';
        html += '<td>' + (s.reason ? s.reason + (s.notes ? ' — ' + s.notes : '') : s.notes || '') + '</td>';
        html += '</tr>\n';
      });
      html += '</table>\n';
    } else {
      html += '<p class="no-data">No sanctions recorded for this set.</p>\n';
    }
  });

  const allSanctions = getAllSanctions();
  if (allSanctions.length > 0) {
    html += '<h2>Match Sanctions Summary</h2>\n<table>\n';
    html += '<tr><th>Set</th><th>Time</th><th>Team</th><th>Score at Time</th><th>Player/Coach</th><th>Type</th><th>Reason / Notes</th></tr>\n';
    allSanctions.forEach((s) => {
      const teamName = s.team === 'A' ? gameData.matchInfo.teamAName : gameData.matchInfo.teamBName;
      const tdClass = 'class="team-' + s.team.toLowerCase() + '"';
      html += '<tr>';
      html += '<td class="center">Set ' + (s.set || '?') + '</td>';
      html += '<td class="center">' + (s.time || '—') + '</td>';
      html += '<td ' + tdClass + '>' + teamName + '</td>';
      html += '<td class="center" style="font-weight:bold;color:#1e3c72">' + fmtScore(s.score, s.team) + '</td>';
      html += '<td class="center">' + s.person + '</td>';
      html += '<td>' + (typeNames[s.type] || s.type || 'N/A') + '</td>';
      html += '<td>' + (s.reason ? s.reason + (s.notes ? ' — ' + s.notes : '') : s.notes || '') + '</td>';
      html += '</tr>\n';
    });
    html += '</table>\n';
  }

  html += '<h2>Team Rosters</h2>\n';
  ['A', 'B'].forEach((team) => {
    const teamName = team === 'A' ? gameData.matchInfo.teamAName : gameData.matchInfo.teamBName;
    const players = gameData.teams[team]?.players || [];
    html += '<h3>' + teamName + '</h3>\n<table>\n';
    html += '<tr><th>#</th><th>Player Name</th><th>Role</th></tr>\n';
    players.forEach((p) => {
      const roleText = p.role === 'libero1' ? 'Libero 1' : p.role === 'libero2' ? 'Libero 2' : p.role === 'liberocaptain' ? 'Libero + Captain' : p.role === 'captain' ? 'Captain' : 'Player';
      html += '<tr><td class="center team-' + team.toLowerCase() + '">' + p.jersey + '</td>';
      html += '<td>' + p.name + '</td><td>' + roleText + '</td></tr>\n';
    });
    const injured = gameData.injuredPlayers?.[team] || [];
    if (injured.length > 0) {
      html += '<tr class="injured-row"><td colspan="3">🚑 Injured / Locked: ' + injured.map((j) => getPlayerName(team, j)).join(', ') + '</td></tr>\n';
    }
    html += '</table>\n';
  });

  html += '<h2>Match Officials</h2>\n<table>\n';
  html += '<tr><th style="width:30%">Role</th><th style="width:40%">Name</th><th style="width:30%">Signature</th></tr>\n';
  html += '<tr><td><strong>1st Referee</strong></td><td>' + (gameData.matchInfo.ref1 || '') + '</td><td class="sig-cell">' + sigImg('firstRefSign') + '</td></tr>\n';
  html += '<tr><td><strong>2nd Referee</strong></td><td>' + (gameData.matchInfo.ref2 || '') + '</td><td class="sig-cell">' + sigImg('secondRefSign') + '</td></tr>\n';
  html += '<tr><td><strong>Scorer</strong></td><td>' + (gameData.matchInfo.scorer || '') + '</td><td class="sig-cell">' + sigImg('scorerSign') + '</td></tr>\n';
  html += '<tr><td><strong>Assistant Scorer</strong></td><td>' + (gameData.matchInfo.assistScorer || '') + '</td><td class="sig-cell">' + sigImg('assistScorerSign') + '</td></tr>\n';
  html += '</table>\n';

  html += '<h2>Team Staff & Signatures</h2>\n<table>\n';
  html += '<tr><th style="width:20%">Team</th><th style="width:15%">Role</th><th style="width:35%">Name</th><th style="width:30%">Signature</th></tr>\n';
  html += '<tr class="team-a"><td rowspan="4"><strong>' + gameData.matchInfo.teamAName + '</strong></td>';
  html += '<td><strong>Captain (Before)</strong></td><td>' + captainA + '</td><td class="sig-cell">' + sigImg('captainSignA1') + '</td></tr>\n';
  html += '<tr class="team-a"><td><strong>Captain (After)</strong></td><td>' + captainA + '</td><td class="sig-cell">' + sigImg('captainSignA2') + '</td></tr>\n';
  html += '<tr class="team-a"><td><strong>Coach</strong></td><td>' + coachA + (asstCoachA ? ' / Asst: ' + asstCoachA : '') + '</td><td class="sig-cell">' + sigImg('coachSignA') + '</td></tr>\n';
  html += '<tr class="team-a"><td><strong>Medical / Trainer</strong></td><td>' + (medicalA ? 'Med: ' + medicalA : '') + (trainerA ? (medicalA ? ' | ' : '') + 'Trainer: ' + trainerA : '') + '</td><td class="sig-cell"></td></tr>\n';
  html += '<tr class="team-b"><td rowspan="4"><strong>' + gameData.matchInfo.teamBName + '</strong></td>';
  html += '<td><strong>Captain (Before)</strong></td><td>' + captainB + '</td><td class="sig-cell">' + sigImg('captainSignB1') + '</td></tr>\n';
  html += '<tr class="team-b"><td><strong>Captain (After)</strong></td><td>' + captainB + '</td><td class="sig-cell">' + sigImg('captainSignB2') + '</td></tr>\n';
  html += '<tr class="team-b"><td><strong>Coach</strong></td><td>' + coachB + (asstCoachB ? ' / Asst: ' + asstCoachB : '') + '</td><td class="sig-cell">' + sigImg('coachSignB') + '</td></tr>\n';
  html += '<tr class="team-b"><td><strong>Medical / Trainer</strong></td><td>' + (medicalB ? 'Med: ' + medicalB : '') + (trainerB ? (medicalB ? ' | ' : '') + 'Trainer: ' + trainerB : '') + '</td><td class="sig-cell"></td></tr>\n';
  html += '</table>\n';

  const generatedAt = new Date().toLocaleString();
  const gameCode = gameData.gameCode || '';
  html += '<div style="text-align:center;margin-top:60px;padding-top:20px;border-top:2px solid #ddd;color:#888;">';
  html += '<p>DC_Volley &copy; 2025 | Digital Volleyball Scoresheet</p>';
  html += '<p>Report generated from <strong>live match data</strong> at ' + generatedAt + '</p>';
  if (gameCode) html += '<p>Game code: ' + gameCode + '</p>';
  html += '</div>\n';
  html += '</div>\n</body>\n</html>';

  return html;
}

/**
 * Download the match report as an HTML file (same as match_report_generator.html output).
 */
export function downloadMatchReportHtml(gameData, filename) {
  if (!gameData || !gameData.teamAName) {
    if (typeof window !== 'undefined') window.alert('No match data to export. Load a game first.');
    return;
  }
  const html = generateMatchReportHtml(gameData);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'FIVB_Match_Report_' + (gameData.teamAName || 'TeamA') + '_vs_' + (gameData.teamBName || 'TeamB') + '.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
