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

  const events = [...(gameData.matchSummary || [])].sort((a, b) => {
    const ta = a?.timestamp?.toDate ? a.timestamp.toDate().getTime() : new Date(a?.timestamp || 0).getTime();
    const tb = b?.timestamp?.toDate ? b.timestamp.toDate().getTime() : new Date(b?.timestamp || 0).getTime();
    return ta - tb;
  });

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
            🏆 Winner:{' '}
            <span style={{ color: setsWon.A > setsWon.B ? teamAColor : teamBColor, fontWeight: 700 }}>
              {setsWon.A > setsWon.B ? teamAName : teamBName}
            </span>
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
                    {set.winner ? (
                      <span style={{ color: set.winner === 'A' ? teamAColor : teamBColor, fontWeight: 700 }}>
                        {set.winner === 'A' ? teamAName : teamBName}
                      </span>
                    ) : (
                      '-'
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="summary-section">
          <h4>Chronological Event Log</h4>
          <div className="summary-sanction-log" style={{ fontSize: '12px', textAlign: 'left', maxHeight: '260px', overflowY: 'auto', color: '#fff' }}>
            {events.length === 0 ? (
              <div style={{ color: '#fff' }}>No events recorded.</div>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {events.map((e, i) => (
                  <li key={`${e.type || 'event'}-${i}`} style={{ marginBottom: 6, color: '#fff' }}>
                    <strong style={{ color: '#fff' }}>Set {e.setNumber || '-'}</strong> - {e.description || e.type || 'Event'}
                    {e.score ? (
                      <span>
                        {' ('}
                        {String(e.team) === 'B' ? (
                          <>
                            <span style={{ color: teamBColor, fontWeight: 'bold' }}>{e.score.B}</span>
                            <span style={{ color: '#fff' }}>-</span>
                            <span style={{ color: teamAColor, fontWeight: 'bold' }}>{e.score.A}</span>
                          </>
                        ) : (
                          <>
                            <span style={{ color: teamAColor, fontWeight: 'bold' }}>{e.score.A}</span>
                            <span style={{ color: '#fff' }}>-</span>
                            <span style={{ color: teamBColor, fontWeight: 'bold' }}>{e.score.B}</span>
                          </>
                        )}
                        {')'}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

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
