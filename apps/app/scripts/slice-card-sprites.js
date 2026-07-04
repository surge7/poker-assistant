/**
 * Нарезает спрайт колоды (4×13) на 52 webp-файла: public/cards/{rank}{suit}.webp
 * Порядок в спрайте: ряды h,d,c,s; колонки A,2…9,T,J,Q,K
 */
import sharp from 'sharp';
import { existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DEFAULT_SRC = join(ROOT, 'public', 'cards', 'deck-sprite.jpg');
const OUT_DIR = join(ROOT, 'public', 'cards');

const SUIT_ROWS = { h: 0, d: 1, c: 2, s: 3 };
const RANK_COLS = { A: 0, '2': 1, '3': 2, '4': 3, '5': 4, '6': 5, '7': 6, '8': 7, '9': 8, T: 9, J: 10, Q: 11, K: 12 };

const src = process.argv[2] ? resolve(process.argv[2]) : DEFAULT_SRC;
if (!existsSync(src)) {
  console.error('Sprite not found:', src);
  process.exit(1);
}

const meta = await sharp(src).metadata();
const cols = 13;
const rows = 4;
const cellW = meta.width / cols;
const cellH = meta.height / rows;
const padX = 3;
const padY = 3;

for (const [suit, row] of Object.entries(SUIT_ROWS)) {
  for (const [rank, col] of Object.entries(RANK_COLS)) {
    const colLeft = Math.round(col * cellW);
    const rowTop = Math.round(row * cellH);
    const left = colLeft + padX;
    const top = rowTop + padY;
    const width = Math.round((col + 1) * cellW) - colLeft - padX * 2;
    const height = Math.round((row + 1) * cellH) - rowTop - padY * 2;
    const card = `${rank}${suit}`;
    await sharp(src)
      .extract({ left, top, width, height })
      .webp({ quality: 92 })
      .toFile(join(OUT_DIR, `${card}.webp`));
  }
}

console.log(`Sliced 52 cards from ${src} → ${OUT_DIR}`);
