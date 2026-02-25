import { useState } from 'react';
import './LiberoModal.css';

const BACK_ROW_INDICES = [0, 4, 5];
const INDEX_TO_POS = { 0: 1, 4: 5, 5: 6 };

export default function LiberoModal({ open, team, teamName, teams, onConfirm, onClose }) {
  const [selectedPosition, setSelectedPosition] = useState(null);

  if (!open || !teams?.[team]) return null;

  const roster = teams[team].players || [];
  const lineup = teams[team].lineup || [];
  const isLiberoRole = (r) => r === 'libero1' || r === 'libero2' || r === 'liberocaptain';
  const liberos = roster.filter((p) => isLiberoRole(p.role));
  const liberoJerseysSet = new Set(liberos.map((p) => String(p.jersey)));
  const liberoJersey = liberos.length > 0 ? String(liberos[0].jersey) : null;

  const lineupPadded = [...lineup];
  while (lineupPadded.length < 6) lineupPadded.push(null);

  const liberoAlreadyOnCourt = lineupPadded.some((j) => j != null && liberoJerseysSet.has(String(j)));
  const liberoOnCourtPosition = liberoAlreadyOnCourt
    ? lineupPadded.findIndex((j) => j != null && liberoJerseysSet.has(String(j)))
    : -1;

  const handleConfirm = () => {
    if (selectedPosition != null && liberoJersey && !liberoAlreadyOnCourt) {
      onConfirm(team, selectedPosition, liberoJersey);
      setSelectedPosition(null);
      onClose();
    }
  };

  const handleClose = () => {
    setSelectedPosition(null);
    onClose();
  };

  return (
    <div className="libero-modal-overlay" onClick={handleClose}>
      <div className="libero-modal-content" onClick={(e) => e.stopPropagation()}>
        <h3 className="libero-modal-title">Libero replacement – {teamName}</h3>
        {!liberoJersey ? (
          <p className="libero-modal-info">No libero in roster for this team.</p>
        ) : liberoAlreadyOnCourt ? (
          <p className="libero-modal-info" style={{ color: '#ffd700' }}>
            Libero is already on court at P{liberoOnCourtPosition + 1}. Only one libero may be on court at a time.
          </p>
        ) : (
          <>
            <p className="libero-modal-info">
              Select a back-row position (P1, P5, P6) where the libero #{liberoJersey} will enter.
            </p>
            <div className="libero-modal-positions">
              {BACK_ROW_INDICES.map((index) => {
                const pos = INDEX_TO_POS[index];
                const jersey = lineupPadded[index];
                const p = roster.find((r) => String(r.jersey) === String(jersey));
                const label = jersey ? (p ? `P${pos} #${jersey} ${p.name}` : `P${pos} #${jersey}`) : `P${pos}`;
                const selected = selectedPosition === index;
                return (
                  <button
                    key={pos}
                    type="button"
                    className={`libero-modal-pos-btn ${selected ? 'selected' : ''}`}
                    onClick={() => setSelectedPosition(index)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="libero-modal-buttons">
              <button type="button" className="libero-btn cancel" onClick={handleClose}>
                Cancel
              </button>
              <button
                type="button"
                className="libero-btn confirm"
                onClick={handleConfirm}
                disabled={selectedPosition == null}
              >
                Confirm libero entry
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
