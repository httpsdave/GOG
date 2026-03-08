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
  // Background decoration (SVG patterns as CSS properties)
  pageOverlayStyle?: React.CSSProperties;
  pageOverlayOpacity?: string; // tailwind opacity class e.g. 'opacity-[0.06]'
  boardOverlayStyle?: React.CSSProperties;
  boardOverlayOpacity?: string;
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
    // Old Map: parchment texture with compass roses, dotted paths, and X marks
    pageOverlayStyle: {
      backgroundImage: [
        // Compass rose pattern
        `url("data:image/svg+xml,%3Csvg width='200' height='200' viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%23d4a843' stroke-width='0.5'%3E%3Ccircle cx='100' cy='100' r='30'/%3E%3Ccircle cx='100' cy='100' r='20'/%3E%3Cline x1='100' y1='65' x2='100' y2='135'/%3E%3Cline x1='65' y1='100' x2='135' y2='100'/%3E%3Cline x1='79' y1='79' x2='121' y2='121'/%3E%3Cline x1='121' y1='79' x2='79' y2='121'/%3E%3Cpolygon fill='%23d4a843' points='100,65 96,85 104,85'/%3E%3Cpolygon fill='%23d4a843' points='135,100 115,96 115,104'/%3E%3C/g%3E%3C/svg%3E")`,
        // Dotted treasure trail
        `url("data:image/svg+xml,%3Csvg width='120' height='120' viewBox='0 0 120 120' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%238b6914'%3E%3Ccircle cx='10' cy='10' r='1.5'/%3E%3Ccircle cx='25' cy='20' r='1.5'/%3E%3Ccircle cx='40' cy='15' r='1.5'/%3E%3Ccircle cx='55' cy='25' r='1.5'/%3E%3Ccircle cx='70' cy='20' r='1.5'/%3E%3Ccircle cx='85' cy='30' r='1.5'/%3E%3Ccircle cx='95' cy='45' r='1.5'/%3E%3Ccircle cx='105' cy='60' r='1.5'/%3E%3Ccircle cx='100' cy='80' r='1.5'/%3E%3Ccircle cx='90' cy='95' r='1.5'/%3E%3Ccircle cx='75' cy='105' r='1.5'/%3E%3C/g%3E%3Cg stroke='%238b2500' stroke-width='2' fill='none'%3E%3Cline x1='70' y1='98' x2='82' y2='110'/%3E%3Cline x1='82' y1='98' x2='70' y2='110'/%3E%3C/g%3E%3C/svg%3E")`,
      ].join(','),
    },
    pageOverlayOpacity: 'opacity-[0.07]',
    // Board overlay: aged paper grain with faint coastline waves
    boardOverlayStyle: {
      backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%238b6914' stroke-width='0.3' opacity='0.4'%3E%3Cpath d='M0,50 Q25,45 50,52 T100,48'/%3E%3Cpath d='M0,70 Q30,65 60,72 T100,68'/%3E%3C/g%3E%3Cg fill='%236b4e37' opacity='0.15'%3E%3Ccircle cx='20' cy='30' r='0.8'/%3E%3Ccircle cx='60' cy='15' r='0.6'/%3E%3Ccircle cx='80' cy='55' r='0.7'/%3E%3Ccircle cx='35' cy='80' r='0.9'/%3E%3Ccircle cx='90' cy='85' r='0.5'/%3E%3C/g%3E%3C/svg%3E")`,
    },
    boardOverlayOpacity: 'opacity-[0.35]',
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
    // Modern: technical grid, blueprint lines, tank/gear silhouettes
    pageOverlayStyle: {
      backgroundImage: [
        // Technical grid
        `url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%234299e1' stroke-width='0.3'%3E%3Crect x='0' y='0' width='80' height='80'/%3E%3Cline x1='40' y1='0' x2='40' y2='80'/%3E%3Cline x1='0' y1='40' x2='80' y2='40'/%3E%3Cline x1='20' y1='0' x2='20' y2='80' stroke-dasharray='2,4'/%3E%3Cline x1='60' y1='0' x2='60' y2='80' stroke-dasharray='2,4'/%3E%3Cline x1='0' y1='20' x2='80' y2='20' stroke-dasharray='2,4'/%3E%3Cline x1='0' y1='60' x2='80' y2='60' stroke-dasharray='2,4'/%3E%3C/g%3E%3C/svg%3E")`,
        // Tank/gear schematic
        `url("data:image/svg+xml,%3Csvg width='300' height='300' viewBox='0 0 300 300' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%234a5568' stroke-width='0.5'%3E%3Ccircle cx='150' cy='150' r='40'/%3E%3Ccircle cx='150' cy='150' r='25'/%3E%3Ccircle cx='150' cy='150' r='6'/%3E%3Cline x1='150' y1='105' x2='150' y2='195'/%3E%3Cline x1='105' y1='150' x2='195' y2='150'/%3E%3Crect x='115' y='220' width='70' height='25' rx='4'/%3E%3Ccircle cx='125' cy='245' r='8'/%3E%3Ccircle cx='145' cy='245' r='8'/%3E%3Ccircle cx='165' cy='245' r='8'/%3E%3Crect x='135' y='210' width='30' height='12' rx='2'/%3E%3Cline x1='150' y1='200' x2='150' y2='210'/%3E%3C/g%3E%3Cg fill='none' stroke='%232d3748' stroke-width='0.4'%3E%3Cpath d='M40,40 L60,40 L55,30 L45,30 Z'/%3E%3Ccircle cx='50' cy='36' r='3'/%3E%3Cpath d='M240,60 L260,60 L255,50 L245,50 Z'/%3E%3C/g%3E%3C/svg%3E")`,
      ].join(','),
    },
    pageOverlayOpacity: 'opacity-[0.06]',
    // Board: subtle crosshair grid
    boardOverlayStyle: {
      backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%234299e1' stroke-width='0.2' opacity='0.3'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3Cline x1='30' y1='25' x2='30' y2='35'/%3E%3Cline x1='25' y1='30' x2='35' y2='30'/%3E%3C/g%3E%3C/svg%3E")`,
    },
    boardOverlayOpacity: 'opacity-[0.25]',
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
    // Jungle: palm trees, camo pattern, tropical foliage
    pageOverlayStyle: {
      backgroundImage: [
        // Palm / coconut tree silhouettes
        `url("data:image/svg+xml,%3Csvg width='250' height='350' viewBox='0 0 250 350' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%233d6b2e' stroke-width='0.8'%3E%3Cpath d='M80,350 Q82,280 85,220 Q86,200 84,180'/%3E%3Cpath d='M84,180 Q60,160 30,155' stroke-width='1.2'/%3E%3Cpath d='M84,180 Q100,155 130,150' stroke-width='1.2'/%3E%3Cpath d='M84,180 Q70,150 55,130' stroke-width='1'/%3E%3Cpath d='M84,180 Q100,148 120,130' stroke-width='1'/%3E%3Cpath d='M84,180 Q84,150 82,120' stroke-width='0.8'/%3E%3Cpath d='M30,155 Q45,158 60,162' stroke-width='0.4'/%3E%3Cpath d='M130,150 Q115,155 100,162' stroke-width='0.4'/%3E%3C/g%3E%3Cg fill='none' stroke='%234a5230' stroke-width='0.6'%3E%3Cpath d='M200,350 Q202,300 205,260 Q206,240 204,220'/%3E%3Cpath d='M204,220 Q180,205 160,200' stroke-width='0.9'/%3E%3Cpath d='M204,220 Q225,200 245,195' stroke-width='0.9'/%3E%3Cpath d='M204,220 Q195,195 185,175' stroke-width='0.7'/%3E%3Cpath d='M204,220 Q215,195 230,175' stroke-width='0.7'/%3E%3C/g%3E%3Cg fill='%232d4a1e' opacity='0.3'%3E%3Cellipse cx='40' cy='340' rx='30' ry='6'/%3E%3Cellipse cx='170' cy='330' rx='20' ry='4'/%3E%3Cellipse cx='220' cy='345' rx='15' ry='3'/%3E%3C/g%3E%3C/svg%3E")`,
        // Camo spots
        `url("data:image/svg+xml,%3Csvg width='150' height='150' viewBox='0 0 150 150' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%233d6b2e' opacity='0.3'%3E%3Cellipse cx='30' cy='25' rx='18' ry='12' transform='rotate(-15 30 25)'/%3E%3Cellipse cx='100' cy='40' rx='22' ry='10' transform='rotate(20 100 40)'/%3E%3Cellipse cx='60' cy='90' rx='15' ry='10' transform='rotate(-30 60 90)'/%3E%3Cellipse cx='120' cy='110' rx='20' ry='8' transform='rotate(10 120 110)'/%3E%3Cellipse cx='20' cy='130' rx='14' ry='9' transform='rotate(25 20 130)'/%3E%3C/g%3E%3Cg fill='%234a5230' opacity='0.2'%3E%3Cellipse cx='70' cy='50' rx='12' ry='8' transform='rotate(45 70 50)'/%3E%3Cellipse cx='130' cy='80' rx='10' ry='14' transform='rotate(-20 130 80)'/%3E%3C/g%3E%3C/svg%3E")`,
      ].join(','),
    },
    pageOverlayOpacity: 'opacity-[0.10]',
    // Board: subtle leaf veins and undergrowth
    boardOverlayStyle: {
      backgroundImage: `url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%232d4a1e' stroke-width='0.3' opacity='0.25'%3E%3Cpath d='M10,70 Q25,55 40,60 Q55,65 70,50'/%3E%3Cpath d='M5,40 Q20,30 35,35 Q50,40 65,28'/%3E%3Cpath d='M40,60 Q42,50 40,40'/%3E%3Cpath d='M35,35 Q30,25 35,15'/%3E%3C/g%3E%3C/svg%3E")`,
    },
    boardOverlayOpacity: 'opacity-[0.30]',
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
    // Night Ops: stars, radar sweep, night-vision grid, stealth elements
    pageOverlayStyle: {
      backgroundImage: [
        // Starfield
        `url("data:image/svg+xml,%3Csvg width='200' height='200' viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%2360a0c0'%3E%3Ccircle cx='25' cy='15' r='0.8'/%3E%3Ccircle cx='80' cy='35' r='0.5'/%3E%3Ccircle cx='150' cy='20' r='1'/%3E%3Ccircle cx='45' cy='70' r='0.6'/%3E%3Ccircle cx='120' cy='55' r='0.4'/%3E%3Ccircle cx='175' cy='80' r='0.7'/%3E%3Ccircle cx='30' cy='110' r='0.5'/%3E%3Ccircle cx='95' cy='100' r='0.9'/%3E%3Ccircle cx='160' cy='120' r='0.6'/%3E%3Ccircle cx='60' cy='150' r='0.5'/%3E%3Ccircle cx='130' cy='160' r='0.7'/%3E%3Ccircle cx='15' cy='180' r='0.4'/%3E%3Ccircle cx='185' cy='170' r='0.8'/%3E%3Ccircle cx='100' cy='185' r='0.5'/%3E%3C/g%3E%3C/svg%3E")`,
        // Radar sweep / scope
        `url("data:image/svg+xml,%3Csvg width='300' height='300' viewBox='0 0 300 300' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%2340c070' stroke-width='0.4'%3E%3Ccircle cx='150' cy='150' r='60'/%3E%3Ccircle cx='150' cy='150' r='40'/%3E%3Ccircle cx='150' cy='150' r='20'/%3E%3Ccircle cx='150' cy='150' r='3' fill='%2340c070'/%3E%3Cline x1='150' y1='85' x2='150' y2='215'/%3E%3Cline x1='85' y1='150' x2='215' y2='150'/%3E%3Cpath d='M150,150 L185,100' stroke-width='0.8' stroke='%2340c070' opacity='0.6'/%3E%3C/g%3E%3Cg fill='%2340c070' opacity='0.5'%3E%3Ccircle cx='170' cy='130' r='2'/%3E%3Ccircle cx='130' cy='165' r='1.5'/%3E%3Ccircle cx='160' cy='175' r='1'/%3E%3C/g%3E%3C/svg%3E")`,
      ].join(','),
    },
    pageOverlayOpacity: 'opacity-[0.08]',
    // Board: night-vision scanlines
    boardOverlayStyle: {
      backgroundImage: [
        `url("data:image/svg+xml,%3Csvg width='4' height='4' viewBox='0 0 4 4' xmlns='http://www.w3.org/2000/svg'%3E%3Cline x1='0' y1='2' x2='4' y2='2' stroke='%2340c070' stroke-width='0.3' opacity='0.15'/%3E%3C/svg%3E")`,
      ].join(','),
    },
    boardOverlayOpacity: 'opacity-[0.40]',
  },
};
