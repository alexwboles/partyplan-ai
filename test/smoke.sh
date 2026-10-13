#!/usr/bin/env bash
# PartyPlan AI smoke tests — 12 checks. Exit non-zero on first failure.
set -u
cd "$(dirname "$0")/.."
pass=0; fail=0
check() { # $1 = description, rest = command
  local desc="$1"; shift
  if "$@" >/dev/null 2>&1; then echo "PASS: $desc"; pass=$((pass+1));
  else echo "FAIL: $desc"; fail=$((fail+1)); fi
}

check "index.html exists" test -f index.html
check "css/style.css exists" test -f css/style.css
check "js/planbank.js exists" test -f js/planbank.js
check "js/logic.js exists" test -f js/logic.js
check "js/app.js exists" test -f js/app.js
check "planbank.js syntax valid" node --check js/planbank.js
check "logic.js syntax valid" node --check js/logic.js
check "app.js syntax valid" node --check js/app.js
check "10 event types in bank" node -e "const b=require('./js/planbank.js'); if(Object.keys(b.EVENT_TYPES).length<10) throw new Error('too few')"
check "every task has title/days/category" node -e "
  const b=require('./js/planbank.js');
  for (const [k,v] of Object.entries(b.EVENT_TYPES))
    for (const t of v.tasks) { if(!t.t||t.d==null||!t.c) throw new Error(k+' bad task'); }"
check "timeline builder: birthday 30d out has 9 tasks" node -e "
  const L=require('./js/logic.js'); const B=require('./js/planbank.js');
  const tl=L.buildTimeline('birthday','2026-10-28',[],'2026-09-28',B);
  if(tl.length!==9) throw new Error('got '+tl.length);"
check "budget math: planned 1000 spent 250 -> 25%" node -e "
  const L=require('./js/logic.js');
  const bt=L.budgetTotals([{category:'food',planned:1000,spent:250}]);
  if(bt.pct!==25) throw new Error('pct='+bt.pct);"
check "guest helpers + schedule helpers exported" node -e "
  const L=require('./js/logic.js');
  ['filterGuests','pendingRSVPs','followUpText','overBudgetCategories','vendorVsBudget','guestsToCSV','addScheduleItem','removeScheduleItem','sortSchedule'].forEach(f=>{
    if(typeof L[f]!=='function') throw new Error('missing '+f);});"
check "suggestedBudget still works" node -e "
  const L=require('./js/logic.js'); const B=require('./js/planbank.js');
  const lines=L.suggestedBudget(2000,B.BUDGET_CATEGORIES);
  if(Math.abs(lines.reduce((s,l)=>s+l.planned,0)-2000)>10) throw new Error('sum off');"
check "new helpers exported" node -e "
  const L=require('./js/logic.js');
  ['costPerHead','duplicateEvent','rsvpReminderText','parseGuestsCSV','splitCsvLine','normRsvp','normPlusOne'].forEach(f=>{
    if(typeof L[f]!=='function') throw new Error('missing '+f);});"
check "costPerHead: per-guest budget math" node -e "
  const L=require('./js/logic.js');
  const c=L.costPerHead({planned:2000,spent:1500},40);
  if(c.planned!==50||c.spent!==37.5) throw new Error('per-head wrong: '+JSON.stringify(c));
  const z=L.costPerHead({planned:2000,spent:1500},0);
  if(z.planned!==null||z.spent!==null) throw new Error('zero headcount should be null');"
check "duplicateEvent: fresh id, reset tasks, copied guests" node -e "
  const L=require('./js/logic.js');
  const ev={id:'e1',name:'Maya 30th',type:'birthday',date:'2026-11-01',budget:[],done:[1,2],
    guests:[{id:'g1',name:'A',rsvp:'yes'}],vendors:[{id:'v1',name:'DJ'}],schedule:[{id:'s1',time:'18:00',title:'Start'}]};
  const cp=L.duplicateEvent(ev);
  if(cp.id==='e1') throw new Error('id not fresh');
  if(cp.name!=='Maya 30th (copy)') throw new Error('name wrong: '+cp.name);
  if(cp.done.length!==0) throw new Error('done should reset');
  if(cp.guests.length!==1||cp.guests[0].id==='g1') throw new Error('guests not re-keyed');
  if(cp.vendors[0].id==='v1'||cp.schedule[0].id==='s1') throw new Error('vendor/schedule ids not fresh');
  ev.guests[0].name='CHANGED';
  if(cp.guests[0].name!=='A') throw new Error('not a deep copy');
  let threw=false; try{ L.duplicateEvent(null); }catch(e){ threw=true; }
  if(!threw) throw new Error('null should throw');"
check "rsvpReminderText: names event + date" node -e "
  const L=require('./js/logic.js');
  const t=L.rsvpReminderText({name:'Maya 30th',date:'2026-11-01'},[{name:'A'}]);
  if(!/Maya 30th/.test(t)||!/2026-11-01/.test(t)) throw new Error('missing event/date: '+t);
  if(L.rsvpReminderText({name:'x'},[])!=='') throw new Error('empty pending should be empty string');"
