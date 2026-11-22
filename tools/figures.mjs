// Draws the case-study figures on work.html and writes them into the page
// between <!--fig:name--> ... <!--/fig:name--> markers.
// Run after changing a drawing: npm run figures
//
// The figures are drawn like the deck: gilt line work on card-blue stock, plates framed with
// the double gilt rule and corner stars, titles in spaced Cormorant capitals, labels in DM Mono.
// Every part carries data-part="problem|design|build|outcome" so the stage buttons can dim the rest.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Tokens from src/style.css. SVG attributes can't read var(), so they are copied here.
const C = {
  card: '#0b1240',  // --c-card
  glow: '#1d2c95',  // --c-card-glow
  deep: '#121a5a',  // between the two: a mockup's surface
  gold: '#c9a24a',  // --c-gold
  hi: '#ecd28f',    // --c-gold-hi
  bone: '#f1ece2',  // --c-text: redlines, the one non-gilt mark
  muted: '#a9a6b8', // --c-muted
  ultra: '#2f43d6', // --c-accent: fills only
};
const MONO = "'DM Mono', ui-monospace, monospace";
const SERIF = "'Cormorant Garamond', 'Times New Roman', serif";
const f = (n) => Math.round(n * 10) / 10;

// ---------------------------------------------------------------- the deck's vocabulary
/** A four-pointed sparkle centred on (x, y), the same shape as the cards. */
function sparkle(x, y, r, fill = C.gold) {
  const t = r * 0.22;
  return `<path d="M${f(x)} ${f(y - r)} L${f(x + t)} ${f(y - t)} L${f(x + r)} ${f(y)} L${f(x + t)} ${f(y + t)} L${f(x)} ${f(y + r)} L${f(x - t)} ${f(y + t)} L${f(x - r)} ${f(y)} L${f(x - t)} ${f(y - t)}Z" fill="${fill}" stroke="none"/>`;
}

/** A plate: the cards' double gilt rule with a star medallion in each corner. */
function plate(x, y, w, h, fill = C.card) {
  const b = 10; // inner rule inset: leaves the corner stars clear of the outer edge
  const corners = [[x + b, y + b], [x + w - b, y + b], [x + b, y + h - b], [x + w - b, y + h - b]];
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${fill}" stroke="${C.gold}" stroke-width="1.2"/>` +
    `<rect x="${x + b}" y="${y + b}" width="${w - b * 2}" height="${h - b * 2}" rx="2" fill="none" stroke="${C.gold}" stroke-width="0.5"/>` +
    corners.map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="4.5" fill="${C.card}" stroke="${C.gold}" stroke-width="0.6"/>${sparkle(cx, cy, 3)}`).join('');
}

/** Mono label. */
const label = (x, y, text, { size = 12, fill = C.gold, anchor = 'start' } = {}) =>
  `<text x="${f(x)}" y="${f(y)}" font-family="${MONO}" font-size="${size}" letter-spacing="1.4" text-anchor="${anchor}" fill="${fill}" stroke="none">${text}</text>`;

/** Card title: Cormorant, spaced capitals, gilt highlight. */
const title = (x, y, text, { size = 18, anchor = 'middle' } = {}) =>
  `<text x="${f(x)}" y="${f(y)}" font-family="${SERIF}" font-size="${size}" font-weight="600" letter-spacing="2.6" text-anchor="${anchor}" fill="${C.hi}" stroke="none">${text}</text>`;

/** A dotted gilt path, the "leap" line from the Fool. */
const DOT_STEP = 6.6;
const dot = (x, y, width) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(width * 0.55)}" fill="${C.gold}" stroke="none"/>`;

/**
 * Dots along a polyline written as "M x y" followed by L, H and V steps. Each segment gets a whole
 * number of equal steps, so a dot lands exactly on both ends: the gap before a star or an arrow
 * is the same on either side.
 */
function dotted(d, width = 1.4) {
  const pts = [];
  let x = 0, y = 0;
  for (const [, cmd, args] of d.matchAll(/([MLHV])([^MLHV]*)/g)) {
    const n = args.trim().split(/[\s,]+/).map(Number);
    if (cmd === 'M' || cmd === 'L') [x, y] = n;
    else if (cmd === 'H') x = n[0];
    else y = n[0];
    pts.push([x, y]);
  }
  let out = dot(...pts[0], width);
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    const steps = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / DOT_STEP));
    for (let k = 1; k <= steps; k++) out += dot(x0 + ((x1 - x0) * k) / steps, y0 + ((y1 - y0) * k) / steps, width);
  }
  return `<g>${out}</g>`;
}

/** Dots along a clockwise arc from angle a0 to a1 (radians), a dot exactly on each end. */
function dottedArc(cx, cy, r, a0, a1, width = 1.2) {
  const steps = Math.max(1, Math.round(((a1 - a0) * r) / DOT_STEP));
  let out = '';
  for (let k = 0; k <= steps; k++) {
    const t = a0 + ((a1 - a0) * k) / steps;
    out += dot(cx + r * Math.cos(t), cy + r * Math.sin(t), width);
  }
  return `<g>${out}</g>`;
}

/** A small chevron pointing along (dx, dy). */
function chevron(x, y, dx, dy, s = 6, stroke = C.gold) {
  const L = Math.hypot(dx, dy);
  const ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
  return `<polyline points="${f(x - ux * s + nx * s)},${f(y - uy * s + ny * s)} ${f(x)},${f(y)} ${f(x - ux * s - nx * s)},${f(y - uy * s - ny * s)}" fill="none" stroke="${stroke}" stroke-width="1.2"/>`;
}

