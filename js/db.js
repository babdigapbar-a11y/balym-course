/* Firestore и локальное хранилище прогресса (демо-режим) */
import { isDemoMode, getFirebase } from "./firebase-config.js";

const FS_URL = "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
let fsMod = null;

async function fsApi() {
  const { db } = await getFirebase();
  if (!fsMod) fsMod = await import(FS_URL);
  return { db, ...fsMod };
}

const AVATARS = ["🦉", "🦊", "🐼", "🐧", "🐯", "🐸", "🦄", "🐨", "🐰", "🐻", "🌸", "🌈"];

export { AVATARS };

export function weekKey(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${week}`;
}

/** Локальная дата YYYY-MM-DD (не UTC — иначе ночью в Казахстане «сегодня» считается вчерашним днём). */
export function todayKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function isYesterday(key) {
  if (!key) return false;
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return todayKey(y) === key;
}

export function defaultUser(user, extra = {}) {
  /* email намеренно НЕ сохраняем в Firestore: коллекция users читается всеми для таблицы лидеров */
  return {
    displayName: extra.displayName || user.displayName || "Оқушы",
    avatar: extra.avatar || "🦉",
    createdAt: extra.createdAt || new Date().toISOString(),
    points: 0,
    weeklyPoints: 0,
    weekKey: weekKey(),
    streak: 0,
    lastActiveDate: "",
    hearts: 5,
    currentLanguage: "en",
    learnedWords: 0,
    completedLessons: 0,
    accuracy: 0,
    totalAnswers: 0,
    correctAnswers: 0,
    dailyRewardClaimedDate: "",
    lastLessonDate: "",
    achievements: [],
  };
}

function demoKey(uid) {
  return `lingo-user-${uid}`;
}

function readDemo(uid) {
  try {
    return JSON.parse(localStorage.getItem(demoKey(uid)) || "null");
  } catch {
    return null;
  }
}

function writeDemo(uid, data) {
  localStorage.setItem(demoKey(uid), JSON.stringify(data));
}

export function normalizeUser(data) {
  const u = { ...data };
  if (u.weekKey !== weekKey()) {
    u.weeklyPoints = 0;
    u.weekKey = weekKey();
  }
  if (u.lastActiveDate !== todayKey()) {
    u.hearts = 5;
  }
  return u;
}

export async function ensureUserDoc(user, extra = {}) {
  if (!user) return null;
  try {
    if (isDemoMode) {
      const existing = readDemo(user.uid);
      if (existing) return normalizeUser(existing);
      const created = defaultUser(user, extra);
      writeDemo(user.uid, created);
      return created;
    }
    const { db, doc, getDoc, setDoc, serverTimestamp } = await fsApi();
    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const created = defaultUser(user, extra);
      await setDoc(ref, { ...created, createdAt: serverTimestamp() });
      return created;
    }
    return normalizeUser(snap.data());
  } catch (err) {
    console.warn("ensureUserDoc", err);
    throw err;
  }
}

export async function getUserProfile(uid) {
  try {
    if (isDemoMode) return normalizeUser(readDemo(uid) || defaultUser({ uid }));
    const { db, doc, getDoc } = await fsApi();
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) {
      /* аккаунт есть, а документа нет (например, правила были не опубликованы при регистрации) — создаём */
      const { auth } = await getFirebase();
      return ensureUserDoc(auth.currentUser || { uid });
    }
    return normalizeUser(snap.data());
  } catch (err) {
    console.warn("getUserProfile", err);
    throw err;
  }
}

/** base — уже известный профиль: если передан, лишнее чтение из Firestore не делаем (быстрее). */
export async function updateUserProfile(uid, patch, base) {
  try {
    if (isDemoMode) {
      const cur = normalizeUser(readDemo(uid) || defaultUser({ uid }));
      const next = { ...cur, ...patch };
      writeDemo(uid, next);
      return next;
    }
    const { db, doc, getDoc, updateDoc } = await fsApi();
    const ref = doc(db, "users", uid);
    await updateDoc(ref, patch);
    if (base) return normalizeUser({ ...base, ...patch });
    const snap = await getDoc(ref);
    return normalizeUser(snap.data());
  } catch (err) {
    console.warn("updateUserProfile", err);
    throw err;
  }
}

export function applyLessonToUser(profile, { correct, total, earned, perfect, lang, lessonId }) {
  const today = todayKey();
  let streak = profile.streak || 0;
  if (profile.lastActiveDate === today) {
    /* серия уже учтена сегодня */
  } else if (isYesterday(profile.lastActiveDate)) {
    streak += 1;
  } else {
    streak = 1;
  }
  const totalAnswers = (profile.totalAnswers || 0) + total;
  const correctAnswers = (profile.correctAnswers || 0) + correct;
  const accuracy = totalAnswers ? Math.round((correctAnswers / totalAnswers) * 100) : 0;
  const achievements = new Set(profile.achievements || []);
  const completed = (profile.completedLessons || 0) + 1;
  if (completed >= 1) achievements.add("first_step");
  if (streak >= 7) achievements.add("week_streak");
  if ((profile.learnedWords || 0) + correct >= 100) achievements.add("hundred_words");
  if (perfect) achievements.add("perfect_lesson");
  return {
    ...profile,
    points: (profile.points || 0) + earned,
    weeklyPoints: (profile.weeklyPoints || 0) + earned,
    weekKey: weekKey(),
    streak,
    lastActiveDate: today,
    lastLessonDate: today,
    completedLessons: completed,
    learnedWords: (profile.learnedWords || 0) + correct,
    totalAnswers,
    correctAnswers,
    accuracy,
    achievements: [...achievements],
    currentLanguage: lang || profile.currentLanguage,
    lastLessonId: lessonId,
  };
}

export async function saveLessonResult(uid, payload) {
  const profile = await getUserProfile(uid);
  const next = applyLessonToUser(profile, payload);
  const delta = next.points - (profile.points || 0);
  if (delta > 200) next.points = (profile.points || 0) + 200;
  /* всё пишем параллельно — урок сохраняется за один «раунд» запросов */
  await Promise.all([
    updateUserProfile(uid, next, profile),
    saveCourseProgress(uid, payload.lang, payload.lessonId),
    saveWordsBatch(uid, payload.correctWords || [], payload.wrongWords || []),
  ]);
  return next;
}

function progressKey(uid, courseId) {
  return `lingo-progress-${uid}-${courseId}`;
}

export async function getCourseProgress(uid, courseId) {
  try {
    if (isDemoMode) {
      return (
        JSON.parse(localStorage.getItem(progressKey(uid, courseId)) || "null") || {
          completedLessonIds: [],
          currentLessonId: `${courseId}-l1`,
          percent: 0,
        }
      );
    }
    const { db, doc, getDoc } = await fsApi();
    const snap = await getDoc(doc(db, "users", uid, "progress", courseId));
    if (!snap.exists()) {
      return { completedLessonIds: [], currentLessonId: `${courseId}-l1`, percent: 0 };
    }
    return snap.data();
  } catch (err) {
    console.warn("getCourseProgress", err);
    throw err;
  }
}

export async function saveCourseProgress(uid, courseId, lessonId) {
  try {
    const cur = await getCourseProgress(uid, courseId);
    const completed = new Set(cur.completedLessonIds || []);
    completed.add(lessonId);
    const ids = [...completed];
    const data = {
      completedLessonIds: ids,
      currentLessonId: lessonId,
      percent: Math.min(100, ids.length * 10),
    };
    if (isDemoMode) {
      localStorage.setItem(progressKey(uid, courseId), JSON.stringify(data));
      return data;
    }
    const { db, doc, setDoc } = await fsApi();
    await setDoc(doc(db, "users", uid, "progress", courseId), data, { merge: true });
    return data;
  } catch (err) {
    console.warn("saveCourseProgress", err);
    throw err;
  }
}

function wordsKey(uid) {
  return `lingo-words-${uid}`;
}

/** Состояние слова: patch.mistakes — это ПРИРОСТ ошибок (+N), а не новое значение. */
export async function saveWordState(uid, wordId, patch) {
  try {
    const { mistakes = 0, ...rest } = patch;
    if (isDemoMode) {
      const map = JSON.parse(localStorage.getItem(wordsKey(uid)) || "{}");
      const prev = map[wordId] || { status: "learned", favorite: false, mistakes: 0 };
      map[wordId] = { ...prev, ...rest, mistakes: (prev.mistakes || 0) + mistakes, lastReviewed: new Date().toISOString() };
      localStorage.setItem(wordsKey(uid), JSON.stringify(map));
      return map[wordId];
    }
    const { db, doc, setDoc, serverTimestamp, increment } = await fsApi();
    await setDoc(
      doc(db, "users", uid, "words", wordId),
      { ...rest, mistakes: increment(mistakes), lastReviewed: serverTimestamp() },
      { merge: true }
    );
  } catch (err) {
    console.warn("saveWordState", err);
  }
}

/** Сохраняет все слова урока одним пакетом (вместо десятков отдельных запросов). */
async function saveWordsBatch(uid, correctWords, wrongWords) {
  try {
    if (!correctWords.length && !wrongWords.length) return;
    if (isDemoMode) {
      const map = JSON.parse(localStorage.getItem(wordsKey(uid)) || "{}");
      const now = new Date().toISOString();
      wrongWords.forEach((w) => {
        const prev = map[w.id] || { favorite: false, mistakes: 0 };
        map[w.id] = { ...prev, status: "review", mistakes: (prev.mistakes || 0) + 1, lastReviewed: now };
      });
      correctWords.forEach((w) => {
        const prev = map[w.id] || { favorite: false, mistakes: 0 };
        map[w.id] = { ...prev, status: "learned", lastReviewed: now };
      });
      localStorage.setItem(wordsKey(uid), JSON.stringify(map));
      return;
    }
    const { db, doc, writeBatch, serverTimestamp, increment } = await fsApi();
    const batch = writeBatch(db);
    wrongWords.forEach((w) => {
      batch.set(
        doc(db, "users", uid, "words", w.id),
        { status: "review", mistakes: increment(1), lastReviewed: serverTimestamp() },
        { merge: true }
      );
    });
    correctWords.forEach((w) => {
      batch.set(doc(db, "users", uid, "words", w.id), { status: "learned", lastReviewed: serverTimestamp() }, { merge: true });
    });
    await batch.commit();
  } catch (err) {
    console.warn("saveWordsBatch", err);
  }
}

export async function getUserWords(uid) {
  try {
    if (isDemoMode) {
      return JSON.parse(localStorage.getItem(wordsKey(uid)) || "{}");
    }
    const { db, collection, getDocs } = await fsApi();
    const snap = await getDocs(collection(db, "users", uid, "words"));
    const map = {};
    snap.forEach((d) => {
      map[d.id] = d.data();
    });
    return map;
  } catch (err) {
    console.warn("getUserWords", err);
    return {};
  }
}

export async function toggleFavorite(uid, wordId, favorite) {
  return saveWordState(uid, wordId, { favorite });
}

export async function claimDailyReward(uid) {
  const p = await getUserProfile(uid);
  const today = todayKey();
  if (p.dailyRewardClaimedDate === today) return { ok: false, reason: "already" };
  if (p.lastLessonDate !== today) return { ok: false, reason: "need-lesson" };
  const next = {
    ...p,
    points: (p.points || 0) + 50,
    weeklyPoints: (p.weeklyPoints || 0) + 50,
    dailyRewardClaimedDate: today,
  };
  await updateUserProfile(uid, next, p);
  return { ok: true, profile: next };
}

export async function resetAllProgress(uid) {
  const cur = await getUserProfile(uid);
  const fresh = defaultUser({ uid }, { displayName: cur.displayName, avatar: cur.avatar, createdAt: cur.createdAt });
  if (isDemoMode) {
    writeDemo(uid, fresh);
    Object.keys(localStorage)
      .filter((k) => k.startsWith(`lingo-progress-${uid}`) || k === wordsKey(uid))
      .forEach((k) => localStorage.removeItem(k));
    return fresh;
  }
  const { db, doc, setDoc, collection, getDocs, writeBatch } = await fsApi();
  /* вместе с профилем чистим пройденные уроки и слова, иначе «сброс» ничего не сбрасывает */
  for (const sub of ["progress", "words"]) {
    const snap = await getDocs(collection(db, "users", uid, sub));
    if (snap.empty) continue;
    const batch = writeBatch(db);
    snap.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  await setDoc(doc(db, "users", uid), fresh);
  return fresh;
}

/** Для вкладки «Апталық»: если неделя игрока устарела, его недельные очки считаются нулевыми. */
function withFreshWeek(rows, field) {
  if (field !== "weeklyPoints") return rows;
  const wk = weekKey();
  return rows
    .map((r) => (r.weekKey === wk ? r : { ...r, weeklyPoints: 0 }))
    .sort((a, b) => (b.weeklyPoints || 0) - (a.weeklyPoints || 0));
}

export function subscribeLeaderboard(field, cb) {
  if (isDemoMode) {
    localStorage.removeItem("lingo-bots"); /* старые фейковые игроки из прошлой версии */
    const emit = () => {
      const rows = [];
      Object.keys(localStorage)
        .filter((k) => k.startsWith("lingo-user-"))
        .forEach((k) => {
          try {
            const u = JSON.parse(localStorage.getItem(k));
            rows.push({
              uid: k.replace("lingo-user-", ""),
              displayName: u.displayName,
              avatar: u.avatar,
              points: u.points || 0,
              weeklyPoints: u.weeklyPoints || 0,
              weekKey: u.weekKey,
            });
          } catch {
            /* битая запись — пропускаем */
          }
        });
      const sorted = withFreshWeek(rows, field);
      sorted.sort((a, b) => (b[field] || 0) - (a[field] || 0));
      cb(sorted.slice(0, 50));
    };
    emit();
    window.addEventListener("storage", emit);
    return () => window.removeEventListener("storage", emit);
  }
  let unsub = () => {};
  let closed = false;
  fsApi()
    .then(({ db, collection, query, orderBy, limit, onSnapshot }) => {
      if (closed) return;
      const q = query(collection(db, "users"), orderBy(field, "desc"), limit(50));
      unsub = onSnapshot(
        q,
        (snap) => {
          cb(withFreshWeek(snap.docs.map((d) => ({ uid: d.id, ...d.data() })), field));
        },
        (err) => {
          console.warn("leaderboard", err);
          cb([]);
        }
      );
    })
    .catch((err) => {
      console.warn("leaderboard", err);
      cb([]);
    });
  return () => {
    closed = true;
    unsub();
  };
}
