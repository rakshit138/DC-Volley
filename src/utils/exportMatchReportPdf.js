import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

/**
 * Generate and download a match report PDF from game data (match info, sets, timeouts, substitutions, officials).
 * @param {Object} gameData - Full game document from Firestore
 * @param {string} filename - Optional filename (default includes team names)
 */
export function exportMatchReportPdf(gameData, filename) {
  const doc = new jsPDF();
  const teamAName = gameData.teamAName || 'Team A';
  const teamBName = gameData.teamBName || 'Team B';
  const name = filename || `Match_Report_${teamAName}_vs_${teamBName}.pdf`;

  let y = 20;

  doc.setFontSize(18);
  doc.text('FIVB Match Report', 105, y, { align: 'center' });
  y += 12;

  doc.setFontSize(11);
  doc.text(`${gameData.competition || 'Competition'} | ${gameData.venue || 'Venue'} | ${gameData.matchDate || ''} ${gameData.matchTime || ''}`, 105, y, { align: 'center' });
  y += 10;

  doc.setFontSize(14);
  doc.text(`${teamAName}  vs  ${teamBName}`, 105, y, { align: 'center' });
  y += 12;

  const sets = gameData.sets || [];
  const setsWon = gameData.setsWon || { A: 0, B: 0 };
  doc.setFontSize(12);
  doc.text(`Result: ${setsWon.A} - ${setsWon.B} sets`, 105, y, { align: 'center' });
  y += 15;

  const setRows = sets.map((s, i) => {
    const scoreA = s.score?.A ?? 0;
    const scoreB = s.score?.B ?? 0;
    const winner = s.winner || '-';
    const toA = (s.timeouts?.A || []).length;
    const toB = (s.timeouts?.B || []).length;
    const subA = (s.substitutions?.A || []).length;
    const subB = (s.substitutions?.B || []).length;
    return [`Set ${i + 1}`, `${scoreA}-${scoreB}`, winner, `${toA}/2`, `${toB}/2`, subA, subB];
  });

  doc.autoTable({
    startY: y,
    head: [['Set', 'Score (A-B)', 'Winner', 'TO A', 'TO B', 'Sub A', 'Sub B']],
    body: setRows.length ? setRows : [['-', '-', '-', '-', '-', '-', '-']],
    theme: 'grid'
  });
  y = doc.lastAutoTable.finalY + 12;

  if (gameData.officials) {
    doc.setFontSize(12);
    doc.text('Officials', 14, y);
    y += 8;
    doc.setFontSize(10);
    const off = gameData.officials;
    doc.text(`1st Referee: ${off.ref1 || '-'}`, 14, y);
    y += 6;
    doc.text(`2nd Referee: ${off.ref2 || '-'}`, 14, y);
    y += 6;
    doc.text(`Scorer: ${off.scorer || '-'}`, 14, y);
    y += 6;
    doc.text(`Asst. Scorer: ${off.assistScorer || '-'}`, 14, y);
    y += 8;
    doc.text(`Team A - Coach: ${off.coachA || '-'}`, 14, y);
    y += 6;
    doc.text(`Team B - Coach: ${off.coachB || '-'}`, 14, y);
    y += 12;
  }

  const sigs = gameData.officials?.signatures || {};
  const sigIds = ['captainSignA1', 'coachSignA', 'captainSignB1', 'coachSignB', 'firstRefSign', 'scorerSign'];
  const sigLabels = ['Captain A', 'Coach A', 'Captain B', 'Coach B', '1st Referee', 'Scorer'];
  if (Object.keys(sigs).length > 0) {
    doc.setFontSize(12);
    doc.text('Signatures', 14, y);
    y += 8;
    sigIds.forEach((id, i) => {
      if (sigs[id] && y < 270) {
        try {
          doc.addImage(sigs[id], 'PNG', 14, y, 40, 8);
          doc.setFontSize(9);
          doc.text(sigLabels[i] || id, 56, y + 5);
          y += 14;
        } catch (_) {
          doc.text(`${sigLabels[i] || id}: [saved]`, 14, y + 5);
          y += 10;
        }
      }
    });
  }

  doc.save(name);
}
