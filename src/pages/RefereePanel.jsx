import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import {
  updateScore,
  updateSets,
  markGameFinished,
  undoLastPoint,
  recordTimeout,
  recordSubstitution,
  recordExceptionalSubstitution,
  updateOfficials,
  recordLiberoReplacement,
  recordLiberoReplacementWithTracking,
  removeLiberoFromCourt,
  recordSanction,
  updateGameSwapped,
  rotateLineup,
  addPoint,
  setupNextSet,
  updateRallyState,
  addMatchHistoryEvent
} from '../services/gameService';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  shouldCompleteSet,
  getTargetScore,
  rotateLineupClockwise,
  isBackRowPosition,
  canLiberoReplace,
  validateSubstitution,
  validateTimeout,
  getLiberos,
  isLibero,
  formatDuration,
  calculateMatchDuration,
  calculateSetDuration,
  validateRotation,
  validateLineupCompleteness,
  validateLiberoPosition,
  validateSingleLiberoOnCourt
} from '../utils/gameLogic';
import { validateServeStart } from '../utils/liberoServe';
import TimeoutModal from '../components/TimeoutModal';
import SubModal from '../components/SubModal';
import SanctionModal from '../components/SanctionModal';
import OfficialsModal from '../components/OfficialsModal';
import LiberoModal from '../components/LiberoModal';
import AutoLiberoEntryModal from '../components/AutoLiberoEntryModal';
import AutoLiberoExitModal from '../components/AutoLiberoExitModal';
import MatchDataModal from '../components/MatchDataModal';
import SummaryModal from '../components/SummaryModal';
import { downloadMatchReportHtml } from '../utils/exportMatchReportHtml';
import { saveMatch, loadMatch } from '../utils/matchStorage';
import './RefereePanel.css';

const POS_LABELS = { 1: 'P1-RB', 2: 'P2-RF', 3: 'P3-MF', 4: 'P4-LF', 5: 'P5-LB', 6: 'P6-MB' };
const GRID_ORDER = [4, 3, 2, 5, 6, 1];

function getPlayer(team, teams, jersey) {
  const players = teams?.[team]?.players || [];
  return players.find((p) => String(p.jersey) === String(jersey));
}

