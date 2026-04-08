import React from 'react';
import { firestoreTimeToDate, matchSummarySetWonTime } from '../utils/firestoreTime';
import './SummaryModal.css';

function formatSetDurationMs(start, end) {
  if (!start || !end) return null;
  const ms = end.getTime() - start.getTime();
  if (Number.isNaN(ms) || ms < 0) return null;
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function SummaryModal({ open, gameData, onClose, onExportPDF }) {
  if (!open || !gameData) return null;

  const teamAName = gameData.teamAName || 'Team A';
  const teamBName = gameData.teamBName || 'Team B';
  const teamAColor = gameData.teamAColor || '#ff6b6b';
  const teamBColor = gameData.teamBColor || '#4ecdc4';
  const sets = gameData.sets || [];
  const setsWon = gameData.setsWon || { A: 0, B: 0 };
  const matchSummary = gameData.matchSummary || [];
  const matchStartDt =
    firestoreTimeToDate(gameData.playStartedAt) ||
    firestoreTimeToDate(gameData.createdAt) ||
    (sets[0] ? firestoreTimeToDate(sets[0].startTime) || firestoreTimeToDate(sets[0].setClockStartedAt) : null);
  let latestSetEnd = null;
  sets.forEach((set, i) => {
    if (!set?.winner) return;
    const e =
      firestoreTimeToDate(set.endTime) || matchSummarySetWonTime(matchSummary, i + 1);
    if (e && (!latestSetEnd || e.getTime() > latestSetEnd.getTime())) latestSetEnd = e;
  });
  const matchDurationLabel =
    matchStartDt && latestSetEnd ? formatSetDurationMs(matchStartDt, latestSetEnd) : null;
  const dst = gameData.decidingSetToss;
  const ct = gameData.coinToss;

  const events = [...matchSummary].sort((a, b) => {
    const da = firestoreTimeToDate(a?.timestamp);
    const db = firestoreTimeToDate(b?.timestamp);
    const ta = da ? da.getTime() : 0;
    const tb = db ? db.getTime() : 0;
    return ta - tb;
  });

  return (
    <div className="summary-modal-overlay" onClick={onClose}>
      <div className="summary-modal-content" onClick={(e) => e.stopPropagation()}>
        <h3 className="summary-modal-title">📊 MATCH SUMMARY</h3>
        
        <div className="summary-section">
          <h4>Match Result</h4>
          <div className="summary-result">
            <div className="summary-team" style={{ color: teamAColor }}>
              <div className="summary-team-name">{teamAName}</div>
              <div className="summary-sets-won">{setsWon.A}</div>
            </div>
            <div className="summary-vs">vs</div>
            <div className="summary-team" style={{ color: teamBColor }}>
              <div className="summary-team-name">{teamBName}</div>
              <div className="summary-sets-won">{setsWon.B}</div>
            </div>
          </div>
          <div className="summary-winner">
            🏆 Winner:{' '}
            <span style={{ color: setsWon.A > setsWon.B ? teamAColor : teamBColor, fontWeight: 700 }}>
              {setsWon.A > setsWon.B ? teamAName : teamBName}
            </span>
          </div>
        </div>

        <div className="summary-section">
          <h4>Timing</h4>
          <div style={{ fontSize: 13, color: '#ccc', lineHeight: 1.6 }}>
            <div>
              <strong style={{ color: '#fff' }}>Match start (clock):</strong>{' '}
              {matchStartDt ? matchStartDt.toLocaleString() : 'N/A'}
            </div>
            <div>
              <strong style={{ color: '#fff' }}>Match duration (to latest set end):</strong>{' '}
              {matchDurationLabel ?? 'N/A'}
            </div>
          </div>
        </div>

        {ct && (ct.winner || ct.firstServer) && (
          <div className="summary-section">
            <h4>Pre-match coin toss</h4>
            <div style={{ fontSize: 13, color: '#ccc', lineHeight: 1.6 }}>
              <div>
                <strong style={{ color: '#fff' }}>Toss winner:</strong>{' '}
                {ct.winner === 'team1'
                  ? ct.team1Name || 'Team 1 (setup)'
                  : ct.winner === 'team2'
                    ? ct.team2Name || 'Team 2 (setup)'
                    : ct.winner || '—'}
              </div>
              <div>
                <strong style={{ color: '#fff' }}>Choice:</strong>{' '}
                {ct.choice === 'serve'
                  ? 'Serve first'
                  : ct.choice === 'receive'
                    ? 'Receive first'
                    : ct.choice === 'side'
                      ? 'Choice of side'
                      : ct.choice || '—'}
              </div>
              <div>
                <strong style={{ color: '#fff' }}>First serve:</strong>{' '}
                {ct.firstServer === 'A' ? teamAName : ct.firstServer === 'B' ? teamBName : '—'}
              </div>
            </div>
          </div>
        )}

        {dst?.winner && (
          <div className="summary-section">
            <h4>Deciding set toss</h4>
            <div style={{ fontSize: 13, color: '#ccc', lineHeight: 1.6 }}>
              <div>
                Set {dst.setNumber ?? '—'} — Winner:{' '}
                <strong style={{ color: '#fff' }}>{dst.winner === 'A' ? teamAName : teamBName}</strong>
              </div>
              <div>
                Choice:{' '}
                <strong style={{ color: '#fff' }}>
                  {dst.choice === 'serve' ? 'Serve first' : dst.choice === 'receive' ? 'Receive first' : '—'}
                </strong>
              </div>
              <div>
                Referee&apos;s left:{' '}
                <strong style={{ color: '#fff' }}>
                  {dst.teamOnRefereeLeft === 'A' ? teamAName : dst.teamOnRefereeLeft === 'B' ? teamBName : '—'}
                </strong>
              </div>
            </div>
          </div>
        )}

        <div className="summary-section">
          <h4>Set-by-Set Scores</h4>
          <div className="summary-sets-table">
            <div className="summary-sets-header">
              <div>Set</div>
              <div style={{ color: teamAColor }}>{teamAName}</div>
              <div style={{ color: teamBColor }}>{teamBName}</div>
              <div>Start</div>
              <div>End</div>
              <div>Dur.</div>
              <div>Winner</div>
            </div>
            {sets.map((set, idx) => {
              if (!set.winner && set.score?.A === 0 && set.score?.B === 0) return null;
              const sStart =
                firestoreTimeToDate(set.startTime) || firestoreTimeToDate(set.setClockStartedAt);
              const sEnd =
                firestoreTimeToDate(set.endTime) || matchSummarySetWonTime(matchSummary, idx + 1);
              const dur = formatSetDurationMs(sStart, sEnd);
              return (
                <div key={idx} className="summary-sets-row">
                  <div className="summary-set-number">Set {idx + 1}</div>
                  <div style={{ color: teamAColor }}>{set.score?.A || 0}</div>
                  <div style={{ color: teamBColor }}>{set.score?.B || 0}</div>
                  <div style={{ fontSize: 11 }}>{sStart ? sStart.toLocaleTimeString() : '—'}</div>
                  <div style={{ fontSize: 11 }}>{sEnd ? sEnd.toLocaleTimeString() : '—'}</div>
                  <div style={{ fontSize: 11 }}>{dur ?? '—'}</div>
                  <div>
                    {set.winner ? (
                      <span style={{ color: set.winner === 'A' ? teamAColor : teamBColor, fontWeight: 700 }}>
                        {set.winner === 'A' ? teamAName : teamBName}
                      </span>
                    ) : (
                      '-'
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="summary-section">
          <h4>Chronological Event Log</h4>
          <div className="summary-sanction-log" style={{ fontSize: '12px', textAlign: 'left', maxHeight: '260px', overflowY: 'auto', color: '#fff' }}>
            {events.length === 0 ? (
              <div style={{ color: '#fff' }}>No events recorded.</div>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {events.map((e, i) => (
                  <li key={`${e.type || 'event'}-${i}`} style={{ marginBottom: 6, color: '#fff' }}>
                    <strong style={{ color: '#fff' }}>Set {e.setNumber || '-'}</strong> - {e.description || e.type || 'Event'}
                    {e.score ? (
                      <span>
                        {' ('}
                        {String(e.team) === 'B' ? (
                          <>
                            <span style={{ color: teamBColor, fontWeight: 'bold' }}>{e.score.B}</span>
                            <span style={{ color: '#fff' }}>-</span>
                            <span style={{ color: teamAColor, fontWeight: 'bold' }}>{e.score.A}</span>
                          </>
                        ) : (
                          <>
                            <span style={{ color: teamAColor, fontWeight: 'bold' }}>{e.score.A}</span>
                            <span style={{ color: '#fff' }}>-</span>
                            <span style={{ color: teamBColor, fontWeight: 'bold' }}>{e.score.B}</span>
                          </>
                        )}
                        {')'}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="summary-modal-buttons">
          {onExportPDF && (
            <button 
              type="button" 
              className="summary-btn-export" 
              onClick={onExportPDF}
              style={{ background: '#00ff00', color: '#000' }}
            >
              📥 Export PDF
            </button>
          )}
          <button type="button" className="summary-btn-close" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
