import { useState } from 'react';
import './SanctionModal.css';

const MISCONDUCT_TYPES = [
  { id: 'W', label: 'WARNING', sub: 'Yellow Card • No point', color: '#ffd700' },
  { id: 'P', label: 'PENALTY', sub: 'Red Card • +1 pt opponent', color: '#ff4444' },
  { id: 'EXP', label: 'EXPULSION', sub: 'Out this set only', color: '#ff8800' },
  { id: 'DISQ', label: 'DISQUALIFICATION', sub: 'Out entire match', color: '#cc00cc' }
];

const DELAY_TYPES = [
  { id: 'DW', label: 'DELAY WARNING', sub: '1st delay • No point', color: '#ffd700' },
  { id: 'DP', label: 'DELAY PENALTY', sub: '2nd+ delay • +1 pt opponent', color: '#ff4444' }
];

const REASON_OPTIONS = [
  '', 'Rude gesture', 'Verbal abuse', 'Arguing with official', 'Repeated misconduct',
  'Serious misconduct (direct red)', 'Offensive conduct', 'Physical aggression', 'Other'
];

export default function SanctionModal({
  open,
  gameCode,
  teamAName,
  teamBName,
  sanctionSystem,
  currentSet,
  teams,
  onApply,
  onClose,
  /** Fix #5: parent opens SubModal when server returns promptSubstitution */
  onSubstitutionRequired
}) {
  const [module, setModule] = useState('misconduct');
  const [team, setTeam] = useState('A');
  const [personType, setPersonType] = useState('player');
  const [jersey, setJersey] = useState('');
  const [misconductType, setMisconductType] = useState(null);
  const [delayType, setDelayType] = useState(null);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [showRedConfirm, setShowRedConfirm] = useState(false);
  const [pendingSanction, setPendingSanction] = useState(null);

  if (!open) return null;

  const misA = sanctionSystem?.misconduct?.A || [];
  const misB = sanctionSystem?.misconduct?.B || [];
  const delayA = sanctionSystem?.delay?.A || { count: 0, log: [] };
  const delayB = sanctionSystem?.delay?.B || { count: 0, log: [] };

  // Get escalation history for a person
  const getEscalationHistory = (personId, personType) => {
    const list = team === 'A' ? misA : misB;
    return list.filter(s => 
      s.personType === personType && 
      String(s.person) === String(personId)
    );
  };

  // Get escalation status
  const escalationHistory = personType === 'player' && jersey.trim() 
    ? getEscalationHistory(jersey.trim(), 'player')
    : personType === 'coach'
    ? getEscalationHistory('coach', 'coach')
    : [];

  // Auto-suggest delay type
  const delayCount = team === 'A' ? delayA.count : delayB.count;
  const suggestedDelayType = delayCount === 0 ? 'DW' : 'DP';

  const buildLog = () => {
    const lines = [];
    misA.forEach((s, i) => {
      lines.push(`Set ${s.set} | Team A | ${s.type} | ${s.personType === 'coach' ? 'Coach' : '#' + s.person} ${s.reason ? '• ' + s.reason : ''}`);
    });
    misB.forEach((s, i) => {
      lines.push(`Set ${s.set} | Team B | ${s.type} | ${s.personType === 'coach' ? 'Coach' : '#' + s.person} ${s.reason ? '• ' + s.reason : ''}`);
    });
    (delayA.log || []).forEach((s) => {
      lines.push(`Set ${s.set} | Team A | ${s.type} (Delay)`);
    });
    (delayB.log || []).forEach((s) => {
      lines.push(`Set ${s.set} | Team B | ${s.type} (Delay)`);
    });
    return lines.length ? lines.join('\n') : '—';
  };

  const handleApplyMisconduct = () => {
    if (!misconductType) return;
    if (personType === 'player') {
      const j = String(jersey).trim();
      if (!j) return;
      const num = parseInt(j, 10);
      if (isNaN(num) || num < 1 || num > 99) return;
    }

    // Check if red card (P, EXP, DISQ) - show confirmation
    if (misconductType === 'P' || misconductType === 'EXP' || misconductType === 'DISQ') {
      setPendingSanction({
        module: 'misconduct',
        team,
        payload: {
          type: misconductType,
          personType,
          person: personType === 'coach' ? 'coach' : String(jersey).trim(),
          reason: reason || undefined,
          notes: notes || undefined
        }
      });
      setShowRedConfirm(true);
      return;
    }

    // Apply warning directly
    void onApply('misconduct', team, {
      type: misconductType,
      personType,
      person: personType === 'coach' ? 'coach' : String(jersey).trim(),
      reason: reason || undefined,
      notes: notes || undefined
    });
    setMisconductType(null);
    setReason('');
    setNotes('');
    setJersey('');
  };

  const handleConfirmRedCard = async () => {
    if (!pendingSanction) return;
    try {
      const result = await onApply(pendingSanction.module, pendingSanction.team, pendingSanction.payload);
      if (result?.promptSubstitution && onSubstitutionRequired) {
        onSubstitutionRequired(result.promptSubstitution);
      }
    } catch (e) {
      console.error(e);
    }
    setShowRedConfirm(false);
    setPendingSanction(null);
    setMisconductType(null);
    setReason('');
    setNotes('');
    setJersey('');
  };

  const handleApplyDelay = () => {
    const typeToApply = delayType || suggestedDelayType;
    if (!typeToApply) return;
    
    // Auto-suggest based on count
    if (!delayType) {
      setDelayType(suggestedDelayType);
    }
    
    onApply('delay', team, { type: typeToApply });
    setDelayType(null);
  };

  const canApplyMisconduct = misconductType && (personType !== 'player' || (jersey.trim() && /^[1-9]\d{0,2}$/.test(String(jersey).trim())));
  const canApplyDelay = !!delayType;

  return (
    <div className="sanction-modal-overlay" onClick={onClose}>
      <div className="sanction-modal-content" onClick={(e) => e.stopPropagation()}>
        <h3 className="sanction-modal-title">⚠️ FIVB SANCTION MANAGEMENT</h3>

        <div className="sanction-tabs">
          <button
            type="button"
            className={`sanction-tab ${module === 'misconduct' ? 'active' : ''}`}
            onClick={() => setModule('misconduct')}
          >
            🟨 MISCONDUCT<br /><span className="tab-sub">Behaviour-based (Player/Coach)</span>
          </button>
          <button
            type="button"
            className={`sanction-tab ${module === 'delay' ? 'active' : ''}`}
            onClick={() => setModule('delay')}
          >
            ⏱ DELAY<br /><span className="tab-sub">Time-wasting (Team-based)</span>
          </button>
        </div>

        <div className="sanction-field">
          <label>Select Team</label>
          <div className="sanction-team-btns">
            <button type="button" className={team === 'A' ? 'active' : ''} onClick={() => setTeam('A')}>
              {teamAName || 'Team A'}
            </button>
            <button type="button" className={team === 'B' ? 'active' : ''} onClick={() => setTeam('B')}>
              {teamBName || 'Team B'}
            </button>
          </div>
        </div>

        {module === 'misconduct' && (
          <>
            <div className="sanction-field">
              <label>Sanctioned Person</label>
              <div className="sanction-person-btns">
                <button type="button" className={personType === 'player' ? 'active' : ''} onClick={() => {
                  setPersonType('player');
                  setJersey('');
                }}>👤 Player</button>
                <button type="button" className={personType === 'coach' ? 'active' : ''} onClick={() => {
                  setPersonType('coach');
                  setJersey('');
                }}>🧢 Coach / Staff</button>
              </div>
              {personType === 'player' && (
                <input
                  type="text"
                  className="sanction-jersey-input"
                  placeholder="Jersey number (e.g. 7)"
                  maxLength={3}
                  value={jersey}
                  onChange={(e) => {
                    setJersey(e.target.value.replace(/\D/g, '').slice(0, 3));
                  }}
                />
              )}
              
              {/* Escalation History */}
              {escalationHistory.length > 0 && (
                <div className="sanction-escalation">
                  <strong style={{ color: '#ffd700' }}>📋 Sanction History for this person:</strong>
                  <div style={{ marginTop: '6px', fontSize: '12px', color: '#ccc' }}>
                    {escalationHistory.map((s, i) => (
                      <div key={i}>
                        Set {s.set}: {s.type} {s.reason ? `• ${s.reason}` : ''}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="sanction-field">
              <label>Sanction Type</label>
              <div className="sanction-type-grid">
                {MISCONDUCT_TYPES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`sanction-type-btn ${misconductType === t.id ? 'selected' : ''}`}
                    style={{ borderColor: t.color, color: t.color }}
                    onClick={() => setMisconductType(t.id)}
                  >
                    {t.label}<br /><span className="type-sub">{t.sub}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="sanction-field">
              <label>Reason / Notes</label>
              <select className="sanction-select" value={reason} onChange={(e) => setReason(e.target.value)}>
                {REASON_OPTIONS.map((r) => (
                  <option key={r || 'empty'} value={r}>{r || '-- Select reason (optional) --'}</option>
                ))}
              </select>
              <textarea
                className="sanction-notes"
                placeholder="Additional details..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <div className="sanction-actions">
              <button type="button" className="sanction-apply misconduct" onClick={handleApplyMisconduct} disabled={!canApplyMisconduct}>
                ⚠️ APPLY SANCTION
              </button>
              <button type="button" className="sanction-cancel" onClick={onClose}>Cancel</button>
            </div>
          </>
        )}

        {module === 'delay' && (
          <>
            <div className="sanction-delay-status">
              <div className="delay-status-title">📊 DELAY SANCTION TRACKER (Entire Match)</div>
              <div className="delay-status-grid">
                <div className="delay-team-stat">
                  <strong>{teamAName || 'Team A'}</strong>: {delayA.count} delay(s)
                </div>
                <div className="delay-team-stat">
                  <strong>{teamBName || 'Team B'}</strong>: {delayB.count} delay(s)
                </div>
              </div>
            </div>
            
            {/* Auto-suggestion */}
            <div className="sanction-delay-auto" style={{
              background: '#1a2030',
              border: '2px solid #00d9ff',
              borderRadius: '6px',
              padding: '14px',
              marginBottom: '14px',
              fontSize: '13px',
              color: '#fff'
            }}>
              <strong style={{ color: '#00d9ff' }}>AUTO-SUGGESTION:</strong>
              <div style={{ marginTop: '6px' }}>
                {delayCount === 0 
                  ? '1st delay → Apply DELAY WARNING (DW) - No point penalty'
                  : `${delayCount + 1}${delayCount === 0 ? 'st' : delayCount === 1 ? 'nd' : delayCount === 2 ? 'rd' : 'th'} delay → Apply DELAY PENALTY (DP) - +1 point to opponent`
                }
              </div>
            </div>
            
            <div className="sanction-field">
              <label>Apply</label>
              <div className="sanction-type-grid two-cols">
                {DELAY_TYPES.map((t) => {
                  const isSuggested = t.id === suggestedDelayType && !delayType;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className={`sanction-type-btn ${delayType === t.id ? 'selected' : ''} ${isSuggested ? 'suggested' : ''}`}
                      style={{ 
                        borderColor: t.color, 
                        color: t.color,
                        background: isSuggested ? 'rgba(0, 217, 255, 0.1)' : undefined
                      }}
                      onClick={() => setDelayType(t.id)}
                    >
                      {t.label}<br /><span className="type-sub">{t.sub}</span>
                      {isSuggested && <span style={{ fontSize: '10px', display: 'block', marginTop: '4px', color: '#00d9ff' }}>← Suggested</span>}
                    </button>
                  );
                })}
              </div>
            </div>
            
            {/* Consequence preview */}
            {delayType && (
              <div className="sanction-consequence" style={{
                background: '#1a2f1a',
                border: '2px solid #00cc44',
                borderRadius: '6px',
                padding: '12px',
                marginBottom: '14px',
                fontSize: '13px',
                color: '#fff'
              }}>
                <strong style={{ color: '#00cc44' }}>📌 CONSEQUENCE:</strong>
                <div style={{ marginTop: '5px' }}>
                  {delayType === 'DW' 
                    ? 'Warning only. No point penalty. Next delay will result in penalty point.'
                    : 'Penalty point awarded to opponent. Team score increases by 1 point.'
                  }
                </div>
              </div>
            )}
            <div className="sanction-actions">
              <button type="button" className="sanction-apply delay" onClick={handleApplyDelay} disabled={!canApplyDelay}>
                ⏱ APPLY DELAY SANCTION
              </button>
              <button type="button" className="sanction-cancel" onClick={onClose}>Cancel</button>
            </div>
          </>
        )}

        <div className="sanction-log">
          <div className="sanction-log-title">Match Sanction Log</div>
          <pre className="sanction-log-content">{buildLog()}</pre>
        </div>
      </div>

      {/* Fix #4: Confirm copy matches sanction type; point text only when a point is actually awarded (P only for misconduct). */}
      {showRedConfirm && pendingSanction && (
        <div className="sanction-red-confirm-overlay" onClick={() => setShowRedConfirm(false)}>
          <div className="sanction-red-confirm-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: '60px', marginBottom: '10px' }}>
              {pendingSanction.payload.type === 'P' ? '🟥' : pendingSanction.payload.type === 'EXP' ? '🟧' : '🟪'}
            </div>
            <h3 style={{ color: pendingSanction.payload.type === 'P' ? '#ff4444' : pendingSanction.payload.type === 'EXP' ? '#ff8800' : '#cc00cc', marginBottom: '10px', fontSize: '20px' }}>
              {pendingSanction.payload.type === 'P'
                ? 'CONFIRM PENALTY (RED CARD)'
                : pendingSanction.payload.type === 'EXP'
                  ? 'CONFIRM EXPULSION'
                  : 'CONFIRM DISQUALIFICATION'}
            </h3>
            <p style={{ color: '#fff', marginBottom: '18px', fontSize: '14px', lineHeight: '1.6' }}>
              {pendingSanction.payload.personType === 'coach' 
                ? `Coach of ${team === 'A' ? teamAName : teamBName}`
                : `Player #${pendingSanction.payload.person} of ${team === 'A' ? teamAName : teamBName}`
              } will receive a {pendingSanction.payload.type === 'P' ? 'PENALTY (red card)' : pendingSanction.payload.type === 'EXP' ? 'EXPULSION' : 'DISQUALIFICATION'}.
            </p>
            <div style={{
              background: '#1a1a2e',
              borderRadius: '6px',
              padding: '12px',
              marginBottom: '18px',
              fontSize: '13px',
              color: '#ffd700'
            }}>
              {pendingSanction.payload.type === 'P' 
                ? 'Effect: +1 point to opponent. Player or coach remains eligible (unless further sanctions).'
                : pendingSanction.payload.type === 'EXP'
                ? 'Effect: No penalty point. Expelled player or coach cannot participate for the remainder of this set. A substitute is required for an expelled player.'
                : 'Effect: No penalty point. Disqualified player or coach cannot participate for the remainder of the match. A substitution will count toward the team substitution limit when replacing a disqualified player.'
              }
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={handleConfirmRedCard}
                style={{
                  flex: 1,
                  padding: '14px',
                  background: '#c00',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '15px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                ✓ CONFIRM — APPLY
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowRedConfirm(false);
                  setPendingSanction(null);
                }}
                style={{
                  flex: 1,
                  padding: '14px',
                  background: '#555',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                ✗ CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
