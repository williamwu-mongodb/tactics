import { GameState } from './types';
import { createGameState } from './game';
import { preloadSprites } from './sprites';
import { initRenderer, render } from './renderer';
import { initInput, setResetCallback } from './input';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

preloadSprites();
initRenderer(canvas);

const stateRef: { state: GameState } = { state: createGameState() };

setResetCallback(() => {
  stateRef.state = createGameState();
});

initInput(canvas, stateRef);

function gameLoop(time: number): void {
  render(stateRef.state, time);
  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
