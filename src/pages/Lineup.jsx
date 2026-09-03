import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { SUBSTITUTION_LIMIT } from '../utils/matchRules';
import './Lineup.css';

const POSITION_ORDER = [3, 2, 1, 4, 5, 0];
const POSITION_LABELS = ['P4-LF', 'P3-MF', 'P2-RF', 'P5-LB', 'P6-MB', 'P1-RB'];

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

  const playerForJersey = (team, jersey) =>
    (gameData?.teams?.[team]?.players || []).find((player) => String(player.jersey) === String(jersey));

  const renderCourt = (team) => {
    const lineup = gameData?.teams?.[team]?.lineup || [];
    return (
      <div className="lineup-display-court-visual">
        <div className="lineup-display-court-grid">
          {POSITION_ORDER.map((lineupIndex, index) => {
            const jersey = lineup[lineupIndex];
            const player = playerForJersey(team, jersey);
            const isServer = lineupIndex === 0 && set?.serving === team;
            const isLibero = player && isLiberoRole(player.role);
            return (
              <div
                key={POSITION_LABELS[index]}
                className={`lineup-display-court-pos${isServer ? ' server' : ''}${isLibero ? ' libero-on-court' : ''}`}
              >
                <div className="lineup-display-pos-label">{POSITION_LABELS[index]}</div>
                <div className="lineup-display-pos-jersey">{player ? `#${player.jersey}` : '-'}</div>
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
    return (
      <div className="lineup-display-stats-row">
        <div className="lineup-display-stat-item">
          <span className="lineup-display-stat-label">Timeouts Left</span>
          <span className="lineup-display-stat-value">{Math.max(0, 2 - timeoutsUsed)} / 2</span>
        </div>
        <div className="lineup-display-stat-item">
          <span className="lineup-display-stat-label">Subs Left</span>
          <span className="lineup-display-stat-value">
            {Math.max(0, SUBSTITUTION_LIMIT - substitutionsUsed)} / {SUBSTITUTION_LIMIT}
          </span>
        </div>
      </div>
    );
  };

  const renderTeam = (team) => (
    <div className="lineup-display-team-lineup">
      <div className="lineup-display-lineup-title" style={{ color: teamColor(team) }}>{teamName(team)}</div>
      {renderCourt(team)}
      {renderRotation(team)}
      {renderLiberos(team)}
      {renderStats(team)}
    </div>
  );

  const format = Number(matchInfo.format || gameData?.format) || 3;
  const contentMessage = placeholder || (!set ? 'Waiting for match to start...' : '');

  return (
    <div className="lineup-display-root">
      <div className="lineup-display-header">
        <div className="lineup-display-match-title">
          {gameData ? matchInfo.competition || gameData.competition || 'Match' : 'Lineup & Rotation Display'}
        </div>
        <div className="lineup-display-match-info">
          {gameData
            ? `${matchInfo.venue || gameData.venue || ''}${matchInfo.venue || gameData.venue ? ' | ' : ''}${matchInfo.matchDate || gameData.matchDate || ''}`
            : '2nd Referee View'}
        </div>
      </div>

      {contentMessage ? (
        <div className="lineup-display-no-data">{contentMessage}</div>
      ) : (
        <div className="lineup-display-content">
          <div className="lineup-display-score">
            <div className="lineup-display-team-score-box">
              <div className="lineup-display-team-name" style={{ color: teamColor(leftTeam) }}>{teamName(leftTeam)}</div>
              <div className="lineup-display-score-big" style={{ color: teamColor(leftTeam) }}>{set.score?.[leftTeam] ?? 0}</div>
            </div>

            <div className="lineup-display-set-info">
              <div className="lineup-display-set-number">SET {currentSet}</div>
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

            <div className="lineup-display-team-score-box">
              <div className="lineup-display-team-name" style={{ color: teamColor(rightTeam) }}>{teamName(rightTeam)}</div>
              <div className="lineup-display-score-big" style={{ color: teamColor(rightTeam) }}>{set.score?.[rightTeam] ?? 0}</div>
            </div>
          </div>

          <div className="lineup-display-lineups">
            {renderTeam(leftTeam)}
            {renderTeam(rightTeam)}
          </div>
        </div>
      )}

      <div className="lineup-display-refresh">Auto-refreshes every 2 seconds to show live updates</div>
      <div className="lineup-display-footer">DC_Volley © 2025 | Digital Volleyball Scoresheet</div>
    </div>
  );
}
