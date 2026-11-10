const STATUSES = ["Completed", "Playing", "Paused", "Dropped", "Wishlist", "Legacy"];
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const cls = (status) => "s-" + status.toLowerCase();
const coverSrc = (g) => (g.cover ? "/" + g.cover : "");
const year = (d) => (d ? d.slice(0, 4) : "");

/* ---------------- Score (1–10) ---------------- */
const TIERS = [
  [10, "legend", "Masterpiece"],
  [8, "great", "Great"],
  [6, "good", "Good"],
  [4, "mixed", "Mixed"],
  [1, "bad", "Bad"],
];
const tier = (n) => TIERS.find(([min]) => n >= min);

/** Circular score ring. size: "sm" (cards) | "lg" (detail). */
function scoreRing(n, size = "sm") {
  if (!n) return "";
  const [, key, label] = tier(n);
  return `<span class="score score-${size} t-${key}" title="${n}/10 · ${label}" aria-label="Rated ${n} out of 10">
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <circle class="track" cx="20" cy="20" r="17"/>
      <circle class="bar" cx="20" cy="20" r="17" pathLength="100" stroke-dasharray="${n * 10} 100"/>
    </svg><b>${n}</b></span>`;
}

/** Renders a 1–10 picker into el; calls onPick(n) on click. Returns a setter. */
function ratingPicker(el, onPick) {
  el.innerHTML = Array.from({ length: 10 }, (_, i) =>
    `<button type="button" data-r="${i + 1}" role="radio" aria-checked="false">${i + 1}</button>`).join("");
  const set = (n) => {
    el.className = "rating-input" + (n ? ` t-${tier(n)[1]}` : "");
    el.querySelectorAll("button").forEach((b) => {
      const r = Number(b.dataset.r);
      b.classList.toggle("on", !!n && r <= n);
      b.setAttribute("aria-checked", String(r === n));
    });
  };
  el.addEventListener("click", (e) => {
    const b = e.target.closest("[data-r]");
    if (b) onPick(Number(b.dataset.r));
  });
  return set;
}

/* Rating filter buckets: [value, label, test] — mirrors the score-ring tiers. */
const RATING_FILTERS = [
  ["", "Any rating", () => true],
  ["10", "10 · Masterpiece", (n) => n === 10, "t-legend"],
  ["8", "8–9 · Great", (n) => n >= 8 && n <= 9, "t-great"],
  ["6", "6–7 · Good", (n) => n >= 6 && n <= 7, "t-good"],
  ["4", "4–5 · Mixed", (n) => n >= 4 && n <= 5, "t-mixed"],
  ["1", "1–3 · Bad", (n) => n >= 1 && n <= 3, "t-bad"],
  ["none", "Unrated", (n) => !n, "t-none"],
];

/* ---------------- Floating menus ---------------- */
/** Position a fixed menu under its anchor (above only if the screen has no room below). */
function placeFloating(anchor, menu, { minWidth = 0, maxHeight = 260 } = {}) {
  const box = anchor.getBoundingClientRect();
  const below = innerHeight - box.bottom - 16;
  const s = menu.style;
  const width = Math.max(box.width, minWidth);
  s.width = `${width}px`;
  s.left = `${Math.max(8, Math.min(box.left, innerWidth - width - 8))}px`;
  if (below >= 160 || below >= box.top - 16) {
    s.top = `${box.bottom + 6}px`;
    s.bottom = "auto";
    s.maxHeight = `${Math.min(maxHeight, below)}px`;
  } else {
    s.top = "auto";
    s.bottom = `${innerHeight - box.top + 6}px`;
    s.maxHeight = `${Math.min(maxHeight, box.top - 16)}px`;
  }
}

const CHEVRON = `<svg class="dd-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`;
const dotFor = (opt) => (opt?.dataset.cls ? `<span class="dot ${opt.dataset.cls}"></span>` : "");
let openDropdown = null;

/**
 * Replace a native <select> with a styled dropdown. The <select> stays in the DOM (hidden)
 * as the source of truth, so .value, .innerHTML and "change" listeners keep working.
 */
