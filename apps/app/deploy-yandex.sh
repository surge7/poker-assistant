#!/usr/bin/env bash
set -e

# Загружаем переменные из .env.yandex, если файл есть
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/.env.yandex" ]; then
  set -a
  # shellcheck source=/dev/null
  source "$SCRIPT_DIR/.env.yandex"
  set +a
fi

BUCKET="${YANDEX_BUCKET:-$1}"
if [ -z "$BUCKET" ]; then
  echo "Укажите имя бакета: YANDEX_BUCKET=имя ./deploy-yandex.sh  или  ./deploy-yandex.sh имя-бакета"
  exit 1
fi

cd "$SCRIPT_DIR"
echo "Сборка..."
npm run build
echo "Загрузка в s3://$BUCKET (Yandex Object Storage)..."
aws s3 sync dist/ "s3://$BUCKET" --endpoint-url https://storage.yandexcloud.net --delete
echo "Готово. Сайт: https://$BUCKET.website.yandexcloud.net"
