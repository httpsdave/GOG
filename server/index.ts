import { createServer } from 'http';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { calculateEloChange } from './elo';
import { adminAuth, adminDb } from './firebase-admin';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  RoomState,
  ServerPlayer,
  MatchRequest,
  SerializedPiece,
  SerializedMove,
  ReplayData,
  TimerMode,
} from './types';
import { TIMER_DURATIONS } from './types';

const SETUP_DURATION = 120000; // 2 minutes for setup phase

const PORT = parseInt(process.env.PORT || '3001', 10);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

const httpServer = createServer();
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: ALLOWED_ORIGIN, methods: ['GET', 'POST'] },
});

// ─── In-memory stores ───
const rooms = new Map<string, RoomState>();
const matchQueues: Record<TimerMode, MatchRequest[]> = {
  'none': [],
  '30s': [],
  '1m': [],
  '2m': [],
};
const replays = new Map<string, ReplayData>();
const socketToRoom = new Map<string, string>();
const socketToUser = new Map<string, { uid: string; username: string; elo: number }>();
const lobbyCodeToRoom = new Map<string, string>();

// ─── Rank/challenge logic (mirrored from game engine) ───

const RANK_POWER: Record<string, number> = {
  '5*G': 14, '4*G': 13, '3*G': 12, '2*G': 11, '1*G': 10,
  'COL': 9, 'LTC': 8, 'MAJ': 7, 'CPT': 6, '1LT': 5,
  '2LT': 4, 'SGT': 3, 'PVT': 2, 'SPY': 1, 'FLG': 0,
};

function resolveChallenge(attackerRank: string, defenderRank: string): { result: string } {
  if (attackerRank === 'FLG' && defenderRank === 'FLG') return { result: 'flag_captured' };
  if (defenderRank === 'FLG') return { result: 'flag_captured' };
  if (attackerRank === 'FLG') return { result: 'defender_wins' };
  if (attackerRank === 'SPY' && defenderRank === 'SPY') return { result: 'both_eliminated' };
  if (attackerRank === 'SPY') {
    return defenderRank === 'PVT' ? { result: 'defender_wins' } : { result: 'attacker_wins' };
  }
  if (defenderRank === 'SPY') {
    return attackerRank === 'PVT' ? { result: 'attacker_wins' } : { result: 'defender_wins' };
  }
  if (attackerRank === defenderRank) return { result: 'both_eliminated' };
  return RANK_POWER[attackerRank] > RANK_POWER[defenderRank]
    ? { result: 'attacker_wins' }
    : { result: 'defender_wins' };
}

function findPiece(room: RoomState, pieceId: string): SerializedPiece | undefined {
  return [...room.whitePieces, ...room.blackPieces].find(p => p.id === pieceId);
}

function findPieceAt(room: RoomState, row: number, col: number): SerializedPiece | undefined {
  return [...room.whitePieces, ...room.blackPieces].find(
    p => p.row === row && p.col === col && !p.isEliminated
  );
}

function hasAdjacentEnemy(room: RoomState, row: number, col: number, owner: string): boolean {
  const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
  for (const [dr, dc] of dirs) {
    const nr = row + dr;
    const nc = col + dc;
    if (nr < 0 || nr > 7 || nc < 0 || nc > 8) continue;
    const occ = findPieceAt(room, nr, nc);
    if (occ && occ.owner !== owner) return true;
  }
  return false;
}

// ─── Lobby code generation ───

function generateLobbyCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// ─── Timer management ───

const RANK_PIECES: [string, number][] = [
  ['5*G', 1], ['4*G', 1], ['3*G', 1], ['2*G', 1], ['1*G', 1],
  ['COL', 1], ['LTC', 1], ['MAJ', 1], ['CPT', 1], ['1LT', 1],
  ['2LT', 1], ['SGT', 1], ['PVT', 6], ['SPY', 2], ['FLG', 1],
];

function generateRandomServerSetup(owner: 'white' | 'black'): SerializedPiece[] {
  const startRow = owner === 'white' ? 0 : 5;
  const positions: { row: number; col: number }[] = [];
  for (let r = startRow; r < startRow + 3; r++) {
    for (let c = 0; c < 9; c++) {
      positions.push({ row: r, col: c });
    }
  }
  // Shuffle positions
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  const pieces: SerializedPiece[] = [];
  let idx = 0;
  let idCounter = 0;
  for (const [rank, count] of RANK_PIECES) {
    for (let i = 0; i < count; i++) {
      pieces.push({
        id: `${owner}-${rank}-${idCounter++}`,
        rank,
        owner,
        row: positions[idx].row,
        col: positions[idx].col,
        isEliminated: false,
      });
      idx++;
    }
  }
  return pieces;
}

