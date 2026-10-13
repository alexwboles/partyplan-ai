# PartyPlan AI — Redesign Audit (2026-10-13)

Competitors researched: **Partiful** (event page with details + RSVP tracking, bold social visuals), **Evite** (event details hub, guest list management, reminders).

## Visual gaps vs competitors
1. The app opened straight into the planning timeline — there was no **event page**: the "what/when/where" briefing that Partiful/Evite lead with and hosts screenshot to share.
2. Countdown to the event existed only as small nudges; the emotional core ("12 days to go!") had no hero.

## Functional gaps vs competitors
1. No single-glance briefing: headcount expected, budget vs actual, next task, vendor booking status lived on four separate tabs.
2. No printable/shareable party brief (the one-pager hosts print or text to co-hosts).

## Redesign plan
- **"Party page" tab** (new, first tab): event hero with big countdown, date/time/venue, expected headcount with RSVP mini-bars, budget progress, next planning task, vendor booking status — composed by a new pure, tested `eventBrief(ev, fromISO)` in logic.js.
- **Print party brief**: clean one-page print of the briefing.
- All existing features preserved: multi-event picker, planning timeline, budget tracker, guests + RSVPs + reminders, vendors, day-of schedule, wrap-up/thank-yous.

## Concept (1 paragraph)
Keep the festive identity but lead like Partiful: the first thing you see is the party itself — a bold event page with the countdown, the details, who's coming, what it costs, and what's next — with the planning machinery one tab away. The briefing prints cleanly as the one-pager you hand a co-host.
