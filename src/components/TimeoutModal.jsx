import { useEffect, useRef, useState } from 'react';
import './TimeoutModal.css';

export default function TimeoutModal({ open, teamName, scoreA, scoreB, teamAName, teamBName, onClose }) {
  const [seconds, setSeconds] = useState(30);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) {
      setSeconds(30);
      return;
    }
    setSeconds(30);
    const timeoutEnd = Date.now() + 30000;
    const t = setInterval(() => {
      const remainingMs = timeoutEnd - Date.now();
      const remainingSec = Math.max(0, Math.floor((remainingMs + 999) / 1000));
      setSeconds(remainingSec);
      if (remainingSec <= 0) {
        clearInterval(t);
        onCloseRef.current?.();
      }
    }, 250);
    return () => clearInterval(t);
  }, [open]);

  if (!open) return null;

  return (
    <div className="timeout-modal-overlay">
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
