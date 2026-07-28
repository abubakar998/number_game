// Generates public/og.png — the social share card. Run: node tools/make-og-image.js
//
// Font, canvas, and PNG encoding live in pixel-font.js so this and make-logo.js draw the
// brand from one source. Built on Node's zlib only, keeping the project's single dependency.

const fs = require('fs');
const path = require('path');
const { textWidth, eachPixel, canvas } = require('./pixel-font');

const W = 1200, H = 630; // standard Open Graph card size

// App palette (public/index.html :root)
const BG_TOP = [30, 41, 59];    // --panel
const BG_BOTTOM = [15, 23, 42]; // --bg
const PANEL = [23, 34, 54];
const BORDER = [51, 65, 85];    // --panel-2
const ACCENT = [56, 189, 248];  // --accent
const GREEN = [34, 197, 94];    // --accent-2
const MUTED = [148, 163, 184];  // --muted
const TEXT = [226, 232, 240];   // --text

const c = canvas(W, H);

function drawText(text, x0, y0, s, colour, gap) {
  eachPixel(text, x0, y0, s, gap, (x, y, w, h) => c.rect(x, y, w, h, colour));
}

function drawCentered(text, y, s, colour, gap) {
  drawText(text, Math.round((W - textWidth(text, s, gap)) / 2), y, s, colour, gap);
}

// ---- Compose the card ----
// Vertical gradient background.
for (let y = 0; y < H; y++) {
  const t = y / (H - 1);
  const col = [0, 1, 2].map((i) => Math.round(BG_TOP[i] + (BG_BOTTOM[i] - BG_TOP[i]) * t));
  c.rect(0, y, W, 1, col);
}

// Centre panel with a 1px border, echoing the app's .panel style.
c.roundRect(60, 60, W - 120, H - 120, 32, BORDER);
c.roundRect(62, 62, W - 124, H - 124, 30, PANEL);

drawCentered('PLUSMINUS', 145, 16, ACCENT);
drawCentered('ONE GAME . TWO DIRECTIONS', 275, 5, TEXT, 6);

// The two variants, each on its own line with a coloured operator.
const s = 6, gap = 7;
const lineA = '+  REACH THE TARGET AND WIN';
const lineB = '-  HIT ZERO AND LOSE';
// Both lines share the wider line's left edge so the operators stack.
const x = Math.round((W - Math.max(textWidth(lineA, s, gap), textWidth(lineB, s, gap))) / 2);
drawText('+', x, 350, s, GREEN, gap);
drawText(lineA.slice(1), x + 5 * s + gap, 350, s, MUTED, gap);
drawText('-', x, 420, s, ACCENT, gap);
drawText(lineB.slice(1), x + 5 * s + gap, 420, s, MUTED, gap);

drawCentered('SOLVED GAME . BEAT THE LEGENDARY AI', 500, 4, MUTED, 5);

const png = c.toPng();
const out = path.join(__dirname, '..', 'public', 'og.png');
fs.writeFileSync(out, png);
console.log(`wrote ${out} — ${W}x${H}, ${(png.length / 1024).toFixed(1)} KB`);
