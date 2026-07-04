import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT = resolve(__dirname, '..');
const ANDROID_RES = join(ROOT, 'android', 'app', 'src', 'main', 'res');
/** Мастер-иконка: фишка с буквой A (туз) на тёмно-зелёном фоне */
const ICON_SOURCE = join(ANDROID_RES, 'icon_launcher_foreground_512.png');

const DENSITIES = [
  { dir: 'mipmap-mdpi', launcher: 48, foreground: 108 },
  { dir: 'mipmap-hdpi', launcher: 72, foreground: 162 },
  { dir: 'mipmap-xhdpi', launcher: 96, foreground: 216 },
  { dir: 'mipmap-xxhdpi', launcher: 144, foreground: 324 },
  { dir: 'mipmap-xxxhdpi', launcher: 192, foreground: 432 },
];

async function roundMask(size) {
  return Buffer.from(
    `<svg><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white"/></svg>`
  );
}

async function generateIcon() {
  if (!existsSync(ICON_SOURCE)) {
    console.error(`Icon source not found: ${ICON_SOURCE}`);
    process.exit(1);
  }

  for (const d of DENSITIES) {
    const dir = join(ANDROID_RES, d.dir);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const launcher = await sharp(ICON_SOURCE)
      .resize(d.launcher, d.launcher, { fit: 'cover' })
      .png()
      .toBuffer();

    const round = await sharp(launcher)
      .composite([{ input: await roundMask(d.launcher), blend: 'dest-in' }])
      .png()
      .toBuffer();

    const foreground = await sharp(ICON_SOURCE)
      .resize(d.foreground, d.foreground, { fit: 'cover' })
      .png()
      .toBuffer();

    await sharp(launcher).toFile(join(dir, 'ic_launcher.png'));
    await sharp(round).toFile(join(dir, 'ic_launcher_round.png'));
    await sharp(foreground).toFile(join(dir, 'ic_launcher_foreground.png'));

    console.log(`✓ ${d.dir} (launcher ${d.launcher}px, foreground ${d.foreground}px)`);
  }

  console.log('Icon generation complete (A-chip launcher).');
}

generateIcon();
