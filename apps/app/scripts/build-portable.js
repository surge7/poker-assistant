#!/usr/bin/env node
/**
 * Портативная сборка для телефона и компьютера — без сервера.
 * Android: установить poker-assistant.apk (работает офлайн).
 * ПК: открыть web/index.html в браузере.
 *
 * npm run build:portable
 * npm run build:portable -- --apk-only   # только APK, без zip
 */

import { execSync } from 'child_process';
import { cp, mkdir, rm, writeFile, access } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PORTABLE = path.join(ROOT, 'portable');
const ZIP_PATH = path.join(ROOT, 'poker-assistant-portable.zip');

const README = `Покерный тренажёр — портативная версия
=====================================

ANDROID (телефон, без интернета)
--------------------------------
1. Скопируйте файл poker-assistant.apk на телефон
   (USB, Telegram, Google Drive, AirDrop с Mac на Android и т.д.).
2. Откройте файл «Файлы» / проводник и нажмите на APK.
3. Если система спросит — разрешите установку из неизвестных источников.
4. Готово: приложение работает полностью офлайн, сервер не нужен.

Обновление: установите новый APK поверх старого (данные раздачи сохранятся).

КОМПЬЮТЕР (Windows / Mac / Linux)
---------------------------------
1. Откройте папку web/
2. Дважды нажмите index.html (или перетащите в Chrome / Firefox).
   Работает офлайн, интернет не нужен.

ВАЖНО
-----
В браузере телефона папку web/ открыть нельзя (ограничение Android).
Для телефона используйте только APK.
`;

const args = process.argv.slice(2);
const apkOnly = args.includes('--apk-only');
const skipApkBuild = args.includes('--skip-apk-build');

async function fileExists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function buildApk() {
  const releaseApk = path.join(ROOT, 'app-release.apk');
  const debugApk = path.join(ROOT, 'android/app/build/outputs/apk/debug/app-debug.apk');

  if (skipApkBuild) {
    if (await fileExists(releaseApk)) return releaseApk;
    if (await fileExists(debugApk)) return debugApk;
    console.error('APK не найден. Уберите --skip-apk-build или соберите: npm run android:apk');
    process.exit(1);
  }

  console.log('Синхронизация Android...');
  execSync('npm run build', { cwd: ROOT, stdio: 'inherit' });
  execSync('npx cap sync android', { cwd: ROOT, stdio: 'inherit' });

  const hasKeystore = await fileExists(path.join(ROOT, 'android/keystore.properties'));
  if (hasKeystore) {
    console.log('Сборка release APK...');
    execSync('./gradlew assembleRelease', {
      cwd: path.join(ROOT, 'android'),
      stdio: 'inherit',
    });
    const built = path.join(ROOT, 'android/app/build/outputs/apk/release/app-release.apk');
    await cp(built, releaseApk);
    return built;
  }

  console.log('Сборка debug APK (keystore не найден)...');
  execSync('./gradlew assembleDebug', {
    cwd: path.join(ROOT, 'android'),
    stdio: 'inherit',
  });
  return debugApk;
}

async function main() {
  console.log('Сборка веб-приложения (офлайн file://)...');
  execSync('npm run build:portable-web', { cwd: ROOT, stdio: 'inherit' });

  const apkSrc = await buildApk();

  await rm(PORTABLE, { recursive: true, force: true });
  await mkdir(path.join(PORTABLE, 'web'), { recursive: true });

  await cp(apkSrc, path.join(PORTABLE, 'poker-assistant.apk'));
  await cp(path.join(ROOT, 'dist-portable'), path.join(PORTABLE, 'web'), { recursive: true });
  await writeFile(path.join(PORTABLE, 'README.txt'), README, 'utf8');

  console.log('\nГотово:');
  console.log('  APK:  ', path.join(PORTABLE, 'poker-assistant.apk'));
  console.log('  Web:  ', path.join(PORTABLE, 'web', 'index.html'));
  console.log('  Инструкция:', path.join(PORTABLE, 'README.txt'));

  if (!apkOnly) {
    await rm(ZIP_PATH, { force: true });
    execSync(`zip -rq "${ZIP_PATH}" .`, { cwd: PORTABLE, stdio: 'inherit' });
    console.log('  Архив:', ZIP_PATH);
    console.log('\nПередайте на телефон poker-assistant.apk или весь zip.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