function enhanceSelect(sel) {
  const wrap = document.createElement("div");
  wrap.className = "dd";
  sel.before(wrap);
  wrap.append(sel);
  sel.hidden = true;
  sel.tabIndex = -1;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "dd-btn";
  btn.setAttribute("aria-haspopup", "listbox");
  btn.setAttribute("aria-expanded", "false");
  btn.setAttribute("aria-label", sel.getAttribute("aria-label") || sel.name || "");
  const menu = document.createElement("ul");
  menu.className = "suggest dd-menu";
  menu.setAttribute("role", "listbox");
  menu.hidden = true;
  wrap.append(btn, menu);
  let active = -1;

  const sync = () => {
    const opt = sel.options[sel.selectedIndex];
    btn.innerHTML = `${dotFor(opt)}<span class="dd-label">${esc(opt?.textContent || "")}</span>${CHEVRON}`;
  };
  const paint = () => {
    menu.innerHTML = [...sel.options].map((o, i) => `
      <li role="option" data-i="${i}" aria-selected="${o.selected}" class="${i === active ? "active" : ""}">
        ${dotFor(o)}<span>${esc(o.textContent)}</span>
        ${o.selected ? `<svg class="check" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>` : ""}
      </li>`).join("");
  };
  const setActive = (i) => {
    menu.querySelector(".active")?.classList.remove("active");
    active = i;
    const li = menu.querySelector(`[data-i="${i}"]`);
    li?.classList.add("active");
    li?.scrollIntoView({ block: "nearest" });
  };
  const close = (focus = false) => {
    if (menu.hidden) return;
    menu.hidden = true;
    btn.setAttribute("aria-expanded", "false");
    wrap.classList.remove("open");
    openDropdown = null;
    if (focus) btn.focus();
  };
  const open = () => {
    openDropdown?.close();
    active = sel.selectedIndex;
    paint();
    menu.hidden = false;
    btn.setAttribute("aria-expanded", "true");
    wrap.classList.add("open");
    placeFloating(btn, menu, { minWidth: 200, maxHeight: 320 });
    menu.querySelector(".active")?.scrollIntoView({ block: "nearest" });
    openDropdown = { close, wrap, menu, reposition: () => placeFloating(btn, menu, { minWidth: 200, maxHeight: 320 }) };
  };
  const choose = (i) => {
    if (i >= 0 && i !== sel.selectedIndex) {
      sel.selectedIndex = i;
      sync();
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    }
    close(true);
  };

  btn.addEventListener("click", () => (menu.hidden ? open() : close()));
  btn.addEventListener("keydown", (e) => {
    const n = sel.options.length;
    if (menu.hidden) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) { e.preventDefault(); open(); }
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((active + 1) % n); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((active - 1 + n) % n); }
    else if (e.key === "Home") { e.preventDefault(); setActive(0); }
    else if (e.key === "End") { e.preventDefault(); setActive(n - 1); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(active); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(true); }
    else if (e.key === "Tab") close();
    else if (e.key.length === 1) {
      const k = e.key.toLowerCase();
      const opts = [...sel.options];
      const next = opts.findIndex((o, i) => i > active && o.textContent.trim().toLowerCase().startsWith(k));
      const i = next >= 0 ? next : opts.findIndex((o) => o.textContent.trim().toLowerCase().startsWith(k));
      if (i >= 0) setActive(i);
    }
  });
  menu.addEventListener("mousemove", (e) => {
    const li = e.target.closest("[data-i]");
    if (li && Number(li.dataset.i) !== active) setActive(Number(li.dataset.i));
  });
  menu.addEventListener("mousedown", (e) => e.preventDefault());
  menu.addEventListener("click", (e) => {
    const li = e.target.closest("[data-i]");
    if (li) choose(Number(li.dataset.i));
  });

  // Keep the button label in sync when code sets .value / .innerHTML or a form resets.
  const proto = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
  Object.defineProperty(sel, "value", { get() { return proto.get.call(this); }, set(v) { proto.set.call(this, v); sync(); } });
  new MutationObserver(sync).observe(sel, { childList: true, subtree: true });
  sel.form?.addEventListener("reset", () => setTimeout(sync));
  sync();
}

document.addEventListener("mousedown", (e) => {
  if (openDropdown && !openDropdown.wrap.contains(e.target)) openDropdown.close();
});
addEventListener("scroll", (e) => {
  if (openDropdown && e.target !== openDropdown.menu) openDropdown.reposition();
}, true);
addEventListener("resize", () => openDropdown?.reposition());

const state = { games: [], admin: false, tab: "All", q: "", genre: "", rating: "", sort: "name", current: null, suggestions: [] };
const BASE_TITLE = document.title.includes("·") ? "Game Library" : document.title;
const slug = (s) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
/** The game id in a /game/<id> URL, or "". */
const gamePath = () => decodeURIComponent(location.pathname.match(/^\/game\/([^/]+)\/?$/)?.[1] || "");
const FILTER_KEY = "filters-v2";

