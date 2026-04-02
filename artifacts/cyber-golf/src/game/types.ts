export type ShadingMode = 'gouraud' | 'phong';

export interface Player {
  id: number;
  name: string;
  color: string;
  strokes: number[];
  totalStrokes: number;
  finished: boolean;
  ballInHole: boolean;
}

export interface GameState {
  phase: 'menu' | 'playing' | 'between-holes' | 'scoreboard';
  players: Player[];
  currentHole: number;
  totalHoles: number;
  activePlayerIndex: number;
  shadingMode: ShadingMode;
  levelRotation: number;
  isRotating: boolean;
  rotationCount: number;
}

export interface BallState {
  position: [number, number, number];
  velocity: [number, number, number];
  isMoving: boolean;
  isInHole: boolean;
  playerId: number;
}

export interface ObstacleData {
  type: 'box' | 'cylinder';
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  pulseSpeed: number;
  pulseAmp: number;
}

export interface LevelData {
  id: number;
  name: string;
  par: number;
  teePosition: [number, number, number];
  holePosition: [number, number, number];
  platforms: Array<{
    position: [number, number, number];
    size: [number, number, number];
  }>;
  walls: Array<{
    position: [number, number, number];
    size: [number, number, number];
  }>;
  obstacles: ObstacleData[];
  gravityDir: [number, number, number];
  physicsMode: 'normal' | 'low-gravity' | 'bouncy';
}

export const PLAYER_COLORS = [
  '#00f5ff', // cyan
  '#ff00aa', // pink
  '#39ff14', // green
  '#bf00ff', // purple
  '#ff6600', // orange
  '#ffff00', // yellow
  '#ff3333', // red
  '#ffffff', // white
];

export const PLAYER_COLOR_NAMES = [
  'Cyan', 'Pink', 'Green', 'Purple', 'Orange', 'Yellow', 'Red', 'White'
];
