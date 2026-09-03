/**
 * FIVB-style printable scoresheet (ported from DC_Volley_FIVB_final.html exportFIVBReport).
 * Opens a new window; user prints to PDF. Expects live game document shape from Firestore/React.
 */
import { firestoreTimeToDate } from './firestoreTime';

function val(v) {
  return v === null || v === undefined ? '' : String(v);
}

function tsToMs(ts) {
  const d = firestoreTimeToDate(ts);
  return d ? d.getTime() : 0;
}

function buildMatchInfo(G) {
  const o = G.officials || {};
  if (G.matchInfo && typeof G.matchInfo === 'object') {
    return { ...G.matchInfo };
  }
  return {
    teamAName: G.teamAName,
    teamBName: G.teamBName,
    competition: G.competition,
    city: G.venue,
    venue: G.venue,
    date: G.matchDate,
    matchNumber: G.matchNumber || G.matchNo,
    division: G.division,
    category: G.category || 'Senior',
    format: G.format,
    subLimit: G.subLimit,
    ref1: o.ref1 || G.ref1,
    ref2: o.ref2 || G.ref2,
    scorer: o.scorer || G.scorer,
    assistScorer: o.assistScorer || o.assistantScorer || G.assistScorer
  };
}

function isLiberoEvent(e) {
  const t = String(e?.type || '').toUpperCase();
  return t === 'LIBERO' || t === 'LIBERO_REPLACEMENT' || t.includes('LIBERO');
}

function isExceptionalEvent(e) {
  const t = String(e?.type || '').toUpperCase();
  return t === 'EXCEPTIONALSUB' || t === 'EXCEPTIONAL' || t === 'EXCEPTIONAL_SUBSTITUTION';
}

/**
 * @param {object} gameData
 */
