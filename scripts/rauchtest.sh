#!/usr/bin/env bash
# Rauchtest gegen das laufende System (docker compose up -d --wait).
#
# Schickt die Testakten an den Webhook und vergleicht die Entscheidung mit der
# Erwartung, die jede Akte selbst trägt. Danach: Liegt die Prüfung in Postgres?
# Das ist der Beweis, dass compose.yml, der Import, der gebündelte Code-Node
# und das Schema zusammen funktionieren — nicht nur jedes für sich.
#
# Aufruf: bash scripts/rauchtest.sh [http://localhost:5678]

set -uo pipefail
cd "$(dirname "$0")/.."

basis="${1:-http://localhost:5678}"
fehler=0

echo
echo "Rauchtest gegen $basis"
echo "=============================="
echo

if ! curl -fsS "$basis/healthz" >/dev/null; then
  echo "  FEHLER n8n antwortet nicht auf /healthz"
  exit 1
fi
echo "  ok    /healthz"

for datei in testdaten/akten/*.json; do
  erwartet=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$datei','utf8')).erwartung.freigabe)")
  antwort=$(curl -sS -X POST -H 'Content-Type: application/json' --data-binary "@$datei" "$basis/webhook/akte")
  tatsaechlich=$(printf '%s' "$antwort" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).freigabe)}catch{console.log('KEINE ANTWORT: '+s.slice(0,120))}})")
  if [[ "$tatsaechlich" == "$erwartet" ]]; then
    printf '  ok    %-32s %s\n' "$(basename "$datei")" "$tatsaechlich"
  else
    printf '  ROT   %-32s erwartet %s, bekommen %s\n' "$(basename "$datei")" "$erwartet" "$tatsaechlich"
    fehler=$((fehler + 1))
  fi
done

echo
anzahl=$(docker compose exec -T postgres psql -U "${POSTGRES_USER:-zollpilot}" -d zollpilot -tAc "select count(*) from pruefung" 2>/dev/null || echo "?")
if [[ "$anzahl" =~ ^[0-9]+$ ]] && [[ "$anzahl" -ge 7 ]]; then
  echo "  ok    $anzahl Prüfungen in Postgres (pruefung)"
else
  echo "  ROT   Prüfungen in Postgres: $anzahl (erwartet mindestens 7)"
  fehler=$((fehler + 1))
fi

echo
if [[ "$fehler" -gt 0 ]]; then
  echo "$fehler Abweichungen."
  exit 1
fi
echo "Alle Akten liefern die erwartete Entscheidung, alle Prüfungen sind abgelegt."
