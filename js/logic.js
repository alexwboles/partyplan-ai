/* PartyPlan AI — core logic: timelines, budget math, RSVP stats, nudges.
   Pure functions; browser-safe. Node tests require this file. */
"use strict";

function parseISO(s) {
  const [y, m, d] = String(s).split("-").map(Number);
  return new Date(y, m - 1, d);
}
function toISO(dt) {
  const p = n => String(n).padStart(2, "0");
  return dt.getFullYear() + "-" + p(dt.getMonth() + 1) + "-" + p(dt.getDate());
}
function todayISO() { return toISO(new Date()); }

/** Days from `fromISO` to `dateISO` (can be negative). */
function daysUntil(dateISO, fromISO) {
  const ms = parseISO(dateISO) - parseISO(fromISO || todayISO());
  return Math.round(ms / 86400000);
}

/** Shift a date by n days, return ISO. */
function addDays(dateISO, n) {
  const dt = parseISO(dateISO);
  dt.setDate(dt.getDate() + n);
  return toISO(dt);
}

/**
 * Build a planning timeline for an event.
 * Returns tasks with concrete due dates, sorted soonest-first, each with status:
 * overdue | due-soon (<=7d) | upcoming | done | today
 */
function buildTimeline(eventType, dateISO, doneIdx, fromISO, bank) {
  const type = (bank.EVENT_TYPES || {})[eventType];
  if (!type) return [];
  const now = fromISO || todayISO();
  const done = new Set(doneIdx || []);
  return type.tasks.map((t, i) => {
    const due = addDays(dateISO, -t.d);
    const days = daysUntil(due, now);
    let status = "upcoming";
    if (done.has(i)) status = "done";
    else if (days < 0) status = "overdue";
    else if (days === 0) status = "today";
    else if (days <= 7) status = "due-soon";
    return { idx: i, title: t.t, daysBefore: t.d, category: t.c, tip: t.n, due, days, status };
  }).sort((a, b) => a.due < b.due ? -1 : a.due > b.due ? 1 : 0);
}

/** Next actionable (not done) task, or null. */
function nextTask(timeline) {
  return timeline.find(t => t.status !== "done") || null;
}

/** Plain-language countdown nudge for an event. */
function eventNudge(days) {
  if (days < 0) return "This event already happened — archive it or pick a new date.";
  if (days === 0) return "🎉 It's today! Run the day-of checklist and enjoy.";
  if (days <= 3) return `Only ${days} day${days === 1 ? "" : "s"} left — focus on day-of tasks only.`;
  if (days <= 14) return `${days} days to go — chase RSVPs and confirm vendors this week.`;
  if (days <= 45) return `${days} days out — invitations and bookings should be happening now.`;
  return null;
}

/** Budget totals: { perCat: {id: {planned, spent}}, planned, spent, pct }. */
function budgetTotals(lines) {
  const perCat = {};
  let planned = 0, spent = 0;
  for (const l of lines || []) {
    const c = perCat[l.category] || (perCat[l.category] = { planned: 0, spent: 0 });
    c.planned += Number(l.planned) || 0;
    c.spent += Number(l.spent) || 0;
    planned += Number(l.planned) || 0;
    spent += Number(l.spent) || 0;
  }
  return { perCat, planned, spent, pct: planned > 0 ? Math.round((spent / planned) * 100) : 0 };
}

/** RSVP counts + expected headcount (yes + 0.5*maybe). */
function rsvpStats(guests) {
  const counts = { invited: 0, yes: 0, maybe: 0, no: 0 };
  let plusOnes = 0;
  for (const g of guests || []) {
    const s = counts[g.rsvp] !== undefined ? g.rsvp : "invited";
    counts[s]++;
    if (s === "yes" && g.plusOne) plusOnes++;
  }
  const expected = counts.yes + plusOnes + Math.round(counts.maybe * 0.5);
  return { counts, plusOnes, expected, total: (guests || []).length };
}

/** Vendor spend + booking progress. */
function vendorStats(vendors) {
  let cost = 0, booked = 0;
  for (const v of vendors || []) {
    cost += Number(v.cost) || 0;
    if (v.status === "booked" || v.status === "paid") booked++;
  }
  return { cost, booked, total: (vendors || []).length };
}

