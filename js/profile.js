/* Профиль, достижения, аватар, сброс прогресса */
import { t } from "./i18n-kk.js";
import { AVATARS, getUserProfile, updateUserProfile, resetAllProgress } from "./db.js";
import { el, qs, initChrome, toast, modal } from "./ui.js";
import { guardPage, logout } from "./auth.js";

const ACH = [
  { id: "first_step", title: t.firstStep, emoji: "🏁" },
  { id: "week_streak", title: t.weekStreak, emoji: "🔥" },
  { id: "hundred_words", title: t.hundredWords, emoji: "💯" },
  { id: "perfect_lesson", title: t.perfectLesson, emoji: "💎" },
];

export async function startProfile() {
  initChrome({ nav: "profile" });
  const user = await guardPage({ requireAuth: true });
  if (!user) return;
  let profile = await getUserProfile(user.uid);
  const root = qs("#profile-root");

  function createdLabel(v) {
    if (!v) return "—";
    if (v.toDate) return v.toDate().toLocaleDateString("kk-KZ");
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("kk-KZ");
  }

  function render() {
    root.replaceChildren();
    const left = el("div", { class: "profile-col" });
    const right = el("div", { class: "profile-col" });
    root.append(left, right);
    const head = el("div", { class: "card", style: "text-align:center" });
    const av = el("div", { class: "avatar lg" });
    av.style.margin = "0 auto 8px";
    av.textContent = profile.avatar || "🦉";
    const name = el("h2");
    name.textContent = profile.displayName || t.hello;
    const mail = el("p");
    mail.textContent = profile.email || user.email || "";
    const since = el("p");
    since.textContent = createdLabel(profile.createdAt);
    head.append(av, name, mail, since);
    left.append(head);

    const avatars = el("div", { class: "avatar-grid card" });
    AVATARS.forEach((a) => {
      const b = el("button", { type: "button" });
      b.textContent = a;
      if (a === profile.avatar) b.classList.add("selected");
      b.addEventListener("click", async () => {
        profile = await updateUserProfile(user.uid, { avatar: a }, profile);
        toast(t.saved, "ok");
        render();
      });
      avatars.append(b);
    });
    left.append(avatars);

    const nameField = el("div", { class: "field" });
    const lab = el("label");
    lab.textContent = t.name;
    const inp = el("input", { value: profile.displayName || "", maxlength: "40" });
    inp.value = profile.displayName || "";
    const save = el("button", { class: "btn btn-block", type: "button" });
    save.textContent = "Сақтау";
    save.addEventListener("click", async () => {
      const v = inp.value.trim();
      if (v.length < 1 || v.length > 40) {
        toast(t.required, "err");
        return;
      }
      profile = await updateUserProfile(user.uid, { displayName: v }, profile);
      toast(t.saved, "ok");
      render();
    });
    nameField.append(lab, inp, save);
    left.append(nameField);

    const stats = el("div", { class: "stats-row" });
    [
      [profile.points || 0, t.points],
      [profile.streak || 0, t.streak],
      [profile.learnedWords || 0, t.learned],
      [`${profile.accuracy || 0}%`, t.accuracy],
    ].forEach(([n, l]) => {
      const s = el("div", { class: "stat" });
      s.append(el("b", { text: String(n) }), el("span", { text: l }));
      stats.append(s);
    });
    right.append(stats);

    const ach = el("div", { class: "card" });
    ach.append(el("h3", { text: "Жетістіктер" }));
    ACH.forEach((a) => {
      const open = (profile.achievements || []).includes(a.id);
      const row = el("p");
      row.textContent = `${open ? a.emoji : "🔒"} ${a.title}`;
      ach.append(row);
    });
    right.append(ach);

    const out = el("button", { class: "btn btn-ghost btn-block", type: "button" });
    out.textContent = t.logout;
    out.addEventListener("click", () => logout());
    const reset = el("button", { class: "btn btn-danger btn-block", type: "button" });
    reset.textContent = t.resetProgress;
    reset.addEventListener("click", () => {
      modal({
        title: t.resetProgress,
        text: t.confirmReset,
        confirm: t.yes,
        cancel: t.cancel,
        onOk: async () => {
          profile = await resetAllProgress(user.uid);
          toast(t.saved, "ok");
          render();
        },
      });
    });
    right.append(out, reset);
  }

  render();
}

if (document.body?.dataset.page === "profile") startProfile();
