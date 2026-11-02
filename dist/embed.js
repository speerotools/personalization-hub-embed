/* ============================================================
   Speero Personalization Hub: embed
   ============================================================
   A port of Nick's prototype (nick-personalization-hub.vercel.app,
   Speero-AI/pzn-prototype-alignment) to a single Webflow embed. Every
   heading, label and line of copy is taken from the prototype's
   components. Production changes on top:

     1. data is fetched from personalization-hub-data instead of bundled
     2. routes are hash routes on one Webflow page (#/assess, #/opportunities,
        #/opportunities/<id>, #/tools, #/tools/<id>, #/compare, #/explore,
        #/guide, #/research, #/blueprints)
     3. the prototype's own header and footer are gone. The site header and
        the shared hub nav replace them: the hub nav's Personalization
        section row (Overview, Assess, Explore, Tools) is the old top nav,
        and this script keeps its current section in step with the route
     4. every style is scoped under the mount

   Kept from the prototype fixes: filters live in the URL, so refresh and
   Back restore them; compare is capped at three tools; search fields have
   labels; the explorer has its own heading.

   Usage in a Webflow Code Embed:

     <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/speerotools/personalization-hub-embed@v1.0.0/dist/embed.css">
     <div id="speero-personalization-hub"></div>
     <script src="https://cdn.jsdelivr.net/gh/speerotools/personalization-hub-embed@v1.0.0/dist/embed.js" defer></script>

   Pin the version tag, never @main.
   ============================================================ */
(function () {
"use strict";

const CFG = Object.assign({
  dataUrl:   "https://cdn.jsdelivr.net/gh/speerotools/personalization-hub-data@main/personalization-hub.json",
  // Tool logos sit next to the JSON unless this says otherwise.
  assetBase: null,
  mount:     "speero-personalization-hub",
  defaultRoute: "",
  // Detail links. null keeps them inside the embed (#/opportunities/<id>).
  // Set to the CMS bases once the template pages are designed, so each item
  // has one indexed address instead of two competing ones.
  opportunityBase: null,   // "/personalization-opportunities/"
  toolBase:        null    // "/personalization-tools/"
}, window.PERSONALIZATION_HUB_CONFIG || {});

const root = document.getElementById(CFG.mount);
if (!root) return;
const assetBase = CFG.assetBase || CFG.dataUrl.replace(/[^/]*$/, "");

let D = null;          // the hub data
const T = {};          // taxonomy lookups, id -> record
const byId = {};       // opportunities, tools, library by id

/* ---------- helpers ---------- */
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const host = u => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return u; } };
const lbl = (k, id) => (T[k][id] || {}).label || "";
const pad = n => String(n).padStart(2, "0");
const oppHref = id => esc(CFG.opportunityBase ? CFG.opportunityBase + id : "#/opportunities/" + id);
const toolHref = id => esc(CFG.toolBase ? CFG.toolBase + id : "#/tools/" + id);

