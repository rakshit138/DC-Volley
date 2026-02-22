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

  const renderCourt = (team) => {
    const teamData = teams[team] || {};
    const lineup = teamData.lineup || [];
    const players = teamData.players || [];
    const teamName = team === 'A' ? gameData.teamAName : gameData.teamBName;

    // Position order for display: P4, P3, P2, P5, P6, P1
    const posOrder = [3, 2, 1, 4, 5, 0];
    const labels = ['P4-LF', 'P3-MF', 'P2-RF', 'P5-LB', 'P6-MB', 'P1-RB'];

    return (
      <div className="lineup-team-section">
        <div className="lineup-team-header">
          <h3 className={team === 'A' ? 'team-a-color' : 'team-b-color'}>
            {teamName || `Team ${team}`}
          </h3>
        </div>

        <div className="lineup-court">
          <div className="lineup-court-grid">
            {posOrder.map((idx, i) => {
              const jersey = lineup[idx];
              const player = players.find(p => p.jersey === jersey);
              const isServer = idx === 0 && serving === team;
              const isLibero = player && (player.role === 'libero1' || player.role === 'libero2');

              return (
                <div
                  key={i}
                  className={`lineup-court-pos ${isServer ? 'server' : ''} ${isLibero ? 'libero' : ''}`}
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
          <div className="lineup-rotation-title">Rotation Order</div>
          <div className="lineup-rotation-list">
            {Array.from({ length: 6 }).map((_, i) => {
              const jersey = lineup[i];
              const player = players.find(p => p.jersey === jersey);
              const isLibero = player && (player.role === 'libero1' || player.role === 'libero2');

              return (
                <div key={i} className={`lineup-rotation-item ${isLibero ? 'libero' : ''}`}>
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
      </div>
    );
  };

  return (
    <div className="lineup-container">
      <div className="lineup-header">
        <h1>👥 Lineup Display</h1>
        <p>Game Code: <strong>{gameCode}</strong></p>
        <p>Set {currentSet}</p>
      </div>

      <div className="lineup-score-display">
        <div className="lineup-score-item">
          <div className={`lineup-score-team team-a-color`}>
            {gameData.teamAName || 'Team A'}
          </div>
          <div className={`lineup-score-value team-a-color`}>{scoreA}</div>
        </div>
        <div className="lineup-score-separator">-</div>
        <div className="lineup-score-item">
          <div className={`lineup-score-team team-b-color`}>
            {gameData.teamBName || 'Team B'}
          </div>
          <div className={`lineup-score-value team-b-color`}>{scoreB}</div>
        </div>
      </div>

      <div className="lineup-courts">
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
