import './styles.css';
import { DrawingCanvas } from './canvas/drawingCanvas';
import type { Path } from './path/types';

const app = document.getElementById('app');
if (!app) throw new Error('#app missing');

app.innerHTML = `
  <div class="app-bar top">
    <strong>Fourier Draw</strong>
    <span class="spacer"></span>
    <button id="btn-clear" type="button">Clear</button>
  </div>
  <canvas id="canvas" class="app-canvas"></canvas>
`;

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const drawing = new DrawingCanvas(canvas, {
  onPathComplete: (path: Path) => {
    console.log('path complete', path.length, 'points');
  }
});

window.addEventListener('resize', () => drawing.resize());

document.getElementById('btn-clear')?.addEventListener('click', () => drawing.clear());
