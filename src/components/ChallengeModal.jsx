import { useState, useEffect, useCallback, useRef } from 'react';
import { requestChallenge, resolveChallenge, cancelPendingChallenge } from '../services/gameService';
import './ChallengeModal.css';

const CHALLENGE_TYPES = [
  { value: 'IN/OUT', label: '📍 IN / OUT' },
  { value: 'TOUCH', label: '✋ TOUCH' },
  { value: 'NET FAULT', label: '🕸 NET FAULT' },
  { value: 'FOOT FAULT', label: '🦶 FOOT FAULT' },
  { value: 'ANTENNA TOUCH', label: '📡 ANTENNA TOUCH' }
];

function playWhistle() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    [0, 0.15, 0.3].forEach((delay) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'square';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.35, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.18);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.18);
    });
  } catch (_) {
    /* ignore */
  }
}

function ChallengeResultPopup({ result, teamName, type, onDismiss }) {
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    const t = setTimeout(() => dismissRef.current(), 3200);
    return () => clearTimeout(t);
  }, [result, teamName, type]);

  const isSuccess = result === 'SUCCESSFUL';
  return (
    <div
      className={`challenge-result-popup ${isSuccess ? 'success' : 'failed'}`}
      role="button"
      tabIndex={0}
      onClick={() => dismissRef.current()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') dismissRef.current();
      }}
      style={{ cursor: 'pointer' }}
      title="Click to dismiss"
    >
      <div style={{ fontSize: 52, marginBottom: 8 }}>{isSuccess ? '✅' : '❌'}</div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 900,
          color: isSuccess ? '#00e676' : '#ff1744',
          letterSpacing: 2,
          marginBottom: 6
        }}
      >
        CHALLENGE {result}
      </div>
      {isSuccess ? (
        <>
          <div style={{ fontSize: 15, color: '#b9f6ca', marginBottom: 4 }}>Decision Reversed</div>
          <div style={{ fontSize: 13, color: '#69f0ae' }}>
            Point &amp; Service → <strong>{teamName}</strong>
          </div>
        </>
      ) : (
        <div style={{ fontSize: 15, color: '#ff8a80' }}>Decision Stands</div>
      )}
      <div style={{ fontSize: 11, color: '#aaa', marginTop: 10 }}>{type || ''}</div>
    </div>
  );
}

