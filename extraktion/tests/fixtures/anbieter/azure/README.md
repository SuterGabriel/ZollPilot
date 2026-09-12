# Aufzeichnungen des Anbieters Azure Document Intelligence

Hier liegt je Testbeleg die Antwort von `prebuilt-read`, benannt nach dem
SHA-256 des PDFs (`<sha256>.json`). Tests und Bewertung lesen diese Dateien;
sie brauchen keinen Zugang und lösen keine Kosten aus.

Aufzeichnen, einmalig, mit Schlüssel und Endpunkt in der Umgebung:

```bash
export ZOLLPILOT_AZURE_DI_ENDPOINT="https://<ressource>.cognitiveservices.azure.com"
export ZOLLPILOT_AZURE_DI_KEY="<schluessel>"
cd extraktion
uv run python -m zollpilot_extraktion.anbieter aufzeichnen
uv run python -m zollpilot_extraktion.anbieter stand
uv run python -m zollpilot_extraktion.bewertung --leser azure
```

Was hier nicht liegt, gibt es nicht: Ein fehlender Beleg heißt, dass niemand
ihn aufgezeichnet hat. Die Bewertung nennt fehlende Aufzeichnungen beim
Namen und läuft dann nicht (`docs/EXTRAKTION.md`, Vergleichslauf).

Nur synthetische Belege gehen an den Anbieter (`docs/DATENSCHUTZ.md`). Die
Testbelege entstehen aus `testdaten/erzeuge-belege.py` und sind byteidentisch
reproduzierbar; deshalb bleiben die Hashes stabil, solange sich die Belege
nicht ändern. Ändert sich ein Beleg, ist seine Aufzeichnung verwaist und
muss neu gezogen werden.
