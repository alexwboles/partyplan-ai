/* PartyPlan AI — event-type data bank: timeline tasks + default budget categories.
   Each task: t = title, d = days before event, c = category, n = tip. */
"use strict";

const EVENT_TYPES = {
  birthday: {
    label: "🎂 Birthday party",
    tasks: [
      { t: "Pick a theme and set the guest list", d: 30, c: "planning", n: "A theme makes every other decision (decor, cake, invites) easier." },
      { t: "Send invitations", d: 21, c: "invites", n: "Digital invites are fine — just include an RSVP deadline." },
      { t: "Order the cake", d: 14, c: "food", n: "Bakeries need 1–2 weeks; confirm servings = guests + 20%." },
      { t: "Buy decorations and supplies", d: 10, c: "decor", n: "Balloons, tableware, candles. Buy 10% extra of anything breakable." },
      { t: "Plan the menu and buy drinks", d: 7, c: "food", n: "Finger food beats a sit-down meal for mingling." },
      { t: "Chase RSVPs and confirm headcount", d: 4, c: "guests", n: "A quick text gets more replies than a second email." },
      { t: "Charge cameras, prep music playlist", d: 2, c: "entertainment", n: "Download the playlist — venue wifi is never reliable." },
      { t: "Set up the space", d: 1, c: "decor", n: "Decorate the night before if you can; mornings run late." },
      { t: "🎉 Party day — have fun!", d: 0, c: "day", n: "Assign one friend as photographer so you're in pictures too." }
    ]
  },
  wedding: {
    label: "💒 Wedding",
    tasks: [
      { t: "Book the venue", d: 180, c: "venue", n: "Venues book out 6–12 months ahead; this is the critical path." },
      { t: "Hire the caterer", d: 150, c: "food", n: "Tasting first, contract second. Confirm service style and rentals." },
      { t: "Send save-the-dates", d: 120, c: "invites", n: "Earlier for destination weddings (6–8 months)." },
      { t: "Order attire", d: 90, c: "attire", n: "Alterations take 4–8 weeks — order earlier than feels necessary." },
      { t: "Book photographer / videographer", d: 60, c: "photo", n: "Review full galleries, not just highlight reels." },
      { t: "Send formal invitations", d: 45, c: "invites", n: "RSVP deadline 3–4 weeks before the date." },
      { t: "Finalize menu and cake tasting", d: 30, c: "food", n: "Lock dietary options for guests now." },
      { t: "Confirm all vendors in writing", d: 14, c: "vendors", n: "Arrival times, setup needs, final payments — all in one email each." },
      { t: "Final headcount to caterer + seating chart", d: 7, c: "guests", n: "Pad the chart with 2 spare seats per 50 guests." },
      { t: "Rehearsal and rehearsal dinner", d: 1, c: "day", n: "Walk the ceremony start to finish, cues and all." },
      { t: "💒 Wedding day!", d: 0, c: "day", n: "Eat. Seriously — assign someone to bring you food." }
    ]
  },
  babyshower: {
    label: "🍼 Baby shower",
    tasks: [
      { t: "Pick a date with the parent-to-be", d: 35, c: "planning", n: "4–6 weeks before the due date is the sweet spot." },
      { t: "Create the gift registry", d: 28, c: "planning", n: "One registry, shared everywhere, avoids duplicates." },
      { t: "Send invitations", d: 21, c: "invites", n: "Include registry link and RSVP date." },
      { t: "Plan games and prizes", d: 14, c: "entertainment", n: "3 short games max — people want to mingle." },
      { t: "Order cake and food", d: 10, c: "food", n: "Brunch showers are cheapest and easiest to cater." },
      { t: "Buy decorations", d: 7, c: "decor", n: "A balloon garland does 80% of the visual work." },
      { t: "Confirm RSVPs, set up the space", d: 1, c: "guests", n: "Set up a gift table near the seat of honor." },
      { t: "🍼 Shower day!", d: 0, c: "day", n: "Designate a gift-recorder so thank-you notes are easy." }
    ]
  },
  graduation: {
    label: "🎓 Graduation party",
    tasks: [
      { t: "Pick date, venue, guest list", d: 35, c: "planning", n: "Avoid the actual ceremony day — everyone's booked." },
      { t: "Send invitations", d: 21, c: "invites", n: "Classmates' families plus your family — cap it early." },
      { t: "Order food (taco bar / BBQ scales well)", d: 14, c: "food", n: "Self-serve lines feed crowds cheaply." },
      { t: "Photo display + memory table", d: 10, c: "decor", n: "Print photos early; drugstore prints take days." },
      { t: "Buy decorations in school colors", d: 7, c: "decor", n: "One color scheme keeps it classy, not chaotic." },
      { t: "Confirm RSVPs and food quantities", d: 3, c: "guests", n: "Expect 70–80% of 'yes' RSVPs to actually show." },
      { t: "🎓 Party day — congrats grad!", d: 0, c: "day", n: "Have the grad write a 30-second thank-you speech." }
    ]
  },
  holiday: {
    label: "🎄 Holiday party",
    tasks: [
      { t: "Set date and guest list", d: 35, c: "planning", n: "December fills fast — early December beats late." },
      { t: "Send invitations", d: 24, c: "invites", n: "RSVP deadline 10 days out; holiday no-shows are common." },
      { t: "Plan menu (potluck or catered?)", d: 18, c: "food", n: "Potluck with assigned dishes beats 10 desserts." },
      { t: "Decorate", d: 10, c: "decor", n: "Lights + one statement piece > scattered knick-knacks." },
      { t: "Buy drinks and supplies", d: 7, c: "food", n: "1 drink per guest per hour is the safe formula." },
      { t: "Confirm RSVPs, prep space", d: 2, c: "guests", n: "Clear coat space — winter parties = coat mountain." },
      { t: "🎄 Party day!", d: 0, c: "day", n: "Start music 30 min before guests arrive." }
    ]
  },
  dinner: {
    label: "🍽️ Dinner party",
    tasks: [
      { t: "Set date, guest list, menu", d: 14, c: "planning", n: "Ask about dietary restrictions in the invite." },
      { t: "Send invitations", d: 10, c: "invites", n: "Small groups: a group text works great." },
      { t: "Grocery shop (non-perishables)", d: 5, c: "food", n: "Shop twice: staples early, fresh stuff day-before." },
      { t: "Prep-ahead cooking", d: 1, c: "food", n: "Anything braised/stewed tastes better made a day early." },
      { t: "Set the table, chill drinks", d: 0, c: "day", n: "Candles + a playlist = instant atmosphere." },
      { t: "🍽️ Dinner is served!", d: 0, c: "day", n: "Serve the first course within 20 min of arrival." }
    ]
  },
  bbq: {
    label: "🍔 Backyard BBQ",
    tasks: [
      { t: "Set date and guest list", d: 21, c: "planning", n: "Have a rain plan (garage/tent) before you invite." },
      { t: "Send invitations", d: 14, c: "invites", n: "Mention 'bring a chair' if seating is tight." },
      { t: "Service the grill, buy fuel", d: 7, c: "planning", n: "Clean grates + full propane tank = no day-of panic." },
      { t: "Buy food and drinks", d: 3, c: "food", n: "1.5x the meat you think — BBQ leftovers are a feature." },
      { t: "Set up yard games, coolers, shade", d: 1, c: "entertainment", n: "Ice the drinks 2 hours before, not 20 minutes." },
      { t: "🍔 Grill on!", d: 0, c: "day", n: "Start the grill 45 min before you want to eat." }
    ]
  },
  anniversary: {
    label: "💕 Anniversary",
    tasks: [
      { t: "Decide: party, trip, or quiet dinner?", d: 30, c: "planning", n: "Match the scale to the couple, not the milestone number." },
      { t: "Book venue / make reservations", d: 21, c: "venue", n: "Milestone anniversaries (25/50) deserve a real venue." },
      { t: "Send invitations", d: 18, c: "invites", n: "Surprise parties: tell guests it's a surprise twice." },
      { t: "Order cake and food", d: 10, c: "food", n: "Recreate the wedding cake flavor for a nice touch." },
      { t: "Photo timeline of the couple", d: 7, c: "decor", n: "Crowdsource photos from family early." },
      { t: "💕 Celebration day!", d: 0, c: "day", n: "Have someone give a 2-minute toast — it means a lot." }
    ]
  },
  housewarming: {
    label: "🏠 Housewarming",
    tasks: [
      { t: "Unpack the key rooms first", d: 21, c: "planning", n: "Kitchen, bathrooms, one hangout space — the rest can wait." },
      { t: "Set date and guest list", d: 14, c: "invites", n: "2–3 weeks after move-in is realistic." },
      { t: "Send invitations", d: 10, c: "invites", n: "'No gifts, just bring yourselves' (or a registry if you want)." },
      { t: "Plan simple food and drinks", d: 7, c: "food", n: "Keep it simple — you're still unpacking." },
      { t: "Quick-clean and set up tour path", d: 1, c: "decor", n: "Close doors on unfinished rooms. Nobody minds." },
      { t: "🏠 Welcome home!", d: 0, c: "day", n: "Put a guest book by the door — great keepsake." }
    ]
  },
  retirement: {
    label: "🌅 Retirement party",
    tasks: [
      { t: "Set date, venue, guest list", d: 35, c: "planning", n: "Invite former colleagues too — they love these." },
      { t: "Collect photos and stories", d: 28, c: "decor", n: "Ask coworkers for stories 3+ weeks out." },
      { t: "Send invitations", d: 21, c: "invites", n: "Include a note if speeches/toasts are welcome." },
      { t: "Order food and cake", d: 14, c: "food", n: "Sheet cake with a fun message never misses." },
      { t: "Memory book / slideshow", d: 7, c: "entertainment", n: "A shared photo folder beats chasing attachments." },
      { t: "🌅 Celebrate!", d: 0, c: "day", n: "Present the memory book early so they can enjoy it at the party." }
    ]
  }
};

