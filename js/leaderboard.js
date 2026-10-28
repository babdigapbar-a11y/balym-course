/* Лидерборд: realtime / демо, подиум и список. Без фейковых игроков — только реальные пользователи. */
import { t } from "./i18n-kk.js";
import { subscribeLeaderboard } from "./db.js";
import { el, qs, initChrome } from "./ui.js";
import { guardPage } from "./auth.js";

export async function startLeaderboard() {
  initChrome({ nav: "lead" });
  const user = await guardPage({ requireAuth: true });
  if (!user) return;
  let field = "weeklyPoints";
  let unsub = null;
  const root = qs("#lead-root");

  function paint(rows) {
    root.replaceChildren();
    const tabs = el("div", { class: "filters" });
    const w = el("button", { type: "button", text: t.weekly });
    const a = el("button", { type: "button", text: t.allTime });
    w.className = field === "weeklyPoints" ? "active" : "";
    a.className = field === "points" ? "active" : "";
    w.addEventListener("click", () => switchField("weeklyPoints"));
    a.addEventListener("click", () => switchField("points"));
    tabs.append(w, a);
    root.append(tabs);

    if (!rows.length) {
      const empty = el("div", { class: "card empty-board" });
      empty.append(el("div", { class: "empty-emoji", text: "🏆" }), el("p", { text: t.emptyBoard }));
      root.append(empty);
      return;
    }

    const top = rows.slice(0, 3);
    const podium = el("div", { class: "podium" });
    const order = [top[1], top[0], top[2]];
    order.forEach((p, i) => {
      const card = el("div", { class: `podium-card ${i === 1 ? "first" : ""}` });
      if (!p) {
        card.classList.add("empty");
        card.append(el("div", { text: "—" }));
        podium.append(card);
        return;
      }
      const place = i === 1 ? 1 : i === 0 ? 2 : 3;
      card.append(el("div", { text: place === 1 ? "👑" : place === 2 ? "🥈" : "🥉" }));
      const av = el("div", { class: place === 1 ? "avatar lg" : "avatar" });
      av.textContent = p.avatar || "🦉";
      card.append(av);
      card.append(el("b", { text: p.displayName || t.you }));
      card.append(el("div", { text: `🪙 ${p[field] || 0}` }));
      if (p.uid === user.uid) card.append(el("div", { class: "chip", text: t.you }));
      podium.append(card);
    });
    root.append(podium);

    rows.slice(3).forEach((p, idx) => {
      root.append(rankRow(p, idx + 4, p.uid === user.uid, field));
    });

    const inTop = rows.some((r) => r.uid === user.uid);
    if (!inTop) {
      const me = el("div", { class: "card me-bar" });
      me.textContent = t.notInTop;
      root.append(me);
    }
  }

  function rankRow(p, n, me, fieldName) {
    const row = el("div", { class: `rank-row ${me ? "me" : ""}` });
    row.append(el("b", { text: String(n).padStart(2, "0") }));
    const av = el("div", { class: "avatar" });
    av.style.width = "40px";
    av.style.height = "40px";
    av.style.fontSize = "20px";
    av.textContent = p.avatar || "🦉";
    const name = el("div");
    name.append(el("b", { text: p.displayName || "—" }));
    if (me) name.append(el("div", { text: t.you }));
    const pts = el("div");
    pts.textContent = `🪙 ${p[fieldName] || 0}`;
    row.append(av, name, pts);
    return row;
  }

  function switchField(next) {
    field = next;
    if (unsub) unsub();
    unsub = subscribeLeaderboard(field, paint);
  }

  switchField(field);
}

if (document.body?.dataset.page === "leaderboard") startLeaderboard();
