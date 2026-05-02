import { PathTracker } from '../path/tracker';
import type { Path, Point } from '../path/types';

export interface DrawingCanvasOptions {
  minDistance?: number;
  strokeColor?: string;
  strokeWidth?: number;
  onPathComplete?: (path: Path) => void;
}

/**
 * Wires a `<canvas>` to pointer events for free-hand drawing. Renders the
 * in-progress path as it grows; on pointerup, fires `onPathComplete` with the
 * captured Path. Survives DPR changes via `resize()`.
 */
export class DrawingCanvas {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly tracker: PathTracker;
  private readonly opts: Required<Omit<DrawingCanvasOptions, 'onPathComplete'>> & {
    onPathComplete: ((path: Path) => void) | null;
  };
  private activePointerId: number | null = null;
  private dpr = 1;

  constructor(canvas: HTMLCanvasElement, options: DrawingCanvasOptions = {}) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D context unavailable');
    this.ctx = ctx;
    this.opts = {
      minDistance: options.minDistance ?? 1.5,
      strokeColor: options.strokeColor ?? '#7dd3fc',
      strokeWidth: options.strokeWidth ?? 2,
      onPathComplete: options.onPathComplete ?? null
    };
    this.tracker = new PathTracker(this.opts.minDistance);
    this.bind();
    this.resize();
  }

  private bind(): void {
    this.canvas.style.touchAction = 'none';
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('pointercancel', this.onPointerUp);
  }

  destroy(): void {
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerUp);
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.max(1, Math.round(rect.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * this.dpr));
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.redraw();
  }

  clear(): void {
    this.tracker.clear();
    this.redraw();
  }

  setPath(path: Path): void {
    this.tracker.clear();
    if (path.length > 0) {
      this.tracker.begin(path[0]);
      for (let i = 1; i < path.length; i++) this.tracker.add(path[i]);
    }
    this.redraw();
  }

  getPath(): Path {
    return this.tracker.current();
  }

  private clientToCanvas(e: PointerEvent): Point {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (this.activePointerId !== null) return;
    this.activePointerId = e.pointerId;
    this.canvas.setPointerCapture(e.pointerId);
    this.tracker.clear();
    this.tracker.begin(this.clientToCanvas(e));
    this.redraw();
    e.preventDefault();
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.activePointerId) return;
    if (this.tracker.add(this.clientToCanvas(e))) this.redraw();
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.activePointerId) return;
    this.activePointerId = null;
    try {
      this.canvas.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore — capture may already be released on cancel */
    }
    const path = this.tracker.end();
    if (path.length >= 2) this.opts.onPathComplete?.(path);
  };

  private redraw(): void {
    const w = this.canvas.width / this.dpr;
    const h = this.canvas.height / this.dpr;
    this.ctx.clearRect(0, 0, w, h);
    const path = this.tracker.current();
    if (path.length < 2) return;
    this.ctx.strokeStyle = this.opts.strokeColor;
    this.ctx.lineWidth = this.opts.strokeWidth;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.beginPath();
    this.ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) this.ctx.lineTo(path[i].x, path[i].y);
    this.ctx.stroke();
  }
}