/* ---------------- Data ---------------- */
async function api(path, opts = {}) {
  const res = await fetch(path, { redirect: "manual", ...opts });
  if (res.status === 401) throw new Error("You're signed out. Sign in again at /admin.");
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Request failed (${res.status})`);
  const text = await res.text(); // 201/204 replies may have no body
  return text ? JSON.parse(text) : null;
}

function replaceGame(game) {
  state.games = state.games.map((g) => (g.id === game.id ? game : g));
}

async function init() {
  const [games, admin] = await Promise.all([
    api("/api/games"),
    fetch("/api/admin/me", { redirect: "manual" }).then((r) => r.ok).catch(() => false),
  ]);
  state.games = games;
  state.admin = admin;
  $("#adminBar").hidden = !admin;
  $("#suggestBtn").hidden = admin;
  restoreFilters();
  render();
  const id = gamePath();
  if (id && state.games.some((g) => g.id === id)) openDetail(id, { push: false });
  else if (id) { history.replaceState(null, "", "/"); toast("That game isn't in the library"); }
  if (admin) loadSuggestions().catch(() => {});
}

/* ---------------- Rendering ---------------- */
function render() {
  renderStats();
  renderTabs();
  renderGenreFilter();
  renderRatingFilter();
  renderGrid();
}

function renderRatingFilter() {
  $("#rating").innerHTML = RATING_FILTERS.map(([v, label, test, dot]) => {
    const n = v ? ` (${state.games.filter((g) => test(g.rating)).length})` : "";
    return `<option value="${v}"${dot ? ` data-cls="${dot}"` : ""}${v === state.rating ? " selected" : ""}>${label}${n}</option>`;
  }).join("");
}

function renderStats() {
  const played = state.games.filter((g) => g.status !== "Wishlist");
  const rated = played.filter((g) => g.rating);
  const avg = rated.length ? (rated.reduce((s, g) => s + g.rating, 0) / rated.length).toFixed(1) : "–";
  const count = (s) => state.games.filter((g) => g.status === s).length;
  const items = [
    ["Games played", played.length],
    ["Completed", `${count("Completed")} <small>${played.length ? Math.round((count("Completed") / played.length) * 100) : 0}%</small>`],
    ["Rated 9+", played.filter((g) => g.rating >= 9).length],
    ["Avg rating", `${avg} <small>/ 10</small>`],
    ["Wishlist", count("Wishlist")],
  ];
  $("#stats").innerHTML = items.map(([k, v]) => `<div class="stat"><dt>${k}</dt><dd>${v}</dd></div>`).join("");
}

function renderTabs() {
  const tabs = ["All", ...STATUSES].map((s) => {
    const n = s === "All" ? state.games.length : state.games.filter((g) => g.status === s).length;
    if (!n && s !== "All") return "";
    return `<button class="tab" role="tab" data-tab="${s}" aria-selected="${state.tab === s}">${s}<span class="n">${n}</span></button>`;
  });
  $("#tabs").innerHTML = tabs.join("");
}

const allGenres = () => [...new Set(state.games.flatMap((g) => g.genres))].sort((a, b) => a.localeCompare(b));

function renderGenreFilter() {
  $("#genre").innerHTML = `<option value="">All genres</option>` +
    allGenres().map((g) => `<option${g === state.genre ? " selected" : ""}>${esc(g)}</option>`).join("");
}

function filtered() {
  const q = state.q.trim().toLowerCase();
  const ratingTest = (RATING_FILTERS.find(([v]) => v === state.rating) || RATING_FILTERS[0])[2];
  const list = state.games.filter((g) =>
    (state.tab === "All" || g.status === state.tab) &&
    (!state.genre || g.genres.includes(state.genre)) &&
    ratingTest(g.rating) &&
    (!q || g.name.toLowerCase().includes(q) || (g.developer || "").toLowerCase().includes(q)));
  const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
  const by = {
    name: byName,
    rating: (a, b) => (b.rating || 0) - (a.rating || 0) || byName(a, b),
    released: (a, b) => (b.released || "").localeCompare(a.released || "") || byName(a, b),
    added: (a, b) => (b.added || "").localeCompare(a.added || "") || byName(a, b),
  };
  return list.sort(by[state.sort] || byName);
}

function renderGrid() {
  const list = filtered();
  $("#count").textContent = `${list.length} ${list.length === 1 ? "game" : "games"}`;
  $("#empty").hidden = list.length > 0;
  $("#grid").innerHTML = list.map((g, i) => `
    <button class="card ${cls(g.status)}" data-id="${esc(g.id)}">
      ${g.cover
        ? `<img src="${esc(coverSrc(g))}" alt="" loading="${i < 12 ? "eager" : "lazy"}" decoding="async">`
        : `<div class="no-cover">${esc(g.name.slice(0, 1))}</div>`}
      <div class="card-top">
        <span class="pill ${cls(g.status)}">${g.status}</span>
        ${scoreRing(g.rating)}
      </div>
      <div class="card-info">
        <h3>${esc(g.name)}</h3>
        <p>${esc([g.developer, year(g.released)].filter(Boolean).join(" · "))}</p>
      </div>
    </button>`).join("");
}

/* ---------------- Detail ---------------- */
function openDetail(id, { push = true } = {}) {
  const g = state.games.find((x) => x.id === id);
  if (!g) return;
  const path = `/game/${encodeURIComponent(g.id)}`;
  if (push && location.pathname !== path) history.pushState({ detail: g.id }, "", path);
  document.title = `${g.name} · ${BASE_TITLE}`;
  state.current = g;
  $("#dCover").src = coverSrc(g);
  $("#dCover").hidden = !g.cover;
  $("#dStatus").className = `pill ${cls(g.status)}`;
  $("#dStatus").textContent = g.status;
  $("#dName").textContent = g.name;
  $("#dRating").innerHTML = g.rating ? scoreRing(g.rating, "lg") + `<span class="score-word t-${tier(g.rating)[1]}">${tier(g.rating)[2]}</span>` : "";
  $("#dGenres").innerHTML = g.genres.map((x) => `<span class="chip">${esc(x)}</span>`).join("");
  $("#dGenres").hidden = !g.genres.length;
  const facts = [
    ["Developer", g.developer || "—"],
    ["Released", fmtDate(g.released)],
    ["Added", fmtDate(g.added)],
    ["Rating", g.rating ? `${g.rating}/10 · ${tier(g.rating)[2]}` : "Unrated", g.rating ? `t-${tier(g.rating)[1]}` : ""],
  ];
  $("#dFacts").innerHTML = facts.map(([k, v, c]) =>
    `<div class="fact"><dt>${k}</dt><dd class="${c || ""}" title="${esc(v)}">${esc(v)}</dd></div>`).join("");
  $("#dNotes").textContent = g.notes || "";
  $("#dNotesBlock").hidden = !g.notes;
  $("#dActions").hidden = !state.admin;
  if (!$("#detail").open) $("#detail").showModal();
  $("#detail").scrollTop = 0;
}

/* Closing the detail view returns the URL to the library; Back/Forward open and close it. */
$("#detail").addEventListener("close", () => {
  document.title = BASE_TITLE;
  if (!gamePath()) return;
  if (history.state?.detail) history.back();
  else history.replaceState(null, "", "/");
});
addEventListener("popstate", () => {
  const id = gamePath();
  if (id) openDetail(id, { push: false });
  else if ($("#detail").open) $("#detail").close();
});

$("#shareBtn").addEventListener("click", async () => {
  const g = state.current;
  const url = `${location.origin}/game/${encodeURIComponent(g.id)}`;
  if (navigator.share && matchMedia("(pointer: coarse)").matches) {
    try { await navigator.share({ title: g.name, url }); } catch {}
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    toast("Link copied");
  } catch {
    prompt("Copy this link:", url);
  }
});

/** Dates are shown in English for every visitor, e.g. "Nov 17, 2009". */
const fmtDate = (d) =>
  d ? new Date(d + "T00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

/* ---------------- Editor ---------------- */
const form = $("#form");
let editing = null, editGenres = [], editRating = null, pendingCover = null, fromSuggestion = null;

form.status.innerHTML = STATUSES.map((s) => `<option data-cls="${cls(s)}">${s}</option>`).join("");
[$("#genre"), $("#rating"), $("#sort"), form.status].forEach(enhanceSelect);
const setEditRating = ratingPicker($("#ratingInput"), (n) => setRating(n === editRating ? null : n));

function setRating(n) {
  editRating = n;
  setEditRating(n);
  $("#ratingLabel").textContent = n ? `${n}/10 · ${tier(n)[2]}` : "Not rated";
  $("#ratingLabel").className = "rating-label" + (n ? ` t-${tier(n)[1]}` : "");
}

/* Genre tags + custom suggestion menu */
const genreText = $("#genreText"), genreMenu = $("#genreMenu");
let suggestions = [], active = -1;

function renderGenreChips() {
  document.querySelectorAll("#genreInput .chip").forEach((c) => c.remove());
  genreText.insertAdjacentHTML("beforebegin",
    editGenres.map((g, i) => `<span class="chip">${esc(g)}<button type="button" data-rm="${i}" aria-label="Remove ${esc(g)}">×</button></span>`).join(""));
}

function addGenre(text) {
  const g = text.trim();
  if (g && !editGenres.some((x) => x.toLowerCase() === g.toLowerCase())) editGenres.push(g);
  genreText.value = "";
  renderGenreChips();
  closeMenu();
}

function openMenu() {
  const q = genreText.value.trim().toLowerCase();
  const taken = new Set(editGenres.map((g) => g.toLowerCase()));
  suggestions = allGenres().filter((g) => !taken.has(g.toLowerCase()) && g.toLowerCase().includes(q));
  const exact = suggestions.some((g) => g.toLowerCase() === q);
  if (q && !exact && !taken.has(q)) suggestions.push({ create: genreText.value.trim() });
  active = suggestions.length ? 0 : -1;
  paintMenu();
}

function paintMenu() {
  const wasHidden = genreMenu.hidden;
  genreMenu.hidden = !suggestions.length;
  genreText.setAttribute("aria-expanded", String(!genreMenu.hidden));
  genreMenu.innerHTML = suggestions.map((s, i) => `<li role="option" data-i="${i}" class="${i === active ? "active" : ""}" aria-selected="${i === active}">
    ${typeof s === "string" ? esc(s) : `<span class="muted">Add</span> “${esc(s.create)}”`}</li>`).join("");
  if (!genreMenu.hidden) placeMenu();
}

function placeMenu() {
  if (!genreMenu.hidden) placeFloating($("#genreInput"), genreMenu);
}
form.addEventListener("scroll", placeMenu);
addEventListener("resize", placeMenu);

function setActive(i) {
  if (i === active) return;
  genreMenu.querySelector(".active")?.classList.remove("active");
  active = i;
  const li = genreMenu.querySelector(`[data-i="${i}"]`);
  li?.classList.add("active");
  return li;
}

function closeMenu() {
  suggestions = [];
  active = -1;
  paintMenu();
}

const pick = (i) => { const s = suggestions[i]; if (s) addGenre(typeof s === "string" ? s : s.create); };

genreText.addEventListener("focus", openMenu);
genreText.addEventListener("input", openMenu);
genreText.addEventListener("blur", () => setTimeout(closeMenu, 120));
genreText.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    if (!suggestions.length) return openMenu();
    setActive((active + (e.key === "ArrowDown" ? 1 : -1) + suggestions.length) % suggestions.length)
      ?.scrollIntoView({ block: "nearest" });
  } else if (e.key === "Enter" || e.key === ",") {
    e.preventDefault();
    if (active >= 0) pick(active); else if (genreText.value.trim()) addGenre(genreText.value);
    openMenu();
  } else if (e.key === "Escape" && !genreMenu.hidden) {
    e.preventDefault();
    e.stopPropagation();
    closeMenu();
  } else if (e.key === "Backspace" && !genreText.value && editGenres.length) {
    editGenres.pop();
    renderGenreChips();
    openMenu();
  }
});
genreMenu.addEventListener("mousemove", (e) => {
  const li = e.target.closest("[data-i]");
  if (li) setActive(Number(li.dataset.i));
});
genreMenu.addEventListener("mousedown", (e) => {
  const li = e.target.closest("[data-i]");
  if (!li) return;
  e.preventDefault();
  pick(Number(li.dataset.i));
  openMenu();
});
$("#genreInput").addEventListener("click", (e) => {
  const rm = e.target.closest("[data-rm]");
  if (rm) { editGenres.splice(Number(rm.dataset.rm), 1); renderGenreChips(); }
  genreText.focus();
});

function setPreview(src) {
  $("#preview").src = src || "";
  $("#preview").hidden = !src;
  $("#drop").classList.toggle("has-image", !!src);
}

/** prefill (new games only): { name, status, notes, suggestionId } from the suggestion inbox. */
function openEditor(game = null, prefill = null) {
  editing = game;
  fromSuggestion = prefill?.suggestionId ?? null;
  pendingCover = null;
  form.reset();
  closeLookup();
  $("#formError").textContent = "";
  $("#formTitle").textContent = game ? "Edit game" : "Add game";
  form.name.value = game?.name || prefill?.name || "";
  form.status.value = game?.status || prefill?.status || "Completed";
  form.released.value = game?.released || "";
  form.developer.value = game?.developer || "";
  form.notes.value = game?.notes || prefill?.notes || "";
  editGenres = [...(game?.genres || [])];
  renderGenreChips();
  setRating(game?.rating || null);
  setPreview(game ? coverSrc(game) : "");
  $("#detail").close();
  $("#editor").showModal();
  form.name.focus();
  if (prefill?.name) searchLookup();
}

/* ---------------- Auto-fill from RAWG ---------------- */
const lookupMenu = $("#lookupMenu");
let lookupResults = [], lookupActive = -1, lookupTimer, lookupAbort, lookupOff = false;

function paintLookup() {
  lookupMenu.hidden = !lookupResults.length;
  form.name.setAttribute("aria-expanded", String(!lookupMenu.hidden));
  lookupMenu.innerHTML = lookupResults.map((r, i) => `
    <li role="option" data-i="${i}" class="${i === lookupActive ? "active" : ""}" aria-selected="${i === lookupActive}">
      ${r.thumb ? `<img src="${esc(r.thumb)}" alt="" loading="lazy">` : `<span class="thumb-none"></span>`}
      <span class="lk-name">${esc(r.name)}</span><span class="lk-year">${esc(r.year)}</span>
    </li>`).join("") + (lookupResults.length ? `<li class="lk-foot" aria-hidden="true">Fills in date, developer, genres and cover</li>` : "");
  if (!lookupMenu.hidden) placeFloating(form.name, lookupMenu, { maxHeight: 340 });
}

function closeLookup() {
  clearTimeout(lookupTimer);
  lookupAbort?.abort();
  lookupResults = [];
  lookupActive = -1;
  paintLookup();
}

async function searchLookup() {
  const q = form.name.value.trim();
  lookupAbort?.abort();
  if (lookupOff || q.length < 2) return closeLookup();
  lookupAbort = new AbortController();
  try {
    lookupResults = await api(`/api/admin/lookup?q=${encodeURIComponent(q)}`, { signal: lookupAbort.signal });
    lookupActive = lookupResults.length ? 0 : -1;
    if (document.activeElement === form.name) paintLookup();
  } catch (err) {
    if (err.name === "AbortError") return;
    if (/isn't set up/.test(err.message)) lookupOff = true; // no API key: stay quiet from now on
    closeLookup();
  }
}

async function applyLookup(i) {
  const r = lookupResults[i];
  if (!r) return;
  closeLookup();
  form.name.value = r.name;
  try {
    const d = await api(`/api/admin/lookup?id=${r.id}`);
    form.name.value = d.name || r.name;
    if (d.released) form.released.value = d.released;
    if (d.developer) form.developer.value = d.developer;
    const known = new Map(allGenres().map((g) => [g.toLowerCase(), g])); // reuse your spelling of a genre
    for (const g of d.genres) {
      const name = known.get(g.toLowerCase()) || g;
      if (!editGenres.some((x) => x.toLowerCase() === name.toLowerCase())) editGenres.push(name);
    }
    renderGenreChips();
    if (d.cover && !pendingCover) { form.coverUrl.value = d.cover; setPreview(d.cover); }
    toast("Details filled in");
  } catch (err) {
    $("#formError").textContent = err.message;
  }
}

form.name.addEventListener("input", () => {
  clearTimeout(lookupTimer);
  lookupTimer = setTimeout(searchLookup, 250);
});
form.name.addEventListener("blur", () => setTimeout(closeLookup, 150));
form.name.addEventListener("keydown", (e) => {
  if (lookupMenu.hidden) return;
  const n = lookupResults.length;
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    lookupActive = (lookupActive + (e.key === "ArrowDown" ? 1 : -1) + n) % n;
    paintLookup();
    lookupMenu.querySelector(".active")?.scrollIntoView({ block: "nearest" });
  } else if (e.key === "Enter" && lookupActive >= 0) {
    e.preventDefault();
    applyLookup(lookupActive);
  } else if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    closeLookup();
  }
});
lookupMenu.addEventListener("mousedown", (e) => {
  const li = e.target.closest("[data-i]");
  e.preventDefault();
  if (li) applyLookup(Number(li.dataset.i));
});
form.addEventListener("scroll", () => { if (!lookupMenu.hidden) placeFloating(form.name, lookupMenu, { maxHeight: 340 }); });

/** Downscale any image to a <=960px WebP before upload. */
async function toWebp(file) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 960 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((r) => canvas.toBlob(r, "image/webp", 0.82));
}

async function pickCover(file) {
  if (!file?.type.startsWith("image/")) return;
  try {
    pendingCover = await toWebp(file);
    setPreview(URL.createObjectURL(pendingCover));
    form.coverUrl.value = "";
  } catch {
    $("#formError").textContent = "Couldn't read that image.";
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (genreText.value.trim()) addGenre(genreText.value);
  const payload = {
    name: form.name.value,
    status: form.status.value,
    released: form.released.value || null,
    developer: form.developer.value,
    rating: editRating,
    genres: editGenres,
    notes: form.notes.value,
  };
  if (!payload.name.trim()) return ($("#formError").textContent = "Give the game a name.");
  $("#saveBtn").disabled = true;
  $("#formError").textContent = "";
  try {
    const json = (body) => ({ method: editing ? "PUT" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    let game = await api(editing ? `/api/admin/games/${editing.id}` : "/api/admin/games", json(payload));
    const url = form.coverUrl.value.trim();
    if (pendingCover) {
      game = await api(`/api/admin/cover/${game.id}`, { method: "PUT", headers: { "content-type": "image/webp" }, body: pendingCover });
    } else if (url) {
      game = await api(`/api/admin/cover/${game.id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) });
    }
    if (editing) replaceGame(game); else state.games.push(game);
    $("#editor").close();
    render();
    toast(editing ? "Saved" : `Added ${game.name}`);
    if (fromSuggestion != null) dismissSuggestion(fromSuggestion).catch(() => {});
  } catch (err) {
    $("#formError").textContent = err.message;
  } finally {
    $("#saveBtn").disabled = false;
  }
});

