/* Онбординг-квиз для новых пользователей (в стиле Duolingo):
   цель → уровень → время в день → когда учиться → темы → «собираем курс» → личный план.
   Ответы сохраняются в профиль (users/{uid}.onboarding) и используются на главной странице. */
import { t } from "./i18n-kk.js";
import { el, qs, initChrome, toast } from "./ui.js";
import { guardPage } from "./auth.js";
import { getUserProfile, updateUserProfile } from "./db.js";

/* Путь к картинке маскота — меняется здесь и в HTML-тегах <img class="mascot"> */
const MASCOT_SRC = "assets/mascot.png";

export const GOALS = [
  { id: "travel", emoji: "✈️", label: "Саяхат", sub: "Шетелде еркін жүру" },
  { id: "study", emoji: "🎓", label: "Оқу және емтихан", sub: "IELTS, ҰБТ, университет" },
  { id: "career", emoji: "💼", label: "Жұмыс және мансап", sub: "Резюме, келіссөз, хат алмасу" },
  { id: "friends", emoji: "💬", label: "Достармен сөйлесу", sub: "Әлемдік қауымдастық" },
  { id: "fun", emoji: "🌱", label: "Өзімді дамыту", sub: "Қызығушылық үшін" },
];

/* skip — сколько первых уроков открыть сразу */
export const LEVELS = [
  { id: "zero", emoji: "🌱", label: "Мен жаңадан бастаймын", sub: "Алфавиттен және қарапайым сөздерден", skip: 0 },
  { id: "basic", emoji: "🌿", label: "Бірнеше сөз білемін", sub: "Сәлемдесу, сандар, түстер", skip: 1 },
  { id: "mid", emoji: "🌳", label: "Қарапайым сөйлесе аламын", sub: "Күнделікті тақырыптар", skip: 3 },
  { id: "high", emoji: "🚀", label: "Жақсы білемін", sub: "Сөздік қорымды кеңейткім келеді", skip: 5 },
];

/* lessons — сколько уроков в день рекомендуем */
export const MINUTES = [
  { id: 5, emoji: "☕", label: "5 минут / күн", sub: "Жеңіл", lessons: 1 },
  { id: 10, emoji: "🙂", label: "10 минут / күн", sub: "Қалыпты", lessons: 2 },
  { id: 15, emoji: "💪", label: "15 минут / күн", sub: "Белсенді", lessons: 3 },
  { id: 30, emoji: "🔥", label: "30 минут / күн", sub: "Қарқынды", lessons: 5 },
];

export const TIMES = [
  { id: "morning", emoji: "🌅", label: "Таңертең", sub: "Күнді білімнен бастаймын" },
  { id: "day", emoji: "☀️", label: "Күндіз", sub: "Үзіліс кезінде" },
  { id: "evening", emoji: "🌙", label: "Кешке", sub: "Жұмыс/оқудан кейін" },
  { id: "any", emoji: "🔄", label: "Белгісіз", sub: "Қашан уақыт болса" },
];

const TOPIC_EMOJI = {
  animals: "🐾",
  food: "🍎",
  transport: "🚌",
  family: "👨‍👩‍👧",
  colors: "🎨",
  numbers: "🔢",
  clothes: "👕",
  nature: "🌿",
  school: "🎒",
  home: "🏠",
};

const TOPICS = Object.keys(TOPIC_EMOJI).map((id) => ({ id, emoji: TOPIC_EMOJI[id], label: t.categories[id] }));

const STEPS = [
  { key: "goal", say: "Ағылшын тілін не үшін үйренгіңіз келеді?", options: GOALS },
  { key: "level", say: "Қазіргі деңгейіңіз қандай?", options: LEVELS },
  { key: "minutes", say: "Күніне қанша уақыт бөле аласыз?", hint: "Кейін профильде өзгертуге болады", options: MINUTES },
  { key: "time", say: "Қай уақытта оқуға ыңғайлы?", options: TIMES },
  { key: "topics", say: "Қай тақырыптар сізге қызық?", hint: "Бір немесе бірнешеуін таңдаңыз", options: TOPICS, multi: true, two: true },
];

