'use client';

import { useState, useCallback, useEffect, useRef, type DragEvent as ReactDragEvent } from 'react';
import Link from 'next/link';
import {
  Rank,
  Player,
  GamePhase,
  Piece,
  Position,
  GameState,
  RANK_DISPLAY_NAME,
  BOARD_ROWS,
  BOARD_COLS,
  COLUMN_LABELS,
} from '@/game/types';
import {
  createInitialGameState,
  executeMove,
  getValidMoves,
  isInSetupZone,
  isSetupComplete,
  generateRandomSetup,
  getPieceAtPosition,
} from '@/game/engine';
import { getAIMove } from '@/game/ai';
import { THEMES, ThemeId, BoardTheme } from '@/lib/themes';
import { getSounds } from '@/lib/sounds';
import { useAuth } from '@/lib/auth';
import { connectSocket, disconnectSocket } from '@/lib/socket';

type TimerMode = 'none' | '30s' | '1m' | '2m';
const TIMER_LABELS: Record<TimerMode, string> = { 'none': 'No Timer', '30s': '30 seconds', '1m': '1 minute', '2m': '2 minutes' };
const TIMER_SECONDS: Record<TimerMode, number> = { 'none': 0, '30s': 30, '1m': 60, '2m': 120 };

function normalizeTimerSeconds(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  // Server timers are expected in ms; keep this tolerant to seconds payloads.
  return value > 1000 ? Math.ceil(value / 1000) : Math.ceil(value);
}

// ─── Icon mapping (each image is 250×76 with white side on left, black on right) ───
const RANK_ICON: Record<Rank, string> = {
  [Rank.FiveStarGeneral]: '/icons/5star.jpg',
  [Rank.FourStarGeneral]: '/icons/4star.png',
  [Rank.ThreeStarGeneral]: '/icons/3star.png',
  [Rank.TwoStarGeneral]: '/icons/2star.png',
  [Rank.OneStarGeneral]: '/icons/1star.png',
  [Rank.Colonel]: '/icons/colonel.png',
  [Rank.LieutenantColonel]: '/icons/ltcolonel.png',
  [Rank.Major]: '/icons/major.png',
  [Rank.Captain]: '/icons/captain.png',
  [Rank.FirstLieutenant]: '/icons/1stlieutenant.png',
  [Rank.SecondLieutenant]: '/icons/2ndlieutenant.png',
  [Rank.Sergeant]: '/icons/sargeant.png',
  [Rank.Private]: '/icons/private.png',
  [Rank.Spy]: '/icons/spy.png',
  [Rank.Flag]: '/icons/flag.png',
};

const RANK_SHORT: Record<Rank, string> = {
  [Rank.FiveStarGeneral]: '5\u2605G',
  [Rank.FourStarGeneral]: '4\u2605G',
  [Rank.ThreeStarGeneral]: '3\u2605G',
  [Rank.TwoStarGeneral]: '2\u2605G',
  [Rank.OneStarGeneral]: '1\u2605G',
  [Rank.Colonel]: 'COL',
  [Rank.LieutenantColonel]: 'LTC',
  [Rank.Major]: 'MAJ',
  [Rank.Captain]: 'CPT',
  [Rank.FirstLieutenant]: '1LT',
  [Rank.SecondLieutenant]: '2LT',
  [Rank.Sergeant]: 'SGT',
  [Rank.Private]: 'PVT',
  [Rank.Spy]: 'SPY',
  [Rank.Flag]: 'FLG',
};

type GameMode = 'menu' | 'vs-ai' | 'online' | 'queue' | 'custom-lobby' | 'custom-join';

/* Flip board so the current player is always at the bottom */
function logicalRowFromVisual(visualRow: number, playerSide: Player): number {
  if (playerSide === Player.White) return BOARD_ROWS - 1 - visualRow;
  return visualRow;
}

