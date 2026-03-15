import { useState, useEffect } from 'react';
import { allowsP1Replacement } from '../utils/liberoServe';
import './AutoLiberoModal.css';

export default function AutoLiberoEntryModal({ open, team, teamName, targetData, liberos, gameData, currentSetData, onConfirm, onSkip, onClose }) {
  const [selectedLiberoIndex, setSelectedLiberoIndex] = useState(0);

  useEffect(() => {
    if (open && liberos && liberos.length > 0) {
      // Default to first libero
      setSelectedLiberoIndex(0);
    }
  }, [open, liberos]);

  if (!open || !targetData || !liberos || liberos.length === 0) return null;

  const selectedLibero = liberos[selectedLiberoIndex] || liberos[0];
  const isFirstServe = currentSetData?.score?.A === 0 && currentSetData?.score?.B === 0;
  const isServing = currentSetData?.serving === team;
  
  // Build context message like original HTML
  let contextMessage = teamName || `Team ${team}`;
  if (isFirstServe) {
    contextMessage = `${teamName || `Team ${team}`} - ${isServing ? 'SERVING TEAM' : 'RECEIVING TEAM'}`;
  }

  // When position is P1 and libero serve is enabled for this player, show "Libero serve is available" (like original)
  const isP1 = targetData.position === 1;
  const liberoServeConfig = gameData?.liberoServeConfig || {};
  const liberoServeAvailable = isP1 && allowsP1Replacement(
    team,
    targetData.jersey ?? targetData.player?.jersey,
    1,
    liberoServeConfig,
    gameData || {}
  );

  const handleConfirm = () => {
    if (onConfirm && selectedLibero) {
      onConfirm(team, selectedLibero.jersey, targetData);
    }
  };

  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    }
    if (onClose) {
      onClose();
    }
  };

  // Get badge for libero
  const getBadge = (libero) => {
    if (libero.role === 'libero1') return 'L1';
    if (libero.role === 'libero2') return 'L2';
    return '';
  };

  return (
    <div className="auto-libero-modal-overlay" onClick={handleSkip}>
      <div className="auto-libero-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="auto-libero-icon">🟡</div>
        <h3 className="auto-libero-title">LIBERO ENTRY AVAILABLE</h3>
        <p className="auto-libero-message" id="autoEntryMessage">{contextMessage}</p>
        {liberoServeAvailable && (
          <p className="auto-libero-serve-available" role="alert">
            🏐 Libero serve is available for this position (designated player in P1).
          </p>
        )}

        <div className="auto-libero-details">
          <div className="auto-libero-player-info">
            <div className="auto-libero-player">
              <div className="auto-libero-player-label">⬇️ OUT</div>
              <div className="auto-libero-player-jersey" id="autoEntryOutJersey">{targetData.player?.jersey || targetData.jersey || '-'}</div>
              <div className="auto-libero-player-name" id="autoEntryOutName">{targetData.player?.name || '-'}</div>
            </div>
            <div className="auto-libero-arrow">➜</div>
            <div className="auto-libero-player">
              <div className="auto-libero-player-label">⬆️ IN (Libero)</div>
              <div className="auto-libero-player-jersey" id="autoEntryInJersey">
                {liberos.length === 2 
                  ? `${liberos[0].jersey} / ${liberos[1].jersey}`
                  : selectedLibero.jersey}
              </div>
              <div className="auto-libero-player-name" id="autoEntryInName">
                {liberos.length === 2 ? (
                  <div style={{ textAlign: 'left', display: 'inline-block' }}>
                    <div style={{ marginBottom: '8px' }}>
                      <input 
                        type="radio" 
                        name="liberoChoice" 
                        value="0" 
                        id="liberoChoice0" 
                        checked={selectedLiberoIndex === 0}
                        onChange={() => setSelectedLiberoIndex(0)}
                        style={{ marginRight: '5px', cursor: 'pointer' }}
                      />
                      <label htmlFor="liberoChoice0" style={{ cursor: 'pointer' }}>
                        <strong>#{liberos[0].jersey}</strong> {liberos[0].name}
                        {' '}
                        <span style={{ fontSize: '11px', marginLeft: '5px', padding: '2px 6px', background: '#9c27b0', color: '#fff', borderRadius: '3px' }}>
                          {getBadge(liberos[0])}
                        </span>
                      </label>
                    </div>
                    <div>
                      <input 
                        type="radio" 
                        name="liberoChoice" 
                        value="1" 
                        id="liberoChoice1" 
                        checked={selectedLiberoIndex === 1}
                        onChange={() => setSelectedLiberoIndex(1)}
                        style={{ marginRight: '5px', cursor: 'pointer' }}
                      />
                      <label htmlFor="liberoChoice1" style={{ cursor: 'pointer' }}>
                        <strong>#{liberos[1].jersey}</strong> {liberos[1].name}
                        {' '}
                        <span style={{ fontSize: '11px', marginLeft: '5px', padding: '2px 6px', background: '#9c27b0', color: '#fff', borderRadius: '3px' }}>
                          {getBadge(liberos[1])}
                        </span>
                      </label>
                    </div>
                  </div>
                ) : (
                  <>
                    {selectedLibero.name}
                    {' '}
                    <span style={{ fontSize: '11px', marginLeft: '5px', padding: '2px 6px', background: '#9c27b0', color: '#fff', borderRadius: '3px' }}>
                      {getBadge(selectedLibero)}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="auto-libero-position">
            <div className="auto-libero-position-label">Zone / Position</div>
            <div className="auto-libero-position-value" id="autoEntryPosition">P{targetData.position || '-'}</div>
          </div>
        </div>

        <div className="auto-libero-buttons">
          <button
            type="button"
            className="auto-libero-btn auto-libero-btn-replace"
            onClick={handleConfirm}
          >
            ✓ REPLACE WITH LIBERO
          </button>
          <button
            type="button"
            className="auto-libero-btn auto-libero-btn-skip"
            onClick={handleSkip}
          >
            ✗ SKIP
          </button>
        </div>
      </div>
    </div>
  );
}
