// Generates public/og.png — the social share card. Run: node tools/make-og-image.js
//
// Written against Node's built-in zlib so the project keeps its single dependency.
// The card is drawn with rectangles and a small bitmap font, in the app's own palette.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

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

// ---- 5x7 bitmap font ----
const FONT = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  J: ['####.', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#...#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  1: ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  3: ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'],
  4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  6: ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  7: ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  9: ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  ':': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
};

// ---- Canvas ----
const px = Buffer.alloc(W * H * 3);

function setPx(x, y, c) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2];
}

function rect(x0, y0, w, h, c) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) setPx(x, y, c);
}

// Rounded rectangle, corners tested by distance from the corner centre.
function roundRect(x0, y0, w, h, r, c) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const dx = Math.max(x0 + r - x, 0, x - (x0 + w - 1 - r));
      const dy = Math.max(y0 + r - y, 0, y - (y0 + h - 1 - r));
      if (dx * dx + dy * dy <= r * r) setPx(x, y, c);
    }
  }
}

// Draw `text` with each font pixel scaled to s*s. Returns the width drawn.
function textWidth(text, s, gap) { return text.length * (5 * s + gap) - gap; }

function drawText(text, x0, y0, s, c, gap) {
  gap = gap === undefined ? s : gap;
  let x = x0;
  for (const ch of text.toUpperCase()) {
    const glyph = FONT[ch] || FONT[' '];
    for (let gy = 0; gy < 7; gy++) {
      for (let gx = 0; gx < 5; gx++) {
        if (glyph[gy][gx] === '#') rect(x + gx * s, y0 + gy * s, s, s, c);
      }
    }
    x += 5 * s + gap;
  }
  return x - gap - x0;
}

function drawCentered(text, y, s, c, gap) {
  gap = gap === undefined ? s : gap;
  return drawText(text, Math.round((W - textWidth(text, s, gap)) / 2), y, s, c, gap);
}

// ---- Compose the card ----
// Vertical gradient background.
for (let y = 0; y < H; y++) {
  const t = y / (H - 1);
  const c = [0, 1, 2].map((i) => Math.round(BG_TOP[i] + (BG_BOTTOM[i] - BG_TOP[i]) * t));
  rect(0, y, W, 1, c);
}

// Centre panel with a 1px border, echoing the app's .panel style.
roundRect(60, 60, W - 120, H - 120, 32, BORDER);
roundRect(62, 62, W - 124, H - 124, 30, PANEL);

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

// ---- Encode PNG ----
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;  // bit depth
ihdr[9] = 2;  // colour type: truecolour RGB
ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0; // deflate / adaptive filtering / no interlace

// Each scanline is prefixed with filter type 0 (None).
const raw = Buffer.alloc(H * (1 + W * 3));
for (let y = 0; y < H; y++) {
  raw[y * (1 + W * 3)] = 0;
  px.copy(raw, y * (1 + W * 3) + 1, y * W * 3, (y + 1) * W * 3);
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const out = path.join(__dirname, '..', 'public', 'og.png');
fs.writeFileSync(out, png);
console.log(`wrote ${out} — ${W}x${H}, ${(png.length / 1024).toFixed(1)} KB`);
