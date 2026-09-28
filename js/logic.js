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

if (typeof module !== "undefined" && module.exports) {
  module.exports = { parseISO, toISO, todayISO, daysUntil, addDays, buildTimeline,
    nextTask, eventNudge, budgetTotals, rsvpStats, vendorStats, suggestedBudget };
}
