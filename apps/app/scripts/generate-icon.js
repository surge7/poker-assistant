import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT = resolve(__dirname, '..');
const LOGO = join(ROOT, 'public', 'logo-pirate.png');
const ANDROID_RES = join(ROOT, 'android', 'app', 'src', 'main', 'res');
const BG_COLOR = { r: 13, g: 40, b: 24 }; // #0d2818

// Backup existing icons
const backupDir = join(ROOT, 'icon_backup', 'pre-redesign');
if (!existsSync(backupDir)) {
  mkdirSync(backupDir, { recursive: true });
}

const DENSITIES = [
  { dir: 'mipmap-mdpi', size: 48 },
  { dir: 'mipmap-hdpi', size: 72 },
  { dir: 'mipmap-xhdpi', size: 96 },
  { dir: 'mipmap-xxhdpi', size: 144 },
  { dir: 'mipmap-xxxhdpi', size: 192 },
];

async function generateIcon() {
  for (const d of DENSITIES) {
    const dir = join(ANDROID_RES, d.dir);
    if (!existsSync(dir)) {
      console.log(`Skipping ${d.dir} (not found)`);
      continue;
    }
    
    const logoSize = Math.round(d.size * 0.65);
    
    // Square icon
    const squareBg = await sharp({
      create: { width: d.size, height: d.size, channels: 3, background: BG_COLOR }
    }).png().toBuffer();
    
    const logo = await sharp(LOGO)
      .resize(logoSize, logoSize, { fit: 'inside' })
      .png()
      .toBuffer();
    
    const logometa = await sharp(logo).metadata();
    const lw = logometa.width || logoSize;
    const lh = logometa.height || logoSize;
    
    const squareIcon = await sharp(squareBg)
      .composite([{
        input: logo,
        top: Math.round((d.size - lh) / 2),
        left: Math.round((d.size - lw) / 2),
      }])
      .png()
      .toBuffer();
    
    // Round icon (circular clip via buffer manipulation)
    const circleMask = Buffer.from(
      `<svg><circle cx="${d.size/2}" cy="${d.size/2}" r="${d.size/2}" fill="white"/></svg>`
    );
    
    const roundIcon = await sharp(squareIcon)
      .composite([{ input: circleMask, blend: 'dest-in' }])
      .png()
      .toBuffer();
    
    // Foreground for adaptive icon
    const fgBg = await sharp({
      create: { width: d.size, height: d.size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
    }).png().toBuffer();
    
    const foreground = await sharp(fgBg)
      .composite([{
        input: logo,
        top: Math.round((d.size - lh) / 2),
        left: Math.round((d.size - lw) / 2),
      }])
      .png()
      .toBuffer();
    
    // Write files
    await sharp(squareIcon).toFile(join(dir, 'ic_launcher.png'));
    await sharp(roundIcon).toFile(join(dir, 'ic_launcher_round.png'));
    await sharp(foreground).toFile(join(dir, 'ic_launcher_foreground.png'));
    
    console.log(`✓ ${d.dir} (${d.size}×${d.size})`);
  }
  console.log('Icon generation complete!');
}

generateIcon();