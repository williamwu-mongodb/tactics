import { Terrain, UnitType, Team, Unit } from '../types';

const P = Terrain.Plains;
const F = Terrain.Forest;
const M = Terrain.Mountain;
const R = Terrain.Road;
const W = Terrain.Water;
const B = Terrain.Bridge;

export const DEFAULT_MAP: Terrain[][] = [
  //0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15
  [F, P, P, R, P, P, F, P, P, F, P, P, R, P, P, F], // 0
  [P, P, F, R, P, F, P, P, P, P, F, P, R, F, P, P], // 1
  [P, M, P, R, P, P, P, M, M, P, P, P, R, P, M, P], // 2
  [R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R], // 3
  [P, P, F, P, P, P, W, W, W, W, P, P, P, F, P, P], // 4
  [P, F, P, P, P, W, W, W, W, W, W, P, P, P, F, P], // 5
  [P, F, P, P, P, W, W, W, W, W, W, P, P, P, F, P], // 6
  [P, P, F, P, P, P, W, W, W, W, P, P, P, F, P, P], // 7
  [R, R, R, R, R, R, B, R, R, B, R, R, R, R, R, R], // 8
  [P, M, P, R, P, P, P, M, M, P, P, P, R, P, M, P], // 9
  [P, P, F, R, P, F, P, P, P, P, F, P, R, F, P, P], // 10
  [F, P, P, R, P, P, F, P, P, F, P, P, R, P, P, F], // 11
];

function u(id: number, type: UnitType, team: Team, x: number, y: number): Unit {
  return { id, type, team, hp: 100, x, y, moved: false, acted: false };
}

export const DEFAULT_UNITS: Unit[] = [
  // Red team (player) - left side
  u(1,  UnitType.Infantry,  Team.Red, 1, 1),
  u(2,  UnitType.Infantry,  Team.Red, 1, 3),
  u(3,  UnitType.Mech,      Team.Red, 0, 5),
  u(4,  UnitType.Tank,      Team.Red, 2, 8),
  u(5,  UnitType.Tank,      Team.Red, 1, 10),
  u(6,  UnitType.Artillery,  Team.Red, 0, 9),
  u(7,  UnitType.Recon,     Team.Red, 3, 5),

  // Blue team (AI) - right side
  u(8,  UnitType.Infantry,  Team.Blue, 14, 1),
  u(9,  UnitType.Infantry,  Team.Blue, 14, 3),
  u(10, UnitType.Mech,      Team.Blue, 15, 6),
  u(11, UnitType.Tank,      Team.Blue, 13, 8),
  u(12, UnitType.Tank,      Team.Blue, 14, 10),
  u(13, UnitType.Artillery,  Team.Blue, 15, 9),
  u(14, UnitType.Recon,     Team.Blue, 12, 6),
];