/** Suggested budget split: even-ish weights per category, scaled to total. */
function suggestedBudget(total, categories) {
  const weights = { venue: 25, food: 30, drinks: 10, decor: 8, entertainment: 7, photo: 8, invites: 3, attire: 4, favors: 3, misc: 2 };
  return (categories || []).map(c => ({
    category: c.id,
    planned: Math.round((total * (weights[c.id] || 5)) / 100),
    spent: 0
  }));
}

/** Filter guests by name/contact query and/or RSVP status. */
function filterGuests(guests, query, status) {
  const q = (query || "").trim().toLowerCase();
  return (guests || []).filter(g => {
    if (status && g.rsvp !== status) return false;
    if (q && ((g.name || "") + " " + (g.contact || "")).toLowerCase().indexOf(q) < 0) return false;
    return true;
  });
}

/** Guests still awaiting a reply (status "invited"). */
function pendingRSVPs(guests) {
  return (guests || []).filter(g => g.rsvp === "invited");
}

/** Plain-language follow-up nudge naming non-responders. */
function followUpText(pending) {
  const p = pending || [];
  if (!p.length) return "";
  const names = p.slice(0, 5).map(g => g.name);
  let s = "Still waiting on " + p.length + " guest" + (p.length === 1 ? "" : "s") + ": " + names.join(", ");
  if (p.length > 5) s += " (+" + (p.length - 5) + " more)";
  return s + ". Send them a nudge today.";
}

/** Categories where spending has blown past the plan. */
function overBudgetCategories(lines) {
  return (lines || [])
    .filter(l => (Number(l.planned) || 0) > 0 && (Number(l.spent) || 0) > Number(l.planned))
    .map(l => ({ category: l.category, planned: Number(l.planned), spent: Number(l.spent),
                 over: Number(l.spent) - Number(l.planned) }));
}

/** Vendor committed spend vs the overall planned budget. */
function vendorVsBudget(vendors, lines) {
  const vs = vendorStats(vendors);
  const bt = budgetTotals(lines);
  return {
    committed: vs.cost, planned: bt.planned,
    over: bt.planned > 0 && vs.cost > bt.planned,
    remaining: bt.planned - vs.cost
  };
}

