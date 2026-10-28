# Как подключить Firebase (5 шагов)

После этого регистрация и таблица лидеров будут работать с любого устройства.

## 1. Создать проект
1. Откройте https://console.firebase.google.com → **Add project** → название (например `lingo-kz`) → Create.

## 2. Получить ключи и вставить в код
1. В проекте: **⚙ Project settings → General → Your apps → значок `</>` (Web)**.
2. Придумайте имя приложения → **Register app**.
3. Появится блок `const firebaseConfig = { apiKey: "...", authDomain: "...", ... }`.
4. Откройте файл **`js/firebase-config.js`** и замените все значения `YOUR_...` на свои:

```js
export const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "lingo-kz.firebaseapp.com",
  projectId: "lingo-kz",
  storageBucket: "lingo-kz.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef",
};
```
Когда `YOUR_` исчезнет, чёрный баннер «демо-режим» пропадёт — значит, Firebase подключён.
(Web-ключ Firebase не секретный, его можно держать в коде; защита — это правила из шага 4.)

## 3. Включить вход
**Build → Authentication → Get started → Sign-in method**: включите **Email/Password** (и **Google**, если нужен вход через Google).

## 4. Создать базу и правила
1. **Build → Firestore Database → Create database** → регион (например `eur3`) → **Production mode**.
2. Вкладка **Rules** → удалите всё → вставьте содержимое файла **`firestore.rules`** → **Publish**.

## 5. Выложить сайт в интернет (чтобы заходили с других устройств)
Через `127.0.0.1` сайт виден только вам. Варианты:

**Firebase Hosting** (проще всего, всё в одном месте):
```bash
npm install -g firebase-tools
firebase login
firebase init hosting   # Use existing project → выберите свой; public directory: .  ; single-page app: No ; не перезаписывайте файлы
firebase deploy
```
Получите адрес вида `https://lingo-kz.web.app`.

**Netlify**: перетащите папку проекта на https://app.netlify.com/drop.

После деплоя добавьте домен в **Authentication → Settings → Authorized domains**
(`xxx.web.app` / `xxx.netlify.app`), иначе вход через Google не сработает. `localhost` и `127.0.0.1` там уже есть.

## Если что-то не работает
- Откройте DevTools (F12) → Console.
- `Missing or insufficient permissions` → не опубликованы правила (шаг 4).
- `auth/operation-not-allowed` → не включён способ входа (шаг 3).
- `auth/unauthorized-domain` → домен не добавлен в Authorized domains (шаг 5).
- Баннер «демо-режим» остался → в `firebase-config.js` ещё есть `YOUR_`.
