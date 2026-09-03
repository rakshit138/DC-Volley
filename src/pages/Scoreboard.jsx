import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import './Scoreboard.css';

function getSetWinner(set) {
  if (!set) return null;
  if (set.winner === 'A' || set.winner === 'B') return set.winner;
  if (set.endTime && set.score && set.score.A !== set.score.B) {
    return set.score.A > set.score.B ? 'A' : 'B';
  }
  return null;
}

export default function Scoreboard() {
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

  if (loading) {
    return <div className="live-scoreboard-wait">Loading live match data…</div>;
  }

  if (error || !gameData) {
    return <div className="live-scoreboard-wait">{error || 'Game not found'}</div>;
  }

  const matchInfo = gameData.matchInfo || {};
  const currentSet = Number(gameData.currentSet) || 1;
  const sets = gameData.sets || [];
  const set = sets[currentSet - 1];

  if (!set) {
    return <div className="live-scoreboard-wait">Waiting for match to start…</div>;
  }

  const swapped = !!gameData.swapped;
  const leftTeam = swapped ? 'B' : 'A';
  const rightTeam = swapped ? 'A' : 'B';
  const teamName = (team) =>
    team === 'A'
      ? matchInfo.teamAName || gameData.teamAName || 'TEAM A'
      : matchInfo.teamBName || gameData.teamBName || 'TEAM B';
  const teamColor = (team) =>
    team === 'A'
      ? matchInfo.teamAColor || gameData.teamAColor || '#ff4d6d'
      : matchInfo.teamBColor || gameData.teamBColor || '#2dd4bf';
  const teamLogo = (team) => gameData.teams?.[team]?.logoData || matchInfo[`logo${team}`] || '';
  const setsWon = (team) => sets.filter((playedSet) => getSetWinner(playedSet) === team).length;
  const score = { A: set.score?.A ?? 0, B: set.score?.B ?? 0 };
  const timeouts = {
    A: set.timeouts?.A?.length ?? 0,
    B: set.timeouts?.B?.length ?? 0
  };
  const substitutions = {
    A: set.substitutions?.A?.length ?? 0,
    B: set.substitutions?.B?.length ?? 0
  };
  const format = Number(matchInfo.format || gameData.format) ||
    (matchInfo.matchFormat === 'best3' ? 3 : 5);

  const renderTeam = (side, team) => {
    const logo = teamLogo(team);
    const color = teamColor(team);
    return (
      <div className="live-scoreboard-side" data-side={side}>
        <div className="live-scoreboard-logo">
          {logo ? <img src={logo} alt="" /> : <span className="live-scoreboard-logo-placeholder">🏐</span>}
        </div>
        <div className="live-scoreboard-team-name" style={{ color }}>{teamName(team)}</div>
        <div className={`live-scoreboard-serve${set.serving === team ? ' on' : ''}`}>● SERVING</div>
        <div className="live-scoreboard-score" style={{ color }}>{score[team]}</div>
      </div>
    );
  };

  return (
    <div className="live-scoreboard-root">
      <div className="live-scoreboard-competition">
        {matchInfo.competition || gameData.competition || 'VOLLEYBALL MATCH'}
      </div>
      <div className="live-scoreboard-set-line">SET {currentSet}</div>

      <div className="live-scoreboard-main">
        {renderTeam('left', leftTeam)}

        <div className="live-scoreboard-middle">
          <div className="live-scoreboard-sets-box">
            <span className="live-scoreboard-sets-number">{setsWon(leftTeam)}</span>
            <span className="live-scoreboard-sets-label">SETS</span>
            <span className="live-scoreboard-sets-number">{setsWon(rightTeam)}</span>
          </div>
          <div className="live-scoreboard-dots">
            {Array.from({ length: format }).map((_, index) => {
              const winner = getSetWinner(sets[index]);
              const color = winner ? teamColor(winner) : undefined;
              const current = index === currentSet - 1 && gameData.status !== 'FINISHED';
              return (
                <div
                  key={index}
                  className="live-scoreboard-dot"
                  style={winner
                    ? { background: color, borderColor: color }
                    : current
                      ? { borderColor: '#ffd166' }
                      : undefined}
                />
              );
            })}
          </div>
        </div>

        {renderTeam('right', rightTeam)}
      </div>

      <div className="live-scoreboard-footer">
        <span>TO <b>{timeouts[leftTeam]}</b> • SUB <b>{substitutions[leftTeam]}</b></span>
        <span>{matchInfo.venue || gameData.venue || ''}</span>
        <span>TO <b>{timeouts[rightTeam]}</b> • SUB <b>{substitutions[rightTeam]}</b></span>
      </div>
    </div>
  );
}
