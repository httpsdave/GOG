// Server-side types for multiplayer

export type TimerMode = 'none' | '30s' | '1m' | '2m';

export const TIMER_DURATIONS: Record<TimerMode, number> = {
  'none': 0,
  '30s': 30000,
  '1m': 60000,
  '2m': 120000,
};

export interface ServerPlayer {
  id: string;
  socketId: string;
  username: string;
  uid: string; // Firebase UID
  elo: number;
  connected: boolean;
}

export interface MatchRequest {
  playerId: string;
  socketId: string;
  username: string;
  uid: string;
  elo: number;
  timerMode: TimerMode;
  timestamp: number;
}

export interface RoomState {
  roomId: string;
  white: ServerPlayer | null;
  black: ServerPlayer | null;
  arbiter: string | null; // socketId of arbiter connection
  phase: 'waiting' | 'setup' | 'playing' | 'gameover';
  setupDone: { white: boolean; black: boolean };
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
  // Timer
  timerMode: TimerMode;
  timerWhite: number; // ms remaining (for per-move timer, reset each turn)
  timerBlack: number;
  turnStartedAt: number | null; // timestamp when current turn began
  turnTimer: ReturnType<typeof setTimeout> | null;
  // Custom lobby
  isCustom: boolean;
  lobbyCode: string | null;
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
  authenticate: (data: { token: string }) => void;
  joinQueue: (data: { timerMode?: TimerMode }) => void;
  leaveQueue: () => void;
  createRoom: (data: { timerMode?: TimerMode }) => void;
  joinRoom: (data: { roomId: string }) => void;
  createCustomLobby: (data: { timerMode?: TimerMode }) => void;
  joinCustomLobby: (data: { code: string }) => void;
  joinAsArbiter: (data: { roomId: string }) => void;
  submitSetup: (data: { pieces: SerializedPiece[] }) => void;
  makeMove: (data: { pieceId: string; toRow: number; toCol: number }) => void;
  requestRematch: () => void;
  resign: () => void;
  getReplay: (data: { replayId: string }) => void;
  getLeaderboard: (data: { limit?: number; offset?: number }) => void;
}

// Server -> Client events
export interface ServerToClientEvents {
  authenticated: (data: { uid: string; username: string; elo: number }) => void;
  authError: (data: { message: string }) => void;
  queueUpdate: (data: { position: number; playersInQueue: number }) => void;
  matchFound: (data: { roomId: string; color: 'white' | 'black'; opponent: string; opponentElo: number; timerMode: TimerMode }) => void;
  roomJoined: (data: { roomId: string; color: 'white' | 'black' }) => void;
  roomCreated: (data: { roomId: string }) => void;
  lobbyCreated: (data: { code: string; roomId: string }) => void;
  opponentJoined: (data: { opponent: string; opponentElo: number }) => void;
  setupPhase: () => void;
  opponentReady: () => void;
  gameStart: (data: { currentPlayer: 'white' | 'black'; timerMode: TimerMode }) => void;
  moveMade: (data: {
    pieceId: string;
    fromRow: number;
    fromCol: number;
    toRow: number;
    toCol: number;
    challenge?: { result: string; eliminatedPieceIds: string[] };
    currentPlayer: 'white' | 'black';
    turnCount: number;
    timerWhite: number;
    timerBlack: number;
  }) => void;
  timerUpdate: (data: { white: number; black: number; currentPlayer: 'white' | 'black' }) => void;
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
  leaderboard: (data: { players: Array<{ username: string; elo: number; wins: number; losses: number; rank: number }> }) => void;
}
