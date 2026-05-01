import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { existsSync } from 'fs';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT = resolve(__dirname, '..');
const LOGO = join(ROOT, 'public', 'logo-pirate.png');
const ANDROID_RES = join(ROOT, 'android', 'app', 'src', 'main', 'res');
const BG_COLOR = { r: 13, g: 40, b: 24 }; // #0d2818 felt-900

const SIZES = [
  { dir: 'drawable-port-mdpi', w: 320, h: 480 },
  { dir: 'drawable-port-hdpi', w: 480, h: 800 },
  { dir: 'drawable-port-xhdpi', w: 720, h: 1280 },
  { dir: 'drawable-port-xxhdpi', w: 960, h: 1600 },
  { dir: 'drawable-port-xxxhdpi', w: 1280, h: 1920 },
  { dir: 'drawable-land-mdpi', w: 480, h: 320 },
  { dir: 'drawable-land-hdpi', w: 800, h: 480 },
  { dir: 'drawable-land-xhdpi', w: 1280, h: 720 },
  { dir: 'drawable-land-xxhdpi', w: 1600, h: 960 },
  { dir: 'drawable-land-xxxhdpi', w: 1920, h: 1280 },
];

async function generateSplash() {
  for (const size of SIZES) {
    const dir = join(ANDROID_RES, size.dir);
    if (!existsSync(dir)) {
      console.log(`Skipping ${size.dir} (directory not found)`);
      continue;
    }
    
    const logoSize = Math.min(size.w, size.h) * 0.35;
      const outFile = join(dir, 'splash.png');
    
    try {
      // Create background
      const bg = await sharp({
        create: {
          width: size.w,
          height: size.h,
          channels: 3,
          background: BG_COLOR,
        }
      }).png().toBuffer();
      
      // Resize logo
      const logo = await sharp(LOGO)
        .resize(Math.round(logoSize), Math.round(logoSize), { fit: 'inside' })
        .png()
        .toBuffer();
      
      // Get actual logo dimensions
      const logometa = await sharp(logo).metadata();
      const logoW = logometa.width || Math.round(logoSize);
      const logoH = logometa.height || Math.round(logoSize);
      
      // Composite logo onto background
      await sharp(bg)
        .composite([{
          input: logo,
          gravity: 'center',
          top: Math.round((size.h - logoH) / 2),
          left: Math.round((size.w - logoW) / 2),
        }])
        .png()
        .toFile(outFile);
      
      console.log(`✓ ${size.dir}/splash.png (${size.w}×${size.h})`);
    } catch (err) {
      console.error(`✗ ${size.dir}: ${err.message}`);
    }
  }
  console.log('Splash generation complete!');
}

generateSplash();