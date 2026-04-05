import { useState, useEffect } from 'react';
import './SubModal.css';

const isLiberoRole = (r) => r === 'libero1' || r === 'libero2' || r === 'liberocaptain';

export default function SubModal({
  open,
  team,
  teamName,
  teams,
  currentSet,
  sets,
  subLimit,
  injuredPlayers,
  liberoReplacements,
  sanctionSystem,
  onConfirm,
  onExceptional,
  onClose,
  /** Fix #5: pre-select expelled/disqualified player OUT after sanction */
  defaultPlayerOut
}) {
  const [playerOut, setPlayerOut] = useState(null);
  const [playerIn, setPlayerIn] = useState(null);
  const [showExceptional, setShowExceptional] = useState(false);

  // Fix #5: auto-focus OUT when opened from expulsion / disqualification flow
  useEffect(() => {
    if (!open) {
      setPlayerOut(null);
      setPlayerIn(null);
      setShowExceptional(false);
      return;
    }
    setPlayerIn(null);
    setShowExceptional(false);
    if (defaultPlayerOut != null && String(defaultPlayerOut).trim() !== '') {
      setPlayerOut(String(defaultPlayerOut).trim());
    } else {
      setPlayerOut(null);
    }
  }, [open, defaultPlayerOut]);

  if (!open || !teams?.[team]) return null;

  const roster = teams[team].players || [];
  const lineup = teams[team].lineup || [];
  const onCourtJerseys = Array.isArray(lineup) ? lineup.filter(Boolean).map(String) : [];

  // Players currently replaced by libero (original is on bench, cannot be subbed in normally)
  const replacedByLibero = [];
  if (liberoReplacements?.[team]) {
    liberoReplacements[team].forEach((r) => {
      if (onCourtJerseys.includes(String(r.libero))) {
        replacedByLibero.push(String(r.originalPlayer));
      }
    });
  }
  const injured = injuredPlayers?.[team] || [];
  const disqualified = sanctionSystem?.disqualified?.[team] || [];
  const expelledThisSet = (sanctionSystem?.expelled?.[team] || []).filter((e) => e.set === currentSet).map((e) => String(e.jersey));
  const sanctionLocked = new Set([...disqualified.map((d) => String(d.jersey)), ...expelledThisSet]);
  const outJerseyStr = playerOut != null ? String(playerOut) : '';
  const bypassSubCap =
    outJerseyStr && (expelledThisSet.includes(outJerseyStr) || disqualified.some((d) => String(d.jersey) === outJerseyStr));

  // OUT: only non-libero players on court (liberos cannot be substituted - use Libero Replacement)
  const outCandidates = onCourtJerseys.filter((jersey) => {
    const p = roster.find((r) => String(r.jersey) === jersey);
    return p && !isLiberoRole(p.role);
  });

  // IN (bench): exclude liberos, replaced-by-libero, injured, sanction-locked
  const benchJerseys = roster
    .filter((p) => {
      const j = String(p.jersey);
      if (onCourtJerseys.includes(j)) return false;
      if (isLiberoRole(p.role)) return false;
      if (replacedByLibero.includes(j)) return false;
      if (injured.includes(j)) return false;
      if (sanctionLocked.has(j)) return false;
      return true;
    })
    .map((p) => String(p.jersey));

  const setData = sets?.[currentSet - 1];
  const subsUsed = setData?.substitutions?.[team]?.length ?? 0;
  const limit = subLimit || 6;
  const canSub = subsUsed < limit;
  const canConfirmRegular = canSub || bypassSubCap;

  const handleConfirm = () => {
    if (playerOut && playerIn && canConfirmRegular) {
      onConfirm(team, playerOut, playerIn);
      setPlayerOut(null);
      setPlayerIn(null);
      setShowExceptional(false);
      onClose();
    }
  };

  const handleExceptional = () => {
    if (playerOut && playerIn && onExceptional) {
      onExceptional(team, playerOut, playerIn);
      setPlayerOut(null);
      setPlayerIn(null);
      setShowExceptional(false);
      onClose();
    }
  };

  const handleClose = () => {
    setPlayerOut(null);
    setPlayerIn(null);
    setShowExceptional(false);
    onClose();
  };

  return (
    <div className="sub-modal-overlay" onClick={handleClose}>
      <div className="sub-modal-content" onClick={(e) => e.stopPropagation()}>
        <h3 className="sub-modal-title">Substitution – {teamName}</h3>
        <p className="sub-modal-info">
          {defaultPlayerOut
            ? `Expelled/disqualified replacement — #${defaultPlayerOut} is pre-selected OUT. Counts as a regular substitution (${subsUsed}/${limit} used). Choose IN.`
            : canConfirmRegular
              ? bypassSubCap && !canSub
                ? `Replacing expelled/disqualified player — counts as a regular substitution (${subsUsed}/${limit} used). Select OUT, then IN.`
                : `Substitution ${subsUsed + 1}/${limit} – Select player OUT, then player IN`
              : `⚠️ Maximum ${limit} regular substitutions reached - Use Exceptional Substitution for injuries only`}
        </p>

        {outCandidates.length < onCourtJerseys.length && (
          <div className="sub-modal-libero-note">
            ⚠️ Liberos cannot be substituted. Use Libero Replacement for liberos on court.
          </div>
        )}
        {(injured.length > 0 || replacedByLibero.length > 0 || sanctionLocked.size > 0) && (
          <div className="sub-modal-blocked-note">
            {replacedByLibero.length > 0 && <span>Players replaced by libero cannot be substituted. </span>}
            {injured.length > 0 && <span>🚑 Injured players (exceptional sub – locked). </span>}
            {sanctionLocked.size > 0 && <span>⚠️ Sanction-locked players cannot sub in. </span>}
          </div>
        )}

        <div className="sub-modal-sections">
          <div className="sub-modal-section">
            <h4>Players ON Court (Select player to come OUT)</h4>
            <div className="sub-modal-player-grid">
              {outCandidates.map((jersey) => {
                const p = roster.find((r) => String(r.jersey) === jersey);
                const label = p ? `#${jersey} ${p.name}` : `#${jersey}`;
                const selected = playerOut === jersey;
                return (
                  <button
                    key={jersey}
                    type="button"
                    className={`sub-modal-player-btn ${selected ? 'selected' : ''}`}
                    onClick={() => setPlayerOut(jersey)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="sub-modal-section">
            <h4>Players on Bench (Select player to come IN)</h4>
            <div className="sub-modal-player-grid">
              {benchJerseys.map((jersey) => {
                const p = roster.find((r) => String(r.jersey) === jersey);
                const label = p ? `#${jersey} ${p.name}` : `#${jersey}`;
                const selected = playerIn === jersey;
                return (
                  <button
                    key={jersey}
                    type="button"
                    className={`sub-modal-player-btn ${selected ? 'selected' : ''}`}
                    onClick={() => setPlayerIn(jersey)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {playerOut && playerIn && (
          <p className="sub-modal-summary">
            OUT: #{playerOut} → IN: #{playerIn}
          </p>
        )}

        <div className="sub-modal-buttons">
          <button type="button" className="sub-modal-btn cancel" onClick={handleClose}>
            Cancel
          </button>
          {onExceptional && (
            <button
              type="button"
              className="sub-modal-btn exceptional"
              onClick={() => setShowExceptional(true)}
              disabled={!playerOut || !playerIn}
              style={{ background: '#ff3b3b', color: '#fff', border: '2px solid #ff6b6b' }}
            >
              🚑 Exceptional Substitution
            </button>
          )}
          {showExceptional && onExceptional ? (
            <>
              <div className="sub-modal-exceptional-warning">
                ⚠️ This substitution is for injured players only. It will NOT count toward the 6-substitution limit, and the injured player will be locked for the entire match.
              </div>
              <button
                type="button"
                className="sub-modal-btn confirm"
                onClick={handleExceptional}
                disabled={!playerOut || !playerIn}
                style={{ background: '#ff3b3b', color: '#fff' }}
              >
                Confirm Exceptional Substitution
              </button>
            </>
          ) : (
            <button
              type="button"
              className="sub-modal-btn confirm"
              onClick={handleConfirm}
              disabled={!playerOut || !playerIn || (!canSub && !bypassSubCap)}
            >
              🔁 Regular Substitution
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
