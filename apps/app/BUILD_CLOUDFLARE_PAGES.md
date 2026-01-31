# Cloudflare Pages: пошаговая настройка и публикация веб-приложения

Два способа: **загрузка папки вручную** (без Git) или **подключение Git** (автодеплой при каждом push).

---

## Шаг 0. Аккаунт Cloudflare

1. Откройте [dash.cloudflare.com](https://dash.cloudflare.com).
2. Нажмите **Sign up** (или **Log in**, если уже есть аккаунт).
3. Введите email и пароль, подтвердите почту при необходимости. Регистрация бесплатная, карта не нужна для Pages.

---

## Способ 1: Загрузка папки вручную (без Git)

Подходит, если репозиторий не на GitHub/GitLab или хотите выложить сайт один раз без автодеплоя.

### Шаг 1.1. Собрать приложение локально

В терминале (из корня репозитория **poker-assistant**):

```bash
cd apps/app
npm install
npm run build
```

Либо из корня репо:

```bash
npm install
npm run build:app
```

В папке **apps/app/dist/** появятся файлы: `index.html` и папка `assets/`. Это и есть готовый сайт.

### Шаг 1.2. Создать сайт в Cloudflare Pages (Upload)

1. В [dash.cloudflare.com](https://dash.cloudflare.com) в левом меню выберите **Workers & Pages**.
2. Нажмите **Create** → **Pages** → **Connect to Git**.
3. Вверху переключитесь на вкладку **Upload assets** (или нажмите **Create a project** и выберите **Direct Upload**).
4. В поле **Project name** введите, например: `poker-trainer`.
5. Нажмите **Upload** (или перетащите папку).
6. Выберите **всё содержимое** папки **apps/app/dist/** (не саму папку `dist`, а то, что внутри: файл `index.html` и папка `assets`). Можно выделить все файлы и папки внутри `dist` и перетащить в окно браузера, либо заархивировать содержимое `dist` в один ZIP и загрузить ZIP — Cloudflare распакует его.
7. Нажмите **Deploy site**.

Через минуту сайт будет доступен по адресу вида **https://poker-trainer.pages.dev** (имя зависит от введённого Project name).

### Обновление сайта (ручная загрузка)

После изменений в коде снова выполните `npm run build` (в `apps/app` или `npm run build:app` из корня), затем в Cloudflare Pages: **Workers & Pages** → ваш проект → **Create deployment** → снова загрузите содержимое **apps/app/dist/**.

---

## Способ 2: Подключение Git (автодеплой при push)

Подходит, если репозиторий уже на **GitHub** или **GitLab**. При каждом push в выбранную ветку Cloudflare сам соберёт проект и обновит сайт.

### Шаг 2.1. Репозиторий на GitHub

Убедитесь, что проект **poker-assistant** залит в GitHub (или GitLab). Если нет — создайте репозиторий на GitHub и выполните:

```bash
cd /путь/к/poker-assistant
git remote add origin https://github.com/ВАШ_ЛОГИН/poker-assistant.git
git push -u origin main
```

(подставьте свой URL репозитория и ветку, например `main`).

### Шаг 2.2. Подключить репозиторий к Cloudflare Pages

1. В [dash.cloudflare.com](https://dash.cloudflare.com) откройте **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Выберите **GitHub** (или GitLab), при необходимости разрешите доступ Cloudflare к аккаунту и репозиториям.
3. В списке репозиториев выберите **poker-assistant** (или как он называется у вас).
4. Нажмите **Begin setup**.

### Шаг 2.3. Настройки сборки (Build configuration)

На экране **Set up builds and deployments** укажите:

| Поле | Значение |
|------|----------|
| **Production branch** | `main` (или ваша основная ветка) |
| **Build command** | `npm ci && npm run build:app` |
| **Build output directory** | `apps/app/dist` |

- **Framework preset** можно оставить **None** или выбрать **Vite** (если есть в списке; настройки выше важнее).
- **Root directory** оставьте пустым (сборка идёт из корня репозитория).
- Переменные окружения (Environment variables) для этого проекта не обязательны.

Если в корне репо нет скрипта `build:app`, используйте в **Build command**:

```bash
npm ci && cd apps/app && npm run build
```

**Build output directory** тогда по-прежнему: **apps/app/dist**.

### Шаг 2.4. Запуск первого деплоя

1. Нажмите **Save and Deploy** (или **Deploy site**).
2. Дождитесь окончания сборки (обычно 1–3 минуты). В логе должны быть шаги `npm ci`, сборка приложения и публикация папки `apps/app/dist`.
3. После успешного деплоя сайт откроется по адресу вида **https://poker-assistant.pages.dev** (имя проекта можно изменить в настройках).

### Дальнейшие обновления

При каждом **push** в ветку **main** (или выбранную Production branch) Cloudflare автоматически запустит сборку и обновит сайт. Заходить в панель и загружать файлы вручную не нужно.

---

## Шаг 3. Имя проекта и свой домен (по желанию)

1. В **Workers & Pages** откройте ваш проект.
2. Вкладка **Custom domains** — нажмите **Set up a custom domain** и введите свой домен (например `poker.example.com`). Cloudflare подскажет, какую DNS-запись создать.
3. Имя поддомена **\*.pages.dev** можно изменить в **Settings** → **Project name** (при первом создании или позже, если сервис разрешает).

---

## Краткая шпаргалка

**Ручная загрузка (без Git):**

1. `cd apps/app && npm run build` (или из корня: `npm run build:app`).
2. Cloudflare: **Workers & Pages** → **Create** → **Pages** → **Upload assets**.
3. Имя проекта → загрузить **содержимое** папки **apps/app/dist/** → **Deploy site**.

**Через Git:**

1. Репо на GitHub/GitLab.
2. Cloudflare: **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → выбрать репо.
3. **Build command:** `npm ci && npm run build:app`  
   **Build output directory:** `apps/app/dist`  
   **Save and Deploy**.

После первого успешного деплоя ссылка на сайт будет в панели проекта (например **https://poker-trainer.pages.dev**).
