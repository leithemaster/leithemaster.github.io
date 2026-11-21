/*
 * Tarot cards, drawn as SVG so they stay sharp at any size and every line
 * comes from the brand tokens: night-blue stock, gilt line work.
 * Card ratio 7:12, drawn in a 280 x 480 box.
 */

const W = 280;
const H = 480;
const CX = W / 2;
const CY = H / 2;

/** Colors from the CSS tokens. SVG attributes can't read var(), so mountTarot copies them in. */
const C = { gold: '#c9a24a', goldHi: '#ecd28f', card: '#0b1240', glow: '#1d2c95' };

/** Small deterministic random, so the starfield is the same on every load. */
function rand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** A four-pointed sparkle centred on (x, y). */
function sparkle(x: number, y: number, r: number, fill = C.gold) {
  const t = r * 0.22;
  return `<path d="M${x} ${y - r} L${x + t} ${y - t} L${x + r} ${y} L${x + t} ${y + t} L${x} ${y + r} L${x - t} ${y + t} L${x - r} ${y} L${x - t} ${y - t}Z" fill="${fill}"/>`;
}

/** A compass star with `n` long points and `n` short ones between. */
function compass(x: number, y: number, outer: number, inner: number, n = 8, rot = 0) {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i * Math.PI) / n - Math.PI / 2;
    const r = i % 2 === 0 ? (i % 4 === 0 ? outer : outer * 0.62) : inner;
    pts.push(`${(x + Math.cos(a) * r).toFixed(2)},${(y + Math.sin(a) * r).toFixed(2)}`);
  }
  return `<polygon points="${pts.join(' ')}" fill="none" stroke="${C.gold}" stroke-width="0.9" stroke-linejoin="round"/>`;
}

/** Rays between two radii, alternating long and short. */
function rays(x: number, y: number, r0: number, r1: number, count: number, width = 0.6) {
  let out = '';
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const end = i % 2 === 0 ? r1 : r0 + (r1 - r0) * 0.55;
    out += `<line x1="${(x + Math.cos(a) * r0).toFixed(2)}" y1="${(y + Math.sin(a) * r0).toFixed(2)}" x2="${(x + Math.cos(a) * end).toFixed(2)}" y2="${(y + Math.sin(a) * end).toFixed(2)}" stroke="${C.gold}" stroke-width="${width}"/>`;
  }
  return out;
}

/** Crescent moon, horns up. */
function crescent(x: number, y: number, r: number) {
  return `<path d="M${x - r} ${y} A${r} ${r} 0 0 0 ${x + r} ${y} A${r * 0.82} ${r * 0.7} 0 0 1 ${x - r} ${y}Z" fill="${C.gold}"/>`;
}

