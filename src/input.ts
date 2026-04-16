import {
  GameState, GamePhase, Team, Unit, coordKey,
} from './types';
import {
  screenToTile, showActionMenu, hideActionMenu,
  getActionMenuBounds, getEndTurnButtonBounds, getPlayAgainBounds,
  getMuteButtonBounds, triggerPhaseOverlay, setMutedDisplay,
} from './renderer';
import { getMovementRange, getAttackTargets, getAttackRangeFromTiles, findPath } from './map';
import { moveUnit, deselectUnit, startTurn, queueAnimation } from './game';
import { resolveCombat } from './combat';
import { runAI } from './ai';
import { playSFX, playMusic, initAudio, toggleMute } from './audio';

let gameResetCallback: (() => void) | null = null;

export function setResetCallback(cb: () => void): void {
  gameResetCallback = cb;
}

export function initInput(canvas: HTMLCanvasElement, stateRef: { state: GameState }): void {
  canvas.addEventListener('mousemove', (e) => {
    const tile = screenToTile(e.clientX, e.clientY);
    if (tile) {
      stateRef.state.cursorX = tile.x;
      stateRef.state.cursorY = tile.y;
    }
  });

  canvas.addEventListener('click', (e) => {
    handleClick(stateRef, e.clientX, e.clientY);
  });

  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    handleRightClick(stateRef);
  });
}

function handleClick(stateRef: { state: GameState }, sx: number, sy: number): void {
  const state = stateRef.state;
  initAudio();

  // Game over -- play again
  if (state.phase === GamePhase.GameOver) {
    const bounds = getPlayAgainBounds(window.innerWidth, window.innerHeight);
    if (hitTest(sx, sy, bounds) && gameResetCallback) {
      gameResetCallback();
    }
    return;
  }

  // Not player's turn
  if (state.currentTeam !== Team.Red) return;

  // Mute button
  const muteBounds = getMuteButtonBounds(window.innerWidth);
  if (hitTest(sx, sy, muteBounds)) {
    setMutedDisplay(toggleMute());
    return;
  }

  // End Turn button
  const etBounds = getEndTurnButtonBounds(window.innerWidth);
  if (hitTest(sx, sy, etBounds)) {
    endPlayerTurn(stateRef);
    return;
  }

  // Action menu
  if (state.phase === GamePhase.ActionMenu) {
    const menuBounds = getActionMenuBounds();
    if (menuBounds.attack && hitTest(sx, sy, menuBounds.attack)) {
      if (state.attackTargets.length > 0) {
        handleAttackChoice(state);
      }
      return;
    }
    if (menuBounds.wait && hitTest(sx, sy, menuBounds.wait)) {
      handleWaitChoice(state);
      return;
    }
    // Click outside menu = cancel
    handleCancel(state);
    return;
  }

  // Select attack target
  if (state.phase === GamePhase.SelectAttackTarget) {
    const tile = screenToTile(sx, sy);
    if (tile) {
      const target = state.attackTargets.find(t => t.x === tile.x && t.y === tile.y);
      if (target && state.selectedUnit) {
        executeCombat(state, state.selectedUnit, target);
        return;
      }
    }
    handleCancel(state);
    return;
  }

  const tile = screenToTile(sx, sy);
  if (!tile) return;

  const clickedUnit = state.map[tile.y][tile.x].unit;

  switch (state.phase) {
    case GamePhase.PlayerTurn:
      if (clickedUnit && clickedUnit.team === Team.Red && !clickedUnit.acted) {
        selectUnit(state, clickedUnit);
      }
      break;

    case GamePhase.SelectUnit:
    case GamePhase.ShowMoveRange:
      if (state.moveRange.has(coordKey(tile.x, tile.y))) {
        if (state.selectedUnit) {
          tryMoveUnit(state, state.selectedUnit, tile.x, tile.y, sx, sy);
        }
      } else if (clickedUnit && clickedUnit.team === Team.Red && !clickedUnit.acted) {
        selectUnit(state, clickedUnit);
      } else {
        handleCancel(state);
      }
      break;
  }
}

