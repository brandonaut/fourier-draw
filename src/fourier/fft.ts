/**
 * In-place radix-2 Cooley–Tukey FFT.
 *
 * Length must be a power of two. `re` and `im` are mutated in place; pass
 * `inverse = true` to compute the inverse FFT (the output is divided by N).
 */
export function fft(re: Float64Array, im: Float64Array, inverse = false): void {
  const n = re.length;
  if (n !== im.length) throw new Error('re/im length mismatch');
  if (n <= 1) return;
  if ((n & (n - 1)) !== 0) throw new Error(`FFT length must be power of 2 (got ${n})`);

  // Bit-reversal permutation.
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }

  const sign = inverse ? 1 : -1;
  for (let len = 2; len <= n; len <<= 1) {
    const halfLen = len >> 1;
    const angle = (sign * 2 * Math.PI) / len;
    const wReStep = Math.cos(angle);
    const wImStep = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let wRe = 1;
      let wIm = 0;
      for (let k = 0; k < halfLen; k++) {
        const a = i + k;
        const b = a + halfLen;
        const tRe = wRe * re[b] - wIm * im[b];
        const tIm = wRe * im[b] + wIm * re[b];
        re[b] = re[a] - tRe;
        im[b] = im[a] - tIm;
        re[a] += tRe;
        im[a] += tIm;
        const nextWRe = wRe * wReStep - wIm * wImStep;
        wIm = wRe * wImStep + wIm * wReStep;
        wRe = nextWRe;
      }
    }
  }

  if (inverse) {
    for (let i = 0; i < n; i++) {
      re[i] /= n;
      im[i] /= n;
    }
  }
}

/** Convenience wrapper: returns fresh arrays, leaves inputs untouched. */
export function fftCopy(
  re: Readonly<Float64Array>,
  im: Readonly<Float64Array>,
  inverse = false
): { re: Float64Array; im: Float64Array } {
  const outRe = new Float64Array(re);
  const outIm = new Float64Array(im);
  fft(outRe, outIm, inverse);
  return { re: outRe, im: outIm };
}
