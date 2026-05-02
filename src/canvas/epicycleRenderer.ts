import { chainPositions, evaluateAt, orderForRender, topN, type Epicycle } from '../fourier/epicycles';
import type { Path, Point } from '../path/types';

export interface RendererOptions {
  /** Initial number of epicycles to use. */
  arrowCount?: number;
  /** Period duration in seconds — one full traversal at speed=1. */
  periodSeconds?: number;
  /** Speed multiplier (1 = `periodSeconds` per loop). */
  speed?: number;
  /** Number of trace samples per period. */
  traceSamples?: number;
}

interface InternalState {
  full: Epicycle[];
  active: Epicycle[];
  trace: Path;
  startTime: number;
  pausedAt: number | null;
  lastFrameT: number;
}

/**
 * Renders a rotating-epicycle animation on a canvas. Owns its own RAF loop
 * and devicePixelRatio handling. The renderer auto-fits the trace into the
 * canvas with a margin so the user always sees the full curve.
 */
export class EpicycleRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private state: InternalState | null = null;
  private rafId: number | null = null;
  private dpr = 1;
  private arrowCount: number;
  private periodSeconds: number;
  private speed: number;
  private traceSamples: number;

  constructor(canvas: HTMLCanvasElement, options: RendererOptions = {}) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D context unavailable');
    this.ctx = ctx;
    this.arrowCount = options.arrowCount ?? 64;
    this.periodSeconds = options.periodSeconds ?? 8;
    this.speed = options.speed ?? 1;
    this.traceSamples = options.traceSamples ?? 720;
    this.resize();
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.max(1, Math.round(rect.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * this.dpr));
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.state) this.drawFrame(this.state.lastFrameT);
  }

  load(epicycles: Epicycle[]): void {
    this.state = {
      full: epicycles,
      active: orderForRender(topN(epicycles, this.arrowCount)),
      trace: [],
      startTime: performance.now(),
      pausedAt: null,
      lastFrameT: 0
    };
    this.rebuildTrace();
  }

  setArrowCount(n: number): void {
    this.arrowCount = Math.max(1, Math.floor(n));
    if (!this.state) return;
    this.state.active = orderForRender(topN(this.state.full, this.arrowCount));
    this.rebuildTrace();
    this.drawFrame(this.state.lastFrameT);
  }

  setSpeed(s: number): void {
    if (!this.state) {
      this.speed = s;
      return;
    }
    // Re-anchor startTime so the visual phase doesn't jump on speed change.
    const now = this.isPaused() ? this.state.pausedAt! : performance.now();
    const oldT = this.computeT(now);
    this.speed = s;
    const periodMs = this.periodSeconds * 1000;
    this.state.startTime = now - oldT * (periodMs / Math.max(1e-6, this.speed));
    if (this.isPaused()) this.state.pausedAt = now;
  }

  play(): void {
    if (!this.state) return;
    if (this.isPaused()) {
      const now = performance.now();
      this.state.startTime += now - this.state.pausedAt!;
      this.state.pausedAt = null;
    }
    if (this.rafId === null) this.tick();
  }

  pause(): void {
    if (!this.state || this.isPaused()) return;
    this.state.pausedAt = performance.now();
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  isPaused(): boolean {
    return !!this.state && this.state.pausedAt !== null;
  }

  clear(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.state = null;
    const w = this.canvas.width / this.dpr;
    const h = this.canvas.height / this.dpr;
    this.ctx.clearRect(0, 0, w, h);
  }

  destroy(): void {
    this.clear();
  }

  private computeT(now: number): number {
    if (!this.state) return 0;
    const periodMs = this.periodSeconds * 1000;
    const elapsed = (now - this.state.startTime) * this.speed;
    return ((elapsed / periodMs) % 1 + 1) % 1;
  }

  private rebuildTrace(): void {
    if (!this.state) return;
    const samples = this.traceSamples;
    const trace: Path = new Array(samples);
    for (let i = 0; i < samples; i++) {
      trace[i] = evaluateAt(this.state.active, i / samples);
    }
    this.state.trace = trace;
  }

  private tick = (): void => {
    if (!this.state) {
      this.rafId = null;
      return;
    }
    const t = this.computeT(performance.now());
    this.state.lastFrameT = t;
    this.drawFrame(t);
    this.rafId = requestAnimationFrame(this.tick);
  };

  private drawFrame(t: number): void {
    if (!this.state) return;
    const ctx = this.ctx;
    const w = this.canvas.width / this.dpr;
    const h = this.canvas.height / this.dpr;
    ctx.clearRect(0, 0, w, h);

    // Path coordinates are already in CSS-pixel space (the same space the user
    // drew in), so render with an identity transform — the trace will overlay
    // the original strokes exactly.
    const toScreen = (p: Point): Point => ({ x: p.x, y: p.y });

    // Trace.
    const trace = this.state.trace;
    if (trace.length > 1) {
      ctx.strokeStyle = '#a78bfa';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const first = toScreen(trace[0]);
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < trace.length; i++) {
        const p = toScreen(trace[i]);
        ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.stroke();
    }

    // Epicycle chain.
    const chain = chainPositions(this.state.active, t);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.45)';
    for (let i = 0; i < this.state.active.length; i++) {
      const center = toScreen(chain[i]);
      const r = this.state.active[i].amplitude;
      if (r > 0.5) {
        ctx.beginPath();
        ctx.arc(center.x, center.y, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.strokeStyle = '#7dd3fc';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    const start = toScreen(chain[0]);
    ctx.moveTo(start.x, start.y);
    for (let i = 1; i < chain.length; i++) {
      const p = toScreen(chain[i]);
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();

    // Tip dot.
    const tip = toScreen(chain[chain.length - 1]);
    ctx.fillStyle = '#f472b6';
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}