const BUDGET_CATEGORIES = [
  { id: "venue", label: "🏠 Venue", tip: "Parks, community halls, and backyards beat banquet halls on price." },
  { id: "food", label: "🍽️ Food", tip: "Self-serve stations cost ~40% less than plated service." },
  { id: "drinks", label: "🥤 Drinks", tip: "Batch cocktails or a signature drink beats a full bar." },
  { id: "decor", label: "🎈 Decorations", tip: "One statement piece + lights outperforms scattered decor." },
  { id: "entertainment", label: "🎶 Entertainment", tip: "A great playlist is free; a DJ is $500+." },
  { id: "photo", label: "📸 Photo/Video", tip: "A talented friend + good light beats a budget pro." },
  { id: "invites", label: "✉️ Invitations", tip: "Digital invites save $2–5 per guest." },
  { id: "attire", label: "👗 Attire", tip: "Rent formalwear you'll wear once." },
  { id: "favors", label: "🎁 Favors/Gifts", tip: "Edible favors get kept; trinkets get tossed." },
  { id: "misc", label: "🧾 Miscellaneous", tip: "Always budget 10% misc — something always comes up." }
];

const RSVP_STATUSES = ["invited", "yes", "maybe", "no"];
const RSVP_LABELS = { invited: "✉️ Invited", yes: "✅ Yes", maybe: "❔ Maybe", no: "❌ No" };

const VENDOR_STATUSES = ["researching", "contacted", "booked", "paid"];
const VENDOR_LABELS = { researching: "🔍 Researching", contacted: "📞 Contacted", booked: "📝 Booked", paid: "💰 Paid" };

if (typeof module !== "undefined" && module.exports) {
  module.exports = { EVENT_TYPES, BUDGET_CATEGORIES, RSVP_STATUSES, RSVP_LABELS, VENDOR_STATUSES, VENDOR_LABELS };
}
