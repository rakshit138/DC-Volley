import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import './Scoreboard.css';

export default function Scoreboard() {
  const { gameCode, gameData, loading, error } = useGame();
  const navigate = useNavigate();

  useEffect(() => {
    if (!gameCode) {
      navigate('/');
    }
  }, [gameCode, navigate]);

  if (loading) {
    return (
      <div className="scoreboard-container">
        <div className="scoreboard-loading">Loading game data...</div>
      </div>
    );
  }

  if (error || !gameData) {
    return (
      <div className="scoreboard-container">
        <div className="scoreboard-error">
          {error || 'Game not found'}
          <button onClick={() => navigate('/')} className="scoreboard-back-btn">
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const currentSet = gameData.currentSet || 1;
  const sets = gameData.sets || [];
  const currentSetData = sets[currentSet - 1];
  const format = gameData.format || 3;
  const status = gameData.status || 'LIVE';
  const setsWon = gameData.setsWon || { A: 0, B: 0 };

  if (!currentSetData) {
    return (
      <div className="scoreboard-container">
        <div className="scoreboard-no-data">Waiting for match to start...</div>
      </div>
    );
  }

  const scoreA = currentSetData.score?.A || 0;
  const scoreB = currentSetData.score?.B || 0;
  const serving = currentSetData.serving || 'A';

  return (
    <div className="scoreboard-container">
      <div className="scoreboard">
        {/* Match Header */}
        <div className="scoreboard-header">
          <div className="scoreboard-title">
            {gameData.competition || 'VOLLEYBALL MATCH'}
          </div>
          {(gameData.venue || gameData.matchDate) && (
            <div className="scoreboard-subtitle">
              {gameData.venue || ''}
              {gameData.venue && gameData.matchDate ? ' | ' : ''}
              {gameData.matchDate || ''}
            </div>
          )}
        </div>

        {/* Score Container */}
        <div className="scoreboard-scores">
          {/* Team A */}
          <div className="scoreboard-team">
            <div className="scoreboard-team-name team-a-color">
              {gameData.teamAName || 'Team A'}
            </div>
            <div className="scoreboard-score-box team-a-border">
              {serving === 'A' && (
                <div className="scoreboard-serving">🏐</div>
              )}
              <div className="scoreboard-score team-a-color">{scoreA}</div>
            </div>
          </div>

          {/* Team B */}
          <div className="scoreboard-team">
            <div className="scoreboard-team-name team-b-color">
              {gameData.teamBName || 'Team B'}
            </div>
            <div className="scoreboard-score-box team-b-border">
              {serving === 'B' && (
                <div className="scoreboard-serving">🏐</div>
              )}
              <div className="scoreboard-score team-b-color">{scoreB}</div>
            </div>
          </div>
        </div>

        {/* Set Indicator */}
        <div className="scoreboard-set-indicator">
          <div className="scoreboard-set-number">SET {currentSet}</div>
          <div className="scoreboard-set-dots">
            {Array.from({ length: format }).map((_, i) => {
              const set = sets[i];
              const isWon = set?.winner;
              let dotClass = 'scoreboard-set-dot';
              
              if (isWon === 'A') {
                dotClass += ' set-won-a';
              } else if (isWon === 'B') {
                dotClass += ' set-won-b';
              }

              return (
                <div key={i} className={dotClass}>
                  {i + 1}
                </div>
              );
            })}
          </div>
          <div className="scoreboard-set-legend">
            <div className="scoreboard-legend-item">
              <div className="scoreboard-legend-dot team-a-dot"></div>
              <span className="team-a-color">{gameData.teamAName || 'Team A'}</span>
            </div>
            <div className="scoreboard-legend-item">
              <div className="scoreboard-legend-dot team-b-dot"></div>
              <span className="team-b-color">{gameData.teamBName || 'Team B'}</span>
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="scoreboard-footer">
          <div className="scoreboard-footer-item">
            <div className="scoreboard-footer-label">SETS WON</div>
            <div className="scoreboard-footer-value">
              {setsWon.A} - {setsWon.B}
            </div>
          </div>
          <div className="scoreboard-footer-item">
            <div className="scoreboard-footer-label">STATUS</div>
            <div className="scoreboard-footer-value status-live">
              {status}
            </div>
          </div>
        </div>
      </div>

      {/* Winner Announcement */}
      {status === 'FINISHED' && (
        <div className="scoreboard-winner">
          <div className="scoreboard-winner-trophy">🏆</div>
          <div className="scoreboard-winner-text">MATCH WINNER</div>
          <div className={`scoreboard-winner-team ${
            setsWon.A > setsWon.B ? 'team-a-color' : 'team-b-color'
          }`}>
            {setsWon.A > setsWon.B 
              ? gameData.teamAName || 'Team A'
              : gameData.teamBName || 'Team B'
            }
          </div>
          <div className="scoreboard-winner-score">
            Wins {Math.max(setsWon.A, setsWon.B)} - {Math.min(setsWon.A, setsWon.B)}
          </div>
        </div>
      )}
    </div>
  );
}
