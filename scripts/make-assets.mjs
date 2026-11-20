// Generates the PWA icons (navy square with white "NW") and public/alert.mp3 (a 2-second two-tone alarm).
// Run: node scripts/make-assets.mjs   (alert.mp3 needs ffmpeg on the PATH)
import { execFileSync } from "node:child_process";
import { mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateSync } from "node:zlib";

const NAVY = [0x0d, 0x1b, 0x2a];

// ---------- PNG encoder ----------
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

// ---------- "NW" glyphs as polygons in a box of height 1 ----------
function glyphs() {
  const t = 0.19; // stroke width
  const nW = 0.78, wW = 1.18, gap = 0.14;
  const N = [
    [[0, 0], [t, 0], [t, 1], [0, 1]],
    [[nW - t, 0], [nW, 0], [nW, 1], [nW - t, 1]],
    [[0, 0], [t * 1.1, 0], [nW, 1], [nW - t * 1.1, 1]],
  ];
  const x0 = nW + gap;
  const stroke = (ax, ay, bx, by) => [[ax - t / 2, ay], [ax + t / 2, ay], [bx + t / 2, by], [bx - t / 2, by]];
  const W = [
    stroke(x0 + t / 2, 0, x0 + wW * 0.27, 1),
    stroke(x0 + wW * 0.27, 1, x0 + wW * 0.5, 0.3),
    stroke(x0 + wW * 0.5, 0.3, x0 + wW * 0.73, 1),
    stroke(x0 + wW * 0.73, 1, x0 + wW - t / 2, 0),
  ];
  return { polys: [...N, ...W], width: x0 + wW };
}

function inside(poly, x, y) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/**
 * @param size pixel size
 * @param textWidth fraction of the icon width taken by "NW"
 * @param mode "any" (rounded navy square), "maskable" (full-bleed navy), "badge" (white letters on transparent)
 */
function drawIcon(size, textWidth, mode) {
  const { polys, width } = glyphs();
  const scale = (size * textWidth) / width;
  const ox = (size - width * scale) / 2, oy = (size - scale) / 2;
  const radius = mode === "any" ? size * 0.18 : 0;
  const buf = Buffer.alloc(size * size * 4);
  const S = 4; // supersampling per axis

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let bg = 0, fg = 0;
      for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
        const x = px + (sx + 0.5) / S, y = py + (sy + 0.5) / S;
        let inBg = true;
        if (radius) {
          const cx = Math.min(Math.max(x, radius), size - radius), cy = Math.min(Math.max(y, radius), size - radius);
          inBg = (x - cx) ** 2 + (y - cy) ** 2 <= radius * radius;
        }
        if (mode === "badge") inBg = false;
        const gx = (x - ox) / scale, gy = (y - oy) / scale;
        const inFg = gx >= -0.2 && gx <= width + 0.2 && gy >= 0 && gy <= 1 && polys.some((p) => inside(p, gx, gy));
        if (inFg) fg++; else if (inBg) bg++;
      }
      const n = S * S, i = (py * size + px) * 4;
      const a = (fg + bg) / n;
      if (a === 0) continue;
      const f = fg / (fg + bg); // white share of the covered area
      buf[i] = Math.round(NAVY[0] * (1 - f) + 255 * f);
      buf[i + 1] = Math.round(NAVY[1] * (1 - f) + 255 * f);
      buf[i + 2] = Math.round(NAVY[2] * (1 - f) + 255 * f);
      buf[i + 3] = Math.round(a * 255);
    }
  }
  return encodePng(size, buf);
}

mkdirSync("public/icons", { recursive: true });
const icons = [
  ["public/icons/icon-192.png", 192, 0.62, "any"],
  ["public/icons/icon-512.png", 512, 0.62, "any"],
  ["public/icons/maskable-192.png", 192, 0.48, "maskable"],
  ["public/icons/maskable-512.png", 512, 0.48, "maskable"],
  ["public/icons/apple-touch-icon.png", 180, 0.56, "maskable"],
  ["public/icons/badge-96.png", 96, 0.86, "badge"],
  ["src/app/icon.png", 64, 0.66, "any"],
];
for (const [file, size, tw, mode] of icons) {
  writeFileSync(file, drawIcon(size, tw, mode));
  console.log("wrote", file);
}

// ---------- alert sound: two alternating tones, about 2 seconds ----------
const RATE = 44100, SECONDS = 2.0;
const samples = Math.round(RATE * SECONDS);
const pcm = Buffer.alloc(samples * 2);
const BEEP = 0.25; // seconds per tone
for (let i = 0; i < samples; i++) {
  const t = i / RATE;
  const step = Math.floor(t / BEEP);
  const freq = step % 2 === 0 ? 988 : 740; // B5 / F#5
  const local = t - step * BEEP;
  const env = Math.min(1, local / 0.01, (BEEP - local) / 0.02, (SECONDS - t) / 0.05); // short fades, no clicks
  // Fundamental plus a little third harmonic so it cuts through on phone speakers.
  const v = Math.sin(2 * Math.PI * freq * t) + 0.3 * Math.sin(2 * Math.PI * 3 * freq * t);
  pcm.writeInt16LE(Math.round(Math.max(0, env) * 0.62 * v * 32767 / 1.3), i * 2);
}
const header = Buffer.alloc(44);
header.write("RIFF", 0); header.writeUInt32LE(36 + pcm.length, 4); header.write("WAVE", 8);
header.write("fmt ", 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
header.writeUInt32LE(RATE, 24); header.writeUInt32LE(RATE * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
header.write("data", 36); header.writeUInt32LE(pcm.length, 40);
const wav = join(tmpdir(), `nw-alert-${process.pid}.wav`);
writeFileSync(wav, Buffer.concat([header, pcm]));
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", wav, "-codec:a", "libmp3lame", "-b:a", "96k", "public/alert.mp3"]);
unlinkSync(wav);
console.log("wrote public/alert.mp3");
