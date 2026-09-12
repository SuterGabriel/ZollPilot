# Entwicklungslog

Beobachtungen zum Einsatz von KI-Agenten in diesem Projekt. Ehrlich, auch wo
es nicht gut aussieht.

Regel für dieses Log: Einträge entstehen am selben Tag. Rückwirkend
geschriebene Beobachtungen sind Erinnerungen, und Erinnerungen bevorzugen die
Fälle, die gut ausgingen.

Vorlage je Eintrag: Was delegiert wurde · Was gut lief · Was nicht
funktionierte · Was die Testsuite abgefangen hat · Zeitschätzung.

---

## 2026-09-12 — Stufe 0 und 1 an einem Tag

**Was delegiert wurde.** Das gesamte Repo, mit zwei Vorgaben: die
Wissensbasis aus drei Rechercheläufen (`docs/01` bis `docs/08`, `PROJECT.md`,
`rules.yaml`) und der Bauplan aus dem Vorgängerprojekt
(`docs/ARBEITSWEISE.md`). Daraus: Anforderungs-Mapping, vier ADRs, Skills,
Commands, Hooks, fünf Gates mit Testsuite, dreizehn Regeln mit Tests,
Aktenaufbau, Pflichtmatrix, Nachforderung, sieben Testakten, zwei
n8n-Workflows, Bündler, Compose mit Schema, CI mit sechs Jobs.

**Was gut lief.** Die Reihenfolge aus dem Bauplan hat getragen: erst der Kern
ohne n8n, mit Tests, dann das Bündeln in den Code-Node. Dass dieselbe
Funktion in Test, CLI und Workflow läuft, war am Ende des Tages nicht
Behauptung, sondern Ausgabe des Rauchtests. Die Regelimplementierungen sind
kurz, weil jede Zahl aus dem Katalog kommt — ORG-06 hat 40 Zeilen und kennt
die 6.000 nicht.

**Was nicht funktionierte.**

- **Die Buchstabenwert-Formel für ISO 6346 war falsch — bei genau einem
  Buchstaben.** Der Agent schrieb eine geschlossene Formel für „A = 10,
  Vielfache von 11 überspringen“. Sie stimmte für A bis K und für M bis Z,
  aber L ergab 22 statt 23. Das Referenzbeispiel des Standards
  (`CSQU3054383`) enthält kein L und war grün. Gefunden hat es der
  Test, der jeden Grenzbuchstaben einzeln prüft — und der wäre ohne die
  Regel „Grenzfallliste vor Implementierung“ nicht geschrieben worden.
  Ersetzt durch eine Zählschleife, die in zwei Sätzen erklärbar ist.

- **Schlimmer: Die zweite Testcontainernummer war mit der falschen Formel
  berechnet.** `HLXU8765439` — mit L — stammte aus einem Aufruf der
  fehlerhaften Funktion und stand als „gültig“ im Generator und in zwei
  Tests. Ein Fixture, das vom geprüften Code erzeugt wird, prüft nichts. Nach
  der Korrektur brachen genau die zwei Tests, die diese Nummer nutzten. Die
  Lehre ist die aus dem Bauplan, Falle 3: Die Vergleichsgrundlage muss
  unabhängig vom Prüfling sein. Die Referenzwerte für Container und
  USt-IdNr. kommen jetzt ausschließlich aus dem Standard beziehungsweise
  aus einer externen Quelle, nicht aus dem eigenen Code.

- **`PROJECT.md` sagte „12 Regeln“, der Katalog hatte 13.** Aufgefallen beim
  Zählen der `[MVP]`-Markierungen für den Regel-Check. Das war der erste
  echte Fund des Gates, bevor es fertig war — und der Grund, warum es
  `docs/03` gegen `rules.yaml` in beide Richtungen prüft.

- **Vier handwerkliche Fehler beim ersten Testlauf**, alle vom Test gefangen:
  YAML-Flow-Listen mit `[]` im Wert parsen nicht (Werte quotieren);
  `100.01 - 100` ist nicht `0.01` (Reserve gegen Gleitkommarauschen);
  `Number('')` ist `0`, nicht `null`; und ein Objekt wurde gelesen, bevor
  das Feld gesetzt war — `Betreff: undefined` in der ersten Nachforderung.

