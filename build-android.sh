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

APK_SRC="$ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk"
APK_DST="$APP_DIR/app-debug.apk"
cp "$APK_SRC" "$APK_DST"
echo ""
echo "Готово. APK скопирован: $APK_DST"

# --- авто-заливка на Яндекс.Диск (если настроено) ------------------------
if [[ -f "$ROOT/.env.yandex" ]]; then
  echo ""
  echo "Заливаю APK на Яндекс.Диск..."
  if ! bash "$ROOT/scripts/upload-yadisk.sh" "$APK_DST"; then
    echo "⚠ Заливка APK не удалась (см. выше). Локальный APK на месте." >&2
  fi

  # --- single-HTML (portable) тоже в ту же папку -------------------------
  echo ""
  echo "Сборка single-HTML (portable)..."
  if (cd "$APP_DIR" && npm run build:single-html) && [[ -f "$APP_DIR/poker-assistant.html" ]]; then
    echo ""
    echo "Заливаю single-HTML на Яндекс.Диск..."
    if ! bash "$ROOT/scripts/upload-yadisk.sh" "$APP_DIR/poker-assistant.html"; then
      echo "⚠ Заливка single-HTML не удалась. Локальный файл на месте." >&2
    fi
  else
    echo "⚠ Сборка single-HTML не удалась — пропускаю заливку." >&2
  fi
else
  echo ""
  echo "(.env.yandex не найден — заливка на Яндекс.Диск пропущена."
echo "  Чтобы включить: cp .env.yandex.example .env.yandex, заполни токен и YADISK_FOLDER.)"
fi
