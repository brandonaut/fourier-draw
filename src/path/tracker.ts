import type { Path, Point } from './types';

/**
 * Incrementally builds a path from raw pointer samples, dropping points that
 * are within `minDistance` of the previous accepted point. Pure logic so it
 * can be unit-tested without a DOM.
 */
export class PathTracker {
  private path: Path = [];
  private readonly minDistance: number;

  constructor(minDistance = 1.5) {
    this.minDistance = minDistance;
  }

  begin(p: Point): void {
    this.path = [{ x: p.x, y: p.y }];
  }

  /** Returns true if the point was added, false if it was rejected as too close. */
  add(p: Point): boolean {
    if (this.path.length === 0) {
      this.path.push({ x: p.x, y: p.y });
      return true;
    }
    const last = this.path[this.path.length - 1];
    const dx = p.x - last.x;
    const dy = p.y - last.y;
    if (dx * dx + dy * dy < this.minDistance * this.minDistance) return false;
    this.path.push({ x: p.x, y: p.y });
    return true;
  }

  end(): Path {
    return this.path;
  }

  current(): Path {
    return this.path;
  }

  clear(): void {
    this.path = [];
  }

  isEmpty(): boolean {
    return this.path.length === 0;
  }
}
