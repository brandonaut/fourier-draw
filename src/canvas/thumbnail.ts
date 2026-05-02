import type { Path } from '../path/types';

/**
 * Render a path into a small offscreen canvas and return a Blob suitable for
 * embedding in a drawing list. Auto-fits the path with a margin.
 */
export async function renderThumbnail(path: Path, size = 96): Promise<Blob | null> {
  if (path.length < 2) return null;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of path) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const w = Math.max(1, maxX - minX);
  const h = Math.max(1, maxY - minY);
  const margin = 0.85;
  const scale = Math.min((size / w) * margin, (size / h) * margin);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const tx = size / 2 - cx * scale;
  const ty = size / 2 - cy * scale;

  ctx.fillStyle = '#0b0f17';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = '#7dd3fc';
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(path[0].x * scale + tx, path[0].y * scale + ty);
  for (let i = 1; i < path.length; i++) {
    ctx.lineTo(path[i].x * scale + tx, path[i].y * scale + ty);
  }
  ctx.stroke();

  return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
}
