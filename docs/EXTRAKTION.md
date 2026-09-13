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
uv run pytest                                      # 147 Tests; ohne Tesseract wird der OCR-Test übersprungen, nicht grün
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
Antwort eines IDP-Anbieters in dieselbe Form aus Seiten, Wörtern und Zeilen,
mit Koordinaten in PDF-Punkten und der Konfidenz je Wort, die der Anbieter
meldet. Alles hinter der Schicht Lesen bleibt gleich: Klassifikation, Felder,
Normalisierung, Akte.

Angeschlossen sind zwei Anbieter, weil eine Nahtstelle erst mit dem zweiten
Anbieter bewiesen ist. Sie unterscheiden sich genau dort, wo eine Nahtstelle
sich beweisen muss, und nirgends sonst:

| | Azure Document Intelligence | Google Document AI |
|---|---|---|
| Modell | `prebuilt-read` | Prozessortyp `Document OCR` |
| Zugang | Schlüssel im Kopfzeilenfeld | Dienstkonto, JWT gegen Zugriffstoken |
| Aufruf | zweistufig: anstoßen, abholen | einstufig |
| Koordinaten | Zoll, bei Bildern Pixel | Anteile der Seitenkante |
| Wortlaut | steht am Wort | Abschnitt im Gesamttext |

Ein Layout-, Rechnungs- oder trainiertes Feldmodell wäre bei beiden verfügbar
und ist bewusst nicht gewählt: Es liefert Feldwerte und ersetzt damit die
Schicht `felder/`, nicht die Schicht Lesen. Verglichen werden soll die Lesung,
nicht ein fremdes Fachmodell.

Drei Regeln halten den Lauf ehrlich:

- **Der Zugang kommt nur aus der Umgebung.** Azure:
  `ZOLLPILOT_AZURE_DI_ENDPOINT`, `ZOLLPILOT_AZURE_DI_KEY`. Google:
  `ZOLLPILOT_GOOGLE_DI_KONTO` (Pfad zur Schlüsseldatei des Dienstkontos,
  außerhalb des Repos), `ZOLLPILOT_GOOGLE_DI_PROJEKT`,
  `ZOLLPILOT_GOOGLE_DI_PROZESSOR`, `ZOLLPILOT_GOOGLE_DI_REGION`. Im Repo steht
  keiner.
- **Antworten werden einmal aufgezeichnet** und liegen unter
  `extraktion/tests/fixtures/anbieter/<anbieter>/<sha256>.json`, benannt nach
  dem Hash des PDFs. Tests und Bewertung lesen nur die Aufzeichnung; sie
  brauchen keinen Zugang und lösen keine Kosten aus.
- **Es wird nichts erfunden.** Fehlt eine Aufzeichnung, nennt die Bewertung
  die Belege beim Namen und läuft nicht. Fehlt der Zugang, sagt das
  Aufzeichnen `KEIN ZUGANG` und endet.

```bash
cd extraktion
uv run python -m zollpilot_extraktion.anbieter stand --anbieter google
uv run python -m zollpilot_extraktion.anbieter aufzeichnen --anbieter google  # einmalig, mit Zugang
uv run python -m zollpilot_extraktion.bewertung --leser google                # dieselbe Tabelle, anderer Leser
```

| Leser | Field Exact Match gesamt | Entscheidungen | Stand |
|---|---|---|---|
| `tesseract` (Textlayer, sonst Tesseract) | 100,0 % (570/570) | 8/8 | Basislinie, `extraktion/basislinie.json` |
| `azure` (`prebuilt-read`, API 2024-11-30) | 100,0 % (570/570) | 8/8 | 32 von 32 Testbelegen aufgezeichnet am 2026-09-12, Region Switzerland North, Stufe F0 |
| `google` (`Document OCR`, API v1) | 100,0 % (570/570) | 8/8 | 32 von 32 Testbelegen aufgezeichnet am 2026-09-13, Region eu |

Alle drei Leser lesen das Golden Set vollständig. Das war bei keinem der
beiden Anbieter der erste Stand, und die beiden Wege dorthin sind das
eigentliche Ergebnis des Vergleichslaufs.

