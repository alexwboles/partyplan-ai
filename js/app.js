/* PartyPlan AI — UI glue. All data in localStorage under partyplan.v1. */
"use strict";
const LS_KEY = "partyplan.v1";

function load() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || blank(); }
  catch (e) { return blank(); }
}
function blank() { return { events: [], activeId: null }; }
function save(s) { localStorage.setItem(LS_KEY, JSON.stringify(s)); }
function uid() { return "e" + Date.now().toString(36) + Math.floor(Math.random() * 999); }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

let S = load();
function active() { return S.events.find(e => e.id === S.activeId) || S.events[0] || null; }
function persist() { save(S); render(); }

function switchTab(name) {
  document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b.dataset.tab === name));
  document.querySelectorAll(".panel").forEach(p => p.classList.toggle("active", p.id === "panel-" + name));
}

/* ---------- events ---------- */
function renderEventPicker() {
  const ev = active();
  const sel = document.getElementById("eventSelect");
  sel.innerHTML = S.events.map(e =>
    `<option value="${e.id}" ${ev && e.id === ev.id ? "selected" : ""}>${esc(e.name)} — ${esc(e.date)}</option>`
  ).join("") || `<option value="">No events yet</option>`;
  const days = ev ? daysUntil(ev.date) : null;
  const typeLabel = ((EVENT_TYPES[ev.type] || {}).label || ev.type || "").replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/gu, "").trim();
  document.getElementById("eventSummary").innerHTML = ev
    ? `<div class="ev-mast">
        <div><div class="ev-type">${esc(typeLabel)}</div>
        <h2 class="ev-name">${esc(ev.name)}</h2></div>
        <div class="countdown">${
          days < 0 ? `<span class="num">${-days}</span><span class="lbl">days ago</span>`
          : days === 0 ? `<span class="num">0</span><span class="lbl">today — showtime</span>`
          : `<span class="num">${days}</span><span class="lbl">days to go</span>`}
        </div>
      </div>` +
      (eventNudge(days) ? `<div class="nudge">${esc(eventNudge(days))}</div>` : "")
    : `<span class="muted">Create your first event below to get a planning timeline.</span>`;
}

function addEvent(e) {
  e.preventDefault();
  const name = document.getElementById("evName").value.trim();
  const type = document.getElementById("evType").value;
  const date = document.getElementById("evDate").value;
  if (!name || !date) return;
  const ev = { id: uid(), name, type, date, budget: [], guests: [], vendors: [], done: [] };
  S.events.push(ev); S.activeId = ev.id;
  document.getElementById("evName").value = "";
  persist();
}

/* ---------- timeline ---------- */
function renderTimeline() {
  const ev = active();
  const box = document.getElementById("timelineList");
  if (!ev) { box.innerHTML = `<p class="muted">No event selected.</p>`; return; }
  const tl = buildTimeline(ev.type, ev.date, ev.done, todayISO(), { EVENT_TYPES });
  const nt = nextTask(tl);
  box.innerHTML =
    (nt ? `<div class="nudge"><strong>Next up:</strong> ${esc(nt.title)} — due ${esc(nt.due)}${nt.status === "overdue" ? " (overdue)" : ""}<div class="tip">${esc(nt.tip)}</div></div>` : `<div class="nudge"><strong>All tasks done</strong> — enjoy the event!</div>`) +
    tl.map(t => `
      <div class="task ${t.status}">
        <input type="checkbox" ${t.status === "done" ? "checked" : ""} onchange="toggleTask(${t.idx}, this.checked)" aria-label="done">
        <div class="task-body">
          <div class="task-title">${esc(t.title)}</div>
          <div class="task-meta">Due ${esc(t.due)} · ${t.days < 0 ? Math.abs(t.days) + "d overdue" : t.days === 0 ? "today" : "in " + t.days + "d"} · <span class="pill">${esc(t.status.replace("-", " "))}</span></div>
          <div class="tip">${esc(t.tip)}</div>
        </div>
      </div>`).join("");
}
function toggleTask(idx, done) {
  const ev = active(); if (!ev) return;
  ev.done = (ev.done || []).filter(i => i !== idx);
  if (done) ev.done.push(idx);
  persist();
}

