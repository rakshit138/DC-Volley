import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import {
  abbrTeamName,
  formatScoreboardPlayerName,
  getDisplayTeams,
  getTeamLogo,
  teamDisplayColor,
  teamDisplayName
} from '../utils/displayHelpers';
import './Scoreboard.css';

const ROMAN = ['i', 'ii', 'iii', 'iv', 'v'];
const MAX_TO = 2;

function ClockIcon() {
  return (
    <svg className="sb-ck" viewBox="0 0 32 32" fill="none" aria-hidden>
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
    <svg className="sb-cm" viewBox="0 0 40 28" fill="none" aria-hidden>
      <rect x="1" y="4" width="26" height="20" rx="3" stroke="#90caf9" strokeWidth="2" fill="rgba(144,202,249,.08)" />
      <polygon points="27,10 39,4 39,24 27,18" fill="rgba(144,202,249,.2)" stroke="#90caf9" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="13" cy="14" r="5" stroke="#90caf9" strokeWidth="1.5" />
      <circle cx="13" cy="14" r="2" fill="#90caf9" />
    </svg>
  );
}

function PlayerRows({ lineup, players, team, serving, color, alignRight }) {
  if (!lineup?.length) {
    return <div className="sb-pl-empty">No lineup</div>;
  }

  return lineup.map((jersey, i) => {
    if (jersey == null || jersey === '') return null;
    const p = players.find((x) => String(x.jersey) === String(jersey)) || {
      jersey,
      name: `#${jersey}`,
      role: ''
    };
    const isSrv = i === 0 && serving === team;
    const isLib = p.role === 'libero1' || p.role === 'libero2';
    const isCap = p.role === 'captain' || p.role === 'liberocaptain';
    const rowClass = `sb-pr${isSrv ? ' srv' : ''}${isLib ? ' lib-r' : ''}`;
    const jcClass = `sb-jc${isLib ? ' lib' : isCap ? ' cap' : ''}`;
    const borderStyle = !isLib && !isCap ? { borderColor: color } : undefined;

    return (
      <div key={`${team}-${i}-${jersey}`} className={rowClass}>
        <div className={jcClass} style={borderStyle}>
          {jersey}
        </div>
        <div className="sb-pn">{formatScoreboardPlayerName(p.name, jersey)}</div>
      </div>
    );
  });
}