/* ---------------- Events ---------------- */
$("#grid").addEventListener("click", (e) => {
  const card = e.target.closest(".card");
  if (card) openDetail(card.dataset.id);
});
$("#tabs").addEventListener("click", (e) => {
  const t = e.target.closest("[data-tab]");
  if (!t) return;
  state.tab = t.dataset.tab;
  saveFilters();
  renderTabs();
  renderGrid();
});
$("#search").addEventListener("input", (e) => { state.q = e.target.value; renderGrid(); });
$("#genre").addEventListener("change", (e) => { state.genre = e.target.value; saveFilters(); renderGrid(); });
$("#rating").addEventListener("change", (e) => { state.rating = e.target.value; saveFilters(); renderGrid(); });
$("#sort").addEventListener("change", (e) => { state.sort = e.target.value; saveFilters(); renderGrid(); });

document.querySelectorAll("dialog").forEach((d) => {
  d.addEventListener("click", (e) => {
    if (e.target === d || e.target.closest("[data-close]")) d.close();
  });
});

$("#addBtn").addEventListener("click", () => openEditor());
$("#logoutBtn").addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" }).catch(() => {});
  location.reload();
});
$("#editBtn").addEventListener("click", () => openEditor(state.current));
$("#deleteBtn").addEventListener("click", async () => {
  const g = state.current;
  if (!confirm(`Delete "${g.name}"? This can't be undone.`)) return;
  try {
    await api(`/api/admin/games/${g.id}`, { method: "DELETE" });
    state.games = state.games.filter((x) => x.id !== g.id);
    $("#detail").close();
    render();
    toast("Deleted");
  } catch (err) {
    alert(err.message);
  }
});