export async function startOnboarding() {
  initChrome();
  const user = await guardPage({ requireAuth: true });
  if (!user) return;
  const retake = new URLSearchParams(location.search).has("retake");
  let profile = await getUserProfile(user.uid);
  if (profile.onboardingDone !== false && !retake) {
    location.replace("home.html");
    return;
  }

  const root = qs("#ob-root");
  const answers = { goal: null, level: null, minutes: null, time: null, topics: [] };
  let step = -1; /* -1 — приветствие, 0..n-1 — вопросы, n — сборка курса, n+1 — итог */
  const total = STEPS.length;

  const mascot = (cls = "") => el("img", { class: `mascot ${cls}`.trim(), src: MASCOT_SRC, alt: "Слоник", width: "120", height: "120", decoding: "async" });

  function topBar() {
    const wrap = el("div", { class: "ob-top" });
    const back = el("button", { class: "icon-btn", type: "button", "aria-label": "Артқа" });
    back.textContent = "←";
    back.addEventListener("click", () => {
      if (step <= 0) {
        step = -1;
      } else step -= 1;
      render();
    });
    if (step < 0) back.style.visibility = "hidden";
    const bar = el("div", { class: "progress", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": String(total), "aria-valuenow": String(Math.max(step, 0)) });
    const span = el("span");
    span.style.width = `${Math.round((Math.max(step, 0) / total) * 100)}%`;
    bar.append(span);
    const skip = el("button", { class: "ob-skip", type: "button", text: "Өткізу" });
    skip.addEventListener("click", () => finish(true));
    wrap.append(back, bar, skip);
    return wrap;
  }

  function bubble(text) {
    const wrap = el("div", { class: "ob-bubble" });
    wrap.append(mascot(), el("div", { class: "say", text }));
    return wrap;
  }

  function show(...nodes) {
    root.replaceChildren(...nodes);
    root.classList.remove("ob-step-enter");
    void root.offsetWidth;
    root.classList.add("ob-step-enter");
    window.scrollTo({ top: 0 });
  }

  function welcome() {
    const box = el("div", { class: "ob-loader" });
    const stage = el("div", { class: "mascot-stage" });
    stage.append(mascot("lg"));
    box.append(
      stage,
      el("h1", { text: "Сәлем! Мен — сенің оқу көмекшіңмін 🐘", style: "margin-top:18px" }),
      el("p", { text: "Бірнеше қысқа сұраққа жауап беріңіз — курсты дәл сізге бейімдеп береміз. Бұл бір минутқа да жетпейді." })
    );
    const go = el("button", { class: "btn btn-block", type: "button", text: "Бастау" });
    go.addEventListener("click", () => {
      step = 0;
      render();
    });
    const actions = el("div", { class: "ob-actions" });
    actions.append(go);
    const skip = el("button", { class: "btn btn-ghost btn-block", type: "button", text: "Қазір емес" });
    skip.addEventListener("click", () => finish(true));
    actions.append(skip);
    show(box, actions);
  }

  function question() {
    const cfg = STEPS[step];
    const list = el("div", { class: `ob-options ${cfg.two ? "two" : ""}`.trim(), role: cfg.multi ? "group" : "radiogroup" });
    const next = el("button", { class: "btn btn-block", type: "button", text: t.continue });
    const sync = () => {
      next.disabled = cfg.multi ? answers.topics.length === 0 : answers[cfg.key] == null;
    };
    cfg.options.forEach((o) => {
      const btn = el("button", { class: "ob-option", type: "button", role: cfg.multi ? "checkbox" : "radio" });
      btn.append(el("span", { class: "emo", text: o.emoji }));
      const txt = el("span");
      txt.append(el("span", { text: o.label }));
      if (o.sub) txt.append(el("small", { text: o.sub }));
      btn.append(txt, el("span", { class: "tick" }));
      const chosen = () => (cfg.multi ? answers.topics.includes(o.id) : answers[cfg.key] === o.id);
      const paint = () => {
        btn.classList.toggle("selected", chosen());
        btn.setAttribute("aria-checked", chosen() ? "true" : "false");
      };
      paint();
      btn.addEventListener("click", () => {
        if (cfg.multi) {
          const i = answers.topics.indexOf(o.id);
          if (i >= 0) answers.topics.splice(i, 1);
          else answers.topics.push(o.id);
          paint();
        } else {
          answers[cfg.key] = o.id;
          list.querySelectorAll(".ob-option").forEach((b) => b.classList.remove("selected"));
          paint();
        }
        sync();
      });
      list.append(btn);
    });
    sync();
    next.addEventListener("click", () => {
      step += 1;
      render();
    });
    const actions = el("div", { class: "ob-actions" });
    actions.append(next);
    const nodes = [topBar(), bubble(cfg.say)];
    if (cfg.hint) nodes.push(el("p", { class: "ob-hint", text: cfg.hint }));
    nodes.push(list, actions);
    show(...nodes);
  }

  function buildPayload() {
    const level = LEVELS.find((x) => x.id === answers.level);
    const minutes = MINUTES.find((x) => x.id === answers.minutes);
    return {
      onboardingDone: true,
      onboarding: {
        goal: answers.goal,
        level: answers.level,
        skip: level ? level.skip : 0,
        dailyMinutes: answers.minutes,
        dailyLessons: minutes ? minutes.lessons : 1,
        studyTime: answers.time,
        topics: answers.topics,
        completedAt: new Date().toISOString(),
      },
    };
  }

  let saving = null;
  function persist(payload) {
    if (!saving) {
      saving = updateUserProfile(user.uid, payload, profile).then((p) => {
        profile = p;
      });
    }
    return saving;
  }

  function building() {
    const box = el("div", { class: "ob-loader" });
    const stage = el("div", { class: "mascot-stage" });
    stage.append(mascot("lg"));
    const bar = el("div", { class: "bar" });
    bar.append(el("span"));
    box.append(stage, el("h2", { text: "Жеке курсыңызды құрастырып жатырмын…", style: "margin-top:18px" }), el("p", { text: "Мақсатыңыз бен деңгейіңізге сай сабақтар таңдалуда" }), bar);
    show(box);
    const saveP = persist(buildPayload()).catch((e) => {
      console.warn("onboarding save", e);
      toast(e?.message || "Қате", "err");
    });
    Promise.all([saveP, new Promise((r) => setTimeout(r, 2300))]).then(() => {
      step = total + 1;
      render();
    });
  }

  function summary() {
    const goal = GOALS.find((x) => x.id === answers.goal);
    const level = LEVELS.find((x) => x.id === answers.level);
    const minutes = MINUTES.find((x) => x.id === answers.minutes);
    const box = el("div", { class: "ob-loader" });
    const stage = el("div", { class: "mascot-stage" });
    stage.append(mascot("lg"));
    box.append(stage, el("h1", { text: "Жоспарыңыз дайын! 🎉", style: "margin-top:18px" }));
    const plan = el("div", { class: "ob-plan" });
    const add = (emoji, name, value) => {
      const row = el("div", { class: "item" });
      row.append(el("span", { text: emoji }), el("span", { text: name }), el("b", { text: value }));
      plan.append(row);
    };
    if (goal) add(goal.emoji, "Мақсат", goal.label);
    if (level) add(level.emoji, "Деңгей", level.label);
    if (minutes) add(minutes.emoji, "Күнделікті мақсат", `${minutes.lessons} сабақ`);
    if (answers.topics.length) add("🎯", "Тақырыптар", `${answers.topics.length}`);
    box.append(plan);
    const go = el("a", { class: "btn btn-block", href: "home.html", text: "Курсты бастау" });
    const actions = el("div", { class: "ob-actions" });
    actions.append(go);
    show(box, actions);
  }

  async function finish(skipped) {
    if (skipped) {
      /* пропуск: ничего не персонализируем, но больше не спрашиваем */
      try {
        await updateUserProfile(user.uid, { onboardingDone: true }, profile);
      } catch (e) {
        console.warn(e);
      }
      location.replace("home.html");
    }
  }

  function render() {
    if (step < 0) return welcome();
    if (step < total) return question();
    if (step === total) return building();
    return summary();
  }

  render();
}

if (document.body?.dataset.page === "onboarding") startOnboarding();
