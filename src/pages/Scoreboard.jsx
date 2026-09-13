import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import './Scoreboard.css';

const ROM = ['i', 'ii', 'iii', 'iv', 'v'];
const MAX_TO = 2;
const MAX_CH = 2;

function abbr(name) {
  if (!name) return '???';
  const w = String(name).replace(/[^A-Za-z\s]/g, '').trim().split(/\s+/).filter(Boolean);
  if (!w.length) return '???';
  if (w.length === 1) return w[0].substring(0, 3).toUpperCase();
  return w.map((x) => x[0]).join('').substring(0, 3).toUpperCase();
}

function displayName(player, jersey) {
  const nm = String(player?.name || `#${jersey}`).toUpperCase().trim();
  const pts = nm.split(/\s+/);
  let d = pts.length > 1 ? `${pts[0][0]}.${pts.slice(1).join(' ')}` : nm;
  if (d.length > 13) d = `${d.substring(0, 13)}…`;
  return d;
}

function findPlayer(players, jersey) {
  return (players || []).find((x) => String(x.jersey) === String(jersey)) || {
    jersey,
    name: `#${jersey}`,
    role: ''
  };
}

function PlayerColumn({ lineup, players, team, serving, color, alignRight }) {
  if (!lineup || !lineup.length) {
    return <div className="sb-no-lineup">No lineup</div>;
  }
  return lineup.map((jersey, i) => {
    if (jersey == null || jersey === '') return null;
    const p = findPlayer(players, jersey);
    const isSrv = i === 0 && serving === team;
    const isLib = p.role === 'libero1' || p.role === 'libero2' || p.role === 'liberocaptain';
    const isCap = p.role === 'captain';
    const jcClass = `sb-jc${isLib ? ' lib' : isCap ? ' cap' : ''}`;
    const prClass = `sb-pr${isSrv ? ' srv' : ''}${isLib ? ' lib-r' : ''}`;
    return (
      <div key={`${team}-${i}-${jersey}`} className={prClass}>
        <div className={jcClass} style={!isLib && !isCap ? { borderColor: color } : undefined}>
          {jersey}
        </div>
        <div className="sb-pn">{displayName(p, jersey)}</div>
      </div>
    );
  });
}

function ClockIcon() {
  return (
    <svg className="sb-ck" viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="13" stroke="#00bcd4" strokeWidth="2.5" fill="rgba(0,188,212,.1)" />
      <line x1="16" y1="16" x2="16" y2="8" stroke="#00bcd4" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="16" y1="16" x2="21" y2="19" stroke="#00bcd4" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="16" cy="16" r="1.5" fill="#00bcd4" />
      <line x1="16" y1="3" x2="16" y2="6" stroke="#00bcd4" strokeWidth="1.5" />
      <line x1="16" y1="26" x2="16" y2="29" stroke="#00bcd4" strokeWidth="1.5" />
      <line x1="3" y1="16" x2="6" y2="16" stroke="#00bcd4" strokeWidth="1.5" />
      <line x1="26" y1="16" x2="29" y2="16" stroke="#00bcd4" strokeWidth="1.5" />
    </svg>
  );
}