- **Namenskollision beim Bündeln.** Zwei Validatoren hatten je eine Konstante
  `MODUL`. Als Module getrennt, nach dem Bündeln ein Geltungsbereich. Fiel
  beim ersten Parsen des Bundles auf; die Regel „global eindeutige Namen in
  `src/`“ steht jetzt in ADR-004 und im Skill.

- **`toFixed(1)` und `* 100` in QTY-02.** Das Gate gegen nackte Zahlen fand
  Darstellungscode in einer Regel. Nicht fachlich, aber das Gate kann das
  nicht unterscheiden — und soll es auch nicht. Die Helfer `prozent()` und
  `gerundet()` leben jetzt in der Normalisierung.

**Was die Testsuite abgefangen hat.** Sechs von 89 Tests beim ersten Lauf
rot, alle sechs echte Fehler (oben). Nach der Korrektur der Buchstabenformel
zwei weitere rot — die verseuchte Containernummer. Der Regel-Check hat beim
ersten Lauf 0 Fehler gemeldet, weil `PROJECT.md` da schon korrigiert war;
die Abweichung war von Hand gefunden worden. Das Gate hätte sie gefunden.

**Was der Rauchtest abgefangen hat.** Drei Dinge, die kein Unit-Test sehen
konnte, weil sie n8n-Verhalten sind:

- **Der CLI-Import deaktiviert jeden Workflow** („Remember to activate
  later“). Der Webhook antwortete mit 404, obwohl das JSON `active: true`
  trug. Lösung: `n8n update:workflow --id=... --active=true` als dritter
  Schritt im Import-Container — und der greift nur, wenn n8n danach startet.
- **Ein Error-Trigger-Workflow lässt sich nicht aktivieren** („has no node
  to start the workflow“), n8n versuchte es im Sekundentakt. Er wird über
  `errorWorkflow` der anderen Workflows gestartet und bleibt inaktiv.
- **Ohne feste `id` im JSON dupliziert der Import bei jedem Start.** Nach
  dem zweiten Hochfahren lagen vier Workflows in der Datenbank. Jetzt tragen
  beide eine feste ID, und `errorWorkflow` zeigt darauf.

Der erste Lauf war 8 von 8 rot, der dritte vom sauberen Stand (`down -v`)
8 von 8 grün: sieben Entscheidungen über den echten Webhook identisch mit
den Tests, sieben Zeilen in `pruefung`. Erst damit ist ADR-004 eingelöst
und nicht nur beschlossen.

**Was offen blieb.** Die Extraktion. Das Repo hat den Konfidenzpfad, aber
keine Engine, die Konfidenzen liefert. Das steht so in `ANFORDERUNGEN.md`
und `OFFENE-PUNKTE.md`, nicht geschönt. Das GitHub-Remote fehlt, weil die
CLI nicht angemeldet ist; das Repo ist lokal mit allen Commits.

**Zeitschätzung.** Delegiert: eine Sitzung, etwa vier Stunden Agentenzeit
inklusive Korrekturen. Von Hand geschätzt: drei bis vier Tage für denselben
Stand — der Großteil davon Recherche-Konsolidierung, Testfälle und
Dokumentation, nicht Code. Die Zahl ist eine Schätzung, keine Messung.

---

## 2026-09-12 — Stufe 3: die Extraktion

**Was delegiert wurde.** Die Entscheidung, was zuerst kommt (Python-Extraktion
vor Angular-Oberfläche, `DECISIONS.md`), dann Stufe 3 im Ganzen: ADR-005,
das Paket `extraktion/` mit den Schichten Lesen, Klassifikation, Felder,
Akte, der HTTP-Dienst, die Belegerzeugung aus dem Golden Set, 98 Tests, die
Bewertung mit Basislinie, Dockerfile und Compose-Dienst, der zweite Eingang
im Workflow, der Rauchtest mit PDFs, der CI-Job, Skill, und die Dokumente.