/**
 * A dotted line ending in an arrowhead at (x2, y2). The dots stop short of the head, so the
 * head never sits on top of a dot.
 */
function arrow(x1, y1, x2, y2, s = 7, width = 1.4) {
  const L = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / L, uy = (y2 - y1) / L, e = s + 7;
  return dotted(`M${f(x1)} ${f(y1)} L${f(x2 - ux * e)} ${f(y2 - uy * e)}`, width) + chevron(x2, y2, ux, uy, s);
}

/**
 * A dotted orbit, clockwise, with an arrowhead at each of `arrows` (degrees) and a star node of
 * radius `nodeR` at each of `nodes`. The dots break around every head and every node, so
 * nothing sits on top of a dot; each head is centred in its gap.
 */
function orbit(cx, cy, r, arrows, nodes = [], nodeR = 16, s = 7, width = 1.2) {
  const rad = (d) => (d * Math.PI) / 180;
  const stops = [
    ...arrows.map((d) => ({ a: rad(d), half: (s / 2 + 8) / r })),
    ...nodes.map((d) => ({ a: rad(d), half: (nodeR + 7) / r })),
  ].sort((p, q) => p.a - q.a);
  let out = '';
  stops.forEach((p, i) => {
    const q = i < stops.length - 1 ? stops[i + 1] : { ...stops[0], a: stops[0].a + Math.PI * 2 };
    const a0 = p.a + p.half, a1 = q.a - q.half;
    if (a1 > a0) out += dottedArc(cx, cy, r, a0, a1, width);
  });
  arrows.forEach((d) => {
    const tip = rad(d) + s / 2 / r;
    out += chevron(cx + r * Math.cos(tip), cy + r * Math.sin(tip), -Math.sin(tip), Math.cos(tip), s);
  });
  return out;
}

/** A compass star, as on the card backs. */
function compass(x, y, outer, inner, n = 8) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (i * Math.PI) / n - Math.PI / 2;
    const r = i % 2 === 0 ? (i % 4 === 0 ? outer : outer * 0.62) : inner;
    pts.push(`${f(x + Math.cos(a) * r)},${f(y + Math.sin(a) * r)}`);
  }
  return `<polygon points="${pts.join(' ')}" fill="none" stroke="${C.gold}" stroke-width="0.9"/>`;
}

const wrap = (vb, aria, body) =>
  `<svg class="drawing" viewBox="${vb}" role="img" aria-label="${aria}" preserveAspectRatio="xMidYMid meet">` +
  `<g fill="none" stroke="${C.gold}" stroke-width="1" stroke-linejoin="round" stroke-linecap="round">${body}</g></svg>`;

// ---------------------------------------------------------------- 1: Marines support portal
/** One screen of the portal at a stage: 'wire', 'mock' or 'final'. 292 x 196. */
function screen(x, y, v) {
  const w = 292, h = 196;
  const wire = v === 'wire', final = v === 'final';
  const thin = wire ? 'stroke-width="0.8" stroke-dasharray="3 3"' : '';
  const bold = wire ? 1 : 2.4;
  let g = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${wire ? 'none' : final ? C.glow : C.deep}" stroke-width="1.2"/>`;
  g += `<line x1="${x}" y1="${y + 16}" x2="${x + w}" y2="${y + 16}"/>`;
  [0, 1, 2].forEach((i) => { g += `<circle cx="${x + 9 + i * 8}" cy="${y + 8}" r="2" fill="${final ? C.hi : 'none'}"/>`; });

  // navigation
  const nw = 62, ny = y + 16;
  g += `<rect x="${x}" y="${ny}" width="${nw}" height="${h - 16}" fill="${wire ? 'none' : C.card}" ${thin}/>`;
  for (let i = 0; i < 5; i++) {
    const ly = ny + 22 + i * 18;
    const picked = final && i === 1;
    if (picked) g += `<rect x="${x + 6}" y="${ly - 7}" width="${nw - 12}" height="14" rx="2" fill="${C.hi}" stroke="none"/>`;
    g += `<line x1="${x + 12}" y1="${ly}" x2="${x + nw - 14 - (i % 2) * 10}" y2="${ly}" stroke="${picked ? C.card : C.gold}" stroke-width="${bold}"/>`;
  }

  // content: heading, primary button, table
  const cx = x + 76, cw = 120;
  g += `<line x1="${cx}" y1="${y + 32}" x2="${cx + 70}" y2="${y + 32}" stroke-width="${wire ? 1 : 3}" ${wire ? '' : `stroke="${C.hi}"`}/>`;
  const bx = cx + cw - 34, by = y + 25;
  if (wire) g += `<rect x="${bx}" y="${by}" width="34" height="14" ${thin}/><line x1="${bx}" y1="${by}" x2="${bx + 34}" y2="${by + 14}" stroke-width="0.8"/><line x1="${bx + 34}" y1="${by}" x2="${bx}" y2="${by + 14}" stroke-width="0.8"/>`;
  else g += `<rect x="${bx}" y="${by}" width="34" height="14" rx="7" fill="${final ? C.hi : 'none'}"/>`;
  const ty = y + 50;
  for (let i = 0; i < 7; i++) {
    const ry = ty + i * 20;
    if (wire) {
      g += `<line x1="${cx}" y1="${ry + 16}" x2="${cx + cw}" y2="${ry + 16}" stroke-width="0.6" stroke-dasharray="2 3"/>`;
      g += `<line x1="${cx + 4}" y1="${ry + 8}" x2="${cx + 40 + (i * 13) % 30}" y2="${ry + 8}" stroke-width="0.8"/>`;
      continue;
    }
    if (i === 0) { g += `<rect x="${cx}" y="${ry}" width="${cw}" height="16" fill="${C.card}" stroke="none"/>`; }
    g += `<line x1="${cx + 5}" y1="${ry + 8}" x2="${cx + 40 + (i * 13) % 30}" y2="${ry + 8}" stroke-width="2"/>`;
    if (i > 0) {
      const lit = final && i % 3 === 1;
      g += `<rect x="${cx + cw - 26}" y="${ry + 3}" width="22" height="10" rx="5" fill="${lit ? C.hi : final ? C.ultra : 'none'}" stroke="${lit ? C.hi : C.gold}" stroke-width="0.8"/>`;
    }
  }
  if (final) g += `<rect x="${cx - 3}" y="${ty + 40 - 3}" width="${cw + 6}" height="22" rx="2" stroke="${C.hi}" stroke-width="1.6" stroke-dasharray="4 3"/>`;

  // detail panel
  const px = x + w - 88, pw = 76, py = y + 28, ph = h - 40;
  if (wire) {
    g += `<rect x="${px}" y="${py}" width="${pw}" height="${ph}" ${thin}/>`;
    g += `<rect x="${px + 8}" y="${py + 8}" width="${pw - 16}" height="40" stroke-width="0.8"/><line x1="${px + 8}" y1="${py + 8}" x2="${px + pw - 8}" y2="${py + 48}" stroke-width="0.6"/><line x1="${px + pw - 8}" y1="${py + 8}" x2="${px + 8}" y2="${py + 48}" stroke-width="0.6"/>`;
    [62, 84, 106].forEach((o) => { g += `<rect x="${px + 8}" y="${py + o}" width="${pw - 16}" height="12" ${thin}/>`; });
  } else {
    g += `<rect x="${px}" y="${py}" width="${pw}" height="${ph}" fill="${C.card}"/>`;
    g += `<line x1="${px + 8}" y1="${py + 14}" x2="${px + 48}" y2="${py + 14}" stroke-width="2.4" stroke="${C.hi}"/>`;
    [28, 54, 80, 106].forEach((o) => { g += `<rect x="${px + 8}" y="${py + o}" width="${pw - 16}" height="16" rx="2" fill="${final ? C.deep : 'none'}" stroke-width="0.8"/>`; });
    g += `<rect x="${px + 8}" y="${py + ph - 22}" width="${pw - 16}" height="14" rx="7" fill="${final ? C.hi : 'none'}"/>`;
  }
  return g;
}

/** A stage plate: the screen, a rule, a numbered title and a line of notes. 340 x 320. */
function stagePlate(x, y, v, numeral, name, note) {
  const W = 340, H = 320;
  return plate(x, y, W, H, v === 'final' ? '#0e1650' : C.card) +
    screen(x + 24, y + 26, v) +
    `<line x1="${x + 60}" y1="${y + 244}" x2="${x + W - 60}" y2="${y + 244}" stroke-width="0.5"/>` +
    title(x + W / 2, y + 274, `${numeral} · ${name}`) +
    label(x + W / 2, y + 296, note, { size: 11, fill: C.muted, anchor: 'middle' });
}

function marines() {
  const top = 130, xs = [40, 430, 820];
  let g = '';

  // problem: a request's life, drawn as the Fool's dotted leap between three stars
  const sy = 62, nodes = [[60, 'RAISED', 'start'], [600, 'IN PROGRESS', 'middle'], [1140, 'RESOLVED', 'end']];
  let pr = dotted(`M79 ${sy} L320 ${sy}`) + chevron(333, sy, 1, 0) + dotted(`M340 ${sy} L581 ${sy}`) + dotted(`M619 ${sy} L860 ${sy}`) + chevron(873, sy, 1, 0) + dotted(`M880 ${sy} L1121 ${sy}`);
  nodes.forEach(([nx, t, a], i) => {
    pr += `<circle cx="${nx}" cy="${sy}" r="12" fill="${C.card}" stroke-width="1"/>${sparkle(nx, sy, 8, i === 2 ? C.hi : C.gold)}`;
    pr += label(nx + (a === 'start' ? -12 : a === 'end' ? 12 : 0), sy - 24, t, { anchor: a, fill: C.hi });
  });
  pr += label(600, sy + 34, 'A SUPPORT REQUEST, FROM RAISED TO RESOLVED', { size: 11, fill: C.muted, anchor: 'middle' });
  g += `<g data-part="problem">${pr}</g>`;

  g += `<g data-part="design">${stagePlate(xs[0], top, 'wire', 'I', 'WIREFRAME', 'USER JOURNEYS · STAKEHOLDER TESTS')}</g>`;

  // build: the mockup with its redlines, in bone so they read as notes, not interface
  const mx = xs[1] + 24, my = top + 26;
  const red = `<g stroke="${C.bone}" stroke-width="0.9">` +
    `<line x1="${mx}" y1="${my + 204}" x2="${mx + 62}" y2="${my + 204}"/><line x1="${mx}" y1="${my + 199}" x2="${mx}" y2="${my + 209}"/><line x1="${mx + 62}" y1="${my + 199}" x2="${mx + 62}" y2="${my + 209}"/>` +
    `<text x="${mx + 31}" y="${my + 217}" font-family="${MONO}" font-size="10" text-anchor="middle" fill="${C.bone}" stroke="none">62</text>` +
    `<rect x="${mx + 72}" y="${my + 46}" width="128" height="146" fill="none" stroke-dasharray="4 3"/>` +
    `<line x1="${mx + 70}" y1="${my + 150}" x2="${mx + 70}" y2="${my + 170}"/><line x1="${mx + 66}" y1="${my + 150}" x2="${mx + 74}" y2="${my + 150}"/><line x1="${mx + 66}" y1="${my + 170}" x2="${mx + 74}" y2="${my + 170}"/>` +
    `<text x="${mx + 60}" y="${my + 164}" font-family="${MONO}" font-size="10" text-anchor="end" fill="${C.bone}" stroke="none">20</text></g>`;
  g += `<g data-part="build">${stagePlate(xs[1], top, 'mock', 'II', 'MOCKUP', 'REDLINES FOR ANGULAR · HTML/CSS')}${red}</g>`;

  g += `<g data-part="outcome">${stagePlate(xs[2], top, 'final', 'III', 'SHIPPED', 'SECTION 508 · SCREEN READER · CONTROLLER')}${sparkle(xs[2] + 340 - 26, top + 236, 7, C.hi)}</g>`;

  // the spread reads left to right
  [xs[0] + 340 + 25, xs[1] + 340 + 25].forEach((ax) => { g += chevron(ax + 5, top + 160, 1, 0, 7); });

  return wrap('0 0 1200 470', 'Three framed plates side by side, drawn in gold line on deep blue like tarot cards: a wireframe, a mockup marked up with redline measurements for developers, and the shipped interface with a visible focus ring and status labels. Above them, a dotted line with three stars traces a support request from raised to in progress to resolved.', g);
}

