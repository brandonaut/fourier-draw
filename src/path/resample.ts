import type { Path, Point } from './types';

export function pathLength(path: Path): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const dx = path[i].x - path[i - 1].x;
    const dy = path[i].y - path[i - 1].y;
    total += Math.hypot(dx, dy);
  }
  return total;
}

/**
 * Resample a path to `count` evenly-spaced points along its arclength.
 * The first sample sits at the start of the path; the last sits at the end
 * (closed=false) or one step before the closing edge (closed=true) so the
 * `count` samples cover one full period without duplicating start and end.
 */
export function resampleByArclength(path: Path, count: number, closed = false): Path {
  if (count <= 0) return [];
  if (path.length === 0) return [];
  if (path.length === 1) {
    return Array.from({ length: count }, () => ({ ...path[0] }));
  }

  const working: Path = closed
    ? [...path, path[0]]
    : path;

  const cumulative = new Float64Array(working.length);
  for (let i = 1; i < working.length; i++) {
    const dx = working[i].x - working[i - 1].x;
    const dy = working[i].y - working[i - 1].y;
    cumulative[i] = cumulative[i - 1] + Math.hypot(dx, dy);
  }
  const total = cumulative[cumulative.length - 1];

  if (total === 0) {
    return Array.from({ length: count }, () => ({ ...working[0] }));
  }

  const out: Path = new Array(count);
  // For closed=true, samples cover [0, total) (avoid duplicating the wrap).
  // For closed=false, samples cover [0, total].
  const denom = closed ? count : count - 1;
  let segIdx = 1;
  for (let i = 0; i < count; i++) {
    const target = denom === 0 ? 0 : (i / denom) * total;
    while (segIdx < cumulative.length - 1 && cumulative[segIdx] < target) {
      segIdx++;
    }
    const segStart = cumulative[segIdx - 1];
    const segEnd = cumulative[segIdx];
    const segLen = segEnd - segStart;
    const t = segLen === 0 ? 0 : (target - segStart) / segLen;
    out[i] = lerp(working[segIdx - 1], working[segIdx], t);
  }
  return out;
}

function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
