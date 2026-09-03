import React from 'react';
import { firestoreTimeToDate, matchSummarySetWonTime } from '../utils/firestoreTime';
import './MatchDataModal.css';

export default function MatchDataModal({ open, gameData, onClose }) {
  if (!open || !gameData) return null;

  const matchInfo = {
    competition: gameData.competition || 'N/A',
    matchNumber: gameData.matchNumber || 'N/A',
    venue: gameData.venue || 'N/A',
    city: gameData.city || 'N/A',
    countryCode: gameData.countryCode || 'N/A',
    date: gameData.matchDate || gameData.date || 'N/A',
    time: gameData.matchTime || gameData.time || 'N/A',
    division: gameData.division || 'N/A',
    category: gameData.category || 'N/A',
    pool: gameData.pool || 'N/A',
    format: gameData.format || '3',
    subLimit: gameData.subLimit || '6',
    teamAName: gameData.teamAName || 'Team A',
    teamBName: gameData.teamBName || 'Team B'
  };

  const officials = gameData.officials || {};
  const sets = gameData.sets || [];
  const currentSet = gameData.currentSet || 1;
  const setsWon = gameData.setsWon || { A: 0, B: 0 };
  const matchSummary = gameData.matchSummary || [];
  const matchStartDt =
    firestoreTimeToDate(gameData.playStartedAt) ||
    firestoreTimeToDate(gameData.createdAt) ||
    (sets[0]
      ? firestoreTimeToDate(sets[0].startTime) || firestoreTimeToDate(sets[0].setClockStartedAt)
      : null);
  let latestSetEnd = null;
  sets.forEach((set, i) => {
    if (!set?.winner) return;
    const e = firestoreTimeToDate(set.endTime) || matchSummarySetWonTime(matchSummary, i + 1);
    if (e && (!latestSetEnd || e.getTime() > latestSetEnd.getTime())) latestSetEnd = e;
  });
  const matchDurMs =
    matchStartDt && latestSetEnd ? latestSetEnd.getTime() - matchStartDt.getTime() : null;
  const matchDurLabel =
    matchDurMs != null && matchDurMs >= 0
      ? `${Math.floor(matchDurMs / 60000)}:${String(Math.floor((matchDurMs % 60000) / 1000)).padStart(2, '0')}`
      : null;
  const dst = gameData.decidingSetToss;
  const ct = gameData.coinToss;

  return (
    <div className="match-data-modal-overlay" onClick={onClose}>
      <div className="match-data-modal-content" onClick={(e) => e.stopPropagation()}>
        <h3 className="match-data-modal-title">💾 MATCH DATA</h3>
        
        <div className="match-data-section">
          <h4>Match Information</h4>
          <div className="match-data-grid">
            <div className="match-data-item">
              <span className="match-data-label">Competition:</span>
              <span className="match-data-value">{matchInfo.competition}</span>
            </div>
            <div className="match-data-item">
              <span className="match-data-label">Match Number:</span>
              <span className="match-data-value">{matchInfo.matchNumber}</span>
            </div>
            <div className="match-data-item">
              <span className="match-data-label">Venue:</span>
              <span className="match-data-value">{matchInfo.venue}</span>
            </div>
            <div className="match-data-item">
              <span className="match-data-label">City:</span>
              <span className="match-data-value">{matchInfo.city}</span>
            </div>
            <div className="match-data-item">
              <span className="match-data-label">Date:</span>
              <span className="match-data-value">{matchInfo.date}</span>
            </div>
            <div className="match-data-item">
              <span className="match-data-label">Time:</span>
              <span className="match-data-value">{matchInfo.time}</span>
            </div>
            <div className="match-data-item">
              <span className="match-data-label">Format:</span>
              <span className="match-data-value">Best of {matchInfo.format}</span>
            </div>
            <div className="match-data-item">
              <span className="match-data-label">Substitution Limit:</span>
              <span className="match-data-value">{matchInfo.subLimit} per set</span>
            </div>
            <div className="match-data-item">
              <span className="match-data-label">Match start (clock):</span>
              <span className="match-data-value">{matchStartDt ? matchStartDt.toLocaleString() : 'N/A'}</span>
            </div>
            <div className="match-data-item">
              <span className="match-data-label">Match duration (to latest set end):</span>
              <span className="match-data-value">{matchDurLabel ?? 'N/A'}</span>
            </div>
          </div>
        </div>

        {ct && (ct.winner || ct.firstServer) && (
          <div className="match-data-section">
            <h4>Pre-match coin toss</h4>
            <div className="match-data-grid">
              <div className="match-data-item">
                <span className="match-data-label">Toss winner:</span>
                <span className="match-data-value">
                  {ct.winner === 'team1'
                    ? ct.team1Name || 'Team 1 (setup)'
                    : ct.winner === 'team2'
                      ? ct.team2Name || 'Team 2 (setup)'
                      : ct.winner || '—'}
                </span>
              </div>
              <div className="match-data-item">
                <span className="match-data-label">Choice:</span>
                <span className="match-data-value">
                  {ct.choice === 'serve'
                    ? 'Serve first'
                    : ct.choice === 'receive'
                      ? 'Receive first'
                      : ct.choice === 'side'
                        ? 'Choice of side'
                        : ct.choice || '—'}
                </span>
              </div>
              <div className="match-data-item">
                <span className="match-data-label">First serve:</span>
                <span className="match-data-value">
                  {ct.firstServer === 'A' ? matchInfo.teamAName : ct.firstServer === 'B' ? matchInfo.teamBName : '—'}
                </span>
              </div>
            </div>
          </div>
        )}

        {dst?.winner && (
          <div className="match-data-section">
            <h4>Deciding set toss</h4>
            <div className="match-data-grid">
              <div className="match-data-item">
                <span className="match-data-label">Set:</span>
                <span className="match-data-value">{dst.setNumber ?? '—'}</span>
              </div>
              <div className="match-data-item">
                <span className="match-data-label">Toss winner:</span>
                <span className="match-data-value">
                  {dst.winner === 'A' ? matchInfo.teamAName : matchInfo.teamBName}
                </span>
              </div>
              <div className="match-data-item">
                <span className="match-data-label">Decision:</span>
                <span className="match-data-value">
                  {dst.choice === 'serve' ? 'Serve first' : dst.choice === 'receive' ? 'Receive first' : '—'}
                </span>
              </div>
              <div className="match-data-item">
                <span className="match-data-label">Referee&apos;s left:</span>
                <span className="match-data-value">
                  {dst.teamOnRefereeLeft === 'A'
                    ? matchInfo.teamAName
                    : dst.teamOnRefereeLeft === 'B'
                      ? matchInfo.teamBName
                      : '—'}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="match-data-section">
          <h4>Teams</h4>
          <div className="match-data-grid">
            <div className="match-data-item">
              <span className="match-data-label">Team A:</span>
              <span className="match-data-value" style={{ color: gameData.teamAColor || '#ff6b6b' }}>
                {matchInfo.teamAName}
              </span>
            </div>
            <div className="match-data-item">
              <span className="match-data-label">Team B:</span>
              <span className="match-data-value" style={{ color: gameData.teamBColor || '#4ecdc4' }}>
                {matchInfo.teamBName}
              </span>
            </div>
            <div className="match-data-item">
              <span className="match-data-label">Sets Won:</span>
              <span className="match-data-value">
                {matchInfo.teamAName}: {setsWon.A} | {matchInfo.teamBName}: {setsWon.B}
              </span>
            </div>
            {/* Fix #8: prominent current-set points for both teams */}
            {sets[currentSet - 1] && (
              <div className="match-data-item match-data-points-highlight">
                <span className="match-data-label">Points (current set)</span>
                <div className="match-data-points-row">
                  <span className="match-data-value match-data-points-a">
                    {matchInfo.teamAName}: {sets[currentSet - 1].score?.A ?? 0}
                  </span>
                  <span className="match-data-value match-data-points-sep">—</span>
                  <span className="match-data-value match-data-points-b">
                    {matchInfo.teamBName}: {sets[currentSet - 1].score?.B ?? 0}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="match-data-section">
          <h4>Current Set</h4>
          <div className="match-data-grid">
            <div className="match-data-item">
              <span className="match-data-label">Set Number:</span>
              <span className="match-data-value">{currentSet}</span>
            </div>
            {sets[currentSet - 1] && (
              <>
                <div className="match-data-item">
                  <span className="match-data-label">Score:</span>
                  <span className="match-data-value">
                    {matchInfo.teamAName}: {sets[currentSet - 1].score?.A || 0} | {matchInfo.teamBName}: {sets[currentSet - 1].score?.B || 0}
                  </span>
                </div>
                <div className="match-data-item">
                  <span className="match-data-label">Serving:</span>
                  <span className="match-data-value">
                    {sets[currentSet - 1].serving === 'A' ? matchInfo.teamAName : matchInfo.teamBName}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="match-data-section">
          <h4>Match Officials</h4>
          <div className="match-data-grid">
            <div className="match-data-item">
              <span className="match-data-label">1st Referee:</span>
              <span className="match-data-value">{officials.ref1 || 'N/A'}</span>
            </div>
            <div className="match-data-item">
              <span className="match-data-label">2nd Referee:</span>
              <span className="match-data-value">{officials.ref2 || 'N/A'}</span>
            </div>
            <div className="match-data-item">
              <span className="match-data-label">Scorer:</span>
              <span className="match-data-value">{officials.scorer || 'N/A'}</span>
            </div>
            <div className="match-data-item">
              <span className="match-data-label">Assistant Scorer:</span>
              <span className="match-data-value">{officials.assistScorer || 'N/A'}</span>
            </div>
          </div>
        </div>

        {gameData.sanctionSystem && (
          <div className="match-data-section">
            <h4>Sanctions</h4>
            <div className="match-data-grid" style={{ fontSize: '12px' }}>
              {['A', 'B'].map((t) => {
                const name = t === 'A' ? matchInfo.teamAName : matchInfo.teamBName;
                const mis = gameData.sanctionSystem.misconduct?.[t] || [];
                const dlog = gameData.sanctionSystem.delay?.[t]?.log || [];
                if (mis.length === 0 && dlog.length === 0) return null;
                return (
                  <div key={t} style={{ gridColumn: '1 / -1' }}>
                    <strong style={{ color: t === 'A' ? '#ff6b6b' : '#4ecdc4' }}>{name}</strong>
                    <ul style={{ margin: '6px 0 0 16px' }}>
                      {mis.map((r, i) => (
                        <li key={`m-${i}`}>
                          Set {r.set}: {r.type} — {r.personType === 'coach' ? 'Coach' : `#${r.person}`}
                        </li>
                      ))}
                      {dlog.map((r, i) => (
                        <li key={`d-${i}`}>Set {r.set}: Delay {r.type}</li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {gameData.officials?.signatures && Object.keys(gameData.officials.signatures).some((k) => gameData.officials.signatures[k]?.length > 80) && (
          <div className="match-data-section">
            <h4>Official signatures</h4>
            <p style={{ fontSize: '12px', color: '#aaa', marginBottom: '10px' }}>
              {gameData.status === 'FINISHED' ? 'Signatures on file for this match.' : 'Captured signatures (add post-match captain signatures from Officials if needed).'}
            </p>
            <div className="match-data-signatures-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
              {[
                ['firstRefSign', '1st Referee'],
                ['secondRefSign', '2nd Referee'],
                ['scorerSign', 'Scorer'],
                ['assistScorerSign', 'Asst. Scorer'],
                ['captainSignA1', `${matchInfo.teamAName} — Captain (before)`],
                ['captainSignA2', `${matchInfo.teamAName} — Captain (after)`],
                ['coachSignA', `${matchInfo.teamAName} — Coach`],
                ['captainSignB1', `${matchInfo.teamBName} — Captain (before)`],
                ['captainSignB2', `${matchInfo.teamBName} — Captain (after)`],
                ['coachSignB', `${matchInfo.teamBName} — Coach`]
              ].map(([key, label]) => {
                const url = gameData.officials.signatures[key];
                if (!url || url.length < 80) return null;
                return (
                  <div key={key} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>{label}</div>
                    <img src={url} alt={label} style={{ maxWidth: '100%', height: '48px', objectFit: 'contain', border: '1px solid #444', background: '#fff' }} />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="match-data-section">
          <h4>Game Code</h4>
          <div className="match-data-grid">
            <div className="match-data-item">
              <span className="match-data-label">Code:</span>
              <span className="match-data-value" style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                {gameData.gameCode || 'N/A'}
              </span>
            </div>
            <div className="match-data-item">
              <span className="match-data-label">Status:</span>
              <span className="match-data-value">
                {gameData.status === 'FINISHED' ? '🏆 FINISHED' : '▶️ LIVE'}
              </span>
            </div>
          </div>
        </div>

        <div className="match-data-modal-buttons">
          <button type="button" className="match-data-btn-close" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