function LineupList({ team, teamName, lineup, players, serving, currentSetData, currentSet, sanctionSystem }) {
  // Show ALL players sorted by jersey number (like original HTML)
  const sortedPlayers = [...(players || [])].sort((a, b) => {
    const numA = parseInt(String(a.jersey), 10) || 0;
    const numB = parseInt(String(b.jersey), 10) || 0;
    return numA - numB;
  });

  const arr = Array.isArray(lineup) ? lineup : [];
  const padded = [...arr];
  while (padded.length < 6) padded.push(null);

  // Helper to get sanction cards for a player
  const getSanctionCards = (playerJersey) => {
    if (!sanctionSystem || !playerJersey) return null;
    const jerseyStr = String(playerJersey);
    const cards = [];
    
    // Check if disqualified (entire match)
    const disqualified = sanctionSystem.disqualified?.[team]?.some(e => String(e.jersey) === jerseyStr);
    if (disqualified) {
      cards.push({ type: 'DISQ', set: null, symbol: '🟥❌', title: 'DISQUALIFIED — out for match' });
    }

    // Get misconduct records for this player
    const misconducts = (sanctionSystem.misconduct?.[team] || []).filter(r => String(r.person) === jerseyStr);
    const currentSetCards = [];
    const previousSetCards = [];

    misconducts.forEach((r) => {
      let sym = '';
      if (r.type === 'W') sym = '🟨';
      else if (r.type === 'P') sym = '🟥';
      else if (r.type === 'EXP') sym = '🟨🟥';
      else if (r.type === 'DISQ') sym = '🟥❌';
      if (!sym) return;

      if (r.set === currentSet) {
        currentSetCards.push({ type: r.type, set: r.set, symbol: sym });
      } else {
        previousSetCards.push({ type: r.type, set: r.set, symbol: sym });
      }
    });

    return { currentSetCards, previousSetCards, disqualified };
  };

  if (sortedPlayers.length === 0) {
    return (
      <div className="referee-lineup-list">
        <div className="referee-lineup-item">No players in roster</div>
      </div>
    );
  }

  return (
    <div className="referee-lineup-list">
      {sortedPlayers.map((p) => {
        const jersey = String(p.jersey);
        const onCourt = padded.includes(jersey);
        const posIndex = onCourt ? padded.indexOf(jersey) : -1;
        const position = posIndex >= 0 ? `P${posIndex + 1}` : '';
        const isServer = onCourt && posIndex === 0 && serving === team;
        
        const role = p?.role;
        const isCaptain = role === 'captain' || role === 'liberocaptain';
        const isLibero = role === 'libero1' || role === 'libero2' || role === 'liberocaptain';
        
        const badges = [];
        if (isCaptain) badges.push(<span key="c" className="referee-lineup-badge referee-badge-c">C</span>);
        if (role === 'libero1') badges.push(<span key="l1" className="referee-lineup-badge referee-badge-l">L1</span>);
        else if (role === 'libero2') badges.push(<span key="l2" className="referee-lineup-badge referee-badge-l">L2</span>);
        else if (isLibero) badges.push(<span key="l" className="referee-lineup-badge referee-badge-l">L</span>);

        // Get sanction cards
        const sanctionCards = getSanctionCards(p.jersey);
        const cardElements = [];
        if (sanctionCards) {
          // Current set cards (bright)
          sanctionCards.currentSetCards.forEach((card, idx) => {
            cardElements.push(
              <span key={`current-${idx}`} title={card.type} style={{ marginLeft: '3px', fontSize: '11px' }}>
                {card.symbol}
              </span>
            );
          });
          // Previous set cards (dimmed)
          sanctionCards.previousSetCards.forEach((card, idx) => {
            cardElements.push(
              <span key={`prev-${idx}`} title={`${card.type} (Set ${card.set})`} style={{ marginLeft: '3px', fontSize: '11px', opacity: 0.4, fontStyle: 'italic' }}>
                {card.symbol}<sup style={{ fontSize: '8px' }}>S{card.set}</sup>
              </span>
            );
          });
          // Disqualified
          if (sanctionCards.disqualified) {
            cardElements.push(
              <span key="disq" title="DISQUALIFIED — out for match" style={{ marginLeft: '3px', fontSize: '11px' }}>
                🟥❌
              </span>
            );
          }
        }

        return (
          <div key={p.jersey} className={`referee-lineup-item ${onCourt ? 'on-court' : 'on-bench'}`}>
            <span className="referee-lineup-pos">{position || '-'}</span>
            <span>
              #{jersey} {p?.name || ''}
              {badges.length > 0 && badges}
              {isServer && ' 🏐'}
              {cardElements.length > 0 && cardElements}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function CourtGrid({ team, lineup, players, serving, liberoJerseys }) {
  const arr = Array.isArray(lineup) ? lineup : [];
  const padded = [...arr];
  while (padded.length < 6) padded.push(null);

  return (
    <div className="referee-court-grid">
      {GRID_ORDER.map((pos) => {
        const jersey = padded[pos - 1];
        const isServer = serving === team && pos === 1;
        const isLibero = jersey != null && liberoJerseys && liberoJerseys.has(String(jersey));
        return (
          <div
            key={pos}
            className={`referee-court-pos ${isServer ? 'server' : ''} ${isLibero ? 'libero-on-court' : ''}`}
          >
            <span className="referee-pos-label">{POS_LABELS[pos]}</span>
            <span className="referee-pos-jersey">{jersey != null ? jersey : '-'}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function RefereePanel() {
  const { gameCode, gameData, loading, error } = useGame();
  const navigate = useNavigate();
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState('');
  const [timeoutModal, setTimeoutModal] = useState({ open: false, team: null });
  const [subModal, setSubModal] = useState({ open: false, team: null });
  const [officialsModalOpen, setOfficialsModalOpen] = useState(false);
  const [liberoModal, setLiberoModal] = useState({ open: false, team: null });
  const [rosterModalOpen, setRosterModalOpen] = useState(false);
  const [sanctionModalOpen, setSanctionModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [nextSetModalOpen, setNextSetModalOpen] = useState(false);
  const [decidingSetTossModalOpen, setDecidingSetTossModalOpen] = useState(false);
  const [matchDataModalOpen, setMatchDataModalOpen] = useState(false);
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const loadMatchFileInputRef = useRef(null);
  const [rallyActive, setRallyActive] = useState(false);
  const [matchTime, setMatchTime] = useState(0);
  const [setTime, setSetTime] = useState(0);
  const [setBreakTimer, setSetBreakTimer] = useState(null);
  const [setBreakSeconds, setSetBreakSeconds] = useState(0);
  const [autoLiberoEntryModal, setAutoLiberoEntryModal] = useState({ open: false, team: null, targetData: null, liberos: [] });
  const [autoLiberoExitModal, setAutoLiberoExitModal] = useState({ open: false, exitData: null });
  const [liberoServeAvailableDialogOpen, setLiberoServeAvailableDialogOpen] = useState(false);
  const [liberoServeAvailableDialogTeam, setLiberoServeAvailableDialogTeam] = useState('');
  const hasShownOfficialsOnStart = useRef(false);
  const matchTimerRef = useRef(null);
  const setTimerRef = useRef(null);
  const setBreakTimerRef = useRef(null);
  const prevLineupRef = useRef({ A: null, B: null });
  const prevServingRef = useRef(null);
  const hasCheckedAutoEntryAtStartRef = useRef(false);
  const prevSetNumberRef = useRef(null);
  const lastShownLiberoServeKeyRef = useRef(null);

  useEffect(() => {
    if (!gameCode) {
      navigate('/');
    }
  }, [gameCode, navigate]);

  useEffect(() => {
    if (!gameData || !gameCode || loading) return;
    if (hasShownOfficialsOnStart.current) return;
    // Auto-open officials modal on first visit to referee panel (or before match start) until they save from it
    if (gameData.officialsSavedAt != null) return;
    hasShownOfficialsOnStart.current = true;
    setOfficialsModalOpen(true);
  }, [gameData, gameCode, loading]);

  // Initialize rally state from Firestore
  useEffect(() => {
    if (gameData) {
      setRallyActive(gameData.rallyActive || false);
    }
  }, [gameData?.rallyActive]);

  // Match and Set Time Tracking
  useEffect(() => {
    if (!gameData) return;
    
    // Match time
    if (gameData.createdAt) {
      matchTimerRef.current = setInterval(() => {
        const duration = calculateMatchDuration(gameData.createdAt.toDate ? gameData.createdAt.toDate() : new Date(gameData.createdAt));
        setMatchTime(duration);
      }, 1000);
    }
    
    // Set time
    const currentSet = gameData.currentSet || 1;
    const sets = gameData.sets || [];
    const currentSetData = sets[currentSet - 1];
    if (currentSetData?.startTime) {
      setTimerRef.current = setInterval(() => {
        const duration = calculateSetDuration(currentSetData.startTime.toDate ? currentSetData.startTime.toDate() : new Date(currentSetData.startTime));
        setSetTime(duration);
      }, 1000);
    }
    
    return () => {
      if (matchTimerRef.current) clearInterval(matchTimerRef.current);
      if (setTimerRef.current) clearInterval(setTimerRef.current);
    };
  }, [gameData]);

  // Set Break Timer (3 minutes between sets)
  useEffect(() => {
    if (!gameData) return;
    const currentSet = gameData.currentSet || 1;
    const sets = gameData.sets || [];
    
    // Check if previous set just ended
    if (currentSet > 1) {
      const prevSet = sets[currentSet - 2];
      if (prevSet?.endTime && !prevSet.breakTimerStarted) {
        setSetBreakSeconds(180); // 3 minutes
        setSetBreakTimer(true);
        
        setBreakTimerRef.current = setInterval(() => {
          setSetBreakSeconds((prev) => {
            if (prev <= 1) {
              setSetBreakTimer(false);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    }
    
    return () => {
      if (setBreakTimerRef.current) clearInterval(setBreakTimerRef.current);
    };
  }, [gameData?.currentSet, gameData?.sets]);

  // Auto Libero Entry/Exit Checking
  useEffect(() => {
    if (!gameData || !gameCode || loading || autoLiberoEntryModal.open || autoLiberoExitModal.open) return;
    
    const teams = gameData.teams || {};
    const currentSet = gameData.currentSet || 1;
    const sets = gameData.sets || [];
    const currentSetData = sets[currentSet - 1];
    if (!currentSetData) return;
    
    // Reset "already shown" when set number changes so we show popup at start of EACH set (like original HTML)
    if (prevSetNumberRef.current !== null && prevSetNumberRef.current !== currentSet) {
      hasCheckedAutoEntryAtStartRef.current = false;
    }
    prevSetNumberRef.current = currentSet;
    
    const serving = currentSetData.serving || 'A';
    const scoreA = currentSetData.score?.A || 0;
    const scoreB = currentSetData.score?.B || 0;
    const isFirstServe = scoreA === 0 && scoreB === 0;
    
    // Both teams must have lineups (6 players) before showing libero entry popup at 0-0
    const lineupA = teams.A?.lineup || [];
    const lineupB = teams.B?.lineup || [];
    const lineupReady = lineupA.filter(Boolean).length === 6 && lineupB.filter(Boolean).length === 6;
    
    // Check for auto libero entry at match/set start (0-0) - SEQUENTIALLY like original HTML
    if (isFirstServe && lineupReady && !hasCheckedAutoEntryAtStartRef.current) {
      hasCheckedAutoEntryAtStartRef.current = true;
      
      // Show RECEIVING team modal FIRST, then SERVING team modal (like original HTML)
      const receivingTeam = serving === 'A' ? 'B' : 'A';
      const servingTeam = serving;
      
      setTimeout(() => {
        checkAutoLiberoEntryWithCallback(receivingTeam, teams, serving, currentSetData, () => {
          // After receiving team modal is done, show SERVING team modal
          setTimeout(() => {
            checkAutoLiberoEntryWithCallback(servingTeam, teams, serving, currentSetData, () => {
              // Both modals done
            });
          }, 500);
        });
      }, 800);
    }
    
    // Check for auto libero entry after service change
    if (!isFirstServe && prevServingRef.current !== null && prevServingRef.current !== serving) {
      const opponent = serving === 'A' ? 'B' : 'A';
      checkAutoLiberoEntryAfterLosingService(opponent, teams, currentSetData);
    }
    prevServingRef.current = serving;
    
    // Check for auto libero exit after rotation (libero in front row)
    // Also check for libero in P1 violation
    ['A', 'B'].forEach(team => {
      const lineup = teams[team]?.lineup || [];
      const prevLineup = prevLineupRef.current[team];
      if (prevLineup && JSON.stringify(prevLineup) !== JSON.stringify(lineup)) {
        // Check for libero in front row (exit modal)
        checkAutoLiberoExit(team, teams, lineup, prevLineup);
        // Check for libero in P1 violation (serving team only)
        checkLiberoP1Violation(team, teams, lineup, currentSetData);
      }
      prevLineupRef.current[team] = [...lineup];
    });
  }, [gameData, gameCode, loading, autoLiberoEntryModal.open, autoLiberoExitModal.open]);

  // Show "Libero serve is available" dialog when serving team has libero at P1 (allowed to serve) - like original HTML
  useEffect(() => {
    if (!gameData || liberoServeAvailableDialogOpen) return;
    if (autoLiberoEntryModal.open || autoLiberoExitModal.open) return;
    const currentSet = gameData.currentSet || 1;
    const set = gameData.sets?.[currentSet - 1];
    if (!set) return;
    const servingTeam = set.serving;
    const lineup = gameData.teams?.[servingTeam]?.lineup || [];
    if (lineup.length === 0) return;
    const p1Jersey = String(lineup[0]);
    const validation = validateServeStart(gameData, gameData.liberoServeConfig || {});
    // When P1 is no longer a libero (or not allowed), reset so we can show again next time
    if (!validation.liberoMayServe) {
      lastShownLiberoServeKeyRef.current = null;
      return;
    }
    if (gameData.rallyActive) return; // Don't show while rally is in progress
    const key = `${currentSet}-${servingTeam}-${p1Jersey}`;
    if (lastShownLiberoServeKeyRef.current === key) return;
    lastShownLiberoServeKeyRef.current = key;
    const teamName = (servingTeam === 'A' ? gameData.teamAName : gameData.teamBName) || `Team ${servingTeam}`;
    setLiberoServeAvailableDialogTeam(teamName);
    setLiberoServeAvailableDialogOpen(true);
  }, [gameData, liberoServeAvailableDialogOpen, autoLiberoEntryModal.open, autoLiberoExitModal.open]);

  // Helper function to check auto libero entry with callback (like original HTML)
  const checkAutoLiberoEntryWithCallback = (team, teams, serving, setData, callback) => {
    if (!gameData) {
      if (callback) callback();
      return;
    }
    
    const players = teams[team]?.players || [];
    const lineup = teams[team]?.lineup || [];
    const isLiberoRole = (r) => r === 'libero1' || r === 'libero2' || r === 'liberocaptain';
    let liberos = players.filter(p => isLiberoRole(p.role));
    
    if (liberos.length === 0) {
      if (callback) callback();
      return;
    }
    
    // Filter out expelled/disqualified liberos (check sanction system)
    // Match original HTML: SM.isPlayerLocked = isExpelled || isDisqualified
    const sanctionSystem = gameData.sanctionSystem || {};
    const expelled = sanctionSystem.expelled?.[team] || []; // [{jersey, set}]
    const disqualified = sanctionSystem.disqualified?.[team] || []; // [{jersey}]
    const injuredPlayers = gameData.injuredPlayers || { A: [], B: [] };
    const currentSet = gameData.currentSet || 1;
    
    // Check for expelled (EXP) and disqualified (DISQ) players
    // Match original HTML: SM.isExpelled checks expelled[team] for current set
    // Match original HTML: SM.isDisqualified checks disqualified[team]
    const isPlayerLocked = (jerseyStr) => {
      // Check if disqualified (entire match)
      const isDisq = disqualified.some(d => String(d.jersey) === jerseyStr);
      if (isDisq) return true;
      // Check if expelled in current set
      const isExp = expelled.some(e => String(e.jersey) === jerseyStr && e.set === currentSet);
      if (isExp) return true;
      // Check if injured
      if (injuredPlayers[team].includes(jerseyStr)) return true;
      return false;
    };
    
    const availableLiberos = liberos.filter(lib => {
      const jerseyStr = String(lib.jersey);
      return !isPlayerLocked(jerseyStr);
    });
    
    if (availableLiberos.length === 0) {
      if (callback) callback();
      return;
    }
    
    // Check if any libero already on court
    const liberoOnCourt = lineup.some(j => availableLiberos.some(l => String(l.jersey) === String(j)));
    if (liberoOnCourt) {
      if (callback) callback();
      return;
    }
    
    // Safety check - make sure sets array exists
    const sets = gameData.sets || [];
    if (sets.length === 0 || !sets[gameData.currentSet - 1]) {
      if (callback) callback();
      return;
    }
    
    const scoreA = setData.score?.A || 0;
    const scoreB = setData.score?.B || 0;
    const isFirstServe = scoreA === 0 && scoreB === 0;
    
    if (!isFirstServe) {
      // Not first serve - this function should not be called
      if (callback) callback();
      return;
    }
    
    // Determine target position based on serving status
    const isServing = setData.serving === team;
    let targetPosIndex, targetPosition;
    if (isServing) {
      targetPosIndex = 5; // P6
      targetPosition = 6;
    } else {
      targetPosIndex = 0; // P1
      targetPosition = 1;
    }
    
    const jersey = lineup[targetPosIndex];
    const player = players.find(p => String(p.jersey) === String(jersey));
    if (!player || isLiberoRole(player.role)) {
      if (callback) callback();
      return;
    }
    
    const targetData = {
      player,
      position: targetPosition,
      posIndex: targetPosIndex,
      jersey
    };
    
    // Store callback for when modal closes
    setAutoLiberoEntryModal({
      open: true,
      team,
      targetData,
      liberos: availableLiberos,
      callback: callback
    });
  };

  // Helper function to check auto libero entry at match start (legacy, kept for compatibility)
  const checkAutoLiberoEntry = (team, teams, serving, setData) => {
    checkAutoLiberoEntryWithCallback(team, teams, serving, setData, null);
  };

  // Helper function to check auto libero entry after losing service
  const checkAutoLiberoEntryAfterLosingService = (team, teams, setData) => {
    if (!gameData) return;
    const players = teams[team]?.players || [];
    const lineup = teams[team]?.lineup || [];
    const isLiberoRole = (r) => r === 'libero1' || r === 'libero2' || r === 'liberocaptain';
    const liberos = players.filter(p => isLiberoRole(p.role));
    
    if (liberos.length === 0) return;
    
    // Filter out expelled/disqualified liberos (check sanction system)
    const sanctionSystem = gameData.sanctionSystem || {};
    const expelled = sanctionSystem.expelled?.[team] || []; // [{jersey, set}]
    const disqualified = sanctionSystem.disqualified?.[team] || []; // [{jersey}]
    const injuredPlayers = gameData.injuredPlayers || { A: [], B: [] };
    const currentSet = gameData.currentSet || 1;
    
    // Check for expelled (EXP) and disqualified (DISQ) players
    const isPlayerLocked = (jerseyStr) => {
      // Check if disqualified (entire match)
      const isDisq = disqualified.some(d => String(d.jersey) === jerseyStr);
      if (isDisq) return true;
      // Check if expelled in current set
      const isExp = expelled.some(e => String(e.jersey) === jerseyStr && e.set === currentSet);
      if (isExp) return true;
      // Check if injured
      if (injuredPlayers[team].includes(jerseyStr)) return true;
      return false;
    };
    
    const availableLiberos = liberos.filter(lib => {
      const jerseyStr = String(lib.jersey);
      return !isPlayerLocked(jerseyStr);
    });
    if (availableLiberos.length === 0) return;
    
    // Check if any libero already on court
    const liberoOnCourt = lineup.some(j => availableLiberos.some(l => String(l.jersey) === String(j)));
    if (liberoOnCourt) return;
    
    // Target P1 (server position that they just lost)
    const targetPosIndex = 0; // P1
    const targetPosition = 1;
    const jersey = lineup[targetPosIndex];
    const player = players.find(p => String(p.jersey) === String(jersey));
    if (!player || isLiberoRole(player.role)) return;
    
    const targetData = {
      player,
      position: targetPosition,
      posIndex: targetPosIndex,
      jersey
    };
    
    setAutoLiberoEntryModal({
      open: true,
      team,
      targetData,
      liberos: availableLiberos
    });
  };

  // Helper: check auto libero exit when libero rotates to front row (like HTML autoReplaceLiberoInFrontRow → showAutoLiberoExitModal)
  const checkAutoLiberoExit = (team, teams, currentLineup, prevLineup) => {
    if (!gameData || !prevLineup || prevLineup.length === 0) return;
    if (autoLiberoExitModal.open) return; // Already showing exit modal
    
    const players = teams[team]?.players || [];
    const isLiberoRole = (r) => r === 'libero1' || r === 'libero2' || r === 'liberocaptain';
    const liberoReplacements = gameData.liberoReplacements || { A: [], B: [] };
    const replacements = liberoReplacements[team] || [];
    
    // Front row positions (P2, P3, P4 = indices 1, 2, 3) — like HTML frontRowIndices
    const frontRowIndices = [1, 2, 3];
    for (const posIndex of frontRowIndices) {
      const currentJersey = currentLineup[posIndex];
      if (!currentJersey) continue;
      
      const currentPlayer = players.find(p => String(p.jersey) === String(currentJersey));
      if (!currentPlayer || !isLiberoRole(currentPlayer.role)) continue;
      
      const replacement = replacements.find(r => String(r.libero) === String(currentJersey));
      if (!replacement) continue;
      
      const originalPlayer = players.find(p => String(p.jersey) === String(replacement.originalPlayer));
      if (!originalPlayer) continue;
      
      // Show modal for first libero found in front row only (like HTML replacements[0])
      const teamName = (team === 'A' ? gameData.teamAName : gameData.teamBName) || `Team ${team}`;
      setAutoLiberoExitModal({
        open: true,
        exitData: {
          libero: currentPlayer,
          original: originalPlayer,
          position: posIndex + 1,
          posIndex,
          team,
          replacementData: replacement,
          teamName
        }
      });
      return;
    }
  };

  // Helper function to check for libero in P1 violation after rotation
  const checkLiberoP1Violation = (team, teams, currentLineup, setData) => {
    if (!gameData || !setData) return;
    
    const serving = setData.serving || 'A';
    // Only check for serving team
    if (team !== serving) return;
    
    const players = teams[team]?.players || [];
    const isLiberoRole = (r) => r === 'libero1' || r === 'libero2' || r === 'liberocaptain';
    
    // Check if P1 (index 0) is a libero
    const p1Jersey = currentLineup[0];
    if (!p1Jersey) return;
    
    const p1Player = players.find(p => String(p.jersey) === String(p1Jersey));
    if (!p1Player || !isLiberoRole(p1Player.role)) return;
    
    // P1 is a libero - check libero serve configuration
    const liberoServeConfig = gameData.liberoServeConfig || {};
    const teamConfig = liberoServeConfig[team] || {};
    
    // If libero serve is enabled but no designated player is set, open libero modal to select
    if (teamConfig.enabled && !teamConfig.designatedJersey) {
      // Open libero modal to allow user to select which player libero can serve for
      setTimeout(() => {
        setLiberoModal({ open: true, team });
      }, 100);
      return;
    }
    
    // If libero serve is enabled and designated player is set, validate
    if (teamConfig.enabled && teamConfig.designatedJersey) {
      const validation = validateServeStart(gameData, liberoServeConfig);
      
      if (!validation.valid) {
        // Show alert immediately after rotation (like original HTML)
        setTimeout(() => {
          alert(validation.message || '🚫 ILLEGAL SERVE - Libero Serving Violation');
        }, 100);
      }
    } else {
      // Libero serve is not enabled - show violation alert
      setTimeout(() => {
        alert('🚫 ILLEGAL SERVE - Libero Serving Violation\n\nLibero cannot serve. Please remove libero from P1 position or enable libero serving in lineup setup.');
      }, 100);
    }
  };

  const handleAutoLiberoEntryConfirm = async (team, liberoJersey, targetData) => {
    if (!gameCode) return;
    setUpdating(true);
    setMessage('');
    
    // Get callback before closing modal
    const callback = autoLiberoEntryModal.callback;
    
    try {
      await recordLiberoReplacementWithTracking(
        gameCode,
        team,
        liberoJersey,
        targetData.jersey,
        targetData.position
      );
      setMessage('Libero entry recorded');
      setTimeout(() => setMessage(''), 2000);
      setAutoLiberoEntryModal({ open: false, team: null, targetData: null, liberos: [], callback: null });
      
      // Call callback after modal closes (for sequential modals)
      if (callback) {
        setTimeout(() => {
          callback();
        }, 200);
      }
    } catch (err) {
      setMessage(`Error: ${err.message}`);
      setTimeout(() => setMessage(''), 3000);
      setAutoLiberoEntryModal({ open: false, team: null, targetData: null, liberos: [], callback: null });
      
      // Still call callback even on error
      if (callback) {
        setTimeout(() => {
          callback();
        }, 200);
      }
    } finally {
      setUpdating(false);
    }
  };

  const handleAutoLiberoExitConfirm = async (exitData) => {
    if (!gameCode) return;
    setUpdating(true);
    setMessage('');
    try {
      await removeLiberoFromCourt(gameCode, exitData.team, exitData.libero.jersey);
      setMessage('Libero exit recorded');
      setTimeout(() => setMessage(''), 2000);
      setAutoLiberoExitModal({ open: false, exitData: null });
    } catch (err) {
      setMessage(`Error: ${err.message}`);
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setUpdating(false);
    }
  };

  const handleToggleRally = async () => {
    if (!gameCode || !gameData) return;
    const newRallyState = !rallyActive;
    
    // If starting rally, validate libero serve rules (like original HTML - no blocking confirm)
    if (newRallyState) {
      const validation = validateServeStart(gameData, gameData.liberoServeConfig || {});
      if (!validation.valid) {
        alert(validation.message || 'Cannot start rally: Libero serving violation');
        return;
      }
      // "Libero serve is available" is shown by the dialog when libero comes to P1; here we just allow rally to start
    }
    
    setUpdating(true);
    try {
      await updateRallyState(gameCode, newRallyState);
      setRallyActive(newRallyState);
      setMessage(newRallyState ? 'Rally started' : 'Rally stopped');
      setTimeout(() => setMessage(''), 2000);
    } catch (err) {
      setMessage(`Error: ${err.message}`);
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setUpdating(false);
    }
  };

  const handleScoreUpdate = async (team, increment = 1) => {
    if (updating || !gameCode || !rallyActive) {
      if (!rallyActive) {
        setMessage('Please start rally first');
        setTimeout(() => setMessage(''), 2000);
      }
      return;
    }
    
    setUpdating(true);
    setMessage('');
    try {
      // Use addPoint which handles rotation and set completion
      const result = await addPoint(gameCode, team, rallyActive);
      
      if (result.completed) {
        // Add to match history
        try {
          const finalScore = currentSetData?.score || { A: 0, B: 0 };
          await addMatchHistoryEvent(gameCode, {
            type: 'SET_WON',
            team: result.winner,
            setNumber: gameData.currentSet,
            description: `Set ${gameData.currentSet} won by Team ${result.winner}`,
            score: finalScore
          });
        } catch (err) {
          console.error('Error adding match history:', err);
        }
        
        setMessage(`Set ${gameData.currentSet} won by Team ${result.winner}!`);
        if (result.matchFinished) {
          setTimeout(() => {
            setMessage('Match finished!');
          }, 3000);
        } else {
          // Check if next set is deciding set
          const nextSet = (gameData.currentSet || 1) + 1;
          const format = Number(gameData.format) || 3;
          const isDecidingSet = (format === 5 && nextSet === 5) || (format === 3 && nextSet === 3);
          
          if (isDecidingSet) {
            setTimeout(() => {
              setDecidingSetTossModalOpen(true);
            }, 2000);
          } else {
            setTimeout(() => {
              setNextSetModalOpen(true);
            }, 2000);
          }
        }
      } else {
        // Auto-stop rally when point is scored (like original HTML)
        if (rallyActive) {
          await updateRallyState(gameCode, false);
          setRallyActive(false);
        }
        
        // Add point to match history
        try {
          const currentScore = currentSetData?.score || { A: 0, B: 0 };
          await addMatchHistoryEvent(gameCode, {
            type: 'POINT',
            team: team,
            setNumber: gameData.currentSet,
            description: `Point scored by Team ${team}`,
            score: currentScore
          });
        } catch (err) {
          console.error('Error adding match history:', err);
        }
        
        setMessage(`Point added for Team ${team}`);
        setTimeout(() => setMessage(''), 2000);
      }
    } catch (err) {
      setMessage(`Error: ${err.message}`);
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setUpdating(false);
    }
  };

  const handleNextSet = async () => {
    if (updating || !gameCode || !gameData) return;
    if (gameData.status === 'FINISHED') return;
    const currentSet = gameData.currentSet || 1;
    const sets = gameData.sets || [];
    const currentSetData = sets[currentSet - 1];
    if (!currentSetData) {
      setMessage('No current set data');
      return;
    }
    if (currentSetData.winner) {
      setMessage('This set is already ended.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    const scoreA = currentSetData.score?.A || 0;
    const scoreB = currentSetData.score?.B || 0;
    if (scoreA === scoreB) {
      setMessage('Cannot end set with tied score');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    const winner = scoreA > scoreB ? 'A' : 'B';
    setUpdating(true);
    setMessage('');
    try {
      await updateSets(gameCode, winner);
      setMessage(`Set ${currentSet} won by Team ${winner}`);
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage(`Error: ${err.message}`);
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setUpdating(false);
    }
  };

  const handleFinishGame = async () => {
    if (updating || !gameCode) return;
    if (!window.confirm('Are you sure you want to mark this game as finished?')) return;
    setUpdating(true);
    setMessage('');
    try {
      await markGameFinished(gameCode);
      setMessage('Game marked as finished');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage(`Error: ${err.message}`);
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setUpdating(false);
    }
  };

  const handleUndo = async () => {
    if (updating || !gameCode) return;
    setUpdating(true);
    setMessage('');
    try {
      await undoLastPoint(gameCode);
      setMessage('Last point undone');
      setTimeout(() => setMessage(''), 2000);
    } catch (err) {
      setMessage(`Error: ${err.message}`);
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setUpdating(false);
    }
  };

  const handleTimeout = async (team) => {
    if (updating || !gameCode) return;
    setUpdating(true);
    setMessage('');
    try {
      const result = await recordTimeout(gameCode, team);
      if (result.ok) {
        setTimeoutModal({ open: true, team });
      } else {
        setMessage(result.message || 'Timeout failed');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      setMessage(`Error: ${err.message}`);
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setUpdating(false);
    }
  };

  const handleTimeoutClose = () => setTimeoutModal({ open: false, team: null });

  const handleSubConfirm = async (team, playerOut, playerIn) => {
    if (!gameCode) return;
    const setDataBefore = gameData.sets?.[gameData.currentSet - 1];
    const trackingBefore = setDataBefore?.substitutionTracking?.[team] || {};
    const playerOutStr = String(playerOut);
    const playerInStr = String(playerIn);
    const isReturning = trackingBefore[playerOutStr]?.pairedWith === playerInStr;
    setUpdating(true);
    setMessage('');
    try {
      const result = await recordSubstitution(gameCode, team, playerOut, playerIn);
      if (result.ok) {
        setSubModal({ open: false, team: null });
        const teams = gameData.teams || {};
        const outPlayer = teams[team]?.players?.find((p) => String(p.jersey) === playerOutStr);
        const inPlayer = teams[team]?.players?.find((p) => String(p.jersey) === playerInStr);
        let msg = '✓ Substitution complete!\nOUT: #' + (outPlayer?.jersey ?? playerOut) + ' ' + (outPlayer?.name ?? '') + '\nIN: #' + (inPlayer?.jersey ?? playerIn) + ' ' + (inPlayer?.name ?? '');
        if (isReturning) {
          msg += '\n\n📋 This is the 2nd substitution action with these players.';
          msg += '\n⚠️ Players #' + (outPlayer?.jersey ?? playerOut) + ' and #' + (inPlayer?.jersey ?? playerIn) + ' cannot be substituted again in this set.';
        } else {
          msg += '\n\n📋 Players #' + (outPlayer?.jersey ?? playerOut) + ' and #' + (inPlayer?.jersey ?? playerIn) + ' are now paired.';
          msg += '\n⚠️ They can ONLY substitute with each other for the rest of this set.';
        }
        alert(msg);
        setMessage('Substitution recorded');
        setTimeout(() => setMessage(''), 2000);
      } else {
        alert(result.message || 'Substitution failed');
        setMessage(result.message || 'Substitution failed');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      setMessage(`Error: ${err.message}`);
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setUpdating(false);
    }
  };

  const handleExceptionalSub = async (team, playerOut, playerIn) => {
    if (!gameCode) return;
    setUpdating(true);
    setMessage('');
    try {
      const result = await recordExceptionalSubstitution(gameCode, team, playerOut, playerIn);
      if (result.ok) {
        setSubModal({ open: false, team: null });
        const teams = gameData.teams || {};
        const setData = gameData.sets?.[gameData.currentSet - 1];
        const outPlayer = teams[team]?.players?.find((p) => String(p.jersey) === String(playerOut));
        const inPlayer = teams[team]?.players?.find((p) => String(p.jersey) === String(playerIn));
        const otherTeam = team === 'A' ? 'B' : 'A';
        const scoreText = (setData?.score?.[team] ?? 0) + ':' + (setData?.score?.[otherTeam] ?? 0);
        const timeStr = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
        let msg = '🚑 EXCEPTIONAL SUBSTITUTION COMPLETE!\n\n';
        msg += 'OUT: #' + (outPlayer?.jersey ?? playerOut) + ' ' + (outPlayer?.name ?? '') + ' (INJURED)\n';
        msg += 'IN: #' + (inPlayer?.jersey ?? playerIn) + ' ' + (inPlayer?.name ?? '') + '\n\n';
        msg += '📋 Details:\n';
        msg += '• Set: ' + (gameData.currentSet ?? 1) + '\n';
        msg += '• Score: ' + scoreText + '\n';
        msg += '• Time: ' + timeStr + '\n\n';
        msg += '⚠️ IMPORTANT:\n';
        msg += '• This substitution does NOT count toward the 6-substitution limit\n';
        msg += '• Player #' + (outPlayer?.jersey ?? playerOut) + ' is LOCKED and cannot return to play in this match\n';
        msg += '• Tagged with "E" in match records';
        alert(msg);
        setMessage('Exceptional substitution recorded (injury)');
        setTimeout(() => setMessage(''), 2000);
      } else {
        alert(result.message || 'Exceptional substitution failed');
        setMessage(result.message || 'Exceptional substitution failed');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      setMessage(`Error: ${err.message}`);
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setUpdating(false);
    }
  };

  const handleOfficialsSave = async (data) => {
    if (!gameCode) return;
    setUpdating(true);
    setMessage('');
    try {
      await updateOfficials(gameCode, data);
      setMessage('Officials and signatures saved');
      setTimeout(() => setMessage(''), 2000);
    } catch (err) {
      setMessage(`Error: ${err.message}`);
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setUpdating(false);
    }
  };

  const handleLiberoConfirm = async (team, positionIndex, liberoJersey, playerOutJersey) => {
    if (!gameCode) return;
    setUpdating(true);
    setMessage('');
    try {
      await recordLiberoReplacementWithTracking(gameCode, team, liberoJersey, playerOutJersey, positionIndex + 1);
      setMessage('Libero replacement recorded');
      setTimeout(() => setMessage(''), 2000);
      setLiberoModal({ open: false, team: null });
    } catch (err) {
      setMessage(`Error: ${err.message}`);
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setUpdating(false);
    }
  };

  const handleLiberoRemove = async (team, liberoJersey) => {
    if (!gameCode) return;
    setUpdating(true);
    setMessage('');
    try {
      await removeLiberoFromCourt(gameCode, team, liberoJersey);
      setMessage('Libero removed from court');
      setTimeout(() => setMessage(''), 2000);
      setLiberoModal({ open: false, team: null });
    } catch (err) {
      setMessage(`Error: ${err.message}`);
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setUpdating(false);
    }
  };

  const handleSwap = async () => {
    if (!gameCode) return;
    setUpdating(true);
    setMessage('');
    try {
      await updateGameSwapped(gameCode);
      setMessage('Sides swapped');
      setTimeout(() => setMessage(''), 2000);
    } catch (err) {
      setMessage(`Error: ${err.message}`);
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setUpdating(false);
    }
  };

  const handleSaveMatch = () => {
    try {
      const filename = saveMatch(gameData);
      setMessage(`Match saved: ${filename}`);
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage(`Error saving match: ${err.message}`);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleLoadMatch = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!window.confirm('⚠️ LOAD MATCH?\n\nThis will replace the current match data.\n\nMake sure you have saved the current match if needed!')) {
      event.target.value = '';
      return;
    }

    try {
      const result = await loadMatch(file);
      setMessage(`Match loaded: ${result.filename}`);
      setTimeout(() => setMessage(''), 3000);
      // Note: In a real implementation, you would update Firestore with the loaded data
      // For now, we just show a message. The user would need to manually update the game.
      alert('✅ MATCH LOADED!\n\nLoaded from: ' + result.filename + '\n\nNote: Match data has been loaded. You may need to manually update the game in Firestore.');
    } catch (err) {
      setMessage(`Error loading match: ${err.message}`);
      setTimeout(() => setMessage(''), 3000);
      alert('❌ ERROR LOADING FILE!\n\n' + err.message);
    } finally {
      event.target.value = '';
    }
  };

  const handleExportHistoryPDF = () => {
    // For now, export as HTML (PDF export requires jsPDF library)
    // User can print the HTML to PDF from browser
    const html = generateHistoryHtml(gameData);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Match_History_${gameData.teamAName || 'TeamA'}_vs_${gameData.teamBName || 'TeamB'}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setMessage('History exported as HTML (you can print to PDF from browser)');
    setTimeout(() => setMessage(''), 3000);
  };

  const handleExportSummaryPDF = () => {
    // For now, export as HTML (PDF export requires jsPDF library)
    const html = generateSummaryHtml(gameData);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Match_Summary_${gameData.teamAName || 'TeamA'}_vs_${gameData.teamBName || 'TeamB'}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setMessage('Summary exported as HTML (you can print to PDF from browser)');
    setTimeout(() => setMessage(''), 3000);
  };

  const generateHistoryHtml = (gameData) => {
    const teamAName = gameData.teamAName || 'Team A';
    const teamBName = gameData.teamBName || 'Team B';
    const matchSummary = gameData.matchSummary || [];
    
    let html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Match History</title>';
    html += '<style>body{font-family:Arial,sans-serif;margin:40px;background:#f5f5f5;}';
    html += '.container{max-width:1100px;margin:0 auto;background:white;padding:40px;box-shadow:0 0 20px rgba(0,0,0,0.1);}';
    html += 'h1{text-align:center;color:#1e3c72;border-bottom:3px solid #1e3c72;padding-bottom:15px;}';
    html += '.history-item{margin:15px 0;padding:15px;background:#f9f9f9;border-left:4px solid #1e3c72;}';
    html += '.history-header{display:flex;justify-content:space-between;margin-bottom:10px;}';
    html += '.history-team{font-weight:bold;color:#1e3c72;}';
    html += '.history-set{color:#888;}';
    html += '</style></head><body><div class="container">';
    html += '<h1>📋 MATCH HISTORY REPORT</h1>';
    html += '<p><strong>' + (gameData.competition || '') + ' | ' + (gameData.venue || '') + '</strong></p>';
    html += '<p><strong>' + teamAName + ' vs ' + teamBName + '</strong></p>';
    
    if (matchSummary.length === 0) {
      html += '<p>No match history yet.</p>';
    } else {
      matchSummary.forEach((event, idx) => {
        html += '<div class="history-item">';
        html += '<div class="history-header">';
        html += '<span class="history-team">' + (event.team === 'A' ? teamAName : teamBName) + '</span>';
        html += '<span class="history-set">Set ' + (event.setNumber || '-') + '</span>';
        html += '</div>';
        html += '<div>' + (event.description || event.type || 'Event') + '</div>';
        if (event.score) {
          html += '<div>Score: ' + event.score.A + ' - ' + event.score.B + '</div>';
        }
        html += '</div>';
      });
    }
    
    html += '</div></body></html>';
    return html;
  };

  const generateSummaryHtml = (gameData) => {
    const teamAName = gameData.teamAName || 'Team A';
    const teamBName = gameData.teamBName || 'Team B';
    const sets = gameData.sets || [];
    const setsWon = gameData.setsWon || { A: 0, B: 0 };
    
    let html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Match Summary</title>';
    html += '<style>body{font-family:Arial,sans-serif;margin:40px;background:#f5f5f5;}';
    html += '.container{max-width:1100px;margin:0 auto;background:white;padding:40px;box-shadow:0 0 20px rgba(0,0,0,0.1);}';
    html += 'h1{text-align:center;color:#1e3c72;border-bottom:3px solid #1e3c72;padding-bottom:15px;}';
    html += 'table{width:100%;border-collapse:collapse;margin:20px 0;}';
    html += 'th,td{border:1px solid #ddd;padding:10px;text-align:left;}';
    html += 'th{background:#1e3c72;color:white;}';
    html += '</style></head><body><div class="container">';
    html += '<h1>📊 MATCH SUMMARY REPORT</h1>';
    html += '<p><strong>' + (gameData.competition || '') + ' | ' + (gameData.venue || '') + '</strong></p>';
    html += '<p><strong>' + teamAName + ' vs ' + teamBName + '</strong></p>';
    
    html += '<h2>Match Result</h2>';
    html += '<table><tr><th>Team</th><th>Sets Won</th></tr>';
    html += '<tr><td>' + teamAName + '</td><td>' + setsWon.A + '</td></tr>';
    html += '<tr><td>' + teamBName + '</td><td>' + setsWon.B + '</td></tr>';
    html += '<tr><td colspan="2"><strong>🏆 Winner: ' + (setsWon.A > setsWon.B ? teamAName : teamBName) + '</strong></td></tr>';
    html += '</table>';
    
    html += '<h2>Set-by-Set Scores</h2>';
    html += '<table><tr><th>Set</th><th>' + teamAName + '</th><th>' + teamBName + '</th><th>Winner</th></tr>';
    sets.forEach((set, idx) => {
      if (!set.winner && set.score?.A === 0 && set.score?.B === 0) return;
      html += '<tr>';
      html += '<td>Set ' + (idx + 1) + '</td>';
      html += '<td>' + (set.score?.A || 0) + '</td>';
      html += '<td>' + (set.score?.B || 0) + '</td>';
      html += '<td>' + (set.winner ? (set.winner === 'A' ? teamAName : teamBName) : '-') + '</td>';
      html += '</tr>';
    });
    html += '</table>';
    
    html += '</div></body></html>';
    return html;
  };

  const handleRotate = async (team) => {
    if (!gameCode || !gameData) return;
    
    const teams = gameData.teams || {};
    const currentLineup = teams[team]?.lineup || [];
    const players = teams[team]?.players || [];
    
    // Validate lineup completeness before rotation
    const completenessCheck = validateLineupCompleteness(currentLineup, players);
    if (!completenessCheck.valid) {
      setMessage(`Error: ${completenessCheck.message}`);
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    
    // Validate single libero on court
    const liberoCheck = validateSingleLiberoOnCourt(currentLineup, players);
    if (!liberoCheck.valid) {
      setMessage(`Error: ${liberoCheck.message}`);
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    
    // Calculate expected rotation
    const expectedRotation = rotateLineupClockwise(currentLineup);
    
    // Validate each position after rotation
    const serving = currentSetData?.serving || 'A';
    for (let i = 0; i < 6; i++) {
      const posCheck = validateLiberoPosition(expectedRotation, players, i, serving, team);
      if (!posCheck.valid) {
        setMessage(`Error: ${posCheck.message}`);
        setTimeout(() => setMessage(''), 3000);
        return;
      }
    }
    
    const displayName = team === leftTeam ? leftTeamName : rightTeamName;
    if (!window.confirm(`🔄 MANUAL ROTATION\n\nRotate ${displayName} lineup?\n\nThis will rotate all positions clockwise:\nP1→P6, P2→P1, P3→P2, P4→P3, P5→P4, P6→P5\n\nNote: This should only be used for corrections, not during normal play.`)) return;
    
    setUpdating(true);
    setMessage('');
    try {
      await rotateLineup(gameCode, team);
      setMessage('Rotation complete');
      setTimeout(() => setMessage(''), 2000);
    } catch (err) {
      setMessage(`Error: ${err.message}`);
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="referee-container">
        <div className="referee-loading">Loading game data...</div>
      </div>
    );
  }

  if (error || !gameData) {
    return (
      <div className="referee-container">
        <div className="referee-error">
          {error || 'Game not found'}
          <button onClick={() => navigate('/')} className="referee-back-btn">Go Home</button>
        </div>
      </div>
    );
  }

  const currentSet = gameData.currentSet || 1;
  const sets = gameData.sets || [];
  const currentSetData = sets[currentSet - 1];
  const setsWon = gameData.setsWon || { A: 0, B: 0 };
  const status = gameData.status || 'LIVE';
  const teamAName = gameData.teamAName || 'Team A';
  const teamBName = gameData.teamBName || 'Team B';

  if (!currentSetData) {
    return (
      <div className="referee-container">
        <div className="referee-no-data">Waiting for match to start...</div>
      </div>
    );
  }

  const scoreA = currentSetData.score?.A || 0;
  const scoreB = currentSetData.score?.B || 0;
  const serving = currentSetData.serving || 'A';
  const swapped = !!gameData.swapped;
  const leftTeam = swapped ? 'B' : 'A';
  const rightTeam = swapped ? 'A' : 'B';
  const subLimit = Number(gameData.subLimit) || 6;
  const toA = (currentSetData.timeouts?.A || []).length;
  const toB = (currentSetData.timeouts?.B || []).length;
  const subA = (currentSetData.substitutions?.A || []).length;
  const subB = (currentSetData.substitutions?.B || []).length;

  const lineupA = gameData.teams?.A?.lineup || [];
  const lineupB = gameData.teams?.B?.lineup || [];
  const playersA = gameData.teams?.A?.players || [];
  const playersB = gameData.teams?.B?.players || [];

  const teamAColor = gameData.teamAColor || '#ff6b9d';
  const teamBColor = gameData.teamBColor || '#4ecdc4';

  const isLiberoRole = (r) => r === 'libero1' || r === 'libero2' || r === 'liberocaptain';
  const liberoJerseysA = new Set(
    playersA.filter((p) => isLiberoRole(p.role)).map((p) => String(p.jersey))
  );
  const liberoJerseysB = new Set(
    playersB.filter((p) => isLiberoRole(p.role)).map((p) => String(p.jersey))
  );

  const leftTeamName = leftTeam === 'A' ? teamAName : teamBName;
  const rightTeamName = rightTeam === 'A' ? teamAName : teamBName;
  const leftScore = leftTeam === 'A' ? scoreA : scoreB;
  const rightScore = rightTeam === 'A' ? scoreA : scoreB;
  const lineupLeft = leftTeam === 'A' ? lineupA : lineupB;
  const lineupRight = rightTeam === 'A' ? lineupA : lineupB;
  const playersLeft = leftTeam === 'A' ? playersA : playersB;
  const playersRight = rightTeam === 'A' ? playersA : playersB;
  const toLeft = leftTeam === 'A' ? toA : toB;
  const toRight = rightTeam === 'A' ? toA : toB;
  const subLeft = leftTeam === 'A' ? subA : subB;
  const subRight = rightTeam === 'A' ? subA : subB;
  const leftColor = leftTeam === 'A' ? teamAColor : teamBColor;
  const rightColor = rightTeam === 'A' ? teamAColor : teamBColor;
  const liberoJerseysLeft = leftTeam === 'A' ? liberoJerseysA : liberoJerseysB;
  const liberoJerseysRight = rightTeam === 'A' ? liberoJerseysA : liberoJerseysB;

  const topInfo = [gameData.competition || '', gameData.venue || '', `${teamAName} vs ${teamBName}`].filter(Boolean).join(' | ') || 'Match';

  return (
    <div className="referee-app">
      {status === 'FINISHED' && (
        <div className="referee-match-over-banner">
          <span className="referee-match-over-text">🏆 MATCH OVER</span>
          <span className="referee-match-over-winner">
            {setsWon.A > setsWon.B ? leftTeamName : rightTeamName} wins {Math.max(setsWon.A, setsWon.B)}–{Math.min(setsWon.A, setsWon.B)}
          </span>
        </div>
      )}
      <div className="referee-top-bar">
        <h1>🏐 DC_Volley</h1>
        <div className="referee-match-info">
          <div className="referee-match-info-item">
            <span>🏆</span>
            <span className="championship-info">{topInfo}</span>
          </div>
          <div className="referee-match-info-item">
            <span>⏱</span>
            Match: <strong>{formatDuration(matchTime)}</strong>
          </div>
          <div className="referee-match-info-item">
            <span>⏲</span>
            Set: <strong>{formatDuration(setTime)}</strong>
          </div>
          {setBreakTimer && (
            <div className="referee-match-info-item referee-interval-timer">
              <span>⏳</span>
              Interval: <strong>{formatDuration(setBreakSeconds)}</strong>
            </div>
          )}
          <div className="referee-match-info-item">Game: <strong>{gameCode}</strong></div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <button type="button" className="referee-btn-small referee-btn-roster" onClick={() => setRosterModalOpen(true)}>📋 ROSTER</button>
          <button type="button" className="referee-btn-small" onClick={handleSaveMatch} style={{ background: '#4CAF50', color: '#fff' }}>💾 SAVE</button>
          <input
            type="file"
            ref={loadMatchFileInputRef}
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleLoadMatch}
          />
          <button type="button" className="referee-btn-small" onClick={() => loadMatchFileInputRef.current?.click()} style={{ background: '#2196F3', color: '#fff' }}>📂 LOAD</button>
          <button type="button" className="referee-btn-small" onClick={() => setNextSetModalOpen(true)} disabled={updating || status === 'FINISHED' || !currentSetData?.winner}>📝 SETUP NEXT SET</button>
          <button type="button" className="referee-btn-small" onClick={() => setMatchDataModalOpen(true)} style={{ background: '#00ff00', color: '#000' }}>💾 DATA</button>
          <button type="button" className="referee-btn-small" onClick={() => setSummaryModalOpen(true)} style={{ background: '#ffd700', color: '#000' }}>📊 SUMMARY</button>
          <button type="button" className="referee-btn-small" onClick={() => setHistoryModalOpen(true)}>📋 HISTORY</button>
          <button type="button" className="referee-btn-small referee-btn-export" onClick={() => downloadMatchReportHtml(gameData)}>📄 Export PDF</button>
          <button type="button" className="referee-btn-small" onClick={() => window.open(`/lineup?code=${gameCode}`, '_blank')} style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', color: '#fff' }}>👥 Lineup</button>
          <button type="button" className="referee-btn-small" onClick={() => window.open(`/scoreboard?code=${gameCode}`, '_blank')} style={{ background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', color: '#fff' }}>📺 Scoreboard</button>
          <button type="button" className="referee-btn-small referee-btn-officials" onClick={() => setOfficialsModalOpen(true)}>👥 OFFICIALS</button>
          <button type="button" className="referee-btn-small referee-btn-sanction" onClick={() => setSanctionModalOpen(true)} style={{ background: '#ff0000', color: '#fff' }}>⚠️ SANCTION</button>
          <button type="button" className="referee-btn-small referee-btn-swap" onClick={handleSwap} disabled={updating || status === 'FINISHED'} title="Swap which team is on left/right">🔄 SWAP</button>
          <button type="button" className="referee-btn-small" onClick={handleUndo} disabled={updating || status === 'FINISHED'} style={{ background: '#ff9500', color: '#fff' }}>↶ UNDO</button>
          <button type="button" className="referee-btn-small" onClick={handleFinishGame} disabled={updating || status === 'FINISHED'}>End Match</button>
          <button type="button" className="referee-btn-small" onClick={() => { if (window.confirm('Exit?')) navigate('/display-select'); }} disabled={updating}>Exit</button>
        </div>
      </div>

      <div className="referee-main">
        <div className="referee-side-panel">
          <div className="referee-side-title">{leftTeamName} LINEUP</div>
          <LineupList
            team={leftTeam}
            teamName={leftTeamName}
            lineup={lineupLeft}
            players={playersLeft}
            serving={serving}
            currentSetData={currentSetData}
            currentSet={currentSet}
            sanctionSystem={gameData.sanctionSystem}
          />
        </div>

        <div className="referee-center">
          <div className="referee-score-section">
            <div className="referee-team-score">
              <div className="referee-team-name" style={{ color: leftColor }}>{leftTeamName}</div>
              <div className="referee-score-display-val" style={{ color: leftColor }}>{leftScore}</div>
              <div className="referee-sets-small">Sets: {setsWon[leftTeam]}</div>
            </div>
            <div className="referee-set-center">
              <div className="referee-set-title">SET {currentSet}</div>
              <div className="referee-set-dots">
                {Array.from({ length: gameData.format || 3 }).map((_, i) => {
                  const set = sets[i];
                  const isWon = set?.winner;
                  let dotClass = 'referee-set-dot';
                  if (isWon === 'A') dotClass += ' set-won-a';
                  else if (isWon === 'B') dotClass += ' set-won-b';
                  return <div key={i} className={dotClass}>{i + 1}</div>;
                })}
              </div>
            </div>
            <div className="referee-team-score">
              <div className="referee-team-name" style={{ color: rightColor }}>{rightTeamName}</div>
              <div className="referee-score-display-val" style={{ color: rightColor }}>{rightScore}</div>
              <div className="referee-sets-small">Sets: {setsWon[rightTeam]}</div>
            </div>
          </div>

          <div className="referee-courts">
            <div className="referee-court-container">
              <div className="referee-court-header">
                <div className="referee-court-name">{leftTeamName}</div>
                <div className="referee-stats-row">
                  <div className="referee-stat">
                    <span className="referee-stat-label">TIMEOUT</span>
                    <span className="referee-stat-val">{toLeft}/2</span>
                  </div>
                  <div className="referee-stat">
                    <span className="referee-stat-label">SUB</span>
                    <span className="referee-stat-val">{subLeft}/{subLimit}</span>
                  </div>
                  <div className="referee-stat">
                    <span className="referee-stat-label">SERVE</span>
                    <span className="referee-stat-val">{serving === leftTeam ? 'YES' : 'NO'}</span>
                  </div>
                </div>
              </div>
              <div className="referee-court-visual">
                <CourtGrid
                  team={leftTeam}
                  lineup={lineupLeft}
                  players={playersLeft}
                  serving={serving}
                  liberoJerseys={liberoJerseysLeft}
                />
              </div>
              <div className="referee-court-controls">
                <div className="referee-btn-group">
                  <button 
                    type="button" 
                    className={`referee-btn referee-btn-point ${!rallyActive ? 'rally-inactive' : ''}`} 
                    onClick={() => handleScoreUpdate(leftTeam)} 
                    disabled={updating || status === 'FINISHED' || !rallyActive}
                  >
                    + POINT
                  </button>
                </div>
                <div className="referee-btn-group">
                  <button type="button" className="referee-btn referee-btn-timeout" onClick={() => handleTimeout(leftTeam)} disabled={updating || status === 'FINISHED'}>⏱ TO</button>
                  <button type="button" className="referee-btn referee-btn-sub" onClick={() => setSubModal({ open: true, team: leftTeam })} disabled={updating || status === 'FINISHED'}>👥 SUB</button>
                </div>
                <div className="referee-btn-group">
                  <button type="button" className="referee-btn referee-btn-libero" onClick={() => setLiberoModal({ open: true, team: leftTeam })} disabled={updating || status === 'FINISHED'}>🔄 LIBERO</button>
                  <button type="button" className="referee-btn referee-btn-rot" onClick={() => handleRotate(leftTeam)} disabled={updating || status === 'FINISHED'} title="Manual rotation (corrections only)">🔄 ROT</button>
                </div>
              </div>
            </div>

            <div className="referee-rally-strip">
              <button
                type="button"
                className={`referee-rally-btn ${rallyActive ? 'active' : ''}`}
                onClick={handleToggleRally}
                disabled={updating || status === 'FINISHED'}
              >
                {rallyActive ? '⚡ ACTIVE' : '🏐 START RALLY'}
              </button>
              <div className="referee-rally-status">
                {rallyActive ? 'IN PROGRESS' : 'STOPPED'}
              </div>
            </div>

            <div className="referee-court-container">
              <div className="referee-court-header">
                <div className="referee-court-name">{rightTeamName}</div>
                <div className="referee-stats-row">
                  <div className="referee-stat">
                    <span className="referee-stat-label">TIMEOUT</span>
                    <span className="referee-stat-val">{toRight}/2</span>
                  </div>
                  <div className="referee-stat">
                    <span className="referee-stat-label">SUB</span>
                    <span className="referee-stat-val">{subRight}/{subLimit}</span>
                  </div>
                  <div className="referee-stat">
                    <span className="referee-stat-label">SERVE</span>
                    <span className="referee-stat-val">{serving === rightTeam ? 'YES' : 'NO'}</span>
                  </div>
                </div>
              </div>
              <div className="referee-court-visual">
                <CourtGrid
                  team={rightTeam}
                  lineup={lineupRight}
                  players={playersRight}
                  serving={serving}
                  liberoJerseys={liberoJerseysRight}
                />
              </div>
              <div className="referee-court-controls">
                <div className="referee-btn-group">
                  <button 
                    type="button" 
                    className={`referee-btn referee-btn-point ${!rallyActive ? 'rally-inactive' : ''}`} 
                    onClick={() => handleScoreUpdate(rightTeam)} 
                    disabled={updating || status === 'FINISHED' || !rallyActive}
                  >
                    + POINT
                  </button>
                </div>
                <div className="referee-btn-group">
                  <button type="button" className="referee-btn referee-btn-timeout" onClick={() => handleTimeout(rightTeam)} disabled={updating || status === 'FINISHED'}>⏱ TO</button>
                  <button type="button" className="referee-btn referee-btn-sub" onClick={() => setSubModal({ open: true, team: rightTeam })} disabled={updating || status === 'FINISHED'}>👥 SUB</button>
                </div>
                <div className="referee-btn-group">
                  <button type="button" className="referee-btn referee-btn-libero" onClick={() => setLiberoModal({ open: true, team: rightTeam })} disabled={updating || status === 'FINISHED'}>🔄 LIBERO</button>
                  <button type="button" className="referee-btn referee-btn-rot" onClick={() => handleRotate(rightTeam)} disabled={updating || status === 'FINISHED'} title="Manual rotation (corrections only)">🔄 ROT</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="referee-side-panel right">
          <div className="referee-side-title">{rightTeamName} LINEUP</div>
          <LineupList
            team={rightTeam}
            teamName={rightTeamName}
            lineup={lineupRight}
            players={playersRight}
            serving={serving}
            currentSetData={currentSetData}
            currentSet={currentSet}
            sanctionSystem={gameData.sanctionSystem}
          />
        </div>
      </div>

      <div className="referee-copyright-footer">DC_Volley © 2025 | Digital Volleyball Scoresheet</div>

      {rosterModalOpen && (
        <div className="referee-roster-modal" onClick={() => setRosterModalOpen(false)}>
          <div className="referee-roster-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="referee-roster-title">📋 TEAM ROSTERS</h3>
            <div className="referee-roster-grid">
              <div className="referee-roster-team-box team-a">
                <h4 className="referee-roster-team-name team-a">{teamAName}</h4>
                <table className="referee-roster-table">
                  <thead><tr><th>#</th><th>Name</th><th>Role</th></tr></thead>
                  <tbody>
                    {(playersA || []).map((p) => (
                      <tr key={p.jersey}><td>{p.jersey}</td><td>{p.name}</td><td>{p.role || 'Player'}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="referee-roster-team-box team-b">
                <h4 className="referee-roster-team-name team-b">{teamBName}</h4>
                <table className="referee-roster-table">
                  <thead><tr><th>#</th><th>Name</th><th>Role</th></tr></thead>
                  <tbody>
                    {(playersB || []).map((p) => (
                      <tr key={p.jersey}><td>{p.jersey}</td><td>{p.name}</td><td>{p.role || 'Player'}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="referee-modal-buttons">
              <button type="button" className="referee-btn-close" onClick={() => setRosterModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <TimeoutModal
        open={timeoutModal.open}
        teamName={timeoutModal.team ? (timeoutModal.team === 'A' ? teamAName : teamBName) : ''}
        scoreA={currentSetData?.score?.A ?? 0}
        scoreB={currentSetData?.score?.B ?? 0}
        teamAName={teamAName}
        teamBName={teamBName}
        onClose={handleTimeoutClose}
      />
      <SubModal
        open={subModal.open}
        team={subModal.team}
        teamName={subModal.team === 'A' ? teamAName : teamBName}
        teams={gameData.teams}
        currentSet={currentSet}
        sets={sets}
        subLimit={subLimit}
        injuredPlayers={gameData.injuredPlayers}
        liberoReplacements={gameData.liberoReplacements}
        sanctionSystem={gameData.sanctionSystem}
        onConfirm={handleSubConfirm}
        onExceptional={handleExceptionalSub}
        onClose={() => setSubModal({ open: false, team: null })}
      />
      <SanctionModal
        open={sanctionModalOpen}
        gameCode={gameCode}
        teamAName={teamAName}
        teamBName={teamBName}
        sanctionSystem={gameData.sanctionSystem}
        currentSet={currentSet}
        teams={gameData.teams}
        onApply={async (mod, teamKey, payload) => {
          try {
            setUpdating(true);
            setMessage('');
            await recordSanction(gameCode, teamKey, mod, payload);
            setMessage('Sanction recorded.');
            setTimeout(() => setMessage(''), 2000);
            // Don't close modal automatically - let user see the result
          } catch (err) {
            setMessage(err?.message || 'Failed to record sanction.');
            setTimeout(() => setMessage(''), 3000);
          } finally {
            setUpdating(false);
          }
        }}
        onClose={() => setSanctionModalOpen(false)}
      />
      <OfficialsModal
        open={officialsModalOpen}
        gameData={gameData}
        onSave={handleOfficialsSave}
        onClose={() => setOfficialsModalOpen(false)}
      />
      <LiberoModal
        open={liberoModal.open}
        team={liberoModal.team}
        teamName={liberoModal.team === 'A' ? teamAName : teamBName}
        teams={gameData.teams}
        currentSet={currentSet}
        sets={sets}
        serving={serving}
        liberoReplacements={gameData.liberoReplacements}
        liberoServeConfig={gameData.liberoServeConfig}
        gameData={gameData}
        onConfirm={handleLiberoConfirm}
        onRemove={handleLiberoRemove}
        onClose={() => setLiberoModal({ open: false, team: null })}
      />

      <AutoLiberoEntryModal
        open={autoLiberoEntryModal.open}
        team={autoLiberoEntryModal.team}
        teamName={autoLiberoEntryModal.team === 'A' ? teamAName : teamBName}
        targetData={autoLiberoEntryModal.targetData}
        liberos={autoLiberoEntryModal.liberos}
        gameData={gameData}
        currentSetData={currentSetData}
        onConfirm={handleAutoLiberoEntryConfirm}
        onSkip={() => {
          const callback = autoLiberoEntryModal.callback;
          setAutoLiberoEntryModal({ open: false, team: null, targetData: null, liberos: [], callback: null });
          // Call callback after modal closes (for sequential modals)
          if (callback) {
            setTimeout(() => {
              callback();
            }, 200);
          }
        }}
        onClose={() => {
          const callback = autoLiberoEntryModal.callback;
          setAutoLiberoEntryModal({ open: false, team: null, targetData: null, liberos: [], callback: null });
          // Call callback after modal closes (for sequential modals)
          if (callback) {
            setTimeout(() => {
              callback();
            }, 200);
          }
        }}
      />

      <AutoLiberoExitModal
        open={autoLiberoExitModal.open}
        exitData={autoLiberoExitModal.exitData}
        onConfirm={handleAutoLiberoExitConfirm}
        onClose={() => setAutoLiberoExitModal({ open: false, exitData: null })}
      />

      {/* Libero serve is available — informational dialog when libero is at P1 (like original HTML) */}
      {liberoServeAvailableDialogOpen && (
        <div className="referee-modal-overlay" style={{ zIndex: 2500 }} onClick={() => setLiberoServeAvailableDialogOpen(false)}>
          <div className="referee-libero-serve-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="referee-libero-serve-dialog-icon">🏐</div>
            <h3 className="referee-libero-serve-dialog-title">Libero serve is available</h3>
            <p className="referee-libero-serve-dialog-message">
              {liberoServeAvailableDialogTeam && `${liberoServeAvailableDialogTeam} has a libero in P1 (designated player). `}
              Libero may serve for this position. You may start the rally when ready.
            </p>
            <button type="button" className="referee-libero-serve-dialog-ok" onClick={() => setLiberoServeAvailableDialogOpen(false)}>
              OK
            </button>
          </div>
        </div>
      )}

      {message && (
        <div className={`referee-message ${message.includes('Error') ? 'error' : 'success'}`}>{message}</div>
      )}

      {/* Match History Modal */}
      {historyModalOpen && (
        <div className="referee-modal-overlay" onClick={() => setHistoryModalOpen(false)}>
          <div className="referee-modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="referee-modal-title">📋 MATCH HISTORY</h3>
            <div className="referee-history-content">
              {gameData.matchSummary && gameData.matchSummary.length > 0 ? (
                <div className="referee-history-list">
                  {gameData.matchSummary.map((event, idx) => (
                    <div key={idx} className={`referee-history-item ${event.type?.toLowerCase() || ''}`}>
                      <div className="referee-history-header">
                        <span className="referee-history-team">{event.team === 'A' ? teamAName : teamBName}</span>
                        <span className="referee-history-set">Set {event.setNumber || '-'}</span>
                      </div>
                      <div className="referee-history-description">{event.description || event.type || 'Event'}</div>
                      {event.score && (
                        <div className="referee-history-score">
                          Score: {event.score.A} - {event.score.B}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="referee-history-empty">No match history yet. Start the match to see live updates.</div>
              )}
            </div>
            <div className="referee-modal-buttons">
              <button type="button" className="referee-btn-close" onClick={handleExportHistoryPDF} style={{ background: '#00ff00', color: '#000', marginRight: '10px' }}>📥 Export PDF</button>
              <button type="button" className="referee-btn-close" onClick={() => setHistoryModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Next Set Setup Modal */}
      {nextSetModalOpen && (
        <NextSetSetupModal
          open={nextSetModalOpen}
          gameCode={gameCode}
          gameData={gameData}
          onClose={() => setNextSetModalOpen(false)}
          onComplete={() => {
            setNextSetModalOpen(false);
            setMessage('Next set setup complete');
            setTimeout(() => setMessage(''), 2000);
          }}
        />
      )}

      {/* Deciding Set Toss Modal */}
      {decidingSetTossModalOpen && (
        <DecidingSetTossModal
          open={decidingSetTossModalOpen}
          gameCode={gameCode}
          gameData={gameData}
          onClose={() => setDecidingSetTossModalOpen(false)}
          onComplete={() => {
            setDecidingSetTossModalOpen(false);
            setNextSetModalOpen(true);
          }}
        />
      )}

      <MatchDataModal
        open={matchDataModalOpen}
        gameData={gameData}
        onClose={() => setMatchDataModalOpen(false)}
      />

      <SummaryModal
        open={summaryModalOpen}
        gameData={gameData}
        onClose={() => setSummaryModalOpen(false)}
        onExportPDF={handleExportSummaryPDF}
      />

      <button type="button" className="referee-back-home" onClick={() => navigate('/display-select')}>← Back</button>
    </div>
  );
}

// Next Set Setup Modal Component — click player then position (like HTML); liberos cannot be in starting lineup
function NextSetSetupModal({ open, gameCode, gameData, onClose, onComplete }) {
  const [lineupA, setLineupA] = useState(Array(6).fill(null));
  const [lineupB, setLineupB] = useState(Array(6).fill(null));
  const [selectedPlayerForLineup, setSelectedPlayerForLineup] = useState(null); // { side: 'A'|'B', jersey }
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && gameData) {
      const currentA = gameData.teams?.A?.lineup || [];
      const currentB = gameData.teams?.B?.lineup || [];
      setLineupA([...currentA, ...Array(6 - currentA.length).fill(null)].slice(0, 6));
      setLineupB([...currentB, ...Array(6 - currentB.length).fill(null)].slice(0, 6));
      setSelectedPlayerForLineup(null);
    }
  }, [open, gameData]);

  const handleStartSet = async () => {
    if (!gameCode) return;
    if (lineupA.filter(p => p).length !== 6 || lineupB.filter(p => p).length !== 6) {
      setError('Both teams must have 6 players in starting lineup');
      return;
    }
    setUpdating(true);
    setError('');
    try {
      const currentSet = gameData.currentSet || 1;
      const nextSet = currentSet + 1;
      const format = Number(gameData.format) || 3;
      const prevSet = gameData.sets?.[currentSet - 1];
      const prevServer = prevSet?.serving || 'A';
      const firstServer = prevServer === 'A' ? 'B' : 'A';
      await setupNextSet(gameCode, { A: lineupA, B: lineupB }, firstServer);
      onComplete();
    } catch (err) {
      setError(err.message || 'Failed to setup next set');
    } finally {
      setUpdating(false);
    }
  };

  if (!open) return null;

  const isLibero = (p) => p.role === 'libero1' || p.role === 'libero2' || p.role === 'liberocaptain';
  const playersA = (gameData?.teams?.A?.players || []).filter(p => p.jersey && !isLibero(p)).sort((a, b) => Number(a.jersey) - Number(b.jersey));
  const playersB = (gameData?.teams?.B?.players || []).filter(p => p.jersey && !isLibero(p)).sort((a, b) => Number(a.jersey) - Number(b.jersey));
  const posOrder = [4, 3, 2, 5, 6, 1];
  const posLabels = { 4: 'P4-LF', 3: 'P3-MF', 2: 'P2-RF', 5: 'P5-LB', 6: 'P6-MB', 1: 'P1-RB' };

  const assignPosition = (side, pos) => {
    const idx = pos - 1;
    const lineup = side === 'A' ? lineupA : lineupB;
    const setLineup = side === 'A' ? setLineupA : setLineupB;
    const sel = selectedPlayerForLineup;
    if (!sel || sel.side !== side) return;
    const currentAtPos = lineup[idx];
    const currentIdx = lineup.findIndex(j => j && String(j) === String(sel.jersey));
    if (currentIdx === idx) {
      const next = [...lineup];
      next[idx] = null;
      setLineup(next);
      setSelectedPlayerForLineup(null);
      return;
    }
    if (currentIdx !== -1) {
      alert(`Player #${sel.jersey} is already at P${currentIdx + 1}. Click that position to remove them first, then assign to the new position.`);
      return;
    }
    const next = [...lineup];
    next[idx] = sel.jersey;
    setLineup(next);
    setSelectedPlayerForLineup(null);
  };

  return (
    <div className="referee-modal-overlay" onClick={onClose}>
      <div className="referee-modal-content" style={{ maxWidth: '1000px' }} onClick={(e) => e.stopPropagation()}>
        <h3 className="referee-modal-title">Select Starting Lineups for Set {gameData?.currentSet ? gameData.currentSet + 1 : 1}</h3>
        <div className="lineup-setup referee-lineup-setup">
          <div className="team-setup">
            <h3 style={{ color: '#ff6b6b' }}>TEAM A - {gameData?.teamAName || 'Team A'}</h3>
            <div className="player-roster">
              {playersA.map(p => (
                <div
                  key={p.jersey}
                  className={`roster-player ${selectedPlayerForLineup?.side === 'A' && selectedPlayerForLineup?.jersey === p.jersey ? 'selected' : ''}`}
                  onClick={() => setSelectedPlayerForLineup(prev => prev?.side === 'A' && prev?.jersey === p.jersey ? null : { side: 'A', jersey: p.jersey })}
                >
                  <strong>#{p.jersey}</strong> {p.name || ''}
                </div>
              ))}
            </div>
            <div className="court-setup">
              <div className="court-setup-grid">
                {posOrder.map((pos) => {
                  const idx = pos - 1;
                  const jersey = lineupA[idx];
                  return (
                    <div
                      key={pos}
                      className={`court-setup-pos ${jersey ? 'filled' : ''}`}
                      onClick={() => assignPosition('A', pos)}
                    >
                      <span className="pos-setup-label">{posLabels[pos]}</span>
                      <div className="pos-setup-num">{jersey ? `#${jersey}` : '-'}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="team-setup">
            <h3 style={{ color: '#4ecdc4' }}>TEAM B - {gameData?.teamBName || 'Team B'}</h3>
            <div className="player-roster">
              {playersB.map(p => (
                <div
                  key={p.jersey}
                  className={`roster-player ${selectedPlayerForLineup?.side === 'B' && selectedPlayerForLineup?.jersey === p.jersey ? 'selected' : ''}`}
                  onClick={() => setSelectedPlayerForLineup(prev => prev?.side === 'B' && prev?.jersey === p.jersey ? null : { side: 'B', jersey: p.jersey })}
                >
                  <strong>#{p.jersey}</strong> {p.name || ''}
                </div>
              ))}
            </div>
            <div className="court-setup">
              <div className="court-setup-grid">
                {posOrder.map((pos) => {
                  const idx = pos - 1;
                  const jersey = lineupB[idx];
                  return (
                    <div
                      key={pos}
                      className={`court-setup-pos ${jersey ? 'filled' : ''}`}
                      onClick={() => assignPosition('B', pos)}
                    >
                      <span className="pos-setup-label">{posLabels[pos]}</span>
                      <div className="pos-setup-num">{jersey ? `#${jersey}` : '-'}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        <p className="referee-lineup-hint">Click on a player, then click on a court position to assign</p>

        {error && <div className="referee-error">{error}</div>}

        <div className="referee-modal-buttons">
          <button type="button" className="referee-btn-cancel" onClick={onClose}>Cancel</button>
          <button type="button" className="referee-btn-confirm" onClick={handleStartSet} disabled={updating}>
            {updating ? 'Setting up...' : 'Start Set'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Deciding Set Toss Modal Component
function DecidingSetTossModal({ open, gameCode, gameData, onClose, onComplete }) {
  const [tossWinner, setTossWinner] = useState(null);
  const [tossChoice, setTossChoice] = useState(null);
  const [updating, setUpdating] = useState(false);

  const handleTossWinner = (team) => {
    setTossWinner(team);
  };

  const handleTossChoice = async (choice) => {
    if (!gameCode || !tossWinner) return;
    
    setUpdating(true);
    try {
      // Determine first server based on toss
      let firstServer = 'A';
      if (choice === 'serve') {
        firstServer = tossWinner;
      } else {
        firstServer = tossWinner === 'A' ? 'B' : 'A';
      }

      const currentSet = gameData.currentSet || 1;
      const nextSet = currentSet + 1;
      
      // Update game with toss result
      const gameRef = doc(db, 'games', gameCode);
      await updateDoc(gameRef, {
        decidingSetToss: {
          winner: tossWinner,
          choice: choice,
          firstServer: firstServer
        },
        updatedAt: serverTimestamp()
      });

      setTossChoice(choice);
      setTimeout(() => {
        onComplete();
      }, 1000);
    } catch (err) {
      console.error('Error recording toss:', err);
    } finally {
      setUpdating(false);
    }
  };

  if (!open) return null;

  return (
    <div className="referee-modal-overlay" onClick={onClose}>
      <div className="referee-modal-content" onClick={(e) => e.stopPropagation()}>
        <h3 className="referee-modal-title">🎯 DECIDING SET COIN TOSS</h3>
        <p style={{ color: '#00d9ff', textAlign: 'center', marginBottom: '20px' }}>
          Conduct coin toss to determine first service and court side
        </p>

        {!tossWinner ? (
          <>
            <h4 style={{ color: '#ffd700', textAlign: 'center', marginBottom: '20px' }}>STEP 1: WHO WON THE TOSS?</h4>
            <div className="referee-toss-buttons">
              <button
                type="button"
                className="referee-toss-team-btn"
                onClick={() => handleTossWinner('A')}
                style={{ background: '#16213e', borderColor: '#ff6b6b', color: '#ff6b6b' }}
              >
                {gameData?.teamAName || 'TEAM A'}
              </button>
              <button
                type="button"
                className="referee-toss-team-btn"
                onClick={() => handleTossWinner('B')}
                style={{ background: '#16213e', borderColor: '#4ecdc4', color: '#4ecdc4' }}
              >
                {gameData?.teamBName || 'TEAM B'}
              </button>
            </div>
          </>
        ) : (
          <>
            <h4 style={{ color: '#ffd700', textAlign: 'center', marginBottom: '20px' }}>
              STEP 2: {tossWinner === 'A' ? gameData?.teamAName : gameData?.teamBName} CHOOSES:
            </h4>
            <div className="referee-toss-buttons">
              <button
                type="button"
                className="referee-toss-choice-btn"
                onClick={() => handleTossChoice('serve')}
                disabled={updating}
              >
                🏐 SERVE FIRST
              </button>
              <button
                type="button"
                className="referee-toss-choice-btn"
                onClick={() => handleTossChoice('receive')}
                disabled={updating}
              >
                📥 RECEIVE FIRST
              </button>
            </div>
          </>
        )}

        <div className="referee-modal-buttons">
          <button type="button" className="referee-btn-cancel" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
