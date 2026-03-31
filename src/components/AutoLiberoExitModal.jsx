import './AutoLiberoModal.css';

export default function AutoLiberoExitModal({ open, exitData, onConfirm, onClose }) {
  if (!open || !exitData) return null;

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm(exitData);
    }
    onClose();
  };

  return (
    <div className={`auto-libero-modal-overlay auto-libero-side-${String(exitData.team || '').toLowerCase()}`}>
      <div className="auto-libero-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="auto-libero-icon">🔄</div>
        <h3 className="auto-libero-title">LIBERO EXIT THE COURT</h3>
        <p className="auto-libero-message">{exitData.teamName != null ? exitData.teamName : 'Libero rotating to front row'}</p>

        <div className="auto-libero-details">
          <div className="auto-libero-player-info">
            <div className="auto-libero-player">
              <div className="auto-libero-player-label">⬆️ IN</div>
              <div className="auto-libero-player-jersey">
                {exitData.original?.jersey || '-'}
              </div>
              <div className="auto-libero-player-name">
                {exitData.original?.name || '-'}
              </div>
            </div>
            <div className="auto-libero-arrow">➜</div>
            <div className="auto-libero-player">
              <div className="auto-libero-player-label">⬇️ OUT (Libero)</div>
              <div className="auto-libero-player-jersey">
                {exitData.libero?.jersey || '-'}
              </div>
              <div className="auto-libero-player-name">
                {exitData.libero?.name || '-'}
              </div>
            </div>
          </div>

          <div className="auto-libero-position">
            <div className="auto-libero-position-label">Zone / Position</div>
            <div className="auto-libero-position-value">P{exitData.position || '-'}</div>
          </div>
        </div>

        <div className="auto-libero-buttons">
          <button
            type="button"
            className="auto-libero-btn auto-libero-btn-replace"
            onClick={handleConfirm}
          >
            ✓ CONFIRM EXIT
          </button>
        </div>
      </div>
    </div>
  );
}
