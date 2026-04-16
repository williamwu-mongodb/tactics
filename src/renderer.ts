import {
  GameState, GamePhase, Team,
  MAP_WIDTH, MAP_HEIGHT, TILE_SIZE, TERRAIN_DATA, UNIT_STATS,
} from './types';
import { getTerrainSprite, getUnitSprite } from './sprites';

let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let offsetX = 0;
let offsetY = 0;
let scale = 1;
let animFrame = 0;
let animTimer = 0;
let mutedDisplay = false;

export function setMutedDisplay(m: boolean): void {
  mutedDisplay = m;
}

const HUD_HEIGHT = 52;
const BOTTOM_PANEL_HEIGHT = 60;

export function initRenderer(c: HTMLCanvasElement): void {
  canvas = c;
  ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  resize();
  window.addEventListener('resize', resize);
}

export function resize(): void {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;

  const mapPixelW = MAP_WIDTH * TILE_SIZE;
  const mapPixelH = MAP_HEIGHT * TILE_SIZE;
  const availW = window.innerWidth;
  const availH = window.innerHeight - HUD_HEIGHT - BOTTOM_PANEL_HEIGHT;
  scale = Math.min(availW / mapPixelW, availH / mapPixelH, 2);
  offsetX = Math.floor((availW - mapPixelW * scale) / 2);
  offsetY = HUD_HEIGHT + Math.floor((availH - mapPixelH * scale) / 2);
}

export function screenToTile(sx: number, sy: number): { x: number; y: number } | null {
  const tx = Math.floor((sx - offsetX) / (TILE_SIZE * scale));
  const ty = Math.floor((sy - offsetY) / (TILE_SIZE * scale));
  if (tx < 0 || tx >= MAP_WIDTH || ty < 0 || ty >= MAP_HEIGHT) return null;
  return { x: tx, y: ty };
}

export function render(state: GameState, time: number): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  ctx.clearRect(0, 0, w, h);

  // Background
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, w, h);

  animTimer += 16;
  if (animTimer > 500) {
    animTimer = 0;
    animFrame = (animFrame + 1) % 4;
  }

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  drawMap(state);
  drawOverlays(state);
  drawUnits(state, time);
  drawCursor(state);
  drawAnimations(state, time);

  ctx.restore();

  drawHUD(state, w);
  drawBottomPanel(state, w, h);
  drawActionMenu(state);
  drawPhaseOverlay(state, w, h, time);
  drawGameOver(state, w, h);
}

function drawMap(state: GameState): void {
  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      const terrain = state.map[y][x].terrain;
      const sprite = getTerrainSprite(terrain, animFrame);
      ctx.drawImage(sprite, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
  }
  // Grid lines
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 0.5;
  for (let y = 0; y <= MAP_HEIGHT; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * TILE_SIZE);
    ctx.lineTo(MAP_WIDTH * TILE_SIZE, y * TILE_SIZE);
    ctx.stroke();
  }
  for (let x = 0; x <= MAP_WIDTH; x++) {
    ctx.beginPath();
    ctx.moveTo(x * TILE_SIZE, 0);
    ctx.lineTo(x * TILE_SIZE, MAP_HEIGHT * TILE_SIZE);
    ctx.stroke();
  }
}

