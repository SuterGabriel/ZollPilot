# Die Pipeline

Drei Stufen laufen zwischen einer Änderung und `main`. Sie sind bewusst
unabhängig: Die eine ist schnell und umgehbar, die andere langsamer und nicht
umgehbar.

| Stufe | Auslöser | Umfang | Umgehbar |
|---|---|---|---|
| `.githooks/pre-commit` | `git commit` | vorgemerkte Dateien, teils der ganze Baum | ja, `--no-verify` |
| `.claude/hooks/` | jede Dateiänderung durch einen Agenten | die geschriebene Datei | nein, aber abschaltbar |
| `.github/workflows/ci.yml` | Push auf `main`, Pull Request | der ganze Baum, plus der laufende Stack | nein |

Alle Gates sind Node- oder Bash-Skripte ohne Abhängigkeiten, bis auf die
YAML-Bibliothek, die Katalog und Regel-Check brauchen. Deshalb einmal
`npm ci`. Die Extraktion (Python) hat ihre eigene Prüfung: pytest und die
Bewertung gegen eine Basislinie, beides im CI-Job `extraktion`.

## Einrichten

```bash
npm ci
bash scripts/hooks-installieren.sh
```

Setzt `core.hooksPath` auf `.githooks/`. Nach jedem frischen Klon einmal nötig.

## Stufe 1: der Git-Hook

`.githooks/pre-commit` führt sieben Gates aus; Umfang je Gate mit Grund:

| Gate | Umfang | Warum dieser Umfang |
|---|---|---|
| `scripts/prosa-check.mjs` | vorgemerkte Dateien | schnell, und meldet nichts über Dateien, die man nicht angefasst hat |
| `scripts/link-check.mjs` | ganzer Baum | ein Verweis bricht durch eine Umbenennung in einer anderen Datei |
| `scripts/beleg-check.sh` | ganzer Baum | arbeitet von Natur aus so |
| `scripts/regel-check.mjs` | ganzer Baum | Katalog, Dokumentation, Code und Test liegen selten im selben Commit |
| `scripts/n8n-bundle.mjs --check` | nur bei Änderung an `src/`, Katalog oder Workflow | sonst hat sich am Bundle nichts geändert |
| `scripts/workflow-check.mjs` | nur bei Änderung unter `workflows/` | prüft nur diese Dateien |
| `scripts/kontrast-check.mjs` | nur bei Änderung an der Stildatei der Oberfläche | sonst hat sich an keiner Farbe etwas geändert |

Zusammen unter zwei Sekunden. Tests laufen hier nicht: Sie gehören in die CI,
wo Warten nichts kostet.

## Stufe 2: der Agenten-Hook

`.claude/settings.json` verdrahtet `.claude/hooks/prosa-nach-schreiben.mjs`
als `PostToolUse` auf `Write` und `Edit`. Der Prosa-Check läuft auf genau
die Datei, die ein Agent gerade geschrieben hat; ein Befund geht an den
Agenten zurück, bevor er weiterarbeitet. Der Grund steht im Vorgängerprojekt:
Der einzige handwerkliche Fehler dort war ein Agentenfehler, gefunden beim
Nachlesen, nicht durch eine Prüfung.

## Stufe 3: GitHub Actions

`.github/workflows/ci.yml`, acht Jobs:

