/** Merge React top-level game fields into matchInfo for HTML-parity exports. */
export function normalizeExportGameData(gameData) {
  if (!gameData) return {};
  const mi = {
    ...(gameData.matchInfo || {}),
    teamAName: gameData.matchInfo?.teamAName || gameData.teamAName,
    teamBName: gameData.matchInfo?.teamBName || gameData.teamBName,
    competition: gameData.matchInfo?.competition || gameData.competition,
    matchNumber: gameData.matchInfo?.matchNumber || gameData.matchNumber,
    venue: gameData.matchInfo?.venue || gameData.venue,
    hall: gameData.matchInfo?.hall || gameData.venue,
    city: gameData.matchInfo?.city || gameData.city,
    countryCode: gameData.matchInfo?.countryCode || gameData.countryCode,
    division: gameData.matchInfo?.division || gameData.division,
    category: gameData.matchInfo?.category || gameData.category,
    pool: gameData.matchInfo?.pool || gameData.pool,
    date: gameData.matchInfo?.date || gameData.matchDate,
    time: gameData.matchInfo?.time || gameData.matchTime,
    format: gameData.matchInfo?.format || gameData.format,
    ref1: gameData.matchInfo?.ref1 || gameData.officials?.ref1,
    ref2: gameData.matchInfo?.ref2 || gameData.officials?.ref2,
    scorer: gameData.matchInfo?.scorer || gameData.officials?.scorer,
    assistScorer: gameData.matchInfo?.assistScorer || gameData.officials?.assistScorer,
    logoA: gameData.matchInfo?.logoA || gameData.teams?.A?.logoData,
    logoB: gameData.matchInfo?.logoB || gameData.teams?.B?.logoData
  };
  return { ...gameData, matchInfo: mi };
}
