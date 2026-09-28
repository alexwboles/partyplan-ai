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

echo "--- smoke: $pass passed, $fail failed ---"
exit $((fail>0))
