import { useState, useEffect } from 'react';
import { allowsP1Replacement } from '../utils/liberoServe';
import './LiberoModal.css';

const BACK_ROW_INDICES = [0, 4, 5];
const INDEX_TO_POS = { 0: 1, 4: 5, 5: 6 };

export default function LiberoModal({ open, team, teamName, teams, currentSet, sets, serving, liberoReplacements, liberoServeConfig, gameData, onConfirm, onRemove, onClose }) {
  const [selectedLibero, setSelectedLibero] = useState(null);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [selectedPlayerOut, setSelectedPlayerOut] = useState(null);

  useEffect(() => {
    if (open) {
      setSelectedLibero(null);
      setSelectedPosition(null);
      setSelectedPlayerOut(null);
    }
  }, [open]);

  if (!open || !teams?.[team]) return null;

  const roster = teams[team].players || [];
  const lineup = teams[team].lineup || [];
  const isLiberoRole = (r) => r === 'libero1' || r === 'libero2' || r === 'liberocaptain';
  const liberos = roster.filter((p) => isLiberoRole(p.role));
  const liberoJerseysSet = new Set(liberos.map((p) => String(p.jersey)));

  const lineupPadded = [...lineup];
  while (lineupPadded.length < 6) lineupPadded.push(null);

  // Check which libero is on court
  const liberoOnCourt = lineupPadded.find((j) => j != null && liberoJerseysSet.has(String(j)));
  const liberoOnCourtIndex = liberoOnCourt ? lineupPadded.findIndex((j) => j != null && liberoJerseysSet.has(String(j))) : -1;
  const liberoOnCourtPlayer = liberoOnCourt ? roster.find((p) => String(p.jersey) === String(liberoOnCourt)) : null;

  // Get back row players (can be replaced by libero)
  const backRowPlayers = BACK_ROW_INDICES.map((idx) => {
    const jersey = lineupPadded[idx];
    const player = jersey ? roster.find((p) => String(p.jersey) === String(jersey)) : null;
    return { index: idx, position: INDEX_TO_POS[idx], jersey, player };
  }).filter((p) => p.jersey != null && !liberoJerseysSet.has(String(p.jersey)));

  const handleConfirm = () => {
    if (selectedLibero && selectedPosition != null && selectedPlayerOut) {
      // Check if trying to replace P1 while serving
      const isServing = selectedPosition === 0 && serving === team;
      if (isServing) {
        // Check if libero can serve for this player
        const canServe = allowsP1Replacement(
          team,
          selectedPlayerOut,
          INDEX_TO_POS[selectedPosition],
          liberoServeConfig || {},
          gameData || {}
        );
        
        if (!canServe) {
          alert('⛔ LIBERO CANNOT SERVE!\n\nFIVB Rule: The Libero is NOT allowed to serve.\n\nPosition P1 (Right Back) is currently the serving position.\n\nTo allow libero serving: in the lineup setup, select a designated player under the Libero Serving Rule option.');
          return;
        }
      }
      
      onConfirm(team, selectedPosition, selectedLibero, selectedPlayerOut);
      setSelectedLibero(null);
      setSelectedPosition(null);
      setSelectedPlayerOut(null);
      onClose();
    }
  };

  const handleRemove = () => {
    if (liberoOnCourt && onRemove) {
      onRemove(team, liberoOnCourt);
      onClose();
    }
  };

  const handleClose = () => {
    setSelectedLibero(null);
    setSelectedPosition(null);
    setSelectedPlayerOut(null);
    onClose();
  };

  return (
    <div className="libero-modal-overlay" onClick={handleClose}>
      <div className="libero-modal-content" onClick={(e) => e.stopPropagation()}>
        <h3 className="libero-modal-title">Libero Replacement – {teamName}</h3>
        
        {liberos.length === 0 ? (
          <p className="libero-modal-info">No libero in roster for this team.</p>
        ) : liberoOnCourt ? (
          <>
            <p className="libero-modal-info" style={{ color: '#ffd700' }}>
              Libero #{liberoOnCourt} {liberoOnCourtPlayer?.name || ''} is on court at P{liberoOnCourtIndex + 1}.
            </p>
            <p className="libero-modal-info">Only one libero may be on court at a time.</p>
            <div className="libero-modal-buttons">
              <button type="button" className="libero-btn cancel" onClick={handleClose}>
                Cancel
              </button>
              {onRemove && (
                <button type="button" className="libero-btn remove" onClick={handleRemove}>
                  Remove Libero from Court
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="libero-modal-info">
              Select a libero, then select a back-row player to replace (P1, P5, P6).
            </p>
            
            <div className="libero-modal-section">
              <h4>Available Liberos</h4>
              <div className="libero-modal-libero-grid">
                {liberos.map((libero) => {
                  const isSelected = selectedLibero === String(libero.jersey);
                  const isCaptain = libero.role === 'liberocaptain' || libero.role === 'captain';
                  return (
                    <button
                      key={libero.jersey}
                      type="button"
                      className={`libero-modal-libero-btn ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedLibero(String(libero.jersey));
                        setSelectedPosition(null);
                        setSelectedPlayerOut(null);
                      }}
                    >
                      #{libero.jersey} {libero.name}
                      {isCaptain && <span className="libero-badge">C</span>}
                      {libero.role === 'libero1' && <span className="libero-badge">L1</span>}
                      {libero.role === 'libero2' && <span className="libero-badge">L2</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedLibero && (
              <div className="libero-modal-section">
                <h4>Back Row Players (Can be replaced by Libero)</h4>
                <div className="libero-modal-positions">
                  {backRowPlayers.map(({ index, position, jersey, player }) => {
                    const isSelected = selectedPosition === index && selectedPlayerOut === jersey;
                    const isServing = index === 0 && serving === team;
                    const canServe = isServing && allowsP1Replacement(
                      team,
                      jersey,
                      position,
                      liberoServeConfig || {},
                      gameData || {}
                    );
                    const cannotReplace = isServing && !canServe;
                    const posLabel = position === 1 ? 'P1-RB (Back)' : position === 5 ? 'P5-LB (Back)' : 'P6-MB (Back)';
                    const badge = player?.role === 'captain' ? ' (C)' : '';
                    
                    return (
                      <button
                        key={position}
                        type="button"
                        className={`libero-modal-pos-btn ${isSelected ? 'selected' : ''} ${cannotReplace ? 'disabled' : ''}`}
                        onClick={() => {
                          if (cannotReplace) {
                            alert('⛔ LIBERO CANNOT SERVE!\n\nFIVB Rule: The Libero is NOT allowed to serve.\n\nPosition P1 is currently the serving position.');
                            return;
                          }
                          setSelectedPosition(index);
                          setSelectedPlayerOut(jersey);
                        }}
                        disabled={cannotReplace}
                        title={cannotReplace ? 'Libero cannot serve (FIVB rule)' : canServe ? 'Libero serve allowed for this player' : ''}
                      >
                        <strong>#{jersey}</strong> {player?.name || ''}{badge}
                        <div style={{ color: '#00d9ff', fontSize: '10px', marginTop: '3px' }}>{posLabel}</div>
                        {isServing && (
                          <div style={{ 
                            color: cannotReplace ? '#ff6b6b' : (canServe ? '#9c27b0' : '#fff'), 
                            fontSize: '9px', 
                            marginTop: '3px',
                            fontWeight: canServe ? 'bold' : 'normal'
                          }}>
                            {cannotReplace ? '⚠️ CANNOT SERVE' : canServe ? 'LIBERO SERVE ALLOWED' : '🏐'}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="libero-modal-buttons">
              <button type="button" className="libero-btn cancel" onClick={handleClose}>
                Cancel
              </button>
              <button
                type="button"
                className="libero-btn confirm"
                onClick={handleConfirm}
                disabled={!selectedLibero || selectedPosition == null || !selectedPlayerOut}
              >
                Confirm Replacement
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
