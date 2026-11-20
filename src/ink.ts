import { createFluid, type FluidHandle } from './fluid/engine';

type RGB = [number, number, number];

/** Ultramarine from the jackets, a deeper blue, and the tarot gilt (0..1 RGB). */
const BASE: RGB[] = [
  [0.18, 0.26, 0.84],
  [0.1, 0.14, 0.55],
  [0.18, 0.26, 0.84],
  [0.79, 0.64, 0.29],
];
/** Over a photo the ink has to read through a screen blend, so it runs hotter than on black. */
const BOOST = 3.2;
const PALETTE = BASE.map((c) => c.map((v) => v * BOOST) as RGB);

/**
 * Mounts the fluid ink on `canvas`, driven by pointer movement anywhere on `surface`
 * (so the text laid over the canvas doesn't block it). Returns a cleanup function.
 * If WebGL2 isn't available the canvas just stays empty and the photo shows alone.
 */
export function mountInk(canvas: HTMLCanvasElement, surface: HTMLElement): () => void {
  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
  });
  if (!gl) return () => {};

  const fit = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width === w && canvas.height === h) return false;
    canvas.width = w;
    canvas.height = h;
    return true;
  };
  fit();

  let fluid: FluidHandle;
  try {
    fluid = createFluid(gl, {
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      palette: PALETTE,
      background: [0, 0, 0], // black disappears under the screen blend
    });
  } catch (err) {
    console.warn('Ink:', err);
    return () => {};
  }

  const onMove = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    fluid.pointerMove((e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height);
  };
  const onLeave = () => fluid.pointerLeave();
  surface.addEventListener('pointermove', onMove);
  surface.addEventListener('pointerdown', onMove);
  surface.addEventListener('pointerleave', onLeave);

  const observer = new ResizeObserver(() => {
    if (fit()) fluid.resize();
  });
  observer.observe(canvas);

  // Don't burn GPU while the hero is scrolled away.
  let paused = false;
  const visibility = new IntersectionObserver(([entry]) => {
    paused = !entry.isIntersecting;
    canvas.style.visibility = paused ? 'hidden' : '';
  });
  visibility.observe(surface);

  return () => {
    visibility.disconnect();
    observer.disconnect();
    surface.removeEventListener('pointermove', onMove);
    surface.removeEventListener('pointerdown', onMove);
    surface.removeEventListener('pointerleave', onLeave);
    fluid.destroy();
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  };
}

/**
 * Keeps the ink's clear circle on the man in black as `object-fit: cover`
 * crops the photo differently at each screen shape.
 */
export function trackFigure(hero: HTMLElement, photo: HTMLImageElement) {
  // Where he stands in the source image, as fractions, and how wide the clearing is.
  const FIGURE = { x: 0.625, y: 0.4, r: 0.17 };
  const POS_Y = 0.3; // must match object-position in style.css

  const place = () => {
    const W = hero.clientWidth;
    const H = hero.clientHeight;
    const iw = photo.naturalWidth || 1280;
    const ih = photo.naturalHeight || 816;
    const scale = Math.max(W / iw, H / ih);
    const ox = (W - iw * scale) * 0.5;
    const oy = (H - ih * scale) * POS_Y;
    hero.style.setProperty('--fx', `${ox + FIGURE.x * iw * scale}px`);
    hero.style.setProperty('--fy', `${oy + FIGURE.y * ih * scale}px`);
    hero.style.setProperty('--fr', `${FIGURE.r * iw * scale}px`);
  };
  place();
  photo.addEventListener('load', place);
  new ResizeObserver(place).observe(hero);
}
