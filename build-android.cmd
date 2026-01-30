@echo off
REM Сборка Android APK (debug).
REM Использование: build-android.cmd
REM APK будет: apps\app\android\app\build\outputs\apk\debug\app-debug.apk

cd /d "%~dp0apps\app"
call npm run build
if errorlevel 1 exit /b 1

call npx cap sync android
if errorlevel 1 exit /b 1

cd android
call gradlew.bat assembleDebug
if errorlevel 1 exit /b 1

echo.
echo Готово. APK: %~dp0apps\app\android\app\build\outputs\apk\debug\app-debug.apk
