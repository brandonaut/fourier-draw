import { describe, expect, it } from 'vitest';
import { fft, fftCopy } from './fft';

function naiveDFT(
  re: Readonly<Float64Array>,
  im: Readonly<Float64Array>
): { re: Float64Array; im: Float64Array } {
  const n = re.length;
  const outRe = new Float64Array(n);
  const outIm = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    let sumRe = 0;
    let sumIm = 0;
    for (let t = 0; t < n; t++) {
      const angle = (-2 * Math.PI * k * t) / n;
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      sumRe += re[t] * c - im[t] * s;
      sumIm += re[t] * s + im[t] * c;
    }
    outRe[k] = sumRe;
    outIm[k] = sumIm;
  }
  return { re: outRe, im: outIm };
}

const closeEnough = (a: Float64Array, b: Float64Array, eps = 1e-9) => {
  expect(a.length).toBe(b.length);
  for (let i = 0; i < a.length; i++) {
    expect(Math.abs(a[i] - b[i])).toBeLessThan(eps);
  }
};

describe('fft', () => {
  it('rejects non-power-of-two lengths', () => {
    const re = new Float64Array(3);
    const im = new Float64Array(3);
    expect(() => fft(re, im)).toThrow();
  });

  it('rejects mismatched re/im lengths', () => {
    expect(() => fft(new Float64Array(4), new Float64Array(2))).toThrow();
  });

  it('handles n <= 1 as identity', () => {
    const re = new Float64Array([5]);
    const im = new Float64Array([7]);
    fft(re, im);
    expect(re[0]).toBe(5);
    expect(im[0]).toBe(7);
  });

  it('matches naive DFT on random input', () => {
    const n = 16;
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      re[i] = Math.sin(i * 0.7) + 0.3 * Math.cos(i * 1.3);
      im[i] = Math.cos(i * 0.5);
    }
    const expected = naiveDFT(re, im);
    const actual = fftCopy(re, im);
    closeEnough(actual.re, expected.re, 1e-10);
    closeEnough(actual.im, expected.im, 1e-10);
  });

  it('round-trips: ifft(fft(x)) == x', () => {
    const n = 64;
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      re[i] = Math.sin(2 * i) + i * 0.01;
      im[i] = Math.cos(i * 0.3);
    }
    const orig = { re: new Float64Array(re), im: new Float64Array(im) };
    fft(re, im);
    fft(re, im, true);
    closeEnough(re, orig.re, 1e-10);
    closeEnough(im, orig.im, 1e-10);
  });

  it('a delta at t=0 maps to a flat spectrum of magnitude 1', () => {
    const n = 8;
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    re[0] = 1;
    fft(re, im);
    for (let k = 0; k < n; k++) {
      expect(re[k]).toBeCloseTo(1, 12);
      expect(im[k]).toBeCloseTo(0, 12);
    }
  });

  it('a unit complex sinusoid e^{2πi·k₀t/N} maps to a single bin at k₀', () => {
    const n = 16;
    const k0 = 3;
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    for (let t = 0; t < n; t++) {
      const a = (2 * Math.PI * k0 * t) / n;
      re[t] = Math.cos(a);
      im[t] = Math.sin(a);
    }
    fft(re, im);
    for (let k = 0; k < n; k++) {
      if (k === k0) {
        expect(re[k]).toBeCloseTo(n, 9);
        expect(im[k]).toBeCloseTo(0, 9);
      } else {
        expect(Math.abs(re[k])).toBeLessThan(1e-9);
        expect(Math.abs(im[k])).toBeLessThan(1e-9);
      }
    }
  });

  it('Parseval: Σ|x[t]|² = (1/N) Σ|X[k]|²', () => {
    const n = 32;
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      re[i] = Math.sin(i * 0.9) + 0.2 * i;
      im[i] = Math.cos(i * 0.4);
    }
    let timeEnergy = 0;
    for (let i = 0; i < n; i++) timeEnergy += re[i] * re[i] + im[i] * im[i];
    const X = fftCopy(re, im);
    let freqEnergy = 0;
    for (let i = 0; i < n; i++) freqEnergy += X.re[i] * X.re[i] + X.im[i] * X.im[i];
    expect(freqEnergy / n).toBeCloseTo(timeEnergy, 8);
  });

  it('fftCopy does not mutate inputs', () => {
    const re = new Float64Array([1, 2, 3, 4]);
    const im = new Float64Array([0, 0, 0, 0]);
    fftCopy(re, im);
    expect(Array.from(re)).toEqual([1, 2, 3, 4]);
    expect(Array.from(im)).toEqual([0, 0, 0, 0]);
  });
});