const drop = $("#drop");
drop.addEventListener("click", () => $("#file").click());
drop.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); $("#file").click(); } });
$("#file").addEventListener("change", (e) => pickCover(e.target.files[0]));
drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
drop.addEventListener("dragleave", () => drop.classList.remove("over"));
drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("over"); pickCover(e.dataTransfer.files[0]); });
$("#editor").addEventListener("paste", (e) => {
  const file = [...e.clipboardData.files].find((f) => f.type.startsWith("image/"));
  if (file) { e.preventDefault(); pickCover(file); }
});
form.coverUrl.addEventListener("input", () => {
  const url = form.coverUrl.value.trim();
  if (url) { pendingCover = null; setPreview(url); }
  else setPreview(editing ? coverSrc(editing) : "");
});

$("#exportBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state.games, null, 2)], { type: "application/json" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `games-${new Date().toISOString().slice(0, 10)}.json` });
  a.click();
  URL.revokeObjectURL(a.href);
});

/* ---------------- Suggestions: public form ---------------- */
const sForm = $("#suggestForm");

function openSuggest() {
  sForm.reset();
  sForm.hidden = false;
  $("#suggestDone").hidden = true;
  $("#suggestError").textContent = "";
  $("#suggestHint").hidden = true;
  $("#suggest").showModal();
  sForm.game.focus();
}