| Job | Prüft |
|---|---|
| `belege` | jede Behauptung über die eigene Arbeitsweise hat einen Beleg im Repo; Belegpfade in `ANFORDERUNGEN.md` existieren; jede ADR hat ihre Pflichtabschnitte; `CLAUDE.md` bleibt unter 60 Zeilen |
| `dokumente` | ausgeschriebene Umlaute in Prosa; tote Verweise zwischen Markdown-Dateien |
| `regeln` | Katalog vollständig ausgezeichnet, `[MVP]` in `docs/03` deckungsgleich mit `rules.yaml`, jede Regel hat Implementierung und Test, keine nackte Zahl in `src/regeln/`; dazu die Testsuite des Gates selbst |
| `tests` | 89 Tests: Validatoren gegen Referenzwerte, Grenzfälle je Regel, Aktenaufbau, Pflichtmatrix, Regelwerk, alle Testakten gegen ihre Erwartung |
| `workflows` | der Code-Node ist aus dem aktuellen `src/` gebündelt; die Workflow-Dateien sind strukturell gültig, ohne Geheimnisse, der Code-Node parst |
| `extraktion` | Tesseract installiert, `uv sync --frozen`, 98 Python-Tests inklusive OCR auf dem schlechten Scan und Entscheidung je Akte über `src/cli.mjs`; die Belege werden neu erzeugt und müssen byteidentisch sein; die Bewertung (Field Exact Match je Belegtyp, Entscheidung je Akte) muss die Basislinie in `extraktion/basislinie.json` halten — ohne Basislinie rot |
| `oberflaeche` | Kontrast der Gestaltungstoken nachgerechnet, Bau ohne Warnung, 43 Tests für Zustand, Dienst und Darstellung, dann Playwright mit axe über jede Ansicht — leeres Formular, Formular mit Belegen, Ergebnis, Fehlerfall — dazu Tastaturbedienung und Fokusverwaltung |
| `betrieb` | `docker compose up --build --wait` (baut Extraktion und Oberfläche), dann `scripts/rauchtest.sh`: sieben Akten über `/webhook/akte`, sieben Belegsätze (PDF) über `/webhook/belege`, eine Akte über den nginx-Proxy der Oberfläche, Entscheidungen gegen die Erwartung, fünfzehn Prüfungen in Postgres. Der teuerste Job, und der einzige, der beweist, dass die Teile zusammen laufen |

## Die Gates im Einzelnen

**`scripts/beleg-check.sh`** prüft die Belegspalte in
[ANFORDERUNGEN.md](ANFORDERUNGEN.md): Zeilen mit Status `offen`, `zu klären`,
`teilweise belegbar` oder `nicht belegbar` dürfen auf etwas zeigen, das es
noch nicht gibt — dort ist der Eintrag ein Ziel. Alles andere muss
existieren. Dazu ADR-Pflichtabschnitte, Skills, Commands, Hooks, und dass
jede Zusage in `CLAUDE.md` ein Gegenstück im Repo hat.

**`scripts/regel-check.mjs`** ist das Gate aus ADR-002. Es hat eine eigene
Testsuite mit Fixtures für die Fälle, die stumm bleiben könnten: eine nackte
Schwelle, Zahlen nur in Literalen, die erlaubten 0/1/2. Ein leerer Katalog ist
ein Fehler, kein Erfolg.

**`scripts/n8n-bundle.mjs`** erzeugt den Code-Node aus `src/` und dem Katalog
(ADR-004). `--check` vergleicht, ohne zu schreiben.

**`scripts/workflow-check.mjs`** prüft, was sich ohne n8n prüfen lässt:
JSON, Pflichtfelder je Node, eindeutige Namen, Verbindungen auf existierende
Nodes, keine Geheimnisse in Parametern, Code-Nodes parsen.

**`scripts/rauchtest.sh`** ist kein Gate im Hook, sondern der Beweis im
Betrieb. Jede Testakte trägt ihre Erwartung; das Skript vergleicht die
Antwort des Webhooks damit und zählt die Zeilen in `pruefung`. Runde 2
schickt die PDFs — derselbe Vergleich, nur dass die Assertions unterwegs
vom Extraktionsdienst entstehen.

**`scripts/kontrast-check.mjs`** ist das Gate der Farben (ADR-006). Die
Gestaltungstoken in `oberflaeche/src/styles.css` erklären ihre Ansprüche als
`@kontrast`-Anweisungen; das Skript rechnet sie nach WCAG 2.1 nach. Findet es
keine Anweisung, ist der Lauf rot — ein Prüfer ohne Grundlage meldet den
Stand, nie Erfolg. Es hat eine eigene Testsuite mit Referenzwerten aus der
WCAG-Definition.

**`zollpilot_extraktion.bewertung`** ist das Gate der Extraktion
(`docs/EXTRAKTION.md`). Es misst gegen das Golden Set und vergleicht mit
der Basislinie im Repo. Fehlt sie, steht `KEINE BASISLINIE` in der ersten
Zeile und der Lauf ist rot — die Lehre aus Falle 3 in
[ARBEITSWEISE.md](ARBEITSWEISE.md).

## Die Gegenprobe

Jedes Gate wurde am 12.09.2026 einmal absichtlich rot gemacht und danach
wieder grün, jeweils mit gelesener Meldung:

