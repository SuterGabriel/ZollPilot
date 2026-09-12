#!/usr/bin/env bash
# Rauchtest gegen das laufende System (docker compose up -d --wait).
#
# Fünf Runden, ein Beweis:
#   1. Die Testakten (fertige Assertions) an /webhook/akte — Compose, Import,
#      gebündelter Code-Node und Schema arbeiten zusammen.
#   2. Die Testbelege (PDF) an /webhook/belege — dazu der Extraktionsdienst
#      (ADR-005): PDF rein, Entscheidung raus, über denselben Node.
#   3. Dieselbe Akte über die Oberfläche und ihren Proxy (ADR-006): Damit ist
#      geprüft, dass nginx die Anwendung ausliefert und /webhook/ durchreicht.
#   4. Dieselbe Akte mit einer Übersteuerung (ADR-007): Der Befund bleibt
#      verletzt, die Regelentscheidung bleibt blockiert, nur die Entscheidung
#      unter menschlicher Verantwortung dreht — und mit ihr der Statuscode.
#   5. Eine Akte, an der der Workflow scheitert: Der Aufrufer bekommt 500 mit
#      der Ausführungs-ID, nicht 200 mit leerem Rumpf, und der Betrieb bekommt
#      seine Zeile in `workflow_fehler`.
#   6. Ein Lauf, der am Extraktionsdienst scheitert, lässt sich wiederholen:
#      Der Dienst wird angehalten, der Aufrufer bekommt 500 mit `wiederholbar`,
#      der Dienst kommt zurück, POST /webhook/wiederholen liefert die
#      Entscheidung, die Zeile in `wiedervorlage` ist erledigt.
#   7. Das Monitoring sieht, was gelaufen ist: Prometheus hat alle Ziele,
#      die Alarmregeln sind geladen, die fachlichen Zähler zeigen die
#      Prüfungen dieses Laufs, Grafana liefert das Dashboard, der
#      Alertmanager ist bereit.
# Jede Akte trägt ihre Erwartung selbst; das Skript vergleicht. Danach:
# Liegen die Prüfungen in Postgres?
#
# Aufruf: bash scripts/rauchtest.sh [n8n] [extraktion] [oberflaeche] [prometheus] [grafana] [alertmanager]
#   Vorgaben: http://localhost:5678 8765 8088 9090 3000 9093

set -uo pipefail
cd "$(dirname "$0")/.."

basis="${1:-http://localhost:5678}"
extraktion="${2:-http://localhost:8765}"
oberflaeche="${3:-http://localhost:8088}"
prometheus="${4:-http://localhost:9090}"
grafana="${5:-http://localhost:3000}"
alertmanager="${6:-http://localhost:9093}"
fehler=0
runden=0

# Liest ein Feld aus JSON auf stdin; leer, wenn es fehlt oder kein JSON ist.
json_feld() {
  node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const v=JSON.parse(s)$1;console.log(v===undefined||v===null?'':String(v))}catch{console.log('')}})"
}
sql() {
  docker compose exec -T postgres psql -U "${POSTGRES_USER:-zollpilot}" -d zollpilot -tAc "$1" 2>/dev/null
}

echo
echo "Rauchtest gegen $basis"
echo "=============================="
echo

if ! curl -fsS "$basis/healthz" >/dev/null; then
  echo "  FEHLER n8n antwortet nicht auf /healthz"
  exit 1
fi
echo "  ok    n8n /healthz"

ocr=$(curl -fsS "$extraktion/healthz" 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const j=JSON.parse(s);console.log(j.status==='ok'?(j.ocr.verfuegbar?'ok, OCR '+j.ocr.version:'ok, OHNE OCR'):'FEHLER')}catch{console.log('FEHLER')}})")
if [[ "$ocr" == FEHLER* ]]; then
  echo "  FEHLER Extraktionsdienst antwortet nicht auf $extraktion/healthz"
  fehler=$((fehler + 1))
else
  echo "  ok    Extraktion /healthz ($ocr)"
fi

if curl -fsS "$oberflaeche/" 2>/dev/null | grep -q "<app-root>"; then
  echo "  ok    Oberfläche liefert die Anwendung aus"
else
  echo "  FEHLER Oberfläche antwortet nicht auf $oberflaeche/"
  fehler=$((fehler + 1))
fi

erwartung_aus() {
  node -e "console.log(JSON.parse(require('fs').readFileSync('$1','utf8')).erwartung.freigabe)"
}
freigabe_aus() {
  node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).freigabe)}catch{console.log('KEINE ANTWORT: '+s.slice(0,120))}})"
}

