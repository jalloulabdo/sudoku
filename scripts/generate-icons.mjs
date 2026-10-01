// Generates the PWA icons in public/ without any image dependencies:
// shapes are rasterised with 4×4 supersampling and encoded as PNG with zlib.
// Run: node scripts/generate-icons.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BG = [29, 78, 216]; // --accent (#1d4ed8)
const FG = [255, 255, 255];
// Opacity of each tile in the 3×3 motif: a diagonal of solid tiles.
const TILE_ALPHA = [1, 0.45, 0.45, 0.45, 1, 0.45, 0.45, 0.45, 1];

/** Signed distance helper: is (x, y) inside a rounded rectangle? */
function inRoundRect(x, y, rx, ry, w, h, r) {
  const cx = Math.min(Math.max(x, rx + r), rx + w - r);
  const cy = Math.min(Math.max(y, ry + r), ry + h - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r && x >= rx && x <= rx + w && y >= ry && y <= ry + h;
}

/**
 * @param size   output size in px
 * @param opts.fullBleed  background fills the whole square (maskable / apple-touch)
 * @param opts.motif      motif size as a fraction of the icon
 */
function drawIcon(size, { fullBleed, motif }) {
  const SS = 4;
  const px = new Uint8Array(size * size * 4);
  const corner = fullBleed ? 0 : 0.22;
  const m = motif;
  const gap = m * 0.06;
  const tile = (m - 2 * gap) / 3;
  const start = (1 - m) / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = (x + (sx + 0.5) / SS) / size;
          const v = (y + (sy + 0.5) / SS) / size;
          if (!inRoundRect(u, v, 0, 0, 1, 1, corner)) continue;
          let col = BG;
          for (let k = 0; k < 9; k++) {
            const tx = start + (k % 3) * (tile + gap);
            const ty = start + Math.floor(k / 3) * (tile + gap);
            if (inRoundRect(u, v, tx, ty, tile, tile, tile * 0.18)) {
              const t = TILE_ALPHA[k];
              col = BG.map((c, i) => c + (FG[i] - c) * t);
              break;
            }
          }
          r += col[0]; g += col[1]; b += col[2]; a += 255;
        }
      }
      const n = SS * SS;
      const o = (y * size + x) * 4;
      // Colours are averaged over covered samples only, alpha over all samples.
      const covered = a / 255;
      px[o] = covered ? r / covered : 0;
      px[o + 1] = covered ? g / covered : 0;
      px[o + 2] = covered ? b / covered : 0;
      px[o + 3] = a / n;
    }
  }
  return encodePng(size, size, px);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePng(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter: none
    Buffer.from(rgba.buffer, y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<rect width="100" height="100" rx="22" fill="#1d4ed8"/>
${TILE_ALPHA.map((t, k) => {
  const m = 0.62, gap = m * 0.06, tile = (m - 2 * gap) / 3, start = (1 - m) / 2;
  const x = (start + (k % 3) * (tile + gap)) * 100;
  const y = (start + Math.floor(k / 3) * (tile + gap)) * 100;
  return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${(tile * 100).toFixed(2)}" height="${(tile * 100).toFixed(2)}" rx="${(tile * 18).toFixed(2)}" fill="#fff" fill-opacity="${t}"/>`;
}).join('\n')}
</svg>
`;

mkdirSync('public', { recursive: true });
const outputs = {
  'public/pwa-192x192.png': drawIcon(192, { fullBleed: false, motif: 0.62 }),
  'public/pwa-512x512.png': drawIcon(512, { fullBleed: false, motif: 0.62 }),
  // Maskable: full-bleed background, motif inside the 80% safe zone.
  'public/maskable-512x512.png': drawIcon(512, { fullBleed: true, motif: 0.5 }),
  'public/apple-touch-icon.png': drawIcon(180, { fullBleed: true, motif: 0.6 }),
  'public/favicon.svg': FAVICON_SVG,
};
for (const [file, data] of Object.entries(outputs)) {
  writeFileSync(file, data);
  console.log(file, data.length, 'bytes');
}