// ---------------------------------------------------------------- 2: Navy training and product portal
/** Tiny layout inside an option card: three variants of where products and training go. */
function optionLayout(x, y, kind) {
  let g = `<rect x="${x}" y="${y}" width="74" height="12" stroke-width="0.8"/>`;
  if (kind === 'A') {
    [[0, 0], [38, 0], [0, 34], [38, 34]].forEach(([dx, dy]) => { g += `<rect x="${x + dx}" y="${y + 20 + dy}" width="36" height="30" stroke-width="0.8"/>`; });
    g += `<line x1="${x}" y1="${y + 96}" x2="${x + 74}" y2="${y + 96}" stroke-width="0.8" stroke-dasharray="2 3"/>`;
  } else if (kind === 'B') {
    g += `<rect x="${x}" y="${y + 20}" width="44" height="78" stroke-width="0.8"/>`;
    [0, 1].forEach((i) => { g += `<rect x="${x + 5}" y="${y + 26 + i * 36}" width="34" height="30" fill="${C.ultra}" stroke="none"/>`; });
    [0, 1, 2, 3].forEach((i) => { g += `<line x1="${x + 50}" y1="${y + 26 + i * 20}" x2="${x + 74}" y2="${y + 26 + i * 20}" stroke-width="1.6"/><line x1="${x + 50}" y1="${y + 33 + i * 20}" x2="${x + 50 + 6 + i * 5}" y2="${y + 33 + i * 20}" stroke="${C.hi}" stroke-width="2"/>`; });
  } else {
    [0, 1, 2, 3, 4].forEach((i) => { g += `<rect x="${x}" y="${y + 20 + i * 16}" width="74" height="12" stroke-width="0.8"/>`; });
  }
  return g;
}