function drawOverlays(state: GameState): void {
  // Movement range
  if (state.moveRange.size > 0) {
    for (const key of state.moveRange) {
      const [x, y] = key.split(',').map(Number);
      ctx.fillStyle = 'rgba(80, 160, 255, 0.3)';
      ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      ctx.strokeStyle = 'rgba(80, 160, 255, 0.6)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x * TILE_SIZE + 0.5, y * TILE_SIZE + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
    }
  }

  // Attack range
  if (state.attackRange.size > 0) {
    for (const key of state.attackRange) {
      const [x, y] = key.split(',').map(Number);
      ctx.fillStyle = 'rgba(255, 80, 80, 0.25)';
      ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      ctx.strokeStyle = 'rgba(255, 80, 80, 0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x * TILE_SIZE + 0.5, y * TILE_SIZE + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
    }
  }

  // Attack targets highlight
  if (state.phase === GamePhase.SelectAttackTarget && state.attackTargets.length > 0) {
    for (const target of state.attackTargets) {
      const pulse = 0.4 + 0.2 * Math.sin(performance.now() / 200);
      ctx.fillStyle = `rgba(255, 40, 40, ${pulse})`;
      ctx.fillRect(target.x * TILE_SIZE, target.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      ctx.strokeStyle = `rgba(255, 255, 0, 0.8)`;
      ctx.lineWidth = 2;
      ctx.strokeRect(target.x * TILE_SIZE + 1, target.y * TILE_SIZE + 1, TILE_SIZE - 2, TILE_SIZE - 2);
    }
  }
}

function drawUnits(state: GameState, time: number): void {
  for (const unit of state.units) {
    if (unit.hp <= 0) continue;

    const sprite = getUnitSprite(unit.type, unit.team);
    const ux = unit.x * TILE_SIZE + (TILE_SIZE - 32) / 2;
    const uy = unit.y * TILE_SIZE + (TILE_SIZE - 32) / 2;

    // Dim exhausted units
    if (unit.acted && unit.team === state.currentTeam) {
      ctx.globalAlpha = 0.5;
    }

    // Bounce selected unit
    let bounceY = 0;
    if (state.selectedUnit?.id === unit.id && state.phase !== GamePhase.UnitMoving) {
      bounceY = Math.sin(time / 150) * 3;
    }

    ctx.drawImage(sprite, ux, uy + bounceY, 32, 32);
    ctx.globalAlpha = 1.0;

    // HP indicator
    const displayHP = Math.ceil(unit.hp / 10);
    if (displayHP < 10) {
      const hpX = unit.x * TILE_SIZE + TILE_SIZE - 14;
      const hpY = unit.y * TILE_SIZE + TILE_SIZE - 4;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(hpX - 1, hpY - 10, 13, 12);
      ctx.fillStyle = displayHP <= 3 ? '#ff4040' : '#ffffff';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(String(displayHP), hpX + 5.5, hpY);
    }
  }
}

function drawCursor(state: GameState): void {
  if (state.phase === GamePhase.GameOver) return;
  const x = state.cursorX * TILE_SIZE;
  const y = state.cursorY * TILE_SIZE;
  const pulse = 0.6 + 0.3 * Math.sin(performance.now() / 300);
  ctx.strokeStyle = `rgba(255, 255, 255, ${pulse})`;
  ctx.lineWidth = 2;
  const inset = 2;
  const corner = 10;

  // Corner brackets style cursor
  ctx.beginPath();
  // Top-left
  ctx.moveTo(x + inset, y + inset + corner);
  ctx.lineTo(x + inset, y + inset);
  ctx.lineTo(x + inset + corner, y + inset);
  // Top-right
  ctx.moveTo(x + TILE_SIZE - inset - corner, y + inset);
  ctx.lineTo(x + TILE_SIZE - inset, y + inset);
  ctx.lineTo(x + TILE_SIZE - inset, y + inset + corner);
  // Bottom-right
  ctx.moveTo(x + TILE_SIZE - inset, y + TILE_SIZE - inset - corner);
  ctx.lineTo(x + TILE_SIZE - inset, y + TILE_SIZE - inset);
  ctx.lineTo(x + TILE_SIZE - inset - corner, y + TILE_SIZE - inset);
  // Bottom-left
  ctx.moveTo(x + inset + corner, y + TILE_SIZE - inset);
  ctx.lineTo(x + inset, y + TILE_SIZE - inset);
  ctx.lineTo(x + inset, y + TILE_SIZE - inset - corner);
  ctx.stroke();
}

function drawAnimations(state: GameState, time: number): void {
  const toRemove: number[] = [];
  for (let i = 0; i < state.animationQueue.length; i++) {
    const anim = state.animationQueue[i];
    const elapsed = time - anim.startTime;
    if (elapsed < 0) continue;
    if (elapsed > anim.duration) {
      toRemove.push(i);
      continue;
    }

    const progress = elapsed / anim.duration;

    if (anim.type === 'attack' && anim.to) {
      // Flash on target
      const flash = Math.sin(progress * Math.PI * 4);
      if (flash > 0) {
        ctx.fillStyle = `rgba(255, 255, 200, ${flash * 0.6})`;
        ctx.fillRect(
          anim.to.x * TILE_SIZE, anim.to.y * TILE_SIZE,
          TILE_SIZE, TILE_SIZE,
        );
      }
    }
  }
  for (let i = toRemove.length - 1; i >= 0; i--) {
    state.animationQueue.splice(toRemove[i], 1);
  }
}

function drawHUD(state: GameState, w: number): void {
  // Top bar background
  ctx.fillStyle = '#0d0d1a';
  ctx.fillRect(0, 0, w, HUD_HEIGHT);
  ctx.fillStyle = '#2a2a4a';
  ctx.fillRect(0, HUD_HEIGHT - 2, w, 2);

  // Phase indicator
  const isPlayer = state.currentTeam === Team.Red;
  const phaseText = state.phase === GamePhase.GameOver
    ? 'GAME OVER'
    : isPlayer ? 'YOUR TURN' : 'ENEMY TURN';
  const phaseColor = isPlayer ? '#ff6060' : '#6090ff';

  ctx.font = 'bold 20px monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = phaseColor;
  ctx.fillText(phaseText, 16, 34);

  // Turn counter
  ctx.font = '14px monospace';
  ctx.fillStyle = '#888';
  ctx.textAlign = 'center';
  ctx.fillText(`Turn ${state.turnCount}`, w / 2, 34);

  // End Turn button
  if (state.currentTeam === Team.Red && state.phase !== GamePhase.GameOver) {
    drawButton(w - 110, 10, 90, 32, 'END TURN', '#c04040');
  }

  // Mute button
  drawButton(w - 110 - 50, 10, 40, 32, mutedDisplay ? 'OFF' : 'SND', '#3a3a5a');
}

function drawButton(x: number, y: number, w: number, h: number, text: string, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + w / 2, y + h / 2);
  ctx.textBaseline = 'alphabetic';
}

