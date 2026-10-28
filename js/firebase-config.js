/* ============================================================================
   FIREBASE — СЮДА ВСТАВЛЯТЬ КЛЮЧИ
   ----------------------------------------------------------------------------
   Firebase Console → ⚙ Project settings → General → Your apps → Web app (</>)
   → блок "SDK setup and configuration" → "Config".
   Скопируйте значения и замените строки "YOUR_..." ниже. Подробно: FIREBASE_SETUP.md

   Пока в apiKey / projectId стоит "YOUR_...", сайт работает в ДЕМО-режиме
   (данные в localStorage браузера, регистрация только на этом компьютере).
   ============================================================================ */

const firebaseConfig = {
  apiKey: "AIzaSyA_cuoB0mGei6hHX_gkiNq4pSXqg2kOGgM",
  authDomain: "balym-cours.firebaseapp.com",
  projectId: "balym-cours",
  storageBucket: "balym-cours.firebasestorage.app",
  messagingSenderId: "698175997496",
  appId: "1:698175997496:web:178c7e21711db82c7148cd",
  measurementId: "G-3GNNLLJPXY"
};

/** Включить при локальном firebase emulator (docker compose --profile emulator). */
export const USE_EMULATOR = false;

export const isDemoMode = /YOUR_/i.test(firebaseConfig.apiKey) || /YOUR_/i.test(firebaseConfig.projectId);

const SDK = "https://www.gstatic.com/firebasejs/10.12.2";
let cached = null;

export async function getFirebase() {
  if (isDemoMode) return { app: null, auth: null, db: null };
  if (!cached) {
    cached = (async () => {
      /* три модуля грузим параллельно */
      const [appMod, authMod, fsMod] = await Promise.all([
        import(`${SDK}/firebase-app.js`),
        import(`${SDK}/firebase-auth.js`),
        import(`${SDK}/firebase-firestore.js`),
      ]);
      const app = appMod.initializeApp(firebaseConfig);
      const auth = authMod.getAuth(app);
      const db = fsMod.getFirestore(app);
      if (USE_EMULATOR && (location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
        authMod.connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
        fsMod.connectFirestoreEmulator(db, "127.0.0.1", 8081);
      }
      return { app, auth, db };
    })();
  }
  return cached;
}
