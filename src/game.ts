import {
  GameState, GamePhase, Team, Unit, Animation,
} from './types';
import { createMap } from './map';

export function createGameState(): GameState {
  const { map, units } = createMap();
  return {
    map,
    units,
    currentTeam: Team.Red,
    phase: GamePhase.PlayerTurn,
    turnCount: 1,
    selectedUnit: null,
    cursorX: 0,
    cursorY: 0,
    moveRange: new Set(),
    attackRange: new Set(),
    attackTargets: [],
    movePath: [],
    winner: null,
    animationQueue: [],
  };
}

export function startTurn(state: GameState, team: Team): void {
  state.currentTeam = team;
  for (const unit of state.units) {
    if (unit.team === team && unit.hp > 0) {
      unit.moved = false;
      unit.acted = false;
    }
  }
  state.selectedUnit = null;
  state.moveRange = new Set();
  state.attackRange = new Set();
  state.attackTargets = [];
  state.phase = team === Team.Red ? GamePhase.PlayerTurn : GamePhase.AITurn;
}

export function deselectUnit(state: GameState): void {
  state.selectedUnit = null;
  state.moveRange = new Set();
  state.attackRange = new Set();
  state.attackTargets = [];
  state.phase = state.currentTeam === Team.Red ? GamePhase.PlayerTurn : GamePhase.AITurn;
}

export function moveUnit(state: GameState, unit: Unit, toX: number, toY: number): void {
  state.map[unit.y][unit.x].unit = null;
  unit.x = toX;
  unit.y = toY;
  state.map[toY][toX].unit = unit;
  unit.moved = true;
}

export function removeUnit(state: GameState, unit: Unit): void {
  state.map[unit.y][unit.x].unit = null;
  const idx = state.units.indexOf(unit);
  if (idx >= 0) state.units.splice(idx, 1);
}

export function checkWinCondition(state: GameState): Team | null {
  const redAlive = state.units.some(u => u.team === Team.Red && u.hp > 0);
  const blueAlive = state.units.some(u => u.team === Team.Blue && u.hp > 0);
  if (!redAlive) return Team.Blue;
  if (!blueAlive) return Team.Red;
  return null;
}

export function allUnitsDone(state: GameState, team: Team): boolean {
  return state.units
    .filter(u => u.team === team && u.hp > 0)
    .every(u => u.acted);
}

export function queueAnimation(state: GameState, anim: Omit<Animation, 'startTime'>): void {
  const lastAnim = state.animationQueue[state.animationQueue.length - 1];
  const startTime = lastAnim ? lastAnim.startTime + lastAnim.duration : performance.now();
  state.animationQueue.push({ ...anim, startTime } as Animation);
}
