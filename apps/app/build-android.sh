#!/usr/bin/env sh
# Сборка Android APK (debug) из папки приложения.
# Использование: из корня репо — ./apps/app/build-android.sh
#               или из apps/app — ./build-android.sh
# APK: android/app/build/outputs/apk/debug/app-debug.apk

set -e
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
ANDROID_DIR="$APP_DIR/android"

echo "Сборка веб-приложения..."
cd "$APP_DIR" && npm run build

echo "Синхронизация с Android..."
cd "$APP_DIR" && npx cap sync android

echo "Сборка APK (debug)..."
cd "$ANDROID_DIR" && ./gradlew assembleDebug

APK_SRC="$ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk"
APK_DST="$APP_DIR/app-debug.apk"
cp "$APK_SRC" "$APK_DST"
echo ""
echo "Готово. APK скопирован: $APK_DST"
