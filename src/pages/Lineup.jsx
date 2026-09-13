import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { SUBSTITUTION_LIMIT } from '../utils/matchRules';
import './Lineup.css';

const POSITION_LABELS = ['P1-RB', 'P2-RF', 'P3-MF', 'P4-LF', 'P5-LB', 'P6-MB'];

function getSetWinner(set) {
  if (!set) return null;
  if (set.winner === 'A' || set.winner === 'B') return set.winner;
  if (set.endTime && set.score && set.score.A !== set.score.B) {
    return set.score.A > set.score.B ? 'A' : 'B';
  }
  return null;
}

function isLiberoRole(role) {
  return role === 'libero1' || role === 'libero2' || role === 'liberocaptain';
}

function getLiberoReplacementAt(replacements, liberoJersey, courtPosition) {
  if (!replacements?.length || liberoJersey == null) return null;
  const lib = String(liberoJersey);
  const forLibero = replacements.filter((r) => String(r.libero) === lib);
  if (forLibero.length === 0) return null;

  const exact = forLibero.find((r) => Number(r.position) === courtPosition);
  if (exact?.originalPlayer) return String(exact.originalPlayer);

  if (forLibero.length === 1 && forLibero[0].originalPlayer) {
    return String(forLibero[0].originalPlayer);
  }

  const legacyIndex = forLibero.find((r) => Number(r.position) === courtPosition - 1);
  if (legacyIndex?.originalPlayer) return String(legacyIndex.originalPlayer);

  return forLibero[0]?.originalPlayer ? String(forLibero[0].originalPlayer) : null;
}

