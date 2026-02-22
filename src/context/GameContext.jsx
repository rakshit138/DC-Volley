import { createContext, useContext, useState, useEffect } from 'react';
import { listenToGame } from '../services/gameService';

const GameContext = createContext();

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}

export function GameProvider({ children }) {
  const [gameCode, setGameCode] = useState(null);
  const [gameData, setGameData] = useState(null);
  const [role, setRole] = useState(null); // 'scoreboard', 'referee', 'lineup'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Set up real-time listener when gameCode changes
  useEffect(() => {
    if (!gameCode) {
      setGameData(null);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = listenToGame(gameCode, (data) => {
      setGameData(data);
      setLoading(false);
      if (!data) {
        setError('Game not found');
      }
    });

    return () => unsubscribe();
  }, [gameCode]);

  const value = {
    gameCode,
    setGameCode,
    gameData,
    role,
    setRole,
    loading,
    error,
    setError
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
