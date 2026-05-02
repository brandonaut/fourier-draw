import type { Path } from './types';

/**
 * Compact path codec for URL-hash sharing.
 *
 * Binary layout (little-endian):
 *   offset  size  field
 *   0       1     magic byte 'F' (0x46)
 *   1       1     version (0x01)
 *   2       2     uint16 point count
 *   4       4     float32 minX
 *   8       4     float32 minY
 *   12      4     float32 maxX
 *   16      4     float32 maxY
 *   20+     4·N   per point: uint16 x, uint16 y (quantized to bounding box)
 */

const MAGIC = 0x46;
const VERSION = 0x01;
const HEADER_BYTES = 20;
const MAX_POINTS = 0xffff;

export function encodePath(path: Path): string {
  if (path.length > MAX_POINTS) throw new Error(`path too long (>${MAX_POINTS} points)`);
  const count = path.length;
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
  if (count === 0) {
    minX = minY = maxX = maxY = 0;
  }

  const buf = new ArrayBuffer(HEADER_BYTES + count * 4);
  const view = new DataView(buf);
  view.setUint8(0, MAGIC);
  view.setUint8(1, VERSION);
  view.setUint16(2, count, true);
  view.setFloat32(4, minX, true);
  view.setFloat32(8, minY, true);
  view.setFloat32(12, maxX, true);
  view.setFloat32(16, maxY, true);

  const rangeX = Math.max(1e-9, maxX - minX);
  const rangeY = Math.max(1e-9, maxY - minY);
  for (let i = 0; i < count; i++) {
    const p = path[i];
    const qx = Math.round(((p.x - minX) / rangeX) * 0xffff);
    const qy = Math.round(((p.y - minY) / rangeY) * 0xffff);
    view.setUint16(HEADER_BYTES + i * 4, qx & 0xffff, true);
    view.setUint16(HEADER_BYTES + i * 4 + 2, qy & 0xffff, true);
  }

  return bytesToBase64Url(new Uint8Array(buf));
}

export function decodePath(encoded: string): Path {
  const bytes = base64UrlToBytes(encoded);
  if (bytes.byteLength < HEADER_BYTES) throw new Error('encoded path too short');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint8(0) !== MAGIC) throw new Error('bad magic');
  if (view.getUint8(1) !== VERSION) throw new Error(`unsupported version: ${view.getUint8(1)}`);
  const count = view.getUint16(2, true);
  const expected = HEADER_BYTES + count * 4;
  if (bytes.byteLength !== expected) {
    throw new Error(`length mismatch: expected ${expected}, got ${bytes.byteLength}`);
  }
  const minX = view.getFloat32(4, true);
  const minY = view.getFloat32(8, true);
  const maxX = view.getFloat32(12, true);
  const maxY = view.getFloat32(16, true);
  const rangeX = maxX - minX;
  const rangeY = maxY - minY;

  const out: Path = new Array(count);
  for (let i = 0; i < count; i++) {
    const qx = view.getUint16(HEADER_BYTES + i * 4, true);
    const qy = view.getUint16(HEADER_BYTES + i * 4 + 2, true);
    out[i] = {
      x: minX + (qx / 0xffff) * rangeX,
      y: minY + (qy / 0xffff) * rangeY
    };
  }
  return out;
}

/** Worst-case quantization error, in path units, given a path's bounding box. */
export function quantizationError(path: Path): number {
  if (path.length === 0) return 0;
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
  const rangeX = Math.max(1e-9, maxX - minX);
  const rangeY = Math.max(1e-9, maxY - minY);
  return Math.max(rangeX, rangeY) / 0xffff;
}

// ---- base64url helpers (work in browser and node test environment) ----

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const b64 = typeof btoa === 'function' ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(s: string): Uint8Array {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = typeof atob === 'function'
    ? atob(padded)
    : Buffer.from(padded, 'base64').toString('binary');
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
