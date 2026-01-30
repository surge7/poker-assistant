#!/usr/bin/env sh
# Сборка Android APK (debug).
# Использование: ./build-android.sh
# APK будет: apps/app/android/app/build/outputs/apk/debug/app-debug.apk

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$ROOT/apps/app"
ANDROID_DIR="$APP_DIR/android"

echo "Сборка веб-приложения..."
cd "$APP_DIR" && npm run build

echo "Синхронизация с Android..."
cd "$APP_DIR" && npx cap sync android

echo "Сборка APK (debug)..."
cd "$ANDROID_DIR" && ./gradlew assembleDebug

APK="$ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk"
echo ""
echo "Готово. APK: $APK"
