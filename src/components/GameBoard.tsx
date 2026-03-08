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

type GameMode = 'menu' | 'vs-ai' | 'online';

/* Flip board so the current player is always at the bottom */
function logicalRowFromVisual(visualRow: number, playerSide: Player): number {
  if (playerSide === Player.White) return BOARD_ROWS - 1 - visualRow;
  return visualRow;
}

export default function GameBoard() {
  const [mode, setMode] = useState<GameMode>('menu');
  const [gameState, setGameState] = useState<GameState>(createInitialGameState);
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [validMoves, setValidMoves] = useState<Position[]>([]);
  const [themeId, setThemeId] = useState<ThemeId>('vintage');
  const [playerSide] = useState<Player>(Player.White);
  const [lastMove, setLastMove] = useState<{ from: Position; to: Position } | null>(null);
  const [challengeAnim, setChallengeAnim] = useState<Position | null>(null);
  const [setupPieceId, setSetupPieceId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const aiThinking = useRef(false);

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

  const startVsAI = useCallback(() => {
    let state = createInitialGameState();
    state = { ...state, pieces: generateRandomSetup(state.pieces, Player.Black) };
    setGameState(state);
    setMode('vs-ai');
    setSelectedPieceId(null);
    setValidMoves([]);
    setLastMove(null);
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
    setGameState({ ...gameState, phase: GamePhase.Playing });
    setSetupPieceId(null);
    sounds?.click();
  }, [gameState, playerSide, sounds]);

  // ── Play click ──
  const handlePlaySquareClick = useCallback((row: number, col: number) => {
    if (gameState.phase !== GamePhase.Playing || gameState.currentPlayer !== playerSide) return;
    const pos = { row, col };
    const clickedPiece = getPieceAtPosition(gameState.pieces, pos);
    if (selectedPieceId) {
      if (validMoves.some((m) => m.row === row && m.col === col)) {
        try {
          const piece = gameState.pieces.find((p) => p.id === selectedPieceId)!;
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
  }, [gameState, selectedPieceId, validMoves, playerSide, sounds]);

  const handleSquareClick = useCallback((row: number, col: number) => {
    if (gameState.phase === GamePhase.Setup) handleSetupSquareClick(row, col);
    else if (gameState.phase === GamePhase.Playing) handlePlaySquareClick(row, col);
  }, [gameState.phase, handleSetupSquareClick, handlePlaySquareClick]);

  const handleNewGame = useCallback(() => {
    setGameState(createInitialGameState());
    setMode('menu');
    setSelectedPieceId(null);
    setValidMoves([]);
    setLastMove(null);
    setChallengeAnim(null);
    setSetupPieceId(null);
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
  function renderPiece(piece: Piece, size: 'normal' | 'small' | 'tray' = 'normal') {
    const isOwn = piece.owner === playerSide;
    const bg = isOwn ? theme.whitePieceBg : theme.blackPieceBg;
    const text = isOwn ? theme.whitePieceText : theme.blackPieceText;
    const border = isOwn ? theme.whitePieceBorder : theme.blackPieceBorder;
    const isSelected = piece.id === selectedPieceId || piece.id === setupPieceId;
    const canSee = isOwn;
    const sideClass = isOwn ? 'side-white' : 'side-black';

    let sizeClass = 'piece';
    let iconH = 22;
    if (size === 'small') { sizeClass = 'piece-sm'; iconH = 16; }
    else if (size === 'tray') { sizeClass = 'piece-sm'; iconH = 18; }

    return (
      <div
        className={`${sizeClass} ${bg} ${border} border rounded-sm flex items-center justify-center overflow-hidden ${isSelected ? 'piece-selected ring-2 ring-[#c8a951]' : ''} transition-all duration-150 select-none`}
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
      <div className={`${theme.boardBorder} border-2 rounded-lg overflow-hidden shadow-2xl`}>
        {/* Top column labels */}
        <div className="flex">
          <div className="label-cell" />
          {colLabels.map((l) => (
            <div key={l} className={`label-cell-top flex items-center justify-center ${theme.labelColor} text-[10px] font-mono`} style={{ width: 'var(--sq-size)' }}>{l}</div>
          ))}
        </div>
        {Array.from({ length: BOARD_ROWS }).map((_, vr) => {
          const lr = logicalRowFromVisual(vr, playerSide);
          return (
            <div key={vr} className="flex">
              <div className={`label-cell flex items-center justify-center ${theme.labelColor} text-[10px] font-mono`}>{lr + 1}</div>
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
                        {renderPiece(piece)}
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
            <Link href="/rules" className="text-[#8a9ab5] hover:text-[#c8a951] transition-colors text-sm font-medium">
              Rules
            </Link>
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

              <button disabled className="w-full bg-[#0d1520]/40 border border-[#141e32] rounded-xl p-5 text-left opacity-50 cursor-not-allowed">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#1a2744] rounded-lg flex items-center justify-center text-[#4a5a72] text-xl">
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[#8a9ab5] font-bold text-lg">Online Multiplayer</h3>
                    <p className="text-[#4a5a72] text-sm">Play against others — requires server</p>
                  </div>
                  <span className="text-[10px] tracking-wider uppercase text-[#4a5a72] bg-[#111b2e] px-2 py-1 rounded-full">Soon</span>
                </div>
              </button>
            </div>

            {/* Settings section */}
            <div className="space-y-3">
              <div className="bg-[#0d1520]/60 border border-[#1a2744] rounded-xl p-5">
                <p className="text-[#c8a951]/80 text-[10px] tracking-[0.2em] uppercase font-medium mb-4">Board Theme</p>
                <div className="flex gap-2 flex-wrap">
                  {(Object.keys(THEMES) as ThemeId[]).map((tid) => (
                    <button
                      key={tid}
                      onClick={() => { setThemeId(tid); sounds?.click(); }}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
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
        <Header theme={theme} onBack={handleNewGame} />
        <div className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-4 lg:gap-6 px-2 py-4">
          <div className="animate-fade-in">{renderBoard(true)}</div>
          <div className={`${theme.panelBg} ${theme.panelBorder} border rounded-xl p-4 w-full max-w-xs animate-slide-right`}>
            <h3 className={`${theme.headerColor} font-bold text-base mb-1`}>Deploy Your Forces</h3>
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
          {gameState.phase === GamePhase.Playing && (
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${isMyTurn ? `${theme.accentPrimary} text-white` : `${theme.panelBg} ${theme.panelBorder} border ${theme.panelTextMuted}`}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isMyTurn ? 'bg-white' : 'bg-gray-500'} animate-pulse`} />
              {isMyTurn ? 'Your Turn' : 'Opponent Thinking…'}
            </div>
          )}
          <div className="flex items-center gap-1 text-[10px] animate-arbiter-glow"><span>⚖️</span><span className={theme.panelTextMuted}>Arbiter</span></div>
          {renderBoard(false)}
          <p className={`${theme.panelTextMuted} text-[10px]`}>Turn {Math.ceil(gameState.turnCount / 2) + 1}</p>
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

      {/* Game over overlay */}
      {gameState.phase === GamePhase.GameOver && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-fade-in">
          <div className={`${theme.panelBg} ${theme.panelBorder} border rounded-2xl p-8 max-w-sm w-full mx-4 text-center animate-bounce-in`}>
            <div className="text-5xl mb-4">{gameState.winner === playerSide ? '🏆' : '💀'}</div>
            <h2 className={`text-2xl font-bold mb-2 ${gameState.winner === playerSide ? 'text-[#c8a951]' : 'text-red-400'}`}>{gameState.winner === playerSide ? 'Victory!' : 'Defeat'}</h2>
            <p className={`${theme.panelTextMuted} text-sm mb-6`}>{gameState.winReason}</p>
            <div className="space-y-2">
              <button onClick={startVsAI} className={`w-full ${theme.accentPrimary} text-white py-3 rounded-xl font-bold hover:brightness-110 transition-all`}>Play Again</button>
              <button onClick={handleNewGame} className={`w-full ${theme.panelBorder} border ${theme.panelText} py-3 rounded-xl font-medium hover:brightness-125 transition-all`}>Main Menu</button>
            </div>
          </div>
        </div>
      )}
      <Foot theme={theme} />
    </div>
  );
}

// ─── Small sub-components ───

function Header({ theme, onBack, showSettings }: { theme: BoardTheme; onBack?: () => void; showSettings?: () => void }) {
  return (
    <header className={`border-b ${theme.panelBorder} px-4 py-2 flex items-center justify-between`}>
      <div className="flex items-center gap-3">
        {onBack ? (
          <button onClick={onBack} className={`${theme.panelTextMuted} text-xs flex items-center gap-1`}><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>Menu</button>
        ) : (
          <Link href="/" className={`${theme.panelTextMuted} text-xs flex items-center gap-1`}><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>Home</Link>
        )}
        <h1 className={`${theme.headerColor} font-display text-sm md:text-base`}>Game of the Generals</h1>
      </div>
      <div className="flex items-center gap-2">
        {showSettings && (
          <button onClick={showSettings} className={`${theme.panelTextMuted} p-1 rounded-lg`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          </button>
        )}
        <Link href="/rules" className={`${theme.panelTextMuted} text-xs`}>Rules</Link>
      </div>
    </header>
  );
}

function Foot({ theme }: { theme: BoardTheme }) {
  return <footer className={`border-t ${theme.panelBorder} px-4 py-1.5 text-center`}><p className={`${theme.panelTextMuted} text-[10px]`}>Game of the Generals — Salpakan</p></footer>;
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
