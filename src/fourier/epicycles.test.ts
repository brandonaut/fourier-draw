import { describe, expect, it } from 'vitest';
import type { Path } from '../path/types';
import {
  chainPositions,
  decompose,
  evaluateAt,
  orderForRender,
  topN,
  traceCurve
} from './epicycles';

describe('decompose', () => {
  it('returns empty for empty input', () => {
    expect(decompose([])).toEqual([]);
  });

  it('rejects non-power-of-2 sample counts', () => {
    expect(() => decompose([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }])).toThrow();
  });

  it('a constant path is a single DC epicycle', () => {
    const samples: Path = Array.from({ length: 8 }, () => ({ x: 3, y: -2 }));
    const eps = decompose(samples);
    expect(eps).toHaveLength(8);
    const dc = eps.find(e => e.frequency === 0)!;
    expect(dc.amplitude).toBeCloseTo(Math.hypot(3, -2), 12);
    for (const e of eps) {
      if (e.frequency !== 0) expect(e.amplitude).toBeLessThan(1e-12);
    }
  });

  it('a unit circle traversed once maps to a single epicycle at frequency 1', () => {
    const N = 16;
    const samples: Path = Array.from({ length: N }, (_, i) => {
      const t = i / N;
      return { x: Math.cos(2 * Math.PI * t), y: Math.sin(2 * Math.PI * t) };
    });
    const eps = decompose(samples);
    const f1 = eps.find(e => e.frequency === 1)!;
    expect(f1.amplitude).toBeCloseTo(1, 9);
    for (const e of eps) {
      if (e.frequency !== 1) expect(e.amplitude).toBeLessThan(1e-9);
    }
  });

  it('produces signed frequencies symmetric around 0', () => {
    const N = 8;
    const samples: Path = Array.from({ length: N }, () => ({ x: 0, y: 0 }));
    const eps = decompose(samples);
    const freqs = eps.map(e => e.frequency).sort((a, b) => a - b);
    expect(freqs).toEqual([-4, -3, -2, -1, 0, 1, 2, 3]);
  });

  it('reconstruction at sample times exactly recovers the input', () => {
    const N = 32;
    const samples: Path = Array.from({ length: N }, (_, i) => {
      const t = i / N;
      return {
        x: 2 * Math.cos(2 * Math.PI * 3 * t) + 0.5 * Math.sin(2 * Math.PI * t),
        y: Math.sin(2 * Math.PI * 5 * t) + 0.3
      };
    });
    const eps = decompose(samples);
    for (let i = 0; i < N; i++) {
      const t = i / N;
      const p = evaluateAt(eps, t);
      expect(p.x).toBeCloseTo(samples[i].x, 8);
      expect(p.y).toBeCloseTo(samples[i].y, 8);
    }
  });
});

describe('topN', () => {
  it('returns all when n exceeds length', () => {
    const eps = [
      { frequency: 0, amplitude: 1, phase: 0 },
      { frequency: 1, amplitude: 2, phase: 0 }
    ];
    expect(topN(eps, 5)).toHaveLength(2);
  });

  it('picks the largest amplitudes', () => {
    const eps = [
      { frequency: 0, amplitude: 0.1, phase: 0 },
      { frequency: 1, amplitude: 5, phase: 0 },
      { frequency: 2, amplitude: 0.5, phase: 0 },
      { frequency: 3, amplitude: 9, phase: 0 }
    ];
    const top = topN(eps, 2).map(e => e.frequency).sort();
    expect(top).toEqual([1, 3]);
  });

  it('returns empty for n <= 0', () => {
    const eps = [{ frequency: 0, amplitude: 1, phase: 0 }];
    expect(topN(eps, 0)).toEqual([]);
    expect(topN(eps, -3)).toEqual([]);
  });
});

describe('orderForRender', () => {
  it('orders by frequency magnitude with DC first', () => {
    const eps = [
      { frequency: -2, amplitude: 1, phase: 0 },
      { frequency: 3, amplitude: 1, phase: 0 },
      { frequency: 0, amplitude: 1, phase: 0 },
      { frequency: 1, amplitude: 1, phase: 0 },
      { frequency: -1, amplitude: 1, phase: 0 }
    ];
    const ordered = orderForRender(eps).map(e => e.frequency);
    expect(ordered[0]).toBe(0);
    expect(ordered.slice(1, 3).sort()).toEqual([-1, 1]);
    expect(ordered[3]).toBe(-2);
    expect(ordered[4]).toBe(3);
  });
});

describe('evaluateAt', () => {
  it('sums epicycle contributions', () => {
    const eps = [
      { frequency: 0, amplitude: 1, phase: 0 },
      { frequency: 1, amplitude: 2, phase: 0 }
    ];
    // At t=0: (1·cos(0), 1·sin(0)) + (2·cos(0), 2·sin(0)) = (3, 0).
    const p = evaluateAt(eps, 0);
    expect(p.x).toBeCloseTo(3, 12);
    expect(p.y).toBeCloseTo(0, 12);
    // At t=0.25: (1, 0) + (2·cos(π/2), 2·sin(π/2)) = (1, 2).
    const q = evaluateAt(eps, 0.25);
    expect(q.x).toBeCloseTo(1, 12);
    expect(q.y).toBeCloseTo(2, 12);
  });
});

describe('chainPositions', () => {
  it('starts at origin and ends at evaluateAt', () => {
    const eps = [
      { frequency: 0, amplitude: 2, phase: 0 },
      { frequency: 1, amplitude: 1, phase: Math.PI / 2 },
      { frequency: -1, amplitude: 0.5, phase: 0 }
    ];
    const t = 0.13;
    const positions = chainPositions(eps, t);
    expect(positions).toHaveLength(eps.length + 1);
    expect(positions[0]).toEqual({ x: 0, y: 0 });
    const tip = evaluateAt(eps, t);
    const last = positions[eps.length];
    expect(last.x).toBeCloseTo(tip.x, 12);
    expect(last.y).toBeCloseTo(tip.y, 12);
  });

  it('successive deltas equal individual epicycle vectors', () => {
    const eps = [
      { frequency: 2, amplitude: 1, phase: 0 },
      { frequency: -3, amplitude: 0.7, phase: 1 }
    ];
    const t = 0.4;
    const pos = chainPositions(eps, t);
    for (let i = 0; i < eps.length; i++) {
      const e = eps[i];
      const angle = 2 * Math.PI * e.frequency * t + e.phase;
      const dx = pos[i + 1].x - pos[i].x;
      const dy = pos[i + 1].y - pos[i].y;
      expect(dx).toBeCloseTo(e.amplitude * Math.cos(angle), 12);
      expect(dy).toBeCloseTo(e.amplitude * Math.sin(angle), 12);
    }
  });
});

describe('traceCurve', () => {
  it('returns the requested number of samples', () => {
    const eps = [{ frequency: 1, amplitude: 1, phase: 0 }];
    expect(traceCurve(eps, 16)).toHaveLength(16);
  });

  it('a single unit epicycle at frequency 1 traces a unit circle', () => {
    const eps = [{ frequency: 1, amplitude: 1, phase: 0 }];
    const trace = traceCurve(eps, 64);
    for (const p of trace) {
      expect(Math.hypot(p.x, p.y)).toBeCloseTo(1, 12);
    }
  });
});