function startSetupTimer(room: RoomState): void {
  clearSetupTimer(room);
  room.setupStartedAt = Date.now();

  io.to(room.roomId).emit('setupTimerUpdate', { remaining: Math.ceil(SETUP_DURATION / 1000) });

  // Emit countdown every second
  room.setupTimerInterval = setInterval(() => {
    if (room.phase !== 'setup' || !room.setupStartedAt) {
      clearSetupTimer(room);
      return;
    }
    const remaining = Math.max(0, SETUP_DURATION - (Date.now() - room.setupStartedAt));
    io.to(room.roomId).emit('setupTimerUpdate', { remaining: Math.ceil(remaining / 1000) });
  }, 1000);

  // Auto-deploy after SETUP_DURATION
  room.setupTimer = setTimeout(() => {
    if (room.phase !== 'setup') return;

    // Track who gets auto-deployed
    const whiteAutoDeployed = !room.setupDone.white;
    const blackAutoDeployed = !room.setupDone.black;

    // Auto-deploy for any player who hasn't submitted
    if (whiteAutoDeployed) {
      room.whitePieces = generateRandomServerSetup('white');
      room.setupDone.white = true;
    }
    if (blackAutoDeployed) {
      room.blackPieces = generateRandomServerSetup('black');
      room.setupDone.black = true;
    }

    clearSetupTimer(room);
    room.phase = 'playing';
    room.currentPlayer = 'white';

    // Send opponent piece positions to each player
    const whiteSocket = room.white?.socketId ? io.sockets.sockets.get(room.white.socketId) : null;
    const blackSocket = room.black?.socketId ? io.sockets.sockets.get(room.black.socketId) : null;

    if (whiteSocket) {
      if (whiteAutoDeployed) {
        whiteSocket.emit('autoDeployed', {
          pieces: room.whitePieces.filter(p => p.row != null && p.col != null).map(p => ({ id: p.id, rank: p.rank, row: p.row!, col: p.col! })),
        });
      }
      whiteSocket.emit('opponentPieces', {
        pieces: room.blackPieces.filter(p => p.row != null && p.col != null).map(p => ({ id: p.id, row: p.row!, col: p.col! })),
      });
    }
    if (blackSocket) {
      if (blackAutoDeployed) {
        blackSocket.emit('autoDeployed', {
          pieces: room.blackPieces.filter(p => p.row != null && p.col != null).map(p => ({ id: p.id, rank: p.rank, row: p.row!, col: p.col! })),
        });
      }
      blackSocket.emit('opponentPieces', {
        pieces: room.whitePieces.filter(p => p.row != null && p.col != null).map(p => ({ id: p.id, row: p.row!, col: p.col! })),
      });
    }

    const timers = getTimerSeconds(room);
    if (whiteSocket) {
      whiteSocket.emit('gameStart', {
        currentPlayer: 'white',
        timerMode: room.timerMode,
        opponentPieces: room.blackPieces.filter(p => p.row != null && p.col != null).map(p => ({ id: p.id, row: p.row!, col: p.col! })),
        timerWhite: timers.white,
        timerBlack: timers.black,
      });
    }
    if (blackSocket) {
      blackSocket.emit('gameStart', {
        currentPlayer: 'white',
        timerMode: room.timerMode,
        opponentPieces: room.whitePieces.filter(p => p.row != null && p.col != null).map(p => ({ id: p.id, row: p.row!, col: p.col! })),
        timerWhite: timers.white,
        timerBlack: timers.black,
      });
    }
    startTurnTimer(room);
  }, SETUP_DURATION);
}

function clearSetupTimer(room: RoomState): void {
  if (room.setupTimer) {
    clearTimeout(room.setupTimer);
    room.setupTimer = null;
  }
  if (room.setupTimerInterval) {
    clearInterval(room.setupTimerInterval);
    room.setupTimerInterval = null;
  }
}

function startTurnTimer(room: RoomState): void {
  if (room.timerMode === 'none') return;
  clearTurnTimer(room);
  const duration = TIMER_DURATIONS[room.timerMode];
  room.turnStartedAt = Date.now();
  if (room.currentPlayer === 'white') {
    room.timerWhite = duration;
  } else {
    room.timerBlack = duration;
  }
  room.turnTimer = setTimeout(() => {
    if (room.phase !== 'playing') return;
    const loser = room.currentPlayer;
    const winner = loser === 'white' ? 'black' : 'white';
    endGame(room, winner, `${loser === 'white' ? 'White' : 'Black'} ran out of time!`);
  }, duration);
}

function clearTurnTimer(room: RoomState): void {
  if (room.turnTimer) {
    clearTimeout(room.turnTimer);
    room.turnTimer = null;
  }
}

function getRemainingTime(room: RoomState): { white: number; black: number } {
  if (room.timerMode === 'none') return { white: 0, black: 0 };
  const duration = TIMER_DURATIONS[room.timerMode];
  const elapsed = room.turnStartedAt ? Date.now() - room.turnStartedAt : 0;
  if (room.currentPlayer === 'white') {
    return { white: Math.max(0, duration - elapsed), black: room.timerBlack };
  } else {
    return { white: room.timerWhite, black: Math.max(0, duration - elapsed) };
  }
}

