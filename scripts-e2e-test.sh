#!/usr/bin/env bash
# End-to-end check against the three running services.
set -u
B=http://localhost:8000
M=http://localhost:8001
N=http://localhost:8002
fail=0
# Unique per run so re-running against a persistent database cannot collide.
STAMP="$(date +%s)$$"

step() { printf "\n=== %s ===\n" "$1"; }
check() {
  if [ "$2" = "$3" ]; then echo "PASS $1 ($2)"; else echo "FAIL $1 (got '$2', want '$3')"; fail=1; fi
}
nonempty() {
  if [ -n "$2" ]; then echo "PASS $1 ($2)"; else echo "FAIL $1 (empty value)"; fail=1; fi
}

step "register driver"
DRV=$(curl -s -X POST $B/auth/register -H 'Content-Type: application/json' \
  -d "{\"email\":\"driver-$STAMP@e2e.com\",\"password\":\"password123\",\"full_name\":\"Dana Driver\",\"role\":\"driver\"}")
DTOKEN=$(echo "$DRV" | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
DID=$(echo "$DRV" | python -c "import sys,json;print(json.load(sys.stdin)['user']['id'])")
nonempty "driver registered" "$DID"

step "register rider"
RDR=$(curl -s -X POST $B/auth/register -H 'Content-Type: application/json' \
  -d "{\"email\":\"rider-$STAMP@e2e.com\",\"password\":\"password123\",\"full_name\":\"Rita Rider\",\"role\":\"rider\"}")
RTOKEN=$(echo "$RDR" | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
RID=$(echo "$RDR" | python -c "import sys,json;print(json.load(sys.stdin)['user']['id'])")
nonempty "rider registered" "$RID"

if [ -z "$RID" ] || [ -z "$DID" ]; then
  echo "ABORT: registration failed"
  echo "driver response: $DRV"
  echo "rider response: $RDR"
  exit 1
fi

step "driver posts availability (heading east)"
# Use a location unique to this run so only our driver can be the best match,
# which keeps the assertion meaningful even on a reused database.
DBASE=$(python -c "print(20 + (int('$STAMP') % 40) / 10.0)")
LAT=$(python -c "print(round($DBASE + 0.05, 4))")
LAT2=$(python -c "print(round($DBASE + 0.40, 4))")
echo "driver route: $LAT,$LAT2"
curl -s -X POST $M/drivers/availability -H 'Content-Type: application/json' \
  -d "{\"driver_id\":\"$DID\",\"current_lat\":$LAT,\"current_lng\":67.0011,\"destination_lat\":$LAT2,\"destination_lng\":67.1200}" \
  > /dev/null
DAVAIL=$(curl -s "$M/drivers/availability?active_only=true")
echo "$DAVAIL" | python -c "import sys,json;d=json.load(sys.stdin);print('active drivers:',len(d))"

step "rider requests a nearby ride heading the same way"
RIDE=$(curl -s -X POST $B/rides -H 'Content-Type: application/json' -H "Authorization: Bearer $RTOKEN" \
  -d "{\"user_id\":\"spoofed-id-should-be-ignored\",\"origin\":{\"lat\":$LAT,\"lng\":67.0050},\"destination\":{\"lat\":$LAT2,\"lng\":67.1100},\"time\":\"2030-01-01T10:00:00Z\"}")
RIDEID=$(echo "$RIDE" | python -c "import sys,json;print(json.load(sys.stdin).get('id',''))")
echo "ride id: $RIDEID"
check "ride owner is the rider, not the spoofed id" \
  "$(echo "$RIDE" | python -c "import sys,json;print(json.load(sys.stdin)['user_id'])")" "$RID"

step "match result"
MATCH=$(curl -s "$M/matches/$RIDEID")
echo "$MATCH"
DRIVER_MATCHED=$(echo "$MATCH" | python -c "import sys,json;print(json.load(sys.stdin)['driver_id'])")
check "matched to our driver" "$DRIVER_MATCHED" "$DID"

step "ride list is scoped to the rider"
curl -s "$B/rides/mine" -H "Authorization: Bearer $RTOKEN" \
  | python -c "import sys,json;d=json.load(sys.stdin);print('rides for rider:',len(d));print('all owned by rider:',all(r['user_id']=='$RID' for r in d))"

step "notifications after match"
NOTIF=$(curl -s "$N/notifications/$RID")
echo "$NOTIF" | python -c "
import sys,json
d=json.load(sys.stdin)
print('notifications:',len(d))
for n in d[:5]: print('  -',n['message'])"
check "match notified the rider" \
  "$(echo "$NOTIF" | python -c "import sys,json;print(len(json.load(sys.stdin)))")" "1"

step "cancel the ride"
curl -s -X PATCH "$B/rides/$RIDEID/cancel" -H "Authorization: Bearer $RTOKEN" \
  | python -c "import sys,json;print('status after cancel:',json.load(sys.stdin)['status'])"

step "notifications after cancel"
curl -s "$N/notifications/$RID" | python -c "
import sys,json
d=json.load(sys.stdin)
print('notifications:',len(d))
for n in d[:5]: print('  -',n['message'])"
check "cancel notified the rider too" \
  "$(curl -s "$N/notifications/$RID" | python -c "import sys,json;print(len(json.load(sys.stdin)))")" "2"

step "unauthenticated access is rejected"
check "GET /rides/mine without token" \
  "$(curl -s -o /dev/null -w '%{http_code}' $B/rides/mine)" "401"
check "GET /auth/me without token" \
  "$(curl -s -o /dev/null -w '%{http_code}' $B/auth/me)" "401"

printf "\n===============================\n"
if [ "$fail" = "0" ]; then echo "ALL CHECKS PASSED"; else echo "SOME CHECKS FAILED"; fi
exit $fail