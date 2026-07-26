import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { getDisplayTeams, lineupTitleColorClass, teamDisplayName } from '../utils/displayHelpers';
import './Lineup.css';

const POS_ORDER = [3, 2, 1, 4, 5, 0];
const POS_LABELS = ['P4-LF', 'P3-MF', 'P2-RF', 'P5-LB', 'P6-MB', 'P1-RB'];

function TeamLineupPanel({ gameData, team, setData }) {
  const teamData = gameData.teams?.[team] || {};
  const lineup = teamData.lineup || [];
  const players = teamData.players || [];
  const teamName = teamDisplayName(gameData, team);
  const titleClass = lineupTitleColorClass(team);
  const lineupStrs = lineup.map((j) => String(j));
  const serving = setData.serving || 'A';
  const timeoutsUsed = setData.timeouts?.[team]?.length ?? 0;
  const subsUsed = setData.substitutions?.[team]?.length ?? 0;
  const liberos = players.filter((p) => p.role === 'libero1' || p.role === 'libero2');

  const isLiberoRole = (role) => role === 'libero1' || role === 'libero2';

  return (
    <div className="team-lineup">
      <div className={`lineup-title ${titleClass}`}>
        {teamName}
      </div>

      <div className="court-visual">
        <div className="court-grid">
          {POS_ORDER.map((idx, i) => {
            const jersey = lineup[idx];
            const player = players.find((p) => String(p.jersey) === String(jersey));
            const isServer = idx === 0 && serving === team;
            const isLibero = player && isLiberoRole(player.role);
            let posClass = 'court-pos';
            if (isServer) posClass += ' server';
            if (isLibero) posClass += ' libero-on-court';

            return (
              <div key={i} className={posClass}>
                <div className="pos-label">{POS_LABELS[i]}</div>
                <div className="pos-jersey">{player ? `#${player.jersey}` : '-'}</div>
                {player?.name && <div className="pos-name">{player.name.split(' ')[0]}</div>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="rotation-order">
        <div className="rotation-title">Rotation Order (Next →)</div>
        <div className="rotation-list">
          {Array.from({ length: 6 }).map((_, i) => {
            const jersey = lineup[i];
            const player = players.find((p) => String(p.jersey) === String(jersey));
            const isLibero = player && isLiberoRole(player.role);
            return (
              <div key={i} className={`rotation-item${isLibero ? ' libero-rotation' : ''}`}>
                <div className="rotation-pos">P{i + 1}</div>
                <div className="rotation-jersey">#{jersey || '-'}</div>
                {player?.name && <div className="rotation-name">{player.name.split(' ')[0]}</div>}
              </div>
            );
          })}
        </div>
      </div>

      {liberos.length > 0 && (
        <div className="liberos-section">
          <div className="liberos-title">Liberos</div>
          <div className="libero-list">
            {liberos.map((lib) => {
              const onCourt = lineupStrs.includes(String(lib.jersey));
              return (
                <div key={lib.jersey} className="libero-item">
                  #{lib.jersey} {lib.name ? lib.name.split(' ')[0] : ''}
                  {onCourt && <span className="on-court-indicator">● ON COURT</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="stats-row">
        <div className="stat-item">
          <span className="stat-label">Timeouts Left</span>
          <span className="stat-value">{Math.max(0, 2 - timeoutsUsed)} / 2</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Subs Left</span>
          <span className="stat-value">{Math.max(0, 6 - subsUsed)} / 6</span>
        </div>
      </div>
    </div>
  );
}

export default function Lineup() {
  const { gameCode, setGameCode, gameData, loading, error } = useGame();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const codeFromUrl = searchParams.get('code');

  useEffect(() => {
    const normalized = codeFromUrl?.trim();
    if (normalized && normalized !== gameCode) {
      setGameCode(normalized);
    }
  }, [codeFromUrl, gameCode, setGameCode]);

  useEffect(() => {
    if (!gameCode && !codeFromUrl) {
      navigate('/');
    }
  }, [gameCode, codeFromUrl, navigate]);

  if (loading) {
    return (
      <div className="lineup-page">
        <div className="no-data">Loading game data…</div>
      </div>
    );
  }

  if (error || !gameData) {
    return (
      <div className="lineup-page">
        <div className="no-data">{error || 'Game not found'}</div>
      </div>
    );
  }

  const sets = gameData.sets || [];
  const currentSet = gameData.currentSet || 1;
  const currentSetData = sets[currentSet - 1];
  const format = Number(gameData.format ?? gameData.matchInfo?.format ?? 3);

  if (!currentSetData) {
    return (
      <div className="lineup-page">
        <div className="header">
          <div className="match-title">Lineup &amp; Rotation Display</div>
          <div className="match-info">2nd Referee View</div>
        </div>
        <div className="no-data">Waiting for match to start…</div>
      </div>
    );
  }

  const { leftTeam, rightTeam } = getDisplayTeams(gameData);
  const scoreLeft = currentSetData.score?.[leftTeam] ?? 0;
  const scoreRight = currentSetData.score?.[rightTeam] ?? 0;
  const leftColorClass = leftTeam === 'A' ? 'team-a-color' : 'team-b-color';
  const rightColorClass = rightTeam === 'A' ? 'team-a-color' : 'team-b-color';
  const leftName = teamDisplayName(gameData, leftTeam);
  const rightName = teamDisplayName(gameData, rightTeam);

  const competition = gameData.competition || gameData.matchInfo?.competition || 'Lineup & Rotation Display';
  const venue = gameData.venue || gameData.matchInfo?.venue || '';
  const matchDate = gameData.matchDate || gameData.matchInfo?.matchDate || gameData.matchInfo?.date || '';
  const matchInfoLine = [venue, matchDate].filter(Boolean).join(' | ') || '2nd Referee View';

  return (
    <div className="lineup-page">
      <div className="header">
        <div className="match-title">{competition}</div>
        <div className="match-info">{matchInfoLine}</div>
      </div>

      <div className="score-display">
        <div className="team-score-box">
          <div className={`team-name-big ${leftColorClass}`}>{leftName}</div>
          <div className={`score-big ${leftColorClass}`}>{scoreLeft}</div>
        </div>

        <div className="set-info">
          <div className="set-number">SET {currentSet}</div>
          <div className="set-dots">
            {Array.from({ length: format }).map((_, i) => {
              const set = sets[i];
              let dotClass = 'set-dot';
              if (i < sets.length && set?.winner === 'A') dotClass += ' set-won-a';
              else if (i < sets.length && set?.winner === 'B') dotClass += ' set-won-b';
              return (
                <div key={i} className={dotClass}>
                  {i + 1}
                </div>
              );
            })}
          </div>
        </div>

        <div className="team-score-box">
          <div className={`team-name-big ${rightColorClass}`}>{rightName}</div>
          <div className={`score-big ${rightColorClass}`}>{scoreRight}</div>
        </div>
      </div>

      <div className="lineups-container">
        <TeamLineupPanel gameData={gameData} team={leftTeam} setData={currentSetData} />
        <TeamLineupPanel gameData={gameData} team={rightTeam} setData={currentSetData} />
      </div>

      <div className="refresh-info">Auto-refreshes every 2 seconds to show live updates</div>

      <div className="lineup-footer">
        DC_Volley © 2025 | Digital Volleyball Scoresheet
      </div>
    </div>
  );
}