/* ---------- budget ---------- */
function renderBudget() {
  const ev = active();
  const box = document.getElementById("budgetBox");
  if (!ev) { box.innerHTML = `<p class="muted">No event selected.</p>`; return; }
  const bt = budgetTotals(ev.budget);
  const rows = BUDGET_CATEGORIES.map(c => {
    const r = bt.perCat[c.id] || { planned: 0, spent: 0 };
    return `<div class="brow">
      <div class="brow-label">${esc(c.label)}<div class="tip">${esc(c.tip)}</div></div>
      <input type="number" min="0" placeholder="Planned $" value="${r.planned || ""}" onchange="setBudget('${c.id}','planned',this.value)">
      <input type="number" min="0" placeholder="Spent $" value="${r.spent || ""}" onchange="setBudget('${c.id}','spent',this.value)">
    </div>`;
  }).join("");
  box.innerHTML = `
    <div class="statcards">
      <div class="stat"><div class="stat-num">$${bt.planned.toLocaleString()}</div><div class="stat-lab">Planned</div></div>
      <div class="stat"><div class="stat-num">$${bt.spent.toLocaleString()}</div><div class="stat-lab">Spent (${bt.pct}%)</div></div>
      <div class="stat"><div class="stat-num">$${(bt.planned - bt.spent).toLocaleString()}</div><div class="stat-lab">Remaining</div></div>
    </div>
    <div class="bar"><div class="bar-fill" style="width:${Math.min(100, bt.pct)}%"></div></div>
    <div class="form inline">
      <input id="quickTotal" type="number" min="0" placeholder="Total budget $, e.g. 2000">
      <button class="btn small" type="button" onclick="autoBudget()">Auto-split budget</button>
    </div>
    ${rows}`;
}
function setBudget(cat, field, val) {
  const ev = active(); if (!ev) return;
  let line = ev.budget.find(l => l.category === cat);
  if (!line) { line = { category: cat, planned: 0, spent: 0 }; ev.budget.push(line); }
  line[field] = Math.max(0, Number(val) || 0);
  persist();
}
function autoBudget() {
  const ev = active(); if (!ev) return;
  const total = Number(document.getElementById("quickTotal").value) || 0;
  if (total <= 0) return;
  ev.budget = suggestedBudget(total, BUDGET_CATEGORIES);
  persist();
}

/* ---------- guests ---------- */
function renderGuests() {
  const ev = active();
  const box = document.getElementById("guestBox");
  if (!ev) { box.innerHTML = `<p class="muted">No event selected.</p>`; return; }
  const st = rsvpStats(ev.guests);
  box.innerHTML = `
    <div class="statcards">
      <div class="stat"><div class="stat-num">${st.counts.yes}</div><div class="stat-lab">Yes</div></div>
      <div class="stat"><div class="stat-num">${st.counts.maybe}</div><div class="stat-lab">Maybe</div></div>
      <div class="stat"><div class="stat-num">${st.counts.invited}</div><div class="stat-lab">Awaiting reply</div></div>
      <div class="stat"><div class="stat-num">${st.expected}</div><div class="stat-lab">Expected headcount</div></div>
    </div>
    <form class="form inline" onsubmit="addGuest(event)">
      <input id="gName" placeholder="Guest name" required>
      <input id="gContact" placeholder="Phone/email (optional)">
      <label class="check"><input type="checkbox" id="gPlus"> +1</label>
      <button class="btn small" type="submit">Add guest</button>
    </form>
    <div class="grow">
      ${(ev.guests || []).map(g => `
        <div class="grow-item">
          <div><b>${esc(g.name)}</b>${g.plusOne ? " +1" : ""}<div class="muted small">${esc(g.contact || "")}</div></div>
          <select class="rsvp rsvp-${g.rsvp}" onchange="setRsvp('${g.id}', this.value)" aria-label="RSVP status">
            ${RSVP_STATUSES.map(s => `<option value="${s}" ${g.rsvp === s ? "selected" : ""}>${RSVP_LABELS[s]}</option>`).join("")}
          </select>
          <button class="btn danger small" onclick="delGuest('${g.id}')">Remove</button>
        </div>`).join("") || `<p class="muted">No guests yet.</p>`}
    </div>`;
}
function addGuest(e) {
  e.preventDefault();
  const ev = active(); if (!ev) return;
  const name = document.getElementById("gName").value.trim();
  if (!name) return;
  ev.guests.push({ id: uid(), name, contact: document.getElementById("gContact").value.trim(), plusOne: document.getElementById("gPlus").checked, rsvp: "invited" });
  persist();
}
function setRsvp(id, v) { const ev = active(); const g = (ev.guests || []).find(x => x.id === id); if (g) { g.rsvp = v; persist(); } }
function delGuest(id) { const ev = active(); ev.guests = (ev.guests || []).filter(x => x.id !== id); persist(); }

