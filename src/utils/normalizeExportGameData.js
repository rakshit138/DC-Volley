import { firestoreTimeToDate } from './firestoreTime.js';
import { SUBSTITUTION_LIMIT } from './matchRules.js';

function exportDate(value) {
  return firestoreTimeToDate(value) || value || null;
}

function eventClock(event) {
  if (event?.time) return event.time;
  const date = firestoreTimeToDate(event?.timestamp);
  if (!date) return '';
  return [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
}

function sourcePointEvent(event) {
  const type = String(event?.type || '').toUpperCase();
  if (type !== 'POINT' && type !== 'PT') return event;
  const score = event.score || {};
  const scoreText = `Score: ${score.A ?? 0}-${score.B ?? 0}`;
  const description = String(event.description || '');
  return {
    ...event,
    type: 'Pt',
    setNumber: Number(event.setNumber ?? event.set ?? 1),
    time: eventClock(event),
    description: description.includes('Score:') ? description : `${description}${description ? ' - ' : ''}${scoreText}`
  };
}

function sourceSanctions(gameData) {
  if (
    gameData.sanctions &&
    Object.values(gameData.sanctions).some((entries) => Array.isArray(entries) && entries.length > 0)
  ) {
    return gameData.sanctions;
  }
  const output = { A: [], B: [] };
  const system = gameData.sanctionSystem || {};
  const misconductType = {
    W: 'misconduct_warning',
    P: 'misconduct_penalty',
    EXP: 'misconduct_expulsion',
    DISQ: 'misconduct_disqualification'
  };
  const delayType = { DW: 'delay', DP: 'delay_penalty' };

  ['A', 'B'].forEach((team) => {
    (system.misconduct?.[team] || []).forEach((entry) => {
      output[team].push({
        ...entry,
        type: misconductType[entry.type] || entry.type,
        player: entry.personType === 'coach' ? 'Team' : entry.person,
        set: entry.set ?? entry.setNumber,
        score: entry.score || {}
      });
    });
    (system.delay?.[team]?.log || []).forEach((entry) => {
      output[team].push({
        ...entry,
        type: delayType[entry.type] || entry.type,
        player: 'Team',
        set: entry.set ?? entry.setNumber,
        score: entry.score || {}
      });
    });
    output[team].sort((left, right) => {
      const leftDate = firestoreTimeToDate(left.time || left.timestamp);
      const rightDate = firestoreTimeToDate(right.time || right.timestamp);
      if (!leftDate || !rightDate) return 0;
      return leftDate.getTime() - rightDate.getTime();
    });
  });
  return output;
}

/** Merge Firebase fields into the exact data shape consumed by the source HTML PDF functions. */
export function normalizeExportGameData(gameData) {
  if (!gameData) return {};
  const mi = {
    ...(gameData.matchInfo || {}),
    teamAName: gameData.matchInfo?.teamAName || gameData.teamAName,
    teamBName: gameData.matchInfo?.teamBName || gameData.teamBName,
    competition: gameData.matchInfo?.competition || gameData.competition,
    matchNumber: gameData.matchInfo?.matchNumber || gameData.matchNumber,
    venue: gameData.matchInfo?.venue || gameData.venue,
    hall: gameData.matchInfo?.hall || gameData.matchInfo?.venue || gameData.venue,
    city: gameData.matchInfo?.city || gameData.city,
    countryCode: gameData.matchInfo?.countryCode || gameData.countryCode,
    division: gameData.matchInfo?.division || gameData.division,
    category: gameData.matchInfo?.category || gameData.category,
    pool: gameData.matchInfo?.pool || gameData.pool,
    date: gameData.matchInfo?.date || gameData.matchInfo?.matchDate || gameData.matchDate,
    time: gameData.matchInfo?.time || gameData.matchInfo?.matchTime || gameData.matchTime,
    format: gameData.matchInfo?.format || gameData.format,
    subLimit: SUBSTITUTION_LIMIT,
    ref1: gameData.matchInfo?.ref1 || gameData.officials?.ref1,
    ref2: gameData.matchInfo?.ref2 || gameData.officials?.ref2,
    scorer: gameData.matchInfo?.scorer || gameData.officials?.scorer,
    assistScorer: gameData.matchInfo?.assistScorer || gameData.officials?.assistScorer,
    logoA: gameData.matchInfo?.logoA || gameData.teams?.A?.logoData,
    logoB: gameData.matchInfo?.logoB || gameData.teams?.B?.logoData
  };

  const matchSummary = (gameData.matchSummary || []).map(sourcePointEvent);
  const pointEventsBySet = new Map();
  matchSummary.forEach((event) => {
    if (event?.type !== 'Pt' || (event.team !== 'A' && event.team !== 'B')) return;
    const setNumber = Number(event.setNumber || event.set || 1);
    if (!pointEventsBySet.has(setNumber)) pointEventsBySet.set(setNumber, []);
    pointEventsBySet.get(setNumber).push(event.team);
  });

  const format = Number(mi.format) || 3;
  const decidingSetIndex = format === 5 ? 4 : 2;
  const sets = (gameData.sets || []).map((set, index) => {
    if (!set) return set;
    const storedRallyLog = Array.isArray(set.rallyLog) && set.rallyLog.every((team) => team === 'A' || team === 'B')
      ? set.rallyLog
      : null;
    const startingLineup = set.startingLineup || {};
    const firstServer =
      set.firstServer ||
      (index === 0 ? gameData.coinToss?.firstServer : null) ||
      (index === decidingSetIndex ? gameData.decidingSetToss?.firstServer : null) ||
      set.serving;
    return {
      ...set,
      firstServer,
      lineupA: set.lineupA || startingLineup.A || [],
      lineupB: set.lineupB || startingLineup.B || [],
      rallyLog: storedRallyLog || pointEventsBySet.get(index + 1) || [],
      startTime: exportDate(set.startTime || set.setClockStartedAt),
      endTime: exportDate(set.endTime)
    };
  });

  return {
    ...gameData,
    subLimit: SUBSTITUTION_LIMIT,
    startTime: exportDate(gameData.startTime || gameData.playStartedAt || gameData.createdAt),
    matchInfo: mi,
    matchSummary,
    sanctions: sourceSanctions(gameData),
    sets
  };
}
