/**
 * Challenge report HTML sections (from DC_Volley_challenge__2_.html export)
 */

export function getChallengeLog(gameData) {
  const cs = gameData?.challengeSystem;
  if (!cs?.log?.length) return [];
  return [...cs.log].reverse();
}

export function getChallengeStats(gameData) {
  const log = gameData?.challengeSystem?.log || [];
  const teamAName = gameData?.teamAName || gameData?.matchInfo?.teamAName || 'Team A';
  const teamBName = gameData?.teamBName || gameData?.matchInfo?.teamBName || 'Team B';

  const chSuccA = log.filter((e) => e.team === 'A' && e.result === 'SUCCESSFUL').length;
  const chFailA = log.filter((e) => e.team === 'A' && e.result === 'UNSUCCESSFUL').length;
  const chSuccB = log.filter((e) => e.team === 'B' && e.result === 'SUCCESSFUL').length;
  const chFailB = log.filter((e) => e.team === 'B' && e.result === 'UNSUCCESSFUL').length;

  return {
    teamAName,
    teamBName,
    chSuccA,
    chFailA,
    chSuccB,
    chFailB,
    usedA: chSuccA + chFailA,
    usedB: chSuccB + chFailB,
    remainingA: Math.max(0, 2 - chSuccA - chFailA),
    remainingB: Math.max(0, 2 - chSuccB - chFailB)
  };
}

export function buildChallengeReportHtml(gameData) {
  const challengeLog = getChallengeLog(gameData);
  if (challengeLog.length === 0) return '';

  const stats = getChallengeStats(gameData);
  let html = '<h2 style="color:#ff9500;border-bottom:2px solid #ff9500;padding-bottom:8px;margin-top:30px">CHALLENGE REPORT</h2>\n';

  html += '<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:13px">\n';
  html += '<tr style="background:#ff9500;color:#000;font-weight:bold"><th style="border:1px solid #ccc;padding:8px">Team</th><th style="border:1px solid #ccc;padding:8px">Challenges Used</th><th style="border:1px solid #ccc;padding:8px">Successful ✅</th><th style="border:1px solid #ccc;padding:8px">Unsuccessful ❌</th><th style="border:1px solid #ccc;padding:8px">Remaining</th></tr>\n';
  html += `<tr><td style="border:1px solid #ccc;padding:8px">${stats.teamAName}</td><td style="border:1px solid #ccc;padding:8px;text-align:center">${stats.usedA}</td><td style="border:1px solid #ccc;padding:8px;text-align:center">${stats.chSuccA}</td><td style="border:1px solid #ccc;padding:8px;text-align:center">${stats.chFailA}</td><td style="border:1px solid #ccc;padding:8px;text-align:center">${stats.remainingA}</td></tr>\n`;
  html += `<tr><td style="border:1px solid #ccc;padding:8px">${stats.teamBName}</td><td style="border:1px solid #ccc;padding:8px;text-align:center">${stats.usedB}</td><td style="border:1px solid #ccc;padding:8px;text-align:center">${stats.chSuccB}</td><td style="border:1px solid #ccc;padding:8px;text-align:center">${stats.chFailB}</td><td style="border:1px solid #ccc;padding:8px;text-align:center">${stats.remainingB}</td></tr>\n`;
  html += '</table>\n';

  html += '<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:12px">\n';
  html += '<tr style="background:#ff9500;color:#000;font-weight:bold"><th style="border:1px solid #ccc;padding:6px">#</th><th style="border:1px solid #ccc;padding:6px">Time</th><th style="border:1px solid #ccc;padding:6px">Set</th><th style="border:1px solid #ccc;padding:6px">Challenging Team</th><th style="border:1px solid #ccc;padding:6px">Score at Challenge</th><th style="border:1px solid #ccc;padding:6px">Type</th><th style="border:1px solid #ccc;padding:6px">Result</th></tr>\n';

  challengeLog.forEach((e, idx) => {
    const scoreStr = e.scoreAtChallenge ? `${e.scoreAtChallenge.A} - ${e.scoreAtChallenge.B}` : '-';
    const isSuccess = e.result === 'SUCCESSFUL';
    const resultStr = isSuccess
      ? '✅ SUCCESSFUL (Rally reversed, point & serve awarded)'
      : '❌ UNSUCCESSFUL (Decision stands, -1 challenge)';
    const resultColor = isSuccess ? '#009600' : '#c80000';
    html += `<tr><td style="border:1px solid #ccc;padding:6px;text-align:center">${idx + 1}</td>`;
    html += `<td style="border:1px solid #ccc;padding:6px">${e.timestamp || '-'}</td>`;
    html += `<td style="border:1px solid #ccc;padding:6px;text-align:center">Set ${e.set || '-'}</td>`;
    html += `<td style="border:1px solid #ccc;padding:6px">${e.teamName || `Team ${e.team}`} challenged</td>`;
    html += `<td style="border:1px solid #ccc;padding:6px;text-align:center">${scoreStr}</td>`;
    html += `<td style="border:1px solid #ccc;padding:6px">${e.type || '-'}</td>`;
    html += `<td style="border:1px solid #ccc;padding:6px;color:${resultColor};font-weight:bold">${resultStr}</td></tr>\n`;
  });

  html += '</table>\n';
  return html;
}
