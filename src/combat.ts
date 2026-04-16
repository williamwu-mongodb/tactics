import {
  Unit, GameState, ATTACK_CHART, TERRAIN_DATA, UNIT_STATS,
} from './types';
import { removeUnit, checkWinCondition } from './game';

export interface CombatResult {
  damage: number;
  counterDamage: number;
  defenderDestroyed: boolean;
  attackerDestroyed: boolean;
}

export function calculateDamage(
  attacker: Unit,
  defender: Unit,
  defenderTerrain: number, // terrain defense value
): number {
  const baseDamage = ATTACK_CHART[attacker.type][defender.type];
  const hpMod = attacker.hp / 100;
  const terrainReduction = defenderTerrain * (defender.hp / 100);
  const damage = baseDamage * hpMod * ((100 - terrainReduction) / 100);
  return Math.max(0, Math.round(damage));
}

export function resolveCombat(state: GameState, attacker: Unit, defender: Unit): CombatResult {
  const defTerrain = TERRAIN_DATA[state.map[defender.y][defender.x].terrain].defense;
  const atkTerrain = TERRAIN_DATA[state.map[attacker.y][attacker.x].terrain].defense;

  const damage = calculateDamage(attacker, defender, defTerrain);
  defender.hp = Math.max(0, defender.hp - damage);

  let counterDamage = 0;
  const attackerStats = UNIT_STATS[attacker.type];
  const defenderStats = UNIT_STATS[defender.type];

  const canCounter =
    !attackerStats.isIndirect &&
    !defenderStats.isIndirect &&
    defender.hp > 0;

  if (canCounter) {
    const dist = Math.abs(attacker.x - defender.x) + Math.abs(attacker.y - defender.y);
    if (dist >= defenderStats.minRange && dist <= defenderStats.maxRange) {
      counterDamage = calculateDamage(defender, attacker, atkTerrain);
      attacker.hp = Math.max(0, attacker.hp - counterDamage);
    }
  }

  const defenderDestroyed = defender.hp <= 0;
  const attackerDestroyed = attacker.hp <= 0;

  if (defenderDestroyed) removeUnit(state, defender);
  if (attackerDestroyed) removeUnit(state, attacker);

  state.winner = checkWinCondition(state);

  return { damage, counterDamage, defenderDestroyed, attackerDestroyed };
}