**Azure, erster Lauf: 26,8 % und 0 von 8.** Nicht, weil Azure schlecht liest,
sondern weil die Übersetzung zwei Eigenheiten der Antwort nicht kannte.
Azures `lines` sind Zellen, nicht Zeilen; eine Tabellenzeile kam als sieben
Zeilen an, und die Tabellenextraktion über Spaltenpositionen fand keine Zeile
mit allen Spalten. Und Azure trennt Satzzeichen ab, `Invoice No .:` statt
`Invoice No.:`, womit das Label nicht mehr passte.

**Google, erster Lauf: 86,3 % und 7 von 8.** Dieselbe Art Fehler an anderer
Stelle. Google trennt nicht nur Satzzeichen, sondern auch Bindestriche:
`MAEU-HH-778812` kam als fünf Marken, und aus der B/L-Nummer wurde
`MAEU - HH - 778812`. Dazu umschließt Google ein Wort samt dem folgenden
Leerzeichen, sodass sich benachbarte Umrisse überlappen; die Zeilenbildung
verglich rechte gegen linke Kante und riss `Port of discharge:` auseinander.

Beides ist in `anbieter.py` ausgeglichen, und an genau einer Stelle je
Anbieter. **Kein Feldextraktor, keine Regel und kein Pfad wurde angefasst.**
Das ist die Nahtstelle aus ADR-005, zweimal geprüft.

Wo die beiden sich unterscheiden, ist lehrreich: Wo ein Wort endet, **sagt
Google selbst** (`detectedBreak` an jeder Marke). Azure sagt es nicht, denn
sein Gesamttext setzt vor das abgetrennte Zeichen selbst ein Leerzeichen.
Für Azure bleibt deshalb nur die Lücke im Bild als Anhalt, für Google eine
Aussage des Anbieters. Derselbe Zweck, zwei Wege, weil die Anbieter
unterschiedlich viel über sich verraten.

Der letzte Unterschied war kein Anbieterfehler, sondern ein Modellfehler bei
uns: Auf dem schiefen Scan wandert die Oberkante einer Tabellenzeile mit dem
waagerechten Abstand, gemessen 1,3 Grad. Eine feste Toleranz trennte deshalb
`Type` (Oberkante 259,9) von `Gross` (254,9), obwohl beide in derselben
Kopfzeile stehen. Die Toleranz wächst jetzt mit dem Abstand zum linken
Nachbarn. Azure blieb davon unberührt bei 100 %, was den Verdacht entkräftet,
hier sei auf ein Ergebnis hin geschraubt worden.

Was die Läufe gezeigt haben: Auf den digitalen Belegen liest der Textlayer
alles, und beide Anbieter ziehen gleich. Auf dem schlechten Scan liest Azure
alle 60 Wörter der Packliste mit Konfidenz von mindestens 0,906, keines unter
der Schwelle 0,80; der Containernummer-Fall 0/O und 1/l trat bei keinem
Anbieter auf. Ob die Anbieter damit besser kalibriert sind als Tesseract oder
auf diesem einen Scan nur gnädiger, sagt ein Beleg nicht. Gemessen wird
dasselbe wie immer, Field Exact Match je Belegtyp und die Entscheidung je
Akte; die Basislinie gehört dem Leser aus `lesen.py` und wird von einem
Anbieter nie überschrieben.

Eine Kürzung an den Google-Aufzeichnungen ist benannt, nicht stillschweigend:
Google legt jeder Seite das gerenderte Seitenbild bei, rund 260 KB Base64 je
Beleg. Das ist eine Kopie des Belegs, den `testdaten/` schon enthält, und es
wird vor dem Aufzeichnen entfernt (`_google_ohne_bild`). Alles andere bleibt,
auch was die Übersetzung nicht liest (`blocks`, `paragraphs`, `lines`); wer
die Aufzeichnung öffnet, soll die Antwort sehen und nicht eine Auswahl.

Aufgezeichnet wurden 32 Belege in 14 Dateien bei Azure und 13 bei Google,
weil die PDFs über die Akten hinweg oft byteidentisch sind und der Hash den
Namen gibt. Azures Stufe F0 erlaubt 20 Aufrufe pro Minute; wer schneller ist,
bekommt HTTP 429, und das Aufzeichnen wartet dann und sendet erneut, statt
den Beleg zu verlieren. Bei Google trat das Ratenlimit nicht auf.

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
