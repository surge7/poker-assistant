#!/usr/bin/env node
/**
 * Один HTML-файл со всем внутри — для пересылки в Telegram, AirDrop и т.д.
 * Работает офлайн в Safari на iPhone (и в других браузерах).
 *
 * npm run build:single-html
 */

import { execSync } from 'child_process';
import { readFile, readdir, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist-portable');
const OUT = path.join(ROOT, 'poker-assistant.html');

const MIME = {
  webp: 'image/webp',
  png: 'image/png',
  woff2: 'font/woff2',
};

async function toDataUri(filePath) {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const mime = MIME[ext];
  if (!mime) throw new Error(`Неизвестный тип: ${filePath}`);
  const buf = await readFile(filePath);
  return `data:${mime};base64,${buf.toString('base64')}`;
}

async function findAsset(dir, prefix) {
  const names = await readdir(dir);
  const match = names.find((n) => n.startsWith(prefix));
  if (!match) throw new Error(`Не найден ${prefix}* в ${dir}`);
  return path.join(dir, match);
}

async function buildAssetMap() {
  const cards = {};
  const cardsDir = path.join(DIST, 'cards');
  for (const name of await readdir(cardsDir)) {
    if (!name.endsWith('.webp')) continue;
    const code = name.replace(/\.webp$/, '');
    cards[code] = await toDataUri(path.join(cardsDir, name));
  }
  const logos = {
    './logo-pirate.png': await toDataUri(path.join(DIST, 'logo-pirate.png')),
    './logo-light.png': await toDataUri(path.join(DIST, 'logo-light.png')),
  };
  return { cards, logos };
}

function applyAssetMap(text, map) {
  let out = text;
  const entries = [...map.entries()].sort((a, b) => b[0].length - a[0].length);
  for (const [rel, uri] of entries) {
    out = out.split(rel).join(uri);
  }
  return out;
}

function prepareCss(css) {
  return css
    .replace(/@font-face\{[^}]*\}/g, '')
    .replace(/url\([^)]+\)/g, 'local("system-ui")')
    .replace(
      /--font-family:\s*[^;]+;/g,
      "--font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;",
    );
}

function prepareJs(js) {
  return js.replace(/<\/script/gi, '<\\/script');
}

async function main() {
  console.log('Сборка portable...');
  execSync('npm run build:portable-web', { cwd: ROOT, stdio: 'inherit' });

  const { cards, logos } = await buildAssetMap();
  const jsPath = await findAsset(path.join(DIST, 'assets'), 'app.js');
  const cssPath = await findAsset(path.join(DIST, 'assets'), 'style-');
  let js = prepareJs(await readFile(jsPath, 'utf8'));
  let css = prepareCss(await readFile(cssPath, 'utf8'));

  js = applyAssetMap(js, new Map(Object.entries(logos)));
  css = applyAssetMap(css, new Map(Object.entries(logos)));

  const cardsJson = JSON.stringify(cards);
  const embedScript = `window.__PA_CARDS__=${cardsJson};`;

  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <title>Покерный тренажёр</title>
  <style>html{background:#0d2818;color-scheme:dark light}</style>
  <style>${css}</style>
</head>
<body>
  <div id="app"></div>
  <script>${embedScript}</script>
  <script>${js}</script>
</body>
</html>
`;

  await writeFile(OUT, html, 'utf8');
  const sizeMb = (Buffer.byteLength(html, 'utf8') / (1024 * 1024)).toFixed(2);
  console.log(`\nГотово: ${OUT} (${sizeMb} MB)`);
  console.log('\nПерешлите файл в Telegram / AirDrop / почту.');
  console.log('На iPhone: скачайте → «Поделиться» → «Открыть в Safari».');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
