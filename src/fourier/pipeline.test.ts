import { describe, expect, it } from 'vitest';
import type { Path } from '../path/types';
import { evaluateAt } from './epicycles';
import { pathToEpicycles } from './pipeline';

describe('pathToEpicycles', () => {
  it('returns null for paths with fewer than 2 points', () => {
    expect(pathToEpicycles([])).toBeNull();
    expect(pathToEpicycles([{ x: 0, y: 0 }])).toBeNull();
  });

  it('rejects non-power-of-2 sample counts', () => {
    const path: Path = [
      { x: 0, y: 0 },
      { x: 1, y: 0 }
    ];
    expect(() => pathToEpicycles(path, { samples: 100 })).toThrow();
  });

  it('round-trips a circle with high fidelity', () => {
    const N = 200;
    const path: Path = Array.from({ length: N }, (_, i) => {
      const t = (i / N) * 2 * Math.PI;
      return { x: Math.cos(t), y: Math.sin(t) };
    });
    const eps = pathToEpicycles(path, { samples: 256, closePath: true })!;
    expect(eps).not.toBeNull();
    // Reconstructed curve at any t lies on the unit circle within tolerance.
    for (let i = 0; i < 32; i++) {
      const p = evaluateAt(eps, i / 32);
      expect(Math.hypot(p.x, p.y)).toBeCloseTo(1, 3);
    }
  });
});
