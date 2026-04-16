import { Terrain, UnitType, Team, TILE_SIZE } from './types';

const UNIT_SIZE = 32;

const spriteCache = new Map<string, HTMLCanvasElement>();

function createCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

function pixel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

// ---- Terrain Tiles ----

function drawPlains(ctx: CanvasRenderingContext2D, s: number) {
  rect(ctx, 0, 0, s, s, '#7ec850');
  // Grass tufts
  const tufts = [[8, 12], [28, 8], [16, 32], [36, 28], [12, 40], [32, 40]];
  for (const [tx, ty] of tufts) {
    const sx = (tx / 48) * s, sy = (ty / 48) * s;
    const ps = Math.max(1, s / 24);
    pixel(ctx, sx, sy, ps, ps * 2, '#6ab840');
    pixel(ctx, sx + ps, sy - ps, ps, ps * 2, '#6ab840');
    pixel(ctx, sx - ps, sy, ps, ps * 2, '#6ab840');
  }
}

function drawForest(ctx: CanvasRenderingContext2D, s: number) {
  rect(ctx, 0, 0, s, s, '#5a9e3e');
  const p = s / 48;
  // Tree trunks
  rect(ctx, 14 * p, 28 * p, 3 * p, 8 * p, '#6b4226');
  rect(ctx, 32 * p, 24 * p, 3 * p, 10 * p, '#6b4226');
  // Tree canopies
  const trees = [[15, 16, 10], [33, 12, 12]];
  for (const [cx, cy, r] of trees) {
    for (let dy = -r; dy <= r; dy += 2) {
      for (let dx = -r; dx <= r; dx += 2) {
        if (dx * dx + dy * dy <= r * r) {
          const shade = (dx + dy) > 0 ? '#2d6e1e' : '#3e8948';
          pixel(ctx, (cx + dx) * p, (cy + dy) * p, 2 * p, 2 * p, shade);
        }
      }
    }
  }
  // Smaller tree
  rect(ctx, 22 * p, 34 * p, 2 * p, 6 * p, '#6b4226');
  for (let dy = -6; dy <= 6; dy += 2) {
    for (let dx = -6; dx <= 6; dx += 2) {
      if (dx * dx + dy * dy <= 36) {
        pixel(ctx, (23 + dx) * p, (26 + dy) * p, 2 * p, 2 * p, '#3e8948');
      }
    }
  }
}

function drawMountain(ctx: CanvasRenderingContext2D, s: number) {
  rect(ctx, 0, 0, s, s, '#7ec850');
  const p = s / 48;
  // Main peak
  ctx.fillStyle = '#8b7355';
  ctx.beginPath();
  ctx.moveTo(24 * p, 6 * p);
  ctx.lineTo(40 * p, 40 * p);
  ctx.lineTo(8 * p, 40 * p);
  ctx.fill();
  // Snow cap
  ctx.fillStyle = '#e8e8e8';
  ctx.beginPath();
  ctx.moveTo(24 * p, 6 * p);
  ctx.lineTo(28 * p, 16 * p);
  ctx.lineTo(20 * p, 16 * p);
  ctx.fill();
  // Secondary peak
  ctx.fillStyle = '#7a654a';
  ctx.beginPath();
  ctx.moveTo(36 * p, 16 * p);
  ctx.lineTo(46 * p, 40 * p);
  ctx.lineTo(26 * p, 40 * p);
  ctx.fill();
  ctx.fillStyle = '#d0d0d0';
  ctx.beginPath();
  ctx.moveTo(36 * p, 16 * p);
  ctx.lineTo(39 * p, 23 * p);
  ctx.lineTo(33 * p, 23 * p);
  ctx.fill();
}

function drawRoad(ctx: CanvasRenderingContext2D, s: number) {
  rect(ctx, 0, 0, s, s, '#7ec850');
  const p = s / 48;
  rect(ctx, 0, 16 * p, s, 16 * p, '#c8b078');
  // Road markings
  for (let x = 4; x < 48; x += 12) {
    rect(ctx, x * p, 23 * p, 6 * p, 2 * p, '#ddd0a0');
  }
}

function drawWater(ctx: CanvasRenderingContext2D, s: number, frame: number) {
  rect(ctx, 0, 0, s, s, '#2a6090');
  const p = s / 48;
  // Animated waves
  for (let y = 4; y < 48; y += 8) {
    for (let x = 0; x < 48; x += 6) {
      const offset = ((frame + x + y) % 12);
      const shade = offset < 6 ? '#3978a8' : '#4a8ab8';
      rect(ctx, (x + (frame % 6)) * p, y * p, 4 * p, 2 * p, shade);
    }
  }
  // Highlights
  for (let y = 8; y < 48; y += 16) {
    const xo = (frame * 2) % 48;
    rect(ctx, xo * p, y * p, 3 * p, p, '#68b8d8');
  }
}