function handleRightClick(stateRef: { state: GameState }): void {
  handleCancel(stateRef.state);
}

function handleCancel(state: GameState): void {
  if (state.phase === GamePhase.ActionMenu || state.phase === GamePhase.SelectAttackTarget) {
    // Undo move if unit was moved
    if (state.selectedUnit && state.movePath.length > 0) {
      const origin = state.movePath[0];
      moveUnit(state, state.selectedUnit, origin.x, origin.y);
      state.selectedUnit.moved = false;
    }
  }
  hideActionMenu();
  deselectUnit(state);
}

function selectUnit(state: GameState, unit: Unit): void {
  playSFX('select');
  state.selectedUnit = unit;
  state.moveRange = getMovementRange(state, unit);
  state.attackRange = getAttackRangeFromTiles(state, unit, state.moveRange);
  state.phase = GamePhase.ShowMoveRange;
}

function tryMoveUnit(state: GameState, unit: Unit, toX: number, toY: number, sx: number, sy: number): void {
  // If clicking on the unit's own tile, go straight to action menu
  if (toX === unit.x && toY === unit.y) {
    state.movePath = [{ x: unit.x, y: unit.y }];
    showActionMenuForUnit(state, unit, sx, sy);
    return;
  }

  const path = findPath(state, unit, toX, toY);
  if (path.length < 2) return;

  playSFX('move');
  state.movePath = path;
  moveUnit(state, unit, toX, toY);
  showActionMenuForUnit(state, unit, sx, sy);
}

function showActionMenuForUnit(state: GameState, unit: Unit, sx: number, sy: number): void {
  state.attackTargets = getAttackTargets(state, unit, unit.x, unit.y);
  state.phase = GamePhase.ActionMenu;

  // Position menu near the unit but not obscuring it
  let menuX = sx + 20;
  let menuY = sy - 35;
  if (menuX + 100 > window.innerWidth) menuX = sx - 110;
  if (menuY < 0) menuY = sy + 20;
  showActionMenu(menuX, menuY);
}

function handleAttackChoice(state: GameState): void {
  hideActionMenu();
  if (state.attackTargets.length === 1 && state.selectedUnit) {
    executeCombat(state, state.selectedUnit, state.attackTargets[0]);
  } else {
    state.phase = GamePhase.SelectAttackTarget;
  }
}

function handleWaitChoice(state: GameState): void {
  hideActionMenu();
  if (state.selectedUnit) {
    state.selectedUnit.acted = true;
  }
  deselectUnit(state);
}

function executeCombat(state: GameState, attacker: Unit, defender: Unit): void {
  playSFX('attack');

  queueAnimation(state, {
    type: 'attack',
    unit: attacker,
    target: defender,
    from: { x: attacker.x, y: attacker.y },
    to: { x: defender.x, y: defender.y },
    duration: 400,
  });

  const result = resolveCombat(state, attacker, defender);

  if (result.defenderDestroyed) {
    playSFX('destroy');
  }
  if (result.attackerDestroyed) {
    playSFX('destroy');
  }

  if (attacker.hp > 0) {
    attacker.acted = true;
  }

  hideActionMenu();

  if (state.winner !== null) {
    state.phase = GamePhase.GameOver;
  } else {
    deselectUnit(state);
  }
}

function endPlayerTurn(stateRef: { state: GameState }): void {
  const state = stateRef.state;
  hideActionMenu();
  deselectUnit(state);

  playSFX('turnChange');
  startTurn(state, Team.Blue);
  triggerPhaseOverlay(Team.Blue);
  playMusic('enemy');

  setTimeout(() => {
    runAI(state, () => {
      if (state.winner !== null) {
        state.phase = GamePhase.GameOver;
        return;
      }
      state.turnCount++;
      startTurn(state, Team.Red);
      playSFX('turnChange');
      triggerPhaseOverlay(Team.Red);
      playMusic('player');
    });
  }, 1600);
}

function hitTest(sx: number, sy: number, rect: DOMRect): boolean {
  return sx >= rect.x && sx <= rect.x + rect.width &&
         sy >= rect.y && sy <= rect.y + rect.height;
}
