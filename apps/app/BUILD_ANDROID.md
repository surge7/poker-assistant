# Сборка APK для Android — вариант 1 (Android Studio)

---

## Проверить приложение без телефона и без APK (эмулятор)

Можно запускать приложение в **эмуляторе Android** в Android Studio — APK не нужен, телефон не нужен.

### 1. Установить Android Studio

Скачайте и установите: [developer.android.com/studio](https://developer.android.com/studio). При первом запуске дождитесь установки SDK.

### 2. Создать виртуальное устройство (один раз)

1. В Android Studio: **Tools** → **Device Manager** (или иконка телефона с зелёным треугольником вверху справа).
2. Нажмите **Create Device**.
3. Выберите устройство (например **Pixel 6**) → **Next**.
4. Выберите образ системы (например **API 34**, **Tiramisu**) — при необходимости нажмите **Download** рядом с образом → **Next**.
5. Имя оставьте или измените → **Finish**.

### 3. Открыть проект и запустить в эмуляторе

В терминале:

```bash
cd /Users/gpbu25522/Projects/poker-assistant/apps/app
npx cap open android
```

В Android Studio:

1. Дождитесь синхронизации Gradle (если спросят — согласитесь).
2. Вверху выберите ваше виртуальное устройство в списке устройств (или нажмите на него в Device Manager, чтобы запустить эмулятор).
3. Нажмите **Run** (зелёный треугольник) или **Run → Run 'app'** (Shift+F10).

Приложение соберётся и установится в эмулятор, откроется на экране эмулятора. APK никуда копировать не нужно.

**Если меняли веб-код** — перед запуском в эмуляторе выполните:

```bash
cd /Users/gpbu25522/Projects/poker-assistant/apps/app
npm run build
npx cap sync android
```

затем в Android Studio снова **Run → Run 'app'**.

---

## Сборка APK для установки на телефон

## Шаг 1. Установить Android Studio

1. Скачайте: [developer.android.com/studio](https://developer.android.com/studio)
2. Установите (Java и Android SDK ставятся вместе с IDE)
3. При первом запуске пройдите мастер настройки и дождитесь загрузки SDK

## Шаг 2. Открыть проект в Android Studio

В терминале выполните:

```bash
cd /Users/gpbu25522/Projects/poker-assistant/apps/app
npx cap open android
```

Откроется Android Studio с проектом **android**.  
(Если попросит обновить Gradle/плагины — согласитесь и дождитесь синхронизации.)

## Шаг 3. Собрать APK

В Android Studio:

1. Меню **Build** → **Generate App Bundles or APKs** → **Generate APKs**
2. Дождитесь окончания сборки (внизу появится уведомление)
3. В уведомлении нажмите **locate** — откроется папка с APK

Либо APK лежит здесь:  
`apps/app/android/app/build/outputs/apk/debug/app-debug.apk`

## Шаг 4. Установить на телефон

**Способ А — файл APK**

- Скопируйте `app-debug.apk` на телефон (почта, облако, USB)
- На телефоне откройте файл и нажмите «Установить»
- Если система спросит — разрешите установку из неизвестных источников для выбранного приложения/источника

**Способ Б — по USB**

- Подключите телефон по USB
- На телефоне: **Настройки → О телефоне** — 7 раз нажмите «Номер сборки», затем **Настройки → Для разработчиков** — включите **Отладка по USB**
- В Android Studio: **Run** → **Run 'app'** — выберите устройство

---

## Если меняли веб-приложение

Перед сборкой заново соберите веб и синхронизируйте:

```bash
cd /Users/gpbu25522/Projects/poker-assistant/apps/app
npm run build
npx cap sync android
```

После этого в Android Studio снова **Build → Generate App Bundles or APKs → Generate APKs**.

---

## Альтернатива: сборка из терминала (вариант 2)

Если Android Studio уже установлена и нужен APK одной командой:

```bash
cd /Users/gpbu25522/Projects/poker-assistant/apps/app
npm run android:apk
```

APK: `android/app/build/outputs/apk/debug/app-debug.apk`
