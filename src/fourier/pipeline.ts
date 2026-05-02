import { resampleByArclength } from '../path/resample';
import type { Path } from '../path/types';
import { decompose, type Epicycle } from './epicycles';

export interface PipelineOptions {
  /** Power-of-2 sample count fed into the FFT. */
  samples?: number;
  /** Connect last point back to first before resampling. */
  closePath?: boolean;
}

/**
 * Path → uniform arclength samples → FFT → epicycles. Returns null when the
 * path is too short to decompose meaningfully.
 */
export function pathToEpicycles(path: Path, options: PipelineOptions = {}): Epicycle[] | null {
  const samples = options.samples ?? 512;
  const closePath = options.closePath ?? true;
  if (path.length < 2) return null;
  if ((samples & (samples - 1)) !== 0) {
    throw new Error(`samples must be power of 2 (got ${samples})`);
  }
  const resampled = resampleByArclength(path, samples, closePath);
  return decompose(resampled);
}