/** Tells people when the game they typed is already in the library. */
function inLibraryNote(name) {
  const key = slug(name || "");
  const g = key && state.games.find((x) => slug(x.name) === key);
  if (!g) return "";
  if (g.status === "Wishlist") return "Already on the wishlist. It's coming!";
  return `Already in the library: ${g.status}${g.rating ? ` · rated ${g.rating}/10` : ""}`;
}

sForm.game.addEventListener("input", () => {
  const note = inLibraryNote(sForm.game.value);
  $("#suggestHint").textContent = note;
  $("#suggestHint").hidden = !note;
});

sForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!sForm.game.value.trim()) return ($("#suggestError").textContent = "Which game should I play?");
  $("#suggestSend").disabled = true;
  $("#suggestError").textContent = "";
  try {
    await api("/api/suggest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        game: sForm.game.value, message: sForm.message.value, from: sForm.from.value, website: sForm.website.value,
      }),
    });
    sForm.hidden = true;
    $("#suggestDone").hidden = false;
  } catch (err) {
    $("#suggestError").textContent = err.message;
  } finally {
    $("#suggestSend").disabled = false;
  }
});
$("#suggestBtn").addEventListener("click", openSuggest);
$("#suggestAgain").addEventListener("click", openSuggest);

/* ---------------- Suggestions: owner inbox ---------------- */
async function loadSuggestions() {
  state.suggestions = await api("/api/admin/suggestions");
  renderInbox();
}

