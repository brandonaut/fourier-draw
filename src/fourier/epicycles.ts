import type { Path, Point } from '../path/types';
import { fft } from './fft';

/** One rotating arrow in the epicycle chain. */
export interface Epicycle {
  /** Signed integer frequency (..., -2, -1, 0, 1, 2, ...). */
  frequency: number;
  /** Vector length. */
  amplitude: number;
  /** Phase angle at t=0 (radians). */
  phase: number;
}

/**
 * Decompose a uniformly-sampled closed path into Fourier epicycles.
 *
 * Input length must be a power of 2. Output frequencies are mapped from the
 * raw FFT bin indices `[0, N)` to signed indices `[-N/2, N/2)` so animation
 * code can pair them naturally as conjugate-symmetric counter-rotating arrows.
 *
 * The DC bin (frequency 0) is the centroid; all others rotate.
 */
export function decompose(samples: Path): Epicycle[] {
  const n = samples.length;
  if (n === 0) return [];
  if ((n & (n - 1)) !== 0) {
    throw new Error(`decompose requires power-of-2 sample count (got ${n})`);
  }

  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    re[i] = samples[i].x;
    im[i] = samples[i].y;
  }
  fft(re, im);

  const out: Epicycle[] = new Array(n);
  for (let k = 0; k < n; k++) {
    // Map [0, N) → [-N/2, N/2): bins above N/2 represent negative frequencies.
    const frequency = k < n / 2 ? k : k - n;
    // Coefficient c_k = (re + i·im) / N gives the amplitude/phase of the
    // continuous reconstruction z(t) = Σ c_k · exp(2πi·k·t).
    const coefRe = re[k] / n;
    const coefIm = im[k] / n;
    out[k] = {
      frequency,
      amplitude: Math.hypot(coefRe, coefIm),
      phase: Math.atan2(coefIm, coefRe)
    };
  }
  return out;
}

/**
 * Pick the top-N epicycles by amplitude, preserving the DC term first.
 * Used for the "number of arrows" slider — fewer arrows = a coarser approximation.
 */
export function topN(epicycles: Epicycle[], n: number): Epicycle[] {
  if (n >= epicycles.length) return [...epicycles];
  if (n <= 0) return [];
  const sorted = [...epicycles].sort((a, b) => b.amplitude - a.amplitude);
  return sorted.slice(0, n);
}

/**
 * Evaluate the sum of a set of epicycles at parameter `t ∈ [0, 1)`.
 * Each epicycle contributes amplitude · exp(i · (2π·frequency·t + phase)).
 */
export function evaluateAt(epicycles: Epicycle[], t: number): Point {
  let x = 0;
  let y = 0;
  for (const e of epicycles) {
    const angle = 2 * Math.PI * e.frequency * t + e.phase;
    x += e.amplitude * Math.cos(angle);
    y += e.amplitude * Math.sin(angle);
  }
  return { x, y };
}

/**
 * Order epicycles for tip-to-tail drawing: DC first, then by frequency
 * magnitude ascending (low frequencies are the "big" arrows that move slowly,
 * higher ones add fine detail). Within equal magnitude, positive frequency first.
 */
export function orderForRender(epicycles: Epicycle[]): Epicycle[] {
  return [...epicycles].sort((a, b) => {
    const ma = Math.abs(a.frequency);
    const mb = Math.abs(b.frequency);
    if (ma !== mb) return ma - mb;
    return b.frequency - a.frequency;
  });
}

/**
 * Cumulative tip positions along an epicycle chain at time `t`.
 * Returns `epicycles.length + 1` points: index 0 is the chain origin (0,0),
 * each subsequent index is the tip after applying that epicycle. The final
 * point equals `evaluateAt(epicycles, t)`.
 */
export function chainPositions(epicycles: Epicycle[], t: number): Point[] {
  const out: Point[] = new Array(epicycles.length + 1);
  let x = 0;
  let y = 0;
  out[0] = { x, y };
  for (let i = 0; i < epicycles.length; i++) {
    const e = epicycles[i];
    const angle = 2 * Math.PI * e.frequency * t + e.phase;
    x += e.amplitude * Math.cos(angle);
    y += e.amplitude * Math.sin(angle);
    out[i + 1] = { x, y };
  }
  return out;
}

/**
 * Sample the curve traced by the chain over `samples` evenly-spaced t-values
 * in [0, 1). Used to draw the persistent trace.
 */
export function traceCurve(epicycles: Epicycle[], samples: number): Path {
  const out: Path = new Array(samples);
  for (let i = 0; i < samples; i++) {
    out[i] = evaluateAt(epicycles, i / samples);
  }
  return out;
}