export default function ChallengeModal({
  open,
  gameCode,
  gameData,
  onClose,
  onResolved,
  onHighlightCourt
}) {
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [challengeType, setChallengeType] = useState('');
  const [toast, setToast] = useState(null);
  const [resultPopup, setResultPopup] = useState(null);
  const [busy, setBusy] = useState(false);
  const resultDismissTimerRef = useRef(null);

  const cs = gameData?.challengeSystem || { challenges: { A: 2, B: 2 }, log: [] };
  const currentSet = gameData?.currentSet || 1;
  const teamAName = gameData?.teamAName || 'Team A';
  const teamBName = gameData?.teamBName || 'Team B';
  const awaitingDecision = cs.awaitingDecision;
  const pendingTeam = cs.pendingTeam;
  const pendingType = cs.pendingType;

  const showToast = useCallback((msg, color = '#ff9500') => {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 2800);
  }, []);

  const dismissResultPopup = useCallback(() => {
    if (resultDismissTimerRef.current) {
      clearTimeout(resultDismissTimerRef.current);
      resultDismissTimerRef.current = null;
    }
    setResultPopup(null);
  }, []);

  const showResultPopup = useCallback(
    (data) => {
      dismissResultPopup();
      setResultPopup(data);
      resultDismissTimerRef.current = setTimeout(() => {
        setResultPopup(null);
        resultDismissTimerRef.current = null;
      }, 3200);
    },
    [dismissResultPopup]
  );

  useEffect(() => {
    if (!open) {
      setSelectedTeam(null);
      setChallengeType('');
      dismissResultPopup();
    }
  }, [open, dismissResultPopup]);

  useEffect(() => {
    return () => {
      if (resultDismissTimerRef.current) clearTimeout(resultDismissTimerRef.current);
    };
  }, []);

  const handleRequest = async () => {
    if (!gameCode) return;
    if (awaitingDecision) {
      showToast('⚠️ Pending challenge not yet decided!', '#ff9500');
      return;
    }
    if (!selectedTeam) {
      showToast('⚠️ Select a team first!', '#ff0000');
      return;
    }
    if (!challengeType) {
      showToast('⚠️ Select challenge type!', '#ff0000');
      return;
    }
    if ((cs.challenges?.[selectedTeam] ?? 0) <= 0) {
      showToast(`❌ ${selectedTeam === 'A' ? teamAName : teamBName} has no challenges left!`, '#d50000');
      return;
    }

    setBusy(true);
    try {
      await requestChallenge(gameCode, selectedTeam, challengeType);
      playWhistle();
      onHighlightCourt?.(selectedTeam);
      showToast(
        `🚩 Challenge requested by ${selectedTeam === 'A' ? teamAName : teamBName} — ${challengeType}`,
        '#ff9500'
      );
    } catch (err) {
      showToast(`⚠️ ${err.message}`, '#ff0000');
    } finally {
      setBusy(false);
    }
  };

  const handleResolve = async (result) => {
    if (!gameCode || !awaitingDecision) return;
    const tName = pendingTeam === 'A' ? teamAName : teamBName;
    const resolvedType = pendingType;
    setBusy(true);
    try {
      const res = await resolveChallenge(gameCode, result);
      showResultPopup({ result, teamName: tName, type: resolvedType });
      if (result === 'UNSUCCESSFUL') {
        showToast(`❌ Challenge UNSUCCESSFUL — Decision stands, ${tName} loses 1 challenge`, '#d50000');
      } else {
        showToast(`✅ Challenge SUCCESSFUL — Rally reversed! Point & service → ${tName}`, '#00c853');
      }
      setSelectedTeam(null);
      setChallengeType('');
      onResolved?.(res);
    } catch (err) {
      showToast(`⚠️ ${err.message}`, '#ff0000');
      try {
        await cancelPendingChallenge(gameCode);
      } catch (_) {
        /* best-effort unlock */
      }
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  const pendingTeamName = pendingTeam === 'A' ? teamAName : pendingTeam === 'B' ? teamBName : '';
  const log = cs.log || [];

  return (
    <>
      <div className="challenge-modal-overlay active" onClick={onClose}>
        <div className="challenge-content" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="challenge-modal-close" onClick={onClose}>
            ✕
          </button>
          <div className="challenge-title">🚩 VIDEO CHALLENGE</div>
          <div style={{ textAlign: 'center', marginBottom: 14 }}>
            <span className="challenge-set-badge">SET {currentSet}</span>
          </div>

          <div className="challenge-remaining">
            <div className={`challenge-rem-card ${selectedTeam === 'A' ? 'highlight-a' : ''}`}>
              <div className="challenge-rem-team">{teamAName}</div>
              <div
                className={`challenge-rem-count ${(cs.challenges?.A ?? 0) > 0 ? 'count-a' : 'count-zero'}`}
              >
                {cs.challenges?.A ?? 0}
              </div>
              <div className="challenge-rem-label">challenges left</div>
            </div>
            <div className={`challenge-rem-card ${selectedTeam === 'B' ? 'highlight-b' : ''}`}>
              <div className="challenge-rem-team">{teamBName}</div>
              <div
                className={`challenge-rem-count ${(cs.challenges?.B ?? 0) > 0 ? 'count-b' : 'count-zero'}`}
              >
                {cs.challenges?.B ?? 0}
              </div>
              <div className="challenge-rem-label">challenges left</div>
            </div>
          </div>

          <div className="challenge-section-label">Requesting Team</div>
          <div className="challenge-team-btns">
            <button
              type="button"
              className={`challenge-team-btn team-a-btn ${selectedTeam === 'A' ? 'active' : ''}`}
              onClick={() => setSelectedTeam('A')}
              disabled={awaitingDecision || busy}
            >
              {teamAName}
            </button>
            <button
              type="button"
              className={`challenge-team-btn team-b-btn ${selectedTeam === 'B' ? 'active' : ''}`}
              onClick={() => setSelectedTeam('B')}
              disabled={awaitingDecision || busy}
            >
              {teamBName}
            </button>
          </div>

          <div className="challenge-section-label">Challenge Type</div>
          <select
            className="challenge-type-select"
            value={challengeType}
            onChange={(e) => setChallengeType(e.target.value)}
            disabled={awaitingDecision || busy}
          >
            <option value="">— Select Challenge Type —</option>
            {CHALLENGE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="challenge-request-btn"
            onClick={handleRequest}
            disabled={awaitingDecision || busy}
          >
            🚩 REQUEST CHALLENGE
          </button>

          <div className={`challenge-decision-panel ${awaitingDecision ? 'active' : ''}`}>
            <div className="challenge-section-label" style={{ marginBottom: 10 }}>
              📺 Referee Decision
            </div>
            {awaitingDecision && (
              <div className="challenge-pending-info">
                <strong>Team:</strong> {pendingTeamName}
                <br />
                <strong>Type:</strong> {pendingType}
                <br />
                <strong>Set:</strong> {currentSet}
                <br />
                <strong>Remaining if Unsuccessful:</strong>{' '}
                {Math.max(0, (cs.challenges?.[pendingTeam] ?? 0) - 1)}
              </div>
            )}
            <div className="challenge-decision-btns">
              <button
                type="button"
                className="challenge-success-btn"
                onClick={() => handleResolve('SUCCESSFUL')}
                disabled={!awaitingDecision || busy}
              >
                ✅ SUCCESSFUL
              </button>
              <button
                type="button"
                className="challenge-fail-btn"
                onClick={() => handleResolve('UNSUCCESSFUL')}
                disabled={!awaitingDecision || busy}
              >
                ❌ UNSUCCESSFUL
              </button>
            </div>
          </div>

          <div className="challenge-log-section">
            <div className="challenge-log-title">📋 Challenge Log</div>
            <div className="challenge-log-list">
              {log.length === 0 ? (
                <div className="challenge-log-empty">No challenges yet this match.</div>
              ) : (
                log.map((e, idx) => {
                  const isSuccess = e.result === 'SUCCESSFUL';
                  const scoreStr = e.scoreAtChallenge
                    ? `${e.scoreAtChallenge.A} – ${e.scoreAtChallenge.B}`
                    : '—';
                  return (
                    <div
                      key={`${e.timestamp}-${idx}`}
                      className={`challenge-log-item ${isSuccess ? 'success' : 'failed'}`}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: '#fff' }}>
                          #{log.length - idx} &nbsp;🚩 {e.teamName} challenged
                        </span>
                        <span
                          style={{
                            fontSize: 12,
                            color: '#aaa',
                            fontFamily: 'monospace',
                            background: 'rgba(255,255,255,0.07)',
                            padding: '2px 7px',
                            borderRadius: 4
                          }}
                        >
                          Score: {scoreStr}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: '#bbb' }}>
                        📋 {e.type || '—'} · Set {e.set} · 🕐 {e.timestamp}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: isSuccess ? '#00e676' : '#ff5252'
                        }}
                      >
                        {isSuccess ? '✅ SUCCESSFUL — Reversed' : '❌ UNSUCCESSFUL — Stands'}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <div className="challenge-toast" style={{ borderColor: toast.color, display: 'block' }}>
          {toast.msg}
        </div>
      )}

      {resultPopup && (
        <ChallengeResultPopup
          result={resultPopup.result}
          teamName={resultPopup.teamName}
          type={resultPopup.type}
          onDismiss={dismissResultPopup}
        />
      )}
    </>
  );
}
