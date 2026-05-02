import './styles.css';
import { DrawingCanvas } from './canvas/drawingCanvas';
import { EpicycleRenderer } from './canvas/epicycleRenderer';
import { renderThumbnail } from './canvas/thumbnail';
import { pathToEpicycles } from './fourier/pipeline';
import type { Path } from './path/types';
import { DrawingStore, newDrawingId, type Drawing } from './storage/db';

const app = document.getElementById('app');
if (!app) throw new Error('#app missing');

app.innerHTML = `
  <div class="app-bar top">
    <strong>Fourier Draw</strong>
    <span class="spacer"></span>
    <button id="btn-save" type="button">Save</button>
    <button id="btn-open" type="button">Open</button>
    <button id="btn-mode" type="button" class="primary">Play</button>
    <button id="btn-clear" type="button">Clear</button>
  </div>
  <canvas id="draw-canvas" class="app-canvas layer"></canvas>
  <canvas id="epi-canvas" class="app-canvas layer"></canvas>
  <div class="app-bar bottom" id="controls" hidden>
    <div class="row">
      <label for="arrows">Arrows: <span id="arrows-val">64</span></label>
      <input id="arrows" type="range" min="1" max="256" value="64" />
    </div>
    <div class="row">
      <label for="speed">Speed: <span id="speed-val">1.00×</span></label>
      <input id="speed" type="range" min="0.1" max="3" step="0.05" value="1" />
    </div>
    <div class="row">
      <label class="check">
        <input id="auto-close" type="checkbox" checked />
        <span>Auto-close shape</span>
      </label>
      <button id="btn-play" type="button" class="primary">Pause</button>
    </div>
  </div>
  <div id="modal" class="modal" hidden>
    <div class="modal-card">
      <div class="modal-head">
        <strong id="modal-title">Saved drawings</strong>
        <button id="modal-close" type="button">Close</button>
      </div>
      <div id="modal-body" class="modal-body"></div>
    </div>
  </div>
`;

const drawCanvas = document.getElementById('draw-canvas') as HTMLCanvasElement;
const epiCanvas = document.getElementById('epi-canvas') as HTMLCanvasElement;

let lastPath: Path = [];
let mode: 'draw' | 'play' = 'draw';

const store = new DrawingStore();

const drawing = new DrawingCanvas(drawCanvas, {
  onPathComplete: (path) => {
    lastPath = path;
    setMode('play');
  }
});

const renderer = new EpicycleRenderer(epiCanvas, {
  arrowCount: 64,
  periodSeconds: 8,
  speed: 1
});

window.addEventListener('resize', () => {
  drawing.resize();
  renderer.resize();
});

const btnMode = document.getElementById('btn-mode') as HTMLButtonElement;
const btnClear = document.getElementById('btn-clear') as HTMLButtonElement;
const btnPlay = document.getElementById('btn-play') as HTMLButtonElement;
const btnSave = document.getElementById('btn-save') as HTMLButtonElement;
const btnOpen = document.getElementById('btn-open') as HTMLButtonElement;
const controls = document.getElementById('controls') as HTMLDivElement;
const arrowsInput = document.getElementById('arrows') as HTMLInputElement;
const arrowsVal = document.getElementById('arrows-val') as HTMLSpanElement;
const speedInput = document.getElementById('speed') as HTMLInputElement;
const speedVal = document.getElementById('speed-val') as HTMLSpanElement;
const autoCloseInput = document.getElementById('auto-close') as HTMLInputElement;
const modal = document.getElementById('modal') as HTMLDivElement;
const modalBody = document.getElementById('modal-body') as HTMLDivElement;
const modalClose = document.getElementById('modal-close') as HTMLButtonElement;

