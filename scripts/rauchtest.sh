#!/usr/bin/env bash
# Rauchtest gegen das laufende System (docker compose up -d --wait).
#
# Zwei Runden, ein Beweis:
#   1. Die Testakten (fertige Assertions) an /webhook/akte — Compose, Import,
#      gebündelter Code-Node und Schema arbeiten zusammen.
#   2. Die Testbelege (PDF) an /webhook/belege — dazu der Extraktionsdienst
#      (ADR-005): PDF rein, Entscheidung raus, über denselben Node.
#   3. Dieselbe Akte über die Oberfläche und ihren Proxy (ADR-006): Damit ist
#      geprüft, dass nginx die Anwendung ausliefert und /webhook/ durchreicht.
# Jede Akte trägt ihre Erwartung selbst; das Skript vergleicht. Danach:
# Liegen die Prüfungen in Postgres?
#
# Aufruf: bash scripts/rauchtest.sh [http://localhost:5678] [http://localhost:8765] [http://localhost:8088]

set -uo pipefail
cd "$(dirname "$0")/.."

basis="${1:-http://localhost:5678}"
extraktion="${2:-http://localhost:8765}"
oberflaeche="${3:-http://localhost:8088}"
fehler=0
runden=0

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
anzahl=$(docker compose exec -T postgres psql -U "${POSTGRES_USER:-zollpilot}" -d zollpilot -tAc "select count(*) from pruefung" 2>/dev/null || echo "?")
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
echo "Alle Akten und Belege liefern die erwartete Entscheidung — über den Webhook wie über die Oberfläche —, alle Prüfungen sind abgelegt."