check "parseGuestsCSV: header, no-header, quotes, normalization" node -e "
  const L=require('./js/logic.js');
  let r=L.parseGuestsCSV('name,contact,rsvp,plus-one\nMaya Chen,555-0101,yes,yes\n\\\"Lee, Jordan\\\",,maybe,no');
  if(r.guests.length!==2) throw new Error('count '+r.guests.length);
  if(r.guests[0].rsvp!=='yes'||r.guests[0].plusOne!==true) throw new Error('row1: '+JSON.stringify(r.guests[0]));
  if(r.guests[1].name!=='Lee, Jordan'||r.guests[1].rsvp!=='maybe') throw new Error('row2: '+JSON.stringify(r.guests[1]));
  r=L.parseGuestsCSV('Sam\nAlex,555,coming,Y');
  if(r.guests.length!==2||r.guests[1].rsvp!=='yes'||r.guests[1].plusOne!==true) throw new Error('no-header: '+JSON.stringify(r.guests));
  r=L.parseGuestsCSV('Declined Dan,,declined,\n\n');
  if(r.guests.length!==1||r.guests[0].rsvp!=='no') throw new Error('rsvp norm: '+JSON.stringify(r.guests));
  if(r.skipped!==2) throw new Error('blank lines skipped: '+r.skipped);
  for(const bad of ['','   ']){
    let threw=false; try{ L.parseGuestsCSV(bad); }catch(e){ threw=true; }
    if(!threw) throw new Error('empty should throw'); }
  let threw=false; try{ L.parseGuestsCSV(',,,'); }catch(e){ threw=true; }
  if(!threw) throw new Error('no names should throw');"
check "event UI wiring: duplicate/import/reminder buttons" bash -c 'grep -q "dupEventBtn" index.html && grep -q "toggleGuestImport" js/app.js && grep -q "copyReminder" js/app.js && grep -q "duplicateActiveEvent" js/app.js'

check "setGuestDiet + dietSummary" node -e "
  const L=require('./js/logic.js');
  const g=[{id:'a',name:'A',rsvp:'yes',plusOne:true},{id:'b',name:'B',rsvp:'maybe'},{id:'c',name:'C',rsvp:'no'}];
  if(!L.setGuestDiet(g,'a','Vegan')) throw new Error('set a');
  if(!L.setGuestDiet(g,'b','Gluten-free')) throw new Error('set b');
  if(L.setGuestDiet(g,'zzz','Vegan')) throw new Error('bogus id accepted');
  if(L.setGuestDiet(g,'a','Pizza')) throw new Error('bad diet accepted');
  const s=L.dietSummary(g);
  if(s.counts['Vegan']!==2) throw new Error('plusOne counts 2: '+JSON.stringify(s.counts));
  if(s.counts['Gluten-free']!==1) throw new Error('gf: '+JSON.stringify(s.counts));
  if(s.attending!==2) throw new Error('attending: '+s.attending);"

check "invitationText" node -e "
  const L=require('./js/logic.js');
  const ev={name:'Maya 30th',type:'birthday',date:'2026-12-05',venue:'The Barn',time:'7:00 PM'};
  const t=L.invitationText(ev,{rsvpDeadline:'2026-11-28',host:'Alex',details:'Cocktail attire.'});
  if(!t.includes('Maya 30th')) throw new Error('name');
  if(!t.includes('December 5, 2026')) throw new Error('date: '+t);
  if(!t.includes('The Barn')||!t.includes('7:00 PM')) throw new Error('venue/time');
  if(!t.includes('RSVP by November 28, 2026')) throw new Error('deadline');
  if(!t.includes('Alex')) throw new Error('host');
  const bare=L.invitationText({name:'X',type:'bbq',date:null});
  if(!bare.includes('date TBA')) throw new Error('tba: '+bare);"

check "wrapUp + thanked + thankYouText" node -e "
  const L=require('./js/logic.js');
  const ev={name:'Party',budget:[{category:'food',planned:1000,spent:1200}],guests:[{id:'a',name:'A',rsvp:'yes'},{id:'b',name:'B',rsvp:'yes'},{id:'c',name:'C',rsvp:'no'}],thanked:{}};
  let w=L.wrapUp(ev);
  if(!w.over||w.overBy!==200) throw new Error('over: '+JSON.stringify(w));
  if(w.attended!==2||w.thanked!==0||w.needThanks!==2) throw new Error('thanks: '+JSON.stringify(w));
  L.setThanked(ev,'a',true);
  w=L.wrapUp(ev);
  if(w.thanked!==1||w.needThanks!==1) throw new Error('after: '+JSON.stringify(w));
  const t=L.thankYouText(ev,{host:'Alex'});
  if(!t.includes('Party')||!t.includes('Alex')) throw new Error('thanks text: '+t);"

check "second-sweep UI wired" bash -c 'grep -q "setDiet" js/app.js && grep -q "dietSummary" js/app.js && grep -q "invVenue" js/app.js && grep -q "copyInvite" js/app.js && grep -q "renderWrapUp" js/app.js && grep -q "thankList" js/app.js'

echo "--- smoke: $pass passed, $fail failed ---"
exit $((fail>0))