/** Shared frame: double gilt rule with star medallions in the corners. */
function frame() {
  const a = 12;
  const b = 19;
  const corners = [
    [b, b],
    [W - b, b],
    [b, H - b],
    [W - b, H - b],
  ];
  return `
    <rect x="${a}" y="${a}" width="${W - a * 2}" height="${H - a * 2}" rx="6" fill="none" stroke="${C.gold}" stroke-width="1.2"/>
    <rect x="${b}" y="${b}" width="${W - b * 2}" height="${H - b * 2}" rx="2" fill="none" stroke="${C.gold}" stroke-width="0.5"/>
    ${corners
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="${C.card}" stroke="${C.gold}" stroke-width="0.6"/>${sparkle(x, y, 6)}`)
      .join('')}`;
}

function defs(id: string) {
  return `<defs>
    <radialGradient id="${id}-g" cx="50%" cy="50%" r="70%">
      <stop offset="0" stop-color="${C.glow}"/>
      <stop offset="1" stop-color="${C.card}"/>
    </radialGradient>
  </defs>`;
}

/** The back every card shares: a sunburst compass inside dotted orbits, under a field of stars. */
export function cardBack(id = 'back') {
  const r = rand(7);
  let stars = '';
  for (let i = 0; i < 46; i++) {
    const x = 34 + r() * (W - 68);
    const y = 34 + r() * (H - 68);
    if (Math.hypot(x - CX, y - CY) < 112) continue; // keep the centre clear
    stars += r() > 0.82 ? sparkle(x, y, 3 + r() * 3) : `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(0.5 + r() * 0.8).toFixed(2)}" fill="${C.goldHi}"/>`;
  }

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    ${defs(id)}
    <rect width="${W}" height="${H}" rx="10" fill="url(#${id}-g)"/>
    ${frame()}
    ${stars}
    <circle cx="${CX}" cy="${CY}" r="104" fill="none" stroke="${C.gold}" stroke-width="0.5" stroke-dasharray="0.6 4" stroke-linecap="round"/>
    <circle cx="${CX}" cy="${CY}" r="78" fill="none" stroke="${C.gold}" stroke-width="0.7"/>
    <circle cx="${CX}" cy="${CY}" r="72" fill="none" stroke="${C.gold}" stroke-width="0.4"/>
    ${rays(CX, CY, 80, 100, 48, 0.5)}
    <circle cx="${CX}" cy="${CY}" r="44" fill="none" stroke="${C.gold}" stroke-width="0.5" stroke-dasharray="2 2"/>
    ${compass(CX, CY, 66, 9, 8)}
    ${compass(CX, CY, 34, 6, 8, Math.PI / 8)}
    <circle cx="${CX}" cy="${CY}" r="6" fill="${C.goldHi}"/>
    ${crescent(CX, 64, 9)}
    ${sparkle(CX, 46, 5, C.goldHi)}
    <g transform="rotate(180 ${CX} ${H - 64})">${crescent(CX, H - 64, 9)}</g>
    ${sparkle(CX, H - 46, 5, C.goldHi)}
  </svg>`;
}

/* ---- Card faces: each position in the spread gets its own emblem. ---- */

const f = (n: number) => n.toFixed(2);

/** The lemniscate of Bernoulli (the true infinity curve), centred on (x, y), half-width a. */
function lemniscate(x: number, y: number, a: number) {
  const pts: string[] = [];
  for (let i = 0; i <= 96; i++) {
    const t = (i / 96) * Math.PI * 2;
    const d = 1 + Math.sin(t) ** 2;
    pts.push(`${f(x + (a * Math.cos(t)) / d)},${f(y + (a * Math.sin(t) * Math.cos(t)) / d)}`);
  }
  return `<polyline points="${pts.join(' ')}" fill="none" stroke="${C.goldHi}" stroke-width="1.4" stroke-linejoin="round"/>`;
}

/** A circular arc from angle a0 to a1 (degrees, clockwise, 0 = east). */
function arc(x: number, y: number, r: number, a0: number, a1: number, attrs: string) {
  const p = (deg: number) => [x + Math.cos((deg * Math.PI) / 180) * r, y + Math.sin((deg * Math.PI) / 180) * r];
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  const large = (a1 - a0 + 360) % 360 > 180 ? 1 : 0;
  return `<path d="M${f(x0)} ${f(y0)} A${r} ${r} 0 ${large} 1 ${f(x1)} ${f(y1)}" fill="none" ${attrs}/>`;
}

/** Five-petal rose. */
function rose(x: number, y: number, r: number) {
  let out = '';
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    out += `<circle cx="${f(x + Math.cos(a) * r)}" cy="${f(y + Math.sin(a) * r)}" r="${f(r * 0.85)}" fill="${C.card}" stroke="${C.gold}" stroke-width="0.8"/>`;
  }
  return out + `<circle cx="${x}" cy="${y}" r="${f(r * 0.55)}" fill="${C.goldHi}"/>`;
}

/* The four suits, each standing on a baseline at y = b, centred on x. */
const SUITS = {
  cup: (x: number, b: number) => `
    <path d="M${x - 8} ${b - 24} Q ${x - 7} ${b - 11} ${x} ${b - 11} Q ${x + 7} ${b - 11} ${x + 8} ${b - 24} Z" fill="${C.card}" stroke="${C.gold}" stroke-width="1"/>
    <line x1="${x}" y1="${b - 11}" x2="${x}" y2="${b - 3}" stroke="${C.gold}" stroke-width="1"/>
    <line x1="${x - 5}" y1="${b - 1.5}" x2="${x + 5}" y2="${b - 1.5}" stroke="${C.gold}" stroke-width="1.4" stroke-linecap="round"/>`,
  pentacle: (x: number, b: number) => {
    const cy = b - 11;
    const pts: string[] = [];
    for (let i = 0; i < 5; i++) {
      const a = (i * 2 * (Math.PI * 2)) / 5 - Math.PI / 2; // every second point draws the pentagram
      pts.push(`${f(x + Math.cos(a) * 7)},${f(cy + Math.sin(a) * 7)}`);
    }
    return `<circle cx="${x}" cy="${cy}" r="10" fill="${C.card}" stroke="${C.gold}" stroke-width="1"/>
      <polygon points="${pts.join(' ')}" fill="none" stroke="${C.gold}" stroke-width="0.8" stroke-linejoin="round"/>`;
  },
  sword: (x: number, b: number) => `
    <path d="M${x} ${b - 32} L${x + 2} ${b - 27} L${x + 2} ${b - 9} L${x - 2} ${b - 9} L${x - 2} ${b - 27} Z" fill="${C.card}" stroke="${C.gold}" stroke-width="0.9" stroke-linejoin="round"/>
    <line x1="${x - 7}" y1="${b - 9}" x2="${x + 7}" y2="${b - 9}" stroke="${C.gold}" stroke-width="1.4" stroke-linecap="round"/>
    <line x1="${x}" y1="${b - 9}" x2="${x}" y2="${b - 3}" stroke="${C.gold}" stroke-width="1.6"/>
    <circle cx="${x}" cy="${b - 2}" r="1.8" fill="${C.goldHi}"/>`,
  wand: (x: number, b: number) => `
    <line x1="${x - 2}" y1="${b - 1}" x2="${x + 2}" y2="${b - 30}" stroke="${C.gold}" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M${x + 1.5} ${b - 22} q 6 -2 7 -8 q -6 1 -7 8Z" fill="${C.gold}"/>
    <path d="M${x + 0.6} ${b - 14} q -6 -2 -7 -8 q 6 1 7 8Z" fill="${C.gold}"/>`,
};

const EMBLEMS: Record<string, () => string> = {
  /**
   * The Magician: as above, so below. The wand points to the sky and the ground, the
   * infinity sign floats over it, and the four suits of the deck sit on the table:
   * every tool at hand.
   */
  magician: () => {
    const table = CY + 34;
    return `
      ${rays(CX, CY, 88, 106, 56, 0.5)}
      <circle cx="${CX}" cy="${CY}" r="84" fill="none" stroke="${C.gold}" stroke-width="1.2"/>
      <circle cx="${CX}" cy="${CY}" r="78" fill="none" stroke="${C.gold}" stroke-width="0.5" stroke-dasharray="0.6 3.4" stroke-linecap="round"/>
      ${lemniscate(CX, CY - 48, 30)}
      <line x1="${CX}" y1="${CY - 64}" x2="${CX}" y2="${CY + 64}" stroke="${C.gold}" stroke-width="2.4" stroke-linecap="round"/>
      ${sparkle(CX, CY - 70, 9, C.goldHi)}
      ${sparkle(CX, CY + 70, 5, C.gold)}
      <line x1="${CX - 66}" y1="${table}" x2="${CX + 66}" y2="${table}" stroke="${C.gold}" stroke-width="1"/>
      <line x1="${CX - 58}" y1="${table + 5}" x2="${CX + 58}" y2="${table + 5}" stroke="${C.gold}" stroke-width="0.5"/>
      ${SUITS.cup(CX - 50, table)}
      ${SUITS.pentacle(CX - 24, table)}
      ${SUITS.sword(CX + 24, table)}
      ${SUITS.wand(CX + 50, table)}`;
  },

  /**
   * The Fool: card 0, so the emblem is a ring, the zero itself. Inside it, the sun over the
   * mountains, a white rose, a bindle at the cliff edge. The leap leaves through a gap it
   * breaks in the ring: starting everything, gladly.
   */
  fool: () => {
    const ground = CY + 40; // the clifftop
    const edge = CX + 34; // where the ground ends
    const ring = `stroke="${C.gold}" stroke-width="1.2"`;
    const inner = `stroke="${C.gold}" stroke-width="0.5" stroke-dasharray="0.6 3.4" stroke-linecap="round"`;
    return `
      ${arc(CX, CY, 84, 15, 325, ring)}
      ${arc(CX, CY, 78, 17, 323, inner)}
      ${rays(CX - 6, CY - 42, 21, 34, 28, 0.6)}
      <circle cx="${CX - 6}" cy="${CY - 42}" r="17" fill="none" stroke="${C.gold}" stroke-width="1.2"/>
      ${sparkle(CX - 6, CY - 42, 9, C.goldHi)}
      <path d="M${CX - 66} ${ground} L${CX - 50} ${CY + 12} L${CX - 38} ${CY + 26} L${CX - 18} ${CY} L${CX + 8} ${ground}" fill="none" stroke="${C.gold}" stroke-width="0.9" stroke-linejoin="round"/>
      <path d="M${CX - 42} ${CY + 21} L${CX - 18} ${CY} L${CX - 12} ${CY + 6}" fill="none" stroke="${C.gold}" stroke-width="0.5"/>
      <path d="M${CX - 70} ${ground} L${edge} ${ground} L${edge + 4} ${ground + 8} L${edge - 2} ${ground + 16} L${edge + 6} ${ground + 26}" fill="none" stroke="${C.gold}" stroke-width="1.4" stroke-linejoin="round"/>
      <path d="M${CX - 40} ${ground + 27} L${CX - 18} ${ground + 27}" fill="none" stroke="${C.gold}" stroke-width="0.8" stroke-linecap="round"/>
      <path d="M${CX - 29} ${ground + 27} Q ${CX - 30} ${ground + 20} ${CX - 28} ${ground + 12}" fill="none" stroke="${C.gold}" stroke-width="0.9"/>
      <path d="M${CX - 29.4} ${ground + 21} q -6 -1 -7 -6 q 5 0 7 6Z" fill="${C.gold}"/>
      ${rose(CX - 28, ground + 9, 4.2)}
      <line x1="${CX + 10}" y1="${ground}" x2="${CX + 29}" y2="${CY + 8}" stroke="${C.gold}" stroke-width="2.2" stroke-linecap="round"/>
      <circle cx="${CX + 33}" cy="${CY + 2}" r="8" fill="${C.card}" stroke="${C.gold}" stroke-width="1.2"/>
      <path d="M${CX + 28} ${CY - 5} L${CX + 33} ${CY - 10} L${CX + 38} ${CY - 5}" fill="none" stroke="${C.gold}" stroke-width="1"/>
      <path d="M${edge + 2} ${ground - 4} Q ${CX + 70} ${CY - 30} ${CX + 106} ${CY - 6}" fill="none" stroke="${C.goldHi}" stroke-width="1" stroke-dasharray="1.5 3.5" stroke-linecap="round"/>
      ${sparkle(CX + 110, CY - 4, 7, C.goldHi)}`;
  },

  /** The Star: one great star and seven small ones, what's still ahead. */
  star: () => {
    let small = '';
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 - Math.PI / 2;
      small += sparkle(CX + Math.cos(a) * 82, CY + Math.sin(a) * 82, 7);
    }
    return `
      <circle cx="${CX}" cy="${CY}" r="96" fill="none" stroke="${C.gold}" stroke-width="0.5" stroke-dasharray="0.6 4" stroke-linecap="round"/>
      ${rays(CX, CY, 20, 64, 64, 0.4)}
      ${compass(CX, CY, 60, 10, 8)}
      ${sparkle(CX, CY, 22, C.goldHi)}
      ${small}`;
  },
};

export type CardFace = {
  numeral: string;
  name: string;
  position: string;
  emblem: keyof typeof EMBLEMS;
};

export function cardFace(card: CardFace, id: string) {
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    ${defs(id)}
    <rect width="${W}" height="${H}" rx="10" fill="url(#${id}-g)"/>
    ${frame()}
    <text x="${CX}" y="62" text-anchor="middle" class="tarot__numeral" fill="${C.goldHi}">${card.numeral}</text>
    <line x1="${CX - 40}" y1="76" x2="${CX + 40}" y2="76" stroke="${C.gold}" stroke-width="0.5"/>
    ${EMBLEMS[card.emblem]()}
    <line x1="34" y1="${H - 92}" x2="${W - 34}" y2="${H - 92}" stroke="${C.gold}" stroke-width="0.5"/>
    <text x="${CX}" y="${H - 62}" text-anchor="middle" class="tarot__name" fill="${C.goldHi}">${card.name}</text>
    <text x="${CX}" y="${H - 42}" text-anchor="middle" class="tarot__position" fill="${C.gold}">${card.position}</text>
  </svg>`;
}

/**
 * Fills every `[data-tarot]` button with a back and its face, and turns it on click.
 * The button's own aria-label and aria-pressed carry the meaning; the SVGs are decoration.
 */
export function mountTarot(root: ParentNode, cards: Record<string, CardFace>) {
  const css = getComputedStyle(document.documentElement);
  const token = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  C.gold = token('--c-gold', C.gold);
  C.goldHi = token('--c-gold-hi', C.goldHi);
  C.card = token('--c-card', C.card);
  C.glow = token('--c-card-glow', C.glow);

  root.querySelectorAll<HTMLButtonElement>('[data-tarot]').forEach((btn, i) => {
    const card = cards[btn.dataset.tarot!];
    if (!card) return;
    btn.innerHTML = `<span class="tarot__inner">
      <span class="tarot__side tarot__side--back">${cardBack(`b${i}`)}</span>
      <span class="tarot__side tarot__side--face">${cardFace(card, `f${i}`)}</span>
    </span>`;
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', () => {
      const turned = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', String(turned));
    });
  });
}