function optionCard(cx, by, angle, kind, chosen) {
  const w = 110, h = 170, x = cx - w / 2, y = by - h;
  const body = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="${chosen ? C.glow : C.card}" stroke-width="${chosen ? 1.4 : 1}"/>` +
    `<rect x="${x + 5}" y="${y + 5}" width="${w - 10}" height="${h - 10}" rx="2" stroke-width="0.4"/>` +
    title(cx, y + 26, kind, { size: 17 }) +
    optionLayout(x + 18, y + 40, kind) +
    (chosen ? sparkle(cx, y - 16, 9, C.hi) : '');
  return `<g transform="rotate(${angle} ${cx} ${by + 60})">${body}</g>`;
}

/** Traffic-control glyphs for the product tiles. */
const glyph = {
  light: (x, y) => `<rect x="${x - 9}" y="${y - 22}" width="18" height="44" rx="5"/>${[-13, 0, 13].map((d, i) => `<circle cx="${x}" cy="${y + d}" r="4.2" fill="${i === 2 ? C.hi : 'none'}"/>`).join('')}`,
  gate: (x, y) => `<line x1="${x - 26}" y1="${y + 20}" x2="${x - 26}" y2="${y - 14}" stroke-width="2"/><rect x="${x - 26}" y="${y - 16}" width="56" height="7" fill="${C.card}"/>${[0, 1, 2].map((i) => `<rect x="${x - 18 + i * 16}" y="${y - 16}" width="8" height="7" fill="${C.hi}" stroke="none"/>`).join('')}<line x1="${x - 34}" y1="${y + 20}" x2="${x - 18}" y2="${y + 20}"/>`,
  cone: (x, y) => `<polygon points="${x},${y - 20} ${x + 13},${y + 16} ${x - 13},${y + 16}"/><line x1="${x - 5}" y1="${y - 6}" x2="${x + 5}" y2="${y - 6}" stroke="${C.hi}" stroke-width="3"/><line x1="${x - 9}" y1="${y + 5}" x2="${x + 9}" y2="${y + 5}" stroke="${C.hi}" stroke-width="3"/><line x1="${x - 20}" y1="${y + 16}" x2="${x + 20}" y2="${y + 16}" stroke-width="1.6"/>`,
};

function navy() {
  let g = '';

  // problem: products and training, scattered with no home
  let pr = '';
  [[70, 150, -12], [118, 132, 8], [96, 190, 4]].forEach(([x, y, a]) => { pr += `<rect x="${x}" y="${y}" width="40" height="32" rx="2" transform="rotate(${a} ${x + 20} ${y + 16})" fill="${C.card}"/>`; });
  pr += label(60, 120, 'PRODUCTS', { fill: C.hi });
  [[80, 300, 10], [130, 282, -8], [108, 330, -3]].forEach(([x, y, a]) => {
    pr += `<g transform="rotate(${a} ${x + 18} ${y + 22})"><path d="M${x} ${y} h28 l8 8 v36 h-36Z" fill="${C.card}"/>${[14, 22, 30].map((o) => `<line x1="${x + 6}" y1="${y + o}" x2="${x + 28}" y2="${y + o}" stroke-width="0.8"/>`).join('')}</g>`;
  });
  pr += label(60, 270, 'TRAINING', { fill: C.hi });
  pr += label(60, 412, 'NO SINGLE PLACE FOR EITHER', { size: 11, fill: C.muted });
  g += `<g data-part="problem">${pr}</g>`;

  // design: options fanned like a hand of cards; the chosen one lifts and catches the light
  let de = optionCard(418, 330, -10, 'A', false) + optionCard(562, 330, 10, 'C', false) + optionCard(490, 312, 0, 'B', true);
  de += label(490, 412, 'SEVERAL OPTIONS, ONE PICKED', { size: 11, fill: C.muted, anchor: 'middle' });
  g += `<g data-part="design">${de}</g>`;

  // build: the portal's frame and sections
  const px = 690, py = 40, pw = 470, ph = 350;
  let bu = plate(px, py, pw, ph);
  bu += `<rect x="${px + 24}" y="${py + 24}" width="${pw - 48}" height="30"/>${sparkle(px + 44, py + 39, 7, C.hi)}`;
  [0, 1, 2].forEach((i) => { bu += `<line x1="${px + pw - 150 + i * 40}" y1="${py + 39}" x2="${px + pw - 122 + i * 40}" y2="${py + 39}" stroke-width="1.6"/>`; });
  bu += `<rect x="${px + 24}" y="${py + 66}" width="246" height="258" stroke-width="0.8"/>`;
  bu += `<rect x="${px + 282}" y="${py + 66}" width="164" height="258" stroke-width="0.8"/>`;
  bu += label(px + 36, py + 88, 'PRODUCTS', { size: 11 }) + label(px + 294, py + 88, 'TRAINING', { size: 11 });
  g += `<g data-part="build">${bu}</g>`;

  // outcome: the portal filled in
  let ou = '';
  const tiles = [[px + 36, py + 100, 108, 100, 'light'], [px + 152, py + 100, 108, 100, 'gate'], [px + 36, py + 210, 224, 102, 'cone']];
  tiles.forEach(([x, y, w, h, k]) => { ou += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${C.glow}" stroke-width="0.8"/>${glyph[k](x + w / 2, y + h / 2 - 4)}`; });
  [0.9, 0.6, 0.35, 0].forEach((p, i) => {
    const y = py + 112 + i * 52;
    const done = p >= 0.9;
    ou += `<circle cx="${px + 302}" cy="${y}" r="7" fill="${done ? C.hi : 'none'}"/>`;
    ou += `<line x1="${px + 318}" y1="${y - 3}" x2="${px + 400 - i * 8}" y2="${y - 3}" stroke-width="2"/>`;
    ou += `<rect x="${px + 318}" y="${y + 8}" width="112" height="5" rx="2.5" stroke-width="0.6"/>`;
    if (p > 0) ou += `<rect x="${px + 318}" y="${y + 8}" width="${f(112 * p)}" height="5" rx="2.5" fill="${C.hi}" stroke="none"/>`;
  });
  ou += title(px + pw / 2, py + ph + 34, 'THE PORTAL') + label(px + pw / 2, py + ph + 54, 'PRODUCTS AND TRAINING, ONE PLACE', { size: 11, fill: C.muted, anchor: 'middle' });
  g += `<g data-part="outcome">${ou}</g>`;

  // the reading order: scattered → options → portal
  g += arrow(196, 230, 318, 230);
  g += arrow(652, 230, 682, 230);

  return wrap('0 0 1200 470', 'Three scenes left to right, in gold line on deep blue. First, product boxes and training sheets scattered with no home. Then three design options fanned like a hand of cards, labelled A, B and C, with option B lifted and starred as the one picked. Last, a framed portal with a product section of traffic-control tiles (a traffic light, a barrier gate, a cone) beside a training list with progress bars.', g);
}

// ---------------------------------------------------------------- 3: NexGen at USCIS
function cylinder(cx, cy, rx, ry, h, fill = C.card) {
  return `<path d="M${cx - rx} ${cy - h} L${cx - rx} ${cy} A${rx} ${ry} 0 0 0 ${cx + rx} ${cy} L${cx + rx} ${cy - h}" fill="${fill}"/>` +
    `<ellipse cx="${cx}" cy="${cy - h}" rx="${rx}" ry="${ry}" fill="${C.deep}"/>`;
}

