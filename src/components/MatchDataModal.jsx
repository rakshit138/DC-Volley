import React from 'react';
import './MatchDataModal.css';

export default function MatchDataModal({ open, gameData, onClose }) {
  if (!open || !gameData) return null;

  const matchInfo = {
    competition: gameData.competition || 'N/A',
    matchNumber: gameData.matchNumber || 'N/A',
    venue: gameData.venue || 'N/A',
    city: gameData.city || 'N/A',
    countryCode: gameData.countryCode || 'N/A',
    date: gameData.matchDate || gameData.date || 'N/A',
    time: gameData.matchTime || gameData.time || 'N/A',
    division: gameData.division || 'N/A',
    category: gameData.category || 'N/A',
    pool: gameData.pool || 'N/A',
    format: gameData.format || '3',
    subLimit: gameData.subLimit || '6',
    teamAName: gameData.teamAName || 'Team A',
    teamBName: gameData.teamBName || 'Team B'
  };

  const officials = gameData.officials || {};
  const sets = gameData.sets || [];
  const currentSet = gameData.currentSet || 1;
  const setsWon = gameData.setsWon || { A: 0, B: 0 };

  return (
    <div className="match-data-modal-overlay" onClick={onClose}>
      <div className="match-data-modal-content" onClick={(e) => e.stopPropagation()}>
        <h3 className="match-data-modal-title">💾 MATCH DATA</h3>
        
        <div className="match-data-section">
          <h4>Match Information</h4>
          <div className="match-data-grid">
            <div className="match-data-item">
              <span className="match-data-label">Competition:</span>
              <span className="match-data-value">{matchInfo.competition}</span>
            </div>
            <div className="match-data-item">
              <span className="match-data-label">Match Number:</span>
              <span className="match-data-value">{matchInfo.matchNumber}</span>
            </div>
            <div className="match-data-item">
              <span className="match-data-label">Venue:</span>
              <span className="match-data-value">{matchInfo.venue}</span>
            </div>
            <div className="match-data-item">
              <span className="match-data-label">City:</span>
              <span className="match-data-value">{matchInfo.city}</span>
            </div>
            <div className="match-data-item">
              <span className="match-data-label">Date:</span>
              <span className="match-data-value">{matchInfo.date}</span>
            </div>
            <div className="match-data-item">
              <span className="match-data-label">Time:</span>
              <span className="match-data-value">{matchInfo.time}</span>
            </div>
            <div className="match-data-item">
              <span className="match-data-label">Format:</span>
              <span className="match-data-value">Best of {matchInfo.format}</span>
            </div>
            <div className="match-data-item">
              <span className="match-data-label">Substitution Limit:</span>
              <span className="match-data-value">{matchInfo.subLimit} per set</span>
            </div>
          </div>
        </div>

        <div className="match-data-section">
          <h4>Teams</h4>
          <div className="match-data-grid">
            <div className="match-data-item">
              <span className="match-data-label">Team A:</span>
              <span className="match-data-value" style={{ color: gameData.teamAColor || '#ff6b6b' }}>
                {matchInfo.teamAName}
              </span>
            </div>
            <div className="match-data-item">
              <span className="match-data-label">Team B:</span>
              <span className="match-data-value" style={{ color: gameData.teamBColor || '#4ecdc4' }}>
                {matchInfo.teamBName}
              </span>
            </div>
            <div className="match-data-item">
              <span className="match-data-label">Sets Won:</span>
              <span className="match-data-value">
                {matchInfo.teamAName}: {setsWon.A} | {matchInfo.teamBName}: {setsWon.B}
              </span>
            </div>
          </div>
        </div>

        <div className="match-data-section">
          <h4>Current Set</h4>
          <div className="match-data-grid">
            <div className="match-data-item">
              <span className="match-data-label">Set Number:</span>
              <span className="match-data-value">{currentSet}</span>
            </div>
            {sets[currentSet - 1] && (
              <>
                <div className="match-data-item">
                  <span className="match-data-label">Score:</span>
                  <span className="match-data-value">
                    {matchInfo.teamAName}: {sets[currentSet - 1].score?.A || 0} | {matchInfo.teamBName}: {sets[currentSet - 1].score?.B || 0}
                  </span>
                </div>
                <div className="match-data-item">
                  <span className="match-data-label">Serving:</span>
                  <span className="match-data-value">
                    {sets[currentSet - 1].serving === 'A' ? matchInfo.teamAName : matchInfo.teamBName}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="match-data-section">
          <h4>Match Officials</h4>
          <div className="match-data-grid">
            <div className="match-data-item">
              <span className="match-data-label">1st Referee:</span>
              <span className="match-data-value">{officials.ref1 || 'N/A'}</span>
            </div>
            <div className="match-data-item">
              <span className="match-data-label">2nd Referee:</span>
              <span className="match-data-value">{officials.ref2 || 'N/A'}</span>
            </div>
            <div className="match-data-item">
              <span className="match-data-label">Scorer:</span>
              <span className="match-data-value">{officials.scorer || 'N/A'}</span>
            </div>
            <div className="match-data-item">
              <span className="match-data-label">Assistant Scorer:</span>
              <span className="match-data-value">{officials.assistScorer || 'N/A'}</span>
            </div>
          </div>
        </div>

        <div className="match-data-section">
          <h4>Game Code</h4>
          <div className="match-data-grid">
            <div className="match-data-item">
              <span className="match-data-label">Code:</span>
              <span className="match-data-value" style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                {gameData.gameCode || 'N/A'}
              </span>
            </div>
            <div className="match-data-item">
              <span className="match-data-label">Status:</span>
              <span className="match-data-value">
                {gameData.status === 'FINISHED' ? '🏆 FINISHED' : '▶️ LIVE'}
              </span>
            </div>
          </div>
        </div>

        <div className="match-data-modal-buttons">
          <button type="button" className="match-data-btn-close" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
