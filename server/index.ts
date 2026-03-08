import { createServer } from 'http';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { calculateEloChange } from './elo';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  RoomState,
  ServerPlayer,
  MatchRequest,
  SerializedPiece,
  SerializedMove,
  ReplayData,
} from './types';

const PORT = parseInt(process.env.PORT || '3001', 10);

const httpServer = createServer();
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// ─── In-memory stores ───
const rooms = new Map<string, RoomState>();
const matchQueue: MatchRequest[] = [];
const playerElos = new Map<string, number>(); // username -> elo
const replays = new Map<string, ReplayData>();
const socketToRoom = new Map<string, string>();
const socketToUsername = new Map<string, string>();

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

// ─── Matchmaking ───

function attemptMatch(): void {
  if (matchQueue.length < 2) return;

  // Sort by wait time, try to match closest ELO within threshold
  matchQueue.sort((a, b) => a.timestamp - b.timestamp);

  for (let i = 0; i < matchQueue.length - 1; i++) {
    for (let j = i + 1; j < matchQueue.length; j++) {
      const a = matchQueue[i];
      const b = matchQueue[j];
      const eloDiff = Math.abs(a.elo - b.elo);
      const waitTime = Date.now() - Math.min(a.timestamp, b.timestamp);
      // Widen ELO range over time
      const threshold = 200 + waitTime / 1000 * 10;
      if (eloDiff <= threshold) {
        // Match found
        matchQueue.splice(j, 1);
        matchQueue.splice(i, 1);
        createMatchRoom(a, b);
        return;
      }
    }
  }
}

function createMatchRoom(a: MatchRequest, b: MatchRequest): void {
  const roomId = uuidv4().slice(0, 8);
  const coinFlip = Math.random() > 0.5;
  const whiteReq = coinFlip ? a : b;
  const blackReq = coinFlip ? b : a;

  const white: ServerPlayer = { id: whiteReq.playerId, socketId: whiteReq.socketId, username: whiteReq.username, elo: whiteReq.elo, connected: true };
  const black: ServerPlayer = { id: blackReq.playerId, socketId: blackReq.socketId, username: blackReq.username, elo: blackReq.elo, connected: true };

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
  };

  rooms.set(roomId, room);
  socketToRoom.set(white.socketId, roomId);
  socketToRoom.set(black.socketId, roomId);

  const whiteSocket = io.sockets.sockets.get(white.socketId);
  const blackSocket = io.sockets.sockets.get(black.socketId);

  whiteSocket?.join(roomId);
  blackSocket?.join(roomId);

  whiteSocket?.emit('matchFound', { roomId, color: 'white', opponent: black.username, opponentElo: black.elo });
  blackSocket?.emit('matchFound', { roomId, color: 'black', opponent: white.username, opponentElo: white.elo });

  // Start setup phase
  io.to(roomId).emit('setupPhase');
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

  const replayId = saveReplay(room);

  const winnerPlayer = winner === 'white' ? room.white : room.black;
  const loserPlayer = winner === 'white' ? room.black : room.white;

  let eloChange = 0;
  if (winnerPlayer && loserPlayer) {
    const { winnerChange, loserChange } = calculateEloChange(winnerPlayer.elo, loserPlayer.elo);
    eloChange = winnerChange;
    playerElos.set(winnerPlayer.username, winnerPlayer.elo + winnerChange);
    playerElos.set(loserPlayer.username, loserPlayer.elo + loserChange);
    winnerPlayer.elo += winnerChange;
    loserPlayer.elo += loserChange;
  }

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
}

// ─── Socket handlers ───

