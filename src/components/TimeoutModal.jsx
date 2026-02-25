import { useEffect, useState } from 'react';
import './TimeoutModal.css';

export default function TimeoutModal({ open, teamName, scoreA, scoreB, teamAName, teamBName, onClose }) {
  const [seconds, setSeconds] = useState(30);

  useEffect(() => {
    if (!open) {
      setSeconds(30);
      return;
    }
    const t = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          clearInterval(t);
          onClose();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="timeout-modal-overlay" onClick={onClose}>
      <div className="timeout-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="timeout-modal-team">{teamName} – TIMEOUT</div>
        <div className="timeout-modal-timer">{seconds}</div>
        <div className="timeout-modal-score-label">Score at timeout</div>
        <div className="timeout-modal-scores">
          <div className="timeout-modal-team-score">
            <div className="timeout-modal-team-name">{teamAName}</div>
            <div className="timeout-modal-points team-a">{scoreA}</div>
          </div>
          <div className="timeout-modal-team-score">
            <div className="timeout-modal-team-name">{teamBName}</div>
            <div className="timeout-modal-points team-b">{scoreB}</div>
          </div>
        </div>
        <button type="button" className="timeout-modal-close" onClick={onClose}>
          End timeout
        </button>
      </div>
    </div>
  );
}
