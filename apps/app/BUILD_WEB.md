# Публикация веб-версии приложения

После сборки приложение — это статические файлы (HTML, JS, CSS). Их можно разместить на любом хостинге статики. Ниже — самые простые и бесплатные варианты.

---

## 1. Собрать веб-версию

Из папки приложения:

```bash
cd apps/app
npm install
npm run build
```

В папке **dist/** появятся файлы для публикации: `index.html` и папка `assets/`. Эту папку **dist/** (или её содержимое) нужно загрузить на хостинг.

---

## 2. Варианты хостинга (бесплатный тариф)

### Вариант A: Netlify (проще всего)

1. Зарегистрируйтесь на [netlify.com](https://www.netlify.com).
2. Перетащите папку **dist** в зону «Drag and drop your site output folder» на [app.netlify.com/drop](https://app.netlify.com/drop).
3. Сайт появится по адресу вида `random-name-123.netlify.app`. В настройках можно задать своё имя и подключить свой домен.

**Через Git (автодеплой при push):**  
Подключите репозиторий в Netlify → в настройках сборки укажите: **Build command** `npm run build`, **Publish directory** `apps/app/dist` (или `dist` если в Netlify открыт только `apps/app`).

---

### Вариант B: Vercel

1. Зарегистрируйтесь на [vercel.com](https://vercel.com).
2. Установите CLI: `npm i -g vercel`.
3. Из папки приложения выполните:
   ```bash
   cd apps/app
   npm run build
   vercel
   ```
4. Следуйте подсказкам (путь к проекту — текущая папка, output — **dist**). Сайт получит адрес вида `poker-assistant-xxx.vercel.app`.

**Через Git:** импортируйте репозиторий в Vercel, укажите **Root Directory** `apps/app`, **Build Command** `npm run build`, **Output Directory** `dist`.

---

### Вариант C: Cloudflare Pages

1. Зарегистрируйтесь на [dash.cloudflare.com](https://dash.cloudflare.com).
2. **Workers & Pages** → **Create** → **Pages** → **Connect to Git** (или **Upload assets**).
3. При подключении Git: выберите репозиторий, **Build command** `npm run build`, **Build output directory** `dist`. При загрузке вручную — загрузите содержимое папки **dist**.
4. Сайт будет по адресу `project-name.pages.dev`.

---

### Вариант D: GitHub Pages

1. Репозиторий на GitHub. В настройках репозитория: **Pages** → Source: **GitHub Actions** (или **Deploy from a branch**).
2. Если сайт будет по адресу `username.github.io/репозиторий/`, в **vite.config.ts** добавьте `base: '/имя-репозитория/'` (со слэшами), затем снова `npm run build`.
3. Для **Deploy from a branch**: выберите ветку (например `main`) и папку **/ (root)** или отдельную папку, куда будете пушить содержимое **dist** (часто используют ветку `gh-pages` или подпапку `docs` с содержимым dist).

**Через GitHub Actions:** создайте workflow, который при push запускает `npm run build` и публикует папку `dist` в GitHub Pages (шаблоны есть в документации GitHub Pages).

---

## 3. Что указать на хостинге

| Параметр           | Значение        |
|--------------------|-----------------|
| Корневая папка     | **dist**        |
| Build command      | `npm run build` |
| Node version       | 18+ (если нужен) |

Приложение одностраничное (SPA), маршрутизации по URL нет — дополнительная настройка (redirects для SPA) не нужна.

---

## 4. Свой домен (опционально)

На Netlify, Vercel и Cloudflare Pages в настройках сайта можно добавить свой домен (например `poker-trainer.example.com`). DNS записи подскажет сам сервис; обычно это CNAME на их адрес.

---

## Кратко

1. **Сборка:** `npm run build` → папка **dist/**.
2. **Хостинг:** загрузить **dist** на Netlify Drop, Vercel, Cloudflare Pages или GitHub Pages.
3. Для автодеплоя при каждом push — подключить Git к Netlify/Vercel/Cloudflare и указать команду сборки и папку **dist**.

После публикации веб-версия будет доступна по выданному URL (и по своему домену, если его подключите).
