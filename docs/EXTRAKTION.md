# Die Extraktion

Stufe 3: aus Belegen (PDF) werden Assertions, also Behauptungen mit Fundstelle
und Konfidenz. Die Entscheidung bleibt in `src/` (ADR-003, ADR-005). Dieses
Dokument sagt, wie die Extraktion arbeitet, wie sie gemessen wird, und was
die Messung nicht misst.

## Die Schichten

```
PDF
 │  lesen.py            Textlayer mit Koordinaten (pdfplumber), sonst Rendern
 │                      (pypdfium2), Vorverarbeitung, Tesseract mit Wortkonfidenz
 ▼
Seiten mit Wörtern (Text, x0, top, x1, bottom, Konfidenz), zu Zeilen gruppiert
 │  klassifikation.py   Belegtyp über Merkmale mit Gewicht, Draft-Marken,
 │                      unter der Mindestpunktzahl: unclassified
 ▼
 │  felder/<typ>.py     Label → Wert bis zur nächsten Lücke, Block unter Label,
 │                      Tabelle über die Spaltenpositionen der Kopfzeile
 │  normalisierung.py   Beträge in beiden Schreibweisen, ISO-Daten, ISO-Länder,
 │                      Warencodes ohne Punkte, Containernummern
 ▼
Assertions {dokument, pfad, wert, roh, konfidenz, seite, bbox, methode}
 │  akte.py             Dokumente mit Hash, Status, Aussteller; Ursprungserklärung
 │                      als eigener Beleg mit Träger; nichts wird verworfen
 ▼
Akte: dieselbe Form wie testdaten/akten/*.json → src/regelwerk.mjs
```

Alle Feldextraktoren arbeiten auf Wörtern mit Koordinaten, nie auf reinem
Text. Deshalb läuft derselbe Code auf dem Textlayer und auf OCR-Ergebnissen,
und jede Fundstelle bleibt bis in die Datenbank erhalten
(`document_field_assertion.bbox`).

## Konfidenz

- **Textlayer:** 0,99, eine Konstante. Ein Textlayer ist keine Lesung, aber
  auch keine Gewissheit; er kann aus einer fremden OCR stammen.
- **OCR:** die Wortkonfidenz von Tesseract, 0 bis 1. Die Feldkonfidenz ist das
  **Minimum** über die Wörter des Feldes: Ein Betrag ist so sicher wie seine
  unsicherste Ziffer.
- **Abgeleitet:** das Minimum der Quellen. Der Wert der Ursprungserzeugnisse
  einer Ursprungserklärung ist die Summe der Positionsnetto der Trägerrechnung;
  die Assertion trägt `methode: abgeleitet` und eine `herleitung`.

Was die Konfidenz auslöst, steht nicht hier, sondern im Katalog:
`rules.yaml` → `defaults.low_confidence_below: 0.80`. Fällt eine Prüfziffer
oder Summe durch und der Wert liegt darunter, ist das Ergebnis
`re_extraction_required`, nicht `verletzt`. Die Extraktion weiß von dieser
Schwelle nichts.

## Der zweite Eingang im Workflow

`POST /webhook/belege` (Multipart: Feld `akte` mit den Stammdaten als JSON,
Dateien in `dateien`) → Code-Node „Belege verpacken“ (Binärdaten → JSON mit
Base64, reiner Transport) → HTTP Request an `http://extraktion:8080/extraktion/akte`
→ die Antwort ist die Akte → Node „Akte prüfen“, derselbe wie bei
`POST /webhook/akte`. Der Dienst steht in `compose.yml`; sein
`GET /healthz` sagt, ob Tesseract da ist.

Für Menschen gibt es `POST /extraktion/akte/multipart` direkt am Dienst und
die Kommandozeile:

```bash
cd extraktion
uv run python -m zollpilot_extraktion --ordner ../testdaten/belege/happy-path
```

## Das Golden Set und die Messung

Die sieben Akten in `testdaten/akten/` sind die Referenz. Aus ihnen erzeugt
`testdaten/erzeuge-belege.py` je Akte drei PDFs (Handelsrechnung mit
Ursprungserklärung, Packliste, B/L) sowie `akte.json` (Stammdaten und
erwartete Entscheidung) und `erwartet.json` (welche Assertions die PDFs
tragen). Der Lauf ist byteidentisch reproduzierbar, auf Windows wie auf
Linux: reportlab mit `invariant`, Rauschen mit festem Startwert, Schrift
aus Pillow statt aus dem System; die CI erzeugt die Belege neu und verlangt,
dass sich nichts ändert.

`python -m zollpilot_extraktion.bewertung` extrahiert jeden Belegsatz und
misst zwei Dinge (`docs/07-idp-ocr.md`, Kennzahlen):