/** Convert ms timer values to seconds for client emission */
function getTimerSeconds(room: RoomState): { white: number; black: number } {
  const ms = getRemainingTime(room);
  return { white: Math.ceil(ms.white / 1000), black: Math.ceil(ms.black / 1000) };
}

// ─── Firestore helpers ───

async function getUserProfile(uid: string): Promise<{ username: string; elo: number } | null> {
  try {
    const doc = await adminDb.collection('users').doc(uid).get();
    if (!doc.exists) return null;
    const data = doc.data()!;
    return { username: data.username, elo: data.elo || 1200 };
  } catch {
    return null;
  }
}

async function updateUserStats(uid: string, eloChange: number, won: boolean): Promise<void> {
  try {
    const ref = adminDb.collection('users').doc(uid);
    const doc = await ref.get();
    if (!doc.exists) return;
    const data = doc.data()!;
    await ref.update({
      elo: (data.elo || 1200) + eloChange,
      wins: (data.wins || 0) + (won ? 1 : 0),
      losses: (data.losses || 0) + (won ? 0 : 1),
    });
  } catch (err) {
    console.error('Failed to update user stats:', err);
  }
}

async function saveMatchToFirestore(room: RoomState, replayId: string): Promise<void> {
  try {
    await adminDb.collection('matches').doc(replayId).set({
      roomId: room.roomId,
      whiteUid: room.white?.uid || '',
      blackUid: room.black?.uid || '',
      whiteUsername: room.white?.username || 'Unknown',
      blackUsername: room.black?.username || 'Unknown',
      winner: room.winner,
      winReason: room.winReason,
      timerMode: room.timerMode,
      moveCount: room.moveHistory.length,
      isRanked: !room.isCustom,
      timestamp: Date.now(),
    });
  } catch (err) {
    console.error('Failed to save match:', err);
  }
}

// ─── Matchmaking ───

function attemptMatch(timerMode: TimerMode): void {
  const queue = matchQueues[timerMode];
  if (queue.length < 2) return;

  queue.sort((a, b) => a.timestamp - b.timestamp);

  for (let i = 0; i < queue.length - 1; i++) {
    for (let j = i + 1; j < queue.length; j++) {
      const a = queue[i];
      const b = queue[j];
      const eloDiff = Math.abs(a.elo - b.elo);
      const waitTime = Date.now() - Math.min(a.timestamp, b.timestamp);
      const threshold = 200 + waitTime / 1000 * 10;
      if (eloDiff <= threshold) {
        queue.splice(j, 1);
        queue.splice(i, 1);
        createMatchRoom(a, b, timerMode);
        return;
      }
    }
  }
}

function createMatchRoom(a: MatchRequest, b: MatchRequest, timerMode: TimerMode): void {
  const roomId = uuidv4().slice(0, 8);
  const coinFlip = Math.random() > 0.5;
  const whiteReq = coinFlip ? a : b;
  const blackReq = coinFlip ? b : a;

  const white: ServerPlayer = { id: whiteReq.playerId, socketId: whiteReq.socketId, username: whiteReq.username, uid: whiteReq.uid, elo: whiteReq.elo, connected: true };
  const black: ServerPlayer = { id: blackReq.playerId, socketId: blackReq.socketId, username: blackReq.username, uid: blackReq.uid, elo: blackReq.elo, connected: true };

  const room: RoomState = {
    roomId, white, black, arbiter: null,
    phase: 'setup',
    setupDone: { white: false, black: false },
    whitePieces: [], blackPieces: [],
    currentPlayer: 'white', turnCount: 0,
    moveHistory: [], winner: null, winReason: null,
    flagReachedBackRank: null,
    eliminatedPieces: { white: [], black: [] },
    createdAt: Date.now(),
    timerMode,
    timerWhite: TIMER_DURATIONS[timerMode],
    timerBlack: TIMER_DURATIONS[timerMode],
    turnStartedAt: null,
    turnTimer: null,
    timerInterval: null,
    isCustom: false,
    lobbyCode: null,
    setupTimer: null,
    setupTimerInterval: null,
    setupStartedAt: null,
  };

  rooms.set(roomId, room);
  socketToRoom.set(white.socketId, roomId);
  socketToRoom.set(black.socketId, roomId);

  const whiteSocket = io.sockets.sockets.get(white.socketId);
  const blackSocket = io.sockets.sockets.get(black.socketId);

  whiteSocket?.join(roomId);
  blackSocket?.join(roomId);

  whiteSocket?.emit('matchFound', { roomId, color: 'white', opponent: black.username, opponentElo: black.elo, timerMode });
  blackSocket?.emit('matchFound', { roomId, color: 'black', opponent: white.username, opponentElo: white.elo, timerMode });

  // Start setup phase
  io.to(roomId).emit('setupPhase');
  startSetupTimer(room);
}

