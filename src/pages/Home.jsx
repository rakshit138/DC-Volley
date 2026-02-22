import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { createGame, getGameByCode } from '../services/gameService';
import { generateGameCode } from '../utils/generateCode';
import './Home.css';

export default function Home() {
  const [gameCodeInput, setGameCodeInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { setGameCode } = useGame();
  const navigate = useNavigate();

  const handleStartNewGame = async () => {
    setLoading(true);
    setError('');

    try {
      // Generate unique game code
      let code = generateGameCode();
      let exists = await getGameByCode(code);
      
      // Ensure code is unique (retry if needed)
      let attempts = 0;
      while (exists && attempts < 10) {
        code = generateGameCode();
        exists = await getGameByCode(code);
        attempts++;
      }

      if (exists) {
        throw new Error('Unable to generate unique code. Please try again.');
      }

      // Create initial game data
      const initialGameData = {
        teamAName: 'Team A',
        teamBName: 'Team B',
        format: 3, // Best of 3
        sets: [{
          setNumber: 1,
          score: { A: 0, B: 0 },
          serving: 'A',
          timeouts: { A: [], B: [] },
          substitutions: { A: [], B: [] },
          startTime: new Date()
        }],
        teams: {
          A: {
            players: [],
            lineup: []
          },
          B: {
            players: [],
            lineup: []
          }
        }
      };

      await createGame(code, initialGameData);
      setGameCode(code);
      navigate('/display-select');
    } catch (err) {
      setError(err.message || 'Failed to create game. Please try again.');
      console.error('Error creating game:', err);
    } finally {
      setLoading(false);
    }
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
