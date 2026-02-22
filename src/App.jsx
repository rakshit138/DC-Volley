import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { GameProvider } from './context/GameContext';
import Home from './pages/Home';
import DisplaySelect from './pages/DisplaySelect';
import Scoreboard from './pages/Scoreboard';
import RefereePanel from './pages/RefereePanel';
import Lineup from './pages/Lineup';
import './App.css';

function App() {
  return (
    <GameProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/display-select" element={<DisplaySelect />} />
          <Route path="/scoreboard" element={<Scoreboard />} />
          <Route path="/referee" element={<RefereePanel />} />
          <Route path="/lineup" element={<Lineup />} />
        </Routes>
      </Router>
    </GameProvider>
  );
}

export default App;
