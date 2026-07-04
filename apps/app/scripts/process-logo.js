/**
 * Обработка Art Deco логотипа: trim, прозрачный фон, версии dark/light.
 * Источник: assets/logo-pirate-artdeco-wide.png (или аргумент CLI)
 */
import sharp from 'sharp';
import { existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DEFAULT_SRC = join(ROOT, 'icon_backup', 'logo-artdeco-wide-source.png');
const FALLBACK_SRC = join(ROOT, 'icon_backup', 'logo-pirate-pre-artdeco.png');

const OUT_DARK = join(ROOT, 'public', 'logo-pirate.png');
const OUT_LIGHT = join(ROOT, 'public', 'logo-light.png');

const PAD = { top: 10, bottom: 10, left: 16, right: 16 };
const MAX_WIDTH = 640;

function dist(r, g, b, tr, tg, tb) {
  return Math.hypot(r - tr, g - tg, b - tb);
}

function sampleBackground(data, width, height, channels) {
  const samples = [];
  const points = [
    [2, 2],
    [width - 3, 2],
    [2, height - 3],
    [width - 3, height - 3],
    [Math.floor(width / 2), 2],
    [Math.floor(width / 2), height - 3],
  ];
  for (const [x, y] of points) {
    const i = (y * width + x) * channels;
    samples.push([data[i], data[i + 1], data[i + 2]]);
  }
  const tr = samples.reduce((s, c) => s + c[0], 0) / samples.length;
  const tg = samples.reduce((s, c) => s + c[1], 0) / samples.length;
  const tb = samples.reduce((s, c) => s + c[2], 0) / samples.length;
  return { tr, tg, tb };
}

function keyOutBackground(buffer, width, height, channels, threshold) {
  const { tr, tg, tb } = sampleBackground(buffer, width, height, channels);
  for (let i = 0; i < buffer.length; i += channels) {
    const a = channels === 4 ? buffer[i + 3] : 255;
    if (a === 0) continue;
    const d = dist(buffer[i], buffer[i + 1], buffer[i + 2], tr, tg, tb);
    if (d < threshold) {
      buffer[i + 3] = 0;
    }
  }
  return buffer;
}

/** Тёмная бронза для светлой темы: #9a6e1c / #7a5518 */
function toLightTheme(buffer, channels) {
  for (let i = 0; i < buffer.length; i += channels) {
    const a = buffer[i + 3];
    if (a < 40) continue;
    const lum = 0.299 * buffer[i] + 0.587 * buffer[i + 1] + 0.114 * buffer[i + 2];
    if (lum < 80) continue;
    const t = Math.min(1, lum / 220);
    buffer[i] = Math.round(122 + (154 - 122) * t);
    buffer[i + 1] = Math.round(85 + (110 - 85) * t);
    buffer[i + 2] = Math.round(28 + (42 - 28) * t);
  }
  return buffer;
}

async function loadTrimmed(src) {
  let pipeline = sharp(src).trim({ threshold: 18 });
  const trimmed = await pipeline.toBuffer();
  return sharp(trimmed)
    .extend({
      ...PAD,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
}

async function savePng(buffer, width, height, channels, outPath) {
  await sharp(buffer, { raw: { width, height, channels } })
    .png({ compressionLevel: 9, palette: false })
    .toFile(outPath);
}

const src = process.argv[2] ? resolve(process.argv[2]) : existsSync(DEFAULT_SRC) ? DEFAULT_SRC : FALLBACK_SRC;
if (!existsSync(src)) {
  console.error('Source logo not found:', src);
  process.exit(1);
}

const { data, info } = await loadTrimmed(src);
const { width, height, channels } = info;

const darkBuf = Buffer.from(data);
keyOutBackground(darkBuf, width, height, channels, 52);
await savePng(darkBuf, width, height, channels, OUT_DARK);

const lightBuf = Buffer.from(darkBuf);
toLightTheme(lightBuf, channels);
await savePng(lightBuf, width, height, channels, OUT_LIGHT);

const darkMeta = await sharp(OUT_DARK).metadata();
console.log(`Dark  → ${OUT_DARK} (${darkMeta.width}x${darkMeta.height}, transparent)`);
console.log(`Light → ${OUT_LIGHT} (${darkMeta.width}x${darkMeta.height}, transparent)`);
