import {
  Tile, GameState,
  MAP_WIDTH, MAP_HEIGHT, TERRAIN_DATA, UNIT_STATS,
  coordKey, Unit,
} from './types';
import { DEFAULT_MAP, DEFAULT_UNITS } from './maps/default';

export function createMap(): { map: Tile[][]; units: Unit[] } {
  const map: Tile[][] = [];
  for (let y = 0; y < MAP_HEIGHT; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < MAP_WIDTH; x++) {
      row.push({ terrain: DEFAULT_MAP[y][x], unit: null });
    }
    map.push(row);
  }

  const units = DEFAULT_UNITS.map(u => ({ ...u }));
  for (const unit of units) {
    map[unit.y][unit.x].unit = unit;
  }

  return { map, units };
}

export function getMovementRange(
  state: GameState,
  unit: Unit,
): Set<string> {
  const stats = UNIT_STATS[unit.type];
  const range = new Set<string>();
  const visited = new Map<string, number>();

  interface Node { x: number; y: number; cost: number }
  const queue: Node[] = [{ x: unit.x, y: unit.y, cost: 0 }];
  visited.set(coordKey(unit.x, unit.y), 0);

  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost);
    const current = queue.shift()!;

    const tileUnit = state.map[current.y][current.x].unit;
    const isBlocked = tileUnit && tileUnit.team !== unit.team;
    if (!isBlocked) {
      range.add(coordKey(current.x, current.y));
    }

    if (isBlocked) continue;

    const dirs = [
      { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
      { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
    ];
    for (const { dx, dy } of dirs) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      if (nx < 0 || nx >= MAP_WIDTH || ny < 0 || ny >= MAP_HEIGHT) continue;

      const terrain = state.map[ny][nx].terrain;
      const terrainInfo = TERRAIN_DATA[terrain];
      const moveCost = terrainInfo.moveCost[unit.type];
      if (moveCost === Infinity) continue;

      const newCost = current.cost + moveCost;
      if (newCost > stats.move) continue;

      const key = coordKey(nx, ny);
      const prevCost = visited.get(key);
      if (prevCost !== undefined && prevCost <= newCost) continue;

      // Can't move onto a tile occupied by a friendly unit (unless it's self)
      const occupant = state.map[ny][nx].unit;
      if (occupant && occupant.team === unit.team && occupant.id !== unit.id) {
        continue;
      }

      visited.set(key, newCost);
      queue.push({ x: nx, y: ny, cost: newCost });
    }
  }

  return range;
}

export function getAttackTargets(
  state: GameState,
  unit: Unit,
  fromX: number,
  fromY: number,
): Unit[] {
  const stats = UNIT_STATS[unit.type];
  const targets: Unit[] = [];

  for (const other of state.units) {
    if (other.team === unit.team || other.hp <= 0) continue;
    const dist = Math.abs(other.x - fromX) + Math.abs(other.y - fromY);
    if (dist >= stats.minRange && dist <= stats.maxRange) {
      targets.push(other);
    }
  }

  return targets;
}

export function getAttackRangeFromTiles(
  state: GameState,
  unit: Unit,
  moveRange: Set<string>,
): Set<string> {
  const stats = UNIT_STATS[unit.type];
  const attackTiles = new Set<string>();

  for (const key of moveRange) {
    const [mx, my] = key.split(',').map(Number);
    for (let dy = -stats.maxRange; dy <= stats.maxRange; dy++) {
      for (let dx = -stats.maxRange; dx <= stats.maxRange; dx++) {
        const dist = Math.abs(dx) + Math.abs(dy);
        if (dist < stats.minRange || dist > stats.maxRange) continue;
        const tx = mx + dx;
        const ty = my + dy;
        if (tx < 0 || tx >= MAP_WIDTH || ty < 0 || ty >= MAP_HEIGHT) continue;
        if (!moveRange.has(coordKey(tx, ty))) {
          attackTiles.add(coordKey(tx, ty));
        }
      }
    }
  }

  return attackTiles;
}

export function findPath(
  state: GameState,
  unit: Unit,
  targetX: number,
  targetY: number,
): { x: number; y: number }[] {
  const visited = new Map<string, { cost: number; parent: string | null }>();
  interface Node { x: number; y: number; cost: number }
  const queue: Node[] = [{ x: unit.x, y: unit.y, cost: 0 }];
  const startKey = coordKey(unit.x, unit.y);
  visited.set(startKey, { cost: 0, parent: null });

  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost);
    const current = queue.shift()!;
    const currentKey = coordKey(current.x, current.y);

    if (current.x === targetX && current.y === targetY) break;

    const dirs = [
      { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
      { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
    ];
    for (const { dx, dy } of dirs) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      if (nx < 0 || nx >= MAP_WIDTH || ny < 0 || ny >= MAP_HEIGHT) continue;

      const terrain = state.map[ny][nx].terrain;
      const moveCost = TERRAIN_DATA[terrain].moveCost[unit.type];
      if (moveCost === Infinity) continue;

      const newCost = current.cost + moveCost;
      if (newCost > UNIT_STATS[unit.type].move) continue;

      const key = coordKey(nx, ny);
      const prev = visited.get(key);
      if (prev && prev.cost <= newCost) continue;

      const occupant = state.map[ny][nx].unit;
      if (occupant && occupant.team === unit.team && occupant.id !== unit.id) continue;

      visited.set(key, { cost: newCost, parent: currentKey });
      queue.push({ x: nx, y: ny, cost: newCost });
    }
  }

  const path: { x: number; y: number }[] = [];
  let key: string | null = coordKey(targetX, targetY);
  while (key) {
    const [x, y] = key.split(',').map(Number);
    path.unshift({ x, y });
    key = visited.get(key)?.parent ?? null;
  }

  return path;
}