function ChallengeIcon() {
  return (
    <svg className="sb-cm" viewBox="0 0 40 28" fill="none">
      <rect x="1" y="4" width="26" height="20" rx="3" stroke="#90caf9" strokeWidth="2" fill="rgba(144,202,249,.08)" />
      <polygon points="27,10 39,4 39,24 27,18" fill="rgba(144,202,249,.2)" stroke="#90caf9" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="13" cy="14" r="5" stroke="#90caf9" strokeWidth="1.5" />
      <circle cx="13" cy="14" r="2" fill="#90caf9" />
    </svg>
  );
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

  if (loading || error || !gameData) {
    return (
      <div className="sb-page">
        <div className="sb-wait">
          <div style={{ fontSize: 56 }}>🏐</div>
          <h2>DC_Volley — Live Scoreboard</h2>
          <p>{error || (loading ? 'Loading live match data…' : 'Open referee panel → start match → click 📺 Scoreboard')}</p>
        </div>
      </div>
    );
  }

  const mi = gameData.matchInfo || {};
  const sets = gameData.sets || [];
  const cur = (Number(gameData.currentSet) || 1) - 1;
  const set = sets[cur] || {
    score: { A: 0, B: 0 },
    serving: 'A',
    timeouts: { A: [], B: [] },
    substitutions: { A: [], B: [] }
  };
  const swap = !!gameData.swapped;
  const tA = swap ? 'B' : 'A';
  const tB = swap ? 'A' : 'B';

  const teamName = (team) =>
    mi[`team${team}Name`] || gameData[`team${team}Name`] || (team === 'A' ? 'Team A' : 'Team B');
  const teamColor = (team) =>
    mi[`team${team}Color`] || gameData[`team${team}Color`] || (team === 'A' ? '#e94560' : '#00d9ff');
  const teamLogo = (team) =>
    gameData.teams?.[team]?.logoData || mi[`logo${team}`] || '';

  const nA = teamName(tA);
  const nB = teamName(tB);
  const cA = teamColor(tA);
  const cB = teamColor(tB);
  const loA = teamLogo(tA);
  const loB = teamLogo(tB);
  const abA = abbr(nA);
  const abB = abbr(nB);

  const plA = gameData.teams?.[tA]?.players || [];
  const plB = gameData.teams?.[tB]?.players || [];
  const luA = gameData.teams?.[tA]?.lineup || [];
  const luB = gameData.teams?.[tB]?.lineup || [];
  const srv = set.serving || 'A';

  const usedToA = (set.timeouts?.[tA] || []).length;
  const usedToB = (set.timeouts?.[tB] || []).length;
  const usedSbA = (set.substitutions?.[tA] || []).length;
  const usedSbB = (set.substitutions?.[tB] || []).length;
  const subMax = Number(mi.subLimitPerSet || gameData.subLimit) || 6;
  const remCh = (team) => {
    if (gameData.challengeSystem?.challenges?.[team] != null) {
      return Math.max(0, Number(gameData.challengeSystem.challenges[team]) || 0);
    }
    const used = gameData.videoChallenge?.[team]?.used || 0;
    return Math.max(0, MAX_CH - used);
  };
  const remToA = Math.max(0, MAX_TO - usedToA);
  const remToB = Math.max(0, MAX_TO - usedToB);
  const remSbA = Math.max(0, subMax - usedSbA);
  const remSbB = Math.max(0, subMax - usedSbB);
  const remChA = remCh(tA);
  const remChB = remCh(tB);

  const swA = sets.filter((s) => s.winner === tA).length;
  const swB = sets.filter((s) => s.winner === tB).length;

  const compTxt = String(mi.competition || gameData.competition || '').trim();
  const venueTxt = String(mi.venue || gameData.venue || '').trim();

  const fmtNow = parseInt(mi.format || gameData.format, 10) || 5;
  let setTarget = 25;
  if ((fmtNow === 5 && cur + 1 === 5) || (fmtNow === 3 && cur + 1 === 3)) setTarget = 15;
  const curScoreA = set.score?.[tA] || 0;
  const curScoreB = set.score?.[tB] || 0;
  const aSetPoint = !set.winner && curScoreA + 1 >= setTarget && curScoreA + 1 - curScoreB >= 2;
  const bSetPoint = !set.winner && curScoreB + 1 >= setTarget && curScoreB + 1 - curScoreA >= 2;

  const matchEnded = !!gameData.matchEnded || gameData.status === 'FINISHED';
  const matchWinnerTeam = swA > swB ? tA : swB > swA ? tB : null;
  const wName = matchWinnerTeam ? teamName(matchWinnerTeam) : '';
  const wColor = matchWinnerTeam ? teamColor(matchWinnerTeam) : '#ffd166';

  return (
    <div className="sb-page">
      <div className={`sb-winner-overlay${matchEnded ? ' show' : ''}`}>
        <div className="sb-winner-trophy">🏆</div>
        <div className="sb-winner-name" style={{ color: wColor }}>{wName}</div>
        <div className="sb-winner-sub">Wins the Match</div>
        <div className="sb-winner-score">{swA} - {swB}</div>
      </div>

      <div className="sb-root">
        {compTxt ? <div className="sb-comp-lbl">{compTxt}</div> : null}
        {venueTxt ? <div className="sb-venue-lbl">{venueTxt}</div> : null}
        <div className="sb-set-lbl">SET {cur + 1}</div>

        <div className="sb-top-row">
          <div className="sb-team-block">
            <div className="sb-t-code" style={{ color: cA }}>{abA}</div>
            <div className={`sb-t-logo${loA ? '' : ' empty'}`}>
              {loA ? <img src={loA} alt={abA} /> : null}
            </div>
          </div>

          <div className="sb-score-ctr">
            <div className="sb-score-digs">
              <div className={`sb-s-box${aSetPoint ? ' set-point-blink' : ''}`}>
                <span className="sb-s-num" style={{ color: cA }}>{curScoreA}</span>
              </div>
              <div className={`sb-s-box${bSetPoint ? ' set-point-blink' : ''}`}>
                <span className="sb-s-num" style={{ color: cB }}>{curScoreB}</span>
              </div>
            </div>
            <div className="sb-sw-row">
              <div className="sb-sw-box"><span className="sb-sw-num" style={{ color: cA }}>{swA}</span></div>
              <div className="sb-sw-box"><span className="sb-sw-num" style={{ color: cB }}>{swB}</span></div>
            </div>
            <div className="sb-sh-wrap">
              {ROM.map((roman, i) => {
                const s = sets[i];
                const played = !!s;
                const sL = played ? (s.score?.[tA] || 0) : '—';
                const sR = played ? (s.score?.[tB] || 0) : '—';
                const cL = played ? cA : '#1a2636';
                const cR = played ? cB : '#1a2636';
                const cM = played ? '#4a6a8a' : '#1a2636';
                return (
                  <div key={roman} className="sb-sh-row">
                    <span className="sb-sh-l" style={{ color: cL }}>{sL}</span>
                    <span className="sb-sh-m" style={{ color: cM }}>{roman}</span>
                    <span className="sb-sh-r" style={{ color: cR }}>{sR}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="sb-team-block right">
            <div className="sb-t-code" style={{ color: cB }}>{abB}</div>
            <div className={`sb-t-logo${loB ? '' : ' empty'}`}>
              {loB ? <img src={loB} alt={abB} /> : null}
            </div>
          </div>
        </div>

        <div className="sb-bot">
          <div className="sb-pl">
            <PlayerColumn lineup={luA} players={plA} team={tA} serving={srv} color={cA} />
          </div>

          <div className="sb-stats-mid">
            <div className="sb-stat-panel">
              <div className="sb-srow">
                <span className="sb-sv" style={{ color: remToA > 0 ? cA : '#2a2a2a' }}>{remToA}</span>
                <div className="sb-si"><ClockIcon /></div>
                <span className="sb-sv" style={{ color: remToB > 0 ? cB : '#2a2a2a' }}>{remToB}</span>
              </div>
              <div className="sb-slbl">Timeout Remaining</div>

              <div className="sb-srow">
                <span className="sb-sv" style={{ color: remSbA > 0 ? cA : '#2a2a2a' }}>{remSbA}</span>
                <div className="sb-si"><div className="sb-arr"><div className="sb-au" /><div className="sb-ad" /></div></div>
                <span className="sb-sv" style={{ color: remSbB > 0 ? cB : '#2a2a2a' }}>{remSbB}</span>
              </div>
              <div className="sb-slbl">Sub Remaining</div>

              <div className="sb-srow">
                <span className="sb-sv" style={{ color: remChA > 0 ? cA : '#2a2a2a' }}>{remChA}</span>
                <div className="sb-si"><ChallengeIcon /></div>
                <span className="sb-sv" style={{ color: remChB > 0 ? cB : '#2a2a2a' }}>{remChB}</span>
              </div>
              <div className="sb-slbl">Challenge Remaining</div>
            </div>
          </div>

          <div className="sb-pl right">
            <PlayerColumn lineup={luB} players={plB} team={tB} serving={srv} color={cB} alignRight />
          </div>
        </div>

        <footer className="sb-footer">DC_Volley © 2025 &nbsp;|&nbsp; India&apos;s First Volleyball eScoring App</footer>
      </div>
    </div>
  );
}