function nexgen() {
  const x = 70, w = 570, h = 112, ys = [62, 204, 346];
  let g = '';

  // problem: one application, every layer
  g += `<g data-part="problem"><rect x="${x - 24}" y="${ys[0] - 26}" width="${w + 48}" height="${ys[2] + h - ys[0] + 52}" rx="10" stroke-width="0.9" stroke-dasharray="6 6"/>` +
    label(x - 24, ys[0] - 38, 'ONE APPLICATION · EVERY LAYER', { size: 11, fill: C.muted }) + `</g>`;

  const zone = x + 262;
  // outcome: the React layer on top
  let fe = plate(x, ys[0], w, h, '#0e1650');
  fe += title(x + 28, ys[0] + 50, 'FRONTEND', { anchor: 'start' }) + label(x + 28, ys[0] + 74, 'REACT · COMPONENTS · HOOKS', { size: 11, fill: C.muted });
  fe += `<rect x="${zone}" y="${ys[0] + 24}" width="280" height="14" stroke-width="0.9"/>`;
  [0, 1, 2].forEach((i) => { fe += `<rect x="${zone + i * 96}" y="${ys[0] + 46}" width="88" height="42" rx="3" fill="${i === 1 ? C.glow : 'none'}" stroke-width="0.9"/>`; });
  fe += sparkle(zone + 96 + 44, ys[0] + 67, 9, C.hi);
  fe += `<path d="M${zone + 22} ${ys[0] + 60} a8 8 0 1 1 -2 9" stroke-width="1.2"/>${chevron(zone + 20, ys[0] + 69, -0.3, 1, 4)}`;
  fe += `<line x1="${zone + 210}" y1="${ys[0] + 60}" x2="${zone + 260}" y2="${ys[0] + 60}" stroke-width="2"/><line x1="${zone + 210}" y1="${ys[0] + 72}" x2="${zone + 244}" y2="${ys[0] + 72}" stroke-width="2"/>`;
  g += `<g data-part="outcome">${fe}</g>`;

  // build: Spring Boot services and PostgreSQL underneath
  let be = plate(x, ys[1], w, h);
  be += title(x + 28, ys[1] + 50, 'BACKEND', { anchor: 'start' }) + label(x + 28, ys[1] + 74, 'SPRING BOOT · APIS · LOGIC', { size: 11, fill: C.muted });
  [0, 1, 2].forEach((i) => {
    const bx = zone + i * 100;
    be += `<rect x="${bx}" y="${ys[1] + 34}" width="76" height="44" rx="4" fill="${C.deep}" stroke-width="0.9"/>`;
    be += `<line x1="${bx + 12}" y1="${ys[1] + 50}" x2="${bx + 54}" y2="${ys[1] + 50}" stroke-width="1.6"/><line x1="${bx + 12}" y1="${ys[1] + 62}" x2="${bx + 40}" y2="${ys[1] + 62}" stroke-width="1.6"/>`;
    if (i < 2) be += `<line x1="${bx + 80}" y1="${ys[1] + 56}" x2="${bx + 94}" y2="${ys[1] + 56}"/>${chevron(bx + 96, ys[1] + 56, 1, 0, 4)}`;
  });
  let db = plate(x, ys[2], w, h);
  db += title(x + 28, ys[2] + 50, 'DATA', { anchor: 'start' }) + label(x + 28, ys[2] + 74, 'POSTGRESQL · QUERIES', { size: 11, fill: C.muted });
  [0, 1, 2].forEach((i) => { db += cylinder(zone + 38 + i * 100, ys[2] + 84, 30, 9, 44); });
  g += `<g data-part="build">${be}${db}</g>`;

  // the layers are joined: a request runs down and back up
  [zone + 38, zone + 238].forEach((cx) => {
    [ys[0] + h, ys[1] + h].forEach((y0) => { g += `<line x1="${cx}" y1="${y0 + 4}" x2="${cx}" y2="${y0 + 8}" stroke-width="0.8"/><line x1="${cx}" y1="${y0 + 22}" x2="${cx}" y2="${y0 + 26}" stroke-width="0.8"/>` + sparkle(cx, y0 + 15, 4, C.hi); });
  });

  // design: the collaboration loop, drawn like the Star's orbit
  const cx = 950, cy = 262, rx = 170, ry = 170;
  let pl = orbit(cx, cy, rx, [-30, 90, 210], [-90, 30, 150], 16);
  pl += `<circle cx="${cx}" cy="${cy}" r="${rx - 28}" stroke-width="0.4"/>`;
  pl += compass(cx, cy, 52, 9) + sparkle(cx, cy, 16, C.hi);
  pl += label(cx, cy + 82, 'EACH SPRINT', { size: 11, fill: C.muted, anchor: 'middle' });
  const nodes = [[-90, 'DESIGN REVIEW'], [30, 'UX FEEDBACK'], [150, 'SPRINT PLANNING']];
  nodes.forEach(([deg, name], i) => {
    const t = (deg * Math.PI) / 180, nx = cx + rx * Math.cos(t), ny = cy + ry * Math.sin(t);
    pl += `<circle cx="${f(nx)}" cy="${f(ny)}" r="16" fill="${C.card}"/>${sparkle(nx, ny, 10, i === 0 ? C.hi : C.gold)}`;
    // lower labels sit below and outward of their star, outside the orbit, so no line crosses them
    if (i === 0) pl += label(nx, ny - 28, name, { anchor: 'middle', fill: C.hi });
    else pl += label(i === 1 ? nx - 6 : nx + 6, ny + 40, name, { anchor: i === 1 ? 'start' : 'end', fill: C.hi });
  });
  g += `<g data-part="design">${pl}</g>`;

  // design feeds the build
  g += arrow(cx - rx - 26, cy, x + w + 40, cy);

  return wrap('0 0 1200 520', 'A web application drawn as three framed plates stacked in gold line on deep blue: a React frontend of interface components on top, a Spring Boot backend of linked services in the middle, and PostgreSQL databases at the base, joined by dotted lines. Beside them, a dotted orbit around a compass star links design review, UX feedback and sprint planning, every sprint.', g);
}

