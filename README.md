# Fourier Draw

Draw a shape on your phone or laptop. Watch it decompose into a chain of rotating arrows — a Fourier-series epicycle visualization — that traces the same shape back. Installable as a PWA, all-client, no backend.

**Live:** https://hubermx.com/fourier-draw/

## Features

- Free-hand drawing on touch or mouse (high-DPI canvas).
- One-tap switch to Play mode: arclength-resample → FFT → epicycle decomposition → animated chain that traces the curve.
- Sliders for **Arrows** (1–256), **Speed** (0.1×–3×), and **Trail** length (5%–100% of one period); toggle for **Auto-close shape**.
- Save drawings to IndexedDB (with thumbnails) and reopen them.
- Share a drawing via URL hash (`#d=...`) — recipients see the same shape immediately.
- PWA: installable, offline-capable via service worker.

## Quick start

Requires Node 20+ (see `.nvmrc`).

```bash
npm install
npm run dev        # http://localhost:5173/fourier-draw/
npm test           # 57 unit tests
npm run build      # production build → dist/
npm run preview    # serve dist/ at the correct base path
```

## Architecture

Single-page vanilla-TypeScript app; no framework. Pure logic is unit-tested with Vitest; DOM wiring lives in `src/main.ts`.

| Directory | What it owns |
|---|---|
| `src/path/` | `types.ts`, arclength `resample.ts`, pointer `tracker.ts`, base64url path `codec.ts` (URL-hash sharing) |
| `src/fourier/` | Radix-2 `fft.ts`, `epicycles.ts` (decompose / eval / chain positions / top-N), `pipeline.ts` (path → epicycles) |
| `src/canvas/` | `drawingCanvas.ts` (pointer capture, redraw), `epicycleRenderer.ts` (rAF loop, fading trail), `thumbnail.ts` |
| `src/storage/` | `db.ts` — IndexedDB drawings store (save/load/list/delete) |
| `src/main.ts` | DOM wiring: top bar, layered canvases, controls, modals, share, URL-hash import |

**Render pipeline at a glance:** pointer events → `PathTracker` (points in CSS-pixel space) → on path-complete, `pathToEpicycles` resamples to 512 points and runs FFT → `EpicycleRenderer` separates the DC term (used as the chain origin = drawing centroid) from the rotating epicycles → on each frame draws the most recent `fadeFraction × period` of the trace plus the rotating chain, all in the same CSS-pixel coordinate space so the trace overlays the original strokes exactly.

## Tech stack

- **TypeScript** + **Vite 6** (vanilla, no UI framework)
- **Vitest** for unit tests (colocated `*.test.ts`)
- **vite-plugin-pwa** for manifest + service worker (Workbox-based precaching)
- **fake-indexeddb** for storage tests
- No runtime dependencies — bundle is ~20 KB JS + ~3 KB CSS gzipped.

## Deployment

Hosted on GitHub Pages from `main` via the workflow at `.github/workflows/deploy.yml`. Every push to `main`:

1. Installs deps, runs `npm test`, builds.
2. Uploads `dist/` as a Pages artifact and deploys it.

Manual redeploy: **Actions → Deploy → Run workflow** (or `gh workflow run deploy.yml`).

### First-time publish (one-time)

1. Create the empty repo on GitHub: `brandonaut/fourier-draw` (no template README/license).
2. `git remote add origin git@github.com:brandonaut/fourier-draw.git`
3. `git push -u origin main`
4. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
5. Wait for the first workflow run to go green (~2 min).
6. Visit `https://hubermx.com/fourier-draw/` and verify draw, play, save, share.
7. If the custom domain doesn't resolve, drop a `public/CNAME` file with `hubermx.com` and push again. (Custom domain set at the user level — `brandonaut.github.io` → `hubermx.com` — usually inherits to project pages without a per-repo CNAME.)

### Changing the deploy path

If you fork or rename the repo, update **two** places:

- `vite.config.ts` — `base: '/<new-repo>/'`
- `package.json` — `homepage` and `repository.url`

## Known limitations

- **PWA icons are SVG-only.** Chrome/Edge/Safari accept them, but Android Chrome's install prompt may want raster PNGs at 192/512. Generating those is a follow-up.
- **No PNG/video export.** The Share button copies a URL; rendering the canvas to a Blob and feeding it into `navigator.share` is straightforward and not yet done.
- **No automated browser tests.** All pure logic is covered by Vitest, but the canvas/DOM wiring is verified manually.
- **Long drawings** (>65,535 points) overflow the `uint16` count field in the path codec and will be rejected by `encodePath`. The pointer tracker's min-distance throttling makes this effectively impossible in practice.

## Maintenance notes

For future-me:

- `main` is the only long-lived branch — merging deploys.
- All pure logic has Vitest tests colocated as `*.test.ts`; new modules should follow suit. The DOM wiring in `src/main.ts` is intentionally untested.
- `src/main.ts` is intentionally vanilla. If it grows past ~400 lines, extract view modules before reaching for a framework.
- Dep updates: quarterly `npm outdated && npm update`. Major-version jumps for Vite or Vitest may need a small test pass.
- Tests + typecheck + build all run in CI on every push and PR; a red CI blocks deploy.

## License

[MIT](./LICENSE).