echo
echo "Runde 1: Akten (Assertions) an /webhook/akte"
for datei in testdaten/akten/*.json; do
  erwartet=$(erwartung_aus "$datei")
  tatsaechlich=$(curl -sS -X POST -H 'Content-Type: application/json' --data-binary "@$datei" "$basis/webhook/akte" | freigabe_aus)
  runden=$((runden + 1))
  if [[ "$tatsaechlich" == "$erwartet" ]]; then
    printf '  ok    %-32s %s\n' "$(basename "$datei")" "$tatsaechlich"
  else
    printf '  ROT   %-32s erwartet %s, bekommen %s\n' "$(basename "$datei")" "$erwartet" "$tatsaechlich"
    fehler=$((fehler + 1))
  fi
done

echo
echo "Runde 2: Belege (PDF) an /webhook/belege"
for ordner in testdaten/belege/*/; do
  name=$(basename "$ordner")
  erwartet=$(erwartung_aus "$ordner/akte.json")
  args=(-F "akte=<$ordner/akte.json")
  for pdf in "$ordner"*.pdf; do args+=(-F "dateien=@$pdf;type=application/pdf"); done
  tatsaechlich=$(curl -sS -X POST "${args[@]}" "$basis/webhook/belege" | freigabe_aus)
  runden=$((runden + 1))
  if [[ "$tatsaechlich" == "$erwartet" ]]; then
    printf '  ok    %-32s %s\n' "$name" "$tatsaechlich"
  else
    printf '  ROT   %-32s erwartet %s, bekommen %s\n' "$name" "$erwartet" "$tatsaechlich"
    fehler=$((fehler + 1))
  fi
done

