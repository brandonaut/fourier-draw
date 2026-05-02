import { describe, expect, it } from 'vitest';
import { PathTracker } from './tracker';

describe('PathTracker', () => {
  it('starts empty', () => {
    const t = new PathTracker();
    expect(t.isEmpty()).toBe(true);
    expect(t.current()).toEqual([]);
  });

  it('begin() seeds the path with the first point', () => {
    const t = new PathTracker();
    t.begin({ x: 5, y: 7 });
    expect(t.current()).toEqual([{ x: 5, y: 7 }]);
  });

  it('rejects points closer than minDistance', () => {
    const t = new PathTracker(2);
    t.begin({ x: 0, y: 0 });
    expect(t.add({ x: 0.5, y: 0 })).toBe(false);
    expect(t.add({ x: 1, y: 1 })).toBe(false); // distance ≈ 1.41 < 2
    expect(t.add({ x: 3, y: 0 })).toBe(true);
    expect(t.current()).toHaveLength(2);
  });

  it('accepts points at or beyond minDistance', () => {
    const t = new PathTracker(2);
    t.begin({ x: 0, y: 0 });
    expect(t.add({ x: 2, y: 0 })).toBe(true);
    expect(t.add({ x: 2, y: 2 })).toBe(true);
    expect(t.current()).toHaveLength(3);
  });

  it('add() before begin() bootstraps with the first point', () => {
    const t = new PathTracker();
    expect(t.add({ x: 1, y: 1 })).toBe(true);
    expect(t.current()).toEqual([{ x: 1, y: 1 }]);
  });

  it('clear() resets the path', () => {
    const t = new PathTracker(0.5);
    t.begin({ x: 0, y: 0 });
    t.add({ x: 1, y: 0 });
    t.clear();
    expect(t.isEmpty()).toBe(true);
  });

  it('end() returns the accumulated path', () => {
    const t = new PathTracker(0.5);
    t.begin({ x: 0, y: 0 });
    t.add({ x: 1, y: 0 });
    t.add({ x: 2, y: 0 });
    expect(t.end()).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 }
    ]);
  });
});
