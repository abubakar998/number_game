// Generates the Plusminus brand assets. Run: node tools/make-logo.js
//
//   public/icon.svg      the ± mark alone, square
//   public/logo.svg      mark + PLUSMINUS wordmark, horizontal lockup
//   public/icon-512.png  raster of the mark, for platforms that reject SVG
//
// The mark's geometry is defined ONCE below and shared by the SVG and PNG writers, so the
// vector and raster versions can never drift apart. The wordmark is drawn as rectangles
// from the same bitmap font as the share card — no <text>, so no font dependency.

const fs = require('fs');
const path = require('path');
const { textWidth, eachPixel, canvas } = require('./pixel-font');

const OUT = path.join(__dirname, '..', 'public');

// App palette (public/index.html :root)
const BG = '#0f172a';       // --bg
const ACCENT = '#38bdf8';   // --accent   → the minus
const GREEN = '#22c55e';    // --accent-2 → the plus

// ---- The ± mark, on a 64x64 grid ----
// A plus stacked over a minus bar. Bars are `T` thick with rounded ends.
const M = {
  size: 64,
  tileRadius: 14,
  T: 7,           // bar thickness
  armLen: 26,     // full width of the horizontal bars
  // Chosen so the glyph's ink (y 12 .. 51.5) centres on the tile rather than its
  // geometric midpoints, which would leave a visibly larger gap below.
  plusCy: 25,     // centre of the plus
  minusCy: 48,    // centre of the minus bar
  cx: 32,
};

// The mark as {x, y, w, h, r, part} rects — the single source both writers consume.
function markRects() {
  const { T, armLen, plusCy, minusCy, cx } = M;
  const r = T / 2;
  const halfArm = armLen / 2;
  return [
    // plus: horizontal then vertical
    { x: cx - halfArm, y: plusCy - T / 2, w: armLen, h: T, r, part: 'plus' },
    { x: cx - T / 2, y: plusCy - halfArm, w: T, h: armLen, r, part: 'plus' },
    // minus
    { x: cx - halfArm, y: minusCy - T / 2, w: armLen, h: T, r, part: 'minus' },
  ];
}

function markSvgBody(scale, dx, dy) {
  const s = (n) => +(n * scale).toFixed(2);
  const byPart = { plus: [], minus: [] };
  for (const q of markRects()) {
    byPart[q.part].push(
      `<rect x="${s(q.x) + dx}" y="${s(q.y) + dy}" width="${s(q.w)}" height="${s(q.h)}" rx="${s(q.r)}"/>`
    );
  }
  return (
    `<g class="plus" fill="${GREEN}">${byPart.plus.join('')}</g>` +
    `<g class="minus" fill="${ACCENT}">${byPart.minus.join('')}</g>`
  );
}

// ---- icon.svg ----
const icon =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${M.size} ${M.size}" width="${M.size}" height="${M.size}" role="img" aria-label="Plusminus">` +
  `<rect width="${M.size}" height="${M.size}" rx="${M.tileRadius}" fill="${BG}"/>` +
  markSvgBody(1, 0, 0) +
  `</svg>\n`;
fs.writeFileSync(path.join(OUT, 'icon.svg'), icon);

// ---- logo.svg — mark + pixel wordmark ----
const WORD = 'PLUSMINUS';
const PX = 5;                 // wordmark pixel size
const GAP = 5;                // gap between glyphs
const PAD = 16;
const wordW = textWidth(WORD, PX, GAP);
const wordH = 7 * PX;
const markSize = M.size;
const LOGO_W = PAD + markSize + 18 + wordW + PAD;
const LOGO_H = PAD + markSize + PAD;

const wordRects = [];
const wordX = PAD + markSize + 18;
const wordY = Math.round((LOGO_H - wordH) / 2);
eachPixel(WORD, wordX, wordY, PX, GAP, (x, y, w, h) => {
  wordRects.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`);
});

const logo =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LOGO_W} ${LOGO_H}" width="${LOGO_W}" height="${LOGO_H}" role="img" aria-label="Plusminus">` +
  `<rect width="${LOGO_W}" height="${LOGO_H}" rx="18" fill="${BG}"/>` +
  `<g transform="translate(${PAD}, ${PAD})">${markSvgBody(1, 0, 0)}</g>` +
  `<g class="wordmark" fill="${ACCENT}">${wordRects.join('')}</g>` +
  `</svg>\n`;
fs.writeFileSync(path.join(OUT, 'logo.svg'), logo);

// ---- icon-512.png — same geometry, rasterised ----
const R = 512, scale = R / M.size;
const c = canvas(R, R);
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
c.roundRect(0, 0, R, R, Math.round(M.tileRadius * scale), hex(BG));
for (const q of markRects()) {
  c.roundRect(
    Math.round(q.x * scale), Math.round(q.y * scale),
    Math.round(q.w * scale), Math.round(q.h * scale),
    Math.round(q.r * scale),
    hex(q.part === 'plus' ? GREEN : ACCENT)
  );
}
const png = c.toPng();
fs.writeFileSync(path.join(OUT, 'icon-512.png'), png);

console.log(`wrote public/icon.svg      ${M.size}x${M.size}`);
console.log(`wrote public/logo.svg      ${LOGO_W}x${LOGO_H}`);
console.log(`wrote public/icon-512.png  ${R}x${R}, ${(png.length / 1024).toFixed(1)} KB`);
