import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import './Lineup.css';

export default function Lineup() {
  const { gameCode, gameData, loading, error } = useGame();
  const navigate = useNavigate();

  useEffect(() => {
    if (!gameCode) {
      navigate('/');
    }
  }, [gameCode, navigate]);

  if (loading) {
    return (
      <div className="lineup-container">
        <div className="lineup-loading">Loading game data...</div>
      </div>
    );
  }

  if (error || !gameData) {
    return (
      <div className="lineup-container">
        <div className="lineup-error">
          {error || 'Game not found'}
          <button onClick={() => navigate('/')} className="lineup-back-btn">
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const currentSet = gameData.currentSet || 1;
  const sets = gameData.sets || [];
  const currentSetData = sets[currentSet - 1];
  const teams = gameData.teams || { A: { players: [], lineup: [] }, B: { players: [], lineup: [] } };

  if (!currentSetData) {
    return (
      <div className="lineup-container">
        <div className="lineup-no-data">Waiting for match to start...</div>
      </div>
    );
  }

  const scoreA = currentSetData.score?.A || 0;
  const scoreB = currentSetData.score?.B || 0;
  const serving = currentSetData.serving || 'A';
  const format = gameData.format || 3;
  const subLimit = gameData.subLimit ?? 6;

  const isLiberoRole = (role) =>
    role === 'libero1' || role === 'libero2' || role === 'liberocaptain';

  const renderCourt = (team) => {
    const teamData = teams[team] || {};
    const lineup = teamData.lineup || [];
    const players = teamData.players || [];
    const teamName = team === 'A' ? gameData.teamAName : gameData.teamBName;
    const lineupStrs = lineup.map((j) => String(j));
    const timeoutsUsed = currentSetData.timeouts?.[team]?.length ?? 0;
    const subsUsed = currentSetData.substitutions?.[team]?.length ?? 0;

    // Position order for display: P4, P3, P2, P5, P6, P1 (indices 3,2,1,4,5,0)
    const posOrder = [3, 2, 1, 4, 5, 0];
    const labels = ['P4-LF', 'P3-MF', 'P2-RF', 'P5-LB', 'P6-MB', 'P1-RB'];

    const liberos = (players || []).filter((p) => isLiberoRole(p.role));

    return (
      <div className="lineup-team-section">
        <div className="lineup-team-header">
          <h3 className={`lineup-title ${team === 'A' ? 'team-a-color' : 'team-b-color'}`}>
            {teamName || `Team ${team}`}
          </h3>
        </div>

        <div className="lineup-court">
          <div className="lineup-court-grid">
            {posOrder.map((idx, i) => {
              const jersey = lineup[idx];
              const player = players.find((p) => String(p.jersey) === String(jersey));
              const isServer = idx === 0 && serving === team;
              const isLibero = player && isLiberoRole(player.role);

              return (
                <div
                  key={i}
                  className={`lineup-court-pos ${isServer ? 'server' : ''} ${isLibero ? 'libero libero-on-court' : ''}`}
                >
                  <div className="lineup-pos-label">{labels[i]}</div>
                  <div className="lineup-pos-jersey">
                    {jersey ? `#${jersey}` : '-'}
                  </div>
                  {player && player.name && (
                    <div className="lineup-pos-name">
                      {player.name.split(' ')[0]}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="lineup-rotation">
          <div className="lineup-rotation-title">Rotation Order (Next →)</div>
          <div className="lineup-rotation-list">
            {Array.from({ length: 6 }).map((_, i) => {
              const jersey = lineup[i];
              const player = players.find((p) => String(p.jersey) === String(jersey));
              const isLibero = player && isLiberoRole(player.role);

              return (
                <div key={i} className={`lineup-rotation-item ${isLibero ? 'libero libero-rotation' : ''}`}>
                  <div className="lineup-rotation-pos">P{i + 1}</div>
                  <div className="lineup-rotation-jersey">
                    {jersey ? `#${jersey}` : '-'}
                  </div>
                  {player && player.name && (
                    <div className="lineup-rotation-name">
                      {player.name.split(' ')[0]}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {liberos.length > 0 && (
          <div className="liberos-section">
            <div className="liberos-title">Liberos</div>
            <div className="libero-list">
              {liberos.map((lib) => {
                const onCourt = lineupStrs.includes(String(lib.jersey));
                return (
                  <div key={lib.jersey} className="libero-item">
                    #{lib.jersey} {lib.name ? lib.name.split(' ')[0] : ''}
                    {onCourt && <span className="on-court-indicator">● ON COURT</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="stats-row">
          <div className="stat-item">
            <span className="stat-label">Timeouts Left</span>
            <span className="stat-value">{2 - timeoutsUsed} / 2</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Subs Left</span>
            <span className="stat-value">{subLimit - subsUsed} / {subLimit}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="lineup-container">
      <div className="lineup-header header-match">
        <div className="match-title">{gameData.competition || 'Lineup & Rotation Display'}</div>
        <div className="match-info">
          {[gameData.venue, gameData.matchDate].filter(Boolean).join(' | ') || '2nd Referee View'}
        </div>
      </div>

      <div className="lineup-score-display score-display-strip">
        <div className="lineup-score-item team-score-box">
          <div className="lineup-score-team team-name-big team-a-color">
            {gameData.teamAName || 'Team A'}
          </div>
          <div className="lineup-score-value score-big team-a-color">{scoreA}</div>
        </div>
        <div className="set-info-middle">
          <div className="set-number">SET {currentSet}</div>
          <div className="set-dots">
            {Array.from({ length: format }).map((_, i) => {
              const set = sets[i];
              const won = set?.winner;
              return (
                <div
                  key={i}
                  className={`set-dot ${won === 'A' ? 'set-won-a' : ''} ${won === 'B' ? 'set-won-b' : ''}`}
                >
                  {i + 1}
                </div>
              );
            })}
          </div>
        </div>
        <div className="lineup-score-item team-score-box">
          <div className="lineup-score-team team-name-big team-b-color">
            {gameData.teamBName || 'Team B'}
          </div>
          <div className="lineup-score-value score-big team-b-color">{scoreB}</div>
        </div>
      </div>

      <div className="lineups-container lineup-courts">
        {renderCourt('A')}
        {renderCourt('B')}
      </div>

      <button
        className="lineup-back-home"
        onClick={() => navigate('/display-select')}
      >
        ← Back to Display Selection
      </button>
    </div>
  );
}
