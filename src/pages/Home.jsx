import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { getGameByCode } from '../services/gameService';
import './Home.css';

export default function Home() {
  const [gameCodeInput, setGameCodeInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { setGameCode } = useGame();
  const navigate = useNavigate();

  const handleStartNewGame = () => {
    // Navigate to setup screen instead of creating game directly
    navigate('/game-setup');
  };

  const handleJoinGame = async () => {
    const code = gameCodeInput.trim().toUpperCase();
    
    if (!code || code.length !== 6) {
      setError('Please enter a valid 6-character game code.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const game = await getGameByCode(code);
      
      if (!game) {
        setError('Game not found. Please check the code and try again.');
        setLoading(false);
        return;
      }

      setGameCode(code);
      navigate('/display-select');
    } catch (err) {
      setError(err.message || 'Failed to join game. Please try again.');
      console.error('Error joining game:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="home-container">
      <div className="home-card">
        <h1 className="home-title">🏐 DC Volley</h1>
        <p className="home-subtitle">Real-Time Volleyball Scoreboard</p>

        <div className="home-input-group">
          <input
            type="text"
            className="home-input"
            placeholder="Enter Game Code"
            value={gameCodeInput}
            onChange={(e) => {
              setGameCodeInput(e.target.value.toUpperCase().slice(0, 6));
              setError('');
            }}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleJoinGame();
              }
            }}
            maxLength={6}
            disabled={loading}
          />
          <button
            className="home-btn home-btn-primary"
            onClick={handleJoinGame}
            disabled={loading || !gameCodeInput.trim()}
          >
            {loading ? 'Joining...' : 'Join Game'}
          </button>
        </div>

        <div className="home-divider">
          <span>OR</span>
        </div>

        <button
          className="home-btn home-btn-secondary"
          onClick={handleStartNewGame}
          disabled={loading}
        >
          {loading ? 'Creating...' : 'Start New Game'}
        </button>

        {error && (
          <div className="home-error">
            {error}
          </div>
        )}

        {loading && (
          <div className="home-loading">
            <div className="spinner"></div>
          </div>
        )}
      </div>
    </div>
  );
}
