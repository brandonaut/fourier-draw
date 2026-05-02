import { describe, expect, it } from 'vitest';
import { pathLength, resampleByArclength } from './resample';
import type { Path } from './types';

const approx = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps;

describe('pathLength', () => {
  it('returns 0 for empty or single-point paths', () => {
    expect(pathLength([])).toBe(0);
    expect(pathLength([{ x: 5, y: 7 }])).toBe(0);
  });

  it('sums segment lengths', () => {
    const p: Path = [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 4 }
    ];
    expect(pathLength(p)).toBeCloseTo(7, 12);
  });
});

describe('resampleByArclength', () => {
  it('returns empty when count is 0', () => {
    expect(resampleByArclength([{ x: 0, y: 0 }], 0)).toEqual([]);
  });

  it('replicates a single point', () => {
    const out = resampleByArclength([{ x: 2, y: 3 }], 4);
    expect(out).toHaveLength(4);
    for (const p of out) expect(p).toEqual({ x: 2, y: 3 });
  });

  it('produces evenly-spaced samples on a straight line (open)', () => {
    const path: Path = [
      { x: 0, y: 0 },
      { x: 10, y: 0 }
    ];
    const out = resampleByArclength(path, 11);
    expect(out).toHaveLength(11);
    for (let i = 0; i < out.length; i++) {
      expect(out[i].x).toBeCloseTo(i, 12);
      expect(out[i].y).toBeCloseTo(0, 12);
    }
  });

  it('endpoints match path endpoints when open', () => {
    const path: Path = [
      { x: 0, y: 0 },
      { x: 1, y: 2 },
      { x: 4, y: 6 }
    ];
    const out = resampleByArclength(path, 50);
    expect(out[0]).toEqual(path[0]);
    expect(out[out.length - 1].x).toBeCloseTo(4, 12);
    expect(out[out.length - 1].y).toBeCloseTo(6, 12);
  });

  it('uniform arclength spacing on a corner-aligned path', () => {
    // Square perimeter 40 with N=41 → expectedStep=1; corners coincide with
    // samples 10/20/30, so every consecutive chord equals expectedStep.
    const path: Path = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
      { x: 0, y: 0 }
    ];
    const N = 41;
    const out = resampleByArclength(path, N);
    const total = pathLength(path);
    const expectedStep = total / (N - 1);
    for (let i = 1; i < out.length; i++) {
      const dx = out[i].x - out[i - 1].x;
      const dy = out[i].y - out[i - 1].y;
      const step = Math.hypot(dx, dy);
      expect(approx(step, expectedStep, 1e-9)).toBe(true);
    }
  });

  it('chord lengths are bounded above by expectedStep on arbitrary paths', () => {
    const path: Path = [
      { x: 0, y: 0 },
      { x: 5, y: 1 },
      { x: 7, y: 9 },
      { x: 12, y: 4 }
    ];
    const N = 64;
    const out = resampleByArclength(path, N);
    const expectedStep = pathLength(path) / (N - 1);
    for (let i = 1; i < out.length; i++) {
      const step = Math.hypot(out[i].x - out[i - 1].x, out[i].y - out[i - 1].y);
      expect(step).toBeLessThanOrEqual(expectedStep + 1e-9);
    }
  });

  it('closed mode appends start to end and avoids duplicating the wrap sample', () => {
    // Unit square traversed CCW; perimeter = 4, 4 samples → step 1.
    const square: Path = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 }
    ];
    const out = resampleByArclength(square, 4, true);
    expect(out).toHaveLength(4);
    expect(out[0]).toEqual({ x: 0, y: 0 });
    expect(out[1].x).toBeCloseTo(1, 12);
    expect(out[1].y).toBeCloseTo(0, 12);
    expect(out[2].x).toBeCloseTo(1, 12);
    expect(out[2].y).toBeCloseTo(1, 12);
    expect(out[3].x).toBeCloseTo(0, 12);
    expect(out[3].y).toBeCloseTo(1, 12);
  });

  it('handles a degenerate zero-length path by replicating the first point', () => {
    const path: Path = [
      { x: 1, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 1 }
    ];
    const out = resampleByArclength(path, 5);
    expect(out).toHaveLength(5);
    for (const p of out) expect(p).toEqual({ x: 1, y: 1 });
  });
});