function renderInbox() {
  const list = state.suggestions;
  $("#inboxCount").textContent = list.length > 99 ? "99+" : list.length;
  $("#inboxCount").hidden = !list.length;
  $("#inboxEmpty").hidden = list.length > 0;
  $("#inboxList").innerHTML = list.map((s) => {
    const note = inLibraryNote(s.game);
    const meta = [s.from_name ? `from ${esc(s.from_name)}` : "anonymous", fmtDate(s.created.slice(0, 10))].join(" · ");
    return `<li class="sugg">
      <div class="sugg-main">
        <h3>${esc(s.game)}</h3>
        <p class="sugg-meta">${meta}</p>
        ${note ? `<p class="hint">${esc(note)}</p>` : ""}
        ${s.message ? `<p class="sugg-msg">${esc(s.message)}</p>` : ""}
      </div>
      <div class="sugg-actions">
        <button class="btn ghost" data-dismiss="${s.id}">Dismiss</button>
        <button class="btn primary" data-wish="${s.id}">Add to wishlist</button>
      </div>
    </li>`;
  }).join("");
}

async function dismissSuggestion(id) {
  await api(`/api/admin/suggestions/${id}`, { method: "DELETE" });
  state.suggestions = state.suggestions.filter((s) => s.id !== id);
  renderInbox();
}

