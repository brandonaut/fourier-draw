import { describe, expect, it } from 'vitest';
import { decodePath, encodePath, quantizationError } from './codec';
import type { Path } from './types';

describe('path codec', () => {
  it('round-trips a simple path within quantization error', () => {
    const path: Path = [
      { x: 10, y: 20 },
      { x: 100, y: 50 },
      { x: 200, y: 200 },
      { x: 150, y: 80 }
    ];
    const encoded = encodePath(path);
    const decoded = decodePath(encoded);
    const eps = quantizationError(path);
    expect(decoded).toHaveLength(path.length);
    for (let i = 0; i < path.length; i++) {
      expect(Math.abs(decoded[i].x - path[i].x)).toBeLessThanOrEqual(eps + 1e-3);
      expect(Math.abs(decoded[i].y - path[i].y)).toBeLessThanOrEqual(eps + 1e-3);
    }
  });

  it('round-trips an empty path', () => {
    const encoded = encodePath([]);
    expect(decodePath(encoded)).toEqual([]);
  });

  it('round-trips a single-point path with the point at the origin of its bbox', () => {
    const encoded = encodePath([{ x: 42, y: -7 }]);
    const decoded = decodePath(encoded);
    expect(decoded).toHaveLength(1);
    expect(decoded[0].x).toBeCloseTo(42, 3);
    expect(decoded[0].y).toBeCloseTo(-7, 3);
  });

  it('produces a URL-safe string (no +, /, =, or whitespace)', () => {
    const path: Path = Array.from({ length: 50 }, (_, i) => ({ x: i, y: i * i }));
    const encoded = encodePath(path);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('rejects garbage input on decode', () => {
    expect(() => decodePath('!!!!!')).toThrow();
    // Valid base64 but bad magic byte.
    expect(() => decodePath('AAAA')).toThrow();
  });

  it('detects truncated payloads', () => {
    const path: Path = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 }
    ];
    const encoded = encodePath(path);
    const truncated = encoded.slice(0, -4);
    expect(() => decodePath(truncated)).toThrow();
  });

  it('quantization error scales with bounding box', () => {
    const small: Path = [{ x: 0, y: 0 }, { x: 1, y: 1 }];
    const big: Path = [{ x: 0, y: 0 }, { x: 1000, y: 1000 }];
    expect(quantizationError(big)).toBeGreaterThan(quantizationError(small));
  });
});
