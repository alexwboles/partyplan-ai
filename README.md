# 🎉 PartyPlan AI

**Plan any event without the stress.** Pick an event type and date → PartyPlan AI generates a countdown-based planning timeline, tracks your budget by category, manages the guest list with RSVPs, and keeps vendors organized — all running 100% locally in your browser.

## The problem

Event planning is death by a thousand details: invitations go out late, the budget quietly doubles, RSVPs live in five different text threads, and the vendor's phone number is… somewhere. PartyPlan AI puts the whole event in one place:

1. **10 event types** — birthday, wedding, baby shower, graduation, holiday party, dinner party, BBQ, anniversary, housewarming, retirement — each with a purpose-built timeline
2. **Countdown timelines** — tasks auto-scheduled backwards from your date, with overdue / due-soon / today states and plain-language tips per task
3. **Budget tracker** — planned vs. spent by category, progress bar, and a one-click auto-split that divides a total budget sensibly; **over-budget category alerts** flag where spending blew past the plan, and a **vendor-vs-budget check** warns when committed vendor spend already exceeds the total budget
4. **Guest list + RSVPs** — expected headcount math (yes + plus-ones + half of maybes); **search + RSVP-status filters**, a **follow-up nudge** naming everyone still awaiting reply, and **CSV export**
5. **Vendor board** — researching → contacted → booked → paid pipeline with committed spend totals
6. **Day-of schedule** — build your event-day run-of-show (validated HH:MM times, auto-sorted chronologically)
7. **Optional AI polish** — paste your own OpenAI API key for rewritten invitation wording (never required)

## How to run

No build step, no server, no account. Just open `index.html` in any browser — or serve it statically:

```bash
npx serve .        # or: python3 -m http.server 8080
```

Your data lives in `localStorage` under `partyplan.v1`. Nothing ever leaves your device.

## How timelines work

Each event type has a task bank (`js/planbank.js`) with tasks expressed as "days before the event". `buildTimeline()` converts those to concrete due dates from your event date, sorts soonest-first, and marks each task overdue / due-soon (≤7 days) / today / upcoming / done. Checking a task off removes it from the "next up" nudge.

Budget auto-split uses fixed category weights (food 30%, venue 25%, …) scaled to your total.

## Tests

```bash
bash test/smoke.sh   # 14 checks: files, syntax, data bank integrity, core math
bash test/e2e.sh     # 12 flows: timeline generation, overdue detection, RSVP math, budget split, vendor stats, nudges, guests, budget alerts, day-of schedule
```

## Pricing vision (future)

- **Free** — unlimited events, full timelines, budget, guests, vendors
- **Pro ($9/mo)** — shared planning links for co-hosts, printable checklists, vendor comparison templates
- **Planner ($29/mo)** — client workspaces for professional event planners, multi-event dashboard