$("#inboxBtn").addEventListener("click", () => {
  renderInbox();
  $("#inbox").showModal();
  loadSuggestions().catch((err) => toast(err.message));
});
$("#inboxList").addEventListener("click", async (e) => {
  const dismiss = e.target.closest("[data-dismiss]");
  const wish = e.target.closest("[data-wish]");
  if (dismiss) {
    dismiss.disabled = true;
    try { await dismissSuggestion(Number(dismiss.dataset.dismiss)); } catch (err) { toast(err.message); dismiss.disabled = false; }
  } else if (wish) {
    const s = state.suggestions.find((x) => x.id === Number(wish.dataset.wish));
    if (!s) return;
    const who = s.from_name ? `Suggested by ${s.from_name}` : "Suggested by a visitor";
    $("#inbox").close();
    openEditor(null, {
      name: s.game, status: "Wishlist", suggestionId: s.id,
      notes: s.message ? `${who}: “${s.message}”` : who,
    });
  }
});

/* ---------------- Misc ---------------- */
let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  clearTimeout(toastTimer);
  // Re-show the popover so it stacks above any dialog opened since the last toast.
  if (t.showPopover) {
    if (t.matches(":popover-open")) t.hidePopover();
    t.showPopover();
  }
  t.classList.remove("show");
  void t.offsetWidth; // restart the fade-in
  t.classList.add("show");
  toastTimer = setTimeout(() => {
    t.classList.remove("show");
    toastTimer = setTimeout(() => t.hidePopover?.(), 250);
  }, 2200);
}

function saveFilters() {
  try { localStorage.setItem(FILTER_KEY, JSON.stringify({ tab: state.tab, genre: state.genre, rating: state.rating, sort: state.sort })); } catch {}
}
function restoreFilters() {
  try { Object.assign(state, JSON.parse(localStorage.getItem(FILTER_KEY) || "{}")); } catch {}
  $("#sort").value = state.sort;
}

init().catch((err) => {
  $("#grid").innerHTML = "";
  $("#empty").hidden = false;
  $("#empty").textContent = `Couldn't load games: ${err.message}`;
});