function useFullscreenOnDisplay() {
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);

  useEffect(() => {
    document.documentElement.classList.add('sb-html');
    document.body.classList.add('sb-html');

    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);

    try {
      window.moveTo(0, 0);
      window.resizeTo(window.screen?.availWidth || window.innerWidth, window.screen?.availHeight || window.innerHeight);
    } catch {
      /* popup may restrict resize */
    }

    const enter = async () => {
      try {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } catch {
        /* blocked until user gesture */
      }
    };

    enter();
    const onKey = (e) => {
      if (e.key === 'f' || e.key === 'F') enter();
    };
    const onClick = () => enter();
    window.addEventListener('keydown', onKey);
    window.addEventListener('click', onClick, { once: true });

    return () => {
      document.documentElement.classList.remove('sb-html');
      document.body.classList.remove('sb-html');
      document.removeEventListener('fullscreenchange', onFsChange);
      window.removeEventListener('keydown', onKey);
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  return isFullscreen;
}

export default function Scoreboard() {
  const { gameCode, setGameCode, gameData, loading, error } = useGame();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const codeFromUrl = searchParams.get('code');

  const isFullscreen = useFullscreenOnDisplay();

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

  const ready = !loading && gameData && gameData.sets?.length > 0 && gameData.sets[gameData.currentSet - 1];

  const view = useMemo(() => {
    if (!ready) return null;

    const currentSet = gameData.currentSet || 1;
    const sets = gameData.sets || [];
    const set = sets[currentSet - 1];
    const { leftTeam, rightTeam } = getDisplayTeams(gameData);

    const cLeft = teamDisplayColor(gameData, leftTeam);
    const cRight = teamDisplayColor(gameData, rightTeam);
    const abLeft = abbrTeamName(teamDisplayName(gameData, leftTeam));
    const abRight = abbrTeamName(teamDisplayName(gameData, rightTeam));

    const logoLeft = getTeamLogo(gameData, leftTeam);
    const logoRight = getTeamLogo(gameData, rightTeam);

    const plLeft = gameData.teams?.[leftTeam]?.players || [];
    const plRight = gameData.teams?.[rightTeam]?.players || [];
    const luLeft = gameData.teams?.[leftTeam]?.lineup || [];
    const luRight = gameData.teams?.[rightTeam]?.lineup || [];

    const srv = set.serving || 'A';
    const subMax = Number(gameData.subLimit ?? gameData.matchInfo?.subLimitPerSet ?? 6);

    const usedToLeft = set.timeouts?.[leftTeam]?.length ?? 0;
    const usedToRight = set.timeouts?.[rightTeam]?.length ?? 0;
    const usedSbLeft = set.substitutions?.[leftTeam]?.length ?? 0;
    const usedSbRight = set.substitutions?.[rightTeam]?.length ?? 0;

    const remChLeft = gameData.challengeSystem?.challenges?.[leftTeam] ?? 2;
    const remChRight = gameData.challengeSystem?.challenges?.[rightTeam] ?? 2;

    const swLeft = sets.filter((s) => s.winner === leftTeam).length;
    const swRight = sets.filter((s) => s.winner === rightTeam).length;

    const remToLeft = Math.max(0, MAX_TO - usedToLeft);
    const remToRight = Math.max(0, MAX_TO - usedToRight);
    const remSbLeft = Math.max(0, subMax - usedSbLeft);
    const remSbRight = Math.max(0, subMax - usedSbRight);

    const statColor = (rem, color) => (rem > 0 ? color : '#2a2a2a');

    const history = Array.from({ length: 5 }).map((_, i) => {
      const s = sets[i];
      const played = !!s;
      return {
        left: played ? s.score?.[leftTeam] ?? 0 : '—',
        right: played ? s.score?.[rightTeam] ?? 0 : '—',
        cLeft: played ? cLeft : '#1a2636',
        cRight: played ? cRight : '#1a2636',
        cMid: played ? '#4a6a8a' : '#1a2636',
        roman: ROMAN[i]
      };
    });

    return {
      currentSet,
      cLeft,
      cRight,
      abLeft,
      abRight,
      logoLeft,
      logoRight,
      scoreLeft: set.score?.[leftTeam] ?? 0,
      scoreRight: set.score?.[rightTeam] ?? 0,
      swLeft,
      swRight,
      srv,
      luLeft,
      luRight,
      plLeft,
      plRight,
      leftTeam,
      rightTeam,
      remToLeft,
      remToRight,
      remSbLeft,
      remSbRight,
      remChLeft,
      remChRight,
      statColor,
      history
    };
  }, [gameData, ready]);

  if (error && !gameData) {
    return (
      <div className="sb-wait">
        <div className="sb-wait-icon">🏐</div>
        <h2>DC_Volley — Live Scoreboard</h2>
        <p>{error || 'Game not found'}</p>
      </div>
    );
  }

  return (
    <>
      <div className={`sb-wait${ready ? ' gone' : ''}`}>
        <div className="sb-wait-icon">🏐</div>
        <h2>DC_Volley — Live Scoreboard</h2>
        <p>{loading ? 'Loading live match data…' : 'Waiting for match to start…'}</p>
      </div>

      {view && (
        <div className="sb-root">
          <div className="sb-set-lbl">SET {view.currentSet}</div>

          <div className="sb-top-row">
            <div className="sb-team-block">
              <div className="sb-t-code" style={{ color: view.cLeft }}>
                {view.abLeft}
              </div>
              <div className={`sb-t-logo${view.logoLeft ? '' : ' empty'}`}>
                {view.logoLeft ? <img src={view.logoLeft} alt={view.abLeft} /> : null}
              </div>
            </div>

            <div className="sb-score-ctr">
              <div className="sb-score-digs">
                <div className="sb-s-box">
                  <span className="sb-s-num" style={{ color: view.cLeft }}>
                    {view.scoreLeft}
                  </span>
                </div>
                <div className="sb-s-box">
                  <span className="sb-s-num" style={{ color: view.cRight }}>
                    {view.scoreRight}
                  </span>
                </div>
              </div>
              <div className="sb-sw-row">
                <div className="sb-sw-box">
                  <span className="sb-sw-num" style={{ color: view.cLeft }}>
                    {view.swLeft}
                  </span>
                </div>
                <div className="sb-sw-box">
                  <span className="sb-sw-num" style={{ color: view.cRight }}>
                    {view.swRight}
                  </span>
                </div>
              </div>
              <div className="sb-sh-wrap">
                {view.history.map((h, i) => (
                  <div key={i} className="sb-sh-row">
                    <span className="sb-sh-l" style={{ color: h.cLeft }}>
                      {h.left}
                    </span>
                    <span className="sb-sh-m" style={{ color: h.cMid }}>
                      {h.roman}
                    </span>
                    <span className="sb-sh-r" style={{ color: h.cRight }}>
                      {h.right}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="sb-team-block right">
              <div className="sb-t-code" style={{ color: view.cRight }}>
                {view.abRight}
              </div>
              <div className={`sb-t-logo${view.logoRight ? '' : ' empty'}`}>
                {view.logoRight ? <img src={view.logoRight} alt={view.abRight} /> : null}
              </div>
            </div>
          </div>

          <div className="sb-bot">
            <div className="sb-pl">
              <PlayerRows
                lineup={view.luLeft}
                players={view.plLeft}
                team={view.leftTeam}
                serving={view.srv}
                color={view.cLeft}
              />
            </div>

            <div className="sb-stats-mid">
              <div className="sb-stat-panel">
                <div className="sb-srow">
                  <span className="sb-sv" style={{ color: view.statColor(view.remToLeft, view.cLeft) }}>
                    {view.remToLeft}
                  </span>
                  <div className="sb-si">
                    <ClockIcon />
                  </div>
                  <span className="sb-sv" style={{ color: view.statColor(view.remToRight, view.cRight) }}>
                    {view.remToRight}
                  </span>
                </div>
                <div className="sb-slbl">Timeout Remaining</div>

                <div className="sb-srow">
                  <span className="sb-sv" style={{ color: view.statColor(view.remSbLeft, view.cLeft) }}>
                    {view.remSbLeft}
                  </span>
                  <div className="sb-si">
                    <div className="sb-arr">
                      <div className="sb-au" />
                      <div className="sb-ad" />
                    </div>
                  </div>
                  <span className="sb-sv" style={{ color: view.statColor(view.remSbRight, view.cRight) }}>
                    {view.remSbRight}
                  </span>
                </div>
                <div className="sb-slbl">Sub Remaining</div>

                <div className="sb-srow">
                  <span className="sb-sv" style={{ color: view.statColor(view.remChLeft, view.cLeft) }}>
                    {view.remChLeft}
                  </span>
                  <div className="sb-si">
                    <ChallengeIcon />
                  </div>
                  <span className="sb-sv" style={{ color: view.statColor(view.remChRight, view.cRight) }}>
                    {view.remChRight}
                  </span>
                </div>
                <div className="sb-slbl">Challenge Remaining</div>
              </div>
            </div>

            <div className="sb-pl right">
              <PlayerRows
                lineup={view.luRight}
                players={view.plRight}
                team={view.rightTeam}
                serving={view.srv}
                color={view.cRight}
                alignRight
              />
            </div>
          </div>

          <footer className="sb-footer">
            DC_Volley © 2025 &nbsp;|&nbsp; India&apos;s First Volleyball eScoring App
          </footer>
        </div>
      )}

      {!isFullscreen && ready && (
        <div className="sb-fs-hint">Click or press F for fullscreen</div>
      )}
    </>
  );
}