**Was gut lief.** Die Schichten haben getragen: Alle Feldextraktoren arbeiten
auf Wörtern mit Koordinaten, und derselbe Code lief ohne Änderung auf dem
Textlayer und auf den OCR-Ergebnissen. Der erste Lauf der Bewertung auf den
digitalen Belegen lag bei 92,9 Prozent mit genau einer Fehlerklasse — die
Packlistenmengen fehlten alle —, und die Ursache war eine Zeile: Der
Tabellenleser kannte die Spalten „Unit“ und „Packed in“ nicht, also schluckte
die letzte bekannte Spalte alles rechts von ihr. Nach der Korrektur 420 von
420. Die PDFs sind unter Windows und Linux byteidentisch, beim ersten
Vergleich. Der Weg PDF → n8n → Dienst → „Akte prüfen“ lief über den echten
Webhook beim ersten Versuch nach der Portkorrektur: 7 von 7.

**Was nicht funktionierte.**

- **Der erste schlechte Scan war unlesbar — auch für Tesseract.** 34 Prozent
  Rauschen ergaben 2 719 „Wörter“ mit Konfidenz 0 und `unclassified`. Ein
  Scan, den kein Mensch liest, prüft nichts. Bei 14 Prozent Körnung plus der
  Vorverarbeitung aus `docs/07` (Kontrast, Medianfilter) — die im Dokument
  stand, aber nicht im Code, bis der Test sie verlangte — liest Tesseract 13
  von 13 Zeilen mit Konfidenzen zwischen 0,64 und 0,96.

- **Und dann liest er richtig.** Der Konfidenzpfad wird auf dem PDF-Scan
  nicht ausgelöst, weil die Containernummer stimmt (0,92). Die Erwartung der
  PDF-Akte ist deshalb `freigabereif`, nicht `nachextraktion_erforderlich`
  wie in der JSON-Akte. Die JSON-Akte bleibt die deterministische Vorführung
  des Pfads; die PDF-Akte zeigt, dass die Konfidenzen echt sind. Beides steht
  in `docs/EXTRAKTION.md`, statt dass der Scan so lange verschlechtert wird,
  bis die Vorführung klappt.

- **Dabei fiel eine Lücke im Regelwerk auf, nicht in der Extraktion:** Nur
  TRN-01, TRN-02 und VAL-01 kennen den Konfidenzpfad. Eine falsch gelesene
  Menge blockiert über QTY-01 fachlich. Steht in `docs/OFFENE-PUNKTE.md`,
  oben.

- **`als_betrag` war zweimal zu großzügig.** „12 PCE PAL-1“ wurde 121, dann
  nach der ersten Korrektur „PAL-1“ zu −1. Jetzt: genau eine Zahl, drumherum
  nur Währung oder Einheit, sonst None — und die Regel sagt `nicht_pruefbar`.

- **Drei Shell-Fehler, einer davon stumm.** Zwei Heredocs mit Sonderzeichen
  scheiterten sichtbar am Parser. Der dritte Fall war schlimmer: Eine
  Textersetzung im Dockerfile fand ihre Stelle nicht, meldete nichts, und der
  nächste Build lief mit der alten Stufe. Dazu ein `| tail`, das den
  Exit-Code des Builds verdeckte — „exit 0“ über einem roten Build. Lehre:
  Änderungen über das Werkzeug, das die Stelle kennt, und Exit-Codes vor
  dem Filter lesen.

- **Kleinigkeiten, jede vom nächsten Schritt gefangen:** Editable-Install,
  bevor das Paket existierte (`ModuleNotFoundError`); Port 8080 auf dem Host
  belegt (jetzt 8765); der Workflow-Check hätte ein `await` im Code-Node als
  Syntaxfehler gemeldet, das n8n erlaubt — er parst jetzt als
  async-Funktion.

**Was die Testsuite abgefangen hat.** 15 von 95 Python-Tests beim ersten
Lauf rot: alle Ende-zu-Ende-Fälle wegen der Packlistenmengen, dazu zwei
Erwartungen an `als_land`, die falsch aufgeschrieben waren („Singapore
018960“ ist Singapur). Der OCR-Test im Docker-Build war rot, bevor jemand
den Scan angesehen hatte — der wertvollste Befund des Tages. Die Bewertung
sagte beim ersten Lauf `KEINE BASISLINIE` und war rot, wie sie soll. Der
Beleg-Check meldete `docs/EXTRAKTION.md` und `basislinie.json` als fehlend,
bevor sie existierten; die Gates standen vor den Belegen.

