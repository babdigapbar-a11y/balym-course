/* Общий UI: тосты, лоадер, тема, конфетти, нижняя навигация */
import { t } from "./i18n-kk.js";
import { isDemoMode } from "./firebase-config.js";

const THEME_KEY = "lingo-theme";

export function qs(sel, root = document) {
  return root.querySelector(sel);
}

export function qsa(sel, root = document) {
  return [...root.querySelectorAll(sel)];
}

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === false || v == null) return;
    else node.setAttribute(k, v);
  });
  children.forEach((c) => {
    if (c) node.append(c);
  });
  return node;
}

export function applyTheme(theme) {
  const next = theme || localStorage.getItem(THEME_KEY) || "light";
  document.documentElement.dataset.theme = next;
  localStorage.setItem(THEME_KEY, next);
  return next;
}

export function toggleTheme() {
  const cur = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  return applyTheme(cur === "dark" ? "light" : "dark");
}

export function toast(message, kind = "info") {
  let stack = qs(".toast-stack");
  if (!stack) {
    stack = el("div", { class: "toast-stack" });
    document.body.append(stack);
  }
  const item = el("div", { class: `toast ${kind === "ok" ? "ok" : kind === "err" ? "err" : ""}`, role: "status" });
  item.textContent = message;
  stack.append(item);
  setTimeout(() => item.remove(), 3200);
}

export function setButtonLoading(btn, loading) {
  if (!btn) return;
  if (loading) {
    btn.disabled = true;
    btn.dataset.label = btn.textContent;
    btn.replaceChildren(el("span", { class: "spinner" }), document.createTextNode(" …"));
  } else {
    btn.disabled = false;
    btn.textContent = btn.dataset.label || btn.textContent;
  }
}

export function showDemoBanner() {
  if (!isDemoMode || qs(".demo-banner")) return;
  const bar = el("div", { class: "demo-banner", role: "status" });
  bar.textContent = t.firebaseOff;
  document.body.prepend(bar);
}

export function watchOffline() {
  const render = () => {
    const old = qs(".offline-banner");
    if (!navigator.onLine) {
      if (old) return;
      const bar = el("div", { class: "offline-banner", role: "alert" });
      bar.textContent = t.offline;
      document.body.prepend(bar);
    } else if (old) old.remove();
  };
  window.addEventListener("online", render);
  window.addEventListener("offline", render);
  render();
}

export function renderBottomNav(active) {
  const items = [
    { id: "home", href: "home.html", label: t.home, icon: homeIcon },
    { id: "dict", href: "dictionary.html", label: t.dictionary, icon: bookIcon },
    { id: "lead", href: "leaderboard.html", label: t.contest, icon: cupIcon },
    { id: "profile", href: "profile.html", label: t.profile, icon: userIcon },
  ];
  const nav = el("nav", { class: "bottom-nav", "aria-label": "Негізгі мәзір" });
  items.forEach((it) => {
    const a = el("a", { href: it.href, class: it.id === active ? "active" : "" });
    a.innerHTML = it.icon;
    const lab = el("span", { class: "label", text: it.label });
    a.append(lab);
    a.setAttribute("aria-label", it.label);
    if (it.id === active) a.setAttribute("aria-current", "page");
    nav.append(a);
  });
  document.body.append(nav);
}

export function launchConfetti(ms = 1800) {
  const canvas = el("canvas", { class: "confetti-canvas" });
  document.body.append(canvas);
  const ctx = canvas.getContext("2d");
  const resize = () => {
    canvas.width = innerWidth;
    canvas.height = innerHeight;
  };
  resize();
  const bits = Array.from({ length: 90 }, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * 80,
    r: 4 + Math.random() * 5,
    vy: 2 + Math.random() * 4,
    vx: -1.5 + Math.random() * 3,
    c: ["#7C6FF0", "#F5B942", "#FF6B7A", "#22C55E", "#C9E7FF"][(Math.random() * 5) | 0],
  }));
  let start = 0;
  const tick = (ts) => {
    if (!start) start = ts;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    bits.forEach((b) => {
      b.x += b.vx;
      b.y += b.vy;
      ctx.fillStyle = b.c;
      ctx.fillRect(b.x, b.y, b.r, b.r * 1.4);
    });
    if (ts - start < ms) requestAnimationFrame(tick);
    else canvas.remove();
  };
  requestAnimationFrame(tick);
}

export function modal({ title, text, confirm, cancel, onOk }) {
  const back = el("div", { class: "modal-backdrop", role: "dialog", "aria-modal": "true" });
  const box = el("div", { class: "modal" });
  const h = el("h3");
  h.textContent = title;
  const p = el("p");
  p.textContent = text;
  const row = el("div", { style: "display:grid;gap:8px;margin-top:12px" });
  const ok = el("button", { class: "btn btn-danger btn-block" });
  ok.textContent = confirm;
  const no = el("button", { class: "btn btn-ghost btn-block" });
  no.textContent = cancel;
  ok.addEventListener("click", () => {
    back.remove();
    onOk?.();
  });
  no.addEventListener("click", () => back.remove());
  row.append(ok, no);
  box.append(h, p, row);
  back.append(box);
  document.body.append(back);
}

export function wirePasswordToggles(root = document) {
  root.querySelectorAll("[data-password-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-password-toggle");
      const input = qs(`#${id}`);
      if (!input) return;
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.textContent = show ? "🙈" : "👁";
      btn.setAttribute("aria-label", show ? t.hidePassword : t.showPassword);
    });
  });
}

export function speak(text, lang = "en-US") {
  try {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
  } catch {
    toast("Дыбыс қолжетімсіз", "err");
  }
}

export function initChrome({ nav, themeBtn } = {}) {
  applyTheme();
  showDemoBanner();
  watchOffline();
  if (nav) renderBottomNav(nav);
  const btn = themeBtn || qs("[data-theme-toggle]");
  if (btn) {
    btn.addEventListener("click", () => {
      const next = toggleTheme();
      btn.textContent = next === "dark" ? "☀️" : "🌙";
    });
    btn.textContent = (document.documentElement.dataset.theme === "dark" ? "☀️" : "🌙");
  }
}

const homeIcon =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z"/></svg>';
const bookIcon =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h9a4 4 0 0 1 4 4v12H8a3 3 0 0 0-3 3V4z"/><path d="M5 4v16"/></svg>';
const cupIcon =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h10v4a5 5 0 0 1-10 0z"/><path d="M7 7H5a3 3 0 0 0 3 3"/><path d="M17 7h2a3 3 0 0 1-3 3"/><path d="M9 19h6"/><path d="M12 14v5"/></svg>';
const userIcon =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 19c1.5-3.2 4-5 7-5s5.5 1.8 7 5"/></svg>';
