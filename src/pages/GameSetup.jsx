import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { createGame } from '../services/gameService';
import { generateGameCode } from '../utils/generateCode';
import './GameSetup.css';

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

  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  const [rosterToast, setRosterToast] = useState('');
  const rosterErrors1 = getRosterErrorIndices(roster1);
  const rosterErrors2 = getRosterErrorIndices(roster2);

  const handleCoinTossChange = (field, value) => {
    let newCoinToss = { ...coinToss, [field]: value };
    if (field === 'teamAAssignment') {
      if (value && value === newCoinToss.teamBAssignment) newCoinToss.teamBAssignment = '';
    }
    if (field === 'teamBAssignment') {
      if (value && value === newCoinToss.teamAAssignment) newCoinToss.teamAAssignment = '';
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

      // Create game data
      const gameData = {
        teamAName: assignment.teamA.name,
        teamBName: assignment.teamB.name,
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
        officials: {
          ref1: officials.ref1,
          ref2: officials.ref2,
          scorer: officials.scorer,
          assistScorer: officials.assistScorer
        },
        coinToss: {
          winner: coinToss.winner,
          choice: coinToss.choice,
          firstServer: firstServer
        },
        teams: {
          A: {
            players: playersA,
            lineup: assignment.teamALineup.map(p => p != null ? String(p) : null),
            liberoCanServe: assignment.teamA.liberoCanServe === true
          },
          B: {
            players: playersB,
            lineup: assignment.teamBLineup.map(p => p != null ? String(p) : null),
            liberoCanServe: assignment.teamB.liberoCanServe === true
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
          },
          startTime: new Date()
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
            <div className={`progress-step ${currentStep >= 5 ? 'active' : ''}`}>5. Officials</div>
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
            <h2>Team Rosters</h2>
            <p className="setup-hint">Enter players for each team (up to 14). Jersey, name, and role.</p>
            <div className="roster-section">
              <div className="roster-team">
                <h3 style={{ color: '#ff6b6b' }}>Team 1 – {team1.name}</h3>
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
              <div className="roster-toast roster-toast-error" role="alert">
                {rosterToast}
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
                  {coinToss.teamAAssignment && coinToss.teamBAssignment && coinToss.teamAAssignment !== coinToss.teamBAssignment && (
                    <div className="coin-toss-result">
                      <div><strong>First Server:</strong> {coinToss.choice === 'serve' ? (coinToss.winner === coinToss.teamAAssignment ? 'Team A' : 'Team B') : (coinToss.winner === coinToss.teamAAssignment ? 'Team B' : 'Team A')}</div>
                      <div><strong>Court Sides:</strong> Team A ({coinToss.teamAAssignment === 'team1' ? team1.name : team2.name}) | Team B ({coinToss.teamBAssignment === 'team1' ? team1.name : team2.name})</div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="setup-buttons">
              <button onClick={() => setCurrentStep(3)}>← Back</button>
              <button onClick={() => setCurrentStep(5)} disabled={!coinToss.teamAAssignment || !coinToss.teamBAssignment || coinToss.teamAAssignment === coinToss.teamBAssignment}>Next →</button>
            </div>
          </div>
        )}

        {/* Step 5: Match Officials */}
        {currentStep === 5 && (
          <div className="setup-step">
            <h2>Match Officials</h2>
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
            <div className="setup-buttons">
              <button onClick={() => setCurrentStep(4)}>← Back</button>
              <button onClick={() => setCurrentStep(6)}>Next →</button>
            </div>
          </div>
        )}

        {/* Step 6: Starting Lineups */}
        {currentStep === 6 && assignment && (
          <div className="setup-step">
            <h2>Starting Lineups for Set 1</h2>
            <p className="setup-hint">Select jersey numbers for each position (P1-P6)</p>
            <div className="lineup-setup-section">
              <div className="lineup-team-setup">
                <h3 style={{ color: '#ff6b6b' }}>TEAM A - {assignment.teamA.name}</h3>
                <div className="lineup-court-setup">
                  <div className="lineup-court-grid">
                    {[
                      { pos: 4, label: 'P4-LF' },
                      { pos: 3, label: 'P3-MF' },
                      { pos: 2, label: 'P2-RF' },
                      { pos: 5, label: 'P5-LB' },
                      { pos: 6, label: 'P6-MB' },
                      { pos: 1, label: 'P1-RB' }
                    ].map(({ pos, label }) => {
                      const idx = pos - 1;
                      return (
                        <div key={pos} className="lineup-court-pos-setup">
                          <div className="lineup-pos-label">{label}</div>
                          <select
                            value={assignment.teamALineup[idx] || ''}
                            onChange={(e) => {
                              const val = e.target.value || null;
                              if (coinToss.teamAAssignment === 'team1') {
                                const newLineup = [...lineup1];
                                newLineup[idx] = val;
                                setLineup1(newLineup);
                              } else {
                                const newLineup = [...lineup2];
                                newLineup[idx] = val;
                                setLineup2(newLineup);
                              }
                            }}
                            className="lineup-pos-select"
                          >
                            <option value="">-</option>
                            {assignment.teamARoster
                              .filter(p => p.jersey)
                              .map(p => (
                                <option key={p.jersey} value={p.jersey}>
                                  #{p.jersey} {p.name}
                                </option>
                              ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="lineup-team-setup">
                <h3 style={{ color: '#4ecdc4' }}>TEAM B - {assignment.teamB.name}</h3>
                <div className="lineup-court-setup">
                  <div className="lineup-court-grid">
                    {[
                      { pos: 4, label: 'P4-LF' },
                      { pos: 3, label: 'P3-MF' },
                      { pos: 2, label: 'P2-RF' },
                      { pos: 5, label: 'P5-LB' },
                      { pos: 6, label: 'P6-MB' },
                      { pos: 1, label: 'P1-RB' }
                    ].map(({ pos, label }) => {
                      const idx = pos - 1;
                      return (
                        <div key={pos} className="lineup-court-pos-setup">
                          <div className="lineup-pos-label">{label}</div>
                          <select
                            value={assignment.teamBLineup[idx] || ''}
                            onChange={(e) => {
                              const val = e.target.value || null;
                              if (coinToss.teamBAssignment === 'team1') {
                                const newLineup = [...lineup1];
                                newLineup[idx] = val;
                                setLineup1(newLineup);
                              } else {
                                const newLineup = [...lineup2];
                                newLineup[idx] = val;
                                setLineup2(newLineup);
                              }
                            }}
                            className="lineup-pos-select"
                          >
                            <option value="">-</option>
                            {assignment.teamBRoster
                              .filter(p => p.jersey)
                              .map(p => (
                                <option key={p.jersey} value={p.jersey}>
                                  #{p.jersey} {p.name}
                                </option>
                              ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            <div className="setup-buttons">
              <button onClick={() => setCurrentStep(5)}>← Back</button>
              <button onClick={handleStartGame} disabled={loading}>
                {loading ? 'Creating Game...' : 'Start Game'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
