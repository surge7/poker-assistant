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

APK лежит в папке сборки Android:  
`apps/app/android/app/build/outputs/apk/debug/app-debug.apk`  

При сборке через скрипты (`build-android.sh` / `build-android.cmd`) файл дополнительно копируется рядом с кодом приложения:  
`apps/app/app-debug.apk`

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

**Из корня репозитория:**

```bash
./build-android.sh
```

На Windows: `build-android.cmd`

**Из папки приложения (apps/app):**

```bash
cd apps/app
./build-android.sh
```

Либо через npm: `npm run android:apk` (из папки apps/app).

**Где искать APK:**  
- Рядом с кодом приложения (после сборки скриптом): **`apps/app/app-debug.apk`**  
- В папке сборки Android: `apps/app/android/app/build/outputs/apk/debug/app-debug.apk`

---

## Скриншоты 9:16 для стора (RuStore и др.) в Android Studio

RuStore и другие магазины требуют скриншоты **строго 9:16** (например 720×1280, 1080×1920, 1440×2560). Если загрузить кадр с другим соотношением, стор обрежет его и модерация может отклонить. В Android Studio удобно делать скриншоты сразу в 9:16, если эмулятор запущен с таким разрешением.

### 1. Виртуальное устройство с разрешением 1080×1920 (9:16)

1. В Android Studio: **Tools** → **Device Manager**.
2. Нажмите **Create Device**.
3. В списке устройств выберите устройство с разрешением **1080×1920** (9:16):
   - Если есть, например **Pixel 2** (1080×1920) — выберите его → **Next**.
   - Если подходящего нет: нажмите **New Hardware Profile**, задайте **Resolution** ширина **1080**, высота **1920** → **Finish**, затем выберите этот профиль → **Next**.
4. Выберите образ системы (например **API 34**) → **Next** → **Finish**.

### 2. Запустить приложение в этом эмуляторе

1. Вверху выберите созданное устройство (1080×1920).
2. Нажмите **Run** (зелёный треугольник) — приложение откроется в эмуляторе.
3. Перейдите на нужные экраны (главный, карты, результаты и т.д.) — для каждого экрана сделаете отдельный скриншот.

### 3. Сделать скриншот

1. В окне эмулятора справа на панели найдите иконку **камеры** (**Take screenshot**).
2. Либо откройте меню **⋯** (три точки) → **Take screenshot**.
3. Либо нажмите **Ctrl+S** (Windows/Linux) или **Cmd+S** (Mac).
4. В диалоге выберите **Save** и укажите папку (например `store-screenshots-input` в проекте). Имя по умолчанию — `Screenshot_ГГГГММДД-ЧЧММСС.png`.

Разрешение сохранённого файла будет **1080×1920** (9:16) — его можно сразу загружать в RuStore. Если в консоли рекомендуют JPG 1080×1920, положите PNG в папку **store-screenshots-input/** и выполните `npm run store-screenshots` — в **store-screenshots/** появятся JPG 1080×1920.

### 4. Загрузить в RuStore

В консоли разработчика в блоке «Скриншоты приложения для телефона» загрузите **только** эти файлы (1080×1920, 9:16). Не загружайте скриншоты с обычного телефона — у него другое соотношение сторон, стор их обрежет.

Подробнее о требованиях RuStore: [Правила к приложениям](https://help.rustore.ru/rustore/for_developers/publishing_and_verifying_apps/requirement_apps).

---

## Release-сборка для пользователей (Google Play и установка вручную)

Debug-APK подходит для тестов. Для публикации в Google Play и для установки пользователями нужна **подписанная release-сборка**.

### 1. Создать keystore (один раз)

В терминале (например, в папке `apps/app/android`):

```bash
keytool -genkey -v -keystore upload-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias my-key-alias
```

Укажите пароли и данные (ФИО, организация и т.д.). Файл `upload-keystore.jks` и пароли **обязательно сохраните** — без них нельзя будет обновлять приложение в маркете.

### 2. Настроить подпись

В папке `apps/app/android`:

1. Скопируйте пример: `cp keystore.properties.example keystore.properties`
2. Откройте `keystore.properties` и укажите реальные значения:

```properties
storeFile=upload-keystore.jks
storePassword=ваш_пароль_хранилища
keyAlias=my-key-alias
keyPassword=ваш_пароль_ключа
```

Путь `storeFile` — относительно папки `android` (например, просто `upload-keystore.jks`, если файл лежит в `android/`). Файл `keystore.properties` в git не коммитить (он уже в `.gitignore`).

### 3. Собрать release

Из папки приложения:

```bash
cd apps/app
npm run android:release
```

или:

```bash
cd apps/app
./build-android-release.sh
```

Скрипт соберёт веб, синхронизирует с Android и запустит `bundleRelease` и `assembleRelease`.

### 4. Где искать файлы

- **AAB (для Google Play):** `apps/app/app-release.aab` — загружайте в Google Play Console (Release → Production или тестовый трек).
- **APK (для установки вручную):** `apps/app/app-release.apk` — можно раздавать пользователям напрямую (почта, сайт и т.д.).

В Android Studio release можно собрать так: **Build** → **Generate App Bundles or APKs** → **Android App Bundle** или **APK**, выберите **release** и укажите существующий keystore (тот же, что в `keystore.properties`).
