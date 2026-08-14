#!/usr/bin/env node
/**
 * Приводит скриншоты к размеру 1080×1920 (9:16), JPG — как рекомендует стор (RuStore и др.).
 * Центральная обрезка до 9:16, затем ресайз до 1080×1920. Стор не будет обрезать.
 *
 * Использование:
 *   npm run store-screenshots              # из store-screenshots-input/
 *   node scripts/prepare-store-screenshots.js screenshot1.png
 *   node scripts/prepare-store-screenshots.js ./input ./output
 */

import { readdir, mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const TARGET_WIDTH = 1080;
const TARGET_HEIGHT = 1920;
const TARGET_ASPECT = TARGET_WIDTH / TARGET_HEIGHT; // 9:16

const EXT = ['.png', '.jpg', '.jpeg', '.webp'];

async function ensureDir(p) {
  try {
    await mkdir(p, { recursive: true });
  } catch {}
}

async function getSharp() {
  try {
    const sharp = (await import('sharp')).default;
    return sharp;
  } catch {
    console.error('Установите sharp: npm install sharp');
    process.exit(1);
  }
}

async function processFile(sharp, inputPath, outputPath) {
  const img = sharp(inputPath);
  const { width, height } = await img.metadata();
  if (!width || !height) {
    console.warn('Пропуск (нет размеров):', inputPath);
    return;
  }
  const currentAspect = width / height;
  let cropOptions = null;
  if (Math.abs(currentAspect - TARGET_ASPECT) > 0.01) {
    if (currentAspect > TARGET_ASPECT) {
      const cropW = Math.round(height * TARGET_ASPECT);
      const left = Math.round((width - cropW) / 2);
      cropOptions = { width: cropW, height, left, top: 0 };
    } else {
      const cropH = Math.round(width / TARGET_ASPECT);
      const top = 0; // контент сверху — не обрезаем шапку и карты
      cropOptions = { width, height: cropH, left: 0, top };
    }
  }
  let pipeline = img;
  if (cropOptions) pipeline = pipeline.extract(cropOptions);
  await pipeline
    .resize(TARGET_WIDTH, TARGET_HEIGHT)
    .jpeg({ quality: 90 })
    .toFile(outputPath);
  console.log('OK:', outputPath);
}

async function main() {
  const sharp = await getSharp();
  let inputDir = path.join(ROOT, 'store-screenshots-input');
  let outputDir = path.join(ROOT, 'store-screenshots');
  let files = [];

  const args = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  if (args.length === 1) {
    const a = args[0];
    if (EXT.some((e) => a.toLowerCase().endsWith(e))) {
      files = [path.resolve(process.cwd(), a)];
    } else {
      inputDir = path.resolve(process.cwd(), a);
    }
  } else if (args.length >= 2) {
    inputDir = path.resolve(process.cwd(), args[0]);
    outputDir = path.resolve(process.cwd(), args[1]);
  }

  await ensureDir(outputDir);

  if (files.length === 0) {
    try {
      const entries = await readdir(inputDir, { withFileTypes: true });
      files = entries
        .filter((e) => e.isFile() && EXT.includes(path.extname(e.name).toLowerCase()))
        .map((e) => path.join(inputDir, e.name));
    } catch {
      console.error('Папка не найдена или пуста:', inputDir);
      console.error('Положите скриншоты в store-screenshots-input/ и запустите: npm run store-screenshots');
      process.exit(1);
    }
  }

  if (files.length === 0) {
    console.error('Нет изображений .png/.jpg/.jpeg/.webp в', inputDir);
    process.exit(1);
  }

  console.log('Выход: %d×%d (9:16), JPG — как в инструкции стора', TARGET_WIDTH, TARGET_HEIGHT);
  for (const fp of files) {
    const base = path.basename(fp, path.extname(fp)) + '.jpg';
    const out = path.join(outputDir, base);
    await processFile(sharp, fp, out);
  }
  console.log('Готово. Загружайте в стор файлы из папки:', outputDir);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