**Zeitschätzung.** Delegiert: eine Sitzung, etwa drei Stunden Agentenzeit,
davon ein Drittel Docker-Läufe. Von Hand geschätzt: zwei bis drei Tage —
der Tabellenleser, die Belegerzeugung und die Reproduzierbarkeit über zwei
Betriebssysteme sind die Zeitfresser, nicht der Dienst. Schätzung, keine
Messung.

---

## 2026-09-12 — Stufe 4: die Eingabe bekommt eine Oberfläche

**Was delegiert wurde.** Die Frage „können wir die Eingabe mit Angular
machen“, und daraus: ADR-006, die Anwendung in `oberflaeche/` mit ngrx, das
Kontrast-Gate, Ende-zu-Ende mit axe, nginx als Proxy derselben Herkunft, der
Compose-Dienst, der CI-Job, Skill und Dokumente. Dazu die Bitte, die Syntax
nicht zu raten, sondern zu prüfen.

**Was gut lief.** Die Prüfung vor dem Schreiben hat sich sofort bezahlt
gemacht: Die Parameter des HTTP-Request-Node wurden gegen den ausgelieferten
Node-Code im laufenden Container geprüft, nicht gegen eine Erinnerung. Dabei
kam heraus, dass `contentType` die Vorgabe `json` hat — der Node lief also
schon, aber der Workflow sagte es nicht. Jetzt sagt er es. Genauso bei
ngrx: Jedes Symbol wurde vor der Verwendung in den Typdefinitionen
nachgeschlagen. Der erste `ng build` war grün, der erste Testlauf bis auf
zwei falsch aufgeschriebene Erwartungen auch.

**Was nicht funktionierte.**

- **Es war kein MCP-Server angebunden, und ich habe das zuerst als Ende der
  Sache behandelt.** Die konfigurierten Server waren Gmail, Kalender und
  Drive von claude.ai. `.mcp.json` richtet `ng mcp` für die nächste Sitzung
  ein — aber MCP-Server werden beim Start geladen, also war er in dieser
  Sitzung unerreichbar. Das stimmte nur, solange niemand nachfragte: Der
  Server spricht JSON-RPC über stdio, und das geht über die Kommandozeile
  genauso. Nachgeholt auf Nachfrage des Nutzers, mit drei Funden (unten).
  Die Lehre ist unangenehm und einfach: „Das Werkzeug ist nicht angebunden“
  hieß hier „ich habe den zweiten Weg nicht gesucht“.

- **Der Webhook-Node kennt kein CORS.** Nachgesehen im Node-Verzeichnis des
  laufenden Containers: weder `allowedOrigins` noch
  `Access-Control-Allow-Origin`. Damit war die Entscheidung für einen Proxy
  keine Vorliebe, sondern die einzige Möglichkeit — und das steht so in
  ADR-006, statt als Architekturgeschmack.

- **Die Sperrdatei war in sich inkonsistent.** `npm ci` im Container brach
  ab: `@emnapi/runtime@1.11.3` fehlte. Der Grund war nicht Alpine gegen
  Debian, wie zuerst vermutet, sondern ein schrittweise gewachsener
  `package-lock.json` aus mehreren `npm install`-Läufen, in dem
  `@emnapi/core` oben lag und seine Laufzeit nur verschachtelt. Erst das
  Nachsehen im Lock zeigte es; `rm -rf node_modules package-lock.json` und
  ein sauberer Lauf haben es behoben. Zwei Vermutungen vorher waren falsch.

- **Drei Werkzeugfehler an derselben Wurzel.** Textersetzungen per Python auf
  Dateien mit CRLF greifen nicht, und ein Skript, das an der zweiten
  Prüfzusage abbricht, schreibt auch die erste nicht. Dreimal passiert, bevor
  konsequent das Edit-Werkzeug benutzt wurde, das Zeilenenden kennt.

- **`import.meta` gibt es in Playwright nicht** (es übersetzt nach
  CommonJS), und `config.rootDir` zeigt auf `e2e/`, nicht auf die
  Konfiguration. Beide Annahmen brachen sichtbar. Der Ersatz zählt keine
  Ebenen mehr, sondern sucht `testdaten/belege/` aufwärts und wirft mit
  einer lesbaren Meldung, wenn es fehlt.