function setMode(next: 'draw' | 'play'): void {
  mode = next;
  if (mode === 'play') {
    if (lastPath.length < 2) {
      mode = 'draw';
      return;
    }
    rebuildEpicycles();
    epiCanvas.style.pointerEvents = 'auto';
    drawCanvas.style.opacity = '0.18';
    controls.hidden = false;
    btnMode.textContent = 'Draw';
    renderer.play();
    btnPlay.textContent = 'Pause';
  } else {
    renderer.clear();
    drawCanvas.style.opacity = '1';
    controls.hidden = true;
    btnMode.textContent = 'Play';
  }
}

function rebuildEpicycles(): void {
  const eps = pathToEpicycles(lastPath, {
    samples: 512,
    closePath: autoCloseInput.checked
  });
  if (!eps) return;
  renderer.load(eps);
  renderer.setArrowCount(Number.parseInt(arrowsInput.value, 10));
  renderer.setSpeed(Number.parseFloat(speedInput.value));
  renderer.play();
  btnPlay.textContent = 'Pause';
}

btnMode.addEventListener('click', () => setMode(mode === 'draw' ? 'play' : 'draw'));
btnClear.addEventListener('click', () => {
  lastPath = [];
  drawing.clear();
  setMode('draw');
});
btnPlay.addEventListener('click', () => {
  if (renderer.isPaused()) {
    renderer.play();
    btnPlay.textContent = 'Pause';
  } else {
    renderer.pause();
    btnPlay.textContent = 'Play';
  }
});
arrowsInput.addEventListener('input', () => {
  const n = Number.parseInt(arrowsInput.value, 10);
  arrowsVal.textContent = String(n);
  renderer.setArrowCount(n);
});
speedInput.addEventListener('input', () => {
  const s = Number.parseFloat(speedInput.value);
  speedVal.textContent = `${s.toFixed(2)}×`;
  renderer.setSpeed(s);
});
autoCloseInput.addEventListener('change', () => {
  if (mode === 'play') rebuildEpicycles();
});

btnSave.addEventListener('click', async () => {
  if (lastPath.length < 2) {
    alert('Draw something first.');
    return;
  }
  const name = prompt('Name this drawing:', `Sketch ${new Date().toLocaleString()}`);
  if (!name) return;
  const thumb = await renderThumbnail(lastPath);
  const drawingRecord: Drawing = {
    id: newDrawingId(),
    name,
    createdAt: Date.now(),
    path: lastPath,
    thumbnail: thumb ?? undefined
  };
  await store.save(drawingRecord);
});

btnOpen.addEventListener('click', async () => {
  const items = await store.list();
  modalBody.innerHTML = '';
  if (items.length === 0) {
    modalBody.innerHTML = '<p class="empty">No saved drawings yet.</p>';
  } else {
    for (const item of items) {
      const card = document.createElement('div');
      card.className = 'drawing-card';
      const thumbUrl = item.thumbnail ? URL.createObjectURL(item.thumbnail) : '';
      card.innerHTML = `
        <img alt="" src="${thumbUrl}" />
        <div class="drawing-meta">
          <strong>${escapeHtml(item.name)}</strong>
          <small>${new Date(item.createdAt).toLocaleString()}</small>
        </div>
        <div class="drawing-actions">
          <button data-action="open" data-id="${item.id}">Open</button>
          <button data-action="delete" data-id="${item.id}">Delete</button>
        </div>
      `;
      modalBody.appendChild(card);
    }
  }
  modal.hidden = false;
});

modal.addEventListener('click', async (e) => {
  const target = e.target as HTMLElement;
  if (target === modal || target.id === 'modal-close') {
    modal.hidden = true;
    return;
  }
  const action = target.dataset?.action;
  const id = target.dataset?.id;
  if (!action || !id) return;
  if (action === 'open') {
    const record = await store.load(id);
    if (record) {
      lastPath = record.path;
      drawing.setPath(record.path);
      modal.hidden = true;
      setMode('play');
    }
  } else if (action === 'delete') {
    await store.delete(id);
    btnOpen.click();
  }
});

modalClose.addEventListener('click', () => {
  modal.hidden = true;
});

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};
function escapeHtml(s: string): string {
  return s.replaceAll(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}
