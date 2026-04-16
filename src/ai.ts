import {
  GameState, Unit, Team, UNIT_STATS, ATTACK_CHART, TERRAIN_DATA,
  coordKey,
} from './types';
import { getMovementRange, getAttackTargets } from './map';
import { calculateDamage, resolveCombat } from './combat';
import { moveUnit, queueAnimation } from './game';

interface AIAction {
  unit: Unit;
  moveX: number;
  moveY: number;
  target: Unit | null;
  score: number;
}

export function runAI(state: GameState, onComplete: () => void): void {
  const aiUnits = state.units.filter(u => u.team === Team.Blue && u.hp > 0 && !u.acted);

  if (aiUnits.length === 0) {
    onComplete();
    return;
  }

  let actionIndex = 0;

  function processNext() {
    if (actionIndex >= aiUnits.length) {
      onComplete();
      return;
    }

    const unit = aiUnits[actionIndex];
    if (unit.hp <= 0 || unit.acted) {
      actionIndex++;
      processNext();
      return;
    }

    const action = findBestAction(state, unit);
    executeAIAction(state, unit, action);
    actionIndex++;

    setTimeout(processNext, 500);
  }

  setTimeout(processNext, 600);
}

function findBestAction(state: GameState, unit: Unit): AIAction {
  const moveRange = getMovementRange(state, unit);
  const stats = UNIT_STATS[unit.type];
  let bestAction: AIAction = {
    unit, moveX: unit.x, moveY: unit.y, target: null, score: -Infinity,
  };

  for (const key of moveRange) {
    const [mx, my] = key.split(',').map(Number);

    // Check if tile is occupied by another unit
    const occupant = state.map[my][mx].unit;
    if (occupant && occupant.id !== unit.id) continue;

    const targets = getAttackTargets(state, unit, mx, my);

    if (targets.length > 0) {
      for (const target of targets) {
        const score = scoreAttack(state, unit, mx, my, target);
        if (score > bestAction.score) {
          bestAction = { unit, moveX: mx, moveY: my, target, score };
        }
      }
    } else {
      // No targets from this position -- score movement toward enemies
      const score = scoreMovement(state, unit, mx, my);
      if (score > bestAction.score) {
        bestAction = { unit, moveX: mx, moveY: my, target: null, score };
      }
    }
  }

  return bestAction;
}

function scoreAttack(state: GameState, unit: Unit, fromX: number, fromY: number, target: Unit): number {
  const defTerrain = TERRAIN_DATA[state.map[target.y][target.x].terrain].defense;
  const damage = calculateDamage(unit, target, defTerrain);

  let score = damage * 2;

  // Bonus for kills
  if (target.hp - damage <= 0) {
    score += 200;
  }

  // Bonus for attacking weakened units
  if (target.hp < 50) {
    score += 50;
  }

  // Penalty for counter damage (check if we'd die)
  const atkTerrain = TERRAIN_DATA[state.map[fromY]?.[fromX]?.terrain ?? 0].defense;
  if (!UNIT_STATS[unit.type].isIndirect && !UNIT_STATS[target.type].isIndirect) {
    const reducedTargetHP = Math.max(0, target.hp - damage);
    if (reducedTargetHP > 0) {
      const tmpTarget = { ...target, hp: reducedTargetHP };
      const counterDmg = calculateDamage(tmpTarget, unit, atkTerrain);
      if (unit.hp - counterDmg <= 0) {
        score -= 300; // Don't suicide
      } else {
        score -= counterDmg;
      }
    }
  }

  // Type advantage bonus
  const baseDmg = ATTACK_CHART[unit.type][target.type];
  if (baseDmg >= 70) score += 30;

  // Prefer attacking from defensible terrain
  score += TERRAIN_DATA[state.map[fromY][fromX].terrain].defense * 5;

  return score;
}

function scoreMovement(state: GameState, unit: Unit, toX: number, toY: number): number {
  const enemies = state.units.filter(u => u.team !== unit.team && u.hp > 0);
  if (enemies.length === 0) return 0;

  // Move toward nearest enemy
  let minDist = Infinity;
  for (const enemy of enemies) {
    const dist = Math.abs(enemy.x - toX) + Math.abs(enemy.y - toY);
    minDist = Math.min(minDist, dist);
  }

  let score = -minDist * 10;

  // Artillery should keep distance
  if (UNIT_STATS[unit.type].isIndirect) {
    const nearestEnemyDist = Math.min(...enemies.map(e => Math.abs(e.x - toX) + Math.abs(e.y - toY)));
    if (nearestEnemyDist < 2) score -= 50;
    if (nearestEnemyDist >= 2 && nearestEnemyDist <= 3) score += 30;
  }

  // Prefer defensive terrain
  score += TERRAIN_DATA[state.map[toY][toX].terrain].defense * 5;

  return score;
}

function executeAIAction(state: GameState, unit: Unit, action: AIAction): void {
  if (action.moveX !== unit.x || action.moveY !== unit.y) {
    moveUnit(state, unit, action.moveX, action.moveY);
  }

  if (action.target) {
    queueAnimation(state, {
      type: 'attack',
      unit,
      target: action.target,
      from: { x: unit.x, y: unit.y },
      to: { x: action.target.x, y: action.target.y },
      duration: 400,
    });
    resolveCombat(state, unit, action.target);
  }

  unit.moved = true;
  unit.acted = true;
}
