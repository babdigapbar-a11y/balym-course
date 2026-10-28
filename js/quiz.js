/* Квиз: 5 типов заданий, жизни, итог и сохранение прогресса */
import { t } from "./i18n-kk.js";
import { getLessons, getSpeechLang, getWordsByLang } from "./data/words.js";
import { saveLessonResult, getCourseProgress } from "./db.js";
import { el, qs, qsa, launchConfetti, speak, toast, initChrome } from "./ui.js";
import { guardPage } from "./auth.js";

const TYPES = ["choose", "picture", "type", "match", "listen"];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function others(pool, word, n = 3) {
  return shuffle(pool.filter((w) => w.id !== word.id)).slice(0, n);
}

function buildQuestions(lesson, allLangWords) {
  const words = shuffle(lesson.words);
  return words.map((word, i) => {
    const type = TYPES[i % TYPES.length];
    const distractors = others(allLangWords.length > 4 ? allLangWords : lesson.words, word, 3);
    return { type, word, distractors, lessonWords: lesson.words };
  });
}

export async function startLessonPage() {
  initChrome();
  const user = await guardPage({ requireAuth: true });
  if (!user) return;

  const params = new URLSearchParams(location.search);
  const lang = params.get("lang") || "en";
  const lessonId = params.get("lesson") || `${lang}-l1`;
  const lessons = getLessons(lang);
  const lesson = lessons.find((l) => l.id === lessonId) || lessons[0];
  const all = getWordsByLang(lang);
  const questions = buildQuestions(lesson, all);
  const speech = getSpeechLang(lang);

  const root = qs("#quiz-root");
  const state = {
    i: 0,
    hearts: 5,
    correct: 0,
    answers: 0,
    wrongWords: [],
    correctWords: [],
    selected: null,
    checked: false,
  };

  function render() {
    root.replaceChildren();
    if (state.hearts <= 0) {
      root.append(gameOver());
      return;
    }
    if (state.i >= questions.length) {
      root.append(results());
      return;
    }
    const q = questions[state.i];
    root.append(topBar(), prompt(q), body(q), feedbackBox(), actions());
    updateCheckEnabled();
  }

  function topBar() {
    const wrap = el("div", { class: "quiz-top" });
    const back = el("a", { class: "icon-btn", href: "home.html", "aria-label": t.toHome });
    back.textContent = "←";
    const bar = el("div", { class: "progress", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": "100" });
    const pct = Math.round((state.i / questions.length) * 100);
    const span = el("span");
    span.style.width = `${pct}%`;
    bar.append(span);
    const hearts = el("div", { class: "hearts", "aria-label": t.hearts });
    hearts.textContent = "❤".repeat(state.hearts) + "♡".repeat(5 - state.hearts);
    wrap.append(back, bar, hearts);
    return wrap;
  }

  function prompt(q) {
    const card = el("div", { class: "prompt-card" });
    const title = el("p");
    const titles = {
      choose: t.chooseTranslation,
      picture: t.chooseByPicture,
      type: t.writeWord,
      match: t.findPair,
      listen: t.listenAndChoose,
    };
    title.textContent = titles[q.type];
    card.append(title);
    if (q.type === "picture") {
      card.append(el("div", { class: "prompt-emoji", text: q.word.emoji }));
    } else if (q.type === "listen") {
      const btn = el("button", { class: "btn", type: "button", "aria-label": t.listen });
      btn.textContent = "🔊 " + t.listen;
      btn.addEventListener("click", () => speak(q.word.word, speech));
      card.append(btn);
      setTimeout(() => speak(q.word.word, speech), 250);
    } else if (q.type === "type") {
      card.append(el("div", { class: "prompt-emoji", text: q.word.emoji }));
      card.append(el("div", { class: "prompt-word", text: q.word.translation }));
    } else if (q.type === "match") {
      card.append(el("p", { text: t.matchHint }));
    } else {
      const row = el("div", { class: "prompt-word" });
      row.textContent = q.word.word;
      const snd = el("button", { class: "icon-btn", type: "button", "aria-label": t.listen });
      snd.textContent = "🔊";
      snd.addEventListener("click", () => speak(q.word.word, speech));
      card.append(row, snd);
    }
    return card;
  }

  function body(q) {
    if (q.type === "type") return typeBody();
    if (q.type === "match") return matchBody(q);
    const opts =
      q.type === "picture"
        ? shuffle([q.word, ...q.distractors]).map((w) => ({ id: w.id, label: w.word, ok: w.id === q.word.id }))
        : shuffle([q.word, ...q.distractors]).map((w) => ({
            id: w.id,
            label: q.type === "choose" || q.type === "listen" ? w.translation : w.word,
            emoji: "",
            ok: w.id === q.word.id,
          }));
    const grid = el("div", { class: "choice-grid" });
    opts.forEach((o) => {
      const b = el("button", { class: `choice ${q.type === "picture" ? "" : "small"}`, type: "button" });
      b.textContent = (o.emoji ? o.emoji + " " : "") + o.label;
      b.dataset.ok = o.ok ? "1" : "0";
      b.addEventListener("click", () => {
        if (state.checked) return;
        qsa(".choice", grid).forEach((x) => x.classList.remove("selected"));
        b.classList.add("selected");
        state.selected = o;
        updateCheckEnabled();
      });
      grid.append(b);
    });
    return grid;
  }

  function typeBody() {
    const wrap = el("div", { class: "field" });
    const input = el("input", {
      id: "typed",
      autocomplete: "off",
      autocapitalize: "off",
      placeholder: t.typeWord,
      "aria-label": t.typeWord,
    });
    input.addEventListener("input", () => {
      state.selected = { text: input.value };
      updateCheckEnabled();
    });
    wrap.append(input);
    return wrap;
  }

  function matchBody(q) {
    const pairs = shuffle([q.word, ...others(q.lessonWords, q.word, 3)]).slice(0, 4);
    const left = shuffle(pairs);
    const right = shuffle(pairs);
    state.match = { left: null, right: null, done: new Set(), need: pairs.length, okCount: 0, hadError: false };
    const board = el("div", { class: "match-board" });
    const colL = el("div", { class: "match-col" });
    const colR = el("div", { class: "match-col" });
    left.forEach((w) => {
      const b = el("button", { class: "choice small", type: "button", text: w.word });
      b.addEventListener("click", () => {
        if (state.checked || b.disabled) return;
        qsa(".choice", colL).forEach((x) => x.classList.remove("selected"));
        b.classList.add("selected");
        state.match.left = { w, b };
        tryMatch();
      });
      colL.append(b);
    });
    right.forEach((w) => {
      const b = el("button", { class: "choice small", type: "button", text: w.translation });
      b.addEventListener("click", () => {
        if (state.checked || b.disabled) return;
        qsa(".choice", colR).forEach((x) => x.classList.remove("selected"));
        b.classList.add("selected");
        state.match.right = { w, b };
        tryMatch();
      });
      colR.append(b);
    });
    board.append(colL, colR);
    function tryMatch() {
      const m = state.match;
      if (!m.left || !m.right) return;
      if (m.left.w.id === m.right.w.id) {
        m.left.b.classList.add("ok");
        m.right.b.classList.add("ok");
        m.left.b.disabled = true;
        m.right.b.disabled = true;
        m.done.add(m.left.w.id);
        m.okCount += 1;
      } else {
        m.hadError = true;
        const lb = m.left.b;
        const rb = m.right.b;
        lb.classList.add("shake");
        rb.classList.add("shake");
        setTimeout(() => {
          lb.classList.remove("selected", "shake");
          rb.classList.remove("selected", "shake");
        }, 350);
      }
      m.left = null;
      m.right = null;
      if (m.done.size === m.need) {
        state.selected = { matchOk: !m.hadError, complete: true };
        updateCheckEnabled();
      }
    }
    return board;
  }

  function feedbackBox() {
    return el("div", { id: "fb", class: "hidden" });
  }

  function actions() {
    const wrap = el("div");
    const check = el("button", { class: "btn btn-block", id: "check-btn", type: "button" });
    check.textContent = t.check;
    check.disabled = true;
    check.addEventListener("click", onCheck);
    wrap.append(check);
    return wrap;
  }

  function updateCheckEnabled() {
    const btn = qs("#check-btn");
    if (!btn) return;
    const q = questions[state.i];
    if (q?.type === "type") btn.disabled = !qs("#typed")?.value.trim();
    else if (q?.type === "match") btn.disabled = !state.selected?.complete;
    else btn.disabled = !state.selected;
  }

  function onCheck() {
    if (state.checked) {
      state.i += 1;
      state.selected = null;
      state.checked = false;
      render();
      return;
    }
    const q = questions[state.i];
    let ok = false;
    if (q.type === "type") {
      const val = (qs("#typed")?.value || "").replace(/\s+/g, "").toLowerCase();
      ok = val === q.word.word.replace(/\s+/g, "").toLowerCase();
    } else if (q.type === "match") {
      ok = !!state.selected?.matchOk;
    } else {
      ok = !!state.selected?.ok || qs(".choice.selected")?.dataset.ok === "1";
    }
    state.checked = true;
    state.answers += 1;
    const fb = qs("#fb");
    fb.className = `feedback ${ok ? "ok" : "bad"}`;
    if (ok) {
      fb.textContent = t.correct;
      state.correct += 1;
      state.correctWords.push(q.word);
      qs(".prompt-card")?.classList.add("flash-ok");
      qsa(".choice.selected").forEach((c) => c.classList.add("ok"));
    } else {
      fb.textContent = `${t.wrong} ${q.word.word} — ${q.word.translation}`;
      state.hearts -= 1;
      state.wrongWords.push(q.word);
      qs(".prompt-card")?.classList.add("shake");
      qsa(".choice.selected").forEach((c) => c.classList.add("bad"));
    }
    const btn = qs("#check-btn");
    btn.disabled = false;
    btn.textContent = t.continue;
    if (state.hearts <= 0) setTimeout(render, 650);
  }

  function gameOver() {
    const box = el("div", { class: "result-box card" });
    box.append(el("h1", { text: t.heartsGone }));
    const retry = el("button", { class: "btn btn-block" });
    retry.textContent = t.retry;
    retry.addEventListener("click", () => location.reload());
    const home = el("a", { class: "btn btn-ghost btn-block", href: "home.html" });
    home.textContent = t.toHome;
    box.append(retry, home);
    return box;
  }

  function results() {
    const perfect = state.correct === questions.length;
    const bonus = perfect ? 50 : 0;
    const earned = state.correct * 10 + bonus;
    const acc = Math.round((state.correct / questions.length) * 100);
    const box = el("div", { class: "result-box card" });
    box.append(el("h1", { text: t.congrats }));
    box.append(el("p", { text: `${t.points}: +${earned}` }));
    if (bonus) box.append(el("p", { text: `${t.bonus}: +${bonus}` }));
    box.append(el("p", { text: `${t.accuracy}: ${acc}%` }));
    launchConfetti();
    saveLessonResult(user.uid, {
      correct: state.correct,
      total: questions.length,
      earned,
      perfect,
      lang,
      lessonId: lesson.id,
      wrongWords: state.wrongWords,
      correctWords: state.correctWords,
    }).catch((e) => toast(e.message || "Қате", "err"));

    const idx = lessons.findIndex((l) => l.id === lesson.id);
    const next = lessons[idx + 1];
    if (next) {
      const a = el("a", { class: "btn btn-block", href: `lesson.html?lang=${lang}&lesson=${next.id}` });
      a.textContent = t.nextLesson;
      box.append(a);
    }
    const home = el("a", { class: "btn btn-ghost btn-block", href: "home.html" });
    home.textContent = t.toHome;
    box.append(home);
    return box;
  }

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.target.closest?.("a")) return;
    const btn = qs("#check-btn");
    if (btn && !btn.disabled) {
      e.preventDefault(); /* иначе кнопка в фокусе сработает второй раз */
      onCheck();
    }
  });

  try {
    await getCourseProgress(user.uid, lang);
  } catch {
    /* прогресс подтянется при сохранении */
  }
  render();
}

if (document.body?.dataset.page === "lesson") {
  startLessonPage();
}