function saveReplay(room: RoomState): string {
  const replayId = uuidv4().slice(0, 12);
  const replay: ReplayData = {
    replayId,
    roomId: room.roomId,
    whiteUsername: room.white?.username || 'Unknown',
    blackUsername: room.black?.username || 'Unknown',
    moves: room.moveHistory,
    winner: room.winner,
    winReason: room.winReason,
    whiteElo: room.white?.elo || 1200,
    blackElo: room.black?.elo || 1200,
    timestamp: Date.now(),
  };
  replays.set(replayId, replay);
  return replayId;
}

function endGame(room: RoomState, winner: 'white' | 'black', reason: string): void {
  room.winner = winner;
  room.winReason = reason;
  room.phase = 'gameover';
  clearTurnTimer(room);
  clearSetupTimer(room);

  const replayId = saveReplay(room);

  const winnerPlayer = winner === 'white' ? room.white : room.black;
  const loserPlayer = winner === 'white' ? room.black : room.white;

  let eloChange = 0;
  if (winnerPlayer && loserPlayer && !room.isCustom) {
    const { winnerChange, loserChange } = calculateEloChange(winnerPlayer.elo, loserPlayer.elo);
    eloChange = winnerChange;
    winnerPlayer.elo += winnerChange;
    loserPlayer.elo += loserChange;

    // Persist to Firestore
    updateUserStats(winnerPlayer.uid, winnerChange, true);
    updateUserStats(loserPlayer.uid, loserChange, false);
  }

  // Save match record
  saveMatchToFirestore(room, replayId);

  const winnerSocket = winner === 'white' ? room.white?.socketId : room.black?.socketId;
  const loserSocket = winner === 'white' ? room.black?.socketId : room.white?.socketId;

  if (winnerSocket) {
    io.sockets.sockets.get(winnerSocket)?.emit('gameOver', { winner, reason, eloChange, replayId });
  }
  if (loserSocket) {
    io.sockets.sockets.get(loserSocket)?.emit('gameOver', { winner, reason, eloChange: -eloChange, replayId });
  }

  if (room.arbiter) {
    io.sockets.sockets.get(room.arbiter)?.emit('gameOver', { winner, reason, eloChange: 0, replayId });
  }

  // Clean up lobby code
  if (room.lobbyCode) {
    lobbyCodeToRoom.delete(room.lobbyCode);
  }
}

// ─── Socket handlers ───

