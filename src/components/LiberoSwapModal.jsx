import React from 'react';
import './FairPlayForfeitModal.css';

export default function LiberoSwapModal({ open, gameData, onClose, onSwap, swapping }) {
  if (!open || !gameData) return null;

  const teamAName = gameData.teamAName || 'Team A';
  const teamBName = gameData.teamBName || 'Team B';

  const renderTeam = (team, teamName) => {
    const t = gameData.teams?.[team];
    const liberos = (t?.players || []).filter((p) => p.role === 'libero1' || p.role === 'libero2');
    const lineup = t?.lineup || [];
    const onCourtLib = liberos.find((p) => lineup.includes(String(p.jersey)) || lineup.includes(p.jersey));
    const benchLib = onCourtLib ? liberos.find((p) => String(p.jersey) !== String(onCourtLib.jersey)) : null;

    return (
      <div key={team} className="libero-swap-team-block">
        <div className="libero-swap-team-name">{teamName}</div>
        {liberos.length < 2 ? (
          <div className="libero-swap-msg">Needs two registered Liberos (L1 &amp; L2) to exchange.</div>
        ) : !onCourtLib ? (
          <div className="libero-swap-msg">No Libero currently on court.</div>
        ) : (
          <div className="libero-swap-row">
            <div className="libero-swap-info">
              ON COURT:{' '}
              <b className="libero-swap-on">
                #{onCourtLib.jersey} {onCourtLib.name || ''} ({onCourtLib.role === 'libero1' ? 'L1' : 'L2'})
              </b>
              <br />
              BENCH:{' '}
              <b className="libero-swap-bench">
                #{benchLib.jersey} {benchLib.name || ''} ({benchLib.role === 'libero1' ? 'L1' : 'L2'})
              </b>
            </div>
            <button
              type="button"
              className="libero-swap-btn"
              disabled={swapping}
              onClick={() => onSwap(team)}
            >
              🔁 SWAP
              <br />#{onCourtLib.jersey} → #{benchLib.jersey}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="libero-swap-overlay" onClick={onClose}>
      <div className="libero-swap-content" onClick={(e) => e.stopPropagation()}>
        <h2 className="libero-swap-title">🔁 LIBERO ↔ LIBERO EXCHANGE</h2>
        <p className="libero-swap-note">
          FIVB rule: the Libero on court may be exchanged directly by the team&apos;s second Libero.
          <br />
          Recorded on the R-6 sheet with only the entering Libero (Rep. column stays empty).
        </p>
        {renderTeam('A', teamAName)}
        {renderTeam('B', teamBName)}
        <button type="button" className="libero-swap-close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
