import { useState } from 'react';
import './SubModal.css';

export default function SubModal({ open, team, teamName, teams, currentSet, sets, subLimit, onConfirm, onClose }) {
  const [playerOut, setPlayerOut] = useState(null);
  const [playerIn, setPlayerIn] = useState(null);

  if (!open || !teams?.[team]) return null;

  const roster = teams[team].players || [];
  const lineup = teams[team].lineup || [];
  const onCourtJerseys = Array.isArray(lineup) ? lineup.filter(Boolean).map(String) : [];
  const benchJerseys = roster
    .map((p) => String(p.jersey))
    .filter((j) => !onCourtJerseys.includes(j));

  const setData = sets?.[currentSet - 1];
  const subsUsed = setData?.substitutions?.[team]?.length ?? 0;
  const canSub = subsUsed < (subLimit || 6);

  const handleConfirm = () => {
    if (playerOut && playerIn && canSub) {
      onConfirm(team, playerOut, playerIn);
      setPlayerOut(null);
      setPlayerIn(null);
      onClose();
    }
  };

  const handleClose = () => {
    setPlayerOut(null);
    setPlayerIn(null);
    onClose();
  };

  return (
    <div className="sub-modal-overlay" onClick={handleClose}>
      <div className="sub-modal-content" onClick={(e) => e.stopPropagation()}>
        <h3 className="sub-modal-title">Substitution – {teamName}</h3>
        <p className="sub-modal-info">
          {canSub
            ? `Substitution ${subsUsed + 1}/${subLimit || 6} – Select player OUT, then player IN`
            : `Maximum ${subLimit || 6} substitutions reached for this set.`}
        </p>

        <div className="sub-modal-sections">
          <div className="sub-modal-section">
            <h4>Player OUT (on court)</h4>
            <div className="sub-modal-player-grid">
              {onCourtJerseys.map((jersey) => {
                const p = roster.find((r) => String(r.jersey) === jersey);
                const label = p ? `#${jersey} ${p.name}` : `#${jersey}`;
                const selected = playerOut === jersey;
                return (
                  <button
                    key={jersey}
                    type="button"
                    className={`sub-modal-player-btn ${selected ? 'selected' : ''}`}
                    onClick={() => setPlayerOut(jersey)}
                    disabled={!canSub}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="sub-modal-section">
            <h4>Player IN (bench)</h4>
            <div className="sub-modal-player-grid">
              {benchJerseys.map((jersey) => {
                const p = roster.find((r) => String(r.jersey) === jersey);
                const label = p ? `#${jersey} ${p.name}` : `#${jersey}`;
                const selected = playerIn === jersey;
                return (
                  <button
                    key={jersey}
                    type="button"
                    className={`sub-modal-player-btn ${selected ? 'selected' : ''}`}
                    onClick={() => setPlayerIn(jersey)}
                    disabled={!canSub}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {playerOut && playerIn && (
          <p className="sub-modal-summary">
            OUT: #{playerOut} → IN: #{playerIn}
          </p>
        )}

        <div className="sub-modal-buttons">
          <button type="button" className="sub-modal-btn cancel" onClick={handleClose}>
            Cancel
          </button>
          <button
            type="button"
            className="sub-modal-btn confirm"
            onClick={handleConfirm}
            disabled={!playerOut || !playerIn || !canSub}
          >
            Confirm substitution
          </button>
        </div>
      </div>
    </div>
  );
}