export function exportFivbReport(gameData) {
  if (!gameData || !gameData.sets || !gameData.sets.length) {
    window.alert('No match data. Start or load a match first.');
    return;
  }

  const G = gameData;
  const mi = buildMatchInfo(G);
  const tA = mi.teamAName || 'Team A';
  const tB = mi.teamBName || 'Team B';

  function playerName(team, jersey) {
    const t = G.teams[team];
    if (!t || !t.players) return '';
    const p = t.players.find((x) => String(x.jersey) === String(jersey));
    return p ? val(p.name) : '';
  }

  function playerRole(team, jersey) {
    const t = G.teams[team];
    if (!t || !t.players) return '';
    const p = t.players.find((x) => String(x.jersey) === String(jersey));
    return p ? val(p.role) : '';
  }

  function fmtTime(ts) {
    const d = firestoreTimeToDate(ts);
    if (!d) return '—';
    const h = d.getHours();
    const m = d.getMinutes();
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }

  function fmtDur(ms) {
    if (!ms || ms <= 0) return '—';
    return Math.round(ms / 60000) + ' min';
  }

  function tname(team) {
    return team === 'A' ? tA : tB;
  }

  function roleBadge(role) {
    if (role === 'captain') return ' <b style="color:#1e3c72">(C)</b>';
    if (role === 'libero1') return ' <b style="color:#7b00c0">(L1)</b>';
    if (role === 'libero2') return ' <b style="color:#7b00c0">(L2)</b>';
    return '';
  }

  function sanctionLabel(t) {
    return (
      {
        W: 'Warning (W)',
        P: 'Penalty (P)',
        EXP: 'Expulsion (E)',
        DISQ: 'Disqualif. (D)',
        DW: 'Delay Warning',
        DP: 'Delay Penalty'
      }[t] || val(t)
    );
  }

  const sA = G.sets.filter((s) => s.winner === 'A').length;
  const sB = G.sets.filter((s) => s.winner === 'B').length;
  const matchWinner = sA > sB ? tA : tB;

  const allLiberoEvents = (G.matchSummary || []).filter((e) => isLiberoEvent(e));

  const allSanctions = [];
  if (G.sanctionSystem) {
    ['A', 'B'].forEach((team) => {
      (G.sanctionSystem.misconduct?.[team] || []).forEach((r) => {
        allSanctions.push({
          team,
          set: r.set,
          score: r.score,
          person: r.personType === 'coach' ? 'Coach' : '#' + r.person,
          type: r.type,
          reason: r.reason || r.notes || ''
        });
      });
      ((G.sanctionSystem.delay?.[team] || {}).log || []).forEach((r) => {
        allSanctions.push({
          team,
          set: r.set,
          score: r.score,
          person: 'Team',
          type: r.type,
          reason: ''
        });
      });
    });
  }

  const H = [];
  function o(s) {
    H.push(s);
  }

  const startMs = tsToMs(G.playStartedAt || G.startTime) || tsToMs(G.createdAt);
  const endMs = tsToMs(G.finishedAt || G.matchEndTime || G.endTime);

  o('<!DOCTYPE html><html><head><meta charset="UTF-8">');
  o('<title>VolleySync — FIVB Scoresheet — ' + tA + ' vs ' + tB + '</title>');
  o('<style>');
  o('* { margin:0; padding:0; box-sizing:border-box; }');
  o('body { font-family: Arial, sans-serif; font-size: 11px; color: #000; background: #fff; padding: 8mm; }');
  o('@media print { body { padding: 0; } @page { margin: 8mm; size: A4; } .noprint { display: none; } .newpage { page-break-before: always; } }');
  o('.newpage { page-break-before: always; padding-top: 6px; }');
  o('.noprint { position: fixed; top: 12px; right: 12px; background: #1e3c72; color: #fff; border: none; padding: 10px 18px; border-radius: 6px; font-size: 13px; font-weight: bold; cursor: pointer; z-index: 999; }');
  o('.fivb-hdr { background: #1e3c72; color: #fff; text-align: center; padding: 5px 4px 4px; margin-bottom: 4px; }');
  o('.fivb-hdr h1 { font-size: 12px; letter-spacing: 1px; }');
  o('.fivb-hdr p { font-size: 9px; opacity: .75; }');
  o('.info-band { display: flex; border: 1px solid #aaa; margin-bottom: 4px; }');
  o('.info-cell { flex: 1; padding: 2px 4px; border-right: 1px solid #ccc; }');
  o('.info-cell:last-child { border-right: none; }');
  o('.info-cell .lbl { font-size: 6.5px; text-transform: uppercase; color: #777; font-weight: bold; }');
  o('.info-cell .val { font-size: 9.5px; font-weight: bold; margin-top: 1px; }');
  o('.team-banner { display: flex; gap: 3px; margin-bottom: 4px; }');
  o('.tba { flex: 1; background: #9b0030; color: #fff; padding: 4px 6px; font-size: 10px; font-weight: bold; text-align: center; }');
  o('.tbb { flex: 1; background: #004f8a; color: #fff; padding: 4px 6px; font-size: 10px; font-weight: bold; text-align: center; }');
  o('table { width: 100%; border-collapse: collapse; margin-bottom: 5px; font-size: 9.5px; }');
  o('th { background: #1e3c72; color: #fff; padding: 3px 4px; text-align: center; font-size: 8.5px; border: 1px solid #1e3c72; }');
  o('td { padding: 2px 4px; border: 1px solid #ccc; text-align: center; vertical-align: middle; }');
  o('td.left { text-align: left; }');
  o('tr:nth-child(even) td { background: #f4f7ff; }');
  o('.sec { background: #1e3c72; color: #fff; padding: 3px 7px; font-size: 9.5px; font-weight: bold; margin: 5px 0 2px; }');
  o('.sec.red { background: #900; }');
  o('.sec.orange { background: #b05000; }');
  o('.sec.purple { background: #5a0080; }');
  o('.sec.green { background: #005a30; }');
  o('.sec.teal { background: #006060; }');
  o('.winner-box { background: #1e3c72; color: #ffd700; text-align: center; padding: 5px; font-size: 13px; font-weight: bold; margin: 5px 0; }');
  o('.set-hdr { background: #1e3c72; color: #fff; padding: 5px 8px; text-align: center; margin-bottom: 5px; }');
  o('.set-hdr h2 { font-size: 13px; }');
  o('.set-hdr p { font-size: 8.5px; opacity: .8; margin-top: 2px; }');
  o('.score-row { display: flex; gap: 4px; margin-bottom: 5px; }');
  o('.score-cell { flex: 1; border: 2px solid #ccc; padding: 6px 4px; text-align: center; }');
  o('.score-cell.sa { border-color: #9b0030; background: #fff5f7; }');
  o('.score-cell.sb { border-color: #004f8a; background: #f0f5ff; }');
  o('.score-cell .pts { font-size: 26px; font-weight: bold; line-height: 1; }');
  o('.score-cell .tnm { font-size: 9px; margin-top: 2px; color: #555; }');
  o('.sw { background: #1e3c72; color: #ffd700; text-align: center; padding: 2px; font-size: 9.5px; font-weight: bold; margin-bottom: 4px; }');
  o('.total-row td { background: #1e3c72 !important; color: #fff; font-weight: bold; }');
  o('.lib-in { color: #5a0080; font-weight: bold; }');
  o('.lib-out { color: #555; }');
  o('.nodata { color: #999; font-style: italic; padding: 3px 6px; font-size: 9px; }');
  o('.sig-wrap { display: flex; gap: 4px; margin: 3px 0; }');
  o('.sig-box { flex: 1; border: 1px solid #bbb; padding: 3px 5px; min-height: 16mm; }');
  o('.sig-box .slbl { font-size: 7px; color: #666; font-weight: bold; text-transform: uppercase; }');
  o('.sig-box .sname { font-size: 9px; margin: 2px 0 8px; }');
  o('.sig-box .sline { border-top: 1px solid #999; margin-top: 8px; }');
  o('.sig-box img { max-height: 12mm; max-width: 100%; display: block; margin: 2px 0; }');
  o('</style></head><body>');
  o('<button class="noprint" onclick="window.print()">🖨️ Print / Save as PDF</button>');

  o('<div class="fivb-hdr"><h1>FEDERATION INTERNATIONALE DE VOLLEYBALL</h1><p>INTERNATIONAL SCORESHEET — VolleySync</p></div>');

  o('<div class="info-band">');
  const infoFields = [
    ['Competition', mi.competition],
    ['City / Venue', mi.city || mi.venue],
    ['Date', mi.date],
    ['Match No.', mi.matchNumber || mi.matchNo],
    ['Division', mi.division],
    ['Category', mi.category || 'Senior'],
    ['Format', 'Best of ' + (mi.format || '?')],
    ['Sub limit/set', mi.subLimit || 6]
  ];
  infoFields.forEach((f) => {
    o('<div class="info-cell"><div class="lbl">' + f[0] + '</div><div class="val">' + val(f[1] || '—') + '</div></div>');
  });
  o('</div>');

  o('<div class="team-banner"><div class="tba">TEAM A &nbsp;—&nbsp; ' + tA + '</div><div class="tbb">TEAM B &nbsp;—&nbsp; ' + tB + '</div></div>');

  o('<div style="display:flex;gap:4px;margin-bottom:5px">');
  ['A', 'B'].forEach((team) => {
    const players = ((G.teams[team] && G.teams[team].players) || [])
      .slice()
      .sort((a, b) => parseInt(a.jersey, 10) - parseInt(b.jersey, 10));
    const regular = players.filter((p) => p.role !== 'libero1' && p.role !== 'libero2');
    const liberos = players.filter((p) => p.role === 'libero1' || p.role === 'libero2');

    o('<table style="flex:1">');
    o('<tr><th colspan="3">' + (team === 'A' ? tA : tB) + '</th></tr>');
    o('<tr><th>#</th><th>NAME</th><th>ROLE</th></tr>');
    regular.forEach((p) => {
      const isCap = p.role === 'captain';
      o('<tr' + (isCap ? ' style="font-weight:bold"' : '') + '>');
      o('<td>' + val(p.jersey) + '</td>');
      o('<td class="left">' + val(p.name) + '</td>');
      o('<td>' + (isCap ? 'C' : '') + '</td></tr>');
    });
    if (liberos.length) {
      o('<tr><td colspan="3" style="background:#ecdeff;font-weight:bold;font-size:8.5px;color:#5a0080">LIBERO PLAYER(S) — L</td></tr>');
      liberos.forEach((p) => {
        o('<tr style="background:#f5eeff">');
        o('<td class="lib-in">' + val(p.jersey) + '</td>');
        o('<td class="left lib-in">' + val(p.name) + '</td>');
        o('<td class="lib-in">' + (p.role === 'libero1' ? 'L1' : 'L2') + '</td></tr>');
      });
    }
    o('</table>');
  });
  o('</div>');

  o('<div class="sec">MATCH OFFICIALS</div>');
  o('<table><tr><th>1st Referee</th><th>2nd Referee</th><th>Scorer</th><th>Asst. Scorer</th></tr>');
  o(
    '<tr><td>' +
      val(mi.ref1 || '—') +
      '</td><td>' +
      val(mi.ref2 || '—') +
      '</td><td>' +
      val(mi.scorer || '—') +
      '</td><td>' +
      val(mi.assistScorer || '—') +
      '</td></tr></table>'
  );

  o('<div class="sec">MATCH RESULTS</div>');
  o('<table>');
  o(
    '<tr><th>SET</th><th>' +
      tA +
      ' PTS</th><th>' +
      tB +
      ' PTS</th><th>W(A)</th><th>W(B)</th><th>SET WINNER</th><th>DURATION</th><th>SUBS A</th><th>SUBS B</th><th>TO A</th><th>TO B</th></tr>'
  );

  let totScA = 0,
    totScB = 0,
    totWA = 0,
    totWB = 0,
    totSA = 0,
    totSB = 0,
    totTA = 0,
    totTB = 0,
    totDur = 0;
  G.sets.forEach((set, si) => {
    const sc = set.score || { A: 0, B: 0 };
    const scA = sc.A || 0;
    const scB = sc.B || 0;
    const st = tsToMs(set.startTime || set.setClockStartedAt);
    const en = tsToMs(set.endTime);
    const dur = st && en ? Math.round((en - st) / 60000) : 0;
    const wA = set.winner === 'A' ? 1 : 0;
    const wB = set.winner === 'B' ? 1 : 0;
    const subA = set.substitutions && set.substitutions.A ? set.substitutions.A.length : 0;
    const subB = set.substitutions && set.substitutions.B ? set.substitutions.B.length : 0;
    const toA = set.timeouts && set.timeouts.A ? set.timeouts.A.length : 0;
    const toB = set.timeouts && set.timeouts.B ? set.timeouts.B.length : 0;
    const wLabel = set.winner ? (set.winner === 'A' ? tA : tB) : '—';
    totScA += scA;
    totScB += scB;
    totWA += wA;
    totWB += wB;
    totSA += subA;
    totSB += subB;
    totTA += toA;
    totTB += toB;
    totDur += dur;
    o('<tr>');
    o('<td><b>Set ' + (si + 1) + '</b></td><td><b>' + scA + '</b></td><td><b>' + scB + '</b></td>');
    o('<td>' + wA + '</td><td>' + wB + '</td><td>' + wLabel + '</td>');
    o('<td>' + (dur ? dur + ' mn' : '—') + '</td>');
    o('<td>' + subA + '</td><td>' + subB + '</td><td>' + toA + '</td><td>' + toB + '</td></tr>');
  });
  o('<tr class="total-row">');
  o('<td>TOTAL</td><td>' + totScA + '</td><td>' + totScB + '</td>');
  o('<td>' + totWA + '</td><td>' + totWB + '</td><td>' + matchWinner + ' WINS (' + sA + '–' + sB + ')</td>');
  o('<td>' + (totDur ? totDur + ' mn' : '—') + '</td>');
  o('<td>' + totSA + '</td><td>' + totSB + '</td><td>' + totTA + '</td><td>' + totTB + '</td></tr>');
  o('</table>');

  o('<div class="info-band">');
  o('<div class="info-cell"><div class="lbl">Match Start</div><div class="val">' + fmtTime(G.playStartedAt || G.startTime || G.createdAt) + '</div></div>');
  o('<div class="info-cell"><div class="lbl">Match End</div><div class="val">' + fmtTime(G.finishedAt || G.matchEndTime || G.endTime) + '</div></div>');
  o(
    '<div class="info-cell"><div class="lbl">Total Duration</div><div class="val">' +
      (startMs && endMs ? fmtDur(endMs - startMs) : startMs ? fmtDur(Date.now() - startMs) : '—') +
      '</div></div>'
  );
  if (G.coinToss && G.coinToss.firstServer) {
    const fs = G.coinToss.firstServer === 'A' ? tA : tB;
    o(
      '<div class="info-cell"><div class="lbl">Coin Toss — 1st Serve</div><div class="val">' +
        val(fs) +
        '</div></div>'
    );
  }
  o('</div>');
  o('<div class="winner-box">🏆 MATCH WINNER: ' + matchWinner + ' &nbsp;|&nbsp; Sets: ' + sA + ' – ' + sB + '</div>');

  const libA = ((G.teams.A && G.teams.A.players) || []).filter((p) => p.role === 'libero1' || p.role === 'libero2');
  const libB = ((G.teams.B && G.teams.B.players) || []).filter((p) => p.role === 'libero1' || p.role === 'libero2');
  if (libA.length || libB.length) {
    o('<div class="sec purple">LIBERO PLAYERS — MATCH SUMMARY</div>');
    o('<table>');
    o('<tr><th>TEAM</th><th>DESIGNATION</th><th>#</th><th>NAME</th><th>TOTAL ENTRIES (ALL SETS)</th></tr>');
    [...libA.map((p) => ({ p, team: 'A' })), ...libB.map((p) => ({ p, team: 'B' }))].forEach(({ p, team }) => {
      const cnt = allLiberoEvents.filter((e) => {
        if (e.team !== team) return false;
        if (String(e.type || '').toUpperCase() === 'LIBERO_REPLACEMENT') {
          return String(e.liberoJersey || '') === String(p.jersey);
        }
        return val(e.description).indexOf('#' + p.jersey) >= 0;
      }).length;
      o('<tr style="background:#f5eeff">');
      o('<td>' + tname(team) + '</td>');
      o('<td class="lib-in">' + (p.role === 'libero1' ? 'Libero 1 (Active)' : 'Libero 2 (Reserve)') + '</td>');
      o('<td class="lib-in"><b>' + val(p.jersey) + '</b></td>');
      o('<td class="left lib-in">' + val(p.name) + '</td>');
      o('<td>' + cnt + '</td></tr>');
    });
    o('</table>');
    o('<div style="font-size:8.5px;color:#555;margin-bottom:4px;padding:2px 4px;border:1px solid #ddd">');
    o('Per FIVB rules: Libero replacements are <b>unlimited</b> and do <b>not</b> count as regular substitutions. ');
    o('Libero may only replace back-row players. Libero cannot serve (unless team opts into Libero Serving Rule).');
    o('</div>');
  }

  if (allSanctions.length) {
    o('<div class="sec red">SANCTIONS RECORD — ENTIRE MATCH</div>');
    o('<table>');
    o('<tr><th>SET</th><th>TEAM</th><th>SCORE</th><th>PERSON</th><th>TYPE</th><th>REASON / NOTES</th></tr>');
    allSanctions.forEach((s) => {
      let sc = '—';
      if (s.score && typeof s.score === 'object') {
        const myQ = s.team === 'A' ? s.score.A : s.score.B;
        const oppQ = s.team === 'A' ? s.score.B : s.score.A;
        sc = myQ + '-' + oppQ;
      }
      o('<tr><td>Set ' + (s.set || '?') + '</td><td>' + tname(s.team) + '</td><td>' + sc + '</td>');
      o('<td>' + val(s.person) + '</td><td>' + sanctionLabel(s.type) + '</td><td class="left">' + val(s.reason) + '</td></tr>');
    });
    o('</table>');
  }

  o('<div class="sec">IMPROPER REQUESTS</div>');
  o('<table><tr><th>TEAM A</th><th>TEAM B</th></tr><tr><td style="height:10px"></td><td></td></tr></table>');

  o('<div class="sec">REMARKS</div>');
  o('<div style="border:1px solid #bbb;padding:3px 5px;min-height:10mm;font-size:9px">' + val(G.remarks || G.notes || '') + '</div>');

  G.sets.forEach((set, si) => {
    const setNum = si + 1;
    const sc = set.score || { A: 0, B: 0 };
    const scA = sc.A || 0;
    const scB = sc.B || 0;
    const firstSrv = set.firstServer || set.serving || 'A';
    const slA = set.startingLineup?.A || set.lineupA || [];
    const slB = set.startingLineup?.B || set.lineupB || [];
    const lineupA =
      slA.filter(Boolean).length === 6 ? slA : si === 0 ? (G.teams?.A?.lineup || []) : [];
    const lineupB =
      slB.filter(Boolean).length === 6 ? slB : si === 0 ? (G.teams?.B?.lineup || []) : [];
    const subA = (set.substitutions && set.substitutions.A) || [];
    const subB = (set.substitutions && set.substitutions.B) || [];
    const toA = (set.timeouts && set.timeouts.A) || [];
    const toB = (set.timeouts && set.timeouts.B) || [];

    const libEvts = allLiberoEvents.filter((e) => Number(e.setNumber) === setNum);
    const libEvtsA = libEvts.filter((e) => e.team === 'A');
    const libEvtsB = libEvts.filter((e) => e.team === 'B');

    const excEvts = (G.matchSummary || []).filter((e) => isExceptionalEvent(e) && Number(e.setNumber) === setNum);
    const setSancs = allSanctions.filter((s) => s.set === setNum);

    o('<div class="newpage">');

    o('<div class="set-hdr">');
    o('<h2>SET ' + setNum + ' &nbsp;—&nbsp; ' + tA + ' vs ' + tB + '</h2>');
    o(
      '<p>Start: ' +
        fmtTime(set.startTime || set.setClockStartedAt) +
        ' &nbsp;|&nbsp; End: ' +
        fmtTime(set.endTime) +
        ' &nbsp;|&nbsp; Duration: ' +
        fmtDur(tsToMs(set.endTime) - tsToMs(set.startTime || set.setClockStartedAt)) +
        '</p>'
    );
    o('</div>');

    o('<div class="score-row">');
    o('<div class="score-cell sa"><div class="pts" style="color:#9b0030">' + scA + '</div><div class="tnm">' + tA + '</div></div>');
    o('<div class="score-cell sb"><div class="pts" style="color:#004f8a">' + scB + '</div><div class="tnm">' + tB + '</div></div>');
    o('</div>');
    if (set.winner) o('<div class="sw">SET WINNER: ' + (set.winner === 'A' ? tA : tB) + '</div>');

    o(
      '<div class="info-band"><div class="info-cell"><div class="lbl">First Service This Set</div><div class="val">' +
        val(firstSrv === 'A' ? tA : tB) +
        '</div></div></div>'
    );

    const posNames = [
      'P1 – Right Back',
      'P2 – Right Front',
      'P3 – Middle Front',
      'P4 – Left Front',
      'P5 – Left Back',
      'P6 – Middle Back'
    ];
    o('<div class="sec">STARTING LINEUP</div>');
    o('<table>');
    o('<tr><th>POSITION</th>');
    o('<th>' + tA + ' #</th><th>' + tA + ' NAME</th><th>ROLE</th>');
    o('<th>' + tB + ' #</th><th>' + tB + ' NAME</th><th>ROLE</th></tr>');
    for (let p = 0; p < 6; p++) {
      const jA = lineupA[p];
      const jB = lineupB[p];
      const rA = jA ? playerRole('A', jA) : '';
      const rB = jB ? playerRole('B', jB) : '';
      const isLibA = rA === 'libero1' || rA === 'libero2';
      const isLibB = rB === 'libero1' || rB === 'libero2';
      const isCapA = rA === 'captain';
      const isCapB = rB === 'captain';
      const styleA = isLibA ? 'class="lib-in"' : isCapA ? 'style="font-weight:bold"' : '';
      const styleB = isLibB ? 'class="lib-in"' : isCapB ? 'style="font-weight:bold"' : '';
      o('<tr>');
      o('<td style="font-size:8.5px;color:#555;text-align:left">' + posNames[p] + '</td>');
      o('<td ' + styleA + '>' + val(jA || '—') + '</td>');
      o(
        '<td class="left" ' +
          styleA +
          '>' +
          (jA ? val(playerName('A', jA)) : '—') +
          (isLibA ? roleBadge(rA) : isCapA ? roleBadge(rA) : '') +
          '</td>'
      );
      o('<td ' + (isLibA ? 'class="lib-in"' : '') + '>' + (isLibA ? (rA === 'libero1' ? 'L1' : 'L2') : isCapA ? 'C' : '') + '</td>');
      o('<td ' + styleB + '>' + val(jB || '—') + '</td>');
      o(
        '<td class="left" ' +
          styleB +
          '>' +
          (jB ? val(playerName('B', jB)) : '—') +
          (isLibB ? roleBadge(rB) : isCapB ? roleBadge(rB) : '') +
          '</td>'
      );
      o('<td ' + (isLibB ? 'class="lib-in"' : '') + '>' + (isLibB ? (rB === 'libero1' ? 'L1' : 'L2') : isCapB ? 'C' : '') + '</td>');
      o('</tr>');
    }
    o('</table>');

    o(
      '<div class="sec orange">SUBSTITUTIONS — ' +
        tA +
        ': ' +
        subA.length +
        '/' +
        (mi.subLimit || 6) +
        ' &nbsp;|&nbsp; ' +
        tB +
        ': ' +
        subB.length +
        '/' +
        (mi.subLimit || 6) +
        '</div>'
    );
    const allSubs = [];
    subA.forEach((s) => allSubs.push({ team: 'A', d: s }));
    subB.forEach((s) => allSubs.push({ team: 'B', d: s }));
    if (!allSubs.length) {
      o('<p class="nodata">No substitutions in this set.</p>');
    } else {
      o('<table>');
      o('<tr><th>#</th><th>TEAM</th><th>OUT # — Name</th><th>IN # — Name</th><th>SCORE</th><th>POS</th></tr>');
      allSubs.forEach((sub, i) => {
        const s = sub.d;
        const outJ = s.playerOut || '?';
        const inJ = s.playerIn || '?';
        o('<tr>');
        o('<td>' + (i + 1) + '</td>');
        o('<td>' + tname(sub.team) + '</td>');
        o('<td class="left">#' + outJ + ' ' + val(playerName(sub.team, outJ)) + '</td>');
        o('<td class="left">#' + inJ + ' ' + val(playerName(sub.team, inJ)) + '</td>');
        let subSc = '—';
        if (s.score && typeof s.score === 'object') {
          const myS = sub.team === 'A' ? s.score.A : s.score.B;
          const oppS = sub.team === 'A' ? s.score.B : s.score.A;
          subSc = myS + '–' + oppS;
        }
        o('<td>' + subSc + '</td>');
        o('<td>' + val(s.position || '—') + '</td></tr>');
      });
      o('</table>');
    }

    o('<div class="sec orange">TIMEOUTS — ' + tA + ': ' + toA.length + '/2 &nbsp;|&nbsp; ' + tB + ': ' + toB.length + '/2</div>');
    const allTOs = [];
    toA.forEach((t, i) => allTOs.push({ n: i + 1, team: 'A', d: t }));
    toB.forEach((t, i) => allTOs.push({ n: i + 1, team: 'B', d: t }));
    if (!allTOs.length) {
      o('<p class="nodata">No timeouts in this set.</p>');
    } else {
      o('<table>');
      o('<tr><th>#</th><th>TEAM</th><th>SCORE (A–B) WHEN CALLED</th></tr>');
      allTOs.forEach((to) => {
        let sc2 = '—';
        if (to.d && to.d.score && typeof to.d.score === 'object') {
          const myT = to.team === 'A' ? to.d.score.A : to.d.score.B;
          const oppT = to.team === 'A' ? to.d.score.B : to.d.score.A;
          sc2 = myT + '–' + oppT;
        }
        o('<tr><td>' + to.n + '</td><td>' + tname(to.team) + '</td><td>' + sc2 + '</td></tr>');
      });
      o('</table>');
    }

    o('<div class="sec purple">LIBERO TRACKING — SET ' + setNum + '</div>');

    o('<div style="font-size:8.5px;font-weight:bold;color:#5a0080;margin:2px 0 1px">Designated Libero Players</div>');
    if (!libA.length && !libB.length) {
      o('<p class="nodata">No libero players designated for this match.</p>');
    } else {
      o('<table>');
      o('<tr><th>TEAM</th><th>ROLE</th><th>#</th><th>NAME</th></tr>');
      libA.forEach((p) => {
        o(
          '<tr style="background:#f5eeff"><td>' +
            tA +
            '</td><td class="lib-in">' +
            (p.role === 'libero1' ? 'Libero 1' : 'Libero 2') +
            '</td><td class="lib-in"><b>' +
            val(p.jersey) +
            '</b></td><td class="left lib-in">' +
            val(p.name) +
            '</td></tr>'
        );
      });
      libB.forEach((p) => {
        o(
          '<tr style="background:#f5eeff"><td>' +
            tB +
            '</td><td class="lib-in">' +
            (p.role === 'libero1' ? 'Libero 1' : 'Libero 2') +
            '</td><td class="lib-in"><b>' +
            val(p.jersey) +
            '</b></td><td class="left lib-in">' +
            val(p.name) +
            '</td></tr>'
        );
      });
      o('</table>');
    }

    function liberoRowFromEvent(e) {
      const t = String(e.type || '').toUpperCase();
      if (t === 'LIBERO_REPLACEMENT') {
        const libJ = val(e.liberoJersey);
        const libP = (G.teams[e.team]?.players || []).find((x) => String(x.jersey) === String(libJ));
        const libNm = libP ? val(libP.name) : '?';
        const libRole = libP && (libP.role === 'libero1' || libP.role === 'libero2') ? (libP.role === 'libero1' ? 'L1' : 'L2') : 'L';
        const origJ = val(e.playerOutJersey);
        const origP = (G.teams[e.team]?.players || []).find((x) => String(x.jersey) === String(origJ));
        const origNm = origP ? val(origP.name) : '?';
        const pos = e.position != null ? 'P' + e.position : '—';
        const scb = e.score;
        let scoreStr = '—';
        if (scb && e.team) {
          const myQ = e.team === 'A' ? scb.A : scb.B;
          const oppQ = e.team === 'A' ? scb.B : scb.A;
          scoreStr = myQ + ':' + oppQ;
        }
        const timeStr = fmtTime(e.timestamp);
        return { timeStr, team: e.team, libJ, libNm, libRole, origJ, origNm, pos, scoreStr };
      }
      const desc = val(e.description);
      const libM = desc.match(/Libero #(\w+)\s*([^(]*)\(([^)]+)\)/);
      const repM = desc.match(/replaces #(\w+)\s+([^i]+?)\s+in P(\d+)/i);
      const scoreM = desc.match(/at (\d+:\d+)/);
      const libJ = libM ? libM[1] : '?';
      const libNm = libM ? libM[2].trim() : '?';
      const libRole = libM ? libM[3].trim() : '?';
      const origJ = repM ? repM[1] : '?';
      const origNm = repM ? repM[2].trim() : '?';
      const pos = repM ? 'P' + repM[3] : '—';
      const scoreStr = scoreM ? scoreM[1] : '—';
      return { timeStr: val(e.time) || fmtTime(e.timestamp), team: e.team, libJ, libNm, libRole, origJ, origNm, pos, scoreStr };
    }

    o('<div style="font-size:8.5px;font-weight:bold;color:#5a0080;margin:4px 0 1px">Libero Replacement Log — Set ' + setNum + '</div>');
    if (!libEvts.length) {
      o('<p class="nodata">No libero replacements recorded in this set.</p>');
    } else {
      o('<table>');
      o('<tr><th>TIME</th><th>TEAM</th><th>LIBERO IN (# Name — Role)</th><th>PLAYER OUT (# Name)</th><th>POSITION</th><th>SCORE (team:opp)</th></tr>');
      libEvts.forEach((e) => {
        const row = liberoRowFromEvent(e);
        o('<tr>');
        o('<td style="font-size:8.5px">' + row.timeStr + '</td>');
        o('<td>' + tname(row.team) + '</td>');
        o(
          '<td class="lib-in left">#' +
            row.libJ +
            ' ' +
            row.libNm +
            ' <b>(' +
            row.libRole +
            ')</b></td>'
        );
        o('<td class="lib-out left">#' + row.origJ + ' ' + row.origNm + '</td>');
        o('<td>' + row.pos + '</td>');
        o('<td>' + row.scoreStr + '</td>');
        o('</tr>');
      });
      o('</table>');
    }

    o('<div style="font-size:8.5px;font-weight:bold;color:#5a0080;margin:4px 0 1px">Libero Pairing Record — Set ' + setNum + ' (FIVB format)</div>');
    o('<table>');
    o('<tr><th>TEAM</th><th>LIBERO # — Name</th><th>REPLACED PLAYER # — Name</th><th>POSITION</th><th>TIMES PAIRED</th></tr>');
    let pairingsPrinted = false;
    ['A', 'B'].forEach((team) => {
      const pairMap = {};
      libEvts
        .filter((e) => e.team === team)
        .forEach((e) => {
          const row = liberoRowFromEvent(e);
          if (!row.libJ || row.libJ === '?') return;
          if (!pairMap[row.libJ]) {
            pairMap[row.libJ] = {
              libJ: row.libJ,
              libNm: row.libNm,
              libRole: row.libRole,
              origJ: row.origJ,
              origNm: row.origNm,
              pos: row.pos,
              count: 0
            };
          }
          pairMap[row.libJ].count++;
        });
      Object.keys(pairMap).forEach((libJ) => {
        const pr = pairMap[libJ];
        pairingsPrinted = true;
        o('<tr style="background:#f5eeff">');
        o('<td>' + tname(team) + '</td>');
        o('<td class="lib-in left">#' + pr.libJ + ' ' + pr.libNm + ' <b>(' + pr.libRole + ')</b></td>');
        o('<td class="lib-out left">#' + pr.origJ + ' ' + pr.origNm + '</td>');
        o('<td>' + pr.pos + '</td>');
        o('<td>' + pr.count + '</td></tr>');
      });
    });
    if (!pairingsPrinted) {
      o('<tr><td colspan="5" class="nodata">No libero pairings in this set.</td></tr>');
    }
    o('</table>');

    o('<div style="font-size:8.5px;background:#f0e8ff;border:1px solid #c0a0e0;padding:2px 5px;margin-bottom:4px">');
    o('<b style="color:#5a0080">Libero replacement count — Set ' + setNum + ':</b> &nbsp;');
    o(tA + ': <b>' + libEvtsA.length + '</b> &nbsp;&nbsp;&nbsp; ' + tB + ': <b>' + libEvtsB.length + '</b>');
    o('<span style="float:right;color:#777">Libero replacements are unlimited &amp; do not count as substitutions (FIVB rule)</span>');
    o('</div>');

    if (excEvts.length) {
      o('<div class="sec red">EXCEPTIONAL SUBSTITUTIONS — INJURY (Set ' + setNum + ')</div>');
      o('<table><tr><th>DETAILS</th></tr>');
      excEvts.forEach((e) => {
        o('<tr><td class="left">' + val(e.description || e.event) + '</td></tr>');
      });
      o('</table>');
    }

    if (setSancs.length) {
      o('<div class="sec red">SANCTIONS — SET ' + setNum + '</div>');
      o('<table><tr><th>TEAM</th><th>SCORE</th><th>PERSON</th><th>TYPE</th><th>REASON</th></tr>');
      setSancs.forEach((s) => {
        let sc2 = '—';
        if (s.score && typeof s.score === 'object') {
          const myP = s.team === 'A' ? s.score.A : s.score.B;
          const oppP = s.team === 'A' ? s.score.B : s.score.A;
          sc2 = myP + '-' + oppP;
        }
        o('<tr><td>' + tname(s.team) + '</td><td>' + sc2 + '</td><td>' + val(s.person) + '</td><td>' + sanctionLabel(s.type) + '</td><td class="left">' + val(s.reason) + '</td></tr>');
      });
      o('</table>');
    }

    o('</div>');
  });

  const sigs = (G.officials && G.officials.signatures) || {};
  function sigBox(label, name, imgKey) {
    o('<div class="sig-box"><div class="slbl">' + label + '</div><div class="sname">' + val(name) + '</div>');
    if (sigs[imgKey]) o('<img src="' + sigs[imgKey] + '">');
    o('<div class="sline"></div></div>');
  }
  o('<div class="newpage">');
  o('<div class="sec">APPROVAL &amp; SIGNATURES</div>');
  o('<div class="sig-wrap">');
  sigBox('1st Referee', mi.ref1, 'firstRefSign');
  sigBox('2nd Referee', mi.ref2, 'secondRefSign');
  sigBox('Scorer', mi.scorer, 'scorerSign');
  sigBox('Asst. Scorer', mi.assistScorer, 'assistScorerSign');
  o('</div>');

  ['A', 'B'].forEach((team) => {
    const players = (G.teams[team] && G.teams[team].players) || [];
    const cap = players.find((p) => p.role === 'captain');
    const capName = cap ? '#' + cap.jersey + ' ' + cap.name : '—';
    const off = G.officials || {};
    const coach = (team === 'A' ? off.coachA : off.coachB) || '';
    const asst = (team === 'A' ? off.asstCoachA : off.asstCoachB) || '';
    o(
      '<div style="background:' +
        (team === 'A' ? '#fff0f3' : '#f0f5ff') +
        ';padding:2px 5px;font-size:9px;font-weight:bold;margin:3px 0 1px">'
    );
    o(
      (team === 'A' ? tA : tB) +
        ' — Captain: ' +
        capName +
        (coach ? ' | Coach: ' + coach : '') +
        (asst ? ' | Asst: ' + asst : '')
    );
    o('</div>');
    o('<div class="sig-wrap">');
    sigBox('Captain — Before Match', capName, 'captainSign' + team + '1');
    sigBox('Captain — After Match', capName, 'captainSign' + team + '2');
    sigBox('Coach', coach, 'coachSign' + team);
    o('</div>');
  });
  o('</div>');

  o('</body></html>');

  const win = window.open('', '_blank');
  if (!win) {
    window.alert('Pop-up blocked! Please allow pop-ups for this page.');
    return;
  }
  win.document.open();
  win.document.write(H.join(''));
  win.document.close();
}
