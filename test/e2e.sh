#!/usr/bin/env bash
# PartyPlan AI e2e tests — 7 flows exercising real logic in Node. Exit non-zero on failure.
set -u
cd "$(dirname "$0")/.."
pass=0; fail=0
flow() { # $1 = description, $2 = node script
  if node -e "$2" >/dev/null 2>&1; then echo "PASS: $1"; pass=$((pass+1));
  else echo "FAIL: $1"; fail=$((fail+1)); fi
}

flow "wedding timeline spans 180 days, sorted soonest-first" "
  const L=require('./js/logic.js'); const B=require('./js/planbank.js');
  const tl=L.buildTimeline('wedding','2027-03-27',[],'2026-09-28',B);
  if(tl[0].title!=='Book the venue') throw new Error('first: '+tl[0].title);
  if(tl[0].due!=='2026-09-28') throw new Error('venue due: '+tl[0].due);
  for(let i=1;i<tl.length;i++) if(tl[i].due<tl[i-1].due) throw new Error('not sorted');
"

flow "overdue detection: birthday 5 days away flags old tasks" "
  const L=require('./js/logic.js'); const B=require('./js/planbank.js');
  const tl=L.buildTimeline('birthday','2026-10-03',[],'2026-09-28',B);
  const od=tl.filter(t=>t.status==='overdue');
  if(!od.length) throw new Error('no overdue found');
  if(!od.some(t=>t.title==='Send invitations')) throw new Error('invites not overdue');
"

flow "done tasks excluded from next-task" "
  const L=require('./js/logic.js'); const B=require('./js/planbank.js');
  const tl=L.buildTimeline('dinner','2026-10-12',[0,1,2,3,4,5],'2026-09-28',B);
  if(L.nextTask(tl)!==null) throw new Error('expected null, got '+L.nextTask(tl).title);
"

flow "RSVP stats: headcount math with plus-ones and maybes" "
  const L=require('./js/logic.js');
  const st=L.rsvpStats([
    {rsvp:'yes',plusOne:true},{rsvp:'yes'},{rsvp:'maybe'},{rsvp:'maybe'},{rsvp:'no'},{rsvp:'invited'}
  ]);
  if(st.expected!==4) throw new Error('expected 4, got '+st.expected);
  if(st.total!==6) throw new Error('total wrong');
"

flow "budget auto-split sums to total" "
  const L=require('./js/logic.js'); const B=require('./js/planbank.js');
  const lines=L.suggestedBudget(2000,B.BUDGET_CATEGORIES);
  const sum=lines.reduce((s,l)=>s+l.planned,0);
  if(Math.abs(sum-2000)>10) throw new Error('sum='+sum);
  const food=lines.find(l=>l.category==='food');
  if(!food||food.planned<500) throw new Error('food too small: '+(food&&food.planned));
"

flow "vendor stats: booked count and committed $" "
  const L=require('./js/logic.js');
  const st=L.vendorStats([
    {cost:500,status:'booked'},{cost:300,status:'paid'},{cost:200,status:'researching'}
  ]);
  if(st.booked!==2) throw new Error('booked='+st.booked);
  if(st.cost!==1000) throw new Error('cost='+st.cost);
"

flow "nudges escalate as event nears" "
  const L=require('./js/logic.js');
  if(L.eventNudge(60)!==null) throw new Error('far event should be quiet');
  if(!/30 days/.test(L.eventNudge(30))) throw new Error('30d nudge');
  if(!/Only 2 days/.test(L.eventNudge(2))) throw new Error('urgent nudge');
  if(!/today/.test(L.eventNudge(0))) throw new Error('today nudge');
"

echo "--- e2e: $pass passed, $fail failed ---"
exit $((fail>0))
