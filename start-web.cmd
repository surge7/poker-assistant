@echo off
REM Запуск веб-версии локально (Vite dev server).
REM Использование: start-web.cmd
REM Откроется http://localhost:5173

cd /d "%~dp0apps\app"
npm run dev
pause
