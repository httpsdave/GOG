// Game of the Generals - Core Types

export enum Rank {
  FiveStarGeneral = '5*G',
  FourStarGeneral = '4*G',
  ThreeStarGeneral = '3*G',
  TwoStarGeneral = '2*G',
  OneStarGeneral = '1*G',
  Colonel = 'COL',
  LieutenantColonel = 'LTC',
  Major = 'MAJ',
  Captain = 'CPT',
  FirstLieutenant = '1LT',
  SecondLieutenant = '2LT',
  Sergeant = 'SGT',
  Private = 'PVT',
  Spy = 'SPY',
  Flag = 'FLG',
}

// Rank power for determining challenge outcomes (higher = stronger)
// Spy and Flag have special rules handled separately
export const RANK_POWER: Record<Rank, number> = {
  [Rank.FiveStarGeneral]: 14,
  [Rank.FourStarGeneral]: 13,
  [Rank.ThreeStarGeneral]: 12,
  [Rank.TwoStarGeneral]: 11,
  [Rank.OneStarGeneral]: 10,
  [Rank.Colonel]: 9,
  [Rank.LieutenantColonel]: 8,
  [Rank.Major]: 7,
  [Rank.Captain]: 6,
  [Rank.FirstLieutenant]: 5,
  [Rank.SecondLieutenant]: 4,
  [Rank.Sergeant]: 3,
  [Rank.Private]: 2,
  [Rank.Spy]: 1,
  [Rank.Flag]: 0,
};

export const RANK_DISPLAY_NAME: Record<Rank, string> = {
  [Rank.FiveStarGeneral]: '5-Star General',
  [Rank.FourStarGeneral]: '4-Star General',
  [Rank.ThreeStarGeneral]: '3-Star General',
  [Rank.TwoStarGeneral]: '2-Star General',
  [Rank.OneStarGeneral]: '1-Star General',
  [Rank.Colonel]: 'Colonel',
  [Rank.LieutenantColonel]: 'Lt. Colonel',
  [Rank.Major]: 'Major',
  [Rank.Captain]: 'Captain',
  [Rank.FirstLieutenant]: '1st Lieutenant',
  [Rank.SecondLieutenant]: '2nd Lieutenant',
  [Rank.Sergeant]: 'Sergeant',
  [Rank.Private]: 'Private',
  [Rank.Spy]: 'Spy',
  [Rank.Flag]: 'Flag',
};

// How many of each piece per player
export const PIECE_COUNTS: Record<Rank, number> = {
  [Rank.FiveStarGeneral]: 1,
  [Rank.FourStarGeneral]: 1,
  [Rank.ThreeStarGeneral]: 1,
  [Rank.TwoStarGeneral]: 1,
  [Rank.OneStarGeneral]: 1,
  [Rank.Colonel]: 1,
  [Rank.LieutenantColonel]: 1,
  [Rank.Major]: 1,
  [Rank.Captain]: 1,
  [Rank.FirstLieutenant]: 1,
  [Rank.SecondLieutenant]: 1,
  [Rank.Sergeant]: 1,
  [Rank.Private]: 6,
  [Rank.Spy]: 2,
  [Rank.Flag]: 1,
};

export enum Player {
  White = 'white',
  Black = 'black',
}

export enum GamePhase {
  Setup = 'setup',
  Playing = 'playing',
  GameOver = 'gameover',
}

export interface Position {
  row: number; // 0-7 (0 = white's back rank, 7 = black's back rank)
  col: number; // 0-8 (A-I)
}

export interface Piece {
  id: string;
  rank: Rank;
  owner: Player;
  position: Position | null; // null if eliminated or not placed yet
  isEliminated: boolean;
}

export enum ChallengeResult {
  AttackerWins = 'attacker_wins',
  DefenderWins = 'defender_wins',
  BothEliminated = 'both_eliminated',
  FlagCaptured = 'flag_captured', // Attacker captures defender's flag -> game over
}

export interface Challenge {
  attacker: Piece;
  defender: Piece;
  result: ChallengeResult;
}

export interface Move {
  pieceId: string;
  from: Position;
  to: Position;
  challenge?: Challenge;
}

export interface GameState {
  phase: GamePhase;
  pieces: Piece[];
  currentPlayer: Player;
  winner: Player | null;
  winReason: string | null;
  moveHistory: Move[];
  flagReachedBackRank: { player: Player; turnReached: number } | null;
  turnCount: number;
  eliminatedPieces: { white: Piece[]; black: Piece[] };
}

// Board dimensions
export const BOARD_ROWS = 8;
export const BOARD_COLS = 9;
export const PIECES_PER_PLAYER = 21;
export const SETUP_ROWS = 3; // each player places in their nearest 3 rows
export const SETUP_SQUARES = SETUP_ROWS * BOARD_COLS; // 27
export const EMPTY_SETUP_SQUARES = SETUP_SQUARES - PIECES_PER_PLAYER; // 6

export const COLUMN_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
