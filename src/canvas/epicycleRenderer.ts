import { chainPositions, evaluateAt, orderForRender, topN, type Epicycle } from '../fourier/epicycles';
import type { Path, Point } from '../path/types';

export interface RendererOptions {
  /** Initial number of epicycles to use (DC excluded). */
  arrowCount?: number;
  /** Period duration in seconds — one full traversal at speed=1. */
  periodSeconds?: number;
  /** Speed multiplier (1 = `periodSeconds` per loop). */
  speed?: number;
  /** Number of trace samples per period. */
  traceSamples?: number;
  /** Fraction of one period that the trail remains visible (0..1]. */
  fadeFraction?: number;
}

interface InternalState {
  /** All non-DC epicycles available to draw from. */
  rotating: Epicycle[];
  /** Currently rendered top-N (subset of `rotating`). */
  active: Epicycle[];
  /** DC offset in path-space — the chain origin is anchored here. */
  dcOffset: Point;
  /** Precomputed trace polyline in epicycle-local coords (centered on DC). */
  trace: Path;
  startTime: number;
  pausedAt: number | null;
  lastFrameT: number;
}

/**
 * Renders a rotating-epicycle animation on a canvas. The chain is anchored
 * at the path's centroid (the DC term) so there is no static "primary arrow"
 * spanning from the origin to the centroid — only the rotating components.
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
  private fadeFraction: number;

  constructor(canvas: HTMLCanvasElement, options: RendererOptions = {}) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D context unavailable');
    this.ctx = ctx;
    this.arrowCount = options.arrowCount ?? 64;
    this.periodSeconds = options.periodSeconds ?? 8;
    this.speed = options.speed ?? 1;
    this.traceSamples = options.traceSamples ?? 360;
    this.fadeFraction = clamp01(options.fadeFraction ?? 0.7);
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
    const dc = epicycles.find((e) => e.frequency === 0);
    const dcOffset: Point = dc
      ? { x: dc.amplitude * Math.cos(dc.phase), y: dc.amplitude * Math.sin(dc.phase) }
      : { x: 0, y: 0 };
    const rotating = epicycles.filter((e) => e.frequency !== 0);
    this.state = {
      rotating,
      active: orderForRender(topN(rotating, this.arrowCount)),
      dcOffset,
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
    this.state.active = orderForRender(topN(this.state.rotating, this.arrowCount));
    this.rebuildTrace();
    this.drawFrame(this.state.lastFrameT);
  }

  setSpeed(s: number): void {
    if (!this.state) {
      this.speed = s;
      return;
    }
    const now = this.isPaused() ? this.state.pausedAt! : performance.now();
    const oldT = this.computeT(now);
    this.speed = s;
    const periodMs = this.periodSeconds * 1000;
    this.state.startTime = now - oldT * (periodMs / Math.max(1e-6, this.speed));
    if (this.isPaused()) this.state.pausedAt = now;
  }

  setFade(fraction: number): void {
    this.fadeFraction = clamp01(fraction);
    if (this.state) this.drawFrame(this.state.lastFrameT);
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

    // Translate epicycle-local coords (centered on DC) to screen by adding the
    // DC offset. This anchors the chain at the centroid of the original drawing
    // so the static "DC arrow" is implicit and never drawn.
    const dx = this.state.dcOffset.x;
    const dy = this.state.dcOffset.y;
    const toScreen = (p: Point): Point => ({ x: p.x + dx, y: p.y + dy });

    // Faded trace: only the most recent `fadeFraction` of the period is drawn,
    // with alpha increasing toward the head so the tail dissolves before the
    // tip catches up to itself on the next loop.
    const trace = this.state.trace;
    if (trace.length > 1 && this.fadeFraction > 0) {
      const N = trace.length;
      const fadeSegments = Math.max(1, Math.min(N, Math.floor(this.fadeFraction * N)));
      const headIdx = Math.floor(t * N) % N;
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      for (let i = 0; i < fadeSegments; i++) {
        // i=0 → oldest (faintest); i=fadeSegments-1 → newest (brightest).
        const a = (headIdx - fadeSegments + i + N) % N;
        const b = (a + 1) % N;
        const alpha = ((i + 1) / fadeSegments) ** 1.4;
        ctx.strokeStyle = `rgba(167, 139, 250, ${alpha.toFixed(3)})`;
        ctx.beginPath();
        const p0 = toScreen(trace[a]);
        const p1 = toScreen(trace[b]);
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
      }
    }

    // Rotating epicycle chain — chain[0] is the centroid, chain[k] is the
    // tip after k arrows. Skipping DC means there's no big static arrow.
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

    const tip = toScreen(chain[chain.length - 1]);
    ctx.fillStyle = '#f472b6';
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}
