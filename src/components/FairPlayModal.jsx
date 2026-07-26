import React, { useEffect, useState } from 'react';
import './FairPlayForfeitModal.css';

function StarRating({ rating, onRate }) {
  return (
    <div className="fp-stars">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`fp-star${i <= rating ? ' filled' : ''}`}
          onClick={() => onRate(i)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onRate(i)}
        >
          ★
        </span>
      ))}
    </div>
  );
}

export default function FairPlayModal({ open, gameData, onClose, onSave, saving }) {
  const [ratingA, setRatingA] = useState(0);
  const [ratingB, setRatingB] = useState(0);
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    if (!open) return;
    const fp = gameData?.fairPlay || {};
    setRatingA(fp.teamA || 0);
    setRatingB(fp.teamB || 0);
    setRemarks(fp.remarks || '');
  }, [open, gameData?.fairPlay]);

  if (!open || !gameData) return null;

  const teamAName = gameData.teamAName || 'Team A';
  const teamBName = gameData.teamBName || 'Team B';

  return (
    <div className="fp-modal active" onClick={onClose}>
      <div className="fp-content" onClick={(e) => e.stopPropagation()} style={{ position: 'relative' }}>
        <button type="button" className="fp-modal-close" onClick={onClose}>✕</button>
        <div className="fp-title">🤝 FAIR PLAY AWARD</div>

        <div className="fp-team-block">
          <div className="fp-team-name" style={{ color: gameData.teamAColor || '#ff6b9d' }}>{teamAName}</div>
          <StarRating rating={ratingA} onRate={setRatingA} />
          <div className="fp-rating-label">{ratingA ? `${ratingA} / 5` : 'No rating selected'}</div>
        </div>

        <div className="fp-team-block">
          <div className="fp-team-name" style={{ color: gameData.teamBColor || '#4ecdc4' }}>{teamBName}</div>
          <StarRating rating={ratingB} onRate={setRatingB} />
          <div className="fp-rating-label">{ratingB ? `${ratingB} / 5` : 'No rating selected'}</div>
        </div>

        <label className="fp-remarks-label">Remarks</label>
        <textarea
          className="fp-remarks"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="e.g. Excellent sportsmanship from both teams, no incidents..."
        />

        <button type="button" className="fp-save-btn" disabled={saving} onClick={() => onSave({ teamA: ratingA, teamB: ratingB, remarks: remarks.trim() })}>
          💾 SAVE FAIR PLAY RATING
        </button>
      </div>
    </div>
  );
}
