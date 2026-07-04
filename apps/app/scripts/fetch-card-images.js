/**
 * Скачивает колоду из https://github.com/ntkhang03/poker-cards
 * и сохраняет сжатые webp: public/cards/{rank}{suit}.webp
 */
import sharp from 'sharp';
import { mkdirSync, rmSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT_DIR = join(ROOT, 'public', 'cards');
const BASE_URL = 'https://raw.githubusercontent.com/ntkhang03/poker-cards/main/cards';

const RANK_MAP = {
  ace: 'A',
  jack: 'J',
  queen: 'Q',
  king: 'K',
  '10': 'T',
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
};

const SUIT_MAP = {
  spades: 's',
  hearts: 'h',
  diamonds: 'd',
  clubs: 'c',
};

const FILES = [];
for (const [rankName, rankCode] of Object.entries(RANK_MAP)) {
  for (const [suitName, suitCode] of Object.entries(SUIT_MAP)) {
    const fileName = rankName === '10'
      ? `10_of_${suitName}.png`
      : `${rankName}_of_${suitName}.png`;
    FILES.push({ fileName, card: `${rankCode}${suitCode}` });
  }
}

const MAX_HEIGHT = 220;
const WEBP_QUALITY = 78;

mkdirSync(OUT_DIR, { recursive: true });

let totalIn = 0;
let totalOut = 0;

for (const { fileName, card } of FILES) {
  const url = `${BASE_URL}/${fileName}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download ${url}: ${res.status}`);
  }
  const input = Buffer.from(await res.arrayBuffer());
  totalIn += input.length;

  const outPath = join(OUT_DIR, `${card}.webp`);
  const info = await sharp(input)
    .resize({ height: MAX_HEIGHT, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY, effort: 6 })
    .toFile(outPath);

  totalOut += info.size;
}

// Удаляем старый спрайт, если остался
try {
  rmSync(join(OUT_DIR, 'deck-sprite.jpg'));
} catch {
  // ignore
}

console.log(
  `Fetched ${FILES.length} cards from ntkhang03/poker-cards → ${OUT_DIR}\n` +
  `PNG total ~${(totalIn / 1024).toFixed(0)} KB → WebP ~${(totalOut / 1024).toFixed(0)} KB`
);