echo
echo "Runde 3: dieselbe Akte über den Proxy der Oberfläche"
ordner=testdaten/belege/happy-path
erwartet=$(erwartung_aus "$ordner/akte.json")
args=(-F "akte=<$ordner/akte.json")
for pdf in "$ordner"/*.pdf; do args+=(-F "dateien=@$pdf;type=application/pdf"); done
tatsaechlich=$(curl -sS -X POST "${args[@]}" "$oberflaeche/webhook/belege" | freigabe_aus)
runden=$((runden + 1))
if [[ "$tatsaechlich" == "$erwartet" ]]; then
  printf '  ok    %-32s %s
' "happy-path über nginx" "$tatsaechlich"
else
  printf '  ROT   %-32s erwartet %s, bekommen %s
' "happy-path über nginx" "$erwartet" "$tatsaechlich"
  fehler=$((fehler + 1))
fi

echo
echo "Runde 4: dieselbe Akte mit einer Übersteuerung (ADR-007)"
# Der Beweis besteht aus drei Teilen: Der Befund bleibt verletzt, die
# Regelentscheidung bleibt blockiert, und nur die Entscheidung unter
# menschlicher Verantwortung dreht — samt Statuscode.
# Die Fassung kommt aus einem Lauf ohne Übersteuerung, nicht aus dem Skript:
# Ein Override haftet an der Regelversion, die tatsächlich gilt. Stünde sie
# hier fest, wäre der Rauchtest bei jeder Katalogänderung rot — und zwar aus
# einem Grund, der nichts mit dem System zu tun hat.
vorlauf=$(curl -sS -X POST -H 'Content-Type: application/json' \
  --data-binary @testdaten/akten/container-abweichung.json "$basis/webhook/akte")
uebersteuert=$(VORLAUF="$vorlauf" node -e "
const fs=require('fs');
const a=JSON.parse(fs.readFileSync('testdaten/akten/container-abweichung.json','utf8'));
const fassung=JSON.parse(process.env.VORLAUF).befunde.find(b=>b.regel==='TRN-01').regelversion;
a.overrides=[{regel:'TRN-01',benutzer:'Rauchtest',begruendung:'Reederei hat den Umlad schriftlich bestaetigt',erzeugt_am:new Date().toISOString(),fassung}];
process.stdout.write(JSON.stringify(a));
")
runden=$((runden + 1))
antwort=$(curl -sS -w '\n%{http_code}' -X POST -H 'Content-Type: application/json' --data-binary "$uebersteuert" "$basis/webhook/akte")
code=${antwort##*$'\n'}
befund=$(ANTWORT="${antwort%$'\n'*}" node -e "
const e=JSON.parse(process.env.ANTWORT);
const t=e.befunde.find(b=>b.regel==='TRN-01') ?? {};
console.log([t.status, t.uebersteuert_von, e.freigabe, e.freigabe_nach_override].join(' '));
")
if [[ "$befund" == "verletzt Rauchtest blockiert freigabereif" && "$code" == "200" ]]; then
  printf '  ok    %-32s Befund bleibt verletzt, HTTP %s\n' "TRN-01 übersteuert" "$code"
else
  printf '  ROT   %-32s bekommen "%s", HTTP %s\n' "TRN-01 übersteuert" "$befund" "$code"
  fehler=$((fehler + 1))
fi

echo
echo "Runde 5: ein gescheiterter Lauf ist von einer Freigabe unterscheidbar"
# Ohne Fehlerzweig antwortet ein abgestürzter Workflow mit 200 und leerem
# Rumpf — der Aufrufer hielte das für „freigabereif". Geprüft wird beides:
# der Statuscode und dass der Betrieb die Zeile bekommt.
vorher=$(docker compose exec -T postgres psql -U "${POSTGRES_USER:-zollpilot}" -d zollpilot -tAc "select count(*) from workflow_fehler" 2>/dev/null || echo 0)
kaputt=$(curl -sS -w '\n%{http_code}' -X POST -H 'Content-Type: application/json' \
  -d '{"akte_id":"RAUCHTEST-KAPUTT","dokumente":"keine Liste"}' "$basis/webhook/akte")
kaputt_code=${kaputt##*$'\n'}
kaputt_rumpf=${kaputt%$'\n'*}
nachher=$(docker compose exec -T postgres psql -U "${POSTGRES_USER:-zollpilot}" -d zollpilot -tAc "select count(*) from workflow_fehler" 2>/dev/null || echo 0)
if [[ "$kaputt_code" == "500" ]] && [[ "$kaputt_rumpf" == *'"fehler":true'* ]] && [[ "$nachher" -gt "$vorher" ]]; then
  printf '  ok    %-32s HTTP %s, in workflow_fehler festgehalten\n' "kaputte Akte" "$kaputt_code"
else
  printf '  ROT   %-32s HTTP %s, workflow_fehler %s→%s, Rumpf: %s\n' "kaputte Akte" "$kaputt_code" "$vorher" "$nachher" "${kaputt_rumpf:0:80}"
  fehler=$((fehler + 1))
fi

echo
echo "Runde 6: ein gescheiterter Lauf lässt sich wiederholen"
# Der Extraktionsdienst wird angehalten und ein Belegsatz eingereicht. Erwartet:
# 500, `wiederholbar: true`, eine offene Zeile in `wiedervorlage`. Dann kommt
# der Dienst zurück, und POST /webhook/wiederholen liefert dieselbe
# Entscheidung wie Runde 2, ohne dass jemand die Belege neu einreicht.
docker compose stop extraktion >/dev/null 2>&1
ordner=testdaten/belege/happy-path
erwartet=$(erwartung_aus "$ordner/akte.json")
args=(-F "akte=<$ordner/akte.json")
for pdf in "$ordner"/*.pdf; do args+=(-F "dateien=@$pdf;type=application/pdf"); done
antwort=$(curl -sS -w '\n%{http_code}' -X POST "${args[@]}" "$basis/webhook/belege")
code=${antwort##*$'\n'}
rumpf=${antwort%$'\n'*}
ausfuehrung=$(printf '%s' "$rumpf" | json_feld ".ausfuehrung")
wiederholbar=$(printf '%s' "$rumpf" | json_feld ".wiederholbar")
docker compose start extraktion >/dev/null 2>&1
for _ in $(seq 1 60); do
  curl -fsS "$extraktion/healthz" >/dev/null 2>&1 && break
  sleep 1
done
runden=$((runden + 1))
if [[ "$code" != "500" || "$wiederholbar" != "true" || -z "$ausfuehrung" ]]; then
  printf '  ROT   %-32s HTTP %s, wiederholbar "%s", Ausführung "%s"\n' "Extraktion angehalten" "$code" "$wiederholbar" "$ausfuehrung"
  fehler=$((fehler + 1))
else
  printf '  ok    %-32s HTTP 500, wiederholbar, Ausführung %s\n' "Extraktion angehalten" "$ausfuehrung"
  wiederholt=$(curl -sS -X POST -H 'Content-Type: application/json' \
    -d "{\"execution_id\":\"$ausfuehrung\"}" "$basis/webhook/wiederholen")
  tatsaechlich=$(printf '%s' "$wiederholt" | json_feld ".ergebnis.freigabe")
  zustand=$(sql "select status from wiedervorlage where execution_id = '$ausfuehrung' order by id desc limit 1")
  if [[ "$tatsaechlich" == "$erwartet" && "$zustand" == "erledigt" ]]; then
    printf '  ok    %-32s %s, Wiedervorlage %s\n' "wiederholt über /webhook/wiederholen" "$tatsaechlich" "$zustand"
  else
    printf '  ROT   %-32s erwartet %s, bekommen "%s", Wiedervorlage "%s"\n' "wiederholt über /webhook/wiederholen" "$erwartet" "$tatsaechlich" "$zustand"
    fehler=$((fehler + 1))
  fi
fi

echo
echo "Runde 7: das Monitoring sieht, was gelaufen ist"
# Nicht „läuft Prometheus", sondern: Kommen die Zahlen dieses Laufs dort an?
# Die Ziele brauchen nach dem Neustart der Extraktion einen Scrape-Takt, die
# Zähler aus der Prüftabelle ebenso; deshalb wird gewartet, nicht geraten.
ziele="?"
for _ in $(seq 1 40); do
  ziele=$(curl -fsS "$prometheus/api/v1/targets" 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const t=JSON.parse(s).data.activeTargets;const tot=t.filter(x=>x.health!=='up').map(x=>x.labels.job);console.log(tot.length?'DOWN '+tot.join(','):'ok '+t.length)}catch{console.log('KEINE ANTWORT')}})")
  [[ "$ziele" == ok* ]] && break
  sleep 1
done
if [[ "$ziele" == ok* ]]; then
  printf '  ok    %-32s %s Ziele erreichbar\n' "Prometheus-Ziele" "${ziele#ok }"
else
  printf '  ROT   %-32s %s\n' "Prometheus-Ziele" "$ziele"
  fehler=$((fehler + 1))
fi
regeln=$(curl -fsS "$prometheus/api/v1/rules" 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).data.groups.flatMap(g=>g.rules).length)}catch{console.log(0)}})")
if [[ "$regeln" -ge 10 ]]; then
  printf '  ok    %-32s %s Regeln geladen\n' "Alarmregeln" "$regeln"
else
  printf '  ROT   %-32s %s Regeln geladen, mindestens 10 erwartet\n' "Alarmregeln" "$regeln"
  fehler=$((fehler + 1))
fi
gezaehlt=""
for _ in $(seq 1 45); do
  gezaehlt=$(curl -fsS "$prometheus/api/v1/query" --data-urlencode 'query=sum(zollpilot_pruefungen_total)' 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const r=JSON.parse(s).data.result;console.log(r.length?r[0].value[1]:'')}catch{console.log('')}})")
  [[ "$gezaehlt" =~ ^[0-9]+$ ]] && [[ "$gezaehlt" -ge "$runden" ]] && break
  sleep 1
done
if [[ "$gezaehlt" =~ ^[0-9]+$ ]] && [[ "$gezaehlt" -ge "$runden" ]]; then
  printf '  ok    %-32s zollpilot_pruefungen_total = %s\n' "fachliche Zähler" "$gezaehlt"
else
  printf '  ROT   %-32s zollpilot_pruefungen_total = "%s", mindestens %s erwartet\n' "fachliche Zähler" "$gezaehlt" "$runden"
  fehler=$((fehler + 1))
fi
if curl -fsS "$extraktion/metrics" 2>/dev/null | grep -q '^zollpilot_extraktion_dokumente_total{'; then
  printf '  ok    %-32s Belege je Typ und Lesemethode\n' "Extraktion /metrics"
else
  printf '  ROT   %-32s zollpilot_extraktion_dokumente_total fehlt\n' "Extraktion /metrics"
  fehler=$((fehler + 1))
fi
titel=$(curl -fsS "$grafana/api/dashboards/uid/zollpilot" 2>/dev/null | json_feld ".dashboard.title")
if [[ "$titel" == "ZollPilot" ]]; then
  printf '  ok    %-32s Dashboard „%s" provisioniert\n' "Grafana" "$titel"
else
  printf '  ROT   %-32s Dashboard nicht gefunden (%s)\n' "Grafana" "$titel"
  fehler=$((fehler + 1))
fi
if curl -fsS "$alertmanager/-/ready" >/dev/null 2>&1; then
  printf '  ok    %-32s bereit, liefert an /webhook/alarm\n' "Alertmanager"
else
  printf '  ROT   %-32s antwortet nicht auf /-/ready\n' "Alertmanager"
  fehler=$((fehler + 1))
fi

echo
anzahl=$(sql "select count(*) from pruefung" || echo "?")
if [[ "$anzahl" =~ ^[0-9]+$ ]] && [[ "$anzahl" -ge "$runden" ]]; then
  echo "  ok    $anzahl Prüfungen in Postgres (pruefung), mindestens $runden erwartet"
else
  echo "  ROT   Prüfungen in Postgres: $anzahl (erwartet mindestens $runden)"
  fehler=$((fehler + 1))
fi

echo
if [[ "$fehler" -gt 0 ]]; then
  echo "$fehler Abweichungen."
  exit 1
fi
echo "Alle Akten und Belege liefern die erwartete Entscheidung, über den Webhook wie über die Oberfläche; ein gescheiterter Lauf ließ sich wiederholen; das Monitoring hat alles gesehen; alle Prüfungen sind abgelegt."