export default function Lineup() {
  const { gameCode, setGameCode, gameData, loading, error } = useGame();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const codeFromUrl = searchParams.get('code');

  useEffect(() => {
    const normalized = codeFromUrl?.trim();
    if (normalized && normalized !== gameCode) setGameCode(normalized);
  }, [codeFromUrl, gameCode, setGameCode]);

  useEffect(() => {
    if (!gameCode && !codeFromUrl) navigate('/');
  }, [gameCode, codeFromUrl, navigate]);

  const placeholder = loading
    ? 'Loading match data…'
    : error || (!gameData ? 'No match data available. Please start a match in the main scoresheet.' : '');
  const matchInfo = gameData?.matchInfo || {};
  const currentSet = Number(gameData?.currentSet) || 1;
  const sets = gameData?.sets || [];
  const set = sets[currentSet - 1];
  const swapped = !!gameData?.swapped;
  const leftTeam = swapped ? 'B' : 'A';
  const rightTeam = swapped ? 'A' : 'B';

  const teamName = (team) =>
    team === 'A'
      ? matchInfo.teamAName || gameData?.teamAName || 'Team A'
      : matchInfo.teamBName || gameData?.teamBName || 'Team B';
  const teamColor = (team) =>
    team === 'A'
      ? matchInfo.teamAColor || gameData?.teamAColor || '#ff6b6b'
      : matchInfo.teamBColor || gameData?.teamBColor || '#4ecdc4';
  const teamLogo = (team) =>
    gameData?.teams?.[team]?.logoData || matchInfo[`logo${team}`] || '';

  const playerForJersey = (team, jersey) =>
    (gameData?.teams?.[team]?.players || []).find((player) => String(player.jersey) === String(jersey));

  const renderCourt = (team, isLeft) => {
    const lineup = gameData?.teams?.[team]?.lineup || [];
    const logoSrc = teamLogo(team);
    const fallbackLetter = (teamName(team) || team)[0];
    const fallbackColor = team === 'A' ? '#e94560' : '#00d9ff';
    const replacements = (gameData?.liberoReplacements?.[team] || []).filter(
      (r) => !r.set || r.set === currentSet
    );

    return (
      <div className={`lineup-display-court-visual ${isLeft ? 'court-left' : 'court-right'}`}>
        <div className="lineup-display-court-grid">
          {POSITION_LABELS.map((label, idx) => {
            const jersey = lineup[idx];
            const player = playerForJersey(team, jersey);
            const isServer = idx === 0 && set?.serving === team;
            let isLibero = player && isLiberoRole(player.role);
            const origJersey = jersey != null
              ? getLiberoReplacementAt(replacements, jersey, idx + 1)
              : null;
            if (origJersey && !isLibero) isLibero = true;
            return (
              <div
                key={label}
                data-pos={idx + 1}
                className={`lineup-display-court-pos${isServer ? ' server' : ''}${isLibero ? ' libero-on-court' : ''}`}
              >
                <div className="lineup-display-pos-label">{label}</div>
                {player ? (
                  <div className="lineup-display-pos-logo-wrap">
                    {logoSrc ? (
                      <img src={logoSrc} alt="" />
                    ) : (
                      <span
                        className="lineup-display-pos-logo-fallback"
                        style={{ color: fallbackColor }}
                      >
                        {fallbackLetter}
                      </span>
                    )}
                  </div>
                ) : null}
                <div className="lineup-display-pos-jersey">{player ? `#${player.jersey}` : '-'}</div>
                {origJersey != null && (
                  <div className="lineup-display-pos-orig">⇄ #{origJersey}</div>
                )}
                {player?.name && <div className="lineup-display-pos-name">{player.name.split(' ')[0]}</div>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderRotation = (team) => {
    const lineup = gameData?.teams?.[team]?.lineup || [];
    return (
      <div className="lineup-display-rotation-order">
        <div className="lineup-display-rotation-title">Rotation Order (Next →)</div>
        <div className="lineup-display-rotation-list">
          {Array.from({ length: 6 }).map((_, index) => {
            const jersey = lineup[index];
            const player = playerForJersey(team, jersey);
            return (
              <div
                key={index}
                className={`lineup-display-rotation-item${player && isLiberoRole(player.role) ? ' libero-rotation' : ''}`}
              >
                <div className="lineup-display-rotation-pos">P{index + 1}</div>
                <div className="lineup-display-rotation-jersey">#{jersey || '-'}</div>
                {player?.name && <div className="lineup-display-rotation-name">{player.name.split(' ')[0]}</div>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderLiberos = (team) => {
    const players = gameData?.teams?.[team]?.players || [];
    const lineup = (gameData?.teams?.[team]?.lineup || []).map(String);
    const liberos = players.filter((player) => isLiberoRole(player.role));
    if (!liberos.length) return null;
    return (
      <div className="lineup-display-liberos-section">
        <div className="lineup-display-liberos-title">Liberos</div>
        <div className="lineup-display-libero-list">
          {liberos.map((libero) => (
            <div key={libero.jersey} className="lineup-display-libero-item">
              #{libero.jersey} {libero.name?.split(' ')[0] || ''}
              {lineup.includes(String(libero.jersey)) && (
                <span className="lineup-display-on-court">● ON COURT</span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderStats = (team) => {
    const timeoutsUsed = set?.timeouts?.[team]?.length ?? 0;
    const substitutionsUsed = set?.substitutions?.[team]?.length ?? 0;
    const subLimit = Number(gameData?.subLimit || matchInfo.subLimitPerSet || SUBSTITUTION_LIMIT) || SUBSTITUTION_LIMIT;
    return (
      <div className="lineup-display-stats-row">
        <div className="lineup-display-stat-item">
          <span className="lineup-display-stat-label">Timeouts Left</span>
          <span className="lineup-display-stat-value">{Math.max(0, 2 - timeoutsUsed)} / 2</span>
        </div>
        <div className="lineup-display-stat-item">
          <span className="lineup-display-stat-label">Subs Left</span>
          <span className="lineup-display-stat-value">
            {Math.max(0, subLimit - substitutionsUsed)} / {subLimit}
          </span>
        </div>
      </div>
    );
  };

  const renderTeam = (team, isLeft) => {
    const logoSrc = teamLogo(team);
    const titleColor = team === 'A' ? '#ff6b6b' : '#4ecdc4';
    return (
      <div className="lineup-display-team-lineup">
        <div className="lineup-display-lineup-title" style={{ color: titleColor }}>
          {logoSrc ? (
            <span className="lineup-display-lineup-title-logo">
              <img src={logoSrc} alt="" />
            </span>
          ) : null}
          <span>{teamName(team)}</span>
        </div>
        {renderCourt(team, isLeft)}
        {renderRotation(team)}
        {renderLiberos(team)}
        {renderStats(team)}
      </div>
    );
  };

  const format = Number(matchInfo.format || gameData?.format) || 3;
  const targetPoints = (format === 5 && currentSet === 5) || (format === 3 && currentSet === 3) ? 15 : 25;
  const leftSetsWon = sets.filter((s) => getSetWinner(s) === leftTeam).length;
  const rightSetsWon = sets.filter((s) => getSetWinner(s) === rightTeam).length;
  const contentMessage = placeholder || (!set ? 'Waiting for match to start...' : '');

  return (
    <div className="lineup-display-root">
      {contentMessage ? (
        <div className="lineup-display-no-data">{contentMessage}</div>
      ) : (
        <div className="lineup-display-content">
          <div className="lineup-display-score">
            <div className="lineup-display-team-score">
              <div className="lineup-display-banner-name team-a">
                {teamLogo(leftTeam) ? (
                  <div className="lineup-display-banner-logo">
                    <img src={teamLogo(leftTeam)} alt="" />
                  </div>
                ) : null}
                <span className="lineup-display-banner-text">{teamName(leftTeam)}</span>
              </div>
              <div className="lineup-display-score-box">{set.score?.[leftTeam] ?? 0}</div>
              <div className="lineup-display-sets-won">Sets: <span>{leftSetsWon}</span></div>
            </div>

            <div className="lineup-display-set-center">
              <div>
                <div className="lineup-display-set-title">SET {currentSet}</div>
                <div className="lineup-display-set-dots">
                  {Array.from({ length: format }).map((_, index) => {
                    const winner = getSetWinner(sets[index]);
                    const color = winner ? teamColor(winner) : undefined;
                    return (
                      <div
                        key={index}
                        className="lineup-display-set-dot"
                        style={winner ? { background: color, borderColor: color } : undefined}
                      >
                        {index + 1}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="lineup-display-set-type">(First to {targetPoints}, win by 2)</div>
            </div>

            <div className="lineup-display-team-score lineup-display-team-score-right">
              <div className="lineup-display-banner-name team-b">
                {teamLogo(rightTeam) ? (
                  <div className="lineup-display-banner-logo">
                    <img src={teamLogo(rightTeam)} alt="" />
                  </div>
                ) : null}
                <span className="lineup-display-banner-text">{teamName(rightTeam)}</span>
              </div>
              <div className="lineup-display-score-box">{set.score?.[rightTeam] ?? 0}</div>
              <div className="lineup-display-sets-won">Sets: <span>{rightSetsWon}</span></div>
            </div>
          </div>

          <div className="lineup-display-lineups">
            {renderTeam(leftTeam, true)}
            {renderTeam(rightTeam, false)}
          </div>
        </div>
      )}

      <div className="lineup-display-refresh">Auto-refreshes every 2 seconds to show live updates</div>
      <div className="lineup-display-footer">DC_Volley © 2025 | Digital Volleyball Scoresheet</div>
    </div>
  );
}
