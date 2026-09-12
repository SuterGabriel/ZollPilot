# ADR-005: Extraktion als eigener Python-Dienst — OCR mit Koordinaten vor Vision-Modell

- **Status:** angenommen
- **Datum:** 2026-09-12
- **Stufe:** 3

## Kontext

Das Anforderungsprofil nennt IDP/OCR als Must-have (M2) und eine IDP-Pipeline mit
Grund-QA als Ergebnis (E2). Nach Stufe 1 hatte das Repo den Konfidenzpfad,
das Datenmodell und die Architektur — aber keinen Code, der aus einem PDF
eine Assertion macht. Die Testakten waren bereits extrahierte Datensätze.

Drei Entscheidungen des Repos engen den Lösungsraum ein, bevor die erste
Zeile geschrieben ist:

- **ADR-003** verlangt von jeder Extraktion Assertions mit Konfidenz und
  Fundstelle. Der Konfidenzpfad (`re_extraction_required` statt `verletzt`)
  ist wirkungslos, wenn die Extraktion keine echten Konfidenzen liefert.
- **ADR-004** verbietet npm-Pakete im gebündelten Code-Node. PDF-Parsing und
  OCR passen dort nicht hinein; die Extraktion ist zwingend ein eigener
  Prozess.
- **`docs/DATENSCHUTZ.md`** verlangt Pseudonymisierung vor jedem Aufruf eines
  externen Modells. Ein Bild lässt sich nicht pseudonymisieren, bevor man es
  gelesen hat — jeder Weg über ein externes Vision-Modell braucht also eine
  lokale Lesung davor.

Dazu kommt die Lage des Projekts: keine Lizenz für ABBYY oder Document AI,
keine echten Belege (`docs/DATENSCHUTZ.md`), und das Anforderungsprofil nennt
Python als zweite Sprache — das gesamte IDP-Ökosystem ist Python.

## Optionen

**1. Vision-Modell direkt: PDF rein, JSON raus.**
Ein Prompt mit dem Zielschema, ein multimodales Modell, fertig. Auf sauberen
Belegen erstaunlich gut, robust gegen Layoutvarianten, in einem Nachmittag
gebaut. Genau das Richtige für eine Demo. Aber: keine Koordinaten, keine
kalibrierten Konfidenzen (`docs/07-idp-ocr.md`), und die Belege gehen
unpseudonymisiert an einen Anbieter. Der Konfidenzpfad aus ADR-003 hätte
nichts, worauf er reagieren könnte — jeder Lesefehler wäre ein Fachfehler.

**2. Kommerzielles IDP (Document AI, ABBYY, Azure Document Intelligence).**
Echte Konfidenzen je Feld, Koordinaten, trainierbare Extraktoren, EU-Region
oder on-prem. Für den Produktivbetrieb die wahrscheinlich richtige Wahl, und
N2 wäre belegt. Ohne Lizenz oder Projektzugang lässt sich aber kein Aufruf
im Repo zeigen; die Nahtstelle bliebe ein Mock. Und die Anbieterwahl ist
eine Kundenentscheidung (Region, Retention, Unterauftragsverarbeiter), keine
Prototypentscheidung.

**3. n8n-Bordmittel: „Extract from File“ plus Code-Nodes.**
Kein zweiter Dienst, alles im Workflow sichtbar. n8n liest den Textlayer
eines PDFs; für Scans gibt es kein OCR, für Felder keine Koordinaten, und die
Feldlogik läge in Code-Nodes ohne Tests — genau das, was ADR-004 vermeidet.

**4. Eigener Python-Dienst: Textlayer und Tesseract zuerst, Modell nur dahinter.**
Eine kleine Pipeline in den Schichten aus `docs/07`: Lesen (Textlayer mit
Koordinaten, sonst OCR mit Wortkonfidenzen), Klassifikation (regelbasiert,
Draft-Erkennung, Ursprungserklärung als eigener logischer Beleg),
Feldextraktion je Belegtyp (labelgetrieben, Tabellen über Spaltenpositionen),
Normalisierung. Ausgabe ist die Akte, die das Regelwerk schon kennt. n8n ruft
den Dienst per HTTP und leitet das Ergebnis in denselben Node „Akte prüfen“.
Ein Vision-Modell käme nur als zweite Stufe für unklare Felder — hinter einer
Pseudonymisierung, die es heute nicht gibt, und deshalb heute nicht.

## Entscheidung

**Option 4.** Erkennbar an:

- `extraktion/zollpilot_extraktion/` mit den Schichten `lesen`,
  `klassifikation`, `felder/`, `akte`. Jede Assertion trägt `konfidenz`,
  `seite`, `bbox` und `methode` (`textlayer`, `ocr`, `abgeleitet`).
- `lesen.py` entscheidet je Seite: Textlayer, wenn genug Wörter mit
  Koordinaten vorhanden sind, sonst Rendern und Tesseract. Die Wortkonfidenz
  von Tesseract wird zur Feldkonfidenz (Minimum über die Wörter des Feldes).
- `akte.py` verwirft nichts: Ein Beleg, den der Klassifikator nicht kennt,
  hängt als `unclassified` an der Akte, mit Hinweis.
- `compose.yml`, Dienst `extraktion`; der Workflow hat einen zweiten Eingang
  `POST /webhook/belege` (Multipart mit PDFs), einen Transport-Node, der die
  Dateien für den Dienst verpackt, und einen HTTP-Request-Node — dahinter
  derselbe Node „Akte prüfen“. Die Entscheidung bleibt, wo sie war.