// ---------------------------------------------------------------- 4: the mobile game, coded with help from AI
/** Small glyphs for the workflow cards. */
const step = {
  spec: (x, y) => `<path d="M${x - 11} ${y - 15} h16 l6 6 v24 h-22Z"/>${[-6, 0, 6].map((o) => `<line x1="${x - 6}" y1="${y + o}" x2="${x + 6}" y2="${y + o}" stroke-width="0.9"/>`).join('')}`,
  draft: (x, y) => `<path d="M${x - 6} ${y - 13} q-6 0 -6 6 v3 q0 3 -4 4 q4 1 4 4 v3 q0 6 6 6"/><path d="M${x + 6} ${y - 13} q6 0 6 6 v3 q0 3 4 4 q-4 1 -4 4 v3 q0 6 -6 6"/>${sparkle(x, y, 5, C.hi)}`,
  review: (x, y) => `<circle cx="${x}" cy="${y}" r="14"/><polyline points="${x - 6},${y} ${x - 1},${y + 5} ${x + 7},${y - 5}" stroke="${C.hi}" stroke-width="1.8"/>`,
  playtest: (x, y) => `<circle cx="${x}" cy="${y}" r="14"/><polygon points="${x - 4},${y - 7} ${x + 7},${y} ${x - 4},${y + 7}" fill="${C.hi}" stroke="none"/>`,
};

