// Theme definitions for board maps

export type ThemeId = 'vintage' | 'modern' | 'forest' | 'night';

export interface BoardTheme {
  id: ThemeId;
  name: string;
  description: string;
  // Board colors
  lightSquare: string;
  darkSquare: string;
  boardBorder: string;
  // Square states
  selectedSquare: string;
  validMoveSquare: string;
  validMoveDot: string;
  challengeSquare: string;
  lastMoveSquare: string;
  setupTargetSquare: string;
  // Piece styling
  whitePieceBg: string;
  whitePieceText: string;
  whitePieceBorder: string;
  blackPieceBg: string;
  blackPieceText: string;
  blackPieceBorder: string;
  // Labels
  labelColor: string;
  // Background
  pageBg: string;
  panelBg: string;
  panelBorder: string;
  panelText: string;
  panelTextMuted: string;
  // Accents
  accentPrimary: string;
  accentSuccess: string;
  accentDanger: string;
  headerColor: string;
}

export const THEMES: Record<ThemeId, BoardTheme> = {
  vintage: {
    id: 'vintage',
    name: 'Old Map',
    description: 'Classic yellowed parchment',
    lightSquare: 'bg-[#e8d5a3]',
    darkSquare: 'bg-[#c4a265]',
    boardBorder: 'border-[#8b6914]',
    selectedSquare: 'bg-[#b8860b]',
    validMoveSquare: 'bg-[#d4b896]',
    validMoveDot: 'bg-[#8b6914]/60',
    challengeSquare: 'bg-[#a0522d]',
    lastMoveSquare: 'bg-[#dcc07a]',
    setupTargetSquare: 'bg-[#d2c4a0]',
    whitePieceBg: 'bg-[#f5f0e1]',
    whitePieceText: 'text-[#3d2b1f]',
    whitePieceBorder: 'border-[#8b7355]',
    blackPieceBg: 'bg-[#3d2b1f]',
    blackPieceText: 'text-[#f5f0e1]',
    blackPieceBorder: 'border-[#6b4e37]',
    labelColor: 'text-[#6b4e37]',
    pageBg: 'bg-[#2c1810]',
    panelBg: 'bg-[#3d2b1f]/90',
    panelBorder: 'border-[#6b4e37]',
    panelText: 'text-[#e8d5a3]',
    panelTextMuted: 'text-[#a0896a]',
    accentPrimary: 'bg-[#8b6914]',
    accentSuccess: 'bg-[#6b7c3f]',
    accentDanger: 'bg-[#8b2500]',
    headerColor: 'text-[#d4a843]',
  },

  modern: {
    id: 'modern',
    name: 'Modern',
    description: 'Clean military ops board',
    lightSquare: 'bg-[#d4d8dc]',
    darkSquare: 'bg-[#6b7b8d]',
    boardBorder: 'border-[#2d3748]',
    selectedSquare: 'bg-[#4299e1]',
    validMoveSquare: 'bg-[#68d391]/40',
    validMoveDot: 'bg-[#38a169]/60',
    challengeSquare: 'bg-[#fc8181]',
    lastMoveSquare: 'bg-[#bee3f8]',
    setupTargetSquare: 'bg-[#c3dafe]',
    whitePieceBg: 'bg-[#f7fafc]',
    whitePieceText: 'text-[#1a202c]',
    whitePieceBorder: 'border-[#a0aec0]',
    blackPieceBg: 'bg-[#1a202c]',
    blackPieceText: 'text-[#f7fafc]',
    blackPieceBorder: 'border-[#4a5568]',
    labelColor: 'text-[#a0aec0]',
    pageBg: 'bg-[#0f1419]',
    panelBg: 'bg-[#1a202c]/95',
    panelBorder: 'border-[#2d3748]',
    panelText: 'text-[#e2e8f0]',
    panelTextMuted: 'text-[#718096]',
    accentPrimary: 'bg-[#4299e1]',
    accentSuccess: 'bg-[#38a169]',
    accentDanger: 'bg-[#e53e3e]',
    headerColor: 'text-[#e2e8f0]',
  },

  forest: {
    id: 'forest',
    name: 'Jungle Ops',
    description: 'Dense forest terrain',
    lightSquare: 'bg-[#a8c090]',
    darkSquare: 'bg-[#5a7247]',
    boardBorder: 'border-[#2d4a1e]',
    selectedSquare: 'bg-[#8fbc5a]',
    validMoveSquare: 'bg-[#c8e6a0]',
    validMoveDot: 'bg-[#3d6b2e]/60',
    challengeSquare: 'bg-[#c05040]',
    lastMoveSquare: 'bg-[#bdd9a0]',
    setupTargetSquare: 'bg-[#b8d498]',
    whitePieceBg: 'bg-[#f0ebe0]',
    whitePieceText: 'text-[#2d3020]',
    whitePieceBorder: 'border-[#8a9070]',
    blackPieceBg: 'bg-[#2d3020]',
    blackPieceText: 'text-[#f0ebe0]',
    blackPieceBorder: 'border-[#4a5230]',
    labelColor: 'text-[#7a8a60]',
    pageBg: 'bg-[#1a2410]',
    panelBg: 'bg-[#2d3020]/90',
    panelBorder: 'border-[#4a5230]',
    panelText: 'text-[#d0dab0]',
    panelTextMuted: 'text-[#8a9a70]',
    accentPrimary: 'bg-[#5a8a3a]',
    accentSuccess: 'bg-[#4a7a2a]',
    accentDanger: 'bg-[#8b3020]',
    headerColor: 'text-[#a8c890]',
  },

  night: {
    id: 'night',
    name: 'Night Ops',
    description: 'Stealth night mission',
    lightSquare: 'bg-[#2a3040]',
    darkSquare: 'bg-[#1a2030]',
    boardBorder: 'border-[#0a1020]',
    selectedSquare: 'bg-[#1a4a7a]',
    validMoveSquare: 'bg-[#1a3a2a]',
    validMoveDot: 'bg-[#40c070]/50',
    challengeSquare: 'bg-[#6a2030]',
    lastMoveSquare: 'bg-[#2a3a50]',
    setupTargetSquare: 'bg-[#2a3a4a]',
    whitePieceBg: 'bg-[#c0c8d0]',
    whitePieceText: 'text-[#1a2030]',
    whitePieceBorder: 'border-[#8090a0]',
    blackPieceBg: 'bg-[#1a1a2a]',
    blackPieceText: 'text-[#80c0e0]',
    blackPieceBorder: 'border-[#304060]',
    labelColor: 'text-[#506070]',
    pageBg: 'bg-[#0a0e14]',
    panelBg: 'bg-[#101820]/95',
    panelBorder: 'border-[#1a2a3a]',
    panelText: 'text-[#90b0c0]',
    panelTextMuted: 'text-[#506070]',
    accentPrimary: 'bg-[#1a5a8a]',
    accentSuccess: 'bg-[#1a6a3a]',
    accentDanger: 'bg-[#8a2030]',
    headerColor: 'text-[#60a0c0]',
  },
};
