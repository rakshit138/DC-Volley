import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import {
  updateScore,
  updateSets,
  markGameFinished,
  undoLastPoint
} from '../services/gameService';
import './RefereePanel.css';

export default function RefereePanel() {
  const { gameCode, gameData, loading, error } = useGame();
  const navigate = useNavigate();
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!gameCode) {
      navigate('/');
    }
  }, [gameCode, navigate]);

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

    const currentSet = gameData.currentSet || 1;
    const sets = gameData.sets || [];
    const currentSetData = sets[currentSet - 1];

    if (!currentSetData) {
      setMessage('No current set data');
      return;
    }

    // Determine winner based on score
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

    if (!window.confirm('Are you sure you want to mark this game as finished?')) {
      return;
    }

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
          <button onClick={() => navigate('/')} className="referee-back-btn">
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const currentSet = gameData.currentSet || 1;
  const sets = gameData.sets || [];
  const currentSetData = sets[currentSet - 1];
  const setsWon = gameData.setsWon || { A: 0, B: 0 };
  const status = gameData.status || 'LIVE';

  if (!currentSetData) {
    return (
      <div className="referee-container">
        <div className="referee-no-data">Waiting for match to start...</div>
      </div>
    );
  }

  const scoreA = currentSetData.score?.A || 0;
  const scoreB = currentSetData.score?.B || 0;

  return (
    <div className="referee-container">
      <div className="referee-header">
        <h1>⚖️ Referee Control Panel</h1>
        <p>Game Code: <strong>{gameCode}</strong></p>
        <p>Status: <strong className={status === 'LIVE' ? 'status-live' : 'status-finished'}>{status}</strong></p>
      </div>

      <div className="referee-score-display">
        <div className="referee-team-score">
          <div className="referee-team-name team-a-color">
            {gameData.teamAName || 'Team A'}
          </div>
          <div className="referee-score-value team-a-color">{scoreA}</div>
          <div className="referee-sets-won">Sets: {setsWon.A}</div>
        </div>

        <div className="referee-set-info">
          <div className="referee-set-number">Set {currentSet}</div>
          <div className="referee-set-dots">
            {Array.from({ length: gameData.format || 3 }).map((_, i) => {
              const set = sets[i];
              const isWon = set?.winner;
              let dotClass = 'referee-set-dot';
              if (isWon === 'A') dotClass += ' set-won-a';
              else if (isWon === 'B') dotClass += ' set-won-b';
              return (
                <div key={i} className={dotClass}>
                  {i + 1}
                </div>
              );
            })}
          </div>
        </div>

        <div className="referee-team-score">
          <div className="referee-team-name team-b-color">
            {gameData.teamBName || 'Team B'}
          </div>
          <div className="referee-score-value team-b-color">{scoreB}</div>
          <div className="referee-sets-won">Sets: {setsWon.B}</div>
        </div>
      </div>

      <div className="referee-controls">
        <div className="referee-control-row">
          <button
            className="referee-btn referee-btn-point team-a-btn"
            onClick={() => handleScoreUpdate('A')}
            disabled={updating || status === 'FINISHED'}
          >
            +1 Team A
          </button>
          <button
            className="referee-btn referee-btn-point team-b-btn"
            onClick={() => handleScoreUpdate('B')}
            disabled={updating || status === 'FINISHED'}
          >
            +1 Team B
          </button>
        </div>

        <div className="referee-control-row">
          <button
            className="referee-btn referee-btn-undo"
            onClick={handleUndo}
            disabled={updating || status === 'FINISHED'}
          >
            ↶ Undo
          </button>
          <button
            className="referee-btn referee-btn-next-set"
            onClick={handleNextSet}
            disabled={updating || status === 'FINISHED'}
          >
            Next Set
          </button>
        </div>

        <div className="referee-control-row">
          <button
            className="referee-btn referee-btn-finish"
            onClick={handleFinishGame}
            disabled={updating || status === 'FINISHED'}
          >
            Mark Game as Finished
          </button>
        </div>
      </div>

      {message && (
        <div className={`referee-message ${message.includes('Error') ? 'error' : 'success'}`}>
          {message}
        </div>
      )}

      <button
        className="referee-back-home"
        onClick={() => navigate('/display-select')}
      >
        ← Back to Display Selection
      </button>
    </div>
  );
}
