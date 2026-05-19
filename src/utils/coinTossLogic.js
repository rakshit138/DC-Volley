/**
 * Volleyball coin toss: winner picks one of serve / receive / side;
 * the complementary serve/receive is assigned to the other team;
 * the remaining option (usually side) is chosen by the loser unless winner chose side.
 */

export function getTossParties(winner) {
  const loser = winner === 'team1' ? 'team2' : 'team1';
  return { winner, loser };
}

export function getServeReceiveSetupTeams(winner, choice) {
  if (choice === 'serve') {
    return { serverSetupTeam: winner, receiverSetupTeam: getTossParties(winner).loser };
  }
  if (choice === 'receive') {
    const { loser } = getTossParties(winner);
    return { serverSetupTeam: loser, receiverSetupTeam: winner };
  }
  if (choice === 'side') {
    const { loser } = getTossParties(winner);
    return { serverSetupTeam: loser, receiverSetupTeam: winner };
  }
  return { serverSetupTeam: null, receiverSetupTeam: null };
}

export function getSideChooserSetupTeam(winner, choice) {
  if (choice === 'side') return winner;
  return getTossParties(winner).loser;
}

export function setupTeamToSide(setupTeam, teamAAssignment) {
  if (!teamAAssignment || !setupTeam) return null;
  return teamAAssignment === setupTeam ? 'A' : 'B';
}

export function getChoiceLabel(choice) {
  if (choice === 'serve') return 'Serve first';
  if (choice === 'receive') return 'Receive first';
  if (choice === 'side') return 'Choose side / court end';
  return '—';
}

/**
 * Pre-match setup toss (team1 / team2) with optional A/B court assignment.
 */
export function getSetupCoinTossOutcome(coinToss, { team1Name, team2Name }) {
  if (!coinToss?.winner || !coinToss?.choice) return null;

  const t1 = team1Name || 'Team 1';
  const t2 = team2Name || 'Team 2';
  const nameFor = (key) => (key === 'team1' ? t1 : t2);
  const { winner, loser } = getTossParties(coinToss.winner);
  const winnerName = nameFor(winner);
  const loserName = nameFor(loser);
  const { serverSetupTeam, receiverSetupTeam } = getServeReceiveSetupTeams(winner, coinToss.choice);
  const sideChooserSetupTeam = getSideChooserSetupTeam(winner, coinToss.choice);
  const sideChooserName = nameFor(sideChooserSetupTeam);

  const hasAssignment =
    coinToss.teamAAssignment &&
    coinToss.teamBAssignment &&
    coinToss.teamAAssignment !== coinToss.teamBAssignment;

  const teamAName = hasAssignment ? nameFor(coinToss.teamAAssignment) : null;
  const teamBName = hasAssignment ? nameFor(coinToss.teamBAssignment) : null;

  const firstServer = hasAssignment ? setupTeamToSide(serverSetupTeam, coinToss.teamAAssignment) : null;
  const servingTeamName = hasAssignment
    ? firstServer === 'A'
      ? teamAName
      : teamBName
    : nameFor(serverSetupTeam);
  const receivingTeamName = hasAssignment
    ? firstServer === 'A'
      ? teamBName
      : teamAName
    : nameFor(receiverSetupTeam);

  const courtSidesText = hasAssignment
    ? `Team A (${teamAName}) — Left | Team B (${teamBName}) — Right`
    : `${sideChooserName} will choose court side (Team A left / Team B right)`;

  const autoNote =
    coinToss.choice === 'side'
      ? `${loserName} serves first · ${winnerName} receives (automatic)`
      : `${winnerName} chose ${getChoiceLabel(coinToss.choice).toLowerCase()} · ${loserName} gets the other role (automatic)`;

  const sideNote =
    coinToss.choice === 'side'
      ? `${winnerName} chose court side below.`
      : `${sideChooserName} chooses court side (Team A left / Team B right) below.`;

  return {
    winnerName,
    loserName,
    choiceLabel: getChoiceLabel(coinToss.choice),
    servingTeamName,
    receivingTeamName,
    sideChooserName,
    courtSidesText,
    autoNote,
    sideNote,
    firstServer,
    teamAName,
    teamBName,
    firstServerLabel:
      firstServer === 'A' ? `Team A (${teamAName})` : firstServer === 'B' ? `Team B (${teamBName})` : null,
    serverSetupTeam,
    receiverSetupTeam,
    sideChooserSetupTeam
  };
}

export function getFirstServerForSetup(coinToss) {
  if (!coinToss?.winner || !coinToss?.choice || !coinToss.teamAAssignment) return 'A';
  const { serverSetupTeam } = getServeReceiveSetupTeams(coinToss.winner, coinToss.choice);
  return setupTeamToSide(serverSetupTeam, coinToss.teamAAssignment) || 'A';
}

/**
 * Deciding-set toss (teams A / B on court).
 */
export function getDecidingSetTossSummary({ tossWinner, choice, teamOnRefereeLeft, teamAName, teamBName, swapped }) {
  const aName = teamAName || 'Team A';
  const bName = teamBName || 'Team B';
  const winnerName = tossWinner === 'A' ? aName : bName;
  const loser = tossWinner === 'A' ? 'B' : 'A';
  const loserName = loser === 'A' ? aName : bName;

  let firstServer = tossWinner;
  if (choice === 'receive') {
    firstServer = loser;
  } else if (choice === 'side') {
    firstServer = loser;
  }

  const receive = firstServer === 'A' ? 'B' : 'A';
  const sideChooser = choice === 'side' ? tossWinner : loser;
  const sideChooserName = sideChooser === 'A' ? aName : bName;
  const courtLeftLabel = teamOnRefereeLeft === 'A' ? `${aName} (Team A)` : `${bName} (Team B)`;

  const choiceLabel = getChoiceLabel(choice);
  const autoLine =
    choice === 'side'
      ? `${loserName} serves · ${winnerName} receives (automatic)`
      : `${winnerName}: ${choiceLabel} · ${loserName}: ${choice === 'serve' ? 'Receive first' : 'Serve first'} (automatic)`;

  return {
    tossWinnerName: winnerName,
    choiceLabel,
    servingName: firstServer === 'A' ? aName : bName,
    receivingName: receive === 'A' ? aName : bName,
    courtLeftLabel,
    sideChooserName,
    autoLine,
    sideNote: swapped
      ? `${bName} on left (Team B slot), ${aName} on right (Team A slot) — display swap active`
      : `${aName} on left (Team A), ${bName} on right (Team B) · ${sideChooserName} chose court side`
  };
}
