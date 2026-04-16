export enum Terrain {
  Plains,
  Forest,
  Mountain,
  Road,
  Water,
  Bridge,
}

export enum UnitType {
  Infantry,
  Mech,
  Tank,
  Artillery,
  Recon,
}

export enum Team {
  Red,
  Blue,
}

export interface TerrainInfo {
  type: Terrain;
  name: string;
  moveCost: Record<UnitType, number>; // Infinity = impassable
  defense: number;
  color: string;
}

export interface UnitStats {
  type: UnitType;
  name: string;
  maxHP: number;
  move: number;
  attack: number;
  minRange: number;
  maxRange: number;
  isIndirect: boolean;
}

export interface Unit {
  id: number;
  type: UnitType;
  team: Team;
  hp: number;
  x: number;
  y: number;
  moved: boolean;
  acted: boolean;
}

export interface Tile {
  terrain: Terrain;
  unit: Unit | null;
}

export enum GamePhase {
  PlayerTurn,
  SelectUnit,
  ShowMoveRange,
  UnitMoving,
  ActionMenu,
  SelectAttackTarget,
  CombatAnimation,
  AITurn,
  GameOver,
}

export interface GameState {
  map: Tile[][];
  units: Unit[];
  currentTeam: Team;
  phase: GamePhase;
  turnCount: number;
  selectedUnit: Unit | null;
  cursorX: number;
  cursorY: number;
  moveRange: Set<string>;
  attackRange: Set<string>;
  attackTargets: Unit[];
  movePath: { x: number; y: number }[];
  winner: Team | null;
  animationQueue: Animation[];
}

export interface Animation {
  type: 'move' | 'attack' | 'destroy' | 'phaseChange';
  unit?: Unit;
  from?: { x: number; y: number };
  to?: { x: number; y: number };
  target?: Unit;
  damage?: number;
  counterDamage?: number;
  startTime: number;
  duration: number;
  team?: Team;
}

export const MAP_WIDTH = 16;
export const MAP_HEIGHT = 12;
export const TILE_SIZE = 48;

export const TERRAIN_DATA: Record<Terrain, TerrainInfo> = {
  [Terrain.Plains]: {
    type: Terrain.Plains,
    name: 'Plains',
    moveCost: { [UnitType.Infantry]: 1, [UnitType.Mech]: 1, [UnitType.Tank]: 1, [UnitType.Artillery]: 1, [UnitType.Recon]: 1 },
    defense: 1,
    color: '#7ec850',
  },
  [Terrain.Forest]: {
    type: Terrain.Forest,
    name: 'Forest',
    moveCost: { [UnitType.Infantry]: 1, [UnitType.Mech]: 1, [UnitType.Tank]: 2, [UnitType.Artillery]: 2, [UnitType.Recon]: 3 },
    defense: 3,
    color: '#3e8948',
  },
  [Terrain.Mountain]: {
    type: Terrain.Mountain,
    name: 'Mountain',
    moveCost: { [UnitType.Infantry]: 2, [UnitType.Mech]: 1, [UnitType.Tank]: Infinity, [UnitType.Artillery]: Infinity, [UnitType.Recon]: Infinity },
    defense: 4,
    color: '#8b7355',
  },
  [Terrain.Road]: {
    type: Terrain.Road,
    name: 'Road',
    moveCost: { [UnitType.Infantry]: 1, [UnitType.Mech]: 1, [UnitType.Tank]: 1, [UnitType.Artillery]: 1, [UnitType.Recon]: 1 },
    defense: 0,
    color: '#c8b078',
  },
  [Terrain.Water]: {
    type: Terrain.Water,
    name: 'Water',
    moveCost: { [UnitType.Infantry]: Infinity, [UnitType.Mech]: Infinity, [UnitType.Tank]: Infinity, [UnitType.Artillery]: Infinity, [UnitType.Recon]: Infinity },
    defense: 0,
    color: '#3978a8',
  },
  [Terrain.Bridge]: {
    type: Terrain.Bridge,
    name: 'Bridge',
    moveCost: { [UnitType.Infantry]: 1, [UnitType.Mech]: 1, [UnitType.Tank]: 1, [UnitType.Artillery]: 1, [UnitType.Recon]: 1 },
    defense: 0,
    color: '#a0734e',
  },
};

export const UNIT_STATS: Record<UnitType, UnitStats> = {
  [UnitType.Infantry]: { type: UnitType.Infantry, name: 'Infantry', maxHP: 100, move: 3, attack: 55, minRange: 1, maxRange: 1, isIndirect: false },
  [UnitType.Mech]: { type: UnitType.Mech, name: 'Mech', maxHP: 100, move: 2, attack: 65, minRange: 1, maxRange: 1, isIndirect: false },
  [UnitType.Tank]: { type: UnitType.Tank, name: 'Tank', maxHP: 100, move: 6, attack: 70, minRange: 1, maxRange: 1, isIndirect: false },
  [UnitType.Artillery]: { type: UnitType.Artillery, name: 'Artillery', maxHP: 100, move: 4, attack: 80, minRange: 2, maxRange: 3, isIndirect: true },
  [UnitType.Recon]: { type: UnitType.Recon, name: 'Recon', maxHP: 100, move: 8, attack: 55, minRange: 1, maxRange: 1, isIndirect: false },
};

// Damage chart: attackChart[attacker][defender] = base damage percentage
export const ATTACK_CHART: Record<UnitType, Record<UnitType, number>> = {
  [UnitType.Infantry]: {
    [UnitType.Infantry]: 55, [UnitType.Mech]: 45, [UnitType.Tank]: 15, [UnitType.Artillery]: 25, [UnitType.Recon]: 30,
  },
  [UnitType.Mech]: {
    [UnitType.Infantry]: 65, [UnitType.Mech]: 55, [UnitType.Tank]: 55, [UnitType.Artillery]: 70, [UnitType.Recon]: 65,
  },
  [UnitType.Tank]: {
    [UnitType.Infantry]: 75, [UnitType.Mech]: 70, [UnitType.Tank]: 55, [UnitType.Artillery]: 70, [UnitType.Recon]: 85,
  },
  [UnitType.Artillery]: {
    [UnitType.Infantry]: 90, [UnitType.Mech]: 85, [UnitType.Tank]: 70, [UnitType.Artillery]: 75, [UnitType.Recon]: 80,
  },
  [UnitType.Recon]: {
    [UnitType.Infantry]: 70, [UnitType.Mech]: 55, [UnitType.Tank]: 8, [UnitType.Artillery]: 45, [UnitType.Recon]: 35,
  },
};

export function coordKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function parseCoordKey(key: string): { x: number; y: number } {
  const [x, y] = key.split(',').map(Number);
  return { x, y };
}
