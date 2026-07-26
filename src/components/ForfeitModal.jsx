import React, { useEffect, useState } from 'react';
import './FairPlayForfeitModal.css';

const FORFEIT_REASONS = [
  { value: '', label: '— Select Reason —' },
  { value: 'No-show / Did not appear', label: '🚷 No-show / Did not appear' },
  { value: 'Insufficient players', label: '👥 Insufficient players' },
  { value: 'Team withdrawal', label: '🏳️ Team withdrawal' },
  { value: 'Disqualification (misconduct)', label: '🟥 Disqualification (misconduct)' },
  { value: 'Late arrival beyond grace period', label: '⏰ Late arrival beyond grace period' },
  { value: 'Other', label: '📋 Other (see remarks)' }
];

export default function ForfeitModal({ open, gameData, onClose, onConfirm, confirming }) {
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [reason, setReason] = useState('');
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    if (!open) return;
    const ff = gameData?.forfeit || {};
    setSelectedTeam(ff.team || null);
    setReason(ff.reason || '');
    setRemarks(ff.remarks || '');
  }, [open, gameData?.forfeit]);

  if (!open || !gameData) return null;

  const teamAName = gameData.teamAName || 'Team A';
  const teamBName = gameData.teamBName || 'Team B';
  const alreadyDeclared = gameData.forfeit?.declared;

  const handleConfirm = () => {
    if (!selectedTeam) {
      alert('⚠️ Select the forfeiting team first.');
      return;
    }
    if (!reason) {
      alert('⚠️ Select a reason for the forfeit.');
      return;
    }
    const winnerName = selectedTeam === 'A' ? teamBName : teamAName;
    const forfeitName = selectedTeam === 'A' ? teamAName : teamBName;
    if (!window.confirm(`Confirm forfeit by ${forfeitName}?\nThis will mark the match as ended with ${winnerName} as winner.\n\nThis action cannot be easily undone.`)) {
      return;
    }
    onConfirm({ team: selectedTeam, reason, remarks: remarks.trim() });
  };

  return (
    <div className="ff-modal active" onClick={onClose}>
      <div className="ff-content" onClick={(e) => e.stopPropagation()} style={{ position: 'relative' }}>
        <button type="button" className="ff-modal-close" onClick={onClose}>✕</button>
        <div className="ff-title">🚫 MATCH FORFEIT</div>

        {alreadyDeclared && (
          <div className="ff-status-banner active">
            🚫 FORFEIT ALREADY DECLARED — {gameData.forfeit.team === 'A' ? teamAName : teamBName} ({gameData.forfeit.reason})
          </div>
        )}

        <div className="ff-warning">
          ⚠️ Declaring a forfeit ends the match immediately and records the opposing team as winner. This action should only be used for confirmed walkovers, team no-shows, or disqualifications per competition regulations.
        </div>

        <label className="ff-label">Forfeiting Team</label>
        <div className="ff-team-btns">
          <button
            type="button"
            className={`ff-team-btn team-a${selectedTeam === 'A' ? ' active' : ''}`}
            onClick={() => setSelectedTeam('A')}
          >
            {teamAName}
          </button>
          <button
            type="button"
            className={`ff-team-btn team-b${selectedTeam === 'B' ? ' active' : ''}`}
            onClick={() => setSelectedTeam('B')}
          >
            {teamBName}
          </button>
        </div>

        <label className="ff-label">Reason</label>
        <select className="ff-reason-select" value={reason} onChange={(e) => setReason(e.target.value)}>
          {FORFEIT_REASONS.map((r) => (
            <option key={r.value || 'empty'} value={r.value}>{r.label}</option>
          ))}
        </select>

        <label className="ff-label">Remarks (optional)</label>
        <textarea
          className="ff-remarks"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Additional details..."
        />

        <button type="button" className="ff-confirm-btn" disabled={confirming} onClick={handleConfirm}>
          {alreadyDeclared ? '🚫 UPDATE FORFEIT RECORD' : '🚫 DECLARE FORFEIT'}
        </button>
      </div>
    </div>
  );
}
