/* Авторизация Firebase + локальная эмуляция для демо-режима */
import { isDemoMode, getFirebase } from "./firebase-config.js";
import { ensureUserDoc } from "./db.js";
import { firebaseErrorKk, t } from "./i18n-kk.js";

const DEMO_USERS = "lingo-demo-users";
const DEMO_SESSION = "lingo-demo-session";

function readUsers() {
  try {
    return JSON.parse(localStorage.getItem(DEMO_USERS) || "{}");
  } catch {
    return {};
  }
}

function writeUsers(map) {
  localStorage.setItem(DEMO_USERS, JSON.stringify(map));
}

function demoUserFromRecord(rec) {
  return {
    uid: rec.uid,
    email: rec.email,
    displayName: rec.displayName,
    photoURL: rec.avatar || "🦉",
    isDemo: true,
  };
}

function getDemoSessionUser() {
  const uid = localStorage.getItem(DEMO_SESSION);
  if (!uid) return null;
  const rec = Object.values(readUsers()).find((u) => u.uid === uid);
  return rec ? demoUserFromRecord(rec) : null;
}

export function getCurrentUser() {
  if (isDemoMode) return getDemoSessionUser();
  return window.__lingoAuthUser || null;
}

export function onAuthChange(cb) {
  if (isDemoMode) {
    cb(getDemoSessionUser());
    return () => {};
  }
  let unsub = () => {};
  getFirebase()
    .then(async ({ auth }) => {
      const { onAuthStateChanged } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
      unsub = onAuthStateChanged(auth, (user) => {
        window.__lingoAuthUser = user;
        cb(user);
      });
    })
    .catch((err) => {
      console.warn("auth init", err);
      cb(null);
    });
  return () => unsub();
}

export async function guardPage({ requireAuth = false, guestOnly = false } = {}) {
  return new Promise((resolve) => {
    onAuthChange((user) => {
      if (requireAuth && !user) {
        location.replace("login.html");
        return;
      }
      if (guestOnly && user) {
        location.replace("home.html");
        return;
      }
      resolve(user);
    });
  });
}

export async function registerWithEmail(displayName, email, password) {
  if (isDemoMode) {
    const users = readUsers();
    const key = email.trim().toLowerCase();
    if (users[key]) {
      const err = new Error("email-already-in-use");
      err.code = "auth/email-already-in-use";
      throw err;
    }
    const rec = {
      uid: "demo-" + (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
      email: key,
      password,
      displayName,
      avatar: "🦉",
    };
    users[key] = rec;
    writeUsers(users);
    localStorage.setItem(DEMO_SESSION, rec.uid);
    const user = demoUserFromRecord(rec);
    await ensureUserDoc(user, { displayName });
    return user;
  }
  const { auth } = await getFirebase();
  const { createUserWithEmailAndPassword, updateProfile } = await import(
    "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"
  );
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName });
  await ensureUserDoc(cred.user, { displayName });
  return cred.user;
}

export async function loginWithEmail(email, password) {
  if (isDemoMode) {
    const users = readUsers();
    const rec = users[email.trim().toLowerCase()];
    if (!rec) {
      const err = new Error("user-not-found");
      err.code = "auth/user-not-found";
      throw err;
    }
    if (rec.password !== password) {
      const err = new Error("wrong-password");
      err.code = "auth/wrong-password";
      throw err;
    }
    localStorage.setItem(DEMO_SESSION, rec.uid);
    const user = demoUserFromRecord(rec);
    await ensureUserDoc(user, { displayName: rec.displayName });
    return user;
  }
  const { auth } = await getFirebase();
  const { signInWithEmailAndPassword } = await import(
    "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"
  );
  const cred = await signInWithEmailAndPassword(auth, email, password);
  await ensureUserDoc(cred.user);
  return cred.user;
}

export async function loginWithGoogle() {
  if (isDemoMode) {
    const key = "google-demo@lingo.kz";
    const users = readUsers();
    if (!users[key]) {
      users[key] = {
        uid: "demo-google",
        email: key,
        password: "",
        displayName: "Google Demo",
        avatar: "🌈",
      };
      writeUsers(users);
    }
    localStorage.setItem(DEMO_SESSION, users[key].uid);
    const user = demoUserFromRecord(users[key]);
    await ensureUserDoc(user, { displayName: users[key].displayName, avatar: "🌈" });
    return user;
  }
  const { auth } = await getFirebase();
  const { GoogleAuthProvider, signInWithPopup } = await import(
    "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"
  );
  const cred = await signInWithPopup(auth, new GoogleAuthProvider());
  await ensureUserDoc(cred.user, { displayName: cred.user.displayName || t.hello });
  return cred.user;
}

export async function resetPassword(email) {
  if (isDemoMode) {
    const users = readUsers();
    if (!users[email.trim().toLowerCase()]) {
      const err = new Error("user-not-found");
      err.code = "auth/user-not-found";
      throw err;
    }
    return true;
  }
  const { auth } = await getFirebase();
  const { sendPasswordResetEmail } = await import(
    "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"
  );
  await sendPasswordResetEmail(auth, email);
  return true;
}

export async function logout() {
  if (isDemoMode) {
    localStorage.removeItem(DEMO_SESSION);
    location.href = "index.html";
    return;
  }
  const { auth } = await getFirebase();
  const { signOut } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
  await signOut(auth);
  location.href = "index.html";
}

export { firebaseErrorKk };