- **Golden Set und Messung.** Die sieben Akten in `testdaten/akten/` sind
  die Referenz; `testdaten/erzeuge-belege.py` erzeugt daraus die PDFs.
  `zollpilot_extraktion.bewertung` misst Field Exact Match je Belegtyp und
  die aktenweite Entscheidung gegen `extraktion/basislinie.json`. Fehlt die
  Basislinie, sagt der Lauf das in der ersten Zeile.
- Kein Modellaufruf im Repo. `docs/DATENSCHUTZ.md` bleibt wahr: Es gibt
  keinen externen Aufruf, also auch keinen ohne Pseudonymisierung.

## Konsequenzen

**Positiv**

- Der Konfidenzpfad hat jetzt eine Quelle. Der schlechte Scan in den
  Testbelegen wird von Tesseract gelesen, und die Regeln reagieren auf die
  gemessene Konfidenz — nicht auf eine in JSON eingetragene.
- Die Extraktion ist austauschbar an einer Stelle: Wer Document AI oder
  ABBYY einsetzt, ersetzt `lesen.py` (Wörter mit Koordinaten und Konfidenz)
  oder `felder/` (Feldwerte) und liefert dieselbe Assertion. Regelwerk,
  Tests und Workflow ändern sich nicht.
- Die zweite Sprache aus des Anforderungsprofils steht dort, wo sie hingehört —
  nicht als Dekoration neben JavaScript, sondern im Teil, dessen Werkzeuge
  Python sind.
- Die Messung ist im Repo. Field Exact Match je Belegtyp und die
  Entscheidungsquote laufen in der CI gegen eine Basislinie.

**Negativ**

- **Labelgetriebene Extraktion kennt eine Layoutfamilie.** Die Extraktoren
  suchen „Invoice No“, „Port of Loading“, Tabellenköpfe. Ein Beleg mit
  anderem Aufbau liefert weniger Felder — das System sagt dann
  `nicht_pruefbar`, nicht falsch, aber es sagt es oft. Für reale Vielfalt
  braucht es ein trainiertes Layoutmodell oder einen Anbieter (Option 2).
- **Die Messung misst die Pipeline, nicht die Wirklichkeit.** Die PDFs sind
  aus dem Golden Set erzeugt; ein hoher Field Exact Match beweist, dass
  Rendern, Lesen und Extrahieren zusammenpassen. Über Stempel, Durchschläge
  und Handschrift sagt er nichts. `docs/ANFORDERUNGEN.md` führt das unter
  „nicht belegbar“.
- **Tesseract-Konfidenzen sind nicht kalibriert.** 0,55 heißt nicht „in 55
  Prozent der Fälle richtig“. Die Schwelle 0,80 im Katalog ist gegen einen
  echten Korpus zu prüfen; bis dahin ist sie eine Konvention.
- **Ein zweiter Dienst.** Das Argument aus ADR-004 gegen einen externen
  Prozess gilt hier — Healthcheck, Netzwerk, Betrieb. Er ist unvermeidbar
  (kein OCR im Code-Node), aber er kostet.
- **N2 bleibt nicht belegbar.** Tesseract ist kein „gängiges IDP-Tool“ im
  Sinne des Anforderungsprofils. Die Nahtstelle ist da, der Beleg nicht.

## Nachtrag 2026-09-12: der Vergleichslauf ist gebaut

Die Konsequenz „N2 bleibt nicht belegbar“ galt, weil die Nahtstelle nur
beschrieben war. Jetzt gibt es `anbieter.py`: ein zweites Lesemodul, das die
Antwort von Azure Document Intelligence in dieselbe Form wie `lesen.py`
übersetzt, und `bewertung.py --leser azure`, das dieselbe Tabelle für den
anderen Leser liefert. Antworten werden einmal aufgezeichnet und liegen als
Fixtures im Repo; Tests und Bewertung brauchen keinen Zugang. Der Schlüssel
kommt nur aus der Umgebung.

Was sich damit ändert: Die Austauschbarkeit an einer Stelle ist gezeigt,
nicht behauptet. Was sich nicht ändert: Ohne Aufzeichnung gibt es keine
Zahl. Am Tag des Nachtrags lag kein Zugang vor, die Tabelle in
`docs/EXTRAKTION.md` trägt den Stand. Und der Anbieteraufruf bleibt ein
Messwerkzeug auf synthetischen Belegen; für echte Belege gilt weiter die
Pseudonymisierungsregel aus `docs/DATENSCHUTZ.md`, die diese Entscheidung
nicht aufhebt.

## Wann wir anders entscheiden würden

- **Mit einem echten Belegkorpus.** Sobald reale Rechnungen und B/L
  verschiedener Aussteller vorliegen, ist die Layoutfamilie der falsche
  Ansatz. Dann Option 2 als primäre Extraktion, mit `lesen.py` als
  Fallback für den Textlayer — und eine Kalibrierung der Konfidenzschwelle
  je Feldklasse gegen diesen Korpus.
- **Wenn ein Anbieter kalibrierte Konfidenzen und Koordinaten aus einem
  multimodalen Modell liefert.** Dann fällt der Unterschied zwischen Option
  1 und 4 in der Extraktion weg; die Pseudonymisierungsfrage bleibt.
- **Wenn der B/L als Datensatz kommt.** Bei einem eBL-Anteil über der Hälfte
  (`docs/07`, Entscheidungspunkte) ist OCR für Transportdokumente der
  falsche Weg; dann ist die API-Aufnahme die primäre Quelle und die
  PDF-Extraktion nur noch für die Handelsbelege nötig.
- **Wenn on-prem Pflicht wird und eine Lizenz da ist.** Dann ABBYY hinter
  derselben Nahtstelle — die Entscheidung „OCR mit Koordinaten vor
  Vision-Modell“ bliebe, nur die Engine wechselt.