| Gate | Eingriff | Meldung |
|---|---|---|
| Bundle-Check | eine Kommentarzeile an `src/regeln/befund.mjs` angehängt | „Der Code-Node im Workflow ist veraltet“, Exit 1 |
| Regel-Check | `const X = 6000;` in `src/regeln/VAL-03.mjs` | „nackte Zahl 6000 — gehört als parameters/tolerance in rules.yaml“ |
| Regel-Check | `[MVP]` an QTY-03 in `docs/03` entfernt | „QTY-03: im Katalog, aber in docs/03 nicht als [MVP] markiert“ |
| Beleg-Check | `docs/BETRIEB.md` verschoben | drei Belege fehlen, Exit 1 |
| Beleg-Check (Stufe 3) | Gates angelegt, bevor `docs/EXTRAKTION.md` und `basislinie.json` existierten | „FEHLT docs/EXTRAKTION.md existiert“, „FEHLT Basislinie der Bewertung liegt im Repo“, Exit 1 |
| Bewertung | Lauf vor dem Anlegen der Basislinie | „KEINE BASISLINIE: extraktion/basislinie.json fehlt“, Exit 1 |
| Beleg-Check (Stufe 4) | Gates angelegt, bevor `docs/OBERFLAECHE.md` und die ADR in `DECISIONS.md` standen | „FEHLT docs/OBERFLAECHE.md existiert“, „FEHLT ADR-006 … in DECISIONS.md verlinkt“, Exit 1 |
| pytest (OCR) | Scan mit 34 % Rauschen | `test_scan_wird_per_ocr_gelesen_mit_konfidenz`: `'unclassified' == 'packliste'` — ein echter Fund, nicht inszeniert (Entwicklungslog) |

Dazu die Fälle, in denen ein Gate ohne Absicht rot wurde, bevor es fertig
war: Der Prosa-Check fand sieben Umschriften in neuen Dateien, der Rauchtest
war beim ersten Lauf 8 von 8 rot. Details im
[Entwicklungslog](ENTWICKLUNGSLOG.md).

## Was die Pipeline nicht prüft

Der glaubwürdigste Abschnitt, weil ihn niemand schreiben müsste:

- **Fachliche Nullen, Einsen und Zweien** rutschen durch den Regel-Check.
  Bewusster Tausch gegen Fehlmeldungen (ADR-002).
- **Der Literal-Filter im Regel-Check ist eine Heuristik.** Ein Regex nach
  einem Bezeichner gilt als Division.
- **Rechtsverweise.** Kein Gate prüft, ob `Art. 70 UZK` das sagt, was die
  Regel behauptet. `legal_source` sagt nur, dass es niemand geprüft hat.
- **Pfade in Backticks.** Der Verweis-Check prüft nur `[Text](Ziel)`. Ein
  Pfad in Backticks darf auf etwas zeigen, das erst entsteht — außer in der
  Belegspalte, dort greift der Beleg-Check.
- **Prosa in Code** wird nur in reinen Kommentarzeilen geprüft. Ein Umlaut in
  einer Zeichenkette im Code fällt nicht auf.
- **Extraktionsqualität auf fremden Belegen.** Die Bewertung misst gegen
  PDFs, die aus dem Golden Set erzeugt sind — eine Layoutfamilie, keine
  Stempel, keine Handschrift. 420/420 sagt, dass die Pipeline stimmt, nicht,
  dass sie eine fremde Rechnung liest (`docs/EXTRAKTION.md`).
- **Kalibrierung der OCR-Konfidenz.** Kein Gate prüft, ob 0,80 im Katalog
  eine sinnvolle Schwelle ist.
- **n8n-Semantik.** Der Workflow-Check prüft Struktur, nicht ob n8n den Node
  in dieser Version kennt. Das prüft erst der Import im Job `betrieb`.
- **Der Job `betrieb` prüft sieben Akten, sieben Belegsätze und einen Lauf
  durch die Oberfläche**, nicht Last, nicht Ausfall von Postgres oder des
  Extraktionsdienstes, nicht das Verhalten bei zwei gleichzeitigen Anfragen.
- **axe findet nicht alles.** Automatische Prüfung deckt einen Teil der
  WCAG-Kriterien ab; Verständlichkeit, sinnvolle Reihenfolge und
  Alternativtexte, die etwas sagen, prüft kein Werkzeug. Ein Test mit
  einem Bildschirmleser hat nicht stattgefunden.
- **Ein Browser.** Die Ende-zu-Ende-Läufe nutzen Chromium. Firefox und
  WebKit laufen nicht mit.
- **Python-Prosa** wird nur in Kommentarzeilen geprüft, wie bei den anderen
  Sprachen; Docstrings nicht.
