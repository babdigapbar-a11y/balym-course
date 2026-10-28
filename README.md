# Lingo KZ — шет тіліндегі сөздерді үйренуге арналған қосымша

Статический сайт (HTML/CSS/JS) с Firebase Authentication и Cloud Firestore. Интерфейс полностью на казахском языке. Пока в `js/firebase-config.js` стоят плейсхолдеры `YOUR_API_KEY`, работает **демо-режим** (localStorage).

## 1) Локальный запуск

ES Modules не работают через `file://` — нужен статический сервер.

**Docker**

```bash
cd lingo-kz
docker compose up --build
```

Откройте http://localhost:8080

Эмулятор Firebase (по желанию):

```bash
docker compose --profile emulator up --build
```

Auth: 9099, Firestore: 8081, UI: 4000. В `js/firebase-config.js` поставьте `USE_EMULATOR = true` и реальный `projectId` демо-проекта.

**Без Docker**

```bash
npx serve .
# или
python3 -m http.server 8080
```

## 2) Настройка Firebase

1. Создайте проект в [Firebase Console](https://console.firebase.google.com/).
2. Добавьте Web App и скопируйте `firebaseConfig` в `js/firebase-config.js` (замените `YOUR_API_KEY` и остальные поля).
3. Authentication → Sign-in method: включите **Email/Password** и **Google**.
4. Firestore Database → создать базу в режиме **production**.
5. Вставьте содержимое `firestore.rules` и нажмите **Publish**. Индексы — из `firestore.indexes.json` (или `firebase deploy --only firestore`).

После подстановки настоящего конфига демо-баннер исчезнет, данные пойдут в Firebase.

## 3) GitHub

```bash
cd lingo-kz
git init
git add .
git commit -m "Initial Lingo KZ app"
git branch -M main
git remote add origin https://github.com/USER/REPO.git
git push -u origin main
```

## 4) Netlify

1. Site configuration → Import from Git.
2. Publish directory: `.`
3. Build command: пусто.
4. Деплой автоматический при push в `main`.

Файл `netlify.toml` задаёт заголовки безопасности, кеш статики и страницу 404.

## 5) Авторизованный домен

Firebase → Authentication → Settings → **Authorized domains** → добавьте `xxx.netlify.app` (и кастомный домен, если есть). Иначе Google-вход вернёт `auth/unauthorized-domain`.

## 6) Troubleshooting

- **auth/unauthorized-domain** — добавьте домен в Authorized domains.
- **Missing or insufficient permissions** — опубликуйте `firestore.rules`, убедитесь что пользователь авторизован.
- **Белый экран** — откройте DevTools → Console; чаще всего `file://` или неверный путь к модулю.
- **CORS** — открывайте сайт только через http(s), не как файл.
- **ES Modules с file://** — используйте Docker или любой статический сервер.
- **Google popup-closed-by-user** — не закрывайте окно входа до завершения.

Слова хранятся локально в `js/data/words.js`; в Firestore пишется только прогресс пользователей.

**Быстрая инструкция по ключам Firebase — в файле `FIREBASE_SETUP.md`.**
