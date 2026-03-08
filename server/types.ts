// Server-side types for multiplayer

export interface ServerPlayer {
  id: string;
  socketId: string;
  username: string;
  elo: number;
  connected: boolean;
}

export interface MatchRequest {
  playerId: string;
  socketId: string;
  username: string;
  elo: number;
  timestamp: number;
}

export interface RoomState {
  roomId: string;
  white: ServerPlayer | null;
  black: ServerPlayer | null;
  arbiter: string | null; // socketId of arbiter connection
  phase: 'waiting' | 'setup' | 'playing' | 'gameover';
  setupDone: { white: boolean; black: boolean };
  // Pieces stored server-side — arbiter knows all, players see only their own
  whitePieces: SerializedPiece[];
  blackPieces: SerializedPiece[];
  currentPlayer: 'white' | 'black';
  turnCount: number;
  moveHistory: SerializedMove[];
  winner: 'white' | 'black' | null;
  winReason: string | null;
  flagReachedBackRank: { player: 'white' | 'black'; turnReached: number } | null;
  eliminatedPieces: { white: SerializedPiece[]; black: SerializedPiece[] };
  createdAt: number;
}

export interface SerializedPiece {
  id: string;
  rank: string;
  owner: 'white' | 'black';
  row: number | null;
  col: number | null;
  isEliminated: boolean;
}

export interface SerializedMove {
  pieceId: string;
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
  challenge?: {
    attackerRank: string;
    defenderRank: string;
    result: string;
  };
  timestamp: number;
}

export interface ReplayData {
  replayId: string;
  roomId: string;
  whiteUsername: string;
  blackUsername: string;
  moves: SerializedMove[];
  winner: 'white' | 'black' | null;
  winReason: string | null;
  whiteElo: number;
  blackElo: number;
  timestamp: number;
}

// Client -> Server events
export interface ClientToServerEvents {
  joinQueue: (data: { username: string }) => void;
  leaveQueue: () => void;
  createRoom: (data: { username: string }) => void;
  joinRoom: (data: { roomId: string; username: string }) => void;
  joinAsArbiter: (data: { roomId: string }) => void;
  submitSetup: (data: { pieces: SerializedPiece[] }) => void;
  makeMove: (data: { pieceId: string; toRow: number; toCol: number }) => void;
  requestRematch: () => void;
  resign: () => void;
  getReplay: (data: { replayId: string }) => void;
}

// Server -> Client events
export interface ServerToClientEvents {
  queueUpdate: (data: { position: number; playersInQueue: number }) => void;
  matchFound: (data: { roomId: string; color: 'white' | 'black'; opponent: string; opponentElo: number }) => void;
  roomJoined: (data: { roomId: string; color: 'white' | 'black' }) => void;
  roomCreated: (data: { roomId: string }) => void;
  opponentJoined: (data: { opponent: string }) => void;
  setupPhase: () => void;
  opponentReady: () => void;
  gameStart: (data: { currentPlayer: 'white' | 'black' }) => void;
  moveMade: (data: {
    pieceId: string;
    fromRow: number;
    fromCol: number;
    toRow: number;
    toCol: number;
    challenge?: { result: string; eliminatedPieceIds: string[] };
    currentPlayer: 'white' | 'black';
    turnCount: number;
  }) => void;
  // Arbiter sees full challenge details
  arbiterUpdate: (data: {
    pieceId: string;
    fromRow: number;
    fromCol: number;
    toRow: number;
    toCol: number;
    challenge?: { attackerRank: string; defenderRank: string; result: string; eliminatedPieceIds: string[] };
    currentPlayer: 'white' | 'black';
    turnCount: number;
    whitePieces: SerializedPiece[];
    blackPieces: SerializedPiece[];
  }) => void;
  gameOver: (data: { winner: 'white' | 'black'; reason: string; eloChange: number; replayId: string }) => void;
  opponentDisconnected: () => void;
  opponentReconnected: () => void;
  rematchRequested: () => void;
  error: (data: { message: string }) => void;
  replayData: (data: ReplayData) => void;
  playerInfo: (data: { elo: number; username: string }) => void;
}