| Kennzahl | Definition | Stand 2026-09-12 |
|---|---|---|
| Field Exact Match je Belegtyp | erwartete Assertions mit gleichem Dokument, Pfad und normalisiertem Wert / alle erwarteten | Handelsrechnung 199/199, Packliste 122/122, B/L 49/49, Ursprungserklärung 50/50, zusammen **420/420** |
| Entscheidung je Akte | `src/cli.mjs` auf der extrahierten Akte liefert die erwartete Freigabe, dieselben Regeln, dieselben Pflichtbefunde | **7/7** |

Die Basislinie liegt in `extraktion/basislinie.json` und wird bewusst
geschrieben (`--basislinie-schreiben`), nie nebenbei. Ein Lauf ohne
Basislinie sagt `KEINE BASISLINIE` und ist rot; ein Lauf darunter ist rot.
Beides läuft im CI-Job `extraktion`.

**Der schlechte Scan.** In der JSON-Akte steht ein per OCR falsch gelesener
Container mit Konfidenz 0,55: eine Behauptung über die Extraktion, die den
Konfidenzpfad deterministisch zeigt. In `testdaten/belege/schlechter-scan/`
ist die Packliste ein echtes Bild: mit Pillow gezeichnet, um 1,4 Grad
gedreht, unscharf, körnig, kontrastarm. Tesseract liest sie nach der
Vorverarbeitung mit Wortkonfidenzen zwischen 0,64 und 0,96; die
Containernummer richtig mit 0,92. Die Entscheidung ist deshalb
`freigabereif`; der Konfidenzpfad wird auf diesem Scan nicht ausgelöst,
weil nichts falsch gelesen wird. Das ist das Ergebnis, nicht die Erwartung:
`akte.json` sagt es, und die Bewertung würde eine Änderung melden.

## Lokal ausführen

```bash
cd extraktion && uv sync
uv run pytest                                      # 98 Tests; ohne Tesseract wird der OCR-Test übersprungen, nicht grün
uv run python ../testdaten/erzeuge-belege.py       # PDFs neu erzeugen
uv run python -m zollpilot_extraktion.bewertung --ohne-ocr   # digitale Belege; der Scan fällt sichtbar durch
```

Mit Tesseract (Linux: `apt install tesseract-ocr tesseract-ocr-deu`; auf
Windows über Docker):

```bash
docker build --target test -t zollpilot-extraktion:test -f extraktion/Dockerfile .   # pytest mit OCR beim Build
docker run --rm -v "$PWD:/host" -e PYTHONPATH=/host/extraktion -w /host/extraktion \
  zollpilot-extraktion:test /repo/extraktion/.venv/bin/python -m zollpilot_extraktion.bewertung
```

## Was die Messung nicht misst

- **Fremde Layouts.** Die Extraktoren kennen Labels wie „Invoice No“ und
  Tabellenköpfe wie „Pos | Description | HS code“. Die PDFs sind aus dem
  Golden Set erzeugt; 420/420 beweist, dass Rendern, Lesen und Extrahieren
  zusammenpassen, nicht, dass eine Rechnung eines anderen Ausstellers gelesen
  würde. Sie würde weniger Felder liefern, und die Regeln sagen
  `nicht_pruefbar`.
- **Echte Scans.** Stempel, Durchschläge, Handschrift, Fax: keiner der Belege
  hat das. Der schlechte Scan ist eine kontrollierte Verschlechterung.
- **Kalibrierung.** 0,64 von Tesseract heißt nicht „in 64 Prozent der Fälle
  richtig“. Ob 0,80 die richtige Schwelle ist, entscheidet ein Korpus, den es
  nicht gibt.
- **Mehrere Belege in einer Datei.** Ein PDF ist ein Beleg. Zusammengesetzte
  PDFs (Rechnung und Packliste in einer Datei) werden nicht aufgetrennt; die
  Klassifikation sieht den Text beider und trifft den stärkeren.
- **Sprache.** Merkmale und Labels sind englisch und deutsch. Eine
  französische Rechnung ist `unclassified`.
- **Den Weg nach der Nachextraktion.** `re_extraction_required` ist ein
  Status. Wer nachliest, womit, und wie das Ergebnis zurück in die Prüfung
  kommt, ist nicht gebaut. Übersteuern geht (Stufe 5, ADR-007), aber ein
  übersteuerter Lesefehler ist verantwortet, nicht behoben.

## Was ein Anbieter ersetzen würde

Document AI, ABBYY oder Azure Document Intelligence ersetzen `lesen.py`
(Wörter mit Koordinaten und Konfidenz) oder zusätzlich `felder/` (fertige
Feldwerte) und liefern dieselbe Assertion. Regelwerk, Tests, Workflow und
Bewertung ändern sich nicht; die Bewertung würde beide Wege gegeneinander
messen. Das ist der Vergleichslauf, den ADR-005 unter „Wann wir anders
entscheiden würden“ nennt; er braucht ein Projekt beim Anbieter und die
Klärung aus `docs/DATENSCHUTZ.md`.
