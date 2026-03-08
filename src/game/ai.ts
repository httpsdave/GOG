// Simple AI opponent for Game of the Generals

import {
  Player,
  Piece,
  Position,
  GameState,
  Rank,
  RANK_POWER,
  ChallengeResult,
} from './types';
import { getValidMoves, getPieceAtPosition, getOpponentBackRank, resolveChallenge } from './engine';

interface ScoredMove {
  pieceId: string;
  to: Position;
  score: number;
}

export function getAIMove(state: GameState, aiPlayer: Player): { pieceId: string; to: Position } | null {
  const aiPieces = state.pieces.filter(
    (p) => p.owner === aiPlayer && !p.isEliminated && p.position
  );

  if (aiPieces.length === 0) return null;

  const scoredMoves: ScoredMove[] = [];

  for (const piece of aiPieces) {
    const moves = getValidMoves(piece, state.pieces);
    for (const to of moves) {
      const score = evaluateMove(piece, to, state, aiPlayer);
      scoredMoves.push({ pieceId: piece.id, to, score });
    }
  }

  if (scoredMoves.length === 0) return null;

  // Sort by score descending
  scoredMoves.sort((a, b) => b.score - a.score);

  // Pick from top moves with some randomness for variety
  const topScore = scoredMoves[0].score;
  const topMoves = scoredMoves.filter((m) => m.score >= topScore - 2);
  const chosen = topMoves[Math.floor(Math.random() * topMoves.length)];

  return { pieceId: chosen.pieceId, to: chosen.to };
}

function evaluateMove(
  piece: Piece,
  to: Position,
  state: GameState,
  aiPlayer: Player
): number {
  let score = 0;
  const opponent = aiPlayer === Player.White ? Player.Black : Player.White;
  const defender = getPieceAtPosition(state.pieces, to);

  if (defender) {
    // Challenge - we don't know enemy ranks in fog of war, so use heuristics
    // AI can "see" its own pieces (it knows its own ranks)
    // In a real fog-of-war game, AI wouldn't know enemy ranks
    // For local play, we let AI see enemy ranks to make it competent
    const result = resolveChallenge(piece, defender);

    switch (result) {
      case ChallengeResult.AttackerWins:
        score += 10 + RANK_POWER[defender.rank];
        break;
      case ChallengeResult.DefenderWins:
        score -= 5 + RANK_POWER[piece.rank];
        break;
      case ChallengeResult.BothEliminated:
        score += RANK_POWER[defender.rank] - RANK_POWER[piece.rank];
        break;
      case ChallengeResult.FlagCaptured:
        score += 100; // Capture enemy flag = highest priority
        break;
    }

    // Don't risk the Flag
    if (piece.rank === Rank.Flag) {
      score -= 50;
    }

    // Don't send Spy against private
    if (piece.rank === Rank.Spy && defender.rank === Rank.Private) {
      score -= 20;
    }
  } else {
    // Normal move
    const backRank = getOpponentBackRank(aiPlayer);
    const forwardDirection = aiPlayer === Player.White ? 1 : -1;

    // Slight preference for forward movement
    if (to.row === piece.position!.row + forwardDirection) {
      score += 1;
    }

    // Flag: try to advance if path seems clear, but be cautious
    if (piece.rank === Rank.Flag) {
      // Count enemy pieces remaining
      const enemyCount = state.pieces.filter(
        (p) => p.owner === opponent && !p.isEliminated
      ).length;

      if (enemyCount <= 5) {
        // Late game: try to advance flag
        const distToBackRank = Math.abs(to.row - backRank);
        score += (7 - distToBackRank) * 2;
      } else {
        // Keep flag safe in early game
        score -= 3;
      }
    }

    // Move toward center columns slightly
    const centerDist = Math.abs(to.col - 4);
    score += (4 - centerDist) * 0.3;
  }

  // Small random factor
  score += Math.random() * 1.5;

  return score;
}
