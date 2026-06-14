import { useRef, useState, useEffect } from 'react';
import CoachLineupApprovalModal from './CoachLineupApprovalModal';
import {
  parseCoachLineupFile,
  buildCoachLineupApprovalPreview,
  extractCoachLineupDetails
} from '../utils/coachLineup';

/**
 * Coach lineup file upload + approval UI (from DC_Volley coach line up.html)
 */
export default function CoachLineupInject({
  teamAName,
  teamBName,
  rosterA,
  rosterB,
  lineupA,
  lineupB,
  onLineupAChange,
  onLineupBChange,
  lockedA,
  lockedB,
  onLockAChange,
  onLockBChange,
  setNumber = 1,
  pendingApproval,
  onPendingChange,
  onCoachLineupApproved
}) {
  const fileInputA = useRef(null);
  const fileInputB = useRef(null);
  const [rejectedA, setRejectedA] = useState(false);
  const [rejectedB, setRejectedB] = useState(false);

  useEffect(() => {
    setRejectedA(false);
    setRejectedB(false);
  }, [setNumber]);

  const handleFileLoad = (event, forTeam) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = parseCoachLineupFile(e.target.result);

        if (data.courtSide && data.courtSide !== forTeam) {
          const slotTeam = forTeam === 'A' ? teamAName : teamBName;
          if (
            !window.confirm(
              `⚠️ SIDE MISMATCH!\n\nThis file is for Team ${data.courtSide} (${data.teamName || '?'})\nbut you are loading into Team ${forTeam} (${slotTeam}) slot.\n\nLoad anyway?`
            )
          ) {
            event.target.value = '';
            return;
          }
        }

        const teamName = forTeam === 'A' ? teamAName : teamBName;
        const roster = forTeam === 'A' ? rosterA : rosterB;
        const bodyText = buildCoachLineupApprovalPreview(forTeam, teamName, data, roster);
        onPendingChange({ forTeam, data, bodyText, title: `📋 Coach Lineup — ${teamName}` });
      } catch (err) {
        window.alert(`❌ ERROR READING FILE\n\n${err.message}`);
      }
      event.target.value = '';
    };
    reader.readAsText(file);
  };

  const handleApproveDecision = (approved) => {
    const pending = pendingApproval;
    onPendingChange(null);
    if (!pending?.forTeam || !pending?.data) return;

    const forTeam = pending.forTeam;
    const data = pending.data;

    if (approved) {
      const newLineup = data.lineup.map(String);
      if (forTeam === 'A') {
        onLineupAChange(newLineup);
        onLockAChange(true);
        setRejectedA(false);
      } else {
        onLineupBChange(newLineup);
        onLockBChange(true);
        setRejectedB(false);
      }
      const details = extractCoachLineupDetails(data, forTeam, setNumber);
      onCoachLineupApproved?.(forTeam, details);
      window.alert(
        `✅ TEAM ${forTeam} LINEUP APPROVED & LOCKED!\n\nCourt positions are set. No manual changes allowed.\nVerify the court display above, then load Team ${forTeam === 'A' ? 'B' : 'A'}'s file or continue.`
      );
    } else if (forTeam === 'A') {
      setRejectedA(true);
    } else {
      setRejectedB(true);
    }
  };

  const unlockCoachLineup = (team) => {
    const teamName = team === 'A' ? teamAName : teamBName;
    if (
      !window.confirm(
        `⚠️ REJECT ${teamName}'s lineup?\n\nThis will CLEAR all their positions and allow manual assignment.\nAre you sure?`
      )
    ) {
      return;
    }
    if (team === 'A') {
      onLineupAChange(Array(6).fill(null));
      onLockAChange(false);
      setRejectedA(true);
    } else {
      onLineupBChange(Array(6).fill(null));
      onLockBChange(false);
      setRejectedB(true);
    }
  };

  const statusFor = (team, locked) => {
    if (locked) {
      return (
        <span style={{ color: '#00ff00' }}>
          🔒 APPROVED & LOCKED{' '}
          <button
            type="button"
            onClick={() => unlockCoachLineup(team)}
            style={{
              background: '#ff9500',
              color: '#fff',
              border: 'none',
              padding: '2px 8px',
              borderRadius: 3,
              fontSize: 9,
              cursor: 'pointer',
              marginLeft: 5,
              fontWeight: 'bold'
            }}
          >
            ✕ Reject
          </button>
        </span>
      );
    }
    if ((team === 'A' && rejectedA) || (team === 'B' && rejectedB)) {
      return <span style={{ color: '#ff9500' }}>⚠️ Rejected — assign manually or reload.</span>;
    }
    return <span style={{ color: '#888' }}>Waiting for Team {team} coach file…</span>;
  };

  return (
    <>
      <div
        style={{
          background: '#0a1a0a',
          border: '2px solid #00ff00',
          borderRadius: 8,
          padding: '14px 16px',
          margin: '14px 0'
        }}
      >
        <div style={{ color: '#00ff00', fontSize: 13, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' }}>
          📥 COACH LINEUP INJECT
        </div>
        <div style={{ color: '#ccc', fontSize: 11, marginBottom: 12, textAlign: 'center' }}>
          Load each coach&apos;s submitted lineup file separately for scorer approval.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={{ color: '#ff6b6b', fontSize: 11, fontWeight: 'bold', marginBottom: 6, textAlign: 'center' }}>
              {teamAName || 'Team A'}
            </div>
            <button
              type="button"
              onClick={() => fileInputA.current?.click()}
              style={{
                background: '#ff6b6b',
                color: '#fff',
                padding: '8px 14px',
                fontSize: 11,
                fontWeight: 'bold',
                width: '100%',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer'
              }}
            >
              📂 Load Team A Lineup
            </button>
            <input
              ref={fileInputA}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={(e) => handleFileLoad(e, 'A')}
            />
            <div style={{ fontSize: 10, marginTop: 6, textAlign: 'center' }}>{statusFor('A', lockedA)}</div>
          </div>
          <div>
            <div style={{ color: '#4ecdc4', fontSize: 11, fontWeight: 'bold', marginBottom: 6, textAlign: 'center' }}>
              {teamBName || 'Team B'}
            </div>
            <button
              type="button"
              onClick={() => fileInputB.current?.click()}
              style={{
                background: '#4ecdc4',
                color: '#000',
                padding: '8px 14px',
                fontSize: 11,
                fontWeight: 'bold',
                width: '100%',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer'
              }}
            >
              📂 Load Team B Lineup
            </button>
            <input
              ref={fileInputB}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={(e) => handleFileLoad(e, 'B')}
            />
            <div style={{ fontSize: 10, marginTop: 6, textAlign: 'center' }}>{statusFor('B', lockedB)}</div>
          </div>
        </div>
      </div>

      <CoachLineupApprovalModal
        open={Boolean(pendingApproval)}
        title={pendingApproval?.title || '📋 Coach Lineup Review'}
        bodyText={pendingApproval?.bodyText || ''}
        onApprove={() => handleApproveDecision(true)}
        onReject={() => handleApproveDecision(false)}
      />
    </>
  );
}

export function isLineupLockedForTeam(team, lockedA, lockedB) {
  return (team === 'A' && lockedA) || (team === 'B' && lockedB);
}
