/* Словарь: поиск, категории, избранное, флэш-карточки */
import { t } from "./i18n-kk.js";
import { WORDS, CATEGORY_KEYS, getSpeechLang } from "./data/words.js";
import { getUserProfile, getUserWords, toggleFavorite } from "./db.js";
import { el, qs, speak, initChrome, toast } from "./ui.js";
import { guardPage } from "./auth.js";

export async function startDictionary() {
  initChrome({ nav: "dict" });
  const user = await guardPage({ requireAuth: true });
  if (!user) return;
  const profile = await getUserProfile(user.uid);
  let map = await getUserWords(user.uid);
  let cat = "all";
  let q = "";
  let flash = false;
  let fi = 0;

  const root = qs("#dict-root");

  function list() {
    const lang = profile.currentLanguage || "en";
    return WORDS.filter((w) => {
      if (w.language !== lang) return false;
      const st = map[w.id];
      if (!st) return false;
      if (cat !== "all" && w.category !== cat) return false;
      const hay = `${w.word} ${w.translation} ${w.transcription}`.toLowerCase();
      if (q && !hay.includes(q.toLowerCase())) return false;
      return true;
    });
  }

  const search = el("input", { placeholder: t.searchWord, "aria-label": t.searchWord });
  search.addEventListener("input", () => {
    q = search.value;
    renderList();
  });
  const filters = el("div", { class: "filters" });
  const listBox = el("div", { id: "dict-list" });
  root.append(search, filters, listBox);

  async function render() {
    renderFilters();
    renderList();
  }

  function renderFilters() {
    filters.replaceChildren();
    const allBtn = el("button", { type: "button" });
    allBtn.textContent = "Барлығы";
    if (cat === "all") allBtn.classList.add("active");
    allBtn.addEventListener("click", () => {
      cat = "all";
      render();
    });
    filters.append(allBtn);
    CATEGORY_KEYS.forEach((k) => {
      const b = el("button", { type: "button" });
      b.textContent = t.categories[k];
      if (cat === k) b.classList.add("active");
      b.addEventListener("click", () => {
        cat = k;
        render();
      });
      filters.append(b);
    });
    const flipBtn = el("button", { class: "btn-soft btn", type: "button" });
    flipBtn.textContent = flash ? "Тізім" : "Флэш-карточка";
    flipBtn.addEventListener("click", () => {
      flash = !flash;
      fi = 0;
      render();
    });
    filters.append(flipBtn);
  }

  function renderList() {
    const items = list();
    listBox.replaceChildren();
    listBox.className = flash ? "flash" : "list";
    if (!items.length) {
      listBox.append(el("p", { text: "Әзірге сөз жоқ. Сабақ өтіңіз." }));
      return;
    }
    if (flash) {
      const w = items[fi % items.length];
      const scene = el("div", { class: "flip-scene" });
      const card = el("div", { class: "flip-card" });
      const front = el("div", { class: "flip-face" });
      front.append(el("div", { class: "prompt-emoji", text: w.emoji }), el("h2", { text: w.word }), el("p", { text: w.transcription }));
      const back = el("div", { class: "flip-face back" });
      back.append(el("h2", { text: w.translation }), el("p", { text: w.example }), el("p", { text: w.exampleTranslation }));
      card.append(front, back);
      scene.addEventListener("click", () => card.classList.toggle("flipped"));
      scene.append(card);
      const nav = el("div", { style: "display:flex;gap:8px;margin-top:12px" });
      const prev = el("button", { class: "btn btn-ghost", type: "button", text: "←" });
      const next = el("button", { class: "btn btn-ghost", type: "button", text: "→" });
      prev.addEventListener("click", () => {
        fi = (fi - 1 + items.length) % items.length;
        render();
      });
      next.addEventListener("click", () => {
        fi = (fi + 1) % items.length;
        render();
      });
      nav.append(prev, next);
      listBox.append(scene, nav);
      return;
    }
    items.forEach((w) => {
      const row = el("div", { class: "dict-item" });
      row.append(el("span", { text: w.emoji }));
      const mid = el("div");
      mid.append(el("b", { text: w.word }));
      const meta = el("div");
      meta.style.color = "var(--muted)";
      meta.style.fontSize = "0.85rem";
      meta.textContent = `${w.translation} · ${w.transcription}`;
      const ex = el("div");
      ex.style.fontSize = "0.8rem";
      ex.textContent = `${w.example} — ${w.exampleTranslation}`;
      mid.append(meta, ex);
      const snd = el("button", { class: "icon-btn", type: "button", "aria-label": t.listen });
      snd.textContent = "🔊";
      snd.addEventListener("click", () => speak(w.word, getSpeechLang(w.language)));
      const fav = el("button", { class: "icon-btn", type: "button", "aria-label": "Таңдаулы" });
      fav.textContent = map[w.id]?.favorite ? "⭐" : "☆";
      fav.addEventListener("click", async () => {
        try {
          await toggleFavorite(user.uid, w.id, !map[w.id]?.favorite);
          map = await getUserWords(user.uid);
          render();
        } catch (e) {
          toast(e.message, "err");
        }
      });
      row.append(mid, snd, fav);
      listBox.append(row);
    });
  }

  render();
}

if (document.body?.dataset.page === "dictionary") startDictionary();
