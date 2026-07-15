#!/usr/bin/env bash
# Заливает APK-файл на Яндекс.Диск в папку приложения (sandbox).
#
# Использование:
#   ./scripts/upload-yadisk.sh <apk-file>
#
# Конфиг берётся из .env.yandex в корне проекта (см. .env.yandex.example).
#   YADISK_TOKEN   — OAuth-токен (https://oauth.yandex.ru)
#   YADISK_FOLDER  — путь внутри app:/, например poker-assistant/test-builds
#                    (без ведущего слэша). В самом Диске это будет раздел
#                    "Приложения" → <имя приложения> → <YADISK_FOLDER>.
#
# Требуемые OAuth-scopes: cloud_api:disk.app_folder, cloud_api:disk.info
# (минимально достаточно для загрузки файлов внутри песочницы приложения).
#
# Имя файла на Диске формируется автоматически:
#   poker-assistant_<branch>_<short-sha>_<version>_<YYYYMMDD-HHMMSS>.apk
# (с timestamp'ом в локальной TZ, чтобы легко сортировать).

set -euo pipefail

# --- аргументы -------------------------------------------------------------
if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <apk-file>" >&2
  exit 2
fi
APK_SRC="$1"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env.yandex"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "✗ Не найден $ENV_FILE. Создай по образцу .env.yandex.example." >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

: "${YADISK_TOKEN:?YADISK_TOKEN не задан в $ENV_FILE}"
: "${YADISK_FOLDER:?YADISK_FOLDER не задан в $ENV_FILE}"

if [[ ! -f "$APK_SRC" ]]; then
  echo "✗ Файл не найден: $APK_SRC" >&2
  exit 1
fi

# --- метаданные ------------------------------------------------------------
cd "$ROOT"

# Версия из package.json ближайшего workspace (apps/app/package.json).
VERSION=""
if [[ -f "apps/app/package.json" ]]; then
  VERSION="$(node -p "require('./apps/app/package.json').version" 2>/dev/null || true)"
fi
[[ -z "$VERSION" ]] && VERSION="0.0.0"

BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null | tr '/.' '__' || echo "nobranch")"
SHORT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo "nosha")"
TS="$(date +%Y%m%d-%H%M%S)"

APK_NAME="poker-assistant_${BRANCH}_${SHORT_SHA}_v${VERSION}_${TS}.apk"
APK_SIZE_BYTES="$(wc -c <"$APK_SRC" | tr -d ' ')"
APK_SIZE_MB="$(awk -v b="$APK_SIZE_BYTES" 'BEGIN{printf "%.1f", b/1024/1024}')"

DEST_PATH="app:/${YADISK_FOLDER#/}"
DEST_PATH="${DEST_PATH%/}/${APK_NAME}"

echo "→ Заливаю на Яндекс.Диск"
echo "    Из:    $APK_SRC ($APK_SIZE_MB MiB)"
echo "    В:     $DEST_PATH"

# --- 1. создать папку назначения (идемпотентно) ----------------------------
# YADISK_FOLDER хранится без префикса app:/. Перед запросом добавляем.
PARENT_DIR="app:/${YADISK_FOLDER#/}"
PARENT_DIR="${PARENT_DIR%/}"

mkdir_response="$(curl -sS -X PUT \
  -H "Authorization: OAuth $YADISK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"path":"'"$PARENT_DIR"'"}' \
  "https://cloud-api.yandex.net/v1/disk/resources?path=$(printf '%s' "$PARENT_DIR" | jq -sRr @uri)")"

mkdir_code="$(printf '%s' "$mkdir_response" | jq -r '.error // "ok"' 2>/dev/null || echo "ok")"
# 409 = "already exists" — это норм.
case "$mkdir_code" in
  ok|"") echo "    ✓ Папка готова: $PARENT_DIR" ;;
  *) echo "    ⚠ Создание папки: $mkdir_code (продолжаю)" ;;
esac

# --- 2. получить URL для загрузки ------------------------------------------
upload_meta="$(curl -sS -X GET \
  -H "Authorization: OAuth $YADISK_TOKEN" \
  "https://cloud-api.yandex.net/v1/disk/resources/upload?path=$(printf '%s' "$DEST_PATH" | jq -sRr @uri)&overwrite=true")"

upload_href="$(printf '%s' "$upload_meta" | jq -r '.href // empty')"
if [[ -z "$upload_href" ]]; then
  echo "✗ Не удалось получить upload URL. Ответ API:" >&2
  printf '%s\n' "$upload_meta" >&2
  exit 1
fi

# --- 3. залить файл --------------------------------------------------------
http_code="$(curl -sS -o /dev/null -w '%{http_code}' \
  -X PUT \
  -H "Content-Type: application/vnd.android.package-archive" \
  --data-binary "@$APK_SRC" \
  "$upload_href")"

if [[ "$http_code" != "201" && "$http_code" != "200" ]]; then
  echo "✗ Загрузка не удалась (HTTP $http_code)" >&2
  exit 1
fi

# --- 4. финал -------------------------------------------------------------
echo "    ✓ Залито: $DEST_PATH"
echo "    В Диске: раздел \"Приложения\" → папка приложения → $YADISK_FOLDER"