function game() {
  let g = '';

  // problem: the phone and the constraints around it
  const fx = 80, fy = 34, fw = 240, fh = 420;
  let pr = `<rect x="${fx}" y="${fy}" width="${fw}" height="${fh}" rx="30" fill="${C.card}" stroke-width="1.4"/>` +
    `<rect x="${fx + 8}" y="${fy + 8}" width="${fw - 16}" height="${fh - 16}" rx="24" stroke-width="0.5"/>` +
    `<rect x="${fx + fw / 2 - 26}" y="${fy + 16}" width="52" height="8" rx="4" fill="${C.gold}" stroke="none"/>`;
  // the 15-second timer: a ring, a quarter of it lit
  const tx = fx + fw + 64, ty = fy + 70;
  pr += `<circle cx="${tx}" cy="${ty}" r="22" stroke-width="0.8"/><path d="M${tx} ${ty - 22} A22 22 0 0 1 ${tx + 22} ${ty}" stroke="${C.hi}" stroke-width="2.4"/>` +
    label(tx, ty + 4, '15S', { size: 11, fill: C.hi, anchor: 'middle' }) + label(tx, ty + 40, 'FIRST REWARD', { size: 10, fill: C.muted, anchor: 'middle' });
  pr += label(fx + fw / 2, fy + fh + 30, 'MID-RANGE PHONE · PLAYERS UNDER 12', { size: 11, fill: C.muted, anchor: 'middle' });
  g += `<g data-part="problem">${pr}</g>`;

  // outcome: the HUD on that phone
  const sx = fx + 22, sw = fw - 44;
  let ou = '';
  ou += `<rect x="${sx}" y="${fy + 40}" width="92" height="22" rx="11" fill="${C.deep}"/><circle cx="${sx + 12}" cy="${fy + 51}" r="6" fill="${C.hi}" stroke="none"/><line x1="${sx + 26}" y1="${fy + 51}" x2="${sx + 78}" y2="${fy + 51}" stroke-width="2.4" stroke="${C.hi}"/>`;
  ou += `<rect x="${sx}" y="${fy + 74}" width="132" height="40" rx="4" fill="${C.deep}" stroke-width="0.8"/>` +
    `<line x1="${sx + 10}" y1="${fy + 88}" x2="${sx + 90}" y2="${fy + 88}" stroke-width="1.8"/><rect x="${sx + 10}" y="${fy + 98}" width="112" height="5" rx="2.5" stroke-width="0.6"/><rect x="${sx + 10}" y="${fy + 98}" width="70" height="5" rx="2.5" fill="${C.hi}" stroke="none"/>`;
  // backpack meter
  const bx = sx + sw - 16;
  ou += `<rect x="${bx}" y="${fy + 40}" width="16" height="120" rx="8"/><rect x="${bx + 3}" y="${fy + 92}" width="10" height="65" rx="5" fill="${C.hi}" stroke="none"/>`;
  // the pit, full of balls; a few specials look the same until picked up
  const px = sx + 4, py = fy + 196, pw = sw - 8, ph = 120;
  ou += `<path d="M${px} ${py} h${pw} v${ph - 18} q0 18 -18 18 h${-(pw - 36)} q-18 0 -18 -18Z" fill="${C.deep}" stroke-width="1.2"/>`;
  const fills = [C.ultra, C.card, C.glow, C.ultra, C.gold];
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 10; c++) {
      const cx = px + 14 + c * 17.4 + (r % 2) * 8, cy = py + 14 + r * 20;
      if (cx > px + pw - 10) continue;
      if (r === 0 && c > 2 && c < 6) continue; // where the player has already been
      const fill = fills[(r * 7 + c * 3) % fills.length];
      ou += `<circle cx="${f(cx)}" cy="${cy}" r="7.4" fill="${fill}" stroke-width="0.7"/>`;
    }
  }
  ou += sparkle(px + 70, py - 12, 7, C.hi) + label(px + 82, py - 8, '+1', { size: 11, fill: C.hi });
  // the icon bar, with its 44-point tap targets marked
  const iy = fy + fh - 74;
  for (let i = 0; i < 4; i++) {
    const ix = sx + 6 + i * 48;
    ou += `<rect x="${ix}" y="${iy}" width="40" height="40" rx="8" fill="${C.deep}" stroke-width="0.9"/>${sparkle(ix + 20, iy + 20, i === 0 ? 8 : 6, i === 0 ? C.hi : C.gold)}`;
  }
  ou += `<g stroke="${C.bone}" stroke-width="0.9"><line x1="${sx + 6}" y1="${iy + 50}" x2="${sx + 46}" y2="${iy + 50}"/><line x1="${sx + 6}" y1="${iy + 45}" x2="${sx + 6}" y2="${iy + 55}"/><line x1="${sx + 46}" y1="${iy + 45}" x2="${sx + 46}" y2="${iy + 55}"/></g>` +
    `<text x="${sx + 54}" y="${iy + 54}" font-family="${MONO}" font-size="10" fill="${C.bone}" stroke="none">44 PT</text>`;
  g += `<g data-part="outcome">${ou}</g>`;

  // design: the core loop, one action going round
  const cx = 600, cy = 244, r = 132;
  let de = orbit(cx, cy, r, [-45, 45, 135, 225], [-90, 0, 90, 180], 15);
  de += `<circle cx="${cx}" cy="${cy}" r="30" fill="${C.ultra}" stroke-width="1.2"/>${sparkle(cx, cy, 14, C.hi)}`;
  de += label(cx, cy + 56, 'ONE ACTION', { size: 11, fill: C.muted, anchor: 'middle' });
  [[-90, 'PICK UP'], [0, 'SELL'], [90, 'UPGRADE'], [180, 'BIGGER PIT']].forEach(([deg, name], i) => {
    const t = (deg * Math.PI) / 180, nx = cx + r * Math.cos(t), ny = cy + r * Math.sin(t);
    de += `<circle cx="${f(nx)}" cy="${f(ny)}" r="15" fill="${C.card}"/>${sparkle(nx, ny, 9, i === 0 ? C.hi : C.gold)}`;
    const side = i === 1 ? 'start' : i === 3 ? 'end' : 'middle';
    const lx = i === 1 ? nx + 24 : i === 3 ? nx - 24 : nx;
    const ly = i === 0 ? ny - 26 : i === 2 ? ny + 36 : ny - 14;
    de += label(lx, ly, name, { anchor: side, fill: C.hi });
  });
  g += `<g data-part="design">${de}</g>`;

  // build: spec, draft, review, playtest, and round again
  const wx = 830, ww = 300, wh = 82, ys = [30, 140, 250, 360];
  const steps = [['spec', 'DESIGN', 'FIGMA · DESIGN DOC'], ['draft', 'CODE', 'ME, WITH CLAUDE CODE'], ['review', 'REVIEW', 'I CHECK EVERY CHANGE'], ['playtest', 'PLAYTEST', 'CLEAN CONSOLE · PHONE CHECK']];
  let bu = '';
  steps.forEach(([k, name, note], i) => {
    const y = ys[i];
    bu += plate(wx, y, ww, wh, i === 1 ? '#0e1650' : C.card);
    bu += step[k](wx + 44, y + wh / 2);
    bu += title(wx + 80, y + 40, name, { anchor: 'start', size: 17 }) + label(wx + 80, y + 60, note, { size: 10, fill: C.muted });
    if (i < 3) bu += arrow(wx + ww / 2, y + wh + 3, wx + ww / 2, ys[i + 1] - 3, 5, 1.2);
  });
  bu += dotted(`M${wx + ww + 6} ${ys[3] + wh / 2} H${wx + ww + 40} V${ys[0] + wh / 2} H${wx + ww + 21}`, 1.2) + chevron(wx + ww + 8, ys[0] + wh / 2, -1, 0, 6);
  g += `<g data-part="build">${bu}</g>`;

  // the reading order: the phone, the loop, the way it gets built
  g += arrow(fx + fw + 30, cy, cx - r - 28, cy, 6);
  g += arrow(cx + r + 28, cy, wx - 10, cy, 6);

  return wrap('0 0 1200 500', 'Three parts in gold line on deep blue. Left, a phone showing the game: a cash pill, a goal card, a backpack meter, a pit full of balls and a row of four icon buttons marked as 44 points wide, with a ring timer beside it for a first reward within 15 seconds. Middle, a dotted loop around a star: pick up, sell, upgrade, bigger pit. Right, four framed steps joined top to bottom and back round: design in Figma, code (written by me with help from Claude Code), review, playtest.', g);
}

const figs = { marines: marines(), navy: navy(), nexgen: nexgen(), game: game() };
for (const page of ['work.html']) {
  const p = join(root, page);
  const html = readFileSync(p, 'utf8');
  const out = html.replace(/<!--fig:(\w+)-->[\s\S]*?<!--\/fig:\1-->/g, (m, name) => (figs[name] ? `<!--fig:${name}-->${figs[name]}<!--/fig:${name}-->` : m));
  if (out !== html) { writeFileSync(p, out); console.log('figures ->', page); }
}