function drawBridge(ctx: CanvasRenderingContext2D, s: number) {
  rect(ctx, 0, 0, s, s, '#2a6090');
  const p = s / 48;
  // Water underneath
  for (let y = 0; y < 48; y += 8) {
    for (let x = 0; x < 48; x += 6) {
      rect(ctx, x * p, y * p, 4 * p, 2 * p, '#3978a8');
    }
  }
  // Bridge planks
  rect(ctx, 0, 12 * p, s, 24 * p, '#8b6d3c');
  for (let x = 0; x < 48; x += 8) {
    rect(ctx, x * p, 12 * p, 1 * p, 24 * p, '#6b4d2c');
  }
  // Rails
  rect(ctx, 0, 12 * p, s, 2 * p, '#6b4d2c');
  rect(ctx, 0, 34 * p, s, 2 * p, '#6b4d2c');
}

export function getTerrainSprite(terrain: Terrain, frame: number = 0): HTMLCanvasElement {
  if (terrain !== Terrain.Water) {
    const key = `terrain_${terrain}`;
    if (spriteCache.has(key)) return spriteCache.get(key)!;
    const [c, ctx] = createCanvas(TILE_SIZE, TILE_SIZE);
    const drawFn = [drawPlains, drawForest, drawMountain, drawRoad, drawWater, drawBridge][terrain];
    drawFn(ctx, TILE_SIZE);
    spriteCache.set(key, c);
    return c;
  }
  // Water is animated per frame
  const wKey = `terrain_water_${frame % 4}`;
  if (spriteCache.has(wKey)) return spriteCache.get(wKey)!;
  const [c, ctx] = createCanvas(TILE_SIZE, TILE_SIZE);
  drawWater(ctx, TILE_SIZE, frame);
  spriteCache.set(wKey, c);
  return c;
}

// ---- Unit Sprites ----

const TEAM_COLORS = {
  [Team.Red]: { body: '#d04040', dark: '#a02020', light: '#f06060', accent: '#ff8080' },
  [Team.Blue]: { body: '#3060c0', dark: '#203880', light: '#5080e0', accent: '#80b0ff' },
};

function drawInfantry(ctx: CanvasRenderingContext2D, s: number, team: Team) {
  const c = TEAM_COLORS[team];
  const p = s / 32;
  // Head
  rect(ctx, 13 * p, 2 * p, 6 * p, 6 * p, '#f0c090');
  // Helmet
  rect(ctx, 12 * p, 1 * p, 8 * p, 4 * p, c.dark);
  // Body
  rect(ctx, 11 * p, 8 * p, 10 * p, 10 * p, c.body);
  // Arms
  rect(ctx, 7 * p, 9 * p, 4 * p, 8 * p, c.body);
  rect(ctx, 21 * p, 9 * p, 4 * p, 8 * p, c.body);
  // Hands
  rect(ctx, 7 * p, 17 * p, 3 * p, 2 * p, '#f0c090');
  rect(ctx, 22 * p, 17 * p, 3 * p, 2 * p, '#f0c090');
  // Legs
  rect(ctx, 12 * p, 18 * p, 4 * p, 10 * p, c.dark);
  rect(ctx, 17 * p, 18 * p, 4 * p, 10 * p, c.dark);
  // Boots
  rect(ctx, 11 * p, 26 * p, 5 * p, 4 * p, '#3a3a3a');
  rect(ctx, 16 * p, 26 * p, 5 * p, 4 * p, '#3a3a3a');
  // Rifle
  rect(ctx, 23 * p, 8 * p, 2 * p, 14 * p, '#4a4a4a');
}

function drawMech(ctx: CanvasRenderingContext2D, s: number, team: Team) {
  const c = TEAM_COLORS[team];
  const p = s / 32;
  // Visor
  rect(ctx, 12 * p, 1 * p, 8 * p, 6 * p, c.dark);
  rect(ctx, 13 * p, 3 * p, 6 * p, 2 * p, '#60e0e0');
  // Body (bulkier)
  rect(ctx, 9 * p, 7 * p, 14 * p, 12 * p, c.body);
  rect(ctx, 10 * p, 8 * p, 12 * p, 4 * p, c.light);
  // Shoulder pads
  rect(ctx, 5 * p, 7 * p, 5 * p, 6 * p, c.dark);
  rect(ctx, 22 * p, 7 * p, 5 * p, 6 * p, c.dark);
  // Arms
  rect(ctx, 5 * p, 13 * p, 4 * p, 6 * p, c.body);
  rect(ctx, 23 * p, 13 * p, 4 * p, 6 * p, c.body);
  // Bazooka on right shoulder
  rect(ctx, 24 * p, 3 * p, 4 * p, 4 * p, '#555');
  rect(ctx, 23 * p, 2 * p, 6 * p, 2 * p, '#666');
  // Legs
  rect(ctx, 10 * p, 19 * p, 5 * p, 9 * p, c.dark);
  rect(ctx, 17 * p, 19 * p, 5 * p, 9 * p, c.dark);
  // Boots
  rect(ctx, 9 * p, 26 * p, 6 * p, 4 * p, '#3a3a3a');
  rect(ctx, 16 * p, 26 * p, 6 * p, 4 * p, '#3a3a3a');
}

