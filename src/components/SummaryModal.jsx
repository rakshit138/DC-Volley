import React from 'react';
import './SummaryModal.css';

export default function SummaryModal({ open, gameData, onClose, onExportPDF }) {
  if (!open || !gameData) return null;

  const teamAName = gameData.teamAName || 'Team A';
  const teamBName = gameData.teamBName || 'Team B';
  const teamAColor = gameData.teamAColor || '#ff6b6b';
  const teamBColor = gameData.teamBColor || '#4ecdc4';
  const sets = gameData.sets || [];
  const setsWon = gameData.setsWon || { A: 0, B: 0 };

  // Calculate total timeouts
  let totalTimeoutsA = 0;
  let totalTimeoutsB = 0;
  sets.forEach((set) => {
    if (set.timeouts) {
      totalTimeoutsA += (set.timeouts.A || []).length;
      totalTimeoutsB += (set.timeouts.B || []).length;
    }
  });

  // Calculate total substitutions (completed)
  let totalSubsA = 0;
  let totalSubsB = 0;
  sets.forEach((set) => {
    if (set.substitutions) {
      totalSubsA += (set.substitutions.A || []).length;
      totalSubsB += (set.substitutions.B || []).length;
    }
  });

  // Calculate total exceptional substitutions
  let totalExcSubsA = 0;
  let totalExcSubsB = 0;
  sets.forEach((set) => {
    if (set.exceptionalSubstitutions) {
      totalExcSubsA += (set.exceptionalSubstitutions.A || []).length;
      totalExcSubsB += (set.exceptionalSubstitutions.B || []).length;
    }
  });

  // Calculate total sanctions
  let totalSanctionsA = 0;
  let totalSanctionsB = 0;
  if (gameData.sanctionSystem) {
    totalSanctionsA = (gameData.sanctionSystem.misconduct?.A || []).length + 
                      (gameData.sanctionSystem.delay?.A?.log || []).length;
    totalSanctionsB = (gameData.sanctionSystem.misconduct?.B || []).length + 
                      (gameData.sanctionSystem.delay?.B?.log || []).length;
  }

  return (
    <div className="summary-modal-overlay" onClick={onClose}>
      <div className="summary-modal-content" onClick={(e) => e.stopPropagation()}>
        <h3 className="summary-modal-title">📊 MATCH SUMMARY</h3>
        
        <div className="summary-section">
          <h4>Match Result</h4>
          <div className="summary-result">
            <div className="summary-team" style={{ color: teamAColor }}>
              <div className="summary-team-name">{teamAName}</div>
              <div className="summary-sets-won">{setsWon.A}</div>
            </div>
            <div className="summary-vs">vs</div>
            <div className="summary-team" style={{ color: teamBColor }}>
              <div className="summary-team-name">{teamBName}</div>
              <div className="summary-sets-won">{setsWon.B}</div>
            </div>
          </div>
          <div className="summary-winner">
            🏆 Winner: {setsWon.A > setsWon.B ? teamAName : teamBName}
          </div>
        </div>

        <div className="summary-section">
          <h4>Set-by-Set Scores</h4>
          <div className="summary-sets-table">
            <div className="summary-sets-header">
              <div>Set</div>
              <div style={{ color: teamAColor }}>{teamAName}</div>
              <div style={{ color: teamBColor }}>{teamBName}</div>
              <div>Winner</div>
            </div>
            {sets.map((set, idx) => {
              if (!set.winner && set.score?.A === 0 && set.score?.B === 0) return null;
              return (
                <div key={idx} className="summary-sets-row">
                  <div className="summary-set-number">Set {idx + 1}</div>
                  <div style={{ color: teamAColor }}>{set.score?.A || 0}</div>
                  <div style={{ color: teamBColor }}>{set.score?.B || 0}</div>
                  <div>
                    {set.winner ? (set.winner === 'A' ? teamAName : teamBName) : '-'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="summary-section">
          <h4>Statistics</h4>
          <div className="summary-stats-grid">
            <div className="summary-stat-item">
              <div className="summary-stat-label">Timeouts</div>
              <div className="summary-stat-values">
                <span style={{ color: teamAColor }}>{teamAName}: {totalTimeoutsA} / 2 per set</span>
                <span style={{ color: teamBColor }}>{teamBName}: {totalTimeoutsB} / 2 per set</span>
              </div>
            </div>
            <div className="summary-stat-item">
              <div className="summary-stat-label">Substitutions</div>
              <div className="summary-stat-values">
                <span style={{ color: teamAColor }}>{teamAName}: {totalSubsA}</span>
                <span style={{ color: teamBColor }}>{teamBName}: {totalSubsB}</span>
              </div>
            </div>
            <div className="summary-stat-item">
              <div className="summary-stat-label">Exceptional Substitutions</div>
              <div className="summary-stat-values">
                <span style={{ color: teamAColor }}>{teamAName}: {totalExcSubsA}</span>
                <span style={{ color: teamBColor }}>{teamBName}: {totalExcSubsB}</span>
              </div>
            </div>
            <div className="summary-stat-item">
              <div className="summary-stat-label">Sanctions</div>
              <div className="summary-stat-values">
                <span style={{ color: teamAColor }}>{teamAName}: {totalSanctionsA}</span>
                <span style={{ color: teamBColor }}>{teamBName}: {totalSanctionsB}</span>
              </div>
            </div>
          </div>
        </div>

        {gameData.sanctionSystem && (totalSanctionsA + totalSanctionsB > 0) && (
          <div className="summary-section">
            <h4>Sanctions log</h4>
            <div className="summary-sanction-log" style={{ fontSize: '12px', textAlign: 'left', maxHeight: '200px', overflowY: 'auto' }}>
              {['A', 'B'].map((t) => (
                <div key={t} style={{ marginBottom: '10px' }}>
                  <strong style={{ color: t === 'A' ? teamAColor : teamBColor }}>
                    {t === 'A' ? teamAName : teamBName}
                  </strong>
                  <ul style={{ margin: '6px 0 0 12px', padding: 0, listStyle: 'disc' }}>
                    {(gameData.sanctionSystem.misconduct?.[t] || []).map((r, i) => (
                      <li key={`m-${t}-${i}`}>
                        Set {r.set}: {r.type} — {r.personType === 'coach' ? 'Coach' : `#${r.person}`}
                        {r.reason ? ` (${r.reason})` : ''}
                      </li>
                    ))}
                    {(gameData.sanctionSystem.delay?.[t]?.log || []).map((r, i) => (
                      <li key={`d-${t}-${i}`}>
                        Set {r.set}: Delay {r.type}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="summary-modal-buttons">
          {onExportPDF && (
            <button 
              type="button" 
              className="summary-btn-export" 
              onClick={onExportPDF}
              style={{ background: '#00ff00', color: '#000' }}
            >
              📥 Export PDF
            </button>
          )}
          <button type="button" className="summary-btn-close" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
