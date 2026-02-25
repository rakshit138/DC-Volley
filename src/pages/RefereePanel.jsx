import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import {
  updateScore,
  updateSets,
  markGameFinished,
  undoLastPoint,
  recordTimeout,
  recordSubstitution,
  updateOfficials,
  recordLiberoReplacement,
  recordSanction,
  updateGameSwapped,
  rotateLineup
} from '../services/gameService';
import TimeoutModal from '../components/TimeoutModal';
import SubModal from '../components/SubModal';
import SanctionModal from '../components/SanctionModal';
import OfficialsModal from '../components/OfficialsModal';
import LiberoModal from '../components/LiberoModal';
import { downloadMatchReportHtml } from '../utils/exportMatchReportHtml';
import './RefereePanel.css';

const POS_LABELS = { 1: 'P1-RB', 2: 'P2-RF', 3: 'P3-MF', 4: 'P4-LF', 5: 'P5-LB', 6: 'P6-MB' };
const GRID_ORDER = [4, 3, 2, 5, 6, 1];

function getPlayer(team, teams, jersey) {
  const players = teams?.[team]?.players || [];
  return players.find((p) => String(p.jersey) === String(jersey));
}

function LineupList({ team, teamName, lineup, players, serving, currentSetData }) {
  if (!lineup || lineup.length === 0) {
    return (
      <div className="referee-lineup-list">
        {[1, 2, 3, 4, 5, 6].map((pos) => (
          <div key={pos} className="referee-lineup-item">
            <span className="referee-lineup-pos">P{pos}</span>
            <span>-</span>
          </div>
        ))}
      </div>
    );
  }
  const arr = Array.isArray(lineup) ? lineup : [];
  const padded = [...arr];
  while (padded.length < 6) padded.push(null);

  return (
    <div className="referee-lineup-list">
      {[1, 2, 3, 4, 5, 6].map((pos) => {
        const jersey = padded[pos - 1];
        const p = jersey != null ? getPlayer(team, { [team]: { players } }, jersey) : null;
        const isServer = serving === team && pos === 1;
        const role = p?.role;
        const isCaptain = role === 'captain' || role === 'liberocaptain';
        const isLibero = role === 'libero1' || role === 'libero2' || role === 'liberocaptain';
        const badges = [];
        if (isCaptain) badges.push(<span key="c" className="referee-lineup-badge referee-badge-c">C</span>);
        if (isLibero) badges.push(<span key="l" className="referee-lineup-badge referee-badge-l">L</span>);
        return (
          <div key={pos} className="referee-lineup-item">
            <span className="referee-lineup-pos">P{pos}</span>
            <span>
              {jersey != null ? `#${jersey} ${p?.name || ''}` : '-'}
              {badges.length > 0 && badges}
              {isServer && ' 🏐'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function CourtGrid({ team, lineup, players, serving, liberoJerseys }) {
  const arr = Array.isArray(lineup) ? lineup : [];
  const padded = [...arr];
  while (padded.length < 6) padded.push(null);

  return (
    <div className="referee-court-grid">
      {GRID_ORDER.map((pos) => {
        const jersey = padded[pos - 1];
        const isServer = serving === team && pos === 1;
        const isLibero = jersey != null && liberoJerseys && liberoJerseys.has(String(jersey));
        return (
          <div
            key={pos}
            className={`referee-court-pos ${isServer ? 'server' : ''} ${isLibero ? 'libero-on-court' : ''}`}
          >
            <span className="referee-pos-label">{POS_LABELS[pos]}</span>
            <span className="referee-pos-jersey">{jersey != null ? jersey : '-'}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function RefereePanel() {
  const { gameCode, gameData, loading, error } = useGame();
  const navigate = useNavigate();
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState('');
  const [timeoutModal, setTimeoutModal] = useState({ open: false, team: null });
  const [subModal, setSubModal] = useState({ open: false, team: null });
  const [officialsModalOpen, setOfficialsModalOpen] = useState(false);
  const [liberoModal, setLiberoModal] = useState({ open: false, team: null });
  const [rosterModalOpen, setRosterModalOpen] = useState(false);
  const [sanctionModalOpen, setSanctionModalOpen] = useState(false);
  const hasShownOfficialsOnStart = useRef(false);

  useEffect(() => {
    if (!gameCode) {
      navigate('/');
    }
  }, [gameCode, navigate]);

  useEffect(() => {
    if (!gameData || !gameCode || loading) return;
    if (hasShownOfficialsOnStart.current) return;
    // Auto-open officials modal on first visit to referee panel (or before match start) until they save from it
    if (gameData.officialsSavedAt != null) return;
    hasShownOfficialsOnStart.current = true;
    setOfficialsModalOpen(true);
  }, [gameData, gameCode, loading]);

  const handleScoreUpdate = async (team, increment = 1) => {
    if (updating || !gameCode) return;
    setUpdating(true);
    setMessage('');
    try {
      await updateScore(gameCode, team, increment);
      setMessage(`Score updated for Team ${team}`);
      setTimeout(() => setMessage(''), 2000);
    } catch (err) {
      setMessage(`Error: ${err.message}`);
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setUpdating(false);
    }
  };

  const handleNextSet = async () => {
    if (updating || !gameCode || !gameData) return;
    if (gameData.status === 'FINISHED') return;
    const currentSet = gameData.currentSet || 1;
    const sets = gameData.sets || [];
    const currentSetData = sets[currentSet - 1];
    if (!currentSetData) {
      setMessage('No current set data');
      return;
    }
    if (currentSetData.winner) {
      setMessage('This set is already ended.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    const scoreA = currentSetData.score?.A || 0;
    const scoreB = currentSetData.score?.B || 0;
    if (scoreA === scoreB) {
      setMessage('Cannot end set with tied score');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    const winner = scoreA > scoreB ? 'A' : 'B';
    setUpdating(true);
    setMessage('');
    try {
      await updateSets(gameCode, winner);
      setMessage(`Set ${currentSet} won by Team ${winner}`);
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage(`Error: ${err.message}`);
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setUpdating(false);
    }
  };

  const handleFinishGame = async () => {
    if (updating || !gameCode) return;
    if (!window.confirm('Are you sure you want to mark this game as finished?')) return;
    setUpdating(true);
    setMessage('');
    try {
      await markGameFinished(gameCode);
      setMessage('Game marked as finished');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage(`Error: ${err.message}`);
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setUpdating(false);
    }
  };

  const handleUndo = async () => {
    if (updating || !gameCode) return;
    setUpdating(true);
    setMessage('');
    try {
      await undoLastPoint(gameCode);
      setMessage('Last point undone');
      setTimeout(() => setMessage(''), 2000);
    } catch (err) {
      setMessage(`Error: ${err.message}`);
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setUpdating(false);
    }
  };

  const handleTimeout = async (team) => {
    if (updating || !gameCode) return;
    setUpdating(true);
    setMessage('');
    try {
      const result = await recordTimeout(gameCode, team);
      if (result.ok) {
        setTimeoutModal({ open: true, team });
      } else {
        setMessage(result.message || 'Timeout failed');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      setMessage(`Error: ${err.message}`);
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setUpdating(false);
    }
  };

  const handleTimeoutClose = () => setTimeoutModal({ open: false, team: null });

  const handleSubConfirm = async (team, playerOut, playerIn) => {
    if (!gameCode) return;
    setUpdating(true);
    setMessage('');
    try {
      const result = await recordSubstitution(gameCode, team, playerOut, playerIn);
      if (result.ok) {
        setMessage('Substitution recorded');
        setTimeout(() => setMessage(''), 2000);
      } else {
        setMessage(result.message || 'Substitution failed');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      setMessage(`Error: ${err.message}`);
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setUpdating(false);
    }
  };

  const handleOfficialsSave = async (data) => {
    if (!gameCode) return;
    setUpdating(true);
    setMessage('');
    try {
      await updateOfficials(gameCode, data);
      setMessage('Officials and signatures saved');
      setTimeout(() => setMessage(''), 2000);
    } catch (err) {
      setMessage(`Error: ${err.message}`);
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setUpdating(false);
    }
  };

  const handleLiberoConfirm = async (team, positionIndex, liberoJersey) => {
    if (!gameCode) return;
    setUpdating(true);
    setMessage('');
    try {
      await recordLiberoReplacement(gameCode, team, positionIndex, liberoJersey);
      setMessage('Libero replacement recorded');
      setTimeout(() => setMessage(''), 2000);
    } catch (err) {
      setMessage(`Error: ${err.message}`);
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setUpdating(false);
    }
  };

  const handleSwap = async () => {
    if (!gameCode) return;
    setUpdating(true);
    setMessage('');
    try {
      await updateGameSwapped(gameCode);
      setMessage('Sides swapped');
      setTimeout(() => setMessage(''), 2000);
    } catch (err) {
      setMessage(`Error: ${err.message}`);
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setUpdating(false);
    }
  };

  const handleRotate = async (team) => {
    if (!gameCode) return;
    if (!window.confirm(`Rotate ${team === 'A' ? leftTeamName : rightTeamName} lineup clockwise (P1→P6, P2→P1, …)? Use for corrections only.`)) return;
    setUpdating(true);
    setMessage('');
    try {
      await rotateLineup(gameCode, team);
      setMessage('Rotation complete');
      setTimeout(() => setMessage(''), 2000);
    } catch (err) {
      setMessage(`Error: ${err.message}`);
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="referee-container">
        <div className="referee-loading">Loading game data...</div>
      </div>
    );
  }

  if (error || !gameData) {
    return (
      <div className="referee-container">
        <div className="referee-error">
          {error || 'Game not found'}
          <button onClick={() => navigate('/')} className="referee-back-btn">Go Home</button>
        </div>
      </div>
    );
  }

  const currentSet = gameData.currentSet || 1;
  const sets = gameData.sets || [];
  const currentSetData = sets[currentSet - 1];
  const setsWon = gameData.setsWon || { A: 0, B: 0 };
  const status = gameData.status || 'LIVE';
  const teamAName = gameData.teamAName || 'Team A';
  const teamBName = gameData.teamBName || 'Team B';

  if (!currentSetData) {
    return (
      <div className="referee-container">
        <div className="referee-no-data">Waiting for match to start...</div>
      </div>
    );
  }

  const scoreA = currentSetData.score?.A || 0;
  const scoreB = currentSetData.score?.B || 0;
  const serving = currentSetData.serving || 'A';
  const swapped = !!gameData.swapped;
  const leftTeam = swapped ? 'B' : 'A';
  const rightTeam = swapped ? 'A' : 'B';
  const subLimit = Number(gameData.subLimit) || 6;
  const toA = (currentSetData.timeouts?.A || []).length;
  const toB = (currentSetData.timeouts?.B || []).length;
  const subA = (currentSetData.substitutions?.A || []).length;
  const subB = (currentSetData.substitutions?.B || []).length;

  const lineupA = gameData.teams?.A?.lineup || [];
  const lineupB = gameData.teams?.B?.lineup || [];
  const playersA = gameData.teams?.A?.players || [];
  const playersB = gameData.teams?.B?.players || [];

  const teamAColor = gameData.teamAColor || '#ff6b9d';
  const teamBColor = gameData.teamBColor || '#4ecdc4';

  const isLiberoRole = (r) => r === 'libero1' || r === 'libero2' || r === 'liberocaptain';
  const liberoJerseysA = new Set(
    playersA.filter((p) => isLiberoRole(p.role)).map((p) => String(p.jersey))
  );
  const liberoJerseysB = new Set(
    playersB.filter((p) => isLiberoRole(p.role)).map((p) => String(p.jersey))
  );

  const leftTeamName = leftTeam === 'A' ? teamAName : teamBName;
  const rightTeamName = rightTeam === 'A' ? teamAName : teamBName;
  const leftScore = leftTeam === 'A' ? scoreA : scoreB;
  const rightScore = rightTeam === 'A' ? scoreA : scoreB;
  const lineupLeft = leftTeam === 'A' ? lineupA : lineupB;
  const lineupRight = rightTeam === 'A' ? lineupA : lineupB;
  const playersLeft = leftTeam === 'A' ? playersA : playersB;
  const playersRight = rightTeam === 'A' ? playersA : playersB;
  const toLeft = leftTeam === 'A' ? toA : toB;
  const toRight = rightTeam === 'A' ? toA : toB;
  const subLeft = leftTeam === 'A' ? subA : subB;
  const subRight = rightTeam === 'A' ? subA : subB;
  const leftColor = leftTeam === 'A' ? teamAColor : teamBColor;
  const rightColor = rightTeam === 'A' ? teamAColor : teamBColor;
  const liberoJerseysLeft = leftTeam === 'A' ? liberoJerseysA : liberoJerseysB;
  const liberoJerseysRight = rightTeam === 'A' ? liberoJerseysA : liberoJerseysB;

  const topInfo = [gameData.competition || '', gameData.venue || '', `${teamAName} vs ${teamBName}`].filter(Boolean).join(' | ') || 'Match';

  return (
    <div className="referee-app">
      {status === 'FINISHED' && (
        <div className="referee-match-over-banner">
          <span className="referee-match-over-text">🏆 MATCH OVER</span>
          <span className="referee-match-over-winner">
            {setsWon.A > setsWon.B ? leftTeamName : rightTeamName} wins {Math.max(setsWon.A, setsWon.B)}–{Math.min(setsWon.A, setsWon.B)}
          </span>
        </div>
      )}
      <div className="referee-top-bar">
        <h1>🏐 DC_Volley</h1>
        <div className="referee-match-info">
          <div className="referee-match-info-item">
            <span>🏆</span>
            <span className="championship-info">{topInfo}</span>
          </div>
          <div className="referee-match-info-item">Game: <strong>{gameCode}</strong></div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <button type="button" className="referee-btn-small referee-btn-roster" onClick={() => setRosterModalOpen(true)}>📋 ROSTER</button>
          <button type="button" className="referee-btn-small referee-btn-sanction" onClick={() => setSanctionModalOpen(true)}>⚠️ SANCTION</button>
          <button type="button" className="referee-btn-small referee-btn-swap" onClick={handleSwap} disabled={updating || status === 'FINISHED'} title="Swap which team is on left/right">🔄 SWAP</button>
          <button type="button" className="referee-btn-small referee-btn-officials" onClick={() => setOfficialsModalOpen(true)}>👥 OFFICIALS</button>
          <button type="button" className="referee-btn-small referee-btn-export" onClick={() => downloadMatchReportHtml(gameData)}>📄 Export Report</button>
          <button type="button" className="referee-btn-small" onClick={handleUndo} disabled={updating || status === 'FINISHED'}>↶ UNDO</button>
          <button type="button" className="referee-btn-small" onClick={handleNextSet} disabled={updating || status === 'FINISHED' || !!currentSetData?.winner}>Next Set</button>
          <button type="button" className="referee-btn-small" onClick={handleFinishGame} disabled={updating || status === 'FINISHED'}>End Match</button>
          <button type="button" className="referee-btn-small" onClick={() => navigate('/display-select')} disabled={updating}>Exit</button>
        </div>
      </div>

      <div className="referee-main">
        <div className="referee-side-panel">
          <div className="referee-side-title">{leftTeamName} LINEUP</div>
          <LineupList
            team={leftTeam}
            teamName={leftTeamName}
            lineup={lineupLeft}
            players={playersLeft}
            serving={serving}
            currentSetData={currentSetData}
          />
        </div>

        <div className="referee-center">
          <div className="referee-score-section">
            <div className="referee-team-score">
              <div className="referee-team-name" style={{ color: leftColor }}>{leftTeamName}</div>
              <div className="referee-score-display-val" style={{ color: leftColor }}>{leftScore}</div>
              <div className="referee-sets-small">Sets: {setsWon[leftTeam]}</div>
            </div>
            <div className="referee-set-center">
              <div className="referee-set-title">SET {currentSet}</div>
              <div className="referee-set-dots">
                {Array.from({ length: gameData.format || 3 }).map((_, i) => {
                  const set = sets[i];
                  const isWon = set?.winner;
                  let dotClass = 'referee-set-dot';
                  if (isWon === 'A') dotClass += ' set-won-a';
                  else if (isWon === 'B') dotClass += ' set-won-b';
                  return <div key={i} className={dotClass}>{i + 1}</div>;
                })}
              </div>
            </div>
            <div className="referee-team-score">
              <div className="referee-team-name" style={{ color: rightColor }}>{rightTeamName}</div>
              <div className="referee-score-display-val" style={{ color: rightColor }}>{rightScore}</div>
              <div className="referee-sets-small">Sets: {setsWon[rightTeam]}</div>
            </div>
          </div>

          <div className="referee-courts">
            <div className="referee-court-container">
              <div className="referee-court-header">
                <div className="referee-court-name">{leftTeamName}</div>
                <div className="referee-stats-row">
                  <div className="referee-stat">
                    <span className="referee-stat-label">TIMEOUT</span>
                    <span className="referee-stat-val">{toLeft}/2</span>
                  </div>
                  <div className="referee-stat">
                    <span className="referee-stat-label">SUB</span>
                    <span className="referee-stat-val">{subLeft}/{subLimit}</span>
                  </div>
                  <div className="referee-stat">
                    <span className="referee-stat-label">SERVE</span>
                    <span className="referee-stat-val">{serving === leftTeam ? 'YES' : 'NO'}</span>
                  </div>
                </div>
              </div>
              <div className="referee-court-visual">
                <CourtGrid
                  team={leftTeam}
                  lineup={lineupLeft}
                  players={playersLeft}
                  serving={serving}
                  liberoJerseys={liberoJerseysLeft}
                />
              </div>
              <div className="referee-court-controls">
                <div className="referee-btn-group">
                  <button type="button" className="referee-btn referee-btn-point" onClick={() => handleScoreUpdate(leftTeam)} disabled={updating || status === 'FINISHED'}>+ POINT</button>
                </div>
                <div className="referee-btn-group">
                  <button type="button" className="referee-btn referee-btn-timeout" onClick={() => handleTimeout(leftTeam)} disabled={updating || status === 'FINISHED'}>⏱ TO</button>
                  <button type="button" className="referee-btn referee-btn-sub" onClick={() => setSubModal({ open: true, team: leftTeam })} disabled={updating || status === 'FINISHED'}>👥 SUB</button>
                </div>
                <div className="referee-btn-group">
                  <button type="button" className="referee-btn referee-btn-libero" onClick={() => setLiberoModal({ open: true, team: leftTeam })} disabled={updating || status === 'FINISHED'}>🔄 LIBERO</button>
                  <button type="button" className="referee-btn referee-btn-rot" onClick={() => handleRotate(leftTeam)} disabled={updating || status === 'FINISHED'} title="Manual rotation (corrections only)">🔄 ROT</button>
                </div>
              </div>
            </div>

            <div className="referee-rally-strip" />

            <div className="referee-court-container">
              <div className="referee-court-header">
                <div className="referee-court-name">{rightTeamName}</div>
                <div className="referee-stats-row">
                  <div className="referee-stat">
                    <span className="referee-stat-label">TIMEOUT</span>
                    <span className="referee-stat-val">{toRight}/2</span>
                  </div>
                  <div className="referee-stat">
                    <span className="referee-stat-label">SUB</span>
                    <span className="referee-stat-val">{subRight}/{subLimit}</span>
                  </div>
                  <div className="referee-stat">
                    <span className="referee-stat-label">SERVE</span>
                    <span className="referee-stat-val">{serving === rightTeam ? 'YES' : 'NO'}</span>
                  </div>
                </div>
              </div>
              <div className="referee-court-visual">
                <CourtGrid
                  team={rightTeam}
                  lineup={lineupRight}
                  players={playersRight}
                  serving={serving}
                  liberoJerseys={liberoJerseysRight}
                />
              </div>
              <div className="referee-court-controls">
                <div className="referee-btn-group">
                  <button type="button" className="referee-btn referee-btn-point" onClick={() => handleScoreUpdate(rightTeam)} disabled={updating || status === 'FINISHED'}>+ POINT</button>
                </div>
                <div className="referee-btn-group">
                  <button type="button" className="referee-btn referee-btn-timeout" onClick={() => handleTimeout(rightTeam)} disabled={updating || status === 'FINISHED'}>⏱ TO</button>
                  <button type="button" className="referee-btn referee-btn-sub" onClick={() => setSubModal({ open: true, team: rightTeam })} disabled={updating || status === 'FINISHED'}>👥 SUB</button>
                </div>
                <div className="referee-btn-group">
                  <button type="button" className="referee-btn referee-btn-libero" onClick={() => setLiberoModal({ open: true, team: rightTeam })} disabled={updating || status === 'FINISHED'}>🔄 LIBERO</button>
                  <button type="button" className="referee-btn referee-btn-rot" onClick={() => handleRotate(rightTeam)} disabled={updating || status === 'FINISHED'} title="Manual rotation (corrections only)">🔄 ROT</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="referee-side-panel right">
          <div className="referee-side-title">{rightTeamName} LINEUP</div>
          <LineupList
            team={rightTeam}
            teamName={rightTeamName}
            lineup={lineupRight}
            players={playersRight}
            serving={serving}
            currentSetData={currentSetData}
          />
        </div>
      </div>

      <div className="referee-copyright-footer">DC_Volley © 2025 | Digital Volleyball Scoresheet</div>

      {rosterModalOpen && (
        <div className="referee-roster-modal" onClick={() => setRosterModalOpen(false)}>
          <div className="referee-roster-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="referee-roster-title">📋 TEAM ROSTERS</h3>
            <div className="referee-roster-grid">
              <div className="referee-roster-team-box team-a">
                <h4 className="referee-roster-team-name team-a">{teamAName}</h4>
                <table className="referee-roster-table">
                  <thead><tr><th>#</th><th>Name</th><th>Role</th></tr></thead>
                  <tbody>
                    {(playersA || []).map((p) => (
                      <tr key={p.jersey}><td>{p.jersey}</td><td>{p.name}</td><td>{p.role || 'Player'}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="referee-roster-team-box team-b">
                <h4 className="referee-roster-team-name team-b">{teamBName}</h4>
                <table className="referee-roster-table">
                  <thead><tr><th>#</th><th>Name</th><th>Role</th></tr></thead>
                  <tbody>
                    {(playersB || []).map((p) => (
                      <tr key={p.jersey}><td>{p.jersey}</td><td>{p.name}</td><td>{p.role || 'Player'}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="referee-modal-buttons">
              <button type="button" className="referee-btn-close" onClick={() => setRosterModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <TimeoutModal
        open={timeoutModal.open}
        teamName={timeoutModal.team ? (timeoutModal.team === 'A' ? teamAName : teamBName) : ''}
        scoreA={currentSetData?.score?.A ?? 0}
        scoreB={currentSetData?.score?.B ?? 0}
        teamAName={teamAName}
        teamBName={teamBName}
        onClose={handleTimeoutClose}
      />
      <SubModal
        open={subModal.open}
        team={subModal.team}
        teamName={subModal.team === 'A' ? teamAName : teamBName}
        teams={gameData.teams}
        currentSet={currentSet}
        sets={sets}
        subLimit={subLimit}
        onConfirm={handleSubConfirm}
        onClose={() => setSubModal({ open: false, team: null })}
      />
      <SanctionModal
        open={sanctionModalOpen}
        gameCode={gameCode}
        teamAName={teamAName}
        teamBName={teamBName}
        sanctionSystem={gameData.sanctionSystem}
        currentSet={currentSet}
        onApply={async (mod, teamKey, payload) => {
          try {
            setUpdating(true);
            setMessage('');
            await recordSanction(gameCode, teamKey, mod, payload);
            setMessage('Sanction recorded.');
            setTimeout(() => setMessage(''), 2000);
            setSanctionModalOpen(false);
          } catch (err) {
            setMessage(err?.message || 'Failed to record sanction.');
          } finally {
            setUpdating(false);
          }
        }}
        onClose={() => setSanctionModalOpen(false)}
      />
      <OfficialsModal
        open={officialsModalOpen}
        gameData={gameData}
        onSave={handleOfficialsSave}
        onClose={() => setOfficialsModalOpen(false)}
      />
      <LiberoModal
        open={liberoModal.open}
        team={liberoModal.team}
        teamName={liberoModal.team === 'A' ? teamAName : teamBName}
        teams={gameData.teams}
        onConfirm={handleLiberoConfirm}
        onClose={() => setLiberoModal({ open: false, team: null })}
      />

      {message && (
        <div className={`referee-message ${message.includes('Error') ? 'error' : 'success'}`}>{message}</div>
      )}

      <button type="button" className="referee-back-home" onClick={() => navigate('/display-select')}>← Back</button>
    </div>
  );
}
