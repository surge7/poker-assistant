#!/usr/bin/env sh
# Сборка Android для пользователей: AAB (Google Play) и APK (установка вручную).
# Требуется: android/keystore.properties и keystore (см. BUILD_ANDROID.md).
# Использование: из apps/app — ./build-android-release.sh

set -e
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
ANDROID_DIR="$APP_DIR/android"

if [ ! -f "$ANDROID_DIR/keystore.properties" ]; then
  echo "Ошибка: не найден $ANDROID_DIR/keystore.properties"
  echo "Скопируйте keystore.properties.example в keystore.properties и укажите путь к keystore и пароли."
  echo "Подробнее: BUILD_ANDROID.md, раздел «Release-сборка»."
  exit 1
fi

# Проверка синхронизации версий: package.json vs AndroidManifest (build.gradle).
# Отлавливает рассинхрон versionName/versionCode до релиза.
PKG_VERSION=$(node -p "require('$APP_DIR/package.json').version")
GRADLE_VERSION=$(grep 'versionName' "$ANDROID_DIR/app/build.gradle" | head -1 | sed 's/.*versionName *"\([^"]*\)".*/\1/')
if [ "$PKG_VERSION" != "$GRADLE_VERSION" ]; then
  echo "Ошибка: версии рассинхронизированы."
  echo "  package.json: $PKG_VERSION"
  echo "  build.gradle versionName: $GRADLE_VERSION"
  echo "Обновите обе до одного значения перед релизом."
  exit 1
fi
echo "Версия $PKG_VERSION — синхронизирована."

echo "Сборка веб-приложения..."
cd "$APP_DIR" && npm run build

echo "Синхронизация с Android..."
cd "$APP_DIR" && npx cap sync android

echo "Сборка release (AAB + APK)..."
cd "$ANDROID_DIR" && ./gradlew bundleRelease assembleRelease

AAB_SRC="$ANDROID_DIR/app/build/outputs/bundle/release/app-release.aab"
APK_SRC="$ANDROID_DIR/app/build/outputs/apk/release/app-release.apk"
AAB_DST="$APP_DIR/app-release.aab"
APK_DST="$APP_DIR/app-release.apk"

cp "$AAB_SRC" "$AAB_DST"
cp "$APK_SRC" "$APK_DST"
echo ""
echo "Готово."
echo "  AAB (для Google Play): $AAB_DST"
echo "  APK (для установки вручную): $APK_DST"