function drawBottomPanel(state: GameState, w: number, h: number): void {
  const panelY = h - BOTTOM_PANEL_HEIGHT;
  ctx.fillStyle = '#0d0d1a';
  ctx.fillRect(0, panelY, w, BOTTOM_PANEL_HEIGHT);
  ctx.fillStyle = '#2a2a4a';
  ctx.fillRect(0, panelY, w, 2);

  // Terrain info for cursor tile
  if (state.cursorX >= 0 && state.cursorY >= 0) {
    const tile = state.map[state.cursorY]?.[state.cursorX];
    if (tile) {
      const terrainInfo = TERRAIN_DATA[tile.terrain];
      ctx.font = '13px monospace';
      ctx.fillStyle = '#aaa';
      ctx.textAlign = 'left';
      ctx.fillText(terrainInfo.name, 16, panelY + 22);
      ctx.fillStyle = '#6a6';
      ctx.fillText(`DEF: ${terrainInfo.defense}`, 16, panelY + 42);
    }
  }

  // Selected unit info
  const unit = state.selectedUnit;
  if (unit) {
    const stats = UNIT_STATS[unit.type];
    ctx.font = 'bold 14px monospace';
    ctx.fillStyle = unit.team === Team.Red ? '#ff8080' : '#80b0ff';
    ctx.textAlign = 'center';
    ctx.fillText(stats.name, w / 2, panelY + 22);
    ctx.font = '12px monospace';
    ctx.fillStyle = '#ccc';
    const hpColor = unit.hp > 50 ? '#6f6' : unit.hp > 25 ? '#ff6' : '#f66';
    ctx.fillText(`HP:`, w / 2 - 50, panelY + 42);
    ctx.fillStyle = hpColor;
    ctx.fillText(`${Math.ceil(unit.hp / 10)}/10`, w / 2 - 20, panelY + 42);
    ctx.fillStyle = '#ccc';
    ctx.fillText(`ATK:${stats.attack}  MOV:${stats.move}  RNG:${stats.minRange}-${stats.maxRange}`, w / 2 + 60, panelY + 42);
  }

  // Hovered unit info (right side)
  const hovered = state.map[state.cursorY]?.[state.cursorX]?.unit;
  if (hovered && hovered !== state.selectedUnit) {
    const stats = UNIT_STATS[hovered.type];
    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = hovered.team === Team.Red ? '#ff8080' : '#80b0ff';
    ctx.textAlign = 'right';
    ctx.fillText(`${stats.name}  HP:${Math.ceil(hovered.hp / 10)}/10`, w - 16, panelY + 22);
    ctx.fillStyle = '#aaa';
    ctx.font = '11px monospace';
    ctx.fillText(`ATK:${stats.attack}  MOV:${stats.move}`, w - 16, panelY + 42);
  }
}

let actionMenuPos: { x: number; y: number } | null = null;

export function showActionMenu(screenX: number, screenY: number): void {
  actionMenuPos = { x: screenX, y: screenY };
}

export function hideActionMenu(): void {
  actionMenuPos = null;
}

