#!/usr/bin/env sh
# Запуск веб-версии локально (Vite dev server).
# Использование: ./start-web.sh   или   sh start-web.sh
# Откроется http://localhost:5173

cd "$(dirname "$0")/apps/app" && npm run dev