/* ---------- vendors ---------- */
function renderVendors() {
  const ev = active();
  const box = document.getElementById("vendorBox");
  if (!ev) { box.innerHTML = `<p class="muted">No event selected.</p>`; return; }
  const st = vendorStats(ev.vendors);
  box.innerHTML = `
    <div class="statcards">
      <div class="stat"><div class="stat-num">${st.booked}/${st.total}</div><div class="stat-lab">Booked</div></div>
      <div class="stat"><div class="stat-num">$${st.cost.toLocaleString()}</div><div class="stat-lab">Committed $</div></div>
    </div>
    <form class="form inline" onsubmit="addVendor(event)">
      <input id="vName" placeholder="Vendor / business name" required>
      <input id="vService" placeholder="Service (catering, DJ…)">
      <input id="vCost" type="number" min="0" placeholder="Cost $">
      <button class="btn small" type="submit">Add vendor</button>
    </form>
    <div class="grow">
      ${(ev.vendors || []).map(v => `
        <div class="grow-item">
          <div><b>${esc(v.name)}</b><div class="muted small">${esc(v.service || "")} · ${esc(v.contact || "")}</div></div>
          <div class="muted">$${Number(v.cost || 0).toLocaleString()}</div>
          <select class="vstatus vstatus-${v.status}" onchange="setVendor('${v.id}', this.value)" aria-label="Vendor status">
            ${VENDOR_STATUSES.map(s => `<option value="${s}" ${v.status === s ? "selected" : ""}>${VENDOR_LABELS[s]}</option>`).join("")}
          </select>
          <button class="btn danger small" onclick="delVendor('${v.id}')">Remove</button>
        </div>`).join("") || `<p class="muted">No vendors yet.</p>`}
    </div>`;
}
function addVendor(e) {
  e.preventDefault();
  const ev = active(); if (!ev) return;
  const name = document.getElementById("vName").value.trim();
  if (!name) return;
  ev.vendors.push({ id: uid(), name, service: document.getElementById("vService").value.trim(), cost: Number(document.getElementById("vCost").value) || 0, contact: "", status: "researching" });
  persist();
}
function setVendor(id, v) { const ev = active(); const x = (ev.vendors || []).find(y => y.id === id); if (x) { x.status = v; persist(); } }
function delVendor(id) { const ev = active(); ev.vendors = (ev.vendors || []).filter(x => x.id !== id); persist(); }

function render() {
  renderEventPicker();
  renderTimeline();
  renderBudget();
  renderGuests();
  renderVendors();
}

document.addEventListener("DOMContentLoaded", () => {
  const sel = document.getElementById("evType");
  sel.innerHTML = Object.entries(EVENT_TYPES).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join("");
  document.getElementById("evDate").value = toISO(new Date(Date.now() + 30 * 86400000));
  document.getElementById("eventSelect").addEventListener("change", e => { S.activeId = e.target.value; persist(); });
  document.getElementById("evForm").addEventListener("submit", addEvent);
  document.querySelectorAll(".tab").forEach(b => b.addEventListener("click", () => switchTab(b.dataset.tab)));
  render();
});