io.on('connection', (socket) => {
  console.log(`Connected: ${socket.id}`);

  // ─── Authentication ───
  socket.on('authenticate', async ({ token }) => {
    try {
      const decoded = await adminAuth.verifyIdToken(token);
      const profile = await getUserProfile(decoded.uid);
      if (!profile) {
        socket.emit('authError', { message: 'User profile not found. Please sign up first.' });
        return;
      }
      socketToUser.set(socket.id, { uid: decoded.uid, username: profile.username, elo: profile.elo });
      socket.emit('authenticated', { uid: decoded.uid, username: profile.username, elo: profile.elo });

      // Check for reconnection — find any active room this user belongs to
      for (const [roomId, room] of rooms) {
        if (room.phase !== 'playing' && room.phase !== 'setup') continue;
        const isWhite = room.white?.uid === decoded.uid;
        const isBlack = room.black?.uid === decoded.uid;
        if (!isWhite && !isBlack) continue;

        // Reconnect: update socket references
        const color = isWhite ? 'white' : 'black';
        const player = isWhite ? room.white! : room.black!;
        const oldSocketId = player.socketId;
        player.socketId = socket.id;
        player.connected = true;
        socketToRoom.set(socket.id, roomId);
        socketToRoom.delete(oldSocketId);
        socket.join(roomId);

        const opponent = isWhite ? room.black : room.white;
        const myPieces = isWhite ? room.whitePieces : room.blackPieces;
        const oppPieces = isWhite ? room.blackPieces : room.whitePieces;
        const timers = getTimerSeconds(room);

        socket.emit('fullGameState', {
          phase: room.phase,
          color,
          opponent: opponent?.username || 'Unknown',
          opponentElo: opponent?.elo || 1200,
          opponentPieces: oppPieces.filter(p => !p.isEliminated && p.row != null && p.col != null).map(p => ({ id: p.id, row: p.row!, col: p.col! })),
          myPieces: myPieces.filter(p => !p.isEliminated && p.row != null && p.col != null).map(p => ({ id: p.id, rank: p.rank, row: p.row!, col: p.col! })),
          currentPlayer: room.currentPlayer,
          timerMode: room.timerMode,
          timerWhite: timers.white,
          timerBlack: timers.black,
          turnCount: room.turnCount,
        });

        // Notify opponent
        if (opponent?.socketId) {
          io.sockets.sockets.get(opponent.socketId)?.emit('opponentReconnected');
        }

        break;
      }
    } catch {
      socket.emit('authError', { message: 'Invalid authentication token' });
    }
  });

  // ─── Queue ───
  socket.on('joinQueue', ({ timerMode = '1m' }) => {
    const user = socketToUser.get(socket.id);
    if (!user) { socket.emit('error', { message: 'Not authenticated' }); return; }

    const queue = matchQueues[timerMode];
    const idx = queue.findIndex(m => m.socketId === socket.id);
    if (idx >= 0) queue.splice(idx, 1);

    queue.push({
      playerId: socket.id,
      socketId: socket.id,
      username: user.username,
      uid: user.uid,
      elo: user.elo,
      timerMode,
      timestamp: Date.now(),
    });

    socket.emit('queueUpdate', { position: queue.length, playersInQueue: queue.length });
    socket.emit('playerInfo', { elo: user.elo, username: user.username });
    attemptMatch(timerMode);
  });

  socket.on('leaveQueue', () => {
    for (const mode of Object.keys(matchQueues) as TimerMode[]) {
      const queue = matchQueues[mode];
      const idx = queue.findIndex(m => m.socketId === socket.id);
      if (idx >= 0) queue.splice(idx, 1);
    }
  });

  // ─── Custom Lobby ───
  socket.on('createCustomLobby', ({ timerMode = 'none' }) => {
    const user = socketToUser.get(socket.id);
    if (!user) { socket.emit('error', { message: 'Not authenticated' }); return; }

    const roomId = uuidv4().slice(0, 8);
    let code = generateLobbyCode();
    while (lobbyCodeToRoom.has(code)) code = generateLobbyCode();

    const white: ServerPlayer = {
      id: socket.id, socketId: socket.id,
      username: user.username, uid: user.uid, elo: user.elo, connected: true,
    };

    const room: RoomState = {
      roomId, white, black: null, arbiter: null,
      phase: 'waiting',
      setupDone: { white: false, black: false },
      whitePieces: [], blackPieces: [],
      currentPlayer: 'white', turnCount: 0,
      moveHistory: [], winner: null, winReason: null,
      flagReachedBackRank: null,
      eliminatedPieces: { white: [], black: [] },
      createdAt: Date.now(),
      timerMode,
      timerWhite: TIMER_DURATIONS[timerMode],
      timerBlack: TIMER_DURATIONS[timerMode],
      turnStartedAt: null,
      turnTimer: null,
      timerInterval: null,
      isCustom: true,
      lobbyCode: code,
      setupTimer: null,
      setupTimerInterval: null,
      setupStartedAt: null,
    };

    rooms.set(roomId, room);
    lobbyCodeToRoom.set(code, roomId);
    socketToRoom.set(socket.id, roomId);
    socket.join(roomId);
    socket.emit('lobbyCreated', { code, roomId });
    socket.emit('playerInfo', { elo: user.elo, username: user.username });
  });

  socket.on('joinCustomLobby', ({ code }) => {
    const user = socketToUser.get(socket.id);
    if (!user) { socket.emit('error', { message: 'Not authenticated' }); return; }

    const upperedCode = code.toUpperCase().trim();
    const roomId = lobbyCodeToRoom.get(upperedCode);
    if (!roomId) { socket.emit('error', { message: 'Lobby not found' }); return; }

    const room = rooms.get(roomId);
    if (!room) { socket.emit('error', { message: 'Room not found' }); return; }
    if (room.phase !== 'waiting') { socket.emit('error', { message: 'Game already in progress' }); return; }
    if (room.black) { socket.emit('error', { message: 'Lobby is full' }); return; }

    room.black = {
      id: socket.id, socketId: socket.id,
      username: user.username, uid: user.uid, elo: user.elo, connected: true,
    };
    room.phase = 'setup';
    socketToRoom.set(socket.id, roomId);
    socket.join(roomId);

    socket.emit('roomJoined', { roomId, color: 'black' });
    socket.emit('playerInfo', { elo: user.elo, username: user.username });

    if (room.white) {
      io.sockets.sockets.get(room.white.socketId)?.emit('opponentJoined', { opponent: user.username, opponentElo: user.elo });
    }
    io.to(roomId).emit('setupPhase');
    startSetupTimer(room);
  });

  // ─── Legacy room ───
  socket.on('createRoom', ({ timerMode = 'none' }) => {
    const user = socketToUser.get(socket.id);
    if (!user) { socket.emit('error', { message: 'Not authenticated' }); return; }

    const roomId = uuidv4().slice(0, 8);
    const white: ServerPlayer = {
      id: socket.id, socketId: socket.id,
      username: user.username, uid: user.uid, elo: user.elo, connected: true,
    };

    const room: RoomState = {
      roomId, white, black: null, arbiter: null,
      phase: 'waiting',
      setupDone: { white: false, black: false },
      whitePieces: [], blackPieces: [],
      currentPlayer: 'white', turnCount: 0,
      moveHistory: [], winner: null, winReason: null,
      flagReachedBackRank: null,
      eliminatedPieces: { white: [], black: [] },
      createdAt: Date.now(),
      timerMode,
      timerWhite: TIMER_DURATIONS[timerMode],
      timerBlack: TIMER_DURATIONS[timerMode],
      turnStartedAt: null,
      turnTimer: null,
      timerInterval: null,
      isCustom: false,
      lobbyCode: null,
      setupTimer: null,
      setupTimerInterval: null,
      setupStartedAt: null,
    };

    rooms.set(roomId, room);
    socketToRoom.set(socket.id, roomId);
    socket.join(roomId);
    socket.emit('roomCreated', { roomId });
    socket.emit('playerInfo', { elo: user.elo, username: user.username });
  });

  socket.on('joinRoom', ({ roomId }) => {
    const user = socketToUser.get(socket.id);
    if (!user) { socket.emit('error', { message: 'Not authenticated' }); return; }

    const room = rooms.get(roomId);
    if (!room) { socket.emit('error', { message: 'Room not found' }); return; }
    if (room.phase !== 'waiting') { socket.emit('error', { message: 'Game already in progress' }); return; }
    if (room.black) { socket.emit('error', { message: 'Room is full' }); return; }

    room.black = {
      id: socket.id, socketId: socket.id,
      username: user.username, uid: user.uid, elo: user.elo, connected: true,
    };
    room.phase = 'setup';
    socketToRoom.set(socket.id, roomId);
    socket.join(roomId);

    socket.emit('roomJoined', { roomId, color: 'black' });
    socket.emit('playerInfo', { elo: user.elo, username: user.username });

    if (room.white) {
      io.sockets.sockets.get(room.white.socketId)?.emit('opponentJoined', { opponent: user.username, opponentElo: user.elo });
    }
    io.to(roomId).emit('setupPhase');
    startSetupTimer(room);
  });

  socket.on('joinAsArbiter', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) { socket.emit('error', { message: 'Room not found' }); return; }
    room.arbiter = socket.id;
    socket.join(roomId);
  });

  socket.on('submitSetup', ({ pieces }) => {
    const roomId = socketToRoom.get(socket.id);
    if (!roomId) { socket.emit('error', { message: 'Not in a room' }); return; }
    const room = rooms.get(roomId);
    if (!room || room.phase !== 'setup') { socket.emit('error', { message: 'Not in setup phase' }); return; }

    const isWhite = room.white?.socketId === socket.id;
    const isBlack = room.black?.socketId === socket.id;
    if (!isWhite && !isBlack) { socket.emit('error', { message: 'Not a player' }); return; }

    // Validate 21 pieces
    if (pieces.length !== 21) { socket.emit('error', { message: 'Must place all 21 pieces' }); return; }

    const color = isWhite ? 'white' : 'black' as const;

    // Validate positions in setup zone
    const validRowRange = color === 'white' ? [0, 1, 2] : [5, 6, 7];
    for (const p of pieces) {
      if (p.row === null || p.col === null) { socket.emit('error', { message: 'All pieces must be placed' }); return; }
      if (!validRowRange.includes(p.row)) { socket.emit('error', { message: 'Pieces must be in your setup zone' }); return; }
      if (p.col < 0 || p.col > 8) { socket.emit('error', { message: 'Invalid column' }); return; }
    }

    if (isWhite) {
      room.whitePieces = pieces;
      room.setupDone.white = true;
    } else {
      room.blackPieces = pieces;
      room.setupDone.black = true;
    }

    // Notify opponent that we're ready
    const opponentSocketId = isWhite ? room.black?.socketId : room.white?.socketId;
    if (opponentSocketId) {
      io.sockets.sockets.get(opponentSocketId)?.emit('opponentReady');
    }

    // If both ready, start game
    if (room.setupDone.white && room.setupDone.black) {
      clearSetupTimer(room);
      room.phase = 'playing';
      room.currentPlayer = 'white';

      // Send opponent piece positions (without ranks) to each player
      const whiteSocket = room.white?.socketId ? io.sockets.sockets.get(room.white.socketId) : null;
      const blackSocket = room.black?.socketId ? io.sockets.sockets.get(room.black.socketId) : null;

      // White receives black's piece positions (no ranks)
      if (whiteSocket) {
        whiteSocket.emit('opponentPieces', {
          pieces: room.blackPieces.filter(p => p.row != null && p.col != null).map(p => ({ id: p.id, row: p.row!, col: p.col! })),
        });
      }
      // Black receives white's piece positions (no ranks)
      if (blackSocket) {
        blackSocket.emit('opponentPieces', {
          pieces: room.whitePieces.filter(p => p.row != null && p.col != null).map(p => ({ id: p.id, row: p.row!, col: p.col! })),
        });
      }

      const timers = getTimerSeconds(room);
      if (whiteSocket) {
        whiteSocket.emit('gameStart', {
          currentPlayer: 'white',
          timerMode: room.timerMode,
          opponentPieces: room.blackPieces.filter(p => p.row != null && p.col != null).map(p => ({ id: p.id, row: p.row!, col: p.col! })),
          timerWhite: timers.white,
          timerBlack: timers.black,
        });
      }
      if (blackSocket) {
        blackSocket.emit('gameStart', {
          currentPlayer: 'white',
          timerMode: room.timerMode,
          opponentPieces: room.whitePieces.filter(p => p.row != null && p.col != null).map(p => ({ id: p.id, row: p.row!, col: p.col! })),
          timerWhite: timers.white,
          timerBlack: timers.black,
        });
      }
      startTurnTimer(room);
    }
  });

  socket.on('makeMove', ({ pieceId, toRow, toCol }) => {
    const roomId = socketToRoom.get(socket.id);
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room || room.phase !== 'playing') return;

    const isWhite = room.white?.socketId === socket.id;
    const isBlack = room.black?.socketId === socket.id;
    if (!isWhite && !isBlack) return;

    const myColor = isWhite ? 'white' : 'black';
    if (room.currentPlayer !== myColor) {
      socket.emit('error', { message: 'Not your turn' });
      return;
    }

    const piece = findPiece(room, pieceId);
    if (!piece || piece.owner !== myColor || piece.isEliminated || piece.row === null || piece.col === null) {
      socket.emit('error', { message: 'Invalid piece' });
      return;
    }

    // Validate move (1 square orthogonal)
    const dr = Math.abs(toRow - piece.row);
    const dc = Math.abs(toCol - piece.col);
    if ((dr + dc) !== 1 || toRow < 0 || toRow > 7 || toCol < 0 || toCol > 8) {
      socket.emit('error', { message: 'Invalid move' });
      return;
    }

    // Check for friendly piece at destination
    const occupant = findPieceAt(room, toRow, toCol);
    if (occupant && occupant.owner === myColor) {
      socket.emit('error', { message: 'Cannot move onto your own piece' });
      return;
    }

    const fromRow = piece.row;
    const fromCol = piece.col;
    let challengeData: SerializedMove['challenge'] | undefined;
    const eliminatedPieceIds: string[] = [];

    if (occupant) {
      // Challenge
      const { result } = resolveChallenge(piece.rank, occupant.rank);
      challengeData = { attackerRank: piece.rank, defenderRank: occupant.rank, result };

      switch (result) {
        case 'attacker_wins':
          occupant.isEliminated = true;
          occupant.row = null;
          occupant.col = null;
          eliminatedPieceIds.push(occupant.id);
          room.eliminatedPieces[occupant.owner as 'white' | 'black'].push({ ...occupant });
          piece.row = toRow;
          piece.col = toCol;
          break;
        case 'defender_wins':
          piece.isEliminated = true;
          piece.row = null;
          piece.col = null;
          eliminatedPieceIds.push(piece.id);
          room.eliminatedPieces[piece.owner as 'white' | 'black'].push({ ...piece });
          break;
        case 'both_eliminated':
          piece.isEliminated = true;
          piece.row = null;
          piece.col = null;
          occupant.isEliminated = true;
          occupant.row = null;
          occupant.col = null;
          eliminatedPieceIds.push(piece.id, occupant.id);
          room.eliminatedPieces[piece.owner as 'white' | 'black'].push({ ...piece });
          room.eliminatedPieces[occupant.owner as 'white' | 'black'].push({ ...occupant });
          break;
        case 'flag_captured':
          occupant.isEliminated = true;
          occupant.row = null;
          occupant.col = null;
          eliminatedPieceIds.push(occupant.id);
          room.eliminatedPieces[occupant.owner as 'white' | 'black'].push({ ...occupant });
          piece.row = toRow;
          piece.col = toCol;
          endGame(room, myColor, `${myColor === 'white' ? 'White' : 'Black'} captured the opponent's Flag!`);
          break;
      }
    } else {
      piece.row = toRow;
      piece.col = toCol;
    }

    // Record move
    const move: SerializedMove = {
      pieceId, fromRow, fromCol, toRow, toCol,
      challenge: challengeData,
      timestamp: Date.now(),
    };
    room.moveHistory.push(move);

    // Check flag on back rank
    if (room.phase === 'playing' && piece.rank === 'FLG' && piece.row !== null) {
      const backRank = myColor === 'white' ? 7 : 0;
      if (piece.row === backRank) {
        if (!hasAdjacentEnemy(room, piece.row, piece.col!, myColor)) {
          endGame(room, myColor, `${myColor === 'white' ? 'White' : 'Black'}'s Flag reached the back rank unopposed!`);
        } else {
          room.flagReachedBackRank = { player: myColor, turnReached: room.turnCount };
        }
      }
    }

    // Check surviving flag from previous turn
    if (room.phase === 'playing' && room.flagReachedBackRank && room.flagReachedBackRank.player !== myColor) {
      const fp = room.flagReachedBackRank.player;
      const allPieces = fp === 'white' ? room.whitePieces : room.blackPieces;
      const flag = allPieces.find(p => p.rank === 'FLG' && !p.isEliminated);
      if (flag && flag.row !== null) {
        const backRank = fp === 'white' ? 7 : 0;
        if (flag.row === backRank) {
          endGame(room, fp, `${fp === 'white' ? 'White' : 'Black'}'s Flag survived on the back rank!`);
        }
      }
    }

    // Switch turn
    room.turnCount++;
    room.currentPlayer = room.currentPlayer === 'white' ? 'black' : 'white';

    // Restart timer for next player
    if (room.phase === 'playing') {
      startTurnTimer(room);
    }

    const timers = getTimerSeconds(room);

    // Emit to players (they don't see opponent ranks)
    const moveEvent = {
      pieceId, fromRow, fromCol, toRow, toCol,
      challenge: challengeData ? { result: challengeData.result, eliminatedPieceIds } : undefined,
      currentPlayer: room.currentPlayer,
      turnCount: room.turnCount,
      timerWhite: timers.white,
      timerBlack: timers.black,
    };

    if (room.white?.socketId) io.sockets.sockets.get(room.white.socketId)?.emit('moveMade', moveEvent);
    if (room.black?.socketId) io.sockets.sockets.get(room.black.socketId)?.emit('moveMade', moveEvent);

    // Arbiter gets full info
    if (room.arbiter) {
      io.sockets.sockets.get(room.arbiter)?.emit('arbiterUpdate', {
        ...moveEvent,
        challenge: challengeData ? { ...challengeData, eliminatedPieceIds } : undefined,
        whitePieces: room.whitePieces,
        blackPieces: room.blackPieces,
      });
    }
  });

  socket.on('resign', () => {
    const roomId = socketToRoom.get(socket.id);
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room || room.phase !== 'playing') return;

    const isWhite = room.white?.socketId === socket.id;
    const winner = isWhite ? 'black' : 'white';
    endGame(room, winner, `${isWhite ? 'White' : 'Black'} resigned.`);
  });

  socket.on('getReplay', ({ replayId }) => {
    const replay = replays.get(replayId);
    if (replay) {
      socket.emit('replayData', replay);
    } else {
      socket.emit('error', { message: 'Replay not found' });
    }
  });

  // ─── Leaderboard ───
  socket.on('getLeaderboard', async ({ limit = 50, offset = 0 }) => {
    try {
      const snap = await adminDb.collection('users')
        .orderBy('elo', 'desc')
        .limit(Math.min(limit, 100))
        .offset(offset)
        .get();

      const players = snap.docs.map((doc, i) => {
        const data = doc.data();
        return {
          uid: doc.id,
          username: data.username,
          elo: data.elo || 1200,
          wins: data.wins || 0,
          losses: data.losses || 0,
          draws: data.draws || 0,
          rank: offset + i + 1,
        };
      });

      socket.emit('leaderboard', { players });
    } catch {
      socket.emit('error', { message: 'Failed to load leaderboard' });
    }
  });

  socket.on('disconnect', () => {
    console.log(`Disconnected: ${socket.id}`);

    // Remove from all queues
    for (const mode of Object.keys(matchQueues) as TimerMode[]) {
      const queue = matchQueues[mode];
      const idx = queue.findIndex(m => m.socketId === socket.id);
      if (idx >= 0) queue.splice(idx, 1);
    }

    // Handle room
    const roomId = socketToRoom.get(socket.id);
    if (roomId) {
      const room = rooms.get(roomId);
      if (room) {
        if (room.arbiter === socket.id) {
          room.arbiter = null;
        } else {
          const isWhite = room.white?.socketId === socket.id;
          if (isWhite && room.white) room.white.connected = false;
          else if (room.black) room.black.connected = false;

          const opponentSocketId = isWhite ? room.black?.socketId : room.white?.socketId;
          if (opponentSocketId) {
            io.sockets.sockets.get(opponentSocketId)?.emit('opponentDisconnected');
          }

          // Auto-resign after 30s disconnect during a game
          if (room.phase === 'playing') {
            setTimeout(() => {
              const currentRoom = rooms.get(roomId);
              if (!currentRoom) return;
              const player = isWhite ? currentRoom.white : currentRoom.black;
              if (player && !player.connected && currentRoom.phase === 'playing') {
                const winner = isWhite ? 'black' : 'white';
                endGame(currentRoom, winner, `${isWhite ? 'White' : 'Black'} disconnected.`);
              }
            }, 30000);
          }
        }
      }
      socketToRoom.delete(socket.id);
    }
    socketToUser.delete(socket.id);
  });
});

// Run matchmaking for all timer modes every 2 seconds
setInterval(() => {
  for (const mode of Object.keys(matchQueues) as TimerMode[]) {
    attemptMatch(mode);
  }
}, 2000);

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Game server running on 0.0.0.0:${PORT}`);
});
