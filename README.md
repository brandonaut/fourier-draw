# Fourier Draw

Draw a shape on your phone or laptop. Watch it decompose into a chain of rotating arrows — a Fourier-series epicycle visualization — that traces the same shape back. Installable as a PWA, all-client, no backend.

**Live:** <https://hubermx.com/fourier-draw/>

## Features

- Free-hand drawing on touch or mouse (high-DPI canvas).
- One-tap switch to Play mode: arclength-resample → FFT → epicycle decomposition → animated chain that traces the curve.
- Sliders for **Arrows** (1–256), **Speed** (0.1×–3×), and **Trail** length (5%–100% of one period); toggle for **Auto-close shape**.
- Save drawings to IndexedDB (with thumbnails) and reopen them.
- Share a drawing via URL hash (`#d=...`) — recipients see the same shape immediately.
- PWA: installable, offline-capable via service worker.

## Quick start

Requires Node 24+ (Active LTS — see `.nvmrc`).

```bash
npm install
npm run dev        # http://localhost:5173/fourier-draw/
npm test           # 57 unit tests
npm run build      # production build → dist/
npm run preview    # serve dist/ at the correct base path
```

## License

[MIT](./LICENSE).