function csvCell(v) {
  const s = String(v === undefined || v === null ? "" : v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

/** Guest list -> CSV (name, contact, RSVP, plus-one). */
function guestsToCSV(guests) {
  const rows = [["Name", "Contact", "RSVP", "Plus-one"]];
  (guests || []).forEach(g => {
    rows.push([g.name, g.contact, g.rsvp, g.plusOne ? "yes" : "no"]);
  });
  return rows.map(r => r.map(csvCell).join(",")).join("\n");
}

/** Day-of schedule: validated, chronologically sortable items. */
function addScheduleItem(schedule, item) {
  const time = (item && item.time || "").trim();
  const title = (item && item.title || "").trim();
  if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error("Time must be HH:MM (24h)");
  if (!title) throw new Error("Schedule item needs a title");
  const next = (schedule || []).slice();
  next.push({ id: "s" + Date.now().toString(36) + Math.floor(Math.random() * 999), time, title,
              note: (item.note || "").trim() });
  return sortSchedule(next);
}

function removeScheduleItem(schedule, id) {
  return (schedule || []).filter(s => s.id !== id);
}

function sortSchedule(schedule) {
  return (schedule || []).slice().sort((a, b) => a.time < b.time ? -1 : a.time > b.time ? 1 : 0);
}

/** Cost per expected guest: planned and spent per head. null when headcount is 0. */
function costPerHead(budgetResult, expected) {
  if (!expected || expected <= 0) return { planned: null, spent: null };
  const r = (v) => Math.round(v / expected * 100) / 100;
  return { planned: r(budgetResult.planned), spent: r(budgetResult.spent) };
}

/** Deep-copy an event as a fresh event (new id, "(copy)" name, no completed tasks). */
function duplicateEvent(ev) {
  if (!ev || typeof ev !== "object") throw new Error("duplicateEvent: event is required");
  const copy = JSON.parse(JSON.stringify(ev));
  copy.id = "e" + Date.now().toString(36) + Math.floor(Math.random() * 999);
  copy.name = (ev.name || "Untitled event") + " (copy)";
  copy.done = [];
  (copy.guests || []).forEach(g => { g.id = "g" + Date.now().toString(36) + Math.floor(Math.random() * 9999); });
  (copy.vendors || []).forEach(v => { v.id = "v" + Date.now().toString(36) + Math.floor(Math.random() * 9999); });
  (copy.schedule || []).forEach(s => { s.id = "s" + Date.now().toString(36) + Math.floor(Math.random() * 9999); });
  return copy;
}

/** Plain-language RSVP reminder naming the event and its date. */
function rsvpReminderText(ev, pending) {
  const p = pending || [];
  if (!p.length) return "";
  const name = (ev && ev.name) || "the event";
  const date = (ev && ev.date) || "";
  let s = "Quick reminder: " + name + (date ? " is on " + date : "") + " and we haven't heard from you yet. ";
  s += "Could you let us know — coming, maybe, or can't make it? ";
  if (p.length === 1) s += "Just reply to this message.";
  else s += "Even a quick yes/no helps us lock in catering and seating.";
  return s;
}

/* ---------- guest CSV import ---------- */
/* Parse pasted CSV text into guest objects. Detects a header row
   (name/contact/rsvp/plus-one). RSVP normalized to invited|yes|maybe|no. */
function splitCsvLine(line) {
  const out = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map(s => s.trim());
}

function normRsvp(v) {
  const s = String(v || "").trim().toLowerCase();
  if (["yes", "y", "coming", "attending"].includes(s)) return "yes";
  if (["maybe", "m", "tentative"].includes(s)) return "maybe";
  if (["no", "n", "declined", "cant", "can't"].includes(s)) return "no";
  return "invited";
}
function normPlusOne(v) {
  const s = String(v || "").trim().toLowerCase();
  return ["yes", "y", "true", "1", "x"].includes(s);
}

function parseGuestsCSV(text) {
  const rawLines = String(text || "").split(/\r?\n/);
  const lines = rawLines.map(l => l.trim());
  if (!lines.some(l => l.length)) throw new Error("Nothing to import — paste some CSV first.");
  const guests = [];
  let skipped = 0;
  let start = 0;
  // header detection: first line names the columns
  const first = splitCsvLine(lines[0]).map(s => s.toLowerCase());
  const looksHeader = first.some(s => /name|contact|rsvp|plus|phone|email/.test(s));
  let nameIdx = 0, contactIdx = 1, rsvpIdx = 2, plusIdx = 3;
  if (looksHeader) {
    start = 1;
    first.forEach((s, i) => {
      if (/name/.test(s)) nameIdx = i;
      else if (/contact|phone|email/.test(s)) contactIdx = i;
      else if (/rsvp|status|reply/.test(s)) rsvpIdx = i;
      else if (/plus/.test(s)) plusIdx = i;
    });
  }
  for (let i = start; i < lines.length; i++) {
    if (!lines[i].length) { skipped++; continue; }
    const cells = splitCsvLine(lines[i]);
    const name = (cells[nameIdx] || "").trim();
    if (!name) { skipped++; continue; }
    guests.push({
      id: "g" + Date.now().toString(36) + i + Math.floor(Math.random() * 999),
      name,
      contact: (cells[contactIdx] || "").trim(),
      rsvp: normRsvp(cells[rsvpIdx]),
      plusOne: normPlusOne(cells[plusIdx])
    });
  }
  if (!guests.length) throw new Error("No guest rows found — each line needs at least a name.");
  return { guests, skipped };
}

/* ---------- second sweep: diet, invitations, wrap-up ---------- */
const DIET_OPTIONS = ["Vegetarian", "Vegan", "Gluten-free", "Dairy-free", "Kosher", "Halal", "Nut allergy", "Other"];

function setGuestDiet(guests, id, diet) {
  const g = (guests || []).find(x => x.id === id);
  if (!g) return false;
  if (diet && DIET_OPTIONS.indexOf(diet) === -1) return false;
  g.diet = diet || "";
  return true;
}

/** Catering headcount: dietary needs among yes/maybe guests (+1 counts as 2 when yes). */
function dietSummary(guests) {
  const counts = {};
  let withNeeds = 0, attending = 0;
  for (const g of guests || []) {
    if (g.rsvp !== "yes" && g.rsvp !== "maybe") continue;
    attending++;
    if (g.diet) {
      withNeeds++;
      counts[g.diet] = (counts[g.diet] || 0) + ((g.rsvp === "yes" && g.plusOne) ? 2 : 1);
    }
  }
  return { counts, withNeeds, attending };
}

function prettyDate(iso) {
  if (!iso) return "date TBA";
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  return months[m - 1] + " " + d + ", " + y;
}

/** Copy-ready invitation text for the active event. */
function invitationText(ev, opts) {
  opts = opts || {};
  const type = (opts.typeLabel || ev.type || "event").replace(/-/g, " ");
  const when = prettyDate(ev.date) + (ev.time ? " at " + ev.time : "");
  const where = ev.venue ? " at " + ev.venue : "";
  const lines = [
    "You're invited to " + ev.name + "!",
    "",
    "A " + type + " on " + when + where + ".",
    opts.details ? opts.details : null,
    opts.rsvpDeadline ? "Please RSVP by " + prettyDate(opts.rsvpDeadline) + "." : null,
    opts.host ? "— " + opts.host : null
  ].filter(Boolean);
  return lines.join("\n");
}

/** Event wrap-up: actuals vs budget + attendance + thank-you progress. */
function wrapUp(ev) {
  const b = budgetTotals(ev.budget || []);
  const st = rsvpStats(ev.guests || []);
  const thanked = ev.thanked || {};
  const attending = (ev.guests || []).filter(g => g.rsvp === "yes");
  const thankedCount = attending.filter(g => thanked[g.id]).length;
  return {
    planned: b.planned, spent: b.spent,
    over: b.spent > b.planned, overBy: Math.round((b.spent - b.planned) * 100) / 100,
    attended: attending.length, expected: st.expected,
    thanked: thankedCount, needThanks: attending.length - thankedCount
  };
}

function setThanked(ev, guestId, val) {
  ev.thanked = ev.thanked || {};
  if (val) ev.thanked[guestId] = true;
  else delete ev.thanked[guestId];
}

function thankYouText(ev, opts) {
  opts = opts || {};
  const w = wrapUp(ev);
  return "Thank you for celebrating " + ev.name + " with us!" +
    (opts.host ? " — " + opts.host : "") +
    (w.over ? " (We came in over budget — next time we'll pad the food line.)" : "") +
    "\nHope you had a wonderful time.";
}

/** One-glance party briefing for the active event: countdown, headcount,
    budget, next task, vendor status. Pure — everything it needs comes in. */
function eventBrief(ev, fromISO, bank) {
  const e = ev || {};
  const tl = buildTimeline(e.type, e.date, e.done || [], fromISO, bank || { EVENT_TYPES: {} });
  const rsvp = rsvpStats(e.guests);
  const bud = budgetTotals(e.budget || []);
  const ven = vendorStats(e.vendors);
  const next = nextTask(tl);
  const totalBudget = bud.planned;
  return {
    name: e.name || "Untitled event",
    type: e.type || "",
    date: e.date || "",
    time: e.time || "",
    venue: e.venue || "",
    daysOut: e.date ? daysUntil(e.date, fromISO) : null,
    nudge: e.date ? eventNudge(daysUntil(e.date, fromISO)) : "",
    rsvp, budget: bud, vendors: ven, nextTask: next,
    totalBudget,
    budgetPct: totalBudget > 0 ? Math.min(100, Math.round(bud.spent / totalBudget * 100)) : 0,
    timelineDone: tl.filter(t => (e.done || []).includes(t.idx)).length,
    timelineTotal: tl.length
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { parseISO, toISO, todayISO, daysUntil, addDays, buildTimeline,
    nextTask, eventNudge, budgetTotals, rsvpStats, vendorStats, suggestedBudget,
    filterGuests, pendingRSVPs, followUpText, overBudgetCategories, vendorVsBudget,
    guestsToCSV, addScheduleItem, removeScheduleItem, sortSchedule,
    costPerHead, duplicateEvent, rsvpReminderText, parseGuestsCSV, splitCsvLine,
    normRsvp, normPlusOne, DIET_OPTIONS, setGuestDiet, dietSummary, invitationText,
    wrapUp, setThanked, thankYouText, prettyDate, eventBrief };
}
