import { jsPDF } from 'jspdf';
import { normalizeExportGameData } from './normalizeExportGameData.js';

const SECTIONS = [['A', 'B'], ['B', 'A'], ['A', 'B'], ['B', 'A'], ['A', 'B']];

function parseLiberoDesc(d) {
  d = d || '';
  const o = { lib: '', rep: '', s1: '', s2: '' };
  const l = d.match(/Libero\s+#(\d+)/i) || d.match(/#(\d+)[^#]*replaces/i);
  if (l) o.lib = l[1];
  const r = d.match(/replaces\s+#(\d+)/i);
  if (r) o.rep = r[1];
  const s = d.match(/at\s+(\d+)\s*[:\-]\s*(\d+)/i);
  if (s) {
    o.s1 = s[1];
    o.s2 = s[2];
  }
  return o;
}

function liberoEventToDesc(ev, teamName, players) {
  if (String(ev.type || '').toUpperCase() === 'LIBERO' && ev.description) return ev.description;
  const lib = ev.liberoJersey || ev.playerInJersey;
  const rep = ev.playerOutJersey;
  const score = ev.score || {};
  const team = ev.team || 'A';
  const opp = team === 'A' ? 'B' : 'A';
  const scoreText = `${score[team] ?? 0}:${score[opp] ?? 0}`;
  const pos = ev.position != null ? ` in P${ev.position}` : '';
  const liberoPlayer = (players || []).find((player) => String(player.jersey) === String(lib));
  const replacedPlayer = (players || []).find((player) => String(player.jersey) === String(rep));
  const badge = liberoPlayer?.role === 'libero1' ? 'L1' : liberoPlayer?.role === 'libero2' ? 'L2' : 'L';
  const liberoName = liberoPlayer?.name ? ` ${liberoPlayer.name}` : '';
  const replacedName = replacedPlayer?.name ? ` ${replacedPlayer.name}` : '';
  return `${teamName} Libero #${lib}${liberoName} (${badge}) replaces #${rep}${replacedName}${pos} at ${scoreText}`;
}

function collectLiberoEvents(gameData) {
  const teamAName = gameData.matchInfo?.teamAName || gameData.teamAName || 'Team A';
  const teamBName = gameData.matchInfo?.teamBName || gameData.teamBName || 'Team B';
  return (gameData.matchSummary || [])
    .filter((e) => {
      if (!e) return false;
      const t = String(e.type || '').toUpperCase();
      return t === 'LIBERO' || t === 'LIBERO_REPLACEMENT';
    })
    .map((ev) => {
      const team = ev.team || 'A';
      const teamName = team === 'A' ? teamAName : teamBName;
      const players = gameData.teams?.[team]?.players || [];
      return {
        ...ev,
        type: 'Libero',
        description: liberoEventToDesc(ev, teamName, players)
      };
    });
}

/**
 * FIVB R-6 International Libero Control Sheet — direct PDF export (HTML parity).
 */
export function exportLiberoSheetPdf(gameData) {
  const data = normalizeExportGameData(gameData);
  if (!data?.matchInfo?.teamAName && !data?.teamAName) {
    alert('No match data yet. Start a match first.');
    return;
  }

  const mi = data.matchInfo || {};
  const F = {
    competition: mi.competition || '',
    city: mi.city || '',
    country: mi.countryCode || '',
    hall: mi.hall || mi.venue || '',
    pool: mi.pool || '',
    matchNo: mi.matchNumber || '',
    date: mi.date || '',
    time: mi.time || '',
    division: mi.division || (/(women)/i.test(String(mi.format || '')) ? 'Women' : ''),
    category: mi.category || '',
    teamA: mi.teamAName || data.teamAName || '',
    teamB: mi.teamBName || data.teamBName || '',
    assist: mi.assistScorer || data.officials?.assistScorer || ''
  };

  const sheet = Array.from({ length: 5 }, () => [[], []]);
  collectLiberoEvents(data).forEach((ev) => {
    const sIdx = (ev.setNumber || 1) - 1;
    if (sIdx < 0 || sIdx > 4) return;
    const team = ev.team || 'A';
    const secIdx = SECTIONS[sIdx][0] === team ? 0 : 1;
    sheet[sIdx][secIdx].push(parseLiberoDesc(ev.description || ''));
  });

  function liberoNos(team) {
    const t = data.teams?.[team];
    if (!t?.players) return '';
    return t.players
      .filter((p) => p.role === 'libero1' || p.role === 'libero2')
      .map((p) => p.jersey)
      .join(',');
  }
  const libNoA = liberoNos('A');
  const libNoB = liberoNos('B');

  let sig = data.officials?.signatures?.assistScorerSign || '';
  if (sig && sig.length < 200) sig = '';

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
  const W = 420;
  const H = 297;
  const M = 8;

  function val(v, x, y, lineLen) {
    if (v) doc.text(String(v), x, y);
    else if (lineLen) {
      doc.setDrawColor(0);
      doc.setLineWidth(0.2);
      doc.line(x, y + 0.6, x + lineLen, y + 0.6);
    }
  }

  doc.setDrawColor(0);
  doc.setLineWidth(0.35);
  doc.rect(M, M, W - 2 * M, 24);
  const fivbX = W - M - 100;
  doc.line(fivbX, M, fivbX, M + 24);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text('Name of the Competition :', M + 3, M + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  val(F.competition, M + 58, M + 6, 100);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text('City', M + 3, M + 12);
  val(F.city, M + 14, M + 12, 55);
  doc.text('Country Code :', M + 100, M + 12);
  val(F.country, M + 132, M + 12, 25);
  doc.text('Date', M + 165, M + 12);
  val(F.date, M + 177, M + 12, 35);
  doc.text('Time', M + 225, M + 12);
  val(F.time, M + 237, M + 12, 25);
  doc.text('Hall', M + 3, M + 17.5);
  val(F.hall, M + 14, M + 17.5, 75);
  doc.text('Pool/Phase', M + 100, M + 17.5);
  val(F.pool, M + 126, M + 17.5, 31);
  doc.text('Match N\u00B0', M + 165, M + 17.5);
  val(F.matchNo, M + 187, M + 17.5, 25);

  function xbox(label, x, y, checked) {
    doc.text(label, x, y);
    const bx = x + doc.getTextWidth(label) + 2;
    doc.rect(bx, y - 3.8, 4.6, 4.6);
    if (checked) {
      doc.setFont('helvetica', 'bold');
      doc.text('X', bx + 1.1, y - 0.2);
      doc.setFont('helvetica', 'normal');
    }
    return bx + 7.5;
  }

  let dx = M + 3;
  doc.text('Division :', dx, M + 23);
  dx += 22;
  dx = xbox('Men', dx, M + 23, /^m/i.test(F.division));
  dx = xbox('Women', dx, M + 23, /^w/i.test(F.division));
  dx += 8;
  doc.text('Category :', dx, M + 23);
  dx += 24;
  dx = xbox('Senior', dx, M + 23, /senior/i.test(F.category));
  dx = xbox('Junior', dx, M + 23, /junior/i.test(F.category));
  dx = xbox('Youth', dx, M + 23, /youth/i.test(F.category));
  const ty = M + 23;
  let tx = dx + 8;
  doc.setFontSize(11);
  doc.circle(tx, ty - 1.4, 3);
  doc.text('A', tx - 1.2, ty);
  doc.setFont('helvetica', 'bold');
  doc.text(String(F.teamA), tx + 6, ty);
  let tbx = tx + 9 + doc.getTextWidth(String(F.teamA));
  doc.text('TEAMS vs', tbx, ty);
  tbx += doc.getTextWidth('TEAMS vs') + 5;
  doc.text(String(F.teamB), tbx, ty);
  doc.setFont('helvetica', 'normal');
  const cbx = tbx + doc.getTextWidth(String(F.teamB)) + 6;
  doc.circle(cbx, ty - 1.4, 3);
  doc.text('B', cbx - 1.2, ty);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.text('FIVB', fivbX + 4, M + 10);
  doc.setFontSize(9);
  doc.text('FEDERATION', fivbX + 45, M + 6);
  doc.text('INTERNATIONALE', fivbX + 45, M + 10.5);
  doc.text('DE VOLLEYBALL', fivbX + 45, M + 15);
  doc.line(fivbX, M + 17.5, W - M, M + 17.5);
  doc.setFontSize(10.5);
  doc.text('R-6', fivbX + 3, M + 22.5);
  doc.text('INTERNATIONAL LIBERO CONTROL SHEET', fivbX + 13, M + 22.5);

  const top = M + 27;
  const gridW = W - 2 * M;
  const setW = gridW / 5;
  const secW = setW / 2;
  const libW = secW * 0.2;
  const repW = secW * 0.2;
  const scoW = secW * 0.6;
  const setHeadH = 7;
  const secHeadH = 7;
  const colHeadH = 5.2;
  const rowH = 6.2;
  const bodyTop = top + setHeadH + secHeadH + colHeadH;
  const footTop = H - 36;
  const rows = Math.floor((footTop - bodyTop) / rowH);

  doc.setLineWidth(0.2);
  for (let s = 0; s < 5; s++) {
    const sx = M + s * setW;
    doc.rect(sx, top, setW, setHeadH);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(`SET ${s + 1}`, sx + setW / 2, top + setHeadH - 1.8, { align: 'center' });
    for (let sec = 0; sec < 2; sec++) {
      const secx = sx + sec * secW;
      doc.rect(secx, top + setHeadH, secW, secHeadH);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      const letter = SECTIONS[s][sec];
      const nos = letter === 'A' ? libNoA : libNoB;
      doc.text(`No: ${nos || '____'}`, secx + 2, top + setHeadH + secHeadH - 2.2);
      const ccx = secx + secW - 5.5;
      doc.circle(ccx, top + setHeadH + secHeadH / 2, 2.8);
      doc.setFont('helvetica', 'bold');
      doc.text(letter, ccx - 1.2, top + setHeadH + secHeadH / 2 + 1.4);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      let cx = secx;
      [
        ['Lib.', libW],
        ['Rep.', repW],
        ['Score', scoW]
      ].forEach(([label, w]) => {
        doc.rect(cx, top + setHeadH + secHeadH, w, colHeadH);
        doc.text(label, cx + w / 2, top + setHeadH + secHeadH + colHeadH - 1.4, { align: 'center' });
        cx += w;
      });
    }
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  for (let r = 0; r < rows; r++) {
    const ry = bodyTop + r * rowH;
    for (let s = 0; s < 5; s++) {
      for (let sec = 0; sec < 2; sec++) {
        const secx2 = M + s * setW + sec * secW;
        let cx2 = secx2;
        [libW, repW, scoW].forEach((w) => {
          doc.rect(cx2, ry, w, rowH);
          cx2 += w;
        });
        const row = sheet[s][sec][r];
        const yv = ry + rowH - 1.8;
        if (row) {
          if (row.lib) doc.text(String(row.lib), secx2 + libW / 2, yv, { align: 'center' });
          if (row.rep) doc.text(String(row.rep), secx2 + libW + repW / 2, yv, { align: 'center' });
          const sc = row.s1 !== '' || row.s2 !== '' ? `${row.s1} : ${row.s2}` : ':';
          doc.text(sc, secx2 + libW + repW + scoW / 2, yv, { align: 'center' });
        } else {
          doc.text(':', secx2 + libW + repW + scoW / 2, yv, { align: 'center' });
        }
      }
    }
  }

  doc.setLineWidth(0.35);
  doc.rect(M, top, gridW, bodyTop - top + rows * rowH);

  const fy = footTop + 2;
  const bandH = 15;
  const boxW1 = gridW * 0.28;
  const boxW2 = gridW * 0.28;
  const boxW3 = gridW - boxW1 - boxW2;
  doc.setLineWidth(0.3);
  doc.rect(M, fy, boxW1, bandH);
  doc.rect(M + boxW1, fy, boxW2, bandH);
  doc.rect(M + boxW1 + boxW2, fy, boxW3, bandH);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Re-designation team A:', M + 2, fy + 5.5);
  doc.text('Re-designation team B:', M + boxW1 + 2, fy + 5.5);
  doc.text('Remark(s):', M + boxW1 + boxW2 + 2, fy + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('No:(OUT/IN) ____/____   Set: ____   Points: ____:____', M + 2, fy + 12);
  doc.text('No:(OUT/IN) ____/____   Set: ____   Points: ____:____', M + boxW1 + 2, fy + 12);
  doc.line(M + boxW1 + boxW2 + 26, fy + 11, M + gridW - 3, fy + 11);

  const sy = fy + bandH + 9;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Name of the Assistant scorer :', M + 2, sy);
  doc.setFont('helvetica', 'normal');
  if (F.assist) doc.text(F.assist, M + 68, sy);
  doc.line(M + 66, sy + 1, M + 180, sy + 1);
  doc.setFont('helvetica', 'bold');
  doc.text('Signature :', M + gridW / 2, sy);
  doc.setFont('helvetica', 'normal');
  if (sig) {
    try {
      doc.addImage(sig, 'PNG', M + gridW / 2 + 26, sy - 8, 70, 9);
    } catch {
      /* ignore bad signature image */
    }
  }
  doc.line(M + gridW / 2 + 24, sy + 1, M + gridW - 3, sy + 1);

  doc.setFontSize(7);
  doc.setTextColor(130);
  doc.text('FIVB Official forms R-6 layout · Generated by VolleySync', W - M, H - 3, { align: 'right' });
  doc.setTextColor(0);

  const dt = F.date || new Date().toISOString().slice(0, 10);
  doc.save(`LiberoControlSheet_R6_${F.teamA || 'A'}_vs_${F.teamB || 'B'}_${dt}.pdf`);
}
