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
  onApply,
  onClose
}) {
  const [module, setModule] = useState('misconduct');
  const [team, setTeam] = useState('A');
  const [personType, setPersonType] = useState('player');
  const [jersey, setJersey] = useState('');
  const [misconductType, setMisconductType] = useState(null);
  const [delayType, setDelayType] = useState(null);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  if (!open) return null;

  const misA = sanctionSystem?.misconduct?.A || [];
  const misB = sanctionSystem?.misconduct?.B || [];
  const delayA = sanctionSystem?.delay?.A || { count: 0, log: [] };
  const delayB = sanctionSystem?.delay?.B || { count: 0, log: [] };

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
    onApply('misconduct', team, {
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

  const handleApplyDelay = () => {
    if (!delayType) return;
    onApply('delay', team, { type: delayType });
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
                <button type="button" className={personType === 'player' ? 'active' : ''} onClick={() => setPersonType('player')}>👤 Player</button>
                <button type="button" className={personType === 'coach' ? 'active' : ''} onClick={() => setPersonType('coach')}>🧢 Coach / Staff</button>
              </div>
              {personType === 'player' && (
                <input
                  type="text"
                  className="sanction-jersey-input"
                  placeholder="Jersey number (e.g. 7)"
                  maxLength={3}
                  value={jersey}
                  onChange={(e) => setJersey(e.target.value.replace(/\D/g, '').slice(0, 3))}
                />
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
            <div className="sanction-field">
              <label>Apply</label>
              <div className="sanction-type-grid two-cols">
                {DELAY_TYPES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`sanction-type-btn ${delayType === t.id ? 'selected' : ''}`}
                    style={{ borderColor: t.color, color: t.color }}
                    onClick={() => setDelayType(t.id)}
                  >
                    {t.label}<br /><span className="type-sub">{t.sub}</span>
                  </button>
                ))}
              </div>
            </div>
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
    </div>
  );
}