export default function GameBoard() {
  const { user, profile, getIdToken } = useAuth();
  const [mode, setMode] = useState<GameMode>('menu');
  const [gameState, setGameState] = useState<GameState>(createInitialGameState);
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [validMoves, setValidMoves] = useState<Position[]>([]);
  const [themeId, setThemeId] = useState<ThemeId>('vintage');
  const [playerSide, setPlayerSide] = useState<Player>(Player.White);
  const [lastMove, setLastMove] = useState<{ from: Position; to: Position } | null>(null);
  const [challengeAnim, setChallengeAnim] = useState<Position | null>(null);
  const [setupPieceId, setSetupPieceId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [revealAll, setRevealAll] = useState(false);
  const [showGameOverModal, setShowGameOverModal] = useState(false);
  const [previewThemeId, setPreviewThemeId] = useState<ThemeId | null>(null);
  const aiThinking = useRef(false);

  // Online state
  const [timerMode, setTimerMode] = useState<TimerMode>('1m');
  const [queueTime, setQueueTime] = useState(0);
  const [queuePlayers, setQueuePlayers] = useState(0);
  const [lobbyCode, setLobbyCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [opponentName, setOpponentName] = useState('');
  const [opponentElo, setOpponentElo] = useState(0);
  const [onlineTimerWhite, setOnlineTimerWhite] = useState(0);
  const [onlineTimerBlack, setOnlineTimerBlack] = useState(0);
  const [onlineTimerMode, setOnlineTimerMode] = useState<TimerMode>('none');
  const [onlineError, setOnlineError] = useState('');
  const [eloChange, setEloChange] = useState(0);
  const [setupTimeLeft, setSetupTimeLeft] = useState(0);
  const queueInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const playerSideRef = useRef<Player>(Player.White);

  useEffect(() => {
    playerSideRef.current = playerSide;
  }, [playerSide]);

  const theme = THEMES[themeId];
  const sounds = typeof window !== 'undefined' ? getSounds() : null;

  useEffect(() => {
    if (sounds) sounds.setEnabled(soundEnabled);
  }, [soundEnabled, sounds]);

  // ── AI move ──
  useEffect(() => {
    if (mode !== 'vs-ai' || gameState.phase !== GamePhase.Playing || gameState.currentPlayer === playerSide || aiThinking.current) return;
    aiThinking.current = true;
    const t = setTimeout(() => {
      const aiPlayer = playerSide === Player.White ? Player.Black : Player.White;
      const move = getAIMove(gameState, aiPlayer);
      if (move) {
        try {
          const newState = executeMove(gameState, move.pieceId, move.to);
          const piece = gameState.pieces.find((p) => p.id === move.pieceId);
          setLastMove({ from: piece!.position!, to: move.to });
          const last = newState.moveHistory[newState.moveHistory.length - 1];
          if (last?.challenge) { setChallengeAnim(move.to); sounds?.capture(); setTimeout(() => setChallengeAnim(null), 600); }
          else sounds?.move();
          setGameState(newState);
          if (newState.phase === GamePhase.GameOver) { newState.winner === playerSide ? sounds?.victory() : sounds?.defeat(); }
        } catch { /* invalid */ }
      }
      aiThinking.current = false;
    }, 600);
    return () => { clearTimeout(t); aiThinking.current = false; };
  }, [gameState, mode, playerSide, sounds]);

  // ── Reveal enemy pieces on game over, delay modal by 5 s ──
  useEffect(() => {
    if (gameState.phase === GamePhase.GameOver) {
      setRevealAll(true);
      const t = setTimeout(() => setShowGameOverModal(true), 5000);
      return () => clearTimeout(t);
    }
  }, [gameState.phase]);

  // ── Online: connect and listen for socket events ──
  const connectOnline = useCallback(async () => {
    if (!user) return;
    const token = await getIdToken();
    if (!token) return;
    const s = connectSocket();

    // Prevent duplicate listeners/stale closures when reconnecting or rejoining modes.
    const listenerEvents = [
      'authenticated',
      'authError',
      'queueUpdate',
      'matchFound',
      'lobbyCreated',
      'roomJoined',
      'opponentJoined',
      'setupPhase',
      'setupTimerUpdate',
      'autoDeployed',
      'gameStart',
      'opponentReady',
      'opponentPieces',
      'gameOver',
      'error',
      'timerUpdate',
      'moveMade',
      'opponentDisconnected',
      'opponentReconnected',
    ] as const;
    listenerEvents.forEach((eventName) => s.off(eventName as never));

    // Wait for authentication before proceeding
    await new Promise<void>((resolve, reject) => {
      s.emit('authenticate' as never, { token } as never);

      s.once('authenticated' as never, ((_data: { username: string; elo: number }) => {
        setOnlineError('');
        resolve();
      }) as never);

      s.once('authError' as never, ((data: { message: string }) => {
        setOnlineError(data.message);
        reject(new Error(data.message));
      }) as never);
    });

    s.on('queueUpdate' as never, ((data: { position: number; playersInQueue: number }) => {
      setQueuePlayers(data.playersInQueue);
    }) as never);

    s.on('matchFound' as never, ((data: { roomId: string; color: 'white' | 'black'; opponent: string; opponentElo: number; timerMode: TimerMode }) => {
      const nextSide = data.color === 'white' ? Player.White : Player.Black;
      playerSideRef.current = nextSide;
      setPlayerSide(nextSide);
      setOpponentName(data.opponent);
      setOpponentElo(data.opponentElo);
      setOnlineTimerMode(data.timerMode);
      setMode('online');
      if (queueInterval.current) { clearInterval(queueInterval.current); queueInterval.current = null; }
    }) as never);

    s.on('lobbyCreated' as never, ((data: { code: string }) => {
      setLobbyCode(data.code);
    }) as never);

    s.on('roomJoined' as never, ((data: { roomId: string; color: 'white' | 'black' }) => {
      const nextSide = data.color === 'white' ? Player.White : Player.Black;
      playerSideRef.current = nextSide;
      setPlayerSide(nextSide);
      setMode('online');
    }) as never);

    s.on('opponentJoined' as never, ((data: { opponent: string; opponentElo: number }) => {
      setOpponentName(data.opponent);
      setOpponentElo(data.opponentElo);
      setMode('online');
    }) as never);

    s.on('setupPhase' as never, (() => {
      let state = createInitialGameState();
      setGameState(state);
      setRevealAll(false);
      setShowGameOverModal(false);
      setSetupTimeLeft(120);
    }) as never);

    s.on('setupTimerUpdate' as never, ((data: { remaining: number }) => {
      setSetupTimeLeft(data.remaining);
    }) as never);

    s.on('autoDeployed' as never, ((data: { pieces: { id: string; rank: string; row: number; col: number }[] }) => {
      // Server auto-deployed our pieces — update local game state
      setGameState(prev => {
        const mySide = playerSideRef.current;
        const myPieces = prev.pieces.filter(p => p.owner === mySide);
        const byId = new Map(data.pieces.map(p => [p.id, p]));
        const updatedPieces = prev.pieces.map(p => {
          if (p.owner !== mySide) return p;
          const exact = byId.get(p.id);
          if (exact) {
            return { ...p, id: exact.id, position: { row: exact.row, col: exact.col } };
          }
          const idx = myPieces.indexOf(p);
          if (idx >= 0 && idx < data.pieces.length) {
            return { ...p, id: data.pieces[idx].id, position: { row: data.pieces[idx].row, col: data.pieces[idx].col } };
          }
          return p;
        });
        return { ...prev, pieces: updatedPieces };
      });
    }) as never);

    s.on('gameStart' as never, ((data: { currentPlayer: 'white' | 'black'; timerMode: TimerMode }) => {
      setOnlineTimerMode(data.timerMode);
      const startSeconds = TIMER_SECONDS[data.timerMode] ?? 0;
      setOnlineTimerWhite(startSeconds);
      setOnlineTimerBlack(startSeconds);
      setGameState(prev => ({ ...prev, phase: GamePhase.Playing, currentPlayer: data.currentPlayer === 'white' ? Player.White : Player.Black }));
    }) as never);

    s.on('opponentReady' as never, (() => {
      sounds?.click();
    }) as never);

    s.on('opponentPieces' as never, ((data: { pieces: { id: string; row: number; col: number }[] }) => {
      // Place opponent pieces on the board (positions only, no ranks revealed)
      setGameState(prev => {
        const mySide = playerSideRef.current;
        const opponentOwner = mySide === Player.White ? Player.Black : Player.White;
        const opponentPieces = prev.pieces.filter(p => p.owner === opponentOwner);
        const byId = new Map(data.pieces.map(p => [p.id, { row: p.row, col: p.col }]));
        // Map server piece IDs to local pieces (by index, since both are ordered the same way)
        const updatedPieces = prev.pieces.map(p => {
          if (p.owner !== opponentOwner) return p;
          const exact = byId.get(p.id);
          if (exact) {
            return { ...p, position: { row: exact.row, col: exact.col } };
          }
          const idx = opponentPieces.indexOf(p);
          if (idx >= 0 && idx < data.pieces.length) {
            return { ...p, id: data.pieces[idx].id, position: { row: data.pieces[idx].row, col: data.pieces[idx].col } };
          }
          return p;
        });
        return { ...prev, pieces: updatedPieces };
      });
    }) as never);

    s.on('gameOver' as never, ((data: { winner: 'white' | 'black'; reason: string; eloChange: number }) => {
      const winner = data.winner === 'white' ? Player.White : Player.Black;
      setGameState(prev => ({ ...prev, phase: GamePhase.GameOver, winner, winReason: data.reason }));
      setEloChange(data.eloChange);
      winner === playerSideRef.current ? sounds?.victory() : sounds?.defeat();
    }) as never);

    s.on('error' as never, ((data: { message: string }) => {
      setOnlineError(data.message);
    }) as never);

    s.on('timerUpdate' as never, ((data: { white: number; black: number }) => {
      setOnlineTimerWhite(normalizeTimerSeconds(data.white));
      setOnlineTimerBlack(normalizeTimerSeconds(data.black));
    }) as never);

    s.on('moveMade' as never, ((data: { pieceId: string; fromRow: number; fromCol: number; toRow: number; toCol: number; challenge?: { result: string; eliminatedPieceIds: string[] }; currentPlayer: 'white' | 'black'; turnCount: number; timerWhite: number; timerBlack: number }) => {
      const from: Position = { row: data.fromRow, col: data.fromCol };
      const to: Position = { row: data.toRow, col: data.toCol };
      setLastMove({ from, to });
      if (data.challenge) {
        setChallengeAnim(to);
        sounds?.capture();
        setTimeout(() => setChallengeAnim(null), 600);
      } else {
        sounds?.move();
      }
      setOnlineTimerWhite(normalizeTimerSeconds(data.timerWhite));
      setOnlineTimerBlack(normalizeTimerSeconds(data.timerBlack));
      setGameState(prev => {
        let pieces = [...prev.pieces];
        const movingPiece = pieces.find(p => p.id === data.pieceId);
        if (!movingPiece) return prev;
        if (data.challenge) {
          const result = data.challenge.result;
          if (result === 'attacker_wins' || result === 'flag_captured') {
            const defender = getPieceAtPosition(pieces, to);
            if (defender) {
              pieces = pieces.map(p => {
                if (p.id === data.pieceId) return { ...p, position: to };
                if (p.id === defender.id) return { ...p, position: null, isAlive: false };
                return p;
              });
              const elimKey = defender.owner === Player.White ? 'white' : 'black';
              return { ...prev, pieces, currentPlayer: data.currentPlayer === 'white' ? Player.White : Player.Black, eliminatedPieces: { ...prev.eliminatedPieces, [elimKey]: [...prev.eliminatedPieces[elimKey], defender] } };
            }
          } else if (result === 'defender_wins') {
            pieces = pieces.map(p => {
              if (p.id === data.pieceId) return { ...p, position: null, isAlive: false };
              return p;
            });
            const elimKey = movingPiece.owner === Player.White ? 'white' : 'black';
            return { ...prev, pieces, currentPlayer: data.currentPlayer === 'white' ? Player.White : Player.Black, eliminatedPieces: { ...prev.eliminatedPieces, [elimKey]: [...prev.eliminatedPieces[elimKey], movingPiece] } };
          } else {
            // Both die
            const defender = getPieceAtPosition(pieces, to);
            if (defender) {
              pieces = pieces.map(p => {
                if (p.id === data.pieceId) return { ...p, position: null, isAlive: false };
                if (p.id === defender.id) return { ...p, position: null, isAlive: false };
                return p;
              });
              const atkKey = movingPiece.owner === Player.White ? 'white' : 'black';
              const defKey = defender.owner === Player.White ? 'white' : 'black';
              const elimPieces = { ...prev.eliminatedPieces };
              elimPieces[atkKey] = [...elimPieces[atkKey], movingPiece];
              elimPieces[defKey] = [...elimPieces[defKey], defender];
              return { ...prev, pieces, currentPlayer: data.currentPlayer === 'white' ? Player.White : Player.Black, eliminatedPieces: elimPieces };
            }
          }
        }
        // Simple move
        pieces = pieces.map(p => p.id === data.pieceId ? { ...p, position: to } : p);
        return { ...prev, pieces, currentPlayer: data.currentPlayer === 'white' ? Player.White : Player.Black };
      });
    }) as never);

    s.on('opponentDisconnected' as never, (() => {
      setOnlineError('Opponent disconnected. Waiting 30s...');
    }) as never);

    s.on('opponentReconnected' as never, (() => {
      setOnlineError('');
    }) as never);
  }, [user, getIdToken, playerSide, sounds]);

  // ── Queue timer counter ──
  useEffect(() => {
    if (mode === 'queue') {
      setQueueTime(0);
      queueInterval.current = setInterval(() => setQueueTime(t => t + 1), 1000);
      return () => { if (queueInterval.current) { clearInterval(queueInterval.current); queueInterval.current = null; } };
    }
  }, [mode]);

  const joinRankedQueue = useCallback(async (tm: TimerMode) => {
    setTimerMode(tm);
    setMode('queue');
    setOnlineError('');
    await connectOnline();
    const s = connectSocket();
    s.emit('joinQueue' as never, { timerMode: tm } as never);
  }, [connectOnline]);

  const leaveQueue = useCallback(() => {
    const s = connectSocket();
    s.emit('leaveQueue' as never);
    disconnectSocket();
    setMode('menu');
    if (queueInterval.current) { clearInterval(queueInterval.current); queueInterval.current = null; }
  }, []);

  const createLobby = useCallback(async (tm: TimerMode) => {
    setTimerMode(tm);
    setMode('custom-lobby');
    setLobbyCode('');
    setOnlineError('');
    await connectOnline();
    const s = connectSocket();
    s.emit('createCustomLobby' as never, { timerMode: tm } as never);
  }, [connectOnline]);

  const joinLobby = useCallback(async () => {
    if (!joinCode.trim()) return;
    setOnlineError('');
    await connectOnline();
    const s = connectSocket();
    s.emit('joinCustomLobby' as never, { code: joinCode.trim().toUpperCase() } as never);
  }, [connectOnline, joinCode]);

  const startVsAI = useCallback(() => {
    let state = createInitialGameState();
    state = { ...state, pieces: generateRandomSetup(state.pieces, Player.Black) };
    setGameState(state);
    setMode('vs-ai');
    setSelectedPieceId(null);
    setValidMoves([]);
    setLastMove(null);
    setRevealAll(false);
    setShowGameOverModal(false);
    sounds?.click();
  }, [sounds]);

  // ── Drag & Drop (setup) ──
  const handleDragStart = useCallback((e: ReactDragEvent<HTMLDivElement>, pieceId: string) => {
    e.dataTransfer.setData('text/plain', pieceId);
    e.dataTransfer.effectAllowed = 'move';
    setSetupPieceId(pieceId);
  }, []);

  const handleDragOver = useCallback((e: ReactDragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: ReactDragEvent<HTMLDivElement>, row: number, col: number) => {
    e.preventDefault();
    const pieceId = e.dataTransfer.getData('text/plain');
    if (!pieceId) return;
    const pos = { row, col };
    if (!isInSetupZone(pos, playerSide)) return;
    const piece = gameState.pieces.find((p) => p.id === pieceId);
    if (!piece) return;
    const occupant = getPieceAtPosition(gameState.pieces, pos);
    const newPieces = gameState.pieces.map((p) => {
      if (p.id === pieceId) return { ...p, position: pos };
      if (occupant && p.id === occupant.id) return { ...p, position: piece.position };
      return p;
    });
    setGameState({ ...gameState, pieces: newPieces });
    setSetupPieceId(null);
    sounds?.click();
  }, [gameState, playerSide, sounds]);

  // ── Setup click ──
  const handleSetupSquareClick = useCallback((row: number, col: number) => {
    if (gameState.phase !== GamePhase.Setup) return;
    const pos = { row, col };
    if (!isInSetupZone(pos, playerSide)) return;
    const occupant = getPieceAtPosition(gameState.pieces, pos);
    if (setupPieceId) {
      const piece = gameState.pieces.find((p) => p.id === setupPieceId);
      if (!piece) return;
      const newPieces = gameState.pieces.map((p) => {
        if (p.id === setupPieceId) return { ...p, position: pos };
        if (occupant && p.id === occupant.id) return { ...p, position: piece.position };
        return p;
      });
      setGameState({ ...gameState, pieces: newPieces });
      setSetupPieceId(null);
      sounds?.click();
    } else if (occupant && occupant.owner === playerSide) {
      setSetupPieceId(occupant.id);
      sounds?.select();
    }
  }, [gameState, setupPieceId, playerSide, sounds]);

  const handleTrayPieceClick = useCallback((pieceId: string) => {
    if (gameState.phase !== GamePhase.Setup) return;
    setSetupPieceId((prev) => (prev === pieceId ? null : pieceId));
    sounds?.select();
  }, [gameState.phase, sounds]);

  const handleAutoSetup = useCallback(() => {
    setGameState({ ...gameState, pieces: generateRandomSetup(gameState.pieces, playerSide) });
    setSetupPieceId(null);
    sounds?.click();
  }, [gameState, playerSide, sounds]);

  const handleConfirmSetup = useCallback(() => {
    if (!isSetupComplete(gameState.pieces, playerSide)) return;
    if (mode === 'online') {
      // Send setup to server as SerializedPiece[]
      const myPieces = gameState.pieces.filter(p => p.owner === playerSide && p.position);
      const pieces = myPieces.map(p => ({
        id: p.id,
        rank: RANK_SHORT[p.rank],
        owner: (p.owner === Player.White ? 'white' : 'black') as 'white' | 'black',
        row: p.position!.row,
        col: p.position!.col,
        isEliminated: false,
      }));
      const s = connectSocket();
      s.emit('submitSetup' as never, { pieces } as never);
      // Don't advance to Playing locally — wait for gameStart from server
      setSetupPieceId(null);
      sounds?.click();
      return;
    }
    setGameState({ ...gameState, phase: GamePhase.Playing });
    setSetupPieceId(null);
    sounds?.click();
  }, [gameState, playerSide, sounds, mode]);

  // ── Play click ──
  const handlePlaySquareClick = useCallback((row: number, col: number) => {
    if (gameState.phase !== GamePhase.Playing || gameState.currentPlayer !== playerSide) return;
    const pos = { row, col };
    const clickedPiece = getPieceAtPosition(gameState.pieces, pos);
    if (selectedPieceId) {
      if (validMoves.some((m) => m.row === row && m.col === col)) {
        const piece = gameState.pieces.find((p) => p.id === selectedPieceId)!;
        if (mode === 'online') {
          // Emit move to server
          const s = connectSocket();
          s.emit('makeMove' as never, { pieceId: selectedPieceId, toRow: pos.row, toCol: pos.col } as never);
          setSelectedPieceId(null);
          setValidMoves([]);
        } else {
          try {
            const newState = executeMove(gameState, selectedPieceId, pos);
            setLastMove({ from: piece.position!, to: pos });
            const last = newState.moveHistory[newState.moveHistory.length - 1];
            if (last?.challenge) { setChallengeAnim(pos); sounds?.capture(); setTimeout(() => setChallengeAnim(null), 600); }
            else sounds?.move();
            setGameState(newState);
            setSelectedPieceId(null);
            setValidMoves([]);
            if (newState.phase === GamePhase.GameOver) { newState.winner === playerSide ? sounds?.victory() : sounds?.defeat(); }
          } catch { setSelectedPieceId(null); setValidMoves([]); }
        }
      } else if (clickedPiece && clickedPiece.owner === playerSide) {
        setSelectedPieceId(clickedPiece.id);
        setValidMoves(getValidMoves(clickedPiece, gameState.pieces));
        sounds?.select();
      } else { setSelectedPieceId(null); setValidMoves([]); }
    } else if (clickedPiece && clickedPiece.owner === playerSide) {
      setSelectedPieceId(clickedPiece.id);
      setValidMoves(getValidMoves(clickedPiece, gameState.pieces));
      sounds?.select();
    }
  }, [gameState, selectedPieceId, validMoves, playerSide, sounds, mode]);

  const handleSquareClick = useCallback((row: number, col: number) => {
    if (gameState.phase === GamePhase.Setup) handleSetupSquareClick(row, col);
    else if (gameState.phase === GamePhase.Playing) handlePlaySquareClick(row, col);
  }, [gameState.phase, handleSetupSquareClick, handlePlaySquareClick]);

  const handleNewGame = useCallback(() => {
    disconnectSocket();
    setGameState(createInitialGameState());
    setMode('menu');
    setSelectedPieceId(null);
    setValidMoves([]);
    setLastMove(null);
    setChallengeAnim(null);
    setSetupPieceId(null);
    setRevealAll(false);
    setShowGameOverModal(false);
    setOnlineError('');
    setEloChange(0);
  }, []);

  // ── Square background ──
  function getSquareBg(row: number, col: number): string {
    if (challengeAnim && challengeAnim.row === row && challengeAnim.col === col) return `${theme.challengeSquare} animate-swords`;
    if (selectedPieceId) {
      const p = gameState.pieces.find((p) => p.id === selectedPieceId);
      if (p?.position?.row === row && p?.position?.col === col) return theme.selectedSquare;
    }
    if (validMoves.some((m) => m.row === row && m.col === col)) return theme.validMoveSquare;
    if (lastMove && ((lastMove.from.row === row && lastMove.from.col === col) || (lastMove.to.row === row && lastMove.to.col === col))) return theme.lastMoveSquare;
    return (row + col) % 2 === 0 ? theme.lightSquare : theme.darkSquare;
  }

  // ── Render piece with icon cropping (background-image approach) ──
  function renderPiece(piece: Piece, size: 'normal' | 'small' | 'tray' = 'normal', revealDelay?: number) {
    const isOwn = piece.owner === playerSide;
    const bg = isOwn ? theme.whitePieceBg : theme.blackPieceBg;
    const text = isOwn ? theme.whitePieceText : theme.blackPieceText;
    const border = isOwn ? theme.whitePieceBorder : theme.blackPieceBorder;
    const isSelected = piece.id === selectedPieceId || piece.id === setupPieceId;
    const canSee = isOwn || revealAll;
    const isRevealing = revealAll && !isOwn;
    const sideClass = isOwn ? 'side-white' : 'side-black';

    let sizeClass = 'piece';
    let iconH = 22;
    if (size === 'small') { sizeClass = 'piece-sm'; iconH = 16; }
    else if (size === 'tray') { sizeClass = 'piece-sm'; iconH = 18; }

    return (
      <div
        className={`${sizeClass} ${bg} ${border} border rounded-sm flex items-center justify-center overflow-hidden ${isSelected ? 'piece-selected ring-2 ring-[#c8a951]' : ''} ${isRevealing ? 'animate-piece-reveal' : 'transition-all duration-150'} select-none`}
        style={isRevealing && revealDelay != null ? { animationDelay: `${revealDelay}ms` } : undefined}
        title={canSee ? RANK_DISPLAY_NAME[piece.rank] : undefined}
      >
        {canSee ? (
          <div
            className={`piece-icon ${sideClass}`}
            style={{ width: '90%', height: '90%', backgroundImage: `url(${RANK_ICON[piece.rank]})` }}
            role="img"
            aria-label={RANK_DISPLAY_NAME[piece.rank]}
          />
        ) : (
          <span className={`${text} text-[10px] font-bold opacity-60`}>?</span>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════
  //  Board renderer (shared setup & play)
  // ═══════════════════════════════════════
  function renderBoard(isSetup: boolean) {
    const colLabels = playerSide === Player.White ? COLUMN_LABELS : [...COLUMN_LABELS].reverse();

    return (
      <div className={`${theme.boardBorder} border-2 rounded-lg overflow-hidden shadow-2xl relative`}>
        {/* Board overlay pattern */}
        {theme.boardOverlayStyle && <div className={`absolute inset-0 pointer-events-none z-10 ${theme.boardOverlayOpacity ?? 'opacity-[0.25]'}`} style={theme.boardOverlayStyle} />}
        {/* Top column labels */}
        <div className="flex">
          <div className="label-corner" />
          {colLabels.map((l) => (
            <div key={l} className={`label-cell-top flex items-center justify-center ${theme.labelColor} text-[10px] sm:text-xs md:text-sm font-mono`} style={{ width: 'var(--sq-size)' }}>{l}</div>
          ))}
        </div>
        {Array.from({ length: BOARD_ROWS }).map((_, vr) => {
          const lr = logicalRowFromVisual(vr, playerSide);
          return (
            <div key={vr} className="flex">
              <div className={`label-cell flex items-center justify-center ${theme.labelColor} text-[10px] sm:text-xs md:text-sm font-mono`}>{lr + 1}</div>
              {Array.from({ length: BOARD_COLS }).map((_, vc) => {
                const lc = playerSide === Player.White ? vc : BOARD_COLS - 1 - vc;
                const piece = getPieceAtPosition(gameState.pieces, { row: lr, col: lc });
                const bg = getSquareBg(lr, lc);
                const inZone = isInSetupZone({ row: lr, col: lc }, playerSide);
                const isValid = validMoves.some((m) => m.row === lr && m.col === lc);
                let zoneClass = '';
                if (isSetup && inZone && !piece) zoneClass = 'setup-zone setup-zone-empty';
                else if (isSetup && inZone) zoneClass = 'setup-zone';

                return (
                  <div
                    key={vc}
                    onClick={() => handleSquareClick(lr, lc)}
                    onDragOver={isSetup && inZone ? handleDragOver : undefined}
                    onDrop={isSetup && inZone ? (e) => handleDrop(e, lr, lc) : undefined}
                    className={`sq ${bg} ${zoneClass} sq-hover flex items-center justify-center relative cursor-pointer`}
                  >
                    {piece && (
                      <div
                        className={piece.id === selectedPieceId ? 'animate-bounce-in' : ''}
                        draggable={isSetup && piece.owner === playerSide}
                        onDragStart={isSetup && piece.owner === playerSide ? (e) => handleDragStart(e, piece.id) : undefined}
                      >
                        {renderPiece(piece, 'normal', piece.position ? (piece.position.row * BOARD_COLS + piece.position.col) * 40 : 0)}
                      </div>
                    )}
                    {!isSetup && isValid && !piece && <div className={`w-3 h-3 rounded-full ${theme.validMoveDot}`} />}
                    {!isSetup && isValid && piece && <div className="absolute inset-1 border-2 border-red-500/50 rounded-sm pointer-events-none" />}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  }

  // ═══════════════════════════════════════
  //  MENU SCREEN
  // ═══════════════════════════════════════
  if (mode === 'menu') {
    return (
      <div className="min-h-screen bg-[#080c14] flex flex-col">
        {/* Subtle background pattern */}
        <div className="fixed inset-0 opacity-[0.03] pointer-events-none" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />

        {/* Header */}
        <header className="relative border-b border-[#111b2e]">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/" className="text-[#8a9ab5] hover:text-[#c8a951] transition-colors text-sm font-medium flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Home
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/leaderboard" className="text-[#8a9ab5] hover:text-[#c8a951] transition-colors text-sm font-medium">
                Leaderboard
              </Link>
              {user ? (
                <Link href="/profile" className="text-[#8a9ab5] hover:text-[#c8a951] transition-colors text-sm font-medium">
                  Profile
                </Link>
              ) : (
                <Link href="/login" className="text-[#8a9ab5] hover:text-[#c8a951] transition-colors text-sm font-medium">
                  Sign In
                </Link>
              )}
              <Link href="/rules" className="text-[#8a9ab5] hover:text-[#c8a951] transition-colors text-sm font-medium">
                Rules
              </Link>
            </div>
          </div>
        </header>

        <main className="relative flex-1 flex items-center justify-center px-4 py-12">
          <div className="max-w-lg w-full animate-fade-in-up">
            {/* Title area */}
            <div className="text-center mb-10">
              <div className="flex items-center justify-center gap-4 mb-4">
                <div className="h-px w-12 bg-gradient-to-r from-transparent to-[#c8a951]/60" />
                <span className="text-[#c8a951]/80 text-xs tracking-[0.3em] uppercase font-medium">Select Mode</span>
                <div className="h-px w-12 bg-gradient-to-l from-transparent to-[#c8a951]/60" />
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-white font-display mb-2">Choose Your <span className="text-[#c8a951]">Battle</span></h2>
              <p className="text-[#6b7e9a] text-sm">How would you like to play?</p>
            </div>

            {/* Mode cards */}
            <div className="space-y-4 mb-8">
              <button onClick={startVsAI} className="w-full bg-[#0d1520]/80 border border-[#1a2744] rounded-xl p-5 text-left hover:border-[#c8a951]/50 hover:shadow-lg hover:shadow-[#c8a951]/5 group transition-all hover-lift">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-[#c8a951] to-[#a88a3d] rounded-lg flex items-center justify-center text-[#0a0f1a] text-xl shadow-lg shadow-[#c8a951]/20 group-hover:shadow-[#c8a951]/40 transition-shadow">
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L11 6.477V16h2a1 1 0 110 2H7a1 1 0 110-2h2V6.477L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L9 4.323V3a1 1 0 011-1z" /></svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-white font-bold text-lg group-hover:text-[#c8a951] transition-colors">vs Computer</h3>
                    <p className="text-[#6b7e9a] text-sm">Practice against the AI opponent</p>
                  </div>
                  <svg className="w-5 h-5 text-[#2a3a5c] group-hover:text-[#c8a951] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </div>
              </button>

              {user ? (
                <>
                  {/* Ranked */}
                  <div className="w-full bg-[#0d1520]/80 border border-[#1a2744] rounded-xl p-5">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-lg flex items-center justify-center text-white text-xl shadow-lg">
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-white font-bold text-lg">Ranked Match</h3>
                        <p className="text-[#6b7e9a] text-sm">Find opponent &bull; ELO rated &bull; {profile?.elo ?? 1200} rating</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {(['30s', '1m', '2m'] as TimerMode[]).map(tm => (
                        <button key={tm} onClick={() => joinRankedQueue(tm)} className="px-3 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-bold transition-all hover-lift">
                          {TIMER_LABELS[tm]}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Custom Lobby */}
                  <div className="w-full bg-[#0d1520]/80 border border-[#1a2744] rounded-xl p-5">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-700 rounded-lg flex items-center justify-center text-white text-xl shadow-lg">
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" /></svg>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-white font-bold text-lg">Custom Game</h3>
                        <p className="text-[#6b7e9a] text-sm">Create or join with a lobby code</p>
                      </div>
                    </div>
                    <div className="flex gap-2 mb-3">
                      {(['none', '30s', '1m', '2m'] as TimerMode[]).map(tm => (
                        <button key={tm} onClick={() => setTimerMode(tm)} className={`px-2 py-1.5 rounded text-xs font-medium transition-all ${timerMode === tm ? 'bg-purple-600 text-white' : 'bg-[#111b2e] text-[#8a9ab5] border border-[#1e2d4a]'}`}>
                          {tm === 'none' ? 'No Timer' : tm}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => createLobby(timerMode)} className="flex-1 px-3 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-bold transition-all">
                        Create Lobby
                      </button>
                      <button onClick={() => setMode('custom-join')} className="flex-1 px-3 py-2.5 bg-[#111b2e] border border-[#1e2d4a] text-[#8a9ab5] hover:text-white hover:border-purple-500/50 rounded-lg text-sm font-bold transition-all">
                        Join Code
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <Link href="/login" className="w-full bg-[#0d1520]/80 border border-[#1a2744] rounded-xl p-5 text-left hover:border-[#c8a951]/50 hover:shadow-lg group transition-all hover-lift block">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-lg flex items-center justify-center text-white text-xl shadow-lg">
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-white font-bold text-lg group-hover:text-[#c8a951] transition-colors">Online Multiplayer</h3>
                      <p className="text-[#6b7e9a] text-sm">Sign in to play ranked &amp; custom games</p>
                    </div>
                    <svg className="w-5 h-5 text-[#2a3a5c] group-hover:text-[#c8a951] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </div>
                </Link>
              )}
            </div>

            {/* Settings section */}
            <div className="space-y-3">
              <div className="bg-[#0d1520]/60 border border-[#1a2744] rounded-xl p-5">
                <p className="text-[#c8a951]/80 text-[10px] tracking-[0.2em] uppercase font-medium mb-4">Board Theme</p>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(THEMES) as ThemeId[]).map((tid) => (
                    <button
                      key={tid}
                      onClick={() => { setPreviewThemeId(tid); sounds?.click(); }}
                      className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all text-center ${
                        tid === themeId
                          ? 'bg-[#c8a951] text-[#0a0f1a] shadow-lg shadow-[#c8a951]/20'
                          : 'bg-[#111b2e] text-[#8a9ab5] border border-[#1e2d4a] hover:border-[#c8a951]/40 hover:text-[#c8a951]'
                      }`}
                    >
                      {THEMES[tid].name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-[#0d1520]/60 border border-[#1a2744] rounded-xl px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-lg">🔊</span>
                  <span className="text-white text-sm font-medium">Sound Effects</span>
                </div>
                <Toggle on={soundEnabled} onToggle={() => { setSoundEnabled(!soundEnabled); sounds?.click(); }} />
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="relative text-center py-6 border-t border-[#111b2e]">
          <p className="text-[#2a3a5c] text-sm">Game of the Generals — Salpakan</p>
        </footer>

        {/* Theme preview modal */}
        {previewThemeId && (
          <ThemePreviewModal
            themeId={previewThemeId}
            activeThemeId={themeId}
            onSelect={(id) => { setThemeId(id); sounds?.click(); }}
            onClose={() => setPreviewThemeId(null)}
          />
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════
  //  QUEUE SCREEN
  // ═══════════════════════════════════════
  if (mode === 'queue') {
    return (
      <div className="min-h-screen bg-[#080c14] flex flex-col">
        <header className="relative border-b border-[#111b2e]">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <button onClick={leaveQueue} className="text-[#8a9ab5] hover:text-[#c8a951] transition-colors text-sm font-medium flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Cancel
            </button>
            <span className="text-[#8a9ab5] text-sm">Ranked &bull; {TIMER_LABELS[timerMode]}</span>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center animate-fade-in-up">
            {/* Animated spinner */}
            <div className="relative w-24 h-24 mx-auto mb-8">
              <div className="absolute inset-0 rounded-full border-2 border-[#1a2744]" />
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-emerald-500 animate-spin" />
              <div className="absolute inset-3 rounded-full border-2 border-transparent border-b-[#c8a951] animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl">⚔️</span>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Finding Opponent…</h2>
            <p className="text-[#6b7e9a] text-sm mb-6">
              {queuePlayers > 0 ? `${queuePlayers} player${queuePlayers > 1 ? 's' : ''} in queue` : 'Searching for players…'}
            </p>
            <div className="inline-flex items-center gap-2 bg-[#0d1520] border border-[#1a2744] rounded-full px-4 py-2 mb-8">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-white text-lg font-mono">{Math.floor(queueTime / 60).toString().padStart(2, '0')}:{(queueTime % 60).toString().padStart(2, '0')}</span>
            </div>
            {onlineError && <p className="text-red-400 text-sm mb-4">{onlineError}</p>}
            <div>
              <button onClick={leaveQueue} className="px-8 py-3 bg-red-600/20 hover:bg-red-600/40 border border-red-500/30 text-red-400 rounded-xl text-sm font-bold transition-all">
                Cancel Search
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ═══════════════════════════════════════
  //  CUSTOM LOBBY (waiting for opponent)
  // ═══════════════════════════════════════
  if (mode === 'custom-lobby') {
    return (
      <div className="min-h-screen bg-[#080c14] flex flex-col">
        <header className="relative border-b border-[#111b2e]">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <button onClick={() => { disconnectSocket(); setMode('menu'); }} className="text-[#8a9ab5] hover:text-[#c8a951] transition-colors text-sm font-medium flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Cancel
            </button>
            <span className="text-[#8a9ab5] text-sm">Custom &bull; {timerMode === 'none' ? 'No Timer' : timerMode}</span>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center animate-fade-in-up max-w-sm w-full">
            <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-purple-500 to-purple-700 rounded-2xl flex items-center justify-center text-white text-3xl shadow-lg">
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" /></svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Lobby Created</h2>
            <p className="text-[#6b7e9a] text-sm mb-6">Share this code with your opponent</p>
            {lobbyCode ? (
              <div className="bg-[#0d1520] border border-[#1a2744] rounded-xl p-6 mb-6">
                <p className="text-[#6b7e9a] text-xs uppercase tracking-wider mb-2">Lobby Code</p>
                <div className="text-4xl font-mono font-bold text-[#c8a951] tracking-[0.3em] mb-4">{lobbyCode}</div>
                <button
                  onClick={() => { navigator.clipboard.writeText(lobbyCode); }}
                  className="px-4 py-2 bg-[#111b2e] border border-[#1e2d4a] text-[#8a9ab5] hover:text-white rounded-lg text-sm transition-all"
                >
                  Copy Code
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 mb-6">
                <div className="w-4 h-4 rounded-full border-2 border-transparent border-t-purple-500 animate-spin" />
                <span className="text-[#6b7e9a] text-sm">Generating code…</span>
              </div>
            )}
            <div className="flex items-center justify-center gap-2 text-[#6b7e9a] text-sm">
              <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
              Waiting for opponent to join…
            </div>
            {onlineError && <p className="text-red-400 text-sm mt-4">{onlineError}</p>}
          </div>
        </main>
      </div>
    );
  }

  // ═══════════════════════════════════════
  //  CUSTOM JOIN (enter code)
  // ═══════════════════════════════════════
  if (mode === 'custom-join') {
    return (
      <div className="min-h-screen bg-[#080c14] flex flex-col">
        <header className="relative border-b border-[#111b2e]">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <button onClick={() => { disconnectSocket(); setMode('menu'); }} className="text-[#8a9ab5] hover:text-[#c8a951] transition-colors text-sm font-medium flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back
            </button>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center animate-fade-in-up max-w-sm w-full">
            <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-purple-500 to-purple-700 rounded-2xl flex items-center justify-center text-white text-3xl shadow-lg">
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 005.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 01-2.828-2.828l3-3z" clipRule="evenodd" /></svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Join Game</h2>
            <p className="text-[#6b7e9a] text-sm mb-6">Enter the lobby code from your opponent</p>
            <div className="bg-[#0d1520] border border-[#1a2744] rounded-xl p-6 mb-4">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                placeholder="ENTER CODE"
                maxLength={6}
                className="w-full bg-transparent text-center text-3xl font-mono font-bold text-white tracking-[0.3em] placeholder:text-[#2a3a5c] outline-none border-b-2 border-[#1a2744] focus:border-purple-500 pb-2 transition-colors"
              />
            </div>
            <button
              onClick={joinLobby}
              disabled={joinCode.length < 6}
              className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${joinCode.length >= 6 ? 'bg-purple-600 hover:bg-purple-500 text-white' : 'bg-[#111b2e] text-[#4a5a72] cursor-not-allowed'}`}
            >
              Join Game
            </button>
            {onlineError && <p className="text-red-400 text-sm mt-4">{onlineError}</p>}
          </div>
        </main>
      </div>
    );
  }

  // ═══════════════════════════════════════
  //  SETUP
  // ═══════════════════════════════════════
  if (gameState.phase === GamePhase.Setup) {
    const placedCount = gameState.pieces.filter((p) => p.owner === playerSide && p.position !== null).length;
    const unplacedPieces = gameState.pieces.filter((p) => p.owner === playerSide && p.position === null);
    const setupReady = isSetupComplete(gameState.pieces, playerSide);

    return (
      <div className={`min-h-screen ${theme.pageBg} flex flex-col`}>
        {theme.pageOverlayStyle && <div className={`fixed inset-0 pointer-events-none ${theme.pageOverlayOpacity ?? 'opacity-[0.06]'}`} style={theme.pageOverlayStyle} />}
        <Header theme={theme} onBack={handleNewGame} />
        <div className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-4 lg:gap-6 px-2 py-4">
          <div className="animate-fade-in">{renderBoard(true)}</div>
          <div className={`${theme.panelBg} ${theme.panelBorder} border rounded-xl p-4 w-full max-w-xs animate-slide-right`}>
            <h3 className={`${theme.headerColor} font-bold text-base mb-1`}>Deploy Your Forces</h3>
            {mode === 'online' && setupTimeLeft > 0 && (
              <div className={`flex items-center gap-2 mb-2 px-2 py-1 rounded-lg ${setupTimeLeft <= 30 ? 'bg-red-900/30 border border-red-700/50' : 'bg-[#111b2e] border border-[#1a2744]'}`}>
                <svg className="w-4 h-4 text-[#c8a951]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span className={`text-sm font-mono font-bold ${setupTimeLeft <= 30 ? 'text-red-400 animate-pulse' : 'text-[#c8a951]'}`}>
                  {Math.floor(setupTimeLeft / 60)}:{(setupTimeLeft % 60).toString().padStart(2, '0')}
                </span>
                <span className="text-[#6b7e9a] text-xs">to deploy</span>
              </div>
            )}
            <p className={`${theme.panelTextMuted} text-xs mb-1`}>Click or drag pieces into the highlighted zone (bottom 3 rows).</p>
            <p className={`${theme.panelTextMuted} text-xs mb-3`}><span className={`${theme.headerColor} font-bold`}>{placedCount}</span> / 21 placed</p>
            {unplacedPieces.length > 0 && (
              <div className="mb-4">
                <p className={`${theme.panelTextMuted} text-[10px] uppercase tracking-wider mb-2`}>Unplaced ({unplacedPieces.length})</p>
                <div className="flex flex-wrap gap-1">
                  {unplacedPieces.map((p) => (
                    <div key={p.id} draggable onDragStart={(e) => handleDragStart(e, p.id)} onClick={() => handleTrayPieceClick(p.id)} className="cursor-grab active:cursor-grabbing">
                      {renderPiece(p, 'tray')}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-2 mt-4">
              <button onClick={handleAutoSetup} className={`w-full ${theme.accentPrimary} text-white py-2 rounded-lg text-sm font-bold hover:brightness-110 transition-all`}>Auto Deploy</button>
              <button onClick={handleConfirmSetup} disabled={!setupReady} className={`w-full py-2 rounded-lg text-sm font-bold transition-all ${setupReady ? `${theme.accentSuccess} text-white hover:brightness-110` : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}>
                {setupReady ? 'Confirm & Start' : `Place ${21 - placedCount} more`}
              </button>
            </div>
          </div>
        </div>
        <Foot theme={theme} />
      </div>
    );
  }

  // ═══════════════════════════════════════
  //  PLAYING / GAME OVER
  // ═══════════════════════════════════════
  const isMyTurn = gameState.currentPlayer === playerSide;
  const myEliminated = gameState.eliminatedPieces[playerSide === Player.White ? 'white' : 'black'];
  const oppEliminated = gameState.eliminatedPieces[playerSide === Player.White ? 'black' : 'white'];

  return (
    <div className={`min-h-screen ${theme.pageBg} flex flex-col`}>
      {theme.pageOverlayStyle && <div className={`fixed inset-0 pointer-events-none ${theme.pageOverlayOpacity ?? 'opacity-[0.06]'}`} style={theme.pageOverlayStyle} />}
      <Header theme={theme} onBack={handleNewGame} showSettings={() => setShowSettings(!showSettings)} />
      {showSettings && (
        <div className={`${theme.panelBg} ${theme.panelBorder} border mx-auto w-72 rounded-xl p-4 animate-slide-down mb-2`}>
          <p className={`${theme.panelTextMuted} text-xs uppercase tracking-wider mb-3`}>Settings</p>
          <div className="space-y-3">
            <div>
              <p className={`${theme.panelTextMuted} text-[10px] uppercase mb-1`}>Theme</p>
              <div className="flex gap-1.5 flex-wrap">
                {(Object.keys(THEMES) as ThemeId[]).map((tid) => (
                  <button key={tid} onClick={() => { setThemeId(tid); sounds?.click(); }} className={`px-2 py-1 rounded text-xs font-medium ${tid === themeId ? `${theme.accentPrimary} text-white` : `${theme.panelBorder} border ${theme.panelText}`}`}>{THEMES[tid].name}</button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className={`${theme.panelText} text-sm`}>Sound</span>
              <Toggle on={soundEnabled} onToggle={() => { setSoundEnabled(!soundEnabled); sounds?.click(); }} />
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col xl:flex-row items-center xl:items-start justify-center gap-3 xl:gap-4 px-2 py-3">
        {/* Left panel: opponent eliminated */}
        <div className={`${theme.panelBg} ${theme.panelBorder} border rounded-xl p-3 w-48 hidden xl:block`}>
          <PanelLabel theme={theme}>Opponent Losses ({oppEliminated.length})</PanelLabel>
          {oppEliminated.length === 0 ? <p className={`${theme.panelTextMuted} text-xs italic`}>None yet</p> : (
            <div className="flex flex-wrap gap-1">{oppEliminated.map((p) => <div key={p.id} title="?">{renderPiece(p, 'small')}</div>)}</div>
          )}
        </div>

        {/* Center board */}
        <div className="flex flex-col items-center gap-1.5 animate-fade-in">
          {/* Opponent info + timer (above board) */}
          {mode === 'online' && (
            <div className="flex items-center justify-between w-full max-w-md px-1 mb-1">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-red-600/20 flex items-center justify-center text-xs font-bold text-red-400">{opponentName?.[0]?.toUpperCase() ?? '?'}</div>
                <div>
                  <span className="text-white text-sm font-medium">{opponentName || 'Opponent'}</span>
                  {opponentElo > 0 && <span className="text-[#6b7e9a] text-xs ml-1.5">({opponentElo})</span>}
                </div>
              </div>
              {onlineTimerMode !== 'none' && (
                <TimerDisplay seconds={playerSide === Player.White ? onlineTimerBlack : onlineTimerWhite} isActive={!isMyTurn && gameState.phase === GamePhase.Playing} danger={false} />
              )}
            </div>
          )}
          {gameState.phase === GamePhase.Playing && (
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${isMyTurn ? `${theme.accentPrimary} text-white` : `${theme.panelBg} ${theme.panelBorder} border ${theme.panelTextMuted}`}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isMyTurn ? 'bg-white' : 'bg-gray-500'} animate-pulse`} />
              {isMyTurn ? 'Your Turn' : 'Opponent Thinking…'}
            </div>
          )}
          {revealAll && !showGameOverModal && (
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold bg-[#c8a951] text-[#0a0f1a] shadow-lg shadow-[#c8a951]/30 animate-pulse-glow">
              ⚔️ Revealing Enemy Forces…
            </div>
          )}
          <div className="flex items-center gap-1 text-[10px] animate-arbiter-glow"><span>⚖️</span><span className={theme.panelTextMuted}>Arbiter</span></div>
          {renderBoard(false)}
          <p className={`${theme.panelTextMuted} text-[10px]`}>Turn {Math.ceil(gameState.turnCount / 2) + 1}</p>
          {/* Player info + timer (below board) */}
          {mode === 'online' && (
            <div className="flex items-center justify-between w-full max-w-md px-1 mt-1">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-emerald-600/20 flex items-center justify-center text-xs font-bold text-emerald-400">{profile?.username?.[0]?.toUpperCase() ?? 'Y'}</div>
                <div>
                  <span className="text-white text-sm font-medium">{profile?.username || 'You'}</span>
                  {profile?.elo && <span className="text-[#6b7e9a] text-xs ml-1.5">({profile.elo})</span>}
                </div>
              </div>
              {onlineTimerMode !== 'none' && (
                <TimerDisplay seconds={playerSide === Player.White ? onlineTimerWhite : onlineTimerBlack} isActive={isMyTurn && gameState.phase === GamePhase.Playing} danger={true} />
              )}
            </div>
          )}
        </div>

        {/* Right panel: your losses + move history */}
        <div className={`${theme.panelBg} ${theme.panelBorder} border rounded-xl p-3 w-52 hidden xl:block`}>
          <PanelLabel theme={theme}>Your Losses ({myEliminated.length})</PanelLabel>
          {myEliminated.length === 0 ? <p className={`${theme.panelTextMuted} text-xs italic mb-3`}>None yet</p> : (
            <div className="flex flex-wrap gap-1 mb-3">{myEliminated.map((p) => <div key={p.id} title={RANK_DISPLAY_NAME[p.rank]}>{renderPiece(p, 'small')}</div>)}</div>
          )}
          <PanelLabel theme={theme}>Move History</PanelLabel>
          <MoveHistoryList moves={gameState.moveHistory} theme={theme} playerSide={playerSide} />
        </div>

        {/* Mobile collapsible panels */}
        <div className="xl:hidden w-full max-w-md px-2 space-y-2">
          <Collapsible title={`Losses — You: ${myEliminated.length}  Opp: ${oppEliminated.length}`} theme={theme}>
            <div className="flex flex-wrap gap-1">
              {myEliminated.map((p) => <div key={p.id} title={RANK_DISPLAY_NAME[p.rank]}>{renderPiece(p, 'small')}</div>)}
              {oppEliminated.map((p) => <div key={p.id} title="?">{renderPiece(p, 'small')}</div>)}
              {myEliminated.length === 0 && oppEliminated.length === 0 && <p className={`${theme.panelTextMuted} text-xs italic`}>No losses yet</p>}
            </div>
          </Collapsible>
          <Collapsible title={`Move History (${gameState.moveHistory.length})`} theme={theme}>
            <MoveHistoryList moves={gameState.moveHistory} theme={theme} playerSide={playerSide} />
          </Collapsible>
        </div>
      </div>

      {/* Game over overlay — delayed 5 s to let reveal animation play */}
      {gameState.phase === GamePhase.GameOver && showGameOverModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-fade-in">
          <div className={`${theme.panelBg} ${theme.panelBorder} border rounded-2xl p-8 max-w-sm w-full mx-4 text-center animate-bounce-in`}>
            <div className="text-5xl mb-4">{gameState.winner === playerSide ? '🏆' : '💀'}</div>
            <h2 className={`text-2xl font-bold mb-2 ${gameState.winner === playerSide ? 'text-[#c8a951]' : 'text-red-400'}`}>{gameState.winner === playerSide ? 'Victory!' : 'Defeat'}</h2>
            <p className={`${theme.panelTextMuted} text-sm mb-2`}>{gameState.winReason}</p>
            {mode === 'online' && eloChange !== 0 && (
              <p className={`text-sm font-bold mb-4 ${eloChange > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                ELO: {eloChange > 0 ? '+' : ''}{eloChange}
              </p>
            )}
            {mode === 'online' && opponentName && (
              <p className={`${theme.panelTextMuted} text-xs mb-4`}>vs {opponentName} ({opponentElo})</p>
            )}
            <div className="space-y-2">
              {mode === 'online' ? (
                <button onClick={handleNewGame} className={`w-full ${theme.accentPrimary} text-white py-3 rounded-xl font-bold hover:brightness-110 transition-all`}>Back to Menu</button>
              ) : (
                <>
                  <button onClick={startVsAI} className={`w-full ${theme.accentPrimary} text-white py-3 rounded-xl font-bold hover:brightness-110 transition-all`}>Play Again</button>
                  <button onClick={handleNewGame} className={`w-full ${theme.panelBorder} border ${theme.panelText} py-3 rounded-xl font-medium hover:brightness-125 transition-all`}>Main Menu</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      <Foot theme={theme} />
    </div>
  );
}

// ─── Small sub-components ───

function TimerDisplay({ seconds, isActive, danger }: { seconds: number; isActive: boolean; danger: boolean }) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const low = danger && seconds <= 10 && isActive;
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-sm font-bold transition-all ${
      low ? 'bg-red-600/30 text-red-400 animate-pulse border border-red-500/40' :
      isActive ? 'bg-[#0d1520] border border-[#1a2744] text-white' :
      'bg-[#0d1520]/50 border border-[#111b2e] text-[#6b7e9a]'
    }`}>
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      {mins}:{secs.toString().padStart(2, '0')}
    </div>
  );
}

function Header({ theme, onBack, showSettings }: { theme: BoardTheme; onBack?: () => void; showSettings?: () => void }) {
  return (
    <header className={`border-b ${theme.panelBorder} px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between`}>
      <div className="flex items-center gap-4">
        {onBack ? (
          <button onClick={onBack} className={`${theme.panelTextMuted} hover:text-[#c8a951] transition-colors text-sm sm:text-base font-medium flex items-center gap-1.5`}><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>Menu</button>
        ) : (
          <Link href="/" className={`${theme.panelTextMuted} hover:text-[#c8a951] transition-colors text-sm sm:text-base font-medium flex items-center gap-1.5`}><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>Home</Link>
        )}
        <h1 className={`${theme.headerColor} font-display text-base sm:text-lg md:text-xl`}>Game of the Generals</h1>
      </div>
      <div className="flex items-center gap-3">
        {showSettings && (
          <button onClick={showSettings} className={`${theme.panelTextMuted} hover:text-[#c8a951] transition-colors p-1.5 rounded-lg`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          </button>
        )}
        <Link href="/rules" className={`${theme.panelTextMuted} hover:text-[#c8a951] transition-colors text-sm sm:text-base font-medium`}>Rules</Link>
      </div>
    </header>
  );
}

function Foot({ theme }: { theme: BoardTheme }) {
  return (
    <footer className={`border-t ${theme.panelBorder} px-4 sm:px-6 py-2.5 sm:py-3 text-center`}>
      <p className={`${theme.panelTextMuted} text-xs sm:text-sm font-medium tracking-wide`}>Game of the Generals — Salpakan</p>
    </footer>
  );
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className={`w-10 h-6 rounded-full transition-colors relative ${on ? 'bg-[#c8a951]' : 'bg-gray-600'}`}>
      <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${on ? 'left-5' : 'left-1'}`} />
    </button>
  );
}

function PanelLabel({ children, theme }: { children: React.ReactNode; theme: BoardTheme }) {
  return <p className={`${theme.panelTextMuted} text-[10px] uppercase tracking-wider mb-1.5 font-medium`}>{children}</p>;
}

function Collapsible({ title, theme, children }: { title: string; theme: BoardTheme; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`${theme.panelBg} ${theme.panelBorder} border rounded-lg overflow-hidden`}>
      <button onClick={() => setOpen(!open)} className={`w-full flex items-center justify-between px-3 py-2 ${theme.panelText} text-xs font-medium`}>
        {title}
        <svg className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
      </button>
      {open && <div className="px-3 pb-2">{children}</div>}
    </div>
  );
}

function MoveHistoryList({ moves, theme, playerSide }: { moves: GameState['moveHistory']; theme: BoardTheme; playerSide: Player }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [moves.length]);

  if (moves.length === 0) return <p className={`${theme.panelTextMuted} text-xs italic`}>No moves yet</p>;

  const posLabel = (pos: Position) => `${COLUMN_LABELS[pos.col]}${pos.row + 1}`;

  return (
    <div ref={ref} className="max-h-52 overflow-y-auto space-y-0.5 text-[11px]">
      {moves.map((m, i) => {
        // Determine who made this move: even index = first player's move (white), odd = second
        const movePlayerIsWhite = i % 2 === 0;
        const isPlayerMove = (movePlayerIsWhite && playerSide === Player.White) || (!movePlayerIsWhite && playerSide === Player.Black);
        const who = isPlayerMove ? 'You' : 'Opp';
        const hasChallenge = !!m.challenge;
        let suffix = '';
        if (hasChallenge) {
          const r = m.challenge!.result;
          if (r === 'attacker_wins' || r === 'flag_captured') suffix = ' ⚔️';
          else if (r === 'defender_wins') suffix = ' 🛡️';
          else suffix = ' 💥';
        }
        return (
          <div key={i} className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded ${hasChallenge ? 'bg-red-900/20' : ''} ${isPlayerMove ? theme.panelText : theme.panelTextMuted}`}>
            <span className="w-4 text-right opacity-40 flex-shrink-0">{i + 1}</span>
            <span className={`font-medium flex-shrink-0 ${isPlayerMove ? 'text-[#c8a951]' : ''}`}>{who}</span>
            <span className="truncate">{posLabel(m.from)}→{posLabel(m.to)}{suffix}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Theme board preview (static mini-board) ───
function ThemeBoardPreview({ t }: { t: BoardTheme }) {
  const COLS = 9;
  const ROWS = 8;
  const SQ = 40;
  const LABEL = 20;

  // Representative pieces: top rows = opponent (black), bottom rows = player (white)
  const blackPieces: [number, number][] = [
    [7,0],[7,2],[7,4],[7,6],[7,8],
    [6,1],[6,3],[6,5],[6,7],
    [5,0],[5,3],[5,6],
  ];
  const whitePieces: [number, number][] = [
    [0,0],[0,2],[0,4],[0,6],[0,8],
    [1,1],[1,3],[1,5],[1,7],
    [2,2],[2,4],[2,7],
  ];
  const pw = Math.round(SQ * 0.72);
  const ph = Math.round(SQ * 0.52);

  return (
    <div className={`${t.boardBorder} border-2 rounded-lg overflow-hidden relative inline-block shadow-2xl`}>
      {t.boardOverlayStyle && (
        <div className={`absolute inset-0 pointer-events-none z-10 ${t.boardOverlayOpacity ?? 'opacity-[0.25]'}`} style={t.boardOverlayStyle} />
      )}
      {/* Column labels */}
      <div style={{ display: 'flex' }}>
        <div style={{ width: LABEL, height: LABEL, flexShrink: 0 }} />
        {COLUMN_LABELS.map((l) => (
          <div key={l} style={{ width: SQ, height: LABEL, flexShrink: 0 }} className={`flex items-center justify-center ${t.labelColor} text-[10px] font-mono`}>{l}</div>
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: ROWS }).map((_, vr) => {
        const lr = ROWS - 1 - vr;
        return (
          <div key={vr} style={{ display: 'flex' }}>
            <div style={{ width: LABEL, height: SQ, flexShrink: 0 }} className={`flex items-center justify-center ${t.labelColor} text-[10px] font-mono`}>{lr + 1}</div>
            {Array.from({ length: COLS }).map((_, c) => {
              const bg = (lr + c) % 2 === 0 ? t.lightSquare : t.darkSquare;
              const isBlack = blackPieces.some(([r, col]) => r === lr && col === c);
              const isWhite = whitePieces.some(([r, col]) => r === lr && col === c);
              const inSetup = lr <= 2;
              return (
                <div
                  key={c}
                  style={{ width: SQ, height: SQ, flexShrink: 0 }}
                  className={`${bg} flex items-center justify-center ${inSetup ? 'ring-inset' : ''}`}
                >
                  {isBlack && <div className={`${t.blackPieceBg} ${t.blackPieceBorder} border rounded-sm`} style={{ width: pw, height: ph }} />}
                  {isWhite && <div className={`${t.whitePieceBg} ${t.whitePieceBorder} border rounded-sm`} style={{ width: pw, height: ph }} />}
                  {!isBlack && !isWhite && inSetup && (
                    <div className="w-1.5 h-1.5 rounded-full bg-[#c8a951]/20" />
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ─── Theme preview modal ───
function ThemePreviewModal({
  themeId,
  activeThemeId,
  onSelect,
  onClose,
}: {
  themeId: ThemeId;
  activeThemeId: ThemeId;
  onSelect: (id: ThemeId) => void;
  onClose: () => void;
}) {
  const t = THEMES[themeId];
  const isActive = themeId === activeThemeId;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in p-4"
      onClick={onClose}
    >
      <div
        className={`${t.panelBg} ${t.panelBorder} border rounded-2xl p-5 sm:p-6 w-full max-w-fit mx-auto shadow-2xl animate-bounce-in overflow-auto max-h-[92vh]`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4 gap-6">
          <div>
            <h3 className={`${t.headerColor} font-display text-xl`}>{t.name}</h3>
            <p className={`${t.panelTextMuted} text-xs mt-1`}>{t.description}</p>
          </div>
          <button onClick={onClose} className={`${t.panelTextMuted} hover:text-white transition-colors mt-0.5 flex-shrink-0`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Board preview */}
        <div className="mb-5 overflow-x-auto">
          <ThemeBoardPreview t={t} />
        </div>

        {/* Legend */}
        <div className={`flex items-center gap-4 mb-5 px-1 text-xs ${t.panelTextMuted}`}>
          <span className="flex items-center gap-1.5">
            <span className={`inline-block w-6 h-4 rounded-sm border ${t.blackPieceBg} ${t.blackPieceBorder}`} />
            Opponent
          </span>
          <span className="flex items-center gap-1.5">
            <span className={`inline-block w-6 h-4 rounded-sm border ${t.whitePieceBg} ${t.whitePieceBorder}`} />
            Your pieces
          </span>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => { onSelect(themeId); onClose(); }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
              isActive
                ? 'border-2 border-[#c8a951] text-[#c8a951] bg-[#c8a951]/10'
                : `${t.accentPrimary} text-white hover:brightness-110`
            }`}
          >
            {isActive ? '✓ Currently Selected' : 'Use This Theme'}
          </button>
          <button
            onClick={onClose}
            className={`px-5 py-2.5 rounded-xl text-sm ${t.panelBorder} border ${t.panelTextMuted} hover:brightness-125 transition-all`}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
