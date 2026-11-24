// LarpScrimsTV: renders data/leaderboard.json (written by the bot every few minutes).
// Names come from Discord, so everything is inserted as text, never as HTML.
(() => {
  "use strict";

  const BOARDS = {
    rating: {
      title: "⭐ Player ratings",
      hint: "Average of each player's last 5 referee ratings. Tiers run S+ down to G-.",
      empty: "No one is rated yet. Referees rate players with /rate after scrims.",
      filter: (p) => p.overall != null,
      sort: (a, b) => b.overall - a.overall || b.elo - a.elo,
      value: (p) => tierPill(p.tier, p.overall),
      sub: (p) => `${p.rankEmoji} ${p.rank} · ${p.elo} Elo`,
    },
    elo: {
      title: "📈 Elo ladder",
      hint: "Ranked Elo from scrims and refereed 1v1s.",
      empty: "No Elo yet this season.",
      filter: () => true,
      sort: (a, b) => b.elo - a.elo || (b.overall ?? -1) - (a.overall ?? -1),
      value: (p) => text("span", fmt(p.elo)),
      sub: (p) => `${p.rankEmoji} ${p.rank}` + (p.tier ? ` · ${p.tier}` : ""),
    },
    community: {
      title: "💙 Community favourites",
      hint: "Votes from the server. Type /vote @player in Discord (1 vote a day).",
      empty: "No votes yet. Be the first: /vote @player in Discord.",
      filter: (p) => p.votes > 0,
      sort: (a, b) => b.votes - a.votes || b.elo - a.elo,
      value: (p) => text("span", `${fmt(p.votes)} 💙`),
      sub: (p) => `${p.rankEmoji} ${p.rank}` + (p.tier ? ` · ${p.tier}` : ""),
    },
  };

  const $ = (id) => document.getElementById(id);
  const state = { data: null, board: "rating", q: "" };
  const fmt = (n) => Number(n || 0).toLocaleString();

  function text(tag, value, cls) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    el.textContent = value;
    return el;
  }

  function tierPill(tier, overall) {
    const wrap = document.createElement("span");
    const pill = text("span", tier || "-", `tier tier-${(tier || "G")[0]}`);
    wrap.append(pill, " ", text("span", overall != null ? String(overall) : ""));
    return wrap;
  }

  function avatar(p, size) {
    const img = document.createElement("img");
    img.className = "av";
    img.width = img.height = size;
    img.loading = "lazy";
    img.alt = "";
    const ok = typeof p.avatar === "string" && /^https:\/\/(cdn|media)\.discordapp\.(com|net)\//.test(p.avatar);
    img.src = ok ? p.avatar : fallbackAvatar(p.name);
    img.onerror = () => { img.onerror = null; img.src = fallbackAvatar(p.name); };
    return img;
  }

  function fallbackAvatar(name) {
    const letter = (String(name || "?").trim()[0] || "?").toUpperCase().replace(/[<&>"]/g, "?");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#16213d"/>` +
      `<text x="32" y="42" font-size="28" font-family="sans-serif" fill="#93a0c2" text-anchor="middle">${letter}</text></svg>`;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  function badgeLine(p) {
    const cat = state.data.achievements;
    const have = new Set(p.achievements || []);
    return cat.filter((a) => have.has(a.key)).map((a) => a.emoji).slice(0, 6).join("");
  }

  function ranked() {
    const b = BOARDS[state.board];
    return state.data.players.filter(b.filter).sort(b.sort);
  }

  function render() {
    if (!state.data) return;
    const b = BOARDS[state.board];
    document.querySelectorAll(".tabs button").forEach((btn) =>
      btn.setAttribute("aria-selected", String(btn.dataset.board === state.board)));
    $("boardTitle").textContent = b.title;
    $("boardHint").textContent = b.hint;

    const all = ranked();
    const q = state.q.trim().toLowerCase();
    const shown = all.map((p, i) => ({ p, pos: i + 1 })).filter(({ p }) => !q || p.name.toLowerCase().includes(q));

    const podium = $("podium");
    podium.replaceChildren();
    const list = $("list");
    list.replaceChildren();
    const top = q ? [] : shown.slice(0, 3);
    const rest = q ? shown : shown.slice(3, 200);

    top.forEach(({ p, pos }) => {
      const card = document.createElement("button");
      card.className = `pod p${pos}`;
      card.type = "button";
      card.append(text("span", `#${pos}`, "place"), avatar(p, 64), text("div", p.name, "nm"));
      const val = text("div", "", "val");
      val.append(b.value(p));
      card.append(val, text("div", b.sub(p), "sub"));
      card.addEventListener("click", () => openProfile(p.id));
      podium.append(card);
    });

    rest.forEach(({ p, pos }) => {
      const li = document.createElement("li");
      const row = document.createElement("button");
      row.type = "button";
      row.className = "row";
      const who = document.createElement("div");
      who.className = "who";
      const badges = badgeLine(p);
      who.append(text("div", p.name, "nm"), text("div", b.sub(p) + (badges ? ` · ${badges}` : ""), "meta"));
      const val = text("div", "", "val");
      val.append(b.value(p));
      row.append(text("span", String(pos), "pos"), avatar(p, 40), who, val);
      row.addEventListener("click", () => openProfile(p.id));
      li.append(row);
      list.append(li);
    });

    const empty = $("empty");
    empty.hidden = shown.length > 0;
    empty.textContent = q ? `No player matches "${state.q}".` : b.empty;
  }

  function stat(k, v) {
    const el = document.createElement("div");
    el.className = "stat";
    el.append(text("div", k, "k"), text("div", v, "v"));
    return el;
  }

  function place(board, id) {
    const i = state.data.players.filter(BOARDS[board].filter).sort(BOARDS[board].sort).findIndex((p) => p.id === id);
    return i >= 0 ? `#${i + 1}` : "-";
  }

  function openProfile(id) {
    const p = state.data.players.find((x) => x.id === id);
    if (!p) return;
    if (location.hash !== `#player/${id}`) history.replaceState(null, "", `#player/${id}`);
    const body = $("profileBody");
    body.replaceChildren();

    const head = document.createElement("div");
    head.className = "pf-head";
    const info = document.createElement("div");
    const h = text("h2", p.name);
    h.id = "pName";
    const line = document.createElement("p");
    line.append(p.tier ? tierPill(p.tier, p.overall) : text("span", "Unrated"), `  ${p.rankEmoji} ${p.rank}`);
    info.append(h, line);
    head.append(avatar(p, 84), info);

    const main = document.createElement("div");
    main.className = "pf-body";
    const grid = document.createElement("div");
    grid.className = "pf-grid";
    grid.append(
      stat("Elo", fmt(p.elo)),
      stat("Votes", fmt(p.votes)),
      stat("Show-up", p.showUp != null && p.games >= 3 ? `${p.showUp}%` : "New"),
      stat("Streak", `${p.streak} 🔥`),
      stat("Scrims", fmt(p.scrims)),
      stat("1v1 W-L", `${p.duelWins}-${p.duelLosses}`),
      stat("Rating rank", place("rating", p.id)),
      stat("Elo rank", place("elo", p.id)),
    );
    main.append(grid);

    if (p.stats) {
      const sec = document.createElement("div");
      sec.append(text("h3", "Stats"));
      const bars = document.createElement("div");
      bars.className = "bars";
      for (const [k, v] of Object.entries(p.stats)) {
        const bar = document.createElement("div");
        bar.className = "bar";
        const track = document.createElement("div");
        track.className = "track";
        const fill = document.createElement("div");
        fill.className = "fill";
        fill.style.width = `${Math.max(0, Math.min(100, Number(v)))}%`;
        track.append(fill);
        bar.append(text("span", k[0].toUpperCase() + k.slice(1)), track, text("span", String(v), "n"));
        bars.append(bar);
      }
      sec.append(bars);
      main.append(sec);
    }

    const have = new Set(p.achievements || []);
    const sec = document.createElement("div");
    sec.append(text("h3", `🏅 Achievements · ${have.size}/${state.data.achievements.length}`));
    const badges = document.createElement("div");
    badges.className = "badges";
    for (const a of state.data.achievements) {
      const el = document.createElement("div");
      el.className = "badge" + (have.has(a.key) ? "" : " off");
      el.title = a.description;
      const label = document.createElement("div");
      label.append(text("b", a.name), text("small", a.description));
      el.append(text("span", a.emoji, "e"), label);
      badges.append(el);
    }
    sec.append(badges);
    main.append(sec);

    const share = text("button", "🔗 Copy profile link", "share");
    share.type = "button";
    share.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(location.href); share.textContent = "✅ Link copied"; }
      catch { share.textContent = location.href; }
    });
    main.append(share);

    body.append(head, main);
    const dlg = $("profile");
    if (!dlg.open) dlg.showModal();
  }

  function closeProfile() {
    const dlg = $("profile");
    if (dlg.open) dlg.close();
  }

  function fromHash() {
    const h = location.hash.slice(1);
    if (h.startsWith("player/")) {
      openProfile(h.slice(7));
      return;
    }
    closeProfile();
    if (BOARDS[h]) state.board = h;
    render();
  }

  function heroStats() {
    const d = state.data;
    const box = $("heroStats");
    box.replaceChildren();
    const rated = d.players.filter((p) => p.overall != null).length;
    const votes = d.players.reduce((s, p) => s + (p.votes || 0), 0);
    for (const [k, v] of [["Players", d.players.length], ["Rated", rated], ["Votes cast", votes]]) {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.append(text("b", fmt(v)), ` ${k}`);
      box.append(chip);
    }
    const when = d.updated ? new Date(d.updated * 1000) : null;
    $("updated").textContent = when ? `Updated ${when.toLocaleString()}` : "";
  }

  async function load() {
    try {
      const res = await fetch(`data/leaderboard.json?t=${Math.floor(Date.now() / 60000)}`, { cache: "no-store" });
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      data.players = (data.players || []).filter((p) => p && typeof p.id === "string");
      data.achievements = data.achievements || [];
      state.data = data;
      heroStats();
      fromHash();
    } catch (err) {
      $("empty").hidden = false;
      $("empty").textContent = "Couldn't load the leaderboard. Refresh in a minute.";
    }
  }

  document.querySelectorAll(".tabs button").forEach((btn) =>
    btn.addEventListener("click", () => { location.hash = btn.dataset.board; }));
  $("search").addEventListener("input", (e) => { state.q = e.target.value; render(); });
  $("closeProfile").addEventListener("click", closeProfile);
  $("profile").addEventListener("close", () => {
    if (location.hash.startsWith("#player/")) history.replaceState(null, "", `#${state.board}`);
  });
  $("profile").addEventListener("click", (e) => { if (e.target === e.currentTarget) closeProfile(); });
  window.addEventListener("hashchange", fromHash);
  load();
  setInterval(load, 5 * 60 * 1000);
})();
