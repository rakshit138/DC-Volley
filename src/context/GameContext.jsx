import { createContext, useContext, useState, useEffect } from 'react';
import { listenToGame } from '../services/gameService';
import { listenToGameAssets, mergeGameWithAssets } from '../services/gameAssetsService';

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
  const [gameAssets, setGameAssets] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!gameCode) {
      setGameData(null);
      setGameAssets(null);
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

  useEffect(() => {
    if (!gameCode) {
      setGameAssets(null);
      return;
    }
    return listenToGameAssets(gameCode, setGameAssets);
  }, [gameCode]);

  const mergedGameData = mergeGameWithAssets(gameData, gameAssets);

  const value = {
    gameCode,
    setGameCode,
    gameData: mergedGameData,
    gameAssets,
    role,
    setRole,
    loading,
    error,
    setError
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