/* Lucide icons, paths copied from the prototype bundle. */
const ICONS = {
  radio: '<path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/><circle cx="12" cy="12" r="2"/><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19"/>',
  focus: '<circle cx="12" cy="12" r="3"/><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>',
  scale: '<path d="m16 16 3-8 3 8c-.87.65-1.920 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>',
  panels: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/>',
  flask: '<path d="M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2"/><path d="M6.453 15h11.094"/><path d="M8.5 2h7"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  goal: '<path d="M12 13V2l8 4-8 4"/><path d="M20.561 10.222a9 9 0 1 1-12.55-5.29"/><path d="M8.002 9.997a5 5 0 1 0 8.9 2.02"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><path d="M16 3.128a4 4 0 0 1 0 7.744"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/>',
  wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  workflow: '<rect width="8" height="8" x="3" y="3" rx="2"/><path d="M7 11v4a2 2 0 0 0 2 2h4"/><rect width="8" height="8" x="13" y="13" rx="2"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  minus: '<path d="M5 12h14"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  search: '<path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/>',
  arrowUpRight: '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>'
};
const ico = (name, cls, sw) =>
  `<svg class="${cls || ""}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw || 2}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
const arrowSmall = '<svg class="ph-arrow-sm" width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 17L17 7M17 7H8M17 7V16" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const STEP_ICON = { signals: "radio", need: "focus", value: "scale", response: "panels", moment: "flask" };
const PILLAR_ICON = { strategy: "goal", people: "users", data: "wrench", process: "workflow" };

function logo(t, size) {
  const px = size === "lg" ? 48 : size === "sm" ? 24 : 32;
  const fb = `<span class="ph-logo ph-logo-${size || "md"} ph-logo-fb" aria-hidden="true">${esc(t.name.slice(0, 1))}</span>`;
  if (!t.logo) return fb;
  return `<img class="ph-logo ph-logo-${size || "md"}" src="${esc(assetBase + t.logo)}" alt="" width="${px}" height="${px}" data-fallback="${esc(t.name.slice(0, 1))}">`;
}

/* ---------- persisted state (compare, audit answers, business, guide) ----------
   Per-viewer convenience only, so every read and write is guarded: a blocked
   storage just means the state lasts for the visit. */
const KEY = "speero-personalization-hub";
const store = (() => {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) {}
  return Object.assign({ compared: [], answers: {}, model: null,
    guide: { model: null, stage: null, situation: null, contexts: ["declared", "connected", "inferred"] } }, s);
})();
function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} }

function toggleCompare(id) {
  const c = store.compared;
  if (c.includes(id)) store.compared = c.filter(x => x !== id);
  else if (c.length < 3) store.compared = c.concat(id);
  save();
}

/* ---------- maturity scoring (same rules as the prototype) ---------- */
const points = v => v === "consistently" ? 2 : v === "some" ? 1 : 0;
const answered = v => v === "not-yet" || v === "some" || v === "consistently";
const allItems = () => D.pillars.flatMap(p => p.items.map(i => i.id));
const QUESTIONS = () => allItems().length;
const MAX = () => QUESTIONS() * 2;
const total = a => allItems().reduce((n, id) => n + points(a[id]), 0);
const countAnswered = a => allItems().filter(id => answered(a[id])).length;
const pillarScore = (p, a) => p.items.reduce((n, i) => n + points(a[i.id]), 0);
const pillarDone = (p, a) => p.items.every(i => answered(a[i.id]));
const band = s => D.levels.find(l => s >= l.min && s <= l.max) || D.levels[0];
const weakItem = (p, a) => p.items.find(i => points(a[i.id]) === 0 && answered(a[i.id])) ||
  p.items.find(i => a[i.id] === "some");
function nextStep(a) {
  const open = D.pillars.find(p => !pillarDone(p, a));
  if (open) return { headline: "Finish your assessment", body: "Answer the remaining questions before choosing a next step from your score." };
  const weakest = D.pillars.reduce((w, p) => pillarScore(p, a) < pillarScore(w, a) ? p : w);
  const item = weakItem(weakest, a);
  return item ? { headline: item.action, body: item.guidance }
    : { headline: "Put the whole loop to work", body: "Choose one customer situation, test a useful response and use the result to improve your next decision." };
}

/* ---------- routing ---------- */
function parseHash() {
  const h = location.hash.replace(/^#\/?/, "") || CFG.defaultRoute;
  const [path, qs] = h.split("?");
  return { parts: path.split("/").filter(Boolean), q: new URLSearchParams(qs || "") };
}
// Filter changes replace the history entry instead of adding one, like the
// prototype, so Back leaves the view rather than stepping through keystrokes.
function setQuery(base, obj) {
  const q = new URLSearchParams();
  Object.keys(obj).forEach(k => { if (obj[k] !== "" && obj[k] != null && obj[k] !== "all") q.set(k, obj[k]); });
  const s = q.toString();
  history.replaceState(history.state, "", "#/" + base + (s ? "?" + s : ""));
}

/* The shared hub nav (Webflow "Hub Nav" component) carries the four
   Personalization sections as its second row. The page is one Webflow page,
   so the current section follows the hash route. */
const SECTION_OF = { "": "overview", assess: "assess", opportunities: "explore",
  tools: "tools", compare: "tools", explore: "tools" };
function syncHubNav(first) {
  const nav = document.querySelector('[data-hubnav][data-current="personalization"]');
  if (!nav) return;
  const sec = SECTION_OF[first] || "overview";
  nav.setAttribute("data-section", sec);
  nav.querySelectorAll('.hn-sections[data-for="personalization"] a').forEach(a => {
    if (a.getAttribute("data-section") === sec) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
}

let view = null;   // current view's teardown, if any
let lastExplore = "#/opportunities";

function route() {
  if (!D) return;
  const { parts, q } = parseHash();
  const [a, b] = parts;
  if (view) { view(); view = null; }
  syncHubNav(a || "");
  let html;
  if (!a) html = home();
  else if (a === "assess") return mountAssess();
  else if (a === "opportunities" && !b) return mountOpportunities(q);
  else if (a === "opportunities" && byId.opp[b]) html = opportunity(byId.opp[b]);
  else if (a === "tools" && !b) return mountTools(q);
  else if (a === "tools" && byId.tool[b]) html = tool(byId.tool[b]);
  else if (a === "compare") html = compare();
  else if (a === "explore") return mountExplore(q);
  else if (a === "guide") return mountGuide();
  else if (a === "research") html = research();
  else if (a === "blueprints") html = blueprints();
  else html = notFound();
  paint(html);
}
function paint(html) {
  root.innerHTML = `<div class="ph">${html}</div>`;
  const top = root.getBoundingClientRect().top + window.scrollY;
  if (window.scrollY > top) window.scrollTo(0, Math.max(0, top - 140));
}

/* ---------- shared pieces ---------- */
function fiveSteps(compact) {
  return `<ol class="ph-steps${compact ? " is-compact" : ""}" aria-label="Five steps of personalization">` +
    D.steps.map((s, i) => `<li><div class="ph-steps-top">${ico(STEP_ICON[s.id], "ph-steps-ico", 1.4)}<span class="ph-steps-n">${pad(i + 1)}</span></div>
      <div><p class="ph-steps-label">${esc(s.label)}</p><p class="ph-steps-q">${esc(s.question)}</p></div></li>`).join("") +
    `<li class="ph-steps-loop">${ico("refresh", "ph-steps-ico", 1.4)}<p class="ph-steps-win">Win or lose, learn.</p><p class="ph-steps-note">The learning becomes the next signal.</p></li></ol>`;
}

function pillarMap(detailed) {
  return `<div class="ph-pillars${detailed ? " is-detailed" : ""}" aria-label="Four program pillars">` +
    D.pillars.map((p, i) => `<section${detailed ? ` id="pillar-${p.id}"` : ""}>
      <div class="ph-pillars-top">${ico(PILLAR_ICON[p.id], "ph-pillars-ico", 1.4)}<span class="ph-pillars-n">${pad(i + 1)}</span></div>
      ${detailed ? `<h3>${esc(p.label)}</h3><p class="ph-pillars-q">${esc(p.question)}</p><p class="ph-pillars-d">${esc(p.detail)}</p>`
        : `<p class="ph-pillars-label">${esc(p.label)}</p>`}</section>`).join("") + `</div>`;
}

function pillarsSection() {
  return `<section class="ph-pillar-sec" id="audit-pillars" aria-labelledby="audit-pillars-heading">
    <p class="ph-kicker">What makes your program ready</p>
    <h2 id="audit-pillars-heading" class="ph-display">Four pillars of a strong personalization program.</h2>
    <p class="ph-lede">Assess your strategy, team, data and ways of working. These capabilities support every use case, from the first signal to the next learning.</p>
    ${pillarMap(true)}
    <p class="ph-small">The pillars assess your program. Within each opportunity, use the five-step framework: Signals, Need, Worth it?, Response and Moment.</p></section>`;
}

function oppCard(o, compact) {
  return `<a class="ph-card-opp" href="${oppHref(o.id)}">
    <p class="ph-card-kicker">${esc(lbl("needs", o.situation))} · ${esc(lbl("stages", o.stage))}</p>
    <h3>${esc(o.title)}</h3><p class="ph-card-sum">${esc(o.summary)}</p>
    ${compact ? "" : `<dl><dt>The signal</dt><dd>${esc(o.signals[0] ? o.signals[0].example : o.eligibilityRule)}</dd>
      <dt>A possible response</dt><dd>${esc(o.arms.medium)}</dd></dl>`}
    <div class="ph-card-go"><span>Work through the five steps</span>${ico("arrowUpRight", "ph-ico-sm")}</div></a>`;
}

function bars(filled) {
  return `<span class="ph-bars" aria-hidden="true">` +
    [1, 2, 3, 4, 5].map(i => `<span class="b${i}${i <= filled ? " on" : ""}"></span>`).join("") + `</span>`;
}

const compareLimit = () => `<p class="ph-limit" id="compare-limit" role="status">${store.compared.length >= 3 ? "You can compare up to three tools. Remove one to add another." : ""}</p>`;
const compareBox = id => {
  const on = store.compared.includes(id), full = store.compared.length >= 3;
  return `<label class="ph-cmp${full && !on ? " is-off" : ""}"><input type="checkbox" data-compare="${esc(id)}"${on ? " checked" : ""}${full && !on ? " disabled" : ""}${full ? ' aria-describedby="compare-limit"' : ""}>Compare</label>`;
};
const compareTray = () => store.compared.length ? `<div class="ph-tray"><span>${store.compared.length} selected to compare</span><a href="#/compare">Open comparison</a></div>` : "";

function pageHero(kicker, title, lede) {
  return `<header class="ph-page-hero">${kicker ? `<div class="ph-kicker">${kicker}</div>` : ""}
    <h1 class="ph-hero-h ph-hero-wide">${title}</h1>${lede ? `<div class="ph-lede">${lede}</div>` : ""}</header>`;
}

/* ---------- home ---------- */
function home() {
  const sig = (s, m) => `<span class="ph-sigrow"><span class="ph-sig">${s}</span><span class="ph-sig-arrow" aria-hidden="true">→</span><span class="ph-msg">${m}</span></span>`;
  const row = (n, name, title, body, action, href, preview, note, flip) => `
    <li class="ph-row ph-row-${n}${flip ? " is-flip" : ""}"><div class="ph-row-grid">
      <div class="ph-row-copy"><div class="ph-row-head"><span class="ph-row-n">${n}</span><span class="ph-badge ph-badge-${n}">${name}</span></div>
        <h2 class="ph-display">${title}</h2><p class="ph-lede-sm">${body}</p><div class="ph-preview">${preview}</div></div>
      <div class="ph-row-cta"><a class="ph-btn ph-btn-hl" href="${href}">${action}</a>${note ? `<p class="ph-note">${note}</p>` : ""}</div>
    </div></li>`;
  return `<div class="ph-home">
    <header class="ph-hero"><div>
      <p class="ph-kicker">The personalization hub</p>
      <h1 class="ph-hero-h">Create experiences <span class="ph-pink">customers love.</span></h1>
      <p class="ph-lede">Know what you can use. Understand the need. Make the response worth it. Learn whether it helped. A practical place to work through five practical steps and choose your next move.</p>
      <div class="ph-actions"><a class="ph-btn ph-btn-hl" href="#/assess">Find your starting point</a><a class="ph-textlink" href="#/opportunities">Explore use cases</a></div>
    </div><div class="ph-hero-steps">${fiveSteps(false)}</div></header>
    <ol class="ph-rows">
      ${row(1, "Where you stand", "Build a program that can deliver useful personalization.",
        "Assess Strategy &amp; culture, People &amp; skills, Data &amp; tools, and Process &amp; methodology. Find the foundations to strengthen next.",
        "Start the assessment", "#/assess", pillarMap(false), "We won’t contact you unless you ask us to.")}
      ${row(2, "What to personalize next", "See how a signal becomes a useful response.", "Or skip the audit and browse every use case.",
        "Explore opportunities", "#/opportunities",
        `<span class="ph-sigs">${sig("New visitor", "Show the categories that matter first")}${sig("Repeat visitor", "Pick up in the section they left")}</span>`, "", true)}
      ${row(3, "What you’d need", "Once you know the move, see which tools can actually change the page.",
        "Technology that can change what someone sees. Not another analytics dashboard.", "Browse tools", "#/tools",
        `<span class="ph-logos">${D.tools.slice(0, 6).map(t => `<span class="ph-logo-tile"><span class="ph-logo-box">${logo(t)}</span><span class="ph-logo-name">${esc(t.name)}</span></span>`).join("")}</span>`)}
    </ol></div>`;
}

/* ---------- assess ---------- */
function mountAssess() {
  const a = store.answers;
  const n = countAnswered(a);
  let phase = n === QUESTIONS() ? "results" : "intro";
  let step = Math.max(0, D.pillars.findIndex(p => !pillarDone(p, a)));

  function start() {
    store.model = store.model || store.guide.model || "ecommerce"; save();
    if (!countAnswered(store.answers)) step = 0;
    phase = "quiz"; render(true);
  }
  function render(scroll) {
    if (phase === "intro") paint(intro());
    else if (phase === "results") paint(results());
    else paint(quiz());
    if (scroll) { const top = root.getBoundingClientRect().top + window.scrollY; window.scrollTo(0, Math.max(0, top - 140)); }
  }
  function intro() {
    const ans = countAnswered(store.answers), model = store.model || store.guide.model;
    return `<div class="ph-assess">
      <div class="ph-intro" id="audit-start"><div>
        <p class="ph-kicker">Personalization maturity audit</p>
        <h1 class="ph-hero-h">Know where you stand.<br><span class="ph-pink">See where<br><span>to go.</span></span></h1>
        <p class="ph-lede">Better personalization starts with a clear view of what you can do today. Find the gaps in your capabilities and choose a useful next step.</p>
        <ul class="ph-checks">${["Assess your strategy, people, data and ways of working.", "Find the capabilities your personalization program needs.", "Get a score for each pillar and a practical next move."].map(t => `<li>${ico("check", "ph-check")}${t}</li>`).join("")}</ul>
        <p class="ph-meta">${QUESTIONS()} questions <span>/</span> About four minutes <span>/</span> Free</p>
        <button type="button" class="ph-textlink" data-scroll="audit-pillars">Explore the four pillars ↓</button>
      </div>
      <div class="ph-startcard">${pillarMap(false)}
        <p class="ph-startcard-h">Start with your business.</p>
        <p class="ph-small">Choose your business. We’ll use it to filter opportunities after your audit.</p>
        <div class="ph-pills" role="group" aria-label="What do you sell?">${D.taxonomy.models.map(m => `<button type="button" class="ph-pill" data-model="${m.id}" aria-pressed="${model === m.id}">${esc(m.label)}</button>`).join("")}</div>
        <button type="button" class="ph-btn ph-btn-hl ph-btn-block" data-start>${ans ? "Continue assessment" : "Start assessment"}</button>
        <p class="ph-note">${ans ? `${ans} of ${QUESTIONS()} answered` : "Your score is shown immediately. No email required."}</p>
      </div></div>
      ${pillarsSection()}
      <section class="ph-levels-sec" aria-labelledby="audit-score-heading"><div class="ph-levels-head">
        <div><p class="ph-kicker">Understanding your result</p><h2 id="audit-score-heading" class="ph-display">A score for every pillar.</h2></div>
        <p class="ph-small">Your answers place you in one of five capability levels, with a score out of ${MAX()}. Each of the four pillars contributes up to 10 points. These self-assessment levels are a guide to your next step, not an industry benchmark or a comparable score to Speero’s experimentation audit. Scores from the earlier audit are not comparable.</p></div>
        <ol class="ph-levels">${D.levels.map(l => `<li>${bars(l.bars)}<h3>${esc(l.label)}</h3><p>${l.min}–${l.max} points</p></li>`).join("")}</ol>
        <div class="ph-actions"><button type="button" class="ph-btn ph-btn-hl" data-start>${ans ? "Continue assessment" : "Find your starting point"}</button>
          <a class="ph-textlink" href="#/opportunities">Explore personalization examples</a><a class="ph-textlink" href="#/tools">Browse tools</a></div>
      </section></div>`;
  }
  function quiz() {
    const p = D.pillars[step], a = store.answers, model = store.model;
    return `<div class="ph-quiz">
      <div class="ph-progress"><div class="ph-progress-bar"><div style="width:${(step + 1) / D.pillars.length * 100}%"></div></div>
        <p>${step + 1} of ${D.pillars.length} · ${esc(p.label)}${model ? " · " + esc(lbl("models", model) || model) : ""}</p></div>
      <ol class="ph-qsteps" aria-label="Assessment pillars">${D.pillars.map((x, i) => `<li${i === step ? ' aria-current="step" class="on"' : ""}><span>${i + 1}</span><span>${esc(x.label)}</span></li>`).join("")}</ol>
      <p class="ph-kicker">${esc(p.label)}</p><h1 class="ph-display">${esc(p.question)}</h1><p class="ph-lede-sm">${esc(p.kicker)}</p>
      <ol class="ph-qs">${p.items.map((it, i) => `<li data-item="${it.id}"><div class="ph-q-n">${pad(i + 1)}</div><p class="ph-q-text">${esc(it.text)}</p>
        <button type="button" class="ph-q-ex" aria-expanded="false" aria-controls="${it.id}-example">${ico("plus", "ph-ico-sm")}Show example</button>
        <p class="ph-q-example" id="${it.id}-example" hidden>${esc(it.example)}</p>
        <div class="ph-answers">${D.taxonomy.answers.map(o => `<button type="button" class="ph-answer" data-answer="${o.id}" aria-pressed="${a[it.id] === o.id}">${esc(o.label)}</button>`).join("")}</div></li>`).join("")}</ol>
      <div class="ph-quiz-foot"><button type="button" class="ph-btn ph-btn-ghost" data-back>Back</button>
        <button type="button" class="ph-btn ph-btn-solid" data-next${pillarDone(p, a) ? "" : " disabled"}>${step === D.pillars.length - 1 ? "See my results" : "Next"}</button></div></div>`;
  }
  function results() {
    const a = store.answers, s = total(a), b = band(s), ns = nextStep(a);
    return `<div class="ph-results"><p class="ph-kicker">Your program readiness</p>
      <div class="ph-results-head"><div><h1 class="ph-display">See where to focus next.</h1>
        <p class="ph-score">${s} / ${MAX()} · <strong>${esc(b.label)}</strong></p></div>
        <button type="button" class="ph-btn ph-btn-outline" data-retake>Retake assessment</button></div>
      <p class="ph-lede-sm">${esc(b.blurb)} This score reflects your answers, not measured business results.</p>
      <div class="ph-scores">${D.pillars.map((p, i) => {
        const sc = pillarScore(p, a), it = weakItem(p, a), max = p.items.length * 2;
        return `<section aria-labelledby="score-${p.id}"><div class="ph-score-top"><span class="ph-score-n">${i + 1}</span><span class="ph-score-v">${sc}<span> / ${max}</span></span></div>
          <h2 id="score-${p.id}">${esc(p.label)}</h2><p class="ph-small">${esc(p.question)}</p>
          <div class="ph-meter"><div style="width:${sc / max * 100}%"></div></div>
          <p>${esc(it ? it.guidance : "You reported consistent practice on all five questions. Keep checking it against evidence.")}</p></section>`;
      }).join("")}
        <section class="ph-start-here"><p class="ph-kicker">Start here</p><h2>${esc(ns.headline)}</h2><p>${esc(ns.body)}</p></section></div>
      <div class="ph-actions"><a class="ph-btn ph-btn-hl" href="#/opportunities">Explore opportunities</a><a class="ph-btn ph-btn-outline" href="#/tools">Browse tools</a></div></div>`;
  }

  function onClick(e) {
    const t = e.target.closest("button");
    if (!t || !root.contains(t)) return;
    if (t.dataset.model) {
      store.model = t.dataset.model; save();
      root.querySelectorAll("[data-model]").forEach(x => x.setAttribute("aria-pressed", x === t));
    } else if (t.hasAttribute("data-start")) start();
    else if (t.hasAttribute("data-retake")) { store.answers = {}; save(); step = 0; phase = "intro"; render(true); }
    else if (t.hasAttribute("data-back")) { if (step === 0) phase = "intro"; else step--; render(true); }
    else if (t.hasAttribute("data-next")) { if (step < D.pillars.length - 1) step++; else phase = "results"; render(true); }
    else if (t.dataset.answer) {
      const li = t.closest("[data-item]");
      store.answers[li.dataset.item] = t.dataset.answer; save();
      li.querySelectorAll("[data-answer]").forEach(x => x.setAttribute("aria-pressed", x === t));
      root.querySelector("[data-next]").disabled = !pillarDone(D.pillars[step], store.answers);
    } else if (t.classList.contains("ph-q-ex")) {
      const open = t.getAttribute("aria-expanded") !== "true", ex = document.getElementById(t.getAttribute("aria-controls"));
      t.setAttribute("aria-expanded", open); ex.hidden = !open;
      t.innerHTML = ico(open ? "minus" : "plus", "ph-ico-sm") + (open ? "Hide example" : "Show example");
    }
  }
  root.addEventListener("click", onClick);
  view = () => root.removeEventListener("click", onClick);
  render(false);
}

/* ---------- opportunities explorer ---------- */
function mountOpportunities(q) {
  const f = { model: q.get("model") ?? store.model ?? "", need: q.get("need") || "", stage: q.get("stage") || "",
    intent: q.get("intent") || "", signal: q.get("signal") || "", q: q.get("q") || "", shown: +q.get("shown") || 12 };
  const sel = (key, label, all, list) => `<label class="ph-field"><span>${label}</span><select data-f="${key}">
    <option value="">${all}</option>${list.map(x => `<option value="${x.id}"${f[key] === x.id ? " selected" : ""}>${esc(x.label)}</option>`).join("")}</select></label>`;
  paint(`<div class="ph-opps"><p class="ph-kicker">Personalization, one situation at a time</p>
    <h1 class="ph-hero-h">Show people <span class="ph-pink">you see them.</span></h1>
    <p class="ph-lede">Pick a customer situation. Work through the signals, the need, whether it’s worth it, how to respond and what to learn.</p>
    <div class="ph-filters"><div class="ph-filter-grid">
      ${sel("model", "Business", "All businesses", D.taxonomy.models)}
      ${sel("need", "Customer need", "All needs", D.taxonomy.needs)}
      ${sel("stage", "Journey stage", "All stages", D.taxonomy.stages)}
      ${sel("intent", "Intent", "All intent levels", D.taxonomy.intents)}
      ${sel("signal", "Signal source", "All signals", D.taxonomy.signals)}</div>
      <label class="ph-field"><span>Find a situation</span><input type="search" data-f="q" placeholder="Try returning customer, search or setup" value="${esc(f.q)}"></label></div>
    <div class="ph-results-bar"><p role="status" data-count></p><button type="button" class="ph-textlink" data-reset>Reset filters</button></div>
    <div data-list></div></div>`);

  function list() {
    const s = f.q.toLowerCase();
    const r = D.opportunities.filter(e =>
      (!f.model || !e.models.length || e.models.includes(f.model)) &&
      (!f.intent || !e.intents.length || e.intents.includes(f.intent)) &&
      (!f.stage || e.stage === f.stage) && (!f.signal || e.contexts.includes(f.signal)) &&
      (!f.need || e.situation === f.need) &&
      (!s || `${e.title} ${e.summary} ${e.whatsGoingOn} ${e.signals.map(x => x.example).join(" ")}`.toLowerCase().includes(s)));
    root.querySelector("[data-count]").textContent = `${r.length} of ${D.opportunities.length} opportunities`;
    root.querySelector("[data-list]").innerHTML = (r.length
      ? `<div class="ph-grid-opps">${r.slice(0, f.shown).map(o => oppCard(o)).join("")}</div>`
      : `<p class="ph-empty">No opportunities match. Try a different signal or reset the filters.</p>`) +
      (r.length > f.shown ? `<button type="button" class="ph-btn ph-btn-outline ph-more" data-more>Show more opportunities</button>` : "");
    setQuery("opportunities", Object.assign({}, f, { shown: f.shown > 12 ? f.shown : "" }));
    lastExplore = location.hash;
  }
  function onInput(e) {
    const k = e.target.dataset && e.target.dataset.f;
    if (!k) return;
    f[k] = e.target.value; f.shown = 12;
    if (k === "model") { store.model = f.model || null; save(); }
    list();
  }
  function onClick(e) {
    if (e.target.closest("[data-more]")) { f.shown += 12; list(); }
    else if (e.target.closest("[data-reset]")) {
      Object.assign(f, { model: "", need: "", stage: "", intent: "", signal: "", q: "", shown: 12 });
      root.querySelectorAll("[data-f]").forEach(x => { x.value = ""; });
      list();
    }
  }
  root.addEventListener("input", onInput); root.addEventListener("click", onClick);
  view = () => { root.removeEventListener("input", onInput); root.removeEventListener("click", onClick); };
  list();
}

/* ---------- opportunity ---------- */
const FORMATS = ["Content", "Experience", "Sequence", "Recommendations"];
function opportunity(o) {
  const stepIdx = id => D.steps.findIndex(s => s.id === id);
  const sec = (id, title, body) => {
    const s = D.steps[stepIdx(id)];
    return `<section class="ph-step" id="${id}" aria-labelledby="${id}-heading"><div class="ph-step-head"><span class="ph-step-n">${stepIdx(id) + 1}</span>
      <div><p class="ph-step-k">${esc(s.label)}</p><h2 id="${id}-heading">${esc(title || s.question)}</h2></div></div>${body}</section>`;
  };
  const dl = (label, text) => `<div><dt>${label}</dt><dd>${esc(text)}</dd></div>`;
  const i = D.opportunities.indexOf(o), prev = D.opportunities[i - 1], next = D.opportunities[i + 1];
  const related = o.related.slice(0, 3).map(id => byId.opp[id]).filter(Boolean);
  return `<article class="ph-opp">
    <a class="ph-back" href="${esc(lastExplore)}">← All opportunities</a>
    <header class="ph-opp-head"><p class="ph-kicker">${esc(lbl("needs", o.situation))} · ${esc(lbl("stages", o.stage))}</p>
      <h1 class="ph-display">${esc(o.title)}</h1><p class="ph-lede">${esc(o.summary)}</p>
      <p class="ph-small">Illustrative use case · ${o.models.length ? o.models.map(m => esc(lbl("models", m))).join(", ") : "Across business models"}</p></header>
    <nav class="ph-stepnav" aria-label="Five steps">${D.steps.map((s, n) => `<button type="button" data-scroll="${s.id}"><span>${n + 1}</span>${esc(s.label)}</button>`).join("")}</nav>
    <div class="ph-step-list">
      ${sec("signals", "What do we know about this person?", `<ul class="ph-signals">${o.signals.map(s => `<li class="${s.kind === "inferred" ? "is-inferred" : ""}"><p class="ph-signal-k">${esc(lbl("signals", s.kind))}</p><p>${esc(s.example)}</p></li>`).join("")}</ul>
        <details><summary>Example eligibility rule</summary><p>${esc(o.eligibilityRule)}</p></details>`)}
      ${sec("need", "", `<p>${esc(o.whatsGoingOn)}</p><details><summary>Avoid this assumption</summary><p>${esc(o.confusion)}</p></details>`)}
      ${sec("value", "Do the math before you build.", `<p>${esc(o.whyItEarns)}</p>
        <dl class="ph-trio">${dl("Reach", "How many eligible people can you reach in the chosen channel and time period?")}${dl("Cost", "What will content, delivery, QA and ongoing maintenance cost?")}${dl("Return", "What incremental outcome would cover that cost, and what is it worth?")}</dl>
        <p class="ph-step-note">Planning inputs, not measured results. Estimate reach × incremental outcome rate × value per outcome, then subtract cost. Use a range and a consistent time period.</p>`)}
      ${sec("response", "Pick how you help.", `<ul class="ph-formats" aria-label="Example response format">${FORMATS.map(x => `<li class="${x === o.format ? "on" : ""}">${x}${x === o.format ? '<span class="ph-sr">: example format</span>' : ""}</li>`).join("")}</ul>
        <p>${esc(o.arms.medium)}</p>
        <details><summary>Compare lighter and deeper responses</summary><p class="ph-step-note">Choose the lightest response that solves the need.</p>
          <div class="ph-arms">${D.taxonomy.arms.map(x => `<div><h3>${esc(x.label)}</h3><p class="ph-arm-note">${esc(x.note)}</p><p>${esc(o.arms[x.key])}</p></div>`).join("")}</div></details>
        <details><summary>What to watch out for</summary><ul class="ph-bullets">${o.pitfalls.map(p => `<li>${esc(p)}</li>`).join("")}</ul></details>`)}
      ${sec("moment", "Did it help? A/B test it.", `<dl class="ph-quad">${dl("Control", o.test.control)}${dl("Treatment", o.test.treatment)}${dl("Success measure", o.test.primaryMetric)}${dl("Guardrail", o.test.guardrail)}</dl>
        ${o.test.audienceReadout ? `<p class="ph-step-note">${esc(o.test.audienceReadout)}</p>` : ""}
        <p><strong>Win or lose,</strong> record what worked, for whom and why. What you learn becomes the next signal.</p>
        <button type="button" class="ph-textlink ph-on-ink" data-scroll="signals">Back to the signals ↑</button>`)}
    </div>
    ${o.toolIds.length ? `<section class="ph-opp-tools"><h2>Tools that can deliver the response</h2><div class="ph-chips">${o.toolIds.map(id => byId.tool[id]).filter(Boolean).map(t => `<a class="ph-chip" href="${toolHref(t.id)}">${logo(t, "sm")}${esc(t.name)}</a>`).join("")}</div></section>` : ""}
    ${related.length ? `<section class="ph-opp-related"><h2>Try the framework on another situation</h2><div class="ph-grid-opps">${related.map(r => oppCard(r, true)).join("")}</div></section>` : ""}
    <nav class="ph-prevnext" aria-label="More opportunities">${prev ? `<a href="${oppHref(prev.id)}">← ${esc(prev.title)}</a>` : "<span></span>"}${next ? `<a href="${oppHref(next.id)}">${esc(next.title)} →</a>` : ""}</nav>
  </article>`;
}

/* ---------- tools ---------- */
function toolCard(t, explorer) {
  return `<article class="ph-card-tool"><div class="ph-card-role">${esc(lbl("roles", t.role))}</div>
    ${explorer ? `<h3>${esc(t.name)}</h3>` : `<div class="ph-card-tool-head">${logo(t)}<h3>${esc(t.name)}</h3></div>`}
    <p>${esc(t.summary)}</p>
    ${t.source ? `<a class="ph-src" href="${esc(t.source.url)}" target="_blank" rel="noopener noreferrer">${explorer ? "Source: " : ""}${esc(host(t.source.url))}</a>` : ""}
    ${explorer ? `<div class="ph-connected">${esc(t.connected)}</div>` : ""}
    <div class="ph-card-tool-foot"><a href="${toolHref(t.id)}">${explorer ? "View tool &amp; connections" : "View"}${arrowSmall}</a>${compareBox(t.id)}</div></article>`;
}

function mountTools(q) {
  const f = { q: q.get("q") || "", role: q.get("role") || "all", model: q.get("model") || "all" };
  const pills = (key, all, list) => `<div class="ph-pills">${[{ id: "all", label: all }].concat(list).map(x => `<button type="button" class="ph-pill ph-pill-paper" data-${key}="${x.id}" aria-pressed="${f[key] === x.id}">${esc(x.label)}</button>`).join("")}</div>`;
  paint(`<div class="ph-tools"><h1 class="ph-display">Enable personalization with the right tool</h1>
    <p class="ph-lede-sm">Tools that can actually change what someone sees. Inclusion is not an endorsement.</p>
    <label class="ph-search"><span class="ph-sr">Search tools</span>${ico("search", "ph-search-ico")}<input type="search" data-q value="${esc(f.q)}" placeholder="Search tools…"></label>
    ${pills("role", "All roles", D.taxonomy.roles)}${pills("model", "All businesses", D.taxonomy.models)}
    <div data-list></div></div>`);
  function list() {
    const s = f.q.trim().toLowerCase();
    const r = D.tools.filter(t => (f.role === "all" || t.role === f.role) && (f.model === "all" || t.models.includes(f.model)) &&
      (!s || t.name.toLowerCase().includes(s) || t.summary.toLowerCase().includes(s) || t.bestFor.toLowerCase().includes(s)));
    root.querySelector("[data-list]").innerHTML = `<p class="ph-count">${r.length} of ${D.tools.length} tools. Inclusion is not an endorsement.</p>
      ${compareLimit()}<div class="ph-grid-tools">${r.map(t => toolCard(t)).join("")}</div>${compareTray()}`;
    setQuery("tools", f);
  }
  function onInput(e) { if (e.target.hasAttribute("data-q")) { f.q = e.target.value; list(); } }
  function onClick(e) {
    const b = e.target.closest("button[data-role],button[data-model]");
    if (!b) return;
    const k = b.dataset.role !== undefined ? "role" : "model";
    f[k] = b.dataset[k];
    root.querySelectorAll(`[data-${k}]`).forEach(x => x.setAttribute("aria-pressed", x === b));
    list();
  }
  function onChange(e) { if (e.target.dataset.compare) { toggleCompare(e.target.dataset.compare); list(); } }
  root.addEventListener("input", onInput); root.addEventListener("click", onClick); root.addEventListener("change", onChange);
  view = () => { root.removeEventListener("input", onInput); root.removeEventListener("click", onClick); root.removeEventListener("change", onChange); };
  list();
}

function tool(t) {
  const on = store.compared.includes(t.id), full = store.compared.length >= 3;
  return `<article class="ph-tool">
    <a class="ph-back" href="#/explore">← The explorer</a>
    <div class="ph-tool-head">${logo(t, "lg")}<div><div class="ph-card-role">${esc(lbl("roles", t.role))}</div><h1 class="ph-display">${esc(t.name)}</h1></div></div>
    <p class="ph-lede">${esc(t.summary)}</p><p class="ph-small">${esc(t.connected)}</p>
    ${t.source ? `<blockquote class="ph-claim"><div class="ph-claim-k">THE VENDOR’S CLAIM</div><p>“${esc(t.source.claim)}”</p><a href="${esc(t.source.url)}" target="_blank" rel="noopener noreferrer">${esc(host(t.source.url))}</a></blockquote>` : ""}
    <div class="ph-actions"><button type="button" class="ph-btn ph-btn-outline ph-btn-sm" data-toggle="${esc(t.id)}"${full && !on ? " disabled" : ""}${full ? ' aria-describedby="compare-limit"' : ""}>${on ? "Remove from compare" : "Add to compare"}</button><a class="ph-btn ph-btn-solid ph-btn-sm" href="#/compare">Open comparison</a></div>
    ${compareLimit()}
    <div class="ph-two"><section><h2>Where it’s strong</h2><ul class="ph-bullets">${t.strengths.map(x => `<li>${esc(x)}</li>`).join("")}</ul></section>
      <section><h2>Where it runs out</h2><ul class="ph-bullets">${t.limits.map(x => `<li>${esc(x)}</li>`).join("")}</ul></section></div>
    <section class="ph-tool-sec ph-tool-best"><h2>Best for</h2><p>${esc(t.bestFor)}</p><h2>Questions before you buy more of it</h2><ul class="ph-bullets">${t.questions.map(x => `<li>${esc(x)}</li>`).join("")}</ul></section>
    <section class="ph-tool-plain"><h2>Fits these businesses</h2><div class="ph-chips">${t.models.map(m => `<span class="ph-chip">${esc(lbl("models", m))}</span>`).join("")}</div></section>
    ${t.applicationIds.length ? `<section class="ph-tool-plain"><h2>Connected applications</h2><div class="ph-apps">${t.applicationIds.map(id => byId.lib[id]).filter(Boolean).map(l => {
      const op = byId.opp[l.relatedOpportunityIds[0]];
      return `<div class="ph-app"><div class="ph-app-name">${esc(l.name)}</div><p>${esc(l.summary)}</p>${op ? `<a href="${oppHref(op.id)}">${esc(op.title)}</a>` : ""}</div>`;
    }).join("")}</div></section>` : ""}
  </article>`;
}

function compare() {
  const ts = store.compared.map(id => byId.tool[id]).filter(Boolean);
  const row = (label, cells) => `<tr><th scope="row">${label}</th>${cells.map(c => `<td>${esc(c)}</td>`).join("")}</tr>`;
  return `<div class="ph-compare"><h1 class="ph-hero-h ph-hero-wide">Compare tools</h1>
    <p class="ph-lede-sm">Up to three. The point is not a winner — it is whether a tool you already run can deliver the decision record. Inclusion is not an endorsement.</p>
    ${!ts.length ? `<div class="ph-compare-empty"><p>Nothing selected yet.</p><div class="ph-grid-pick">${D.tools.map(t => `<button type="button" class="ph-pick" data-toggle="${esc(t.id)}"><div class="ph-pick-name">${logo(t, "sm")}${esc(t.name)}</div><div class="ph-pick-sum">${esc(t.summary)}</div></button>`).join("")}</div></div>`
    : `<div class="ph-actions"><button type="button" class="ph-btn ph-btn-outline ph-btn-sm" data-clear>Clear</button><a class="ph-btn ph-btn-solid ph-btn-sm" href="#/explore">Add another</a></div>
      <div class="ph-table-wrap"><table class="ph-table"><thead><tr><th> </th>${ts.map(t => `<th scope="col"><a href="${toolHref(t.id)}">${logo(t, "sm")}${esc(t.name)}</a></th>`).join("")}</tr></thead><tbody>
      ${row("Stack role", ts.map(t => lbl("roles", t.role)))}${row("In one line", ts.map(t => t.summary))}${row("Best for", ts.map(t => t.bestFor))}
      ${row("Strengths", ts.map(t => t.strengths.join(" · ")))}${row("Limits", ts.map(t => t.limits.join(" · ")))}${row("Ask before you buy more", ts.map(t => t.questions.join(" ")))}
      </tbody></table></div>`}</div>`;
}

/* ---------- explorer (library and tools) ---------- */
function mountExplore(q) {
  const f = { tab: q.get("tab") || "tool", q: q.get("q") || "", model: q.get("model") || "all", role: q.get("role") || "all" };
  const lib = k => D.library.filter(l => l.kind === k);
  const counts = { application: lib("application").length, concept: lib("concept").length, practice: lib("practice").length, tool: D.tools.length };
  function render(keepFocus) {
    const s = f.q.trim().toLowerCase(), mLabel = lbl("models", f.model);
    const tools = D.tools.filter(t => (f.model === "all" || t.models.includes(f.model)) && (f.role === "all" || t.role === f.role) &&
      (!s || t.name.toLowerCase().includes(s) || t.summary.toLowerCase().includes(s) || t.bestFor.toLowerCase().includes(s)));
    const items = f.tab === "tool" ? [] : lib(f.tab).filter(l => (f.model === "all" || !l.models.length || l.models.includes(f.model)) &&
      (!s || l.name.toLowerCase().includes(s) || l.summary.toLowerCase().includes(s) || l.tags.some(x => x.includes(s)) || l.body.toLowerCase().includes(s)));
    const html = `<section class="ph-explore"><div class="ph-explore-head"><h1 class="ph-display">A useful difference starts here.</h1>
      <label class="ph-search"><span class="ph-sr">Search the explorer</span>${ico("search", "ph-search-ico")}<input data-q value="${esc(f.q)}" placeholder="Search onboarding, affinity, holdouts…"><kbd>/</kbd></label></div>
      <div class="ph-tabs">${[["application", "Applications"], ["concept", "Concepts"], ["practice", "Practices"], ["tool", "Tools"]].map(([k, l]) => `<button type="button" data-tab="${k}" aria-pressed="${f.tab === k}">${l}<span>${counts[k]}</span></button>`).join("")}</div>
      <div class="ph-explore-body"><aside class="ph-aside"><div class="ph-aside-top"><span>Make it relevant</span><button type="button" class="ph-textlink" data-reset>Reset</button></div>
        <fieldset><legend>Your business</legend>${[{ id: "all", label: "All businesses" }].concat(D.taxonomy.models).map(m => `<label><input type="radio" name="explorer-model" value="${m.id}"${f.model === m.id ? " checked" : ""}>${esc(m.label)}</label>`).join("")}</fieldset>
        ${f.tab === "tool" ? `<label class="ph-field"><span>Stack role</span><select data-role><option value="all">All stack roles</option>${D.taxonomy.roles.map(r => `<option value="${r.id}"${f.role === r.id ? " selected" : ""}>${esc(r.label)}</option>`).join("")}</select></label>` : ""}
        <div class="ph-principle"><div class="ph-principle-k">A Speero starting principle</div><div class="ph-principle-h">Tailoring an experience should earn its complexity.</div><div>Test it against a useful common experience.</div></div></aside>
      <div class="ph-explore-main">${f.tab === "tool"
        ? `<div class="ph-explore-count"><span>${tools.length} tools${f.model === "all" ? "" : " for " + esc(mLabel)}</span><span>Compare roles, capabilities and questions</span></div>
          ${f.model === "all" ? "" : `<div><button type="button" class="ph-pill" data-clearmodel>${esc(mLabel)} ×</button></div>`}
          ${compareLimit()}<div class="ph-grid-tools ph-grid-2">${tools.map(t => toolCard(t, true)).join("")}</div>${compareTray()}`
        : `<div class="ph-explore-count"><span>${items.length} ${f.tab === "application" ? "applications" : f.tab === "concept" ? "concepts" : "practices"}</span></div>
          <div class="ph-grid-tools ph-grid-2">${items.map(l => `<article class="ph-card-tool"><h3>${esc(l.name)}</h3><p class="ph-strong">${esc(l.summary)}</p><p>${esc(l.body)}</p>${l.relatedOpportunityIds[0] ? `<a href="${oppHref(l.relatedOpportunityIds[0])}">See it in a situation${arrowSmall}</a>` : ""}</article>`).join("")}</div>`}</div></div></section>`;
    if (!keepFocus) { paint(html); return; }
    const pos = keepFocus.selectionStart;
    root.firstElementChild.innerHTML = html;
    const inp = root.querySelector("[data-q]"); inp.focus(); inp.setSelectionRange(pos, pos);
  }
  function update(keep) { setQuery("explore", Object.assign({}, f, { tab: f.tab === "tool" ? "" : f.tab })); render(keep); }
  function onInput(e) { if (e.target.hasAttribute("data-q")) { f.q = e.target.value; update(e.target); } }
  function onChange(e) {
    const t = e.target;
    if (t.name === "explorer-model") { f.model = t.value; update(); }
    else if (t.hasAttribute("data-role")) { f.role = t.value; update(); }
    else if (t.dataset.compare) { toggleCompare(t.dataset.compare); update(); }
  }
  function onClick(e) {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.tab) { f.tab = b.dataset.tab; update(); }
    else if (b.hasAttribute("data-reset")) { Object.assign(f, { model: "all", role: "all", q: "" }); update(); }
    else if (b.hasAttribute("data-clearmodel")) { f.model = "all"; update(); }
  }
  function onKey(e) {
    if (e.key !== "/" || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    e.preventDefault(); root.querySelector("[data-q]").focus();
  }
  root.addEventListener("input", onInput); root.addEventListener("change", onChange); root.addEventListener("click", onClick);
  window.addEventListener("keydown", onKey);
  view = () => { root.removeEventListener("input", onInput); root.removeEventListener("change", onChange); root.removeEventListener("click", onClick); window.removeEventListener("keydown", onKey); };
  render();
}

/* ---------- guided start ---------- */
function mountGuide() {
  let i = 0;
  const g = store.guide;
  const STEPS = ["Business", "Where customers get stuck", "The situation", "What you know", "Your first personalizations"];
  function matches() {
    const r = D.opportunities.map(o => {
      let n = 0;
      if (g.model && o.models.includes(g.model)) n += 3;
      if (g.stage && o.stage === g.stage) n += 4;
      if (g.situation && o.situation === g.situation) n += 4;
      if (g.contexts.length) n += o.contexts.filter(c => g.contexts.includes(c)).length;
      return { o, n };
    }).filter(x => x.n > 0).sort((a, b) => b.n - a.n);
    return (r.length ? r : D.opportunities.map(o => ({ o, n: 1 }))).slice(0, 3).map(x => x.o);
  }
  const opt = (key, val, label, blurb, on) => `<button type="button" class="ph-opt${on ? " on" : ""}" data-${key}="${val}"><div class="ph-opt-l">${esc(label)}</div>${blurb ? `<div class="ph-opt-b">${esc(blurb)}</div>` : ""}</button>`;
  const panel = (title, body) => `<div class="ph-guide-panel"><h2 class="ph-display">${title}</h2>${body}</div>`;
  function render() {
    let body = "";
    if (i === 0) body = panel("What do you sell?", `<p class="ph-lede-sm">Not so we can lecture you about your industry. So the examples match the jobs your customers actually have.</p><div class="ph-opts">${D.taxonomy.models.map(m => opt("gmodel", m.id, m.label, "", g.model === m.id)).join("")}</div>`);
    if (i === 1) body = panel("Where do people get stuck?", `<p class="ph-lede-sm">Most teams over-invest at first purchase. Customers usually care more earlier (finding the right thing) and later (coming back).</p><div class="ph-opts">${D.taxonomy.stages.map(s => opt("gstage", s.id, s.label, "", g.stage === s.id)).join("")}</div>`);
    if (i === 2) body = panel("What do you think is going on for them?", `<p class="ph-lede-sm">We’ll be able to narrow down through deeper testing and learning. For right now, what question should we try to explore?</p><div class="ph-opts">${D.taxonomy.needs.map(n => opt("gneed", n.id, `Users need ${n.id === "effort" ? "ease" : n.label.toLowerCase()}`, n.blurb, g.situation === n.id)).join("")}</div>`);
    if (i === 3) body = panel("What do you actually know?", `<p class="ph-lede-sm">Declared is what they told you. Connected is history. Inferred is a guess — useful, but quieter.</p><div class="ph-opts">${D.taxonomy.signals.map(s => opt("gsig", s.id, s.label, s.blurb, g.contexts.includes(s.id))).join("")}</div><div class="ph-actions"><button type="button" class="ph-btn ph-btn-solid" data-gshow>Show matching strategies</button></div>`);
    if (i === 4) body = panel("Your first personalizations", `<p class="ph-lede-sm">Three situations that fit what you told us. Each one is a personalization you could actually try — not a campaign to leave on forever.</p>
      <div class="ph-grid-opps">${matches().map(o => `<a class="ph-card-plain" href="${oppHref(o.id)}"><div class="ph-card-kicker">${esc(lbl("stages", o.stage))} · ${esc(lbl("needs", o.situation))}</div><div class="ph-card-title">${esc(o.title)}</div><p>${esc(o.summary)}</p><span class="ph-card-go">Open the playbook ${arrowSmall}</span></a>`).join("")}</div>
      <div class="ph-actions"><a class="ph-btn ph-btn-solid" href="#/opportunities">Explore opportunities</a><button type="button" class="ph-btn ph-btn-outline" data-grestart>Start over</button></div>`);
    paint(`${pageHero("Guided start", "Where customers get stuck, and what you could try.", "Four short questions. Then three personalizations that fit — quiet, a nudge, or going all in.")}
      <div class="ph-guide"><div class="ph-progress-bar"><div style="width:${(i + 1) / STEPS.length * 100}%"></div></div><p class="ph-small">${i + 1} of ${STEPS.length}</p>
      <ol class="ph-guide-steps">${STEPS.map((s, n) => `<li><button type="button" class="ph-pill${n === i ? " on" : ""}" data-gstep="${n}">${n + 1} ${s}</button></li>`).join("")}</ol>${body}</div>`);
  }
  function onClick(e) {
    const b = e.target.closest("button");
    if (!b) return;
    const d = b.dataset;
    if (d.gstep) i = +d.gstep;
    else if (d.gmodel) { g.model = d.gmodel; i = 1; }
    else if (d.gstage) { g.stage = d.gstage; i = 2; }
    else if (d.gneed) { g.situation = d.gneed; i = 3; }
    else if (d.gsig) { const on = g.contexts.includes(d.gsig), nx = on ? g.contexts.filter(c => c !== d.gsig) : g.contexts.concat(d.gsig); if (nx.length) g.contexts = nx; }
    else if (b.hasAttribute("data-gshow")) i = 4;
    else if (b.hasAttribute("data-grestart")) { store.guide = { model: null, stage: null, situation: null, contexts: ["declared", "connected", "inferred"] }; Object.assign(g, store.guide); i = 0; }
    else return;
    save(); render();
  }
  root.addEventListener("click", onClick);
  view = () => root.removeEventListener("click", onClick);
  render();
}

/* ---------- static pages ---------- */
function research() {
  return pageHero("", "Nobody is average. Most experiences still are.", "What someone tells you, what you already know, and what their behavior suggests: most companies collect all three. The question isn’t whether the data exists. It’s whether the experience reflects it.") +
    `<div class="ph-myths">${D.myths.map(m => `<article><h2>${esc(m.claim)}</h2><p class="ph-myth-t">${esc(m.truth)}</p><p>${esc(m.detail)}</p></article>`).join("")}</div>`;
}
function blueprints() {
  const canvas = [["Purpose", "The program exists to build a relationship, not a software project."], ["Goal", "A measure you already track. Activation, support load, relevance."],
    ["Strategic insight", "Demand is lowest at first purchase. Put work where they asked."], ["First commitments", "One high-intent, easy-to-change situation in twelve weeks."],
    ["Biggest risk", "Launching campaigns with no holdout and calling it mature."], ["Decision needed", "Fund a 12-week discovery through a sequenced, priced roadmap."]];
  return pageHero("Blueprints", "Write it down before you configure a tool.", `Speero publishes <a href="https://speero.com/blueprints">experimentation blueprints</a> as downloadable decision-support. This page is the personalization companion: a twelve-week shape, and a one-page canvas.`) +
    `<section class="ph-bp"><h2 class="ph-display">The strategy on one page</h2><div class="ph-canvas">${canvas.map(([k, v], n) => `<div class="${n === 5 ? "is-pink" : ""}"><div class="ph-canvas-k">${k}</div><p>${v}</p></div>`).join("")}</div></section>
    <section class="ph-bp"><h2 class="ph-display">Twelve-week shape</h2><div class="ph-gantt">${D.roadmap.map(r => `<div class="ph-gantt-row"><div><div class="ph-gantt-name">${esc(r.name)}</div><div class="ph-small">Weeks ${esc(r.weeks)}</div></div>
      <div><div class="ph-gantt-track"><div class="ph-gantt-bar is-${r.tone}" style="left:${r.start / 12 * 100}%;width:${r.span / 12 * 100}%"></div></div><p class="ph-small">${esc(r.detail)}</p></div></div>`).join("")}</div></section>`;
}
function notFound() {
  return `<div class="ph-404"><h1 class="ph-hero-h">That page isn’t here.</h1><p class="ph-lede-sm">The hub contains opportunity cards, an audit, tools, and blueprints. Try one of those.</p><a href="#/">Back to the hub</a></div>`;
}

/* ---------- global listeners ---------- */
// In-page jumps are buttons, because the hash belongs to the router.
root.addEventListener("click", e => {
  const b = e.target.closest("[data-scroll]");
  if (b) { const el = document.getElementById(b.dataset.scroll); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
  const tg = e.target.closest("[data-toggle]");
  if (tg) { toggleCompare(tg.dataset.toggle); route(); return; }
  if (e.target.closest("[data-clear]")) { store.compared = []; save(); route(); }
});
// Compare checkboxes outside the list views (none today) and logo fallbacks.
root.addEventListener("error", e => {
  const img = e.target;
  if (img.tagName !== "IMG" || !img.dataset.fallback) return;
  const s = document.createElement("span");
  s.className = img.className + " ph-logo-fb"; s.setAttribute("aria-hidden", "true"); s.textContent = img.dataset.fallback;
  img.replaceWith(s);
}, true);
window.addEventListener("hashchange", route);

/* ---------- boot ---------- */
root.innerHTML = '<div class="ph"><p class="ph-loading">Loading the personalization hub…</p></div>';
fetch(CFG.dataUrl, { cache: "no-cache" }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(d => {
  D = d;
  ["models", "needs", "stages", "intents", "signals", "roles"].forEach(k => { T[k] = {}; d.taxonomy[k].forEach(x => { T[k][x.id] = x; }); });
  byId.opp = {}; d.opportunities.forEach(o => { byId.opp[o.id] = o; });
  byId.tool = {}; d.tools.forEach(t => { byId.tool[t.id] = t; });
  byId.lib = {}; d.library.forEach(l => { byId.lib[l.id] = l; });
  store.compared = store.compared.filter(id => byId.tool[id]);
  route();
}).catch(() => {
  root.innerHTML = '<div class="ph"><p class="ph-loading">The personalization hub could not load. Please refresh the page.</p></div>';
});
})();