io.on('connection', (socket) => {
  console.log(`Connected: ${socket.id}`);

  socket.on('joinQueue', ({ username }) => {
    const sanitized = username.slice(0, 20).replace(/[^a-zA-Z0-9_-]/g, '');
    if (!sanitized) {
      socket.emit('error', { message: 'Invalid username' });
      return;
    }
    socketToUsername.set(socket.id, sanitized);

    const elo = playerElos.get(sanitized) || 1200;
    playerElos.set(sanitized, elo);

    // Remove any existing queue entry for this socket
    const idx = matchQueue.findIndex(m => m.socketId === socket.id);
    if (idx >= 0) matchQueue.splice(idx, 1);

    matchQueue.push({
      playerId: socket.id,
      socketId: socket.id,
      username: sanitized,
      elo,
      timestamp: Date.now(),
    });

    socket.emit('queueUpdate', { position: matchQueue.length, playersInQueue: matchQueue.length });
    socket.emit('playerInfo', { elo, username: sanitized });
    attemptMatch();
  });

  socket.on('leaveQueue', () => {
    const idx = matchQueue.findIndex(m => m.socketId === socket.id);
    if (idx >= 0) matchQueue.splice(idx, 1);
  });

  socket.on('createRoom', ({ username }) => {
    const sanitized = username.slice(0, 20).replace(/[^a-zA-Z0-9_-]/g, '');
    if (!sanitized) { socket.emit('error', { message: 'Invalid username' }); return; }
    socketToUsername.set(socket.id, sanitized);

    const roomId = uuidv4().slice(0, 8);
    const elo = playerElos.get(sanitized) || 1200;
    playerElos.set(sanitized, elo);

    const white: ServerPlayer = { id: socket.id, socketId: socket.id, username: sanitized, elo, connected: true };

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
    };

    rooms.set(roomId, room);
    socketToRoom.set(socket.id, roomId);
    socket.join(roomId);
    socket.emit('roomCreated', { roomId });
    socket.emit('playerInfo', { elo, username: sanitized });
  });

  socket.on('joinRoom', ({ roomId, username }) => {
    const sanitized = username.slice(0, 20).replace(/[^a-zA-Z0-9_-]/g, '');
    if (!sanitized) { socket.emit('error', { message: 'Invalid username' }); return; }

    const room = rooms.get(roomId);
    if (!room) { socket.emit('error', { message: 'Room not found' }); return; }
    if (room.phase !== 'waiting') { socket.emit('error', { message: 'Game already in progress' }); return; }
    if (room.black) { socket.emit('error', { message: 'Room is full' }); return; }

    socketToUsername.set(socket.id, sanitized);
    const elo = playerElos.get(sanitized) || 1200;
    playerElos.set(sanitized, elo);

    room.black = { id: socket.id, socketId: socket.id, username: sanitized, elo, connected: true };
    room.phase = 'setup';
    socketToRoom.set(socket.id, roomId);
    socket.join(roomId);

    socket.emit('roomJoined', { roomId, color: 'black' });
    socket.emit('playerInfo', { elo, username: sanitized });

    // Notify white
    if (room.white) {
      io.sockets.sockets.get(room.white.socketId)?.emit('opponentJoined', { opponent: sanitized });
    }
    io.to(roomId).emit('setupPhase');
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
      room.phase = 'playing';
      room.currentPlayer = 'white';
      io.to(roomId).emit('gameStart', { currentPlayer: 'white' });
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

    // Emit to players (they don't see opponent ranks)
    const moveEvent = {
      pieceId, fromRow, fromCol, toRow, toCol,
      challenge: challengeData ? { result: challengeData.result, eliminatedPieceIds } : undefined,
      currentPlayer: room.currentPlayer,
      turnCount: room.turnCount,
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

  socket.on('disconnect', () => {
    console.log(`Disconnected: ${socket.id}`);

    // Remove from queue
    const idx = matchQueue.findIndex(m => m.socketId === socket.id);
    if (idx >= 0) matchQueue.splice(idx, 1);

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
    socketToUsername.delete(socket.id);
  });
});

// Run matchmaking every 2 seconds
setInterval(attemptMatch, 2000);

httpServer.listen(PORT, () => {
  console.log(`Game server running on port ${PORT}`);
});
