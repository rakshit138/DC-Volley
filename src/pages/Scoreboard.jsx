import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import './Scoreboard.css';

export default function Scoreboard() {
  const { gameCode, setGameCode, gameData, loading, error } = useGame();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const codeFromUrl = searchParams.get('code');

  useEffect(() => {
    const normalized = codeFromUrl?.trim();
    if (normalized && normalized !== gameCode) {
      setGameCode(normalized);
    }
  }, [codeFromUrl, gameCode, setGameCode]);

  useEffect(() => {
    if (!gameCode && !codeFromUrl) {
      navigate('/');
    }
  }, [gameCode, codeFromUrl, navigate]);

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
          <button onClick={() => navigate('/home')} className="scoreboard-back-btn">
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
  const timeoutsUsedA = currentSetData.timeouts?.A?.length ?? 0;
  const timeoutsUsedB = currentSetData.timeouts?.B?.length ?? 0;
  const subsUsedA = currentSetData.substitutions?.A?.length ?? 0;
  const subsUsedB = currentSetData.substitutions?.B?.length ?? 0;
  const subLimit = gameData.subLimit ?? 6;
  const teamAColor = gameData.teamAColor || '#ff6b6b';
  const teamBColor = gameData.teamBColor || '#4ecdc4';

  return (
    <div className="scoreboard-container">
      <div className="scoreboard">
        {/* Score Container */}
        <div className="scoreboard-scores">
          {/* Team A */}
          <div className="scoreboard-team">
            <div className="scoreboard-team-name team-a-color" style={{ color: teamAColor }}>
              {gameData.teamAName || 'Team A'}
            </div>
            <div className="scoreboard-score-box team-a-border" style={{ borderColor: teamAColor }}>
              {serving === 'A' && (
                <div className="scoreboard-serving">🏐</div>
              )}
              <div className="scoreboard-score team-a-color" style={{ color: teamAColor }}>{scoreA}</div>
            </div>
          </div>

          {/* Team B */}
          <div className="scoreboard-team">
            <div className="scoreboard-team-name team-b-color" style={{ color: teamBColor }}>
              {gameData.teamBName || 'Team B'}
            </div>
            <div className="scoreboard-score-box team-b-border" style={{ borderColor: teamBColor }}>
              {serving === 'B' && (
                <div className="scoreboard-serving">🏐</div>
              )}
              <div className="scoreboard-score team-b-color" style={{ color: teamBColor }}>{scoreB}</div>
            </div>
          </div>
        </div>

        {/* Set Indicator */}
        <div className="scoreboard-set-indicator">
          <div
            className="scoreboard-set-number"
            style={{
              background: `linear-gradient(90deg, ${teamAColor}, ${teamBColor})`,
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
              WebkitTextFillColor: 'transparent'
            }}
          >
            SET {currentSet}
          </div>
          <div className="scoreboard-set-dots">
            {Array.from({ length: format }).map((_, i) => {
              const set = sets[i];
              const isWon = set?.winner;
              const base = { borderColor: '#fff' };
              if (isWon === 'A') {
                return (
                  <div
                    key={i}
                    className="scoreboard-set-dot"
                    style={{
                      ...base,
                      background: teamAColor,
                      borderColor: teamAColor,
                      color: '#fff',
                      boxShadow: `0 0 22px ${teamAColor}`
                    }}
                  >
                    {i + 1}
                  </div>
                );
              }
              if (isWon === 'B') {
                return (
                  <div
                    key={i}
                    className="scoreboard-set-dot"
                    style={{
                      ...base,
                      background: teamBColor,
                      borderColor: teamBColor,
                      color: '#fff',
                      boxShadow: `0 0 22px ${teamBColor}`
                    }}
                  >
                    {i + 1}
                  </div>
                );
              }
              return (
                <div key={i} className="scoreboard-set-dot" style={base}>
                  {i + 1}
                </div>
              );
            })}
          </div>
          <div className="scoreboard-set-legend">
            <div className="scoreboard-legend-item">
              <div className="scoreboard-legend-dot" style={{ background: teamAColor, boxShadow: `0 0 12px ${teamAColor}` }} />
              <span style={{ color: teamAColor }}>{gameData.teamAName || 'Team A'}</span>
            </div>
            <div className="scoreboard-legend-item">
              <div className="scoreboard-legend-dot" style={{ background: teamBColor, boxShadow: `0 0 12px ${teamBColor}` }} />
              <span style={{ color: teamBColor }}>{gameData.teamBName || 'Team B'}</span>
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="scoreboard-footer">
          <div className="scoreboard-footer-item">
            <div className="scoreboard-footer-label-row">
              <span className="scoreboard-footer-label">SETS</span>
            </div>
            <div className="scoreboard-footer-value">
              <span style={{ color: teamAColor }}>{setsWon.A}</span>
              <span className="scoreboard-footer-sep"> — </span>
              <span style={{ color: teamBColor }}>{setsWon.B}</span>
            </div>
          </div>
          <div className="scoreboard-footer-item">
            <div className="scoreboard-footer-label-row">
              <span className="scoreboard-footer-label">TIMEOUTS</span>
            </div>
            <div className="scoreboard-footer-value">
              <span style={{ color: teamAColor }}>{2 - timeoutsUsedA}</span>
              <span className="scoreboard-footer-sep"> — </span>
              <span style={{ color: teamBColor }}>{2 - timeoutsUsedB}</span>
            </div>
          </div>
          <div className="scoreboard-footer-item">
            <div className="scoreboard-footer-label-row">
              <span className="scoreboard-footer-label">SUBS</span>
            </div>
            <div className="scoreboard-footer-value">
              <span style={{ color: teamAColor }}>{subLimit - subsUsedA}</span>
              <span className="scoreboard-footer-sep"> — </span>
              <span style={{ color: teamBColor }}>{subLimit - subsUsedB}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Winner Announcement */}
      {status === 'FINISHED' && (
        <div className="scoreboard-winner">
          <div className="scoreboard-winner-trophy">🏆</div>
          <div className="scoreboard-winner-text">MATCH WINNER</div>
          <div
            className="scoreboard-winner-team"
            style={{
              color: setsWon.A > setsWon.B ? teamAColor : teamBColor,
              textShadow: `0 0 40px ${setsWon.A > setsWon.B ? teamAColor : teamBColor}`
            }}
          >
            {setsWon.A > setsWon.B
              ? gameData.teamAName || 'Team A'
              : gameData.teamBName || 'Team B'}
          </div>
          <div className="scoreboard-winner-score">
            Wins {Math.max(setsWon.A, setsWon.B)} - {Math.min(setsWon.A, setsWon.B)}
          </div>
        </div>
      )}
    </div>
  );
}
