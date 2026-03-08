// Game of the Generals - Game Engine

import {
  Rank,
  RANK_POWER,
  PIECE_COUNTS,
  Player,
  GamePhase,
  Position,
  Piece,
  ChallengeResult,
  Challenge,
  Move,
  GameState,
  BOARD_ROWS,
  BOARD_COLS,
} from './types';

// Generate the initial set of pieces for a player (unplaced)
export function createPlayerPieces(owner: Player): Piece[] {
  const pieces: Piece[] = [];
  let idCounter = 0;

  for (const [rank, count] of Object.entries(PIECE_COUNTS)) {
    for (let i = 0; i < count; i++) {
      pieces.push({
        id: `${owner}-${rank}-${idCounter++}`,
        rank: rank as Rank,
        owner,
        position: null,
        isEliminated: false,
      });
    }
  }

  return pieces;
}

// Create initial game state
export function createInitialGameState(): GameState {
  return {
    phase: GamePhase.Setup,
    pieces: [
      ...createPlayerPieces(Player.White),
      ...createPlayerPieces(Player.Black),
    ],
    currentPlayer: Player.White,
    winner: null,
    winReason: null,
    moveHistory: [],
    flagReachedBackRank: null,
    turnCount: 0,
    eliminatedPieces: { white: [], black: [] },
  };
}

// Check if a position is within the board
export function isValidPosition(pos: Position): boolean {
  return pos.row >= 0 && pos.row < BOARD_ROWS && pos.col >= 0 && pos.col < BOARD_COLS;
}

// Check if position is in setup zone for given player
export function isInSetupZone(pos: Position, player: Player): boolean {
  if (player === Player.White) {
    return pos.row >= 0 && pos.row <= 2;
  }
  return pos.row >= 5 && pos.row <= 7;
}

// Get piece at a given position
export function getPieceAtPosition(pieces: Piece[], pos: Position): Piece | undefined {
  return pieces.find(
    (p) => p.position && p.position.row === pos.row && p.position.col === pos.col && !p.isEliminated
  );
}

// Determine the result of a challenge between attacker and defender
export function resolveChallenge(attacker: Piece, defender: Piece): ChallengeResult {
  const aRank = attacker.rank;
  const dRank = defender.rank;

  // Flag vs Flag: challenger (attacker) wins
  if (aRank === Rank.Flag && dRank === Rank.Flag) {
    return ChallengeResult.FlagCaptured;
  }

  // Any piece challenging the Flag eliminates it
  if (dRank === Rank.Flag) {
    return ChallengeResult.FlagCaptured;
  }

  // If attacker is a Flag challenging a non-Flag, attacker loses
  if (aRank === Rank.Flag) {
    return ChallengeResult.DefenderWins;
  }

  // Spy rules
  if (aRank === Rank.Spy && dRank === Rank.Spy) {
    return ChallengeResult.BothEliminated;
  }
  if (aRank === Rank.Spy) {
    // Spy eliminates all officers (all non-Private, non-Spy, non-Flag)
    if (dRank === Rank.Private) {
      return ChallengeResult.DefenderWins; // Private kills Spy
    }
    return ChallengeResult.AttackerWins; // Spy kills officers
  }
  if (dRank === Rank.Spy) {
    // Only Private can kill Spy
    if (aRank === Rank.Private) {
      return ChallengeResult.AttackerWins; // Private kills Spy
    }
    return ChallengeResult.DefenderWins; // Spy kills attacker (officer)
  }

  // Same rank: both eliminated
  if (aRank === dRank) {
    return ChallengeResult.BothEliminated;
  }

  // Compare rank power
  const aPower = RANK_POWER[aRank];
  const dPower = RANK_POWER[dRank];

  if (aPower > dPower) {
    return ChallengeResult.AttackerWins;
  }
  return ChallengeResult.DefenderWins;
}

// Get all valid moves for a piece
export function getValidMoves(piece: Piece, pieces: Piece[]): Position[] {
  if (!piece.position || piece.isEliminated) return [];

  const { row, col } = piece.position;
  const directions = [
    { row: -1, col: 0 }, // up (toward black's side for white)
    { row: 1, col: 0 },  // down
    { row: 0, col: -1 }, // left
    { row: 0, col: 1 },  // right
  ];

  const validMoves: Position[] = [];

  for (const dir of directions) {
    const newPos = { row: row + dir.row, col: col + dir.col };
    if (!isValidPosition(newPos)) continue;

    const occupant = getPieceAtPosition(pieces, newPos);
    if (occupant) {
      // Can only move to squares occupied by enemy pieces (challenge)
      if (occupant.owner !== piece.owner) {
        validMoves.push(newPos);
      }
      // Can't move to squares occupied by friendly pieces
    } else {
      validMoves.push(newPos);
    }
  }

  return validMoves;
}

// Get the back rank row for the opponent (where flag must reach)
export function getOpponentBackRank(player: Player): number {
  return player === Player.White ? 7 : 0;
}

// Check if a piece has an adjacent enemy piece  
export function hasAdjacentEnemy(pos: Position, pieces: Piece[], owner: Player): boolean {
  const directions = [
    { row: -1, col: 0 },
    { row: 1, col: 0 },
    { row: 0, col: -1 },
    { row: 0, col: 1 },
  ];

  for (const dir of directions) {
    const adjPos = { row: pos.row + dir.row, col: pos.col + dir.col };
    if (!isValidPosition(adjPos)) continue;
    const occupant = getPieceAtPosition(pieces, adjPos);
    if (occupant && occupant.owner !== owner && !occupant.isEliminated) {
      return true;
    }
  }
  return false;
}

