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

Die acht Akten in `testdaten/akten/` sind die Referenz. Aus ihnen erzeugt
`testdaten/erzeuge-belege.py` je Akte vier PDFs (Handelsrechnung mit
Ursprungserklärung, Packliste, B/L, Ausfuhrbegleitdokument) sowie `akte.json` (Stammdaten und
erwartete Entscheidung) und `erwartet.json` (welche Assertions die PDFs
tragen). Der Lauf ist byteidentisch reproduzierbar, auf Windows wie auf
Linux: reportlab mit `invariant`, Rauschen mit festem Startwert, Schrift
aus Pillow statt aus dem System; die CI erzeugt die Belege neu und verlangt,
dass sich nichts ändert.

`python -m zollpilot_extraktion.bewertung` extrahiert jeden Belegsatz und
misst zwei Dinge (`docs/07-idp-ocr.md`, Kennzahlen):

| Kennzahl | Definition | Stand 2026-09-12 |
|---|---|---|
| Field Exact Match je Belegtyp | erwartete Assertions mit gleichem Dokument, Pfad und normalisiertem Wert / alle erwarteten | Handelsrechnung 226/226, Packliste 139/139, B/L 56/56, Ursprungserklärung 58/58, ABD 91/91, zusammen **570/570** |
| Entscheidung je Akte | `src/cli.mjs` auf der extrahierten Akte liefert die erwartete Freigabe, dieselben Regeln, dieselben Pflichtbefunde | **8/8** |

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
uv run pytest                                      # 123 Tests; ohne Tesseract wird der OCR-Test übersprungen, nicht grün
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

## Die Rechnung als Datensatz

Eine Rechnung, die als UN/CEFACT Cross Industry Invoice (CII, D16B) kommt,
nimmt denselben Eingang wie ein PDF und landet als derselbe Belegtyp in der
Akte (ADR-008). `cii.py` erkennt sie am Inhalt, validiert sie gegen das
Schema in `zollpilot_extraktion/schema/cii/` (Quelle und Hashes in
`QUELLE.md`) und liest Kopf, Parteien mit Land und EORI, Positionen mit
Warennummer, Ursprung, Menge, Preis und Betrag sowie Zuschläge, Rabatte und
Endbetrag in dieselben Pfade wie der PDF-Extraktor. Die Assertionen tragen
Methode `strukturiert`, Konfidenz 1 und keine Fundstelle: Es gibt keine
Stelle im Bild, an der man nachlesen könnte. Was das Schema nicht besteht,
hängt als `unclassified` mit Hinweis an der Akte.

Die Gegenrichtung schreibt die Rechnungsfakten einer Akte als CII
(`schreibe_cii`, Route `POST /extraktion/akte/cii`), ebenfalls gegen das
Schema validiert. `tests/test_cii.py` fährt die Rundreise: Golden-Set-Akte
als CII schreiben, über `extrahiere_akte` lesen, gegen `erwartet.json`
derselben Akte vergleichen. Nicht abgebildet: Steuer, Zahlung, Lieferung,
Referenzen, und die Ursprungserklärung, die in CII keinen Platz hat und
beim PDF bleibt.

## Der Vergleichslauf

Die Nahtstelle aus ADR-005 ist jetzt belegt, nicht nur beschrieben:
`anbieter.py` ist ein zweites Lesemodul neben `lesen.py`. Es übersetzt die
Antwort von Azure Document Intelligence (`prebuilt-read`) in dieselbe Form
aus Seiten, Wörtern und Zeilen, mit Koordinaten in PDF-Punkten und der
Konfidenz je Wort, die der Anbieter meldet. Alles hinter der Schicht Lesen
bleibt gleich: Klassifikation, Felder, Normalisierung, Akte. Gewählt wurde
Azure, weil ein Schlüssel im Kopfzeilenfeld genügt und das Kontingent F0
kostenlos ist; ein zweiter Anbieter bekäme eine zweite Übersetzungsfunktion.

Drei Regeln halten den Lauf ehrlich:

- **Der Schlüssel kommt nur aus der Umgebung** (`ZOLLPILOT_AZURE_DI_ENDPOINT`,
  `ZOLLPILOT_AZURE_DI_KEY`). Im Repo steht keiner.
- **Antworten werden einmal aufgezeichnet** und liegen unter
  `extraktion/tests/fixtures/anbieter/azure/<sha256>.json`, benannt nach dem
  Hash des PDFs. Tests und Bewertung lesen nur die Aufzeichnung; sie brauchen
  keinen Zugang und lösen keine Kosten aus.
- **Es wird nichts erfunden.** Fehlt eine Aufzeichnung, nennt die Bewertung
  die Belege beim Namen und läuft nicht. Fehlt der Schlüssel, sagt das
  Aufzeichnen `KEIN ZUGANG` und endet.

```bash
cd extraktion
uv run python -m zollpilot_extraktion.anbieter stand            # was aufgezeichnet ist
uv run python -m zollpilot_extraktion.anbieter aufzeichnen      # einmalig, mit Schlüssel
uv run python -m zollpilot_extraktion.bewertung --leser azure   # dieselbe Tabelle, anderer Leser
```

| Leser | Field Exact Match gesamt | Entscheidungen | Stand |
|---|---|---|---|
| `tesseract` (Textlayer, sonst Tesseract) | 100,0 % (570/570) | 8/8 | Basislinie, `extraktion/basislinie.json` |
| `azure` (`prebuilt-read`) | noch nicht gemessen | noch nicht gemessen | 0 von 32 Testbelegen aufgezeichnet |

Die zweite Zeile ist leer, weil am 2026-09-12 kein Azure-Zugang vorlag. Das
steht hier als Ziel mit Stand, nicht als Behauptung (`docs/ARBEITSWEISE.md`).
Wer den Lauf zieht, trägt die Zahlen ein und nennt die Modellversion aus der
Aufzeichnung (`analyzeResult.modelId`, `apiVersion`).

Was der Lauf zeigen wird und was nicht: Auf den digitalen Belegen liest der
Textlayer bereits alles; dort kann ein Anbieter höchstens gleichziehen. Der
Unterschied entsteht auf dem schlechten Scan, und zwar an zwei Stellen: an
den Wortkonfidenzen (Azure kalibriert anders als Tesseract, deshalb kann die
Schwelle 0,80 dort eine andere Wirkung haben) und an Zeichen wie 0/O und
1/l in der Containernummer. Gemessen wird dasselbe wie immer, Field Exact
Match je Belegtyp und die Entscheidung je Akte; die Basislinie gehört dem
Leser aus `lesen.py` und wird von einem Anbieter nie überschrieben.

Nur synthetische Belege gehen an den Anbieter (`docs/DATENSCHUTZ.md`). Für
echte Belege wäre der Aufruf ein Modellaufruf im Sinne der Datenschutzregel
und bräuchte die Pseudonymisierung, die es nicht gibt. Der Vergleichslauf
ist ein Messwerkzeug, kein Betriebsweg.

## Was ein Anbieter ersetzen würde

Document AI, ABBYY oder Azure Document Intelligence ersetzen `lesen.py`
(Wörter mit Koordinaten und Konfidenz) oder zusätzlich `felder/` (fertige
Feldwerte) und liefern dieselbe Assertion. Regelwerk, Tests, Workflow und
Bewertung ändern sich nicht; die Bewertung würde beide Wege gegeneinander
messen. Das ist der Vergleichslauf, den ADR-005 unter „Wann wir anders
entscheiden würden“ nennt; er braucht ein Projekt beim Anbieter und die
Klärung aus `docs/DATENSCHUTZ.md`.