export function getActionMenuBounds(): { attack: DOMRect | null; wait: DOMRect | null } {
  if (!actionMenuPos) return { attack: null, wait: null };
  const menuW = 90;
  const menuH = 70;
  const x = actionMenuPos.x;
  const y = actionMenuPos.y;
  return {
    attack: new DOMRect(x, y, menuW, menuH / 2),
    wait: new DOMRect(x, y + menuH / 2, menuW, menuH / 2),
  };
}

function drawActionMenu(state: GameState): void {
  if (state.phase !== GamePhase.ActionMenu || !actionMenuPos) return;

  const menuW = 90;
  const menuH = 70;
  const x = actionMenuPos.x;
  const y = actionMenuPos.y;

  // Background
  ctx.fillStyle = '#1a1a30';
  ctx.fillRect(x - 2, y - 2, menuW + 4, menuH + 4);
  ctx.strokeStyle = '#4a4a6a';
  ctx.lineWidth = 2;
  ctx.strokeRect(x - 2, y - 2, menuW + 4, menuH + 4);

  const hasTargets = state.attackTargets.length > 0;

  // Attack button
  ctx.fillStyle = hasTargets ? '#802020' : '#3a3a3a';
  ctx.fillRect(x, y, menuW, menuH / 2);
  ctx.fillStyle = hasTargets ? '#ff6060' : '#666';
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ATTACK', x + menuW / 2, y + menuH / 4);

  // Wait button
  ctx.fillStyle = '#204060';
  ctx.fillRect(x, y + menuH / 2, menuW, menuH / 2);
  ctx.fillStyle = '#80b0ff';
  ctx.fillText('WAIT', x + menuW / 2, y + menuH * 3 / 4);

  ctx.textBaseline = 'alphabetic';

  // Divider
  ctx.fillStyle = '#4a4a6a';
  ctx.fillRect(x, y + menuH / 2 - 1, menuW, 2);
}

let phaseOverlayStart = 0;
let phaseOverlayTeam: Team | null = null;

export function triggerPhaseOverlay(team: Team): void {
  phaseOverlayStart = performance.now();
  phaseOverlayTeam = team;
}

function drawPhaseOverlay(state: GameState, w: number, h: number, time: number): void {
  if (phaseOverlayTeam === null) return;
  const elapsed = time - phaseOverlayStart;
  const duration = 1500;
  if (elapsed > duration) {
    phaseOverlayTeam = null;
    return;
  }

  let alpha: number;
  if (elapsed < 300) alpha = elapsed / 300;
  else if (elapsed > duration - 400) alpha = (duration - elapsed) / 400;
  else alpha = 1;

  ctx.fillStyle = `rgba(0, 0, 0, ${alpha * 0.6})`;
  ctx.fillRect(0, 0, w, h);

  const isPlayer = phaseOverlayTeam === Team.Red;
  const text = isPlayer ? 'YOUR TURN' : 'ENEMY TURN';
  ctx.font = 'bold 36px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = isPlayer
    ? `rgba(255, 96, 96, ${alpha})`
    : `rgba(96, 144, 255, ${alpha})`;
  ctx.fillText(text, w / 2, h / 2);

  ctx.font = '16px monospace';
  ctx.fillStyle = `rgba(200, 200, 200, ${alpha})`;
  ctx.fillText(`Turn ${state.turnCount}`, w / 2, h / 2 + 40);
}

function drawGameOver(state: GameState, w: number, h: number): void {
  if (state.phase !== GamePhase.GameOver || state.winner === null) return;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.fillRect(0, 0, w, h);

  const isWin = state.winner === Team.Red;
  ctx.font = 'bold 48px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = isWin ? '#ffd700' : '#ff4040';
  ctx.fillText(isWin ? 'VICTORY!' : 'DEFEAT', w / 2, h / 2 - 20);

  ctx.font = '18px monospace';
  ctx.fillStyle = '#ccc';
  ctx.fillText(`Completed in ${state.turnCount} turns`, w / 2, h / 2 + 20);

  // Play Again button
  drawButton(w / 2 - 70, h / 2 + 50, 140, 40, 'PLAY AGAIN', '#4080c0');
}

export function getEndTurnButtonBounds(w: number): DOMRect {
  return new DOMRect(w - 110, 10, 90, 32);
}

export function getMuteButtonBounds(w: number): DOMRect {
  return new DOMRect(w - 110 - 50, 10, 40, 32);
}

export function getPlayAgainBounds(w: number, h: number): DOMRect {
  return new DOMRect(w / 2 - 70, h / 2 + 50, 140, 40);
}