// Execute a move and return updated game state
export function executeMove(state: GameState, pieceId: string, to: Position): GameState {
  const newState = structuredClone(state);
  const piece = newState.pieces.find((p) => p.id === pieceId);
  if (!piece || !piece.position || piece.isEliminated) {
    throw new Error('Invalid piece');
  }
  if (piece.owner !== newState.currentPlayer) {
    throw new Error('Not your turn');
  }

  const validMoves = getValidMoves(piece, newState.pieces);
  const isValid = validMoves.some((m) => m.row === to.row && m.col === to.col);
  if (!isValid) {
    throw new Error('Invalid move');
  }

  const from = { ...piece.position };
  const defender = getPieceAtPosition(newState.pieces, to);
  let challenge: Challenge | undefined;

  if (defender) {
    // Challenge!
    const result = resolveChallenge(piece, defender);
    challenge = { attacker: { ...piece }, defender: { ...defender }, result };

    const defenderInState = newState.pieces.find((p) => p.id === defender.id)!;

    switch (result) {
      case ChallengeResult.AttackerWins:
        defenderInState.isEliminated = true;
        defenderInState.position = null;
        newState.eliminatedPieces[defender.owner === Player.White ? 'white' : 'black'].push({ ...defenderInState });
        piece.position = to;
        break;

      case ChallengeResult.DefenderWins:
        piece.isEliminated = true;
        piece.position = null;
        newState.eliminatedPieces[piece.owner === Player.White ? 'white' : 'black'].push({ ...piece });
        break;

      case ChallengeResult.BothEliminated:
        piece.isEliminated = true;
        piece.position = null;
        defenderInState.isEliminated = true;
        defenderInState.position = null;
        newState.eliminatedPieces[piece.owner === Player.White ? 'white' : 'black'].push({ ...piece });
        newState.eliminatedPieces[defender.owner === Player.White ? 'white' : 'black'].push({ ...defenderInState });
        break;

      case ChallengeResult.FlagCaptured:
        // Defender's flag was captured - attacker wins the game
        defenderInState.isEliminated = true;
        defenderInState.position = null;
        newState.eliminatedPieces[defender.owner === Player.White ? 'white' : 'black'].push({ ...defenderInState });
        piece.position = to;
        newState.winner = piece.owner;
        newState.winReason = `${piece.owner === Player.White ? 'White' : 'Black'} captured the opponent's Flag!`;
        newState.phase = GamePhase.GameOver;
        break;
    }
  } else {
    // Normal move
    piece.position = to;
  }

  // Record move
  newState.moveHistory.push({
    pieceId,
    from,
    to,
    challenge,
  });

  // Check flag reaching back rank (only if game is not over)
  if (newState.phase !== GamePhase.GameOver) {
    const backRank = getOpponentBackRank(newState.currentPlayer);
    if (piece.rank === Rank.Flag && piece.position && piece.position.row === backRank) {
      // Flag reached opponent's back rank
      if (!hasAdjacentEnemy(piece.position, newState.pieces, piece.owner)) {
        // No adjacent enemy -> immediate win
        newState.winner = piece.owner;
        newState.winReason = `${piece.owner === Player.White ? 'White' : 'Black'}'s Flag reached the opponent's back rank unopposed!`;
        newState.phase = GamePhase.GameOver;
      } else {
        // Has adjacent enemy -> must survive one more turn
        newState.flagReachedBackRank = {
          player: piece.owner,
          turnReached: newState.turnCount,
        };
      }
    }

    // Check if there was a flag on the back rank from previous turn
    if (newState.flagReachedBackRank && newState.flagReachedBackRank.player !== newState.currentPlayer) {
      // The opponent's flag was on the back rank and they just made a move without challenging it
      const flagOwner = newState.flagReachedBackRank.player;
      const flag = newState.pieces.find(
        (p) => p.rank === Rank.Flag && p.owner === flagOwner && !p.isEliminated
      );
      if (flag && flag.position) {
        const flagBackRank = getOpponentBackRank(flagOwner);
        if (flag.position.row === flagBackRank) {
          // Flag is still on back rank and wasn't challenged - flag owner wins
          newState.winner = flagOwner;
          newState.winReason = `${flagOwner === Player.White ? 'White' : 'Black'}'s Flag survived on the opponent's back rank!`;
          newState.phase = GamePhase.GameOver;
        }
      }
    }
  }

  // Switch turns
  newState.turnCount++;
  newState.currentPlayer = newState.currentPlayer === Player.White ? Player.Black : Player.White;

  return newState;
}

// Check if a player has any valid moves
export function hasValidMoves(state: GameState, player: Player): boolean {
  const playerPieces = state.pieces.filter((p) => p.owner === player && !p.isEliminated && p.position);
  return playerPieces.some((p) => getValidMoves(p, state.pieces).length > 0);
}

// Validate that setup is complete for a player
export function isSetupComplete(pieces: Piece[], player: Player): boolean {
  const playerPieces = pieces.filter((p) => p.owner === player);
  return playerPieces.every((p) => p.position !== null);
}

// Generate a random setup for a player (for AI or quick start)
export function generateRandomSetup(pieces: Piece[], player: Player): Piece[] {
  const newPieces = structuredClone(pieces);
  const playerPieces = newPieces.filter((p) => p.owner === player);

  // Determine setup rows
  const startRow = player === Player.White ? 0 : 5;
  const availablePositions: Position[] = [];

  for (let r = startRow; r < startRow + 3; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      availablePositions.push({ row: r, col: c });
    }
  }

  // Shuffle positions
  for (let i = availablePositions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [availablePositions[i], availablePositions[j]] = [availablePositions[j], availablePositions[i]];
  }

  // Assign positions to pieces
  playerPieces.forEach((piece, idx) => {
    piece.position = availablePositions[idx];
  });

  return newPieces;
}
