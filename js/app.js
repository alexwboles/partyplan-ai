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
let guestQuery = "", guestStatus = "";

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
  const ev = { id: uid(), name, type, date,
    time: document.getElementById("evTime").value || "",
    venue: document.getElementById("evVenue").value.trim() || "",
    budget: [], guests: [], vendors: [], done: [], schedule: [] };
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
  const over = overBudgetCategories(ev.budget);
  const overSet = {};
  over.forEach(o => overSet[o.category] = o);
  const vvb = vendorVsBudget(ev.vendors, ev.budget);
  const st = rsvpStats(ev.guests);
  const cph = costPerHead(bt, st.expected);
  const perHeadLine = st.expected
    ? `<div class="stat"><div class="stat-num">$${cph.planned.toLocaleString()}</div><div class="stat-lab">Planned / head (${st.expected})</div></div>
       <div class="stat"><div class="stat-num">$${cph.spent.toLocaleString()}</div><div class="stat-lab">Spent / head</div></div>`
    : "";
  const rows = BUDGET_CATEGORIES.map(c => {
    const r = bt.perCat[c.id] || { planned: 0, spent: 0 };
    const o = overSet[c.id];
    return `<div class="brow">
      <div class="brow-label">${esc(c.label)}<div class="tip">${esc(c.tip)}</div>
      ${o ? `<div class="over-flag">Over by $${o.over.toLocaleString()} — spent $${o.spent.toLocaleString()} of $${o.planned.toLocaleString()} planned</div>` : ""}</div>
      <input type="number" min="0" placeholder="Planned $" value="${r.planned || ""}" onchange="setBudget('${c.id}','planned',this.value)">
      <input type="number" min="0" placeholder="Spent $" value="${r.spent || ""}" onchange="setBudget('${c.id}','spent',this.value)">
    </div>`;
  }).join("");
  box.innerHTML = `
    <div class="statcards">
      <div class="stat"><div class="stat-num">$${bt.planned.toLocaleString()}</div><div class="stat-lab">Planned</div></div>
      <div class="stat"><div class="stat-num">$${bt.spent.toLocaleString()}</div><div class="stat-lab">Spent (${bt.pct}%)</div></div>
      <div class="stat"><div class="stat-num">$${(bt.planned - bt.spent).toLocaleString()}</div><div class="stat-lab">Remaining</div></div>
      <div class="stat"><div class="stat-num">$${vvb.committed.toLocaleString()}</div><div class="stat-lab">Vendor committed</div></div>
      ${perHeadLine}
    </div>
    <div class="bar"><div class="bar-fill" style="width:${Math.min(100, bt.pct)}%"></div></div>
    ${over.length ? `<div class="nudge warn"><strong>Over budget in ${over.length} categor${over.length === 1 ? "y" : "ies"}:</strong> ${over.map(o => esc(o.category) + " (+$" + o.over.toLocaleString() + ")").join(", ")}</div>` : ""}
    ${vvb.over ? `<div class="nudge warn"><strong>Heads up:</strong> committed vendor spend ($${vvb.committed.toLocaleString()}) already exceeds your $${vvb.planned.toLocaleString()} total budget.</div>` : ""}
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
  const pending = pendingRSVPs(ev.guests);
  const visible = filterGuests(ev.guests, guestQuery, guestStatus);
  box.innerHTML = `
    <div class="statcards">
      <div class="stat"><div class="stat-num">${st.counts.yes}</div><div class="stat-lab">Yes</div></div>
      <div class="stat"><div class="stat-num">${st.counts.maybe}</div><div class="stat-lab">Maybe</div></div>
      <div class="stat"><div class="stat-num">${st.counts.invited}</div><div class="stat-lab">Awaiting reply</div></div>
      <div class="stat"><div class="stat-num">${st.expected}</div><div class="stat-lab">Expected headcount</div></div>
    </div>
    ${pending.length ? `<div class="nudge warn"><strong>Follow up:</strong> ${esc(followUpText(pending))}</div>` : ""}
    <form class="form inline" onsubmit="addGuest(event)">
      <input id="gName" placeholder="Guest name" required>
      <input id="gContact" placeholder="Phone/email (optional)">
      <label class="check"><input type="checkbox" id="gPlus"> +1</label>
      <button class="btn small" type="submit">Add guest</button>
    </form>
    <div class="form inline">
      <button class="btn small" type="button" onclick="toggleGuestImport()">Import CSV</button>
      ${pending.length ? `<button class="btn small" type="button" onclick="copyReminder()">Copy RSVP reminder</button>` : ""}
    </div>
    <div id="guestImport" style="display:none" class="form">
      <textarea id="guestCsv" rows="5" style="width:100%" placeholder="Paste guest CSV — one per line. Header optional: name,contact,rsvp,plus-one&#10;e.g.&#10;Maya Chen,555-0101,yes,yes&#10;Jordan Lee,,maybe,"></textarea>
      <div class="form inline">
        <button class="btn small" type="button" onclick="importGuestCsv()">Import</button>
        <button class="btn small" type="button" onclick="toggleGuestImport()">Cancel</button>
      </div>
      <p class="muted small" id="guestImportMsg"></p>
    </div>
    <div class="form inline">
      <input id="guestSearch" placeholder="Search guests…" value="${esc(guestQuery)}" aria-label="Search guests">
      <select id="guestStatusFilter" aria-label="Filter by RSVP status">
        <option value="">All statuses</option>
        ${RSVP_STATUSES.map(s => `<option value="${s}"${guestStatus === s ? " selected" : ""}>${RSVP_LABELS[s]}</option>`).join("")}
      </select>
      <button class="btn small" type="button" onclick="exportGuests()">Export CSV</button>
    </div>
    <p class="muted small">${visible.length} of ${(ev.guests || []).length} guests shown.</p>
    <div class="grow">
      ${visible.map(g => `
        <div class="grow-item">
          <div><b>${esc(g.name)}</b>${g.plusOne ? " +1" : ""}<div class="muted small">${esc(g.contact || "")}</div></div>
          <select class="rsvp rsvp-${g.rsvp}" onchange="setRsvp('${g.id}', this.value)" aria-label="RSVP status">
            ${RSVP_STATUSES.map(s => `<option value="${s}" ${g.rsvp === s ? "selected" : ""}>${RSVP_LABELS[s]}</option>`).join("")}
          </select>
          <select class="diet" onchange="setDiet('${g.id}', this.value)" aria-label="Dietary needs">
            <option value="">No diet needs</option>
            ${DIET_OPTIONS.map(o => `<option value="${o}"${g.diet === o ? " selected" : ""}>${o}</option>`).join("")}
          </select>
          <button class="btn danger small" onclick="delGuest('${g.id}')">Remove</button>
        </div>`).join("") || `<p class="muted">${guestQuery || guestStatus ? "No guests match that filter." : "No guests yet."}</p>`}
    </div>
    <div class="panel">
      <h3>Catering headcount</h3>
      <div id="dietSummary"></div>
    </div>
    <div class="panel">
      <h3>Invitations</h3>
      <div class="form inline">
        <input id="invVenue" placeholder="Venue" value="${esc(ev.venue || "")}" aria-label="Venue">
        <input id="invTime" placeholder="Time (e.g. 6:00 PM)" value="${esc(ev.time || "")}" aria-label="Time">
        <input id="invDeadline" type="date" value="${esc(ev.rsvpDeadline || "")}" aria-label="RSVP deadline">
      </div>
      <div class="form inline">
        <input id="invHost" placeholder="Host name (optional)" aria-label="Host name">
        <input id="invDetails" placeholder="Extra details (optional)" aria-label="Extra details">
      </div>
      <div class="form inline">
        <button class="btn small" type="button" onclick="copyInvite()">Copy invitation text</button>
      </div>
      <pre class="invite-preview" id="invitePreview" aria-live="polite"></pre>
    </div>
    <div class="panel">
      <h3>Event wrap-up</h3>
      <div id="wrapSummary"></div>
      <div class="grow" id="thankList"></div>
      <div class="form inline">
        <button class="btn small" type="button" onclick="copyThankYou()">Copy thank-you text</button>
      </div>
    </div>`;
  const gs = document.getElementById("guestSearch");
  gs.addEventListener("input", () => { guestQuery = gs.value; clearTimeout(gs._t); gs._t = setTimeout(renderGuests, 220); });
  document.getElementById("guestStatusFilter").addEventListener("change", e => { guestStatus = e.target.value; renderGuests(); });
  // second sweep: diet summary, invite preview, wrap-up
  const ds = dietSummary(ev.guests);
  const dsBox = document.getElementById("dietSummary");
  const dietKeys = Object.keys(ds.counts);
  dsBox.innerHTML = dietKeys.length
    ? `<div class="statcards">` + dietKeys.map(k => `<div class="stat"><div class="stat-num">${ds.counts[k]}</div><div class="stat-lab">${esc(k)}</div></div>`).join("") + `</div>
       <p class="muted small">${ds.withNeeds} of ${ds.attending} attending guests have dietary needs.</p>`
    : `<p class="muted small">No dietary needs recorded among ${ds.attending} attending (yes/maybe) guests.</p>`;
  ["invVenue", "invTime", "invDeadline"].forEach(id => {
    const f = document.getElementById(id);
    if (f) f.addEventListener("change", () => { syncInviteFields(); updateInvitePreview(); });
  });
  ["invHost", "invDetails"].forEach(id => {
    const f = document.getElementById(id);
    if (f) f.addEventListener("input", updateInvitePreview);
  });
  updateInvitePreview();
  renderWrapUp();
}
function setDiet(id, v) { const ev = active(); if (ev && setGuestDiet(ev.guests, id, v)) persist(); }
function syncInviteFields() {
  const ev = active(); if (!ev) return;
  ev.venue = document.getElementById("invVenue").value.trim();
  ev.time = document.getElementById("invTime").value.trim();
  ev.rsvpDeadline = document.getElementById("invDeadline").value || null;
  save(S);
}
function inviteOpts() {
  return {
    rsvpDeadline: document.getElementById("invDeadline").value || null,
    host: document.getElementById("invHost").value.trim(),
    details: document.getElementById("invDetails").value.trim()
  };
}
function updateInvitePreview() {
  const ev = active(); if (!ev) return;
  const pv = document.getElementById("invitePreview");
  if (pv) pv.textContent = invitationText(ev, inviteOpts());
}
function copyInvite() {
  const ev = active(); if (!ev) return;
  syncInviteFields();
  const txt = invitationText(ev, inviteOpts());
  const pv = document.getElementById("invitePreview");
  if (pv) pv.textContent = txt;
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt);
  alert("Invitation copied — paste it into your invites.");
}
function renderWrapUp() {
  const ev = active(); if (!ev) return;
  const w = wrapUp(ev);
  const box = document.getElementById("wrapSummary");
  if (box) box.innerHTML =
    `<div class="statcards">
      <div class="stat"><div class="stat-num">$${w.planned}</div><div class="stat-lab">Planned</div></div>
      <div class="stat"><div class="stat-num">$${w.spent}</div><div class="stat-lab">Spent</div></div>
      <div class="stat"><div class="stat-num">${w.attended}</div><div class="stat-lab">Attended</div></div>
      <div class="stat"><div class="stat-num">${w.thanked}/${w.attended}</div><div class="stat-lab">Thanked</div></div>
    </div>` +
    (w.over ? `<div class="nudge warn"><strong>Over budget by $${w.overBy}.</strong> Planned $${w.planned}, spent $${w.spent}.</div>`
            : `<div class="nudge"><strong>On/under budget.</strong> Planned $${w.planned}, spent $${w.spent}.</div>`);
  const tl = document.getElementById("thankList");
  if (tl) tl.innerHTML = (ev.guests || []).filter(g => g.rsvp === "yes").map(g => `
    <div class="grow-item">
      <div><b>${esc(g.name)}</b></div>
      <label class="check"><input type="checkbox"${(ev.thanked || {})[g.id] ? " checked" : ""} onchange="setThanks('${g.id}', this.checked)"> Thanked</label>
    </div>`).join("") || `<p class="muted small">No guests marked yes yet.</p>`;
}
function setThanks(id, v) { const ev = active(); if (ev) { setThanked(ev, id, v); persist(); } }
function copyThankYou() {
  const ev = active(); if (!ev) return;
  const hostField = document.getElementById("invHost");
  const txt = thankYouText(ev, { host: hostField ? hostField.value.trim() : "" });
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt);
  alert("Thank-you text copied.");
}
function exportGuests() {
  const ev = active(); if (!ev) return;
  const blob = new Blob([guestsToCSV(ev.guests)], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "partyplan-guests.csv"; a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function addGuest(e) {
  e.preventDefault();
  const ev = active(); if (!ev) return;
  const name = document.getElementById("gName").value.trim();
  if (!name) return;
  ev.guests.push({ id: uid(), name, contact: document.getElementById("gContact").value.trim(), plusOne: document.getElementById("gPlus").checked, rsvp: "invited" });
  persist();
}
function toggleGuestImport() {
  const box = document.getElementById("guestImport");
  if (!box) return;
  box.style.display = box.style.display === "none" ? "" : "none";
}
function importGuestCsv() {
  const ev = active(); if (!ev) return;
  const msg = document.getElementById("guestImportMsg");
  try {
    const res = parseGuestsCSV(document.getElementById("guestCsv").value);
    ev.guests = (ev.guests || []).concat(res.guests);
    persist();
    msg.textContent = "Imported " + res.guests.length + " guest" + (res.guests.length === 1 ? "" : "s") +
      (res.skipped ? " (" + res.skipped + " blank line" + (res.skipped === 1 ? "" : "s") + " skipped)" : "") + ".";
  } catch (err) { msg.textContent = "Import failed: " + err.message; }
}
function copyReminder() {
  const ev = active(); if (!ev) return;
  const text = rsvpReminderText(ev, pendingRSVPs(ev.guests));
  if (!text) return;
  const done = () => alert("Reminder text copied — paste it into your group chat.");
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, done);
  else done();
}
function duplicateActiveEvent() {
  const ev = active(); if (!ev) return;
  const copy = duplicateEvent(ev);
  S.events.push(copy); S.activeId = copy.id;
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

/* ---------- day-of schedule ---------- */
function renderSchedule() {
  const ev = active();
  const box = document.getElementById("dayofBox");
  if (!ev) { box.innerHTML = `<p class="muted">No event selected.</p>`; return; }
  const items = sortSchedule(ev.schedule || []);
  box.innerHTML = `
    <form class="form inline" onsubmit="addScheduleItemUI(event)">
      <input id="schTime" type="time" required aria-label="Time">
      <input id="schTitle" placeholder="What happens (e.g. Guests arrive)" required>
      <input id="schNote" placeholder="Note / owner (optional)">
      <button class="btn small" type="submit">Add to schedule</button>
    </form>
    ${items.length ? `<div class="grow">` + items.map(s => `
      <div class="grow-item">
        <div class="sched-time"><b>${esc(s.time)}</b></div>
        <div class="sched-title"><b>${esc(s.title)}</b>${s.note ? `<div class="muted small">${esc(s.note)}</div>` : ""}</div>
        <button class="btn danger small" onclick="delScheduleItem('${s.id}')">Remove</button>
      </div>`).join("") + `</div>` : `<p class="muted">No schedule yet — add the first run-of-show item above.</p>`}`;
}
function addScheduleItemUI(e) {
  e.preventDefault();
  const ev = active(); if (!ev) return;
  try {
    ev.schedule = addScheduleItem(ev.schedule || [], {
      time: document.getElementById("schTime").value,
      title: document.getElementById("schTitle").value,
      note: document.getElementById("schNote").value
    });
    persist();
  } catch (err) { alert(err.message); }
}
function delScheduleItem(id) {
  const ev = active(); if (!ev) return;
  ev.schedule = removeScheduleItem(ev.schedule || [], id);
  persist();
}

/* ---------- party page: the one-glance briefing ---------- */
function renderBrief() {
  const ev = active();
  const box = document.getElementById("briefBox");
  if (!ev) { box.innerHTML = `<p class="muted">Create your first event above — the party page will appear here.</p>`; return; }
  const b = eventBrief(ev, todayISO(), { EVENT_TYPES });
  const typeLabel = ((EVENT_TYPES[ev.type] || {}).label || ev.type || "").replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/gu, "").trim();
  const r = b.rsvp.counts;
  const rsvpBars = [["yes", r.yes, "var(--good)"], ["maybe", r.maybe, "var(--gold)"], ["no", r.no, "var(--bad)"], ["invited", r.invited, "var(--ink-soft)"]]
    .filter(x => x[1] > 0)
    .map(x => `<div class="rsvp-bar"><span>${x[0]} · ${x[1]}</span><i style="width:${Math.round(x[1] / Math.max(1, b.rsvp.total) * 100)}%;background:${x[2]}"></i></div>`).join("");
  box.innerHTML =
    `<div class="brief-hero">
       <div class="brief-count"><span class="num">${b.daysOut < 0 ? -b.daysOut : b.daysOut}</span><span class="lbl">${b.daysOut < 0 ? "days ago" : b.daysOut === 0 ? "today — showtime" : "days to go"}</span></div>
       <div><div class="ev-type">${esc(typeLabel)}</div>
       <h2 class="brief-name">${esc(b.name)}</h2>
       <div class="brief-meta">${esc(b.date)}${b.time ? " · " + esc(b.time) : ""}${b.venue ? " · " + esc(b.venue) : ""}</div></div>
     </div>` +
    (b.nudge ? `<div class="nudge">${esc(b.nudge)}</div>` : "") +
    `<div class="brief-grid">
       <div class="card"><h3>Headcount</h3><div class="big-num">${b.rsvp.expected}</div><p class="muted small">expected · ${r.yes} yes${b.rsvp.plusOnes ? " (+" + b.rsvp.plusOnes + " plus-ones)" : ""}</p>${rsvpBars}</div>
       <div class="card"><h3>Budget</h3><div class="big-num">$${b.budget.spent.toLocaleString()}</div><p class="muted small">of $${b.totalBudget.toLocaleString()} planned</p><div class="bar"><div class="bar-fill" style="width:${b.budgetPct}%"></div></div></div>
       <div class="card"><h3>Vendors</h3><div class="big-num">${b.vendors.booked}/${b.vendors.total}</div><p class="muted small">booked</p></div>
       <div class="card"><h3>Planning</h3><div class="big-num">${b.timelineDone}/${b.timelineTotal}</div><p class="muted small">tasks done</p>${b.nextTask ? `<p class="small"><strong>Next:</strong> ${esc(b.nextTask.title)}</p>` : `<p class="small">All tasks done — enjoy!</p>`}</div>
     </div>
     <div class="row" style="margin-top:1rem"><button class="btn small" id="briefPrint">Print party brief</button></div>`;
  document.getElementById("briefPrint").addEventListener("click", () => {
    document.body.classList.add("printing-brief");
    window.print();
    setTimeout(() => document.body.classList.remove("printing-brief"), 500);
  });
}

function render() {
  renderEventPicker();
  renderBrief();
  renderTimeline();
  renderBudget();
  renderGuests();
  renderVendors();
  renderSchedule();
}

document.addEventListener("DOMContentLoaded", () => {
  const sel = document.getElementById("evType");
  sel.innerHTML = Object.entries(EVENT_TYPES).map(([k, v]) => `<option value="${k}">${esc(v.label.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/gu, "").trim())}</option>`).join("");
  document.getElementById("evDate").value = toISO(new Date(Date.now() + 30 * 86400000));
  document.getElementById("eventSelect").addEventListener("change", e => { S.activeId = e.target.value; persist(); });
  document.getElementById("evForm").addEventListener("submit", addEvent);
  document.getElementById("dupEventBtn").addEventListener("click", duplicateActiveEvent);
  document.querySelectorAll(".tab").forEach(b => b.addEventListener("click", () => switchTab(b.dataset.tab)));
  render();
});