function drawTank(ctx: CanvasRenderingContext2D, s: number, team: Team) {
  const c = TEAM_COLORS[team];
  const p = s / 32;
  // Turret barrel
  rect(ctx, 18 * p, 4 * p, 12 * p, 3 * p, '#4a4a4a');
  // Turret
  rect(ctx, 9 * p, 5 * p, 14 * p, 8 * p, c.dark);
  rect(ctx, 10 * p, 6 * p, 12 * p, 3 * p, c.light);
  // Body
  rect(ctx, 4 * p, 13 * p, 24 * p, 10 * p, c.body);
  rect(ctx, 5 * p, 14 * p, 22 * p, 3 * p, c.light);
  // Treads
  rect(ctx, 2 * p, 23 * p, 28 * p, 7 * p, '#3a3a3a');
  // Tread details
  for (let x = 3; x < 29; x += 4) {
    rect(ctx, x * p, 24 * p, 2 * p, 5 * p, '#555');
  }
  // Exhaust
  rect(ctx, 2 * p, 15 * p, 2 * p, 4 * p, '#555');
}

function drawArtillery(ctx: CanvasRenderingContext2D, s: number, team: Team) {
  const c = TEAM_COLORS[team];
  const p = s / 32;
  // Barrel (angled up-right)
  ctx.save();
  ctx.translate(16 * p, 8 * p);
  ctx.rotate(-0.4);
  rect(ctx, 0, -1.5 * p, 14 * p, 3 * p, '#4a4a4a');
  ctx.restore();
  // Turret base
  rect(ctx, 8 * p, 8 * p, 16 * p, 8 * p, c.dark);
  rect(ctx, 9 * p, 9 * p, 10 * p, 3 * p, c.light);
  // Body
  rect(ctx, 4 * p, 16 * p, 24 * p, 8 * p, c.body);
  // Wheels
  for (const wx of [6, 14, 22]) {
    ctx.fillStyle = '#3a3a3a';
    ctx.beginPath();
    ctx.arc(wx * p, 27 * p, 3.5 * p, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#555';
    ctx.beginPath();
    ctx.arc(wx * p, 27 * p, 1.5 * p, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRecon(ctx: CanvasRenderingContext2D, s: number, team: Team) {
  const c = TEAM_COLORS[team];
  const p = s / 32;
  // Antenna
  rect(ctx, 22 * p, 2 * p, 1 * p, 7 * p, '#555');
  pixel(ctx, 21 * p, 2 * p, 3 * p, 1 * p, '#ff4040');
  // Cabin/windshield
  rect(ctx, 7 * p, 8 * p, 14 * p, 8 * p, c.dark);
  rect(ctx, 8 * p, 9 * p, 12 * p, 5 * p, '#88ccee');
  // Body
  rect(ctx, 4 * p, 14 * p, 24 * p, 8 * p, c.body);
  rect(ctx, 5 * p, 15 * p, 22 * p, 2 * p, c.light);
  // Bumper
  rect(ctx, 3 * p, 22 * p, 26 * p, 2 * p, '#555');
  // Wheels
  for (const wx of [8, 24]) {
    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath();
    ctx.arc(wx * p, 27 * p, 4 * p, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#555';
    ctx.beginPath();
    ctx.arc(wx * p, 27 * p, 2 * p, 0, Math.PI * 2);
    ctx.fill();
  }
}

const unitDrawers: Record<UnitType, (ctx: CanvasRenderingContext2D, s: number, team: Team) => void> = {
  [UnitType.Infantry]: drawInfantry,
  [UnitType.Mech]: drawMech,
  [UnitType.Tank]: drawTank,
  [UnitType.Artillery]: drawArtillery,
  [UnitType.Recon]: drawRecon,
};

export function getUnitSprite(type: UnitType, team: Team): HTMLCanvasElement {
  const key = `unit_${type}_${team}`;
  if (spriteCache.has(key)) return spriteCache.get(key)!;

  const [c, ctx] = createCanvas(UNIT_SIZE, UNIT_SIZE);
  unitDrawers[type](ctx, UNIT_SIZE, team);
  spriteCache.set(key, c);
  return c;
}

// Pre-generate all sprites at startup
export function preloadSprites(): void {
  for (const t of [Terrain.Plains, Terrain.Forest, Terrain.Mountain, Terrain.Road, Terrain.Bridge]) {
    getTerrainSprite(t);
  }
  for (let f = 0; f < 4; f++) getTerrainSprite(Terrain.Water, f);
  for (const type of [UnitType.Infantry, UnitType.Mech, UnitType.Tank, UnitType.Artillery, UnitType.Recon]) {
    for (const team of [Team.Red, Team.Blue]) {
      getUnitSprite(type, team);
    }
  }
}
