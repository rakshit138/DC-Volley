import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import './DisplaySelect.css';

export default function DisplaySelect() {
  const { gameCode, setRole } = useGame();
  const navigate = useNavigate();

  const handleSelectRole = (selectedRole) => {
    // Store role locally (not in backend)
    setRole(selectedRole);
    localStorage.setItem(`dc-volley-role-${gameCode}`, selectedRole);

    // Navigate to appropriate screen
    switch (selectedRole) {
      case 'scoreboard':
        navigate('/scoreboard');
        break;
      case 'referee':
        navigate('/referee');
        break;
      case 'lineup':
        navigate('/lineup');
        break;
      default:
        break;
    }
  };

  return (
    <div className="display-select-container">
      <div className="display-select-card">
        <h1 className="display-select-title">Select Display Mode</h1>
        <p className="display-select-subtitle">Game Code: <strong>{gameCode}</strong></p>

        <div className="display-select-options">
          <button
            className="display-option-btn"
            onClick={() => handleSelectRole('scoreboard')}
          >
            <div className="display-option-icon">📺</div>
            <div className="display-option-title">Scoreboard Display</div>
            <div className="display-option-desc">Public View - Read Only</div>
          </button>

          <button
            className="display-option-btn"
            onClick={() => handleSelectRole('referee')}
          >
            <div className="display-option-icon">⚖️</div>
            <div className="display-option-title">Referee Panel</div>
            <div className="display-option-desc">Score Control - Full Access</div>
          </button>

          <button
            className="display-option-btn"
            onClick={() => handleSelectRole('lineup')}
          >
            <div className="display-option-icon">👥</div>
            <div className="display-option-title">Lineup Display</div>
            <div className="display-option-desc">Player Positions - Read Only</div>
          </button>
        </div>

        <button
          className="display-select-back"
          onClick={() => navigate('/')}
        >
          ← Back to Home
        </button>
      </div>
    </div>
  );
}
