#!/usr/bin/env bash
# Schickt eine Antwort mit Anhang an das Eingangspostfach, so wie ein
# Lieferant sie schicken würde (ADR-010). Der Posteingang-Workflow ordnet
# sie über die Aktennummer im Betreff zu, hängt den Beleg an die abgelegte
# Akte und prüft erneut.
#
# Aufruf:
#   bash scripts/antwort-per-mail.sh ZP-2026-0002 testdaten/belege/happy-path/handelsrechnung.pdf
#   bash scripts/antwort-per-mail.sh "" ""          eine Mail ohne Aktennummer und ohne Anhang
#
# SMTP-Ziel: GreenMail aus compose.yml (smtp://localhost:3025), sonst SMTP_URL.

set -euo pipefail
cd "$(dirname "$0")/.."

akte="${1:-}"
pdf="${2:-}"
smtp="${SMTP_URL:-smtp://localhost:3025}"
von="${VON:-lieferant@zollpilot.test}"
an="${AN:-eingang@zollpilot.test}"

if [[ -n "$akte" ]]; then
  betreff="Re: ACTION REQUIRED - Shipment $akte - Nachweis"
  text="Anbei der angeforderte Beleg zu Shipment $akte."
else
  betreff="Frage ohne Aktennummer"
  text="Wo ist mein Container?"
fi

eml=$(mktemp)
if [[ -n "$pdf" ]]; then
  [[ -f "$pdf" ]] || { echo "Datei nicht gefunden: $pdf" >&2; exit 2; }
  # Nur bash, coreutils und curl: Das Skript soll auch dort laufen, wo Git
  # Bash `node` nicht auf dem Pfad hat.
  name=$(basename "$pdf")
  grenze="zollpilot-$(date +%s)"
  {
    printf 'From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\n' "$von" "$an" "$betreff"
    printf 'Content-Type: multipart/mixed; boundary="%s"\r\n\r\n' "$grenze"
    printf -- '--%s\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n%s\r\n\r\n' "$grenze" "$text"
    printf -- '--%s\r\nContent-Type: application/pdf; name="%s"\r\n' "$grenze" "$name"
    printf 'Content-Transfer-Encoding: base64\r\nContent-Disposition: attachment; filename="%s"\r\n\r\n' "$name"
    base64 -w 76 "$pdf" | sed 's/$/\r/'
    printf -- '--%s--\r\n' "$grenze"
  } > "$eml"
else
  printf 'From: %s\r\nTo: %s\r\nSubject: %s\r\n\r\n%s\r\n' "$von" "$an" "$betreff" "$text" > "$eml"
fi

curl -sS --url "$smtp" --mail-from "$von" --mail-rcpt "$an" --upload-file "$eml"
rm -f "$eml"
echo "Mail an $an geschickt: \"$betreff\"${pdf:+ mit $(basename "$pdf")}"
echo "Was daraus wurde: select akte_id, zugeordnet, grund, freigabe from mail_eingang order by id desc limit 3"
