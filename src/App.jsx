import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { GameProvider } from './context/GameContext';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import SplashScreen from './components/SplashScreen';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import GameSetup from './pages/GameSetup';
import DisplaySelect from './pages/DisplaySelect';
import Scoreboard from './pages/Scoreboard';
import RefereePanel from './pages/RefereePanel';
import Lineup from './pages/Lineup';
import './App.css';

const SPLASH_MS = 3000;

function App() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), SPLASH_MS);
    return () => clearTimeout(timer);
  }, []);

  if (showSplash) {
    return <SplashScreen />;
  }

  return (
    <GameProvider>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/scoreboard" element={<Scoreboard />} />
            <Route path="/lineup" element={<Lineup />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/home" element={<Home />} />
              <Route path="/game-setup" element={<GameSetup />} />
              <Route path="/display-select" element={<DisplaySelect />} />
              <Route path="/referee" element={<RefereePanel />} />
            </Route>
          </Routes>
        </Router>
      </AuthProvider>
    </GameProvider>
  );
}

export default App;
