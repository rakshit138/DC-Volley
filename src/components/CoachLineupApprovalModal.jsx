export default function CoachLineupApprovalModal({ open, title, bodyText, onApprove, onReject }) {
  if (!open) return null;

  return (
    <div
      className="coach-approve-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.92)',
        zIndex: 3000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
      }}
    >
      <div
        style={{
          background: '#16213e',
          borderRadius: 10,
          padding: 24,
          maxWidth: 520,
          width: '100%',
          border: '3px solid #00ff00',
          color: '#fff'
        }}
      >
        <div style={{ color: '#00ff00', fontSize: 18, fontWeight: 'bold', marginBottom: 14, textAlign: 'center' }}>
          {title}
        </div>
        <div
          style={{
            background: '#0a1a0a',
            borderRadius: 6,
            padding: 14,
            fontSize: 13,
            color: '#ccc',
            whiteSpace: 'pre-line',
            maxHeight: 320,
            overflowY: 'auto',
            lineHeight: 1.7,
            fontFamily: 'monospace'
          }}
        >
          {bodyText}
        </div>
        <p style={{ color: '#ffd700', fontSize: 11, marginTop: 10, textAlign: 'center' }}>
          Once approved, this team&apos;s lineup will be LOCKED — no manual changes permitted.
        </p>
        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <button
            type="button"
            onClick={onReject}
            style={{
              flex: 1,
              padding: '12px 16px',
              background: '#533483',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            ✕ Reject
          </button>
          <button
            type="button"
            onClick={onApprove}
            style={{
              flex: 1,
              padding: '12px 16px',
              background: 'linear-gradient(135deg,#00ff00,#00cc00)',
              color: '#000',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            ✅ Approve & Lock
          </button>
        </div>
      </div>
    </div>
  );
}