- **`strict` fehlte im Angular-Gerüst.** Nachträglich eingeschaltet, dazu
  `noUnusedLocals` und `noUnusedParameters`. Der Code hielt; eine
  Compiler-Warnung über ein überflüssiges `?.` blieb und wurde beseitigt,
  statt sie stehen zu lassen.

**Was die Testsuite abgefangen hat.** Der Prosa-Hook schlug beim Schreiben
des Reducers zu: `laeuft` im Kommentar ist die Umschrift von „läuft“ und
gehörte in Backticks — gemeldet in der Sekunde, in der die Datei entstand.
Der Beleg-Check meldete `docs/OBERFLAECHE.md` und den fehlenden Eintrag von
ADR-006 in `DECISIONS.md`, bevor beide existierten; die Gates standen wieder
vor den Belegen. Der Kontrast-Check rechnete elf Farbpaare nach, bevor die
erste Komponente stand. axe fand in fünf Ansichten keinen Verstoß — das ist
der einzige Punkt, an dem die Prüfung nichts gefunden hat, und er sagt
weniger, als er scheint: Automatische Prüfung deckt nur einen Teil der
WCAG-Kriterien ab.

**Was der Angular-MCP tatsächlich beigetragen hat.** Mehr als erwartet, und
zwar Konkretes statt Allgemeinplätzen. `get_best_practices` liefert
versionsgenaue Vorgaben, und drei davon trafen den geschriebenen Code:
`changeDetection: OnPush` ist seit v22 die Vorgabe und gehört nicht mehr
hingeschrieben (vier Komponenten bereinigt); `@Service()` löst
`@Injectable({ providedIn: 'root' })` ab (zwei Dienste); und Signal Forms
sind seit v22 stabil und laut Empfehlung die erste Wahl für neue Formulare —
dieses Projekt bleibt bei Reactive Forms, jetzt aber als benannte
Entscheidung statt aus Gewohnheit.

Wichtiger als die Funde ist, wie sie geprüft wurden: Der MCP ist ein
Dokument, kein Compiler. `@Service` und `@angular/forms/signals` wurden in
den ausgelieferten Typdefinitionen nachgesehen, bevor eine Zeile entstand.
Zur OnPush-Vorgabe schwiegen die Typen — erst `search_documentation` mit
`version: 22` lieferte den Satz „ChangeDetectionStrategy.OnPush is the
default strategy (since v22)". Ohne diesen Beleg wäre das Entfernen eine
Verhaltensänderung auf Verdacht gewesen.

Auch der Server selbst wurde nachgesehen statt erinnert: In Version 22 hat
er sechs Werkzeuge (`get_best_practices`, `search_documentation`,
`list_projects`, `onpush_zoneless_migration`, `devserver_wait_for_build`,
`ai_tutor`), nicht drei wie in v20.

**Die interessanteste Fachstelle.** Der Workflow antwortet 422, wenn die
Akte nicht freigabereif ist — für den Angular-HttpClient ein Fehler, fachlich
das Ergebnis. Wer das nicht trennt, verliert genau die Befunde, um die es
geht, und zwar geräuschlos: Die Oberfläche zeigte dann „Einreichung
gescheitert“ statt „blockiert, TRN-01 verletzt“. Der Fall steht jetzt in
beide Richtungen im Test, samt 422 ohne verwertbaren Körper.

**Was offen blieb.** Die Oberfläche zeigt einen Vorgang, keine Akte: Ein
zweiter Beleg zur selben Sendung beginnt von vorn, weil es keine
Aktenidentität gibt — offene Frage 2, umgangen und nicht gelöst. Übersteuern,
Korrigieren und die Fundstelle am Beleg fehlen; das ist Stufe 5. Und ngrx ist
für diesen einen Bildschirm mehr Gerüst, als er braucht. Das steht als Wette
in ADR-006 und nicht als Selbstverständlichkeit.

**Zeitschätzung.** Delegiert: eine Sitzung, etwa zweieinhalb Stunden
Agentenzeit, davon ein gutes Stück Docker- und Browser-Installation. Von
Hand geschätzt: zwei bis drei Tage — der Zustand und die Komponenten sind
schnell, die Barrierefreiheitsprüfung mit echten Läufen, die nginx-Kette und
die Nachführung der elf Dokumente sind es nicht. Schätzung, keine Messung.
