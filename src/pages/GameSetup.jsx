import { useState, useRef, useEffect } from 'react';
import { ensurePrepSessionStart } from '../utils/setupSession';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { createGame } from '../services/gameService';
import { generateGameCode } from '../utils/generateCode';
import {
  saveRosterToLocalStorage,
  getSavedRosters,
  loadRosterFromLocalStorage,
  exportRosterAsJSON,
  importRosterFromJSON,
  createRosterData,
  saveTeamRostersToFirebase,
  saveSingleTeamRosterToFirebase,
  listTeamRostersFromFirebase,
  buildLocalSavedTeamSlots
} from '../utils/rosterStorage';
import './GameSetup.css';
import OfficialsModal from '../components/OfficialsModal';

export default function GameSetup() {
  const { setGameCode } = useGame();
  const navigate = useNavigate();

  // Match Information
  const [matchInfo, setMatchInfo] = useState({
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().slice(0, 5),
    city: '',
    countryCode: '',
    division: '',
    category: '',
    pool: '',
    competition: 'FIVB Championship 2026',
    matchNumber: 'M-001',
    venue: 'National Stadium',
    format: '3', // Best of 3
    subLimit: '6'
  });

  // Match Officials
  const [officials, setOfficials] = useState({
    ref1: '',
    ref2: '',
    scorer: '',
    assistScorer: ''
  });

  // Team Setup
  const [team1, setTeam1] = useState({
    name: 'Warriors',
    color: '#ff6b6b',
    liberoCanServe: false
  });
  const [team2, setTeam2] = useState({
    name: 'Eagles',
    color: '#4ecdc4',
    liberoCanServe: false
  });

  // Coin Toss
  const [coinToss, setCoinToss] = useState({
    winner: '', // 'team1' or 'team2'
    choice: '', // 'serve', 'receive', 'side'
    teamAAssignment: '', // 'team1' or 'team2'
    teamBAssignment: '' // 'team1' or 'team2'
  });

  // Team Rosters (up to 14 players each)
  const [roster1, setRoster1] = useState(Array(14).fill(null).map((_, i) => ({
    jersey: '',
    name: '',
    role: 'player' // 'player', 'captain', 'libero1', 'libero2'
  })));
  const [roster2, setRoster2] = useState(Array(14).fill(null).map((_, i) => ({
    jersey: '',
    name: '',
    role: 'player'
  })));

  // Starting Lineups (by team 1 / team 2, mapped to A/B after coin toss)
  const [lineup1, setLineup1] = useState(Array(6).fill(null)); // P1-P6 for team 1
  const [lineup2, setLineup2] = useState(Array(6).fill(null)); // P1-P6 for team 2
  // Click-player-then-position flow (like HTML): liberos cannot be in starting lineup
  const [selectedPlayerForLineup, setSelectedPlayerForLineup] = useState(null); // { side: 'A'|'B', jersey }

  // Libero Serve Configuration (which player libero can serve for)
  const [liberoServeConfig, setLiberoServeConfig] = useState({
    A: { enabled: false, designatedJersey: null },
    B: { enabled: false, designatedJersey: null }
  });

  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rosterToast, setRosterToast] = useState('');
  const [savedRosters, setSavedRosters] = useState({});
  const [showLoadRosterModal, setShowLoadRosterModal] = useState(false);
  /** Fix #1: gate roster loads — user picks Team 1 / Team 2 / both before applying data */
  const [rosterTeamLoadContext, setRosterTeamLoadContext] = useState(null);
  /** Fix #1: modal list of all saved teams (local + Firebase) for Team 1 / Team 2 independently */
  const [savedTeamPicker, setSavedTeamPicker] = useState(null);
  const fileInputRef = useRef(null);
  /** Captains / coaches / signatures from OfficialsModal (step 6) */
  const [officialsSheet, setOfficialsSheet] = useState(null);

  const updateRoster = (team, index, field, value) => {
    if (team === 1) {
      const newRoster = [...roster1];
      newRoster[index] = { ...newRoster[index], [field]: value };
      setRoster1(newRoster);
    } else {
      const newRoster = [...roster2];
      newRoster[index] = { ...newRoster[index], [field]: value };
      setRoster2(newRoster);
    }
  };

  // Load saved rosters on mount
  useEffect(() => {
    setSavedRosters(getSavedRosters());
  }, []);

  useEffect(() => {
    ensurePrepSessionStart();
  }, []);

  const handleSaveRoster = async () => {
    try {
      const rosterData = createRosterData(
        { ...matchInfo, team1Name: team1.name, team2Name: team2.name },
        {
          team1: { players: roster1.filter(p => p.jersey && p.name), name: team1.name },
          team2: { players: roster2.filter(p => p.jersey && p.name), name: team2.name }
        },
        officials
      );
      
      // Save to localStorage
      const rosterId = saveRosterToLocalStorage(rosterData);
      
      // Also export as JSON file
      const filename = exportRosterAsJSON(rosterData);
      await saveTeamRostersToFirebase(team1.name, team2.name, rosterData);
      
      setRosterToast(`✅ Roster saved! File: ${filename} (synced to Firebase)`);
      setTimeout(() => setRosterToast(''), 5000);
      setSavedRosters(getSavedRosters());
    } catch (err) {
      setRosterToast(`❌ Error: ${err.message}`);
      setTimeout(() => setRosterToast(''), 5000);
    }
  };

  const getTeamPlayersForSave = (teamNum) => {
    const roster = teamNum === 1 ? roster1 : roster2;
    return roster
      .filter((p) => p.jersey && p.name)
      .map((p) => ({ jersey: p.jersey, name: p.name, role: p.role || 'player' }));
  };

  const handleSaveTeamRoster = async (teamNum) => {
    try {
      const teamName = teamNum === 1 ? team1.name : team2.name;
      const players = getTeamPlayersForSave(teamNum);
      await saveSingleTeamRosterToFirebase(teamName, players);
      setRosterToast(`✅ ${teamName || `Team ${teamNum}`} roster saved to Firebase`);
      setTimeout(() => setRosterToast(''), 5000);
    } catch (err) {
      setRosterToast(`❌ ${err.message}`);
      setTimeout(() => setRosterToast(''), 6000);
    }
  };

  const handleDownloadTeamRoster = (teamNum) => {
    const teamName = teamNum === 1 ? team1.name : team2.name;
    const players = getTeamPlayersForSave(teamNum);
    const rosterData = createRosterData(
      { ...matchInfo, team1Name: team1.name, team2Name: team2.name },
      teamNum === 1
        ? { team1: { players, name: team1.name }, team2: { players: [], name: team2.name } }
        : { team1: { players: [], name: team1.name }, team2: { players, name: team2.name } },
      officials
    );
    exportRosterAsJSON(rosterData, `Roster_${teamName || `Team${teamNum}`}_${new Date().toISOString().split('T')[0]}.json`);
    setRosterToast(`✅ Downloaded roster JSON for ${teamName || `Team ${teamNum}`}`);
    setTimeout(() => setRosterToast(''), 5000);
  };

  // Fix #1: apply JSON payload to one or both teams after user picks scope in modal
  const applyRosterPayload = (loadedData, scope, { closeSavedModal = false } = {}) => {
    if (!loadedData) return;
    try {
      if (loadedData.matchInfo && (scope === 'both' || scope === '1' || scope === '2')) {
        setMatchInfo((prev) => ({
          ...prev,
          competition: loadedData.matchInfo.competition || prev.competition,
          venue: loadedData.matchInfo.venue || prev.venue
        }));
      }
      if ((scope === 'both' || scope === '1') && loadedData.teams?.team1) {
        setTeam1((prev) => ({ ...prev, name: loadedData.matchInfo?.team1Name || prev.name }));
        const team1Players = loadedData.teams.team1.players || [];
        const newRoster1 = Array(14)
          .fill(null)
          .map((_, i) => team1Players[i] || { jersey: '', name: '', role: 'player' });
        setRoster1(newRoster1);
      }
      if ((scope === 'both' || scope === '2') && loadedData.teams?.team2) {
        setTeam2((prev) => ({ ...prev, name: loadedData.matchInfo?.team2Name || prev.name }));
        const team2Players = loadedData.teams.team2.players || [];
        const newRoster2 = Array(14)
          .fill(null)
          .map((_, i) => team2Players[i] || { jersey: '', name: '', role: 'player' });
        setRoster2(newRoster2);
      }
      if (scope === 'both' && loadedData.officials) {
        setOfficials((prev) => ({ ...prev, ...loadedData.officials }));
      }
      setRosterToast('✅ Roster data applied');
      setTimeout(() => setRosterToast(''), 5000);
      setRosterTeamLoadContext(null);
      if (closeSavedModal) setShowLoadRosterModal(false);
    } catch (err) {
      setRosterToast(`❌ Error: ${err.message}`);
      setTimeout(() => setRosterToast(''), 5000);
    }
  };

  const handleLoadRosterFromFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const loadedData = await importRosterFromJSON(file);
      setRosterTeamLoadContext({ kind: 'file', data: loadedData });
      e.target.value = '';
    } catch (err) {
      setRosterToast(`❌ Error: ${err.message}`);
      setTimeout(() => setRosterToast(''), 5000);
      e.target.value = '';
    }
  };

  const handleLoadRosterFromStorage = (rosterId) => {
    const loadedData = loadRosterFromLocalStorage(rosterId);
    if (!loadedData) {
      setRosterToast('❌ Roster not found');
      setTimeout(() => setRosterToast(''), 3000);
      return;
    }
    setRosterTeamLoadContext({ kind: 'saved', rosterId, data: loadedData });
  };

  // Fix #1: load cloud + local saved teams into one picker list
  const openSavedTeamPicker = async (forTeamNum) => {
    setSavedTeamPicker({ forTeamNum, loading: true, error: '', rows: [] });
    try {
      const fromCloud = await listTeamRostersFromFirebase();
      const localMap = getSavedRosters();
      const localRows = buildLocalSavedTeamSlots(localMap);
      const cloudRows = (fromCloud || [])
        .filter((r) => Array.isArray(r.players) && r.players.some((p) => p?.jersey && p?.name))
        .map((r) => ({
          key: `fb:${r.teamId}`,
          sourceLabel: 'Cloud',
          teamName: r.teamName || r.teamId || 'Team',
          players: r.players,
          subtitle: `${(r.players || []).length} players`
        }));
      const rows = [...cloudRows, ...localRows];
      setSavedTeamPicker({ forTeamNum, loading: false, error: '', rows });
    } catch (err) {
      const localRows = buildLocalSavedTeamSlots(getSavedRosters());
      setSavedTeamPicker({
        forTeamNum,
        loading: false,
        error: err?.message || 'Cloud list failed; showing local saves only.',
        rows: localRows
      });
    }
  };

  const applySavedTeamRow = (row) => {
    if (!savedTeamPicker || !row?.players) return;
    const n = savedTeamPicker.forTeamNum;
    const filled = Array(14)
      .fill(null)
      .map((_, i) => row.players[i] || { jersey: '', name: '', role: 'player' });
    if (n === 1) {
      setTeam1((prev) => ({ ...prev, name: row.teamName || prev.name }));
      setRoster1(filled);
    } else {
      setTeam2((prev) => ({ ...prev, name: row.teamName || prev.name }));
      setRoster2(filled);
    }
    setSavedTeamPicker(null);
    setRosterToast(`✅ Loaded saved team into Team ${n}`);
    setTimeout(() => setRosterToast(''), 5000);
  };

  // DC_Volley_patched_fixed_2.html — determineCoinTossOutcome() (Team 1 / Team 2 names, pre–A-B assignment)
  const getCoinTossResultLegacyStrings = () => {
    if (!coinToss.winner || !coinToss.choice) return null;
    const t1 = team1.name;
    const t2 = team2.name;
    const winner = coinToss.winner;
    const loser = winner === 'team1' ? 'team2' : 'team1';
    const winnerName = winner === 'team1' ? t1 : t2;
    const loserName = loser === 'team1' ? t1 : t2;
    let firstServer;
    let firstReceiver;
    let courtSides;
    if (coinToss.choice === 'serve') {
      firstServer = `${winnerName} (chose to serve)`;
      firstReceiver = loserName;
      courtSides = `${loserName} chooses their preferred side`;
    } else if (coinToss.choice === 'receive') {
      firstServer = loserName;
      firstReceiver = `${winnerName} (chose to receive)`;
      courtSides = `${loserName} chooses their preferred side`;
    } else if (coinToss.choice === 'side') {
      firstServer = `${loserName} (will serve first)`;
      firstReceiver = winnerName;
      courtSides = `${winnerName} chooses their preferred side`;
    } else {
      return null;
    }
    return { firstServer, firstReceiver, courtSides };
  };

  // Fix #3: inline coin toss panel summary (aligned with handleStartGame firstServer logic)
  const getCoinTossSummary = () => {
    if (!coinToss.teamAAssignment || !coinToss.teamBAssignment || coinToss.teamAAssignment === coinToss.teamBAssignment) {
      return null;
    }
    const t1 = team1.name;
    const t2 = team2.name;
    const winnerName = coinToss.winner === 'team1' ? t1 : coinToss.winner === 'team2' ? t2 : '—';
    const choiceLabel =
      coinToss.choice === 'serve'
        ? 'Serve first'
        : coinToss.choice === 'receive'
          ? 'Receive first'
          : coinToss.choice === 'side'
            ? 'Choose side / court end'
            : '—';
    const teamAName = coinToss.teamAAssignment === 'team1' ? t1 : t2;
    const teamBName = coinToss.teamBAssignment === 'team1' ? t1 : t2;
    let firstServer = 'A';
    if (coinToss.choice === 'serve') {
      firstServer = coinToss.winner === 'team1' && coinToss.teamAAssignment === 'team1' ? 'A' : 'B';
    } else if (coinToss.choice === 'receive') {
      firstServer = coinToss.winner === 'team1' && coinToss.teamAAssignment === 'team1' ? 'B' : 'A';
    }
    const servingTeamName = firstServer === 'A' ? teamAName : teamBName;
    const receivingTeamName = firstServer === 'A' ? teamBName : teamAName;
    const sideSelectedBy = coinToss.choice === 'side' ? winnerName : '—';
    const sideNote =
      coinToss.choice === 'side'
        ? 'Winner chose side; first serve defaults to Team A (left) per setup — adjust if your competition rules differ.'
        : null;
    return {
      winnerName,
      choiceLabel,
      teamAName,
      teamBName,
      servingTeamName,
      receivingTeamName,
      sideSelectedBy,
      firstServerLabel: firstServer === 'A' ? `Team A (${teamAName})` : `Team B (${teamBName})`,
      sideNote
    };
  };

  const validateRoster = (roster, teamLabel) => {
    const errors = [];
    const jerseys = roster.map((p) => String(p.jersey).trim()).filter(Boolean);
    for (const j of jerseys) {
      const num = parseInt(j, 10);
      if (isNaN(num) || num < 1 || num > 99) {
        errors.push(`${teamLabel}: Jersey must be a number between 1 and 99 (got "${j}").`);
      }
    }
    const seen = new Set();
    for (const j of jerseys) {
      if (seen.has(j)) errors.push(`${teamLabel}: Duplicate jersey #${j}.`);
      seen.add(j);
    }
    const captainCount = roster.filter((p) => p.role === 'captain').length;
    const liberoCaptainCount = roster.filter((p) => p.role === 'liberocaptain').length;
    if (captainCount > 1) errors.push(`${teamLabel}: Only one Captain allowed.`);
    if (liberoCaptainCount > 1) errors.push(`${teamLabel}: Only one Libero + Captain allowed.`);
    if (captainCount >= 1 && liberoCaptainCount >= 1) errors.push(`${teamLabel}: Cannot have both Captain and Libero + Captain. Choose one only.`);
    const libero1Count = roster.filter((p) => p.role === 'libero1').length;
    const libero2Count = roster.filter((p) => p.role === 'libero2').length;
    if (libero1Count > 1) errors.push(`${teamLabel}: Only one Libero 1 allowed.`);
    if (libero2Count > 1) errors.push(`${teamLabel}: Only one Libero 2 allowed.`);
    const totalLiberos = libero1Count + libero2Count + liberoCaptainCount;
    if (totalLiberos > 2) errors.push(`${teamLabel}: Maximum 2 liberos (Libero 1, Libero 2, Libero+Captain).`);
    return errors;
  };

  /** Returns { jerseyErrorIndices: Set, roleErrorIndices: Set } for a roster to show red borders while entering. */
  const getRosterErrorIndices = (roster) => {
    const jerseyErrorIndices = new Set();
    const roleErrorIndices = new Set();
    const jerseys = roster.map((p) => String(p.jersey).trim());
    roster.forEach((p, i) => {
      const j = jerseys[i];
      if (j) {
        const num = parseInt(j, 10);
        if (isNaN(num) || num < 1 || num > 99) jerseyErrorIndices.add(i);
        const dupIdx = jerseys.findIndex((x, idx) => idx !== i && x === j);
        if (dupIdx !== -1) {
          jerseyErrorIndices.add(i);
          jerseyErrorIndices.add(dupIdx);
        }
      }
    });
    const captainIndices = roster.map((p, i) => (p.role === 'captain' ? i : -1)).filter((i) => i >= 0);
    const liberocaptainIndices = roster.map((p, i) => (p.role === 'liberocaptain' ? i : -1)).filter((i) => i >= 0);
    const libero1Indices = roster.map((p, i) => (p.role === 'libero1' ? i : -1)).filter((i) => i >= 0);
    const libero2Indices = roster.map((p, i) => (p.role === 'libero2' ? i : -1)).filter((i) => i >= 0);
    if (captainIndices.length > 1) captainIndices.forEach((i) => roleErrorIndices.add(i));
    if (liberocaptainIndices.length > 1) liberocaptainIndices.forEach((i) => roleErrorIndices.add(i));
    if (captainIndices.length >= 1 && liberocaptainIndices.length >= 1) {
      captainIndices.forEach((i) => roleErrorIndices.add(i));
      liberocaptainIndices.forEach((i) => roleErrorIndices.add(i));
    }
    if (libero1Indices.length > 1) libero1Indices.forEach((i) => roleErrorIndices.add(i));
    if (libero2Indices.length > 1) libero2Indices.forEach((i) => roleErrorIndices.add(i));
    const totalLiberos = libero1Indices.length + libero2Indices.length + liberocaptainIndices.length;
    if (totalLiberos > 2) {
      [...libero1Indices, ...libero2Indices, ...liberocaptainIndices].forEach((i) => roleErrorIndices.add(i));
    }
    return { jerseyErrorIndices, roleErrorIndices };
  };


  const handleCoinTossChange = (field, value) => {
    let newCoinToss = { ...coinToss, [field]: value };
    if (field === 'teamAAssignment') {
      if (value) newCoinToss.teamBAssignment = value === 'team1' ? 'team2' : 'team1';
    }
    if (field === 'teamBAssignment') {
      if (value) newCoinToss.teamAAssignment = value === 'team1' ? 'team2' : 'team1';
    }
    if (field === 'winner' && value && newCoinToss.choice) {
      if (value === 'team1' && (newCoinToss.choice === 'serve' || newCoinToss.choice === 'receive')) {
        newCoinToss.teamAAssignment = 'team1';
        newCoinToss.teamBAssignment = 'team2';
      } else if (value === 'team2' && (newCoinToss.choice === 'serve' || newCoinToss.choice === 'receive')) {
        newCoinToss.teamAAssignment = 'team2';
        newCoinToss.teamBAssignment = 'team1';
      }
    }
    setCoinToss(newCoinToss);
  };

  const getTeamAssignment = () => {
    if (!coinToss.teamAAssignment || !coinToss.teamBAssignment) {
      return null;
    }

    const teamA = coinToss.teamAAssignment === 'team1' ? team1 : team2;
    const teamB = coinToss.teamBAssignment === 'team1' ? team1 : team2;
    const teamARoster = coinToss.teamAAssignment === 'team1' ? roster1 : roster2;
    const teamBRoster = coinToss.teamBAssignment === 'team1' ? roster1 : roster2;
    const teamALineup = coinToss.teamAAssignment === 'team1' ? lineup1 : lineup2;
    const teamBLineup = coinToss.teamBAssignment === 'team1' ? lineup1 : lineup2;

    return { teamA, teamB, teamARoster, teamBRoster, teamALineup, teamBLineup };
  };

  const validateLineup = (lineup, roster, teamLabel) => {
    const errors = [];
    const filled = lineup.filter(Boolean).map(String);
    const rosterJerseys = new Set((roster || []).filter(p => p.jersey).map(p => String(p.jersey)));
    const seen = new Set();
    for (const j of filled) {
      if (!rosterJerseys.has(j)) {
        errors.push(`${teamLabel}: Jersey #${j} in lineup is not in roster.`);
      }
      if (seen.has(j)) {
        errors.push(`${teamLabel}: Duplicate jersey #${j} in starting lineup (each position must be unique).`);
      }
      seen.add(j);
    }
    return errors;
  };

  const handleStartGame = async () => {
    setError('');
    const rosterErrors = [
      ...validateRoster(roster1, 'Team 1'),
      ...validateRoster(roster2, 'Team 2')
    ];
    if (rosterErrors.length > 0) {
      setError(rosterErrors.join(' '));
      return;
    }

    const assignment = getTeamAssignment();
    if (assignment) {
      const lineupErrors = [
        ...validateLineup(assignment.teamALineup, assignment.teamARoster, 'Team A'),
        ...validateLineup(assignment.teamBLineup, assignment.teamBRoster, 'Team B')
      ];
      if (lineupErrors.length > 0) {
        setError(lineupErrors.join(' '));
        return;
      }
    }

    setLoading(true);

    try {
      // Validate coin toss
      if (!coinToss.teamAAssignment || !coinToss.teamBAssignment) {
        throw new Error('Please complete coin toss and team assignment');
      }

      if (coinToss.teamAAssignment === coinToss.teamBAssignment) {
        throw new Error('Teams must be assigned to different sides');
      }

      // Get team assignments
      const assignment = getTeamAssignment();
      if (!assignment) {
        throw new Error('Invalid team assignment');
      }

      // Filter valid players from rosters
      const playersA = assignment.teamARoster
        .filter(p => p.jersey && p.name)
        .map(p => ({
          jersey: p.jersey,
          name: p.name,
          role: p.role
        }));

      const playersB = assignment.teamBRoster
        .filter(p => p.jersey && p.name)
        .map(p => ({
          jersey: p.jersey,
          name: p.name,
          role: p.role
        }));

      // Determine first server based on coin toss
      let firstServer = 'A';
      if (coinToss.choice === 'serve') {
        firstServer = coinToss.winner === 'team1' && coinToss.teamAAssignment === 'team1' ? 'A' : 'B';
      } else if (coinToss.choice === 'receive') {
        firstServer = coinToss.winner === 'team1' && coinToss.teamAAssignment === 'team1' ? 'B' : 'A';
      }

      // Generate game code
      let code = generateGameCode();
      let exists = await import('../services/gameService').then(m => m.getGameByCode(code));
      let attempts = 0;
      while (exists && attempts < 10) {
        code = generateGameCode();
        exists = await import('../services/gameService').then(m => m.getGameByCode(code));
        attempts++;
      }

      if (exists) {
        throw new Error('Unable to generate unique code. Please try again.');
      }

      const mergedOfficials = {
        ref1: officials.ref1,
        ref2: officials.ref2,
        scorer: officials.scorer,
        assistScorer: officials.assistScorer,
        coachA: officialsSheet?.coachA ?? '',
        asstCoachA: officialsSheet?.asstCoachA ?? '',
        medicalA: officialsSheet?.medicalA ?? '',
        trainerA: officialsSheet?.trainerA ?? '',
        coachB: officialsSheet?.coachB ?? '',
        asstCoachB: officialsSheet?.asstCoachB ?? '',
        medicalB: officialsSheet?.medicalB ?? '',
        trainerB: officialsSheet?.trainerB ?? '',
        signatures: officialsSheet?.signatures || {}
      };

      // Create game data
      const gameData = {
        teamAName: officialsSheet?.teamAName?.trim() || assignment.teamA.name,
        teamBName: officialsSheet?.teamBName?.trim() || assignment.teamB.name,
        teamAColor: assignment.teamA.color,
        teamBColor: assignment.teamB.color,
        format: parseInt(matchInfo.format),
        subLimit: parseInt(matchInfo.subLimit),
        competition: matchInfo.competition,
        matchNumber: matchInfo.matchNumber,
        venue: matchInfo.venue,
        city: matchInfo.city,
        countryCode: matchInfo.countryCode,
        division: matchInfo.division,
        category: matchInfo.category,
        pool: matchInfo.pool,
        matchDate: matchInfo.date,
        matchTime: matchInfo.time,
        officials: mergedOfficials,
        coinToss: {
          winner: coinToss.winner,
          choice: coinToss.choice,
          firstServer: firstServer
        },
        teams: {
          A: {
            players: playersA,
            lineup: assignment.teamALineup.map(p => p != null ? String(p) : null)
          },
          B: {
            players: playersB,
            lineup: assignment.teamBLineup.map(p => p != null ? String(p) : null)
          }
        },
        liberoServeConfig: {
          A: {
            enabled: liberoServeConfig.A.enabled,
            designatedJersey: liberoServeConfig.A.designatedJersey ? String(liberoServeConfig.A.designatedJersey) : null
          },
          B: {
            enabled: liberoServeConfig.B.enabled,
            designatedJersey: liberoServeConfig.B.designatedJersey ? String(liberoServeConfig.B.designatedJersey) : null
          }
        },
        sets: [{
          setNumber: 1,
          score: { A: 0, B: 0 },
          serving: firstServer,
          timeouts: { A: [], B: [] },
          substitutions: { A: [], B: [] },
          startingLineup: {
            A: assignment.teamALineup,
            B: assignment.teamBLineup
          }
          // startTime: set server-side in createGame when the match goes live (after officials)
        }]
      };

      await createGame(code, gameData);
      setGameCode(code);
      navigate('/display-select');
    } catch (err) {
      setError(err.message || 'Failed to create game');
      console.error('Error creating game:', err);
    } finally {
      setLoading(false);
    }
  };

  const assignment = getTeamAssignment();

  // Compute roster error indices for highlighting errors in the UI
  const rosterErrors1 = getRosterErrorIndices(roster1);
  const rosterErrors2 = getRosterErrorIndices(roster2);

  return (
    <div className="setup-container">
      <div className="setup-wrapper">
            <div className="setup-header">
          <h1>🏐 Game Setup</h1>
          <div className="setup-progress">
            <div className={`progress-step ${currentStep >= 1 ? 'active' : ''}`}>1. Match Info</div>
            <div className={`progress-step ${currentStep >= 2 ? 'active' : ''}`}>2. Teams</div>
            <div className={`progress-step ${currentStep >= 3 ? 'active' : ''}`}>3. Rosters</div>
            <div className={`progress-step ${currentStep >= 4 ? 'active' : ''}`}>4. Coin Toss</div>
                <div className={`progress-step ${currentStep >= 5 ? 'active' : ''}`}>5. Officials & start</div>
                <div className={`progress-step ${currentStep >= 6 ? 'active' : ''}`}>6. Lineups</div>
          </div>
        </div>

        {error && (
          <div className="setup-error">{error}</div>
        )}

        {/* Step 1: Match Information */}
        {currentStep === 1 && (
          <div className="setup-step">
            <h2>Match Information</h2>
            <div className="setup-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Date</label>
                  <input
                    type="date"
                    value={matchInfo.date}
                    onChange={(e) => setMatchInfo({ ...matchInfo, date: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Time</label>
                  <input
                    type="time"
                    value={matchInfo.time}
                    onChange={(e) => setMatchInfo({ ...matchInfo, time: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>City</label>
                  <input
                    type="text"
                    value={matchInfo.city}
                    onChange={(e) => setMatchInfo({ ...matchInfo, city: e.target.value })}
                    placeholder="Enter city name"
                  />
                </div>
                <div className="form-group">
                  <label>Country Code</label>
                  <input
                    type="text"
                    value={matchInfo.countryCode}
                    onChange={(e) => setMatchInfo({ ...matchInfo, countryCode: e.target.value.toUpperCase().slice(0, 3) })}
                    placeholder="e.g., IND, USA, BRA"
                    maxLength={3}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Division</label>
                  <select
                    value={matchInfo.division}
                    onChange={(e) => setMatchInfo({ ...matchInfo, division: e.target.value })}
                  >
                    <option value="">Select Division</option>
                    <option value="Men">Men</option>
                    <option value="Women">Women</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <select
                    value={matchInfo.category}
                    onChange={(e) => setMatchInfo({ ...matchInfo, category: e.target.value })}
                  >
                    <option value="">Select Category</option>
                    <option value="Youth">Youth</option>
                    <option value="Junior">Junior</option>
                    <option value="Senior">Senior</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Pool</label>
                <input
                  type="text"
                  value={matchInfo.pool}
                  onChange={(e) => setMatchInfo({ ...matchInfo, pool: e.target.value })}
                  placeholder="e.g., Pool A, Pool B"
                />
              </div>
              <div className="form-group">
                <label>Competition</label>
                <input
                  type="text"
                  value={matchInfo.competition}
                  onChange={(e) => setMatchInfo({ ...matchInfo, competition: e.target.value })}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Match Number</label>
                  <input
                    type="text"
                    value={matchInfo.matchNumber}
                    onChange={(e) => setMatchInfo({ ...matchInfo, matchNumber: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Venue</label>
                  <input
                    type="text"
                    value={matchInfo.venue}
                    onChange={(e) => setMatchInfo({ ...matchInfo, venue: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Format</label>
                  <select
                    value={matchInfo.format}
                    onChange={(e) => setMatchInfo({ ...matchInfo, format: e.target.value })}
                  >
                    <option value="3">Best of 3</option>
                    <option value="5">Best of 5</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Substitution Limit / Set</label>
                  <select
                    value={matchInfo.subLimit}
                    onChange={(e) => setMatchInfo({ ...matchInfo, subLimit: e.target.value })}
                  >
                    <option value="6">6 (FIVB Standard)</option>
                    <option value="8">8 (Optional)</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="setup-buttons">
              <button onClick={() => navigate('/')}>Cancel</button>
              <button onClick={() => setCurrentStep(2)}>Next →</button>
            </div>
          </div>
        )}

        {/* Step 2: Team Setup */}
        {currentStep === 2 && (
          <div className="setup-step">
            <h2>Team Setup</h2>
            <div className="setup-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Team 1 Name</label>
                  <input
                    type="text"
                    value={team1.name}
                    onChange={(e) => setTeam1({ ...team1, name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Team 1 Jersey Color</label>
                  <div className="color-input-group">
                    <input
                      type="color"
                      value={team1.color}
                      onChange={(e) => setTeam1({ ...team1, color: e.target.value })}
                    />
                    <span>Jersey color</span>
                  </div>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Team 2 Name</label>
                  <input
                    type="text"
                    value={team2.name}
                    onChange={(e) => setTeam2({ ...team2, name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Team 2 Jersey Color</label>
                  <div className="color-input-group">
                    <input
                      type="color"
                      value={team2.color}
                      onChange={(e) => setTeam2({ ...team2, color: e.target.value })}
                    />
                    <span>Jersey color</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="setup-buttons">
              <button onClick={() => setCurrentStep(1)}>← Back</button>
              <button onClick={() => setCurrentStep(3)}>Next →</button>
            </div>
          </div>
        )}

        {/* Step 3: Team Rosters (Team 1 and Team 2 directly) */}
        {currentStep === 3 && (
          <div className="setup-step">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2>Team Rosters</h2>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowLoadRosterModal(true);
                    setSavedRosters(getSavedRosters());
                  }}
                  style={{
                    padding: '8px 16px',
                    background: '#9c27b0',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '13px'
                  }}
                >
                  📂 Load Roster
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleLoadRosterFromFile}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    padding: '8px 16px',
                    background: '#4ecdc4',
                    color: '#000',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '13px'
                  }}
                >
                  📁 Load from File
                </button>
              </div>
            </div>
            <p className="setup-hint">Enter players for each team (up to 14). Jersey, name, and role.</p>
            <div className="roster-section">
              <div className="roster-team">
                <h3 style={{ color: '#ff6b6b' }}>Team 1 – {team1.name}</h3>
                <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => handleSaveTeamRoster(1)} style={{ padding: '7px 12px', background: '#00d9ff', color: '#000', border: 'none', borderRadius: 5, cursor: 'pointer', fontWeight: 'bold', fontSize: 12 }}>
                    💾 Save Team 1
                  </button>
                  <button type="button" onClick={() => openSavedTeamPicker(1)} style={{ padding: '7px 12px', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', fontWeight: 'bold', fontSize: 12 }}>
                    ☁ Choose saved team (Team 1)…
                  </button>
                  <button type="button" onClick={() => handleDownloadTeamRoster(1)} style={{ padding: '7px 12px', background: '#ffd700', color: '#000', border: 'none', borderRadius: 5, cursor: 'pointer', fontWeight: 'bold', fontSize: 12 }}>
                    ⬇ Download Team 1
                  </button>
                </div>
                <div className="roster-table-wrapper">
                  <table className="roster-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Jersey</th>
                        <th>Name</th>
                        <th>Role</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roster1.map((player, i) => (
                        <tr key={i}>
                          <td>{i + 1}</td>
                          <td>
                            <input
                              type="text"
                              className={`roster-input ${rosterErrors1.jerseyErrorIndices.has(i) ? 'roster-input-error' : ''}`}
                              value={player.jersey}
                              onChange={(e) => updateRoster(1, i, 'jersey', e.target.value)}
                              placeholder="#"
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              className="roster-input name-input"
                              value={player.name}
                              onChange={(e) => updateRoster(1, i, 'name', e.target.value)}
                              placeholder="Player Name"
                            />
                          </td>
                          <td>
                            <select
                              className={`roster-select ${rosterErrors1.roleErrorIndices.has(i) ? 'roster-input-error' : ''}`}
                              value={player.role}
                              onChange={(e) => updateRoster(1, i, 'role', e.target.value)}
                            >
                              <option value="player">Player</option>
                              <option value="captain">Captain</option>
                              <option value="libero1">Libero 1</option>
                              <option value="libero2">Libero 2</option>
                              <option value="liberocaptain">Libero + Captain</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <label className="roster-libero-serve" style={{ display: 'block', marginTop: 12, color: '#fff' }}>
                  <input
                    type="checkbox"
                    checked={team1.liberoCanServe === true}
                    onChange={(e) => setTeam1((t) => ({ ...t, liberoCanServe: e.target.checked }))}
                  />
                  <span style={{ marginLeft: 8 }}>Libero can serve</span>
                </label>
              </div>
              <div className="roster-team">
                <h3 style={{ color: '#4ecdc4' }}>Team 2 – {team2.name}</h3>
                <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => handleSaveTeamRoster(2)} style={{ padding: '7px 12px', background: '#00d9ff', color: '#000', border: 'none', borderRadius: 5, cursor: 'pointer', fontWeight: 'bold', fontSize: 12 }}>
                    💾 Save Team 2
                  </button>
                  <button type="button" onClick={() => openSavedTeamPicker(2)} style={{ padding: '7px 12px', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', fontWeight: 'bold', fontSize: 12 }}>
                    ☁ Choose saved team (Team 2)…
                  </button>
                  <button type="button" onClick={() => handleDownloadTeamRoster(2)} style={{ padding: '7px 12px', background: '#ffd700', color: '#000', border: 'none', borderRadius: 5, cursor: 'pointer', fontWeight: 'bold', fontSize: 12 }}>
                    ⬇ Download Team 2
                  </button>
                </div>
                <div className="roster-table-wrapper">
                  <table className="roster-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Jersey</th>
                        <th>Name</th>
                        <th>Role</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roster2.map((player, i) => (
                        <tr key={i}>
                          <td>{i + 1}</td>
                          <td>
                            <input
                              type="text"
                              className={`roster-input ${rosterErrors2.jerseyErrorIndices.has(i) ? 'roster-input-error' : ''}`}
                              value={player.jersey}
                              onChange={(e) => updateRoster(2, i, 'jersey', e.target.value)}
                              placeholder="#"
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              className="roster-input name-input"
                              value={player.name}
                              onChange={(e) => updateRoster(2, i, 'name', e.target.value)}
                              placeholder="Player Name"
                            />
                          </td>
                          <td>
                            <select
                              className={`roster-select ${rosterErrors2.roleErrorIndices.has(i) ? 'roster-input-error' : ''}`}
                              value={player.role}
                              onChange={(e) => updateRoster(2, i, 'role', e.target.value)}
                            >
                              <option value="player">Player</option>
                              <option value="captain">Captain</option>
                              <option value="libero1">Libero 1</option>
                              <option value="libero2">Libero 2</option>
                              <option value="liberocaptain">Libero + Captain</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <label className="roster-libero-serve" style={{ display: 'block', marginTop: 12, color: '#fff' }}>
                  <input
                    type="checkbox"
                    checked={team2.liberoCanServe === true}
                    onChange={(e) => setTeam2((t) => ({ ...t, liberoCanServe: e.target.checked }))}
                  />
                  <span style={{ marginLeft: 8 }}>Libero can serve</span>
                </label>
              </div>
            </div>
            {rosterToast && (
              <div className={`roster-toast ${rosterToast.includes('✅') ? 'roster-toast-success' : 'roster-toast-error'}`} role="alert">
                {rosterToast}
              </div>
            )}
            
            {/* Load Roster Modal */}
            {showLoadRosterModal && (
              <div
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'rgba(0,0,0,0.9)',
                  zIndex: 2000,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onClick={() => setShowLoadRosterModal(false)}
              >
                <div
                  style={{
                    background: '#16213e',
                    padding: '30px',
                    borderRadius: '10px',
                    maxWidth: '600px',
                    width: '90%',
                    maxHeight: '80vh',
                    overflowY: 'auto',
                    border: '3px solid #533483'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 style={{ color: '#e94560', marginBottom: '20px', textAlign: 'center' }}>📂 Load Saved Roster</h3>
                  {Object.keys(savedRosters).length === 0 ? (
                    <p style={{ color: '#888', textAlign: 'center', padding: '20px' }}>No saved rosters found.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {Object.values(savedRosters).map((roster) => (
                        <button
                          key={roster.id}
                          type="button"
                          onClick={() => handleLoadRosterFromStorage(roster.id)}
                          style={{
                            padding: '15px',
                            background: '#0f3460',
                            border: '2px solid #533483',
                            borderRadius: '5px',
                            color: '#fff',
                            cursor: 'pointer',
                            textAlign: 'left'
                          }}
                        >
                          <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                            {roster.matchInfo?.team1Name || 'Team 1'} vs {roster.matchInfo?.team2Name || 'Team 2'}
                          </div>
                          <div style={{ fontSize: '12px', color: '#888' }}>
                            {roster.matchInfo?.competition || 'No competition'} • {new Date(roster.savedAt).toLocaleDateString()}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  <div style={{ marginTop: '20px', textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={() => setShowLoadRosterModal(false)}
                      style={{
                        padding: '10px 20px',
                        background: '#666',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                      }}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
            <div className="setup-buttons">
              <button onClick={() => setCurrentStep(2)}>← Back</button>
              <button
                onClick={() => {
                  const errs = [...validateRoster(roster1, 'Team 1'), ...validateRoster(roster2, 'Team 2')];
                  if (errs.length > 0) {
                    setRosterToast(errs.join(' '));
                    setError('');
                    setTimeout(() => setRosterToast(''), 5000);
                  } else {
                    setRosterToast('');
                    setError('');
                    setCurrentStep(4);
                  }
                }}
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Coin Toss */}
        {currentStep === 4 && (
          <div className="setup-step">
            <h2>Coin Toss</h2>
            <div className="setup-form">
              <div className="form-group">
                <label>Coin Toss Winner</label>
                <select
                  value={coinToss.winner}
                  onChange={(e) => handleCoinTossChange('winner', e.target.value)}
                >
                  <option value="">-- Select Winner --</option>
                  <option value="team1">Team 1 ({team1.name})</option>
                  <option value="team2">Team 2 ({team2.name})</option>
                </select>
              </div>
              <div className="form-group">
                <label>Winner's Choice</label>
                <select
                  value={coinToss.choice}
                  onChange={(e) => handleCoinTossChange('choice', e.target.value)}
                >
                  <option value="">-- Select Choice --</option>
                  <option value="serve">Serve First</option>
                  <option value="receive">Receive First</option>
                  <option value="side">Choose Side</option>
                </select>
              </div>

              {coinToss.winner && coinToss.choice && (
                <div className="coin-toss-assignment">
                  <h3>Assign Team Positions</h3>
                  <p>Choose which team will be Team A (left side) or Team B (right side):</p>
                  <div className="form-row">
                    <div className="form-group">
                      <label style={{ color: '#ff6b6b' }}>Team A (Left Side)</label>
                      <select
                        value={coinToss.teamAAssignment}
                        onChange={(e) => handleCoinTossChange('teamAAssignment', e.target.value)}
                      >
                        <option value="">-- Select Team --</option>
                        <option value="team1">Team 1 ({team1.name})</option>
                        <option value="team2">Team 2 ({team2.name})</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label style={{ color: '#4ecdc4' }}>Team B (Right Side)</label>
                      <select
                        value={coinToss.teamBAssignment}
                        onChange={(e) => handleCoinTossChange('teamBAssignment', e.target.value)}
                      >
                        <option value="">-- Select Team --</option>
                        <option value="team1">Team 1 ({team1.name})</option>
                        <option value="team2">Team 2 ({team2.name})</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Same block as DC_Volley_patched_fixed_2.html #coinTossResult (hidden until winner + choice) */}
            {coinToss.winner && coinToss.choice && (() => {
              const legacy = getCoinTossResultLegacyStrings();
              const s = getCoinTossSummary();
              const firstServer = s ? s.servingTeamName : legacy?.firstServer;
              const firstReceiver = s ? s.receivingTeamName : legacy?.firstReceiver;
              let courtSides = legacy?.courtSides ?? '';
              if (s) {
                courtSides = `Team A (${s.teamAName}) — Left | Team B (${s.teamBName}) — Right`;
              }
              return (
                <div id="coinTossResult" className="coin-toss-result-box" aria-live="polite">
                  <div className="coin-toss-result-heading">✓ Coin Toss Result:</div>
                  <div className="coin-toss-result-body">
                    <div>
                      🎯 <strong>First Server:</strong> <span>{firstServer}</span>
                    </div>
                    <div>
                      🔥 <strong>First Receiver:</strong> <span>{firstReceiver}</span>
                    </div>
                    <div>
                      📍 <strong>Court Sides:</strong> <span>{courtSides}</span>
                    </div>
                    {s?.sideNote && <div className="coin-toss-result-note">{s.sideNote}</div>}
                  </div>
                </div>
              );
            })()}

            {(!coinToss.winner || !coinToss.choice) && (
              <p className="coin-toss-summary-hint">
                Select <strong>coin toss winner</strong> and <strong>winner&apos;s choice</strong> to see the toss result.
              </p>
            )}
            {coinToss.winner && coinToss.choice && !getCoinTossSummary() && (
              <p className="coin-toss-summary-hint">
                Assign <strong>Team A (left)</strong> and <strong>Team B (right)</strong> above to lock court sides for the match.
              </p>
            )}

            <div className="setup-buttons">
              <button onClick={() => setCurrentStep(3)}>← Back</button>
              <button
                type="button"
                onClick={() => setCurrentStep(5)}
                disabled={!coinToss.teamAAssignment || !coinToss.teamBAssignment || coinToss.teamAAssignment === coinToss.teamBAssignment}
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Officials & signatures (before lineup) */}
        {currentStep === 5 && assignment && (
          <div className="setup-step setup-step-officials">
            <h2>Officials & signatures</h2>
            <p className="setup-hint">
              Enter match referee and scorer names, complete team staff and signatures below, click <strong>Save</strong> on the sheet, then continue to lineup selection.
            </p>
            <div className="setup-form">
              <div className="form-row">
                <div className="form-group">
                  <label>1st Referee</label>
                  <input
                    type="text"
                    value={officials.ref1}
                    onChange={(e) => setOfficials({ ...officials, ref1: e.target.value })}
                    placeholder="Name"
                  />
                </div>
                <div className="form-group">
                  <label>2nd Referee</label>
                  <input
                    type="text"
                    value={officials.ref2}
                    onChange={(e) => setOfficials({ ...officials, ref2: e.target.value })}
                    placeholder="Name"
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Scorer</label>
                  <input
                    type="text"
                    value={officials.scorer}
                    onChange={(e) => setOfficials({ ...officials, scorer: e.target.value })}
                    placeholder="Name"
                  />
                </div>
                <div className="form-group">
                  <label>Assistant Scorer</label>
                  <input
                    type="text"
                    value={officials.assistScorer}
                    onChange={(e) => setOfficials({ ...officials, assistScorer: e.target.value })}
                    placeholder="Name"
                  />
                </div>
              </div>
            </div>
            <OfficialsModal
              embedded
              open
              persistOnSave
              gameData={{
                teamAName: officialsSheet?.teamAName || assignment.teamA.name,
                teamBName: officialsSheet?.teamBName || assignment.teamB.name,
                officials: {
                  ...officials,
                  ...(officialsSheet || {})
                }
              }}
              onSave={(data) => setOfficialsSheet(data)}
              onClose={() => {}}
            />
            <div className="setup-buttons">
              <button type="button" onClick={() => setCurrentStep(4)} disabled={loading}>← Back</button>
              <button type="button" onClick={() => setCurrentStep(6)} disabled={loading}>
                Next: Lineups →
              </button>
            </div>
          </div>
        )}

        {/* Step 6: Starting Lineups — click player then position (like HTML); liberos cannot be in starting lineup */}
        {currentStep === 6 && assignment && (() => {
          const isLibero = (p) => p.role === 'libero1' || p.role === 'libero2' || p.role === 'liberocaptain';
          const rosterA = (assignment.teamARoster || []).filter(p => p.jersey && !isLibero(p)).sort((a, b) => Number(a.jersey) - Number(b.jersey));
          const rosterB = (assignment.teamBRoster || []).filter(p => p.jersey && !isLibero(p)).sort((a, b) => Number(a.jersey) - Number(b.jersey));
          const lineupA = assignment.teamALineup || [];
          const lineupB = assignment.teamBLineup || [];
          const setLineupForA = (idx, jersey) => {
            const newLineup = [...(coinToss.teamAAssignment === 'team1' ? lineup1 : lineup2)];
            newLineup[idx] = jersey;
            if (coinToss.teamAAssignment === 'team1') setLineup1(newLineup);
            else setLineup2(newLineup);
          };
          const setLineupForB = (idx, jersey) => {
            const newLineup = [...(coinToss.teamBAssignment === 'team1' ? lineup1 : lineup2)];
            newLineup[idx] = jersey;
            if (coinToss.teamBAssignment === 'team1') setLineup1(newLineup);
            else setLineup2(newLineup);
          };
          const assignPosition = (side, pos) => {
            const idx = pos - 1;
            const lineup = side === 'A' ? lineupA : lineupB;
            const sel = selectedPlayerForLineup;
            if (!sel || sel.side !== side) return;
            const currentAtPos = lineup[idx];
            const currentIdx = lineup.findIndex(j => j && String(j) === String(sel.jersey));
            if (currentIdx === idx) {
              if (side === 'A') setLineupForA(idx, null);
              else setLineupForB(idx, null);
              setSelectedPlayerForLineup(null);
              return;
            }
            if (currentIdx !== -1) {
              alert(`Player #${sel.jersey} is already at P${currentIdx + 1}. Click that position to remove them first, then assign to the new position.`);
              return;
            }
            if (side === 'A') setLineupForA(idx, sel.jersey);
            else setLineupForB(idx, sel.jersey);
            setSelectedPlayerForLineup(null);
          };
          const posOrder = [4, 3, 2, 5, 6, 1];
          return (
          <div className="setup-step">
            <h2>Starting Lineups for Set 1</h2>
            <div className="lineup-setup">
              <div className="team-setup">
                <h3 style={{ color: '#ff6b6b' }}>TEAM A - {assignment.teamA.name}</h3>
                <div className="player-roster">
                  {rosterA.map(p => (
                    <div
                      key={p.jersey}
                      className={`roster-player ${selectedPlayerForLineup?.side === 'A' && selectedPlayerForLineup?.jersey === p.jersey ? 'selected' : ''}`}
                      onClick={() => setSelectedPlayerForLineup(prev => prev?.side === 'A' && prev?.jersey === p.jersey ? null : { side: 'A', jersey: p.jersey })}
                    >
                      <strong>#{p.jersey}</strong> {p.name || ''}
                      {p.role === 'captain' ? <span className="lineup-badge-c">C</span> : null}
                    </div>
                  ))}
                </div>
                <div className="court-setup">
                  <div className="court-setup-grid">
                    {posOrder.map((pos) => {
                      const idx = pos - 1;
                      const jersey = lineupA[idx];
                      const label = { 4: 'P4-LF', 3: 'P3-MF', 2: 'P2-RF', 5: 'P5-LB', 6: 'P6-MB', 1: 'P1-RB' }[pos];
                      return (
                        <div
                          key={pos}
                          className={`court-setup-pos ${jersey ? 'filled' : ''}`}
                          onClick={() => assignPosition('A', pos)}
                        >
                          <span className="pos-setup-label">{label}</span>
                          <div className="pos-setup-num">{jersey ? `#${jersey}` : '-'}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="team-setup">
                <h3 style={{ color: '#4ecdc4' }}>TEAM B - {assignment.teamB.name}</h3>
                <div className="player-roster">
                  {rosterB.map(p => (
                    <div
                      key={p.jersey}
                      className={`roster-player ${selectedPlayerForLineup?.side === 'B' && selectedPlayerForLineup?.jersey === p.jersey ? 'selected' : ''}`}
                      onClick={() => setSelectedPlayerForLineup(prev => prev?.side === 'B' && prev?.jersey === p.jersey ? null : { side: 'B', jersey: p.jersey })}
                    >
                      <strong>#{p.jersey}</strong> {p.name || ''}
                      {p.role === 'captain' ? <span className="lineup-badge-c">C</span> : null}
                    </div>
                  ))}
                </div>
                <div className="court-setup">
                  <div className="court-setup-grid">
                    {posOrder.map((pos) => {
                      const idx = pos - 1;
                      const jersey = lineupB[idx];
                      const label = { 4: 'P4-LF', 3: 'P3-MF', 2: 'P2-RF', 5: 'P5-LB', 6: 'P6-MB', 1: 'P1-RB' }[pos];
                      return (
                        <div
                          key={pos}
                          className={`court-setup-pos ${jersey ? 'filled' : ''}`}
                          onClick={() => assignPosition('B', pos)}
                        >
                          <span className="pos-setup-label">{label}</span>
                          <div className="pos-setup-num">{jersey ? `#${jersey}` : '-'}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            <p className="setup-hint lineup-click-hint">Click on a player, then click on a court position to assign</p>
            {/* Libero Serve Configuration */}
            {(() => {
              const hasLibero = (roster) => roster.some(p => 
                p.jersey && (p.role === 'libero1' || p.role === 'libero2' || p.role === 'liberocaptain')
              );
              const teamAHasLibero = hasLibero(assignment.teamARoster);
              const teamBHasLibero = hasLibero(assignment.teamBRoster);
              
              if (!teamAHasLibero && !teamBHasLibero) return null;
              
              return (
                <div style={{
                  background: '#0f3460',
                  border: '2px solid #9c27b0',
                  borderRadius: '8px',
                  padding: '14px 18px',
                  margin: '14px 0'
                }}>
                  <div style={{ color: '#9c27b0', fontWeight: 'bold', fontSize: '13px', marginBottom: '10px' }}>
                    Libero Serving Rule (Optional)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    {teamAHasLibero && (
                      <div>
                        <label style={{ color: '#ccc', fontSize: '11px', display: 'block', marginBottom: '4px' }}>
                          <strong style={{ color: '#ff6b6b' }}>TEAM A</strong> — Libero may serve for:
                        </label>
                        <select
                          value={liberoServeConfig.A.designatedJersey || ''}
                          onChange={(e) => {
                            const val = e.target.value || null;
                            setLiberoServeConfig(prev => ({
                              ...prev,
                              A: {
                                enabled: val !== null && val !== '',
                                designatedJersey: val
                              }
                            }));
                          }}
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            background: '#16213e',
                            border: '1px solid #533483',
                            color: '#fff',
                            borderRadius: '4px',
                            fontSize: '12px'
                          }}
                        >
                          <option value="">-- OFF (default) --</option>
                          {assignment.teamARoster
                            .filter(p => p.jersey && p.role !== 'libero1' && p.role !== 'libero2' && p.role !== 'liberocaptain')
                            .map(p => (
                              <option key={p.jersey} value={p.jersey}>
                                #{p.jersey} {p.name}
                              </option>
                            ))}
                        </select>
                      </div>
                    )}
                    {teamBHasLibero && (
                      <div>
                        <label style={{ color: '#ccc', fontSize: '11px', display: 'block', marginBottom: '4px' }}>
                          <strong style={{ color: '#4ecdc4' }}>TEAM B</strong> — Libero may serve for:
                        </label>
                        <select
                          value={liberoServeConfig.B.designatedJersey || ''}
                          onChange={(e) => {
                            const val = e.target.value || null;
                            setLiberoServeConfig(prev => ({
                              ...prev,
                              B: {
                                enabled: val !== null && val !== '',
                                designatedJersey: val
                              }
                            }));
                          }}
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            background: '#16213e',
                            border: '1px solid #533483',
                            color: '#fff',
                            borderRadius: '4px',
                            fontSize: '12px'
                          }}
                        >
                          <option value="">-- OFF (default) --</option>
                          {assignment.teamBRoster
                            .filter(p => p.jersey && p.role !== 'libero1' && p.role !== 'libero2' && p.role !== 'liberocaptain')
                            .map(p => (
                              <option key={p.jersey} value={p.jersey}>
                                #{p.jersey} {p.name}
                              </option>
                            ))}
                        </select>
                      </div>
                    )}
                  </div>
                  <div style={{ color: '#888', fontSize: '10px', marginTop: '8px' }}>
                    When enabled: libero may replace that player in P1 while serving. All other rotations remain blocked.
                  </div>
                </div>
              );
            })()}
            
            <div className="setup-buttons">
              <button type="button" onClick={() => setCurrentStep(5)}>← Back</button>
              <button
                type="button"
                onClick={handleStartGame}
                disabled={loading}
              >
                {loading ? 'Creating Game...' : 'Start Game'}
              </button>
            </div>
          </div>
        );
        })()}

        {/* Fix #1: all saved teams (cloud + local) — pick one row to load into Team 1 or Team 2 */}
        {savedTeamPicker && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.92)',
              zIndex: 4100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16
            }}
            onClick={() => !savedTeamPicker.loading && setSavedTeamPicker(null)}
            role="presentation"
          >
            <div
              style={{
                background: '#16213e',
                borderRadius: 10,
                padding: 24,
                maxWidth: 560,
                width: '100%',
                maxHeight: '85vh',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                border: '3px solid #533483',
                color: '#fff'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ color: '#e94560', marginBottom: 12, textAlign: 'center' }}>
                Select saved team for Team {savedTeamPicker.forTeamNum}
              </h3>
              <p style={{ color: '#aaa', fontSize: 13, textAlign: 'center', marginBottom: 12 }}>
                Choose one roster from the cloud or from local match saves.
              </p>
              {savedTeamPicker.loading && <p style={{ textAlign: 'center' }}>Loading teams…</p>}
              {savedTeamPicker.error && (
                <p style={{ color: '#ff9800', fontSize: 13, textAlign: 'center', marginBottom: 8 }}>{savedTeamPicker.error}</p>
              )}
              {!savedTeamPicker.loading && savedTeamPicker.rows.length === 0 && (
                <p style={{ color: '#888', textAlign: 'center', padding: 20 }}>
                  No saved teams found. Use “Save Team” to sync to the cloud, or “Load Roster” for a full local save.
                </p>
              )}
              <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {!savedTeamPicker.loading &&
                  savedTeamPicker.rows.map((row) => (
                    <button
                      key={row.key}
                      type="button"
                      onClick={() => applySavedTeamRow(row)}
                      style={{
                        padding: 14,
                        background: '#0f3460',
                        border: '2px solid #533483',
                        borderRadius: 8,
                        color: '#fff',
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                    >
                      <div style={{ fontWeight: 'bold' }}>{row.teamName}</div>
                      <div style={{ fontSize: 12, color: '#888' }}>
                        {row.sourceLabel} · {row.subtitle}
                      </div>
                    </button>
                  ))}
              </div>
              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={() => setSavedTeamPicker(null)}
                  disabled={savedTeamPicker.loading}
                  style={{ padding: '10px 20px', background: '#555', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Fix #1: confirm team / scope before file or full saved roster import */}
        {rosterTeamLoadContext && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.9)',
              zIndex: 4000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16
            }}
            onClick={() => setRosterTeamLoadContext(null)}
            role="presentation"
          >
            <div
              style={{
                background: '#16213e',
                borderRadius: 10,
                padding: 28,
                maxWidth: 480,
                width: '100%',
                border: '3px solid #533483',
                color: '#fff'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {(rosterTeamLoadContext.kind === 'file' || rosterTeamLoadContext.kind === 'saved') && (
                <>
                  <h3 style={{ color: '#e94560', marginBottom: 16, textAlign: 'center' }}>👥 Team selection</h3>
                  <p style={{ marginBottom: 20, lineHeight: 1.5, textAlign: 'center' }}>
                    Choose which roster slot(s) receive this data. Officials are updated only when you choose <strong>Both teams</strong>.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <button
                      type="button"
                      onClick={() =>
                        applyRosterPayload(rosterTeamLoadContext.data, '1', {
                          closeSavedModal: rosterTeamLoadContext.kind === 'saved'
                        })
                      }
                      style={{ padding: 12, background: '#ff6b6b', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}
                    >
                      Team 1 only ({team1.name})
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        applyRosterPayload(rosterTeamLoadContext.data, '2', {
                          closeSavedModal: rosterTeamLoadContext.kind === 'saved'
                        })
                      }
                      style={{ padding: 12, background: '#4ecdc4', color: '#000', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}
                    >
                      Team 2 only ({team2.name})
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        applyRosterPayload(rosterTeamLoadContext.data, 'both', {
                          closeSavedModal: rosterTeamLoadContext.kind === 'saved'
                        })
                      }
                      style={{ padding: 12, background: '#9c27b0', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}
                    >
                      Both teams
                    </button>
                    <button
                      type="button"
                      onClick={() => setRosterTeamLoadContext(null)}
                      style={{ padding: 10, background: '#333', color: '#ccc', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
