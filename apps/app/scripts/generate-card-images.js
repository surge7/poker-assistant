/**
 * Generates public/cards/{rank}{suit}.webp from the public-domain
 * Saul Spatz SVGCards Horizontal2 jumbo-index deck.
 *
 * Source: https://github.com/saulspatz/SVGCards
 * Deck: Decks/Horizontal2 (traditional red/black suits, court-card artwork,
 * side-by-side jumbo indices designed for small screens).
 */
import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT_DIR = join(ROOT, 'public', 'cards');
const BASE_URL = 'https://raw.githubusercontent.com/saulspatz/SVGCards/master/Decks/Horizontal2/svgs';

const MAX_HEIGHT = 220;
const WEBP_QUALITY = 88;
const CARD_FACE = '#fdfded';
const BORDER = '#111111';
/** Координаты центральной иллюстрации в колоде Horizontal2 при height=220. */
const SOURCE_ART = { left: 38, top: 52, width: 71, height: 116 };
const ART_SCALE = 1.04;
const ART_TOP = 62;

const RANK_MAP = {
  Ace: 'A',
  Jack: 'J',
  Queen: 'Q',
  King: 'K',
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
  spade: 's',
  heart: 'h',
  diamond: 'd',
  club: 'c',
};

const SUIT_SYMBOLS = {
  s: '♠',
  h: '♥',
  d: '♦',
  c: '♣',
};

const SUIT_COLORS = {
  s: '#111111',
  h: '#e00000',
  d: '#e00000',
  c: '#111111',
};

const RANK_LABELS = {
  A: 'A',
  J: 'J',
  Q: 'Q',
  K: 'K',
  T: '10',
};

function sourceFileName(rankName, suitName) {
  return `${suitName}${rankName}.svg`;
}

function rankLabel(rank) {
  return RANK_LABELS[rank] ?? rank;
}

function escapeXml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function indexOverrideSvg(width, height, rank, suitCode) {
  const label = rankLabel(rank);
  const color = SUIT_COLORS[suitCode];
  const suit = SUIT_SYMBOLS[suitCode];
  const rankSize = label === '10' ? 36 : 46;
  const rankX = label === '10' ? 4 : 6;
  const rankY = 42;
  const suitSize = label === '10' ? 34 : 40;
  const suitX = label === '10' ? 56 : label === 'Q' ? 56 : 48;
  const suitY = 39;
  const topMaskWidth = label === '10' ? 82 : label === 'Q' ? 82 : 74;
  const topMaskHeight = 54;

  // Нижний правый индекс — ~60% от верхнего, перевёрнут на 180°
  const bottomRankSize = label === '10' ? 23 : 29;
  const bottomRankX = label === '10' ? 6 : 8;
  const bottomRankY = 32;
  const bottomSuitX = label === '10' ? 44 : label === 'Q' ? 44 : 38;
  const bottomSuitY = 31;
  const bottomMaskWidth = label === '10' ? 58 : label === 'Q' ? 58 : 52;
  const bottomMaskHeight = 34;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect x="1" y="1" width="${topMaskWidth}" height="${topMaskHeight}" rx="7" fill="${CARD_FACE}"/>
  <text x="${rankX}" y="${rankY}" font-size="${rankSize}" font-weight="800" letter-spacing="-2.5"
    font-family="Arial, Helvetica, sans-serif" fill="${color}">${escapeXml(label)}</text>
  <text x="${suitX}" y="${suitY}" text-anchor="middle" font-size="${suitSize}" font-weight="800"
    font-family="Arial, Helvetica, sans-serif" fill="${color}">${suit}</text>
  <g transform="translate(${width} ${height}) rotate(180)">
    <rect x="1" y="1" width="${bottomMaskWidth}" height="${bottomMaskHeight}" rx="5" fill="${CARD_FACE}"/>
    <text x="${bottomRankX}" y="${bottomRankY}" font-size="${bottomRankSize}" font-weight="800" letter-spacing="-1.5"
      font-family="Arial, Helvetica, sans-serif" fill="${color}">${escapeXml(label)}</text>
    <text x="${bottomSuitX}" y="${bottomSuitY}" text-anchor="middle" font-size="19" font-weight="800"
      font-family="Arial, Helvetica, sans-serif" fill="${color}">${suit}</text>
  </g>
  <rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="8" fill="none" stroke="${BORDER}" stroke-width="1.5"/>
</svg>`;
}

async function buildCardFace(baseBuffer, width, height) {
  const artWidth = Math.round(SOURCE_ART.width * ART_SCALE);
  const artHeight = Math.round(SOURCE_ART.height * ART_SCALE);
  const artLeft = Math.round((width - artWidth) / 2);
  const centralArt = await sharp(baseBuffer)
    .extract(SOURCE_ART)
    .resize({ width: artWidth, height: artHeight })
    .png()
    .toBuffer();

  const { data } = await sharp({
    create: { width, height, channels: 4, background: CARD_FACE },
  })
    .composite([{ input: centralArt, left: artLeft, top: ART_TOP }])
    .png()
    .toBuffer({ resolveWithObject: true });

  return data;
}

mkdirSync(OUT_DIR, { recursive: true });

let totalIn = 0;
let totalOut = 0;

for (const [rankName, rank] of Object.entries(RANK_MAP)) {
  for (const [suitName, suitCode] of Object.entries(SUIT_MAP)) {
    const fileName = sourceFileName(rankName, suitName);
    const url = `${BASE_URL}/${fileName}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to download ${url}: ${res.status}`);
    }

    const input = Buffer.from(await res.arrayBuffer());
    totalIn += input.length;

    const { data: baseBuffer, info: baseInfo } = await sharp(input, { density: 288 })
      .resize({ height: MAX_HEIGHT, fit: 'inside' })
      .png()
      .toBuffer({ resolveWithObject: true });

    const faceBuffer = await buildCardFace(baseBuffer, baseInfo.width, baseInfo.height);

    const outPath = join(OUT_DIR, `${rank}${suitCode}.webp`);
    const info = await sharp(faceBuffer)
      .composite([{
        input: Buffer.from(indexOverrideSvg(baseInfo.width, baseInfo.height, rank, suitCode)),
        left: 0,
        top: 0,
      }])
      .webp({ quality: WEBP_QUALITY, effort: 6 })
      .toFile(outPath);

    totalOut += info.size;
  }
}

console.log(
  `Generated ${Object.keys(RANK_MAP).length * Object.keys(SUIT_MAP).length} illustrated, mobile-readable cards → ${OUT_DIR}\n` +
  `PNG total ~${(totalIn / 1024).toFixed(0)} KB → WebP ~${(totalOut / 1024).toFixed(0)} KB`
);
