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

## 2026-09-12 — Der Konfidenzpfad trägt jetzt zehn Regeln

**Was delegiert wurde.** Die offenen Punkte abarbeiten, angefangen mit dem
Riss, den das Repo selbst protokolliert hatte: Nur TRN-01, TRN-02 und VAL-01
fragten die Extraktionskonfidenz. Eine falsch gelesene Menge blockierte die
Akte über QTY-01 fachlich — genau das, was CLAUDE.md als harte Grenze 3
verbietet.

**Was gut lief.** Der Riss ließ sich mit einem Helfer schließen statt mit
siebenfachem Kopieren: `verletztWennSicher(akte, pfade, defaults, ...)` in
`src/regeln/befund.mjs`. Jede Regel übergibt die Pfade, auf denen **ihr**
Befund beruht — nicht alle ihre Eingaben. Das ist der Unterschied, der
zählt: Sonst könnte ein einziges schlecht gelesenes Feld jede Ablehnung der
Akte entwerten. Ein eigener Test hält genau das fest.

**Was nicht funktionierte.** Zwei Textersetzungen griffen nicht, weil die
Vorlage im Skript nicht Zeichen für Zeichen mit der Datei übereinstimmte —
und weil das Skript beim ersten Fehlschlag abbrach, blieben auch die
nachfolgenden Dateien unangetastet. Dritter Fall derselben Art an einem Tag.
Die Lehre steht schon im vorigen Eintrag und wurde wieder nicht befolgt:
Für Änderungen an bestehenden Zeilen das Werkzeug nehmen, das die Datei
liest, statt eine Vorlage aus dem Gedächtnis zu tippen.

**Was die Testsuite abgefangen hat.** Vier Regeltests brachen sofort, weil
die Regeln jetzt `defaults` brauchen und die Tests es nicht übergaben —
`Cannot read properties of undefined`. Genau das soll passieren: Eine
geänderte Signatur, die niemand bemerkt, ist ein stiller Fehler. Ein
fünfter Test brach später aus demselben Grund an einer Stelle, die die
Massenanpassung nicht getroffen hatte.

**Der Umfang.** Sieben Regeln umgestellt (QTY-01, QTY-02, QTY-03, CLS-01,
ORG-02, ORG-06, VAL-03), zehn neue Tests, 101 statt 91 insgesamt. Drei
Regeln tragen den Pfad bewusst nicht, und auch das steht jetzt als Test da,
nicht als Auslassung.

**Zeitschätzung.** Delegiert: etwa vierzig Minuten. Von Hand: ein halber
Tag, der Großteil davon die Frage, welche Pfade je Regel am Befund beteiligt
sind — nicht das Schreiben.

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

## 2026-09-12 — Stufe 5: übersteuern, ohne umzuentscheiden

**Was delegiert wurde.** „Machen wir Stufe 5" — und daraus: ADR-007,
`src/override.mjs`, die Verdrahtung im Regelwerk, das Schema, der Weg durch
den Workflow und der Baustein in der Oberfläche, mit dem ein Mensch
verantwortet.

**Die Entscheidung, an der alles hängt.** Ein Override ändert den Befund
nicht. Er bleibt `verletzt`, und daneben steht, wer die Freigabe
verantwortet. Das Ergebnis trägt deshalb zwei Sätze: `freigabe` ist, was das
Regelwerk sagt, `freigabe_nach_override` ist, was unter menschlicher
Verantwortung gilt. Die Versuchung war, einen Befund auf `ok` zu setzen —
das wäre eine Zeile weniger gewesen und hätte die Beweiskette zerschnitten.
Nach drei Jahren fragt eine Zollprüfung nicht „war die Akte frei", sondern
„welche Regel galt, was sagte sie, wer ist darüber hinweg". Nur die zweite
Frage lässt sich beantworten, wenn der Befund stehen bleibt.

**Der Satz, der dazugehört.** Ein Override haftet an einer Kennung *und*
einer Fassung. Ändert sich der Katalog, ist er verbraucht — die Person hat
eine andere Regel verantwortet als die, die jetzt gilt. Das ist unbequem und
richtig. Verbrauchte Overrides verschwinden nicht, sie werden gemeldet.

**Wo der Transport eine eigene Entscheidung brauchte.** Der Webhook
antwortet 200 nur für freigabereif. Folgt der Statuscode `freigabe`, bekommt
eine verantwortete Akte für immer 422. Er folgt jetzt
`freigabe_nach_override`: Der Rumpf trägt beide Sätze unverändert, der
Statuscode sagt dem Aufrufer nur, was er tun soll. Ohne Übersteuerung sind
beide gleich, also ändert sich für jeden bestehenden Aufrufer nichts.

**Was zuerst falsch war.** Der Knopf „Übersteuern" bekam seinen Zusatz über
ein `nur-vorlesen`-Element — und hieß im Barrierefreiheitsbaum
„Übersteuern : TRN-01", mit Leerzeichen vor dem Doppelpunkt. Die erste
Vermutung war der Zeilenumbruch im Template; falsch. Chrome trennt die
Beiträge von Kindknoten grundsätzlich mit einem Leerzeichen. Der Zusatz
steht jetzt im `aria-label`. Gefunden hat es der Ende-zu-Ende-Test, nicht
das Lesen.

**Die alte Lehre, wieder nicht gelernt.** Zweimal in dieser Sitzung wurde
eine Datei per Suchen-und-Ersetzen geändert, statt sie zu bearbeiten. Beim
ersten Mal wurden aus Testnamen Umlaute — und gleich mit aus
`zaehltTrotzUebersteuerung` ein `zähltTrotzÜbersteuerung`. Beim zweiten Mal
blieb ein `baue({}))` mit einer Klammer zu viel stehen. Beides fiel sofort
auf, weil Gates laufen. Der Eintrag steht hier trotzdem: Die Lehre ist seit
drei Sitzungen aufgeschrieben und wird trotzdem nicht befolgt.

**Was offen blieb.** Übersteuern ist gebaut, Korrigieren nicht: Ein falsch
gelesener Wert lässt sich verantworten, aber nicht richtigstellen. Das
Namensfeld ist keine Anmeldung und sagt das auch auf dem Bildschirm — vor
jedem Betrieb außerhalb der eigenen Maschine ist das ein Blocker. Und wer
erfährt, dass eine Katalogänderung Overrides verbraucht hat, ist niemand:
Es fällt erst bei der nächsten Prüfung derselben Akte auf.

## 2026-09-12: Monitoring, das abgeholt wird, und Läufe, die sich wiederholen lassen

**Was delegiert wurde.** Zuerst die zweite Ausschreibung (Neckarsulm)
wörtlich ins Mapping, damit jede Stufe sagt, welche Zeile sie schließt.
Dann der Aufgabenblock A8: Prometheus, Alertmanager, SQL-Exporter und
Grafana in den Stack; fachliche Zähler aus der Prüftabelle; Metriken der
Extraktion; elf Alarmregeln, jede mit Runbook; Alarme über n8n als Zeile in
Postgres; Wiedervorlage gescheiterter Läufe; zwei neue Rauchtestrunden.
Parallel arbeitet ein zweiter Chat auf dem Branch `extraktion` an
IDP-Vergleich, ABD und XML. Die Aufteilung ist nach Dateien, nicht nach
Themen: Dieser Branch besitzt Compose, `deploy/`, `workflows/` und die
gemeinsamen Dokumente, der andere `extraktion/`, `testdaten/` und `src/`.

**Was gut lief.** Die Entscheidung, die fachlichen Zähler aus der
Prüftabelle zu ziehen statt aus n8n. Der Code-Node kann nichts exportieren,
die Tabelle ist ohnehin der Ort der Wahrheit, und der Postgres-Exporter
selbst verweist für Fachabfragen auf den SQL-Exporter. Und die Alarmkette
hat sich bewiesen, bevor der Rauchtest sie prüfen konnte: Der Exporter
startete beim ersten Versuch nicht, Prometheus meldete
`ZollPilotSqlExporterNichtErreichbar`, der Alertmanager lieferte an n8n, die
Zeile stand in `alarm`, und als der Exporter dann lief, zählte er seinen
eigenen Ausfall zurück.

**Was nicht funktionierte.** Dreimal am Node „Wiedervorlage vorbereiten“,
und jedes Mal war es eine Eigenheit von n8n, nicht die Idee. Erstens wirft
`$('Node').first()` nicht, wenn der Node nicht gelaufen ist; es gibt
`undefined` zurück, und `.json` darauf ist der Absturz. Zweitens ist
`isExecuted` nur für Ausdrücke dokumentiert; im Code-Node hielt der so
abgesicherte Code jeden Belege-Lauf für einen Akte-Lauf und legte nichts
ab. Drittens liegt die Ausgabe eines Nodes, dessen Fehlerausgang genommen
wurde, auf Ausgang 1, und `.first()` liest Ausgang 0. Der Node liest jetzt
beide Ausgänge in einem abgefangenen Zugriff und kommt ohne `isExecuted`
aus. Dazu der SQL-Exporter: Die dokumentierte Umgebungsvariable für die
Verbindung kennt Version 0.18.0 nicht, das Flag schon, aber nur, wenn die
Datei einen Platzhalter trägt. Und der Metrik-Endpunkt der Extraktion
antwortete als eingehängte App mit einer Umleitung auf `/metrics/`, die
Prometheus schluckt und `curl -f` nicht; jetzt ist es eine feste Route.

**Was die Testsuite abgefangen hat.** Alle drei Fehler am Wiedervorlage-Node
hat Runde 6 des Rauchtests gefunden; keiner wäre beim Lesen aufgefallen.
Der erste Lauf endete mit 200 und leerem Rumpf, genau der Fall, für den der
Fehlerzweig gebaut wurde, nur diesmal ausgelöst vom Fehlerzweig selbst. Die
Umleitung auf `/metrics/` fand Runde 7. Neu im Beleg-Check: Jeder Alarmname
aus `alarme.yml` muss in der Betriebsdoku stehen. Ein Alarm ohne Runbook
ist ab jetzt ein roter Lauf, kein Vorsatz.

**Zeitschätzung.** Delegiert: eine Sitzung, etwa drei Stunden Agentenzeit,
davon ein Drittel im Stack (Bauen, Importieren, sieben Runden je Lauf).
Von Hand geschätzt: zwei bis drei Tage, und die Nachforschung zu den drei
n8n-Eigenheiten hätte davon den größten Teil gekostet. Schätzung, keine
Messung.

## 2026-09-12: ein eigener Node, der nichts entscheidet

**Was delegiert wurde.** Der Aufgabenblock „Node-Entwicklung“ aus der
Neckarsulm-Ausschreibung: ein eigener n8n-Node als npm-Paket in TypeScript
mit eigenem Credential-Typ, der im Prüf-Workflow den HTTP-Request-Node für
die Extraktion ersetzt, mit Tests ohne n8n und einem CI-Schritt, der
`dist/` aus den Quellen nachbaut.

**Die Entscheidung, an der alles hängt.** Der Node bekommt keinen
Fachparameter. Belegtyp oder Konfidenzschwelle als Node-Einstellung wären
Fachlogik im Workflow, und die hätte keinen Test (ADR-004). Er kennt Quelle
der Belege, Stammdatenfeld und Zeitlimit; Adresse und Token stehen in der
Credential. Der Test lehnt jeden Parameter ab, dessen Name nach Fachlogik
klingt. Das ist die Probe aus dem Skill, als Assertion.

**Was gut lief.** Der Name des Nodes blieb „Belege extrahieren“, deshalb
stimmte jeder Ausdruck im Workflow weiter, auch der Wiedervorlage-Node
vom Vormittag. Und die Frage, wie n8n Nodes aus dem Erweiterungsverzeichnis
lädt, ließ sich aus dem Quellcode der laufenden Version beantworten statt
aus verschobenen Doku-Seiten: rekursiv nach `*.node.js`, Paketname
`CUSTOM`, kein `package.json` nötig.

**Was nicht funktionierte.** Die Modulauflösung. Im Container zeigt kein
Suchpfad auf das `node_modules` von n8n; ein `require('n8n-workflow')` im
Node hätte beim Laden gescheitert, still, mit einem fehlenden Node-Typ
beim Import. Deshalb importiert der Node nur Typen, Fehler sind gewöhnliche
Errors, und ein Test liest `dist/` und verbietet den Aufruf. Dazu eine
falsche Testerwartung: `liesPfad` mit leerem Pfad liefert das Objekt
selbst, nicht `undefined`; das ist das richtige Verhalten (leeres Feld
heißt: das ganze JSON sind die Stammdaten), die Erwartung war falsch.

**Was die Testsuite abgefangen hat.** Der Beleg-Check verlangte nach dem
Umbau weiter `extraktion:8080` im Workflow; die Adresse war in die
Credential gewandert. Das Gate war rot, bevor der Rauchtest lief, und die
Prüfung sagt jetzt das Richtige: Adresse in der Credential, Typ im
Workflow. Der Rauchtest hat den Node dann in Runde 2 und 6 bewiesen, ohne
eine Zeile Änderung.

**Zeitschätzung.** Delegiert: knapp eine Stunde Agentenzeit. Von Hand
geschätzt: ein Tag, davon ein halber für die Frage, wie n8n das
Verzeichnis lädt und was darin auflösbar ist. Schätzung, keine Messung.

## 2026-09-12: die drei Artefakte, die eine Ausschreibung beim Namen nennt

**Was delegiert wurde.** Prozesslandschaft, Datenflussdiagramm,
Betriebshandbuch, in der Form, die die Neckarsulm-Ausschreibung verlangt.
Das Handbuch war mit den Runbooks vom Vormittag schon da; die beiden
Diagramme entstehen in `docs/prozess/`.

**Die Entscheidung, an der alles hängt.** Die Diagramme zeigen den
Zielprozess aus `docs/05`, nicht nur das Gebaute, und markieren den
Unterschied. Das folgt der Regel, dass Ziele mit Status dastehen statt
weggelassen zu werden. Die Alternative, nur das Gebaute zu zeichnen, hätte
ein Bild ergeben, das am Webhook beginnt und nach der formulierten
Nachforderung endet; das ist kein Prozess, das ist ein Ausschnitt.

**Was gut lief.** Mermaid im Repo rendert auf GitHub, ist diffbar und
kostet kein Werkzeug. Die BPMN-Datei ist aus derselben Prozessbeschreibung
erzeugt, mit Lanes und Layout, damit sie in einem Modeler aufgeht statt
als leere Fläche. Zwei Formen, eine Quelle.

**Was nicht funktionierte.** Der Logeintrag selbst, im ersten Anlauf: Er
behauptete einen zweiten Generatorlauf wegen der Rückwege im Layout, bevor
der Generator überhaupt gelaufen war. Er lief beim ersten Mal durch. Der
Satz wurde gestrichen; er steht hier, weil er genau der Fehler ist, vor dem
`docs/ARBEITSWEISE.md` warnt: eine Beobachtung, die vor der Beobachtung
geschrieben wurde.

**Was die Sichtprüfung fand.** Später am selben Tag wurde die Datei mit
bpmn-js im Chromium der Playwright-Tests gerendert und als Bild angesehen.
Der Import lief ohne Warnung, aber zwei Linien liefen durch Kästen: der
Weg von der Ausfuhranmeldung zum Endereignis durch „Erinnerung und
Eskalation“, und der Rückweg vom Übersteuern zur Prüfung durch die Raute.
Beides hätte kein Parser gefunden. Die rechten Spalten sind um eins
gerückt, und Rückwege aus einer oberen Lane laufen jetzt über den Pool
statt unten herum. Der zweite Blick war sauber.

**Was die Testsuite abgefangen hat.** Der Beleg-Check verlangt jetzt, dass
die Landschaft gerendert ist, dass sie „vorgesehen“ sagt und dass die
BPMN-Datei Layout trägt. Ein Diagramm, das nur beschreibt, wäre rot. Die
Wohlgeformtheit prüft er nicht; das war ein einmaliger Lauf mit dem
XML-Parser aus der Python-Standardbibliothek.

**Zeitschätzung.** Delegiert: eine gute halbe Stunde. Von Hand geschätzt:
ein Tag, davon der größte Teil im Modeler. Schätzung, keine Messung.
## 2026-09-12, Extraktion im zweiten Chat: Vergleichslauf, ABD, CII

**Was delegiert wurde.** Drei Aufgaben im Worktree `extraktion`, parallel
zum Chat `betrieb`: ein zweites Lesemodul für einen IDP-Anbieter mit
Aufzeichnungen statt Zugang, das Ausfuhrbegleitdokument als Belegtyp mit
Regel und Pflichteintrag, und die Rechnung als UN/CEFACT-CII-Datensatz in
beide Richtungen, gegen das Schema validiert. Ein Commit je Aufgabe, nicht
pushen, nicht mergen.

**Was gut lief.** Die Nahtstelle aus ADR-005 hat gehalten: Der Anbieterleser
ersetzt genau `lesen.py`, alles dahinter blieb unberührt, und `akte.py`
brauchte nur einen Parameter. Das ABD traf beim ersten Bewertungslauf mit
OCR 91 von 91 Feldern, die acht Akten 8 von 8. Das CII-Schreibmodul bestand
die Schemavalidierung beim ersten Lauf, obwohl die Elementreihenfolge in
D16B aus dem Gedächtnis kam; die Rundreise über `extrahiere_akte` gegen
`erwartet.json` derselben Akte war dann eine einzige Zeile Vergleichscode,
weil `bewertung.vergleiche` schon da war.

**Was nicht funktionierte.** Es gibt keinen Anbieterzugang: keine
Umgebungsvariable, kein `gcloud`, kein `az`. Der Vergleichslauf ist gebaut
und geprüft, aber die zweite Zeile der Tabelle in `docs/EXTRAKTION.md` ist
leer, 0 von 32 Belegen aufgezeichnet. Ich habe keine Antworten erfunden;
das wäre genau der Mock, vor dem ADR-005 warnt. Zweitens: `DECISIONS.md`
war dem anderen Chat vorbehalten, aber `beleg-check` verlangt, dass jede
ADR dort verlinkt ist, und derselbe Auftrag verlangte `npm run check` grün.
Ich habe genau eine Tabellenzeile eingetragen. Drittens: Die Git-Bash
schreibt `/repo/...` in `docker run` zu einem Windows-Pfad um; die Probe im
Image scheiterte daran, nicht das Image. `MSYS_NO_PATHCONV=1` behebt es.

**Was die Testsuite abgefangen hat.** `tests/testdaten.test.mjs` wurde rot,
sobald das ABD in jeder Akte lag: Beim schlechten Scan trägt die Packliste
den falsch gelesenen Container mit Konfidenz 0,55, und CUS-05 vergleicht ihn
jetzt mit dem ABD. Die Regel sagte richtig `re_extraction_required`, aber
die Erwartung der Akte nannte nur TRN-01 und TRN-02. Das ist der Fall, für
den der Konfidenzpfad gebaut ist, an einer Stelle, an die ich beim Schreiben
der Regel nicht gedacht hatte; der Test hat ihn gefunden, nicht ich. Dazu
zwei eigene Tests, die beim ersten Lauf fielen: ein Gleitkommavergleich von
Seitenmaßen und ein `relative_to` auf einen Temp-Ordner außerhalb des Repos.

**Zeitschätzung.** Delegiert: eine Sitzung, etwa zwei Stunden Agentenzeit,
davon ein spürbarer Teil für das Einlesen der vier Schichten und des
Katalogs vor der ersten Zeile. Von Hand geschätzt: drei bis vier Tage, vor
allem für die CII-Struktur und das Golden Set mit neuer Basislinie.
Schätzung, keine Messung.

## 2026-09-12, Vergleichslauf gezogen: Azure liest das Golden Set vollständig

**Was gebaut wurde.** Der Azure-Zugang kam am Abend (Free Trial, Document
Intelligence F0, Region Switzerland North). Die 32 Testbelege wurden
aufgezeichnet, in 14 Dateien, weil der Hash den Namen gibt und viele PDFs
über die Akten hinweg byteidentisch sind. Der Vergleichslauf steht: Field
Exact Match 100 % (570 von 570), 8 von 8 Entscheidungen, dieselben Zahlen wie
die Basislinie. Dazu ein Backoff bei HTTP 429 im Aufzeichnen, zwei
Korrekturen in der Übersetzung, vier neue Tests, die Tabelle und der Absatz
dazu in `docs/EXTRAKTION.md`, ein Absatz im Nachtrag von ADR-005.

**Was gut lief.** Die Nahtstelle hat zum zweiten Mal gehalten. Als der erste
Lauf 26,8 % ergab, lag der Fehler in `anbieter.py`, nicht in einem
Feldextraktor, und die Korrektur blieb dort. Der Schlüssel lag nur in einer
PowerShell-Sitzung; im Repo steht keiner, und der Schlüssel wurde nach der
Aufzeichnung in Azure erneuert, weil er halb in einem Screenshot stand.

**Was nicht funktionierte.** Drei Anläufe fürs Aufzeichnen: Erst schlug das
Ratenlimit der Stufe F0 zu (20 Aufrufe pro Minute, zwei Belege mit 429),
dann ein lokaler Verbindungsabbruch bei einem Beleg. Das Skript überspringt
Aufgezeichnetes, also holte jeder Lauf nur die Reste; den Backoff gab es
vorher nicht, weil der Anbieter nie live lief. Dann der erste Vergleichslauf:
26,8 %, 0 von 8. Die Übersetzung war auf einem handgeschriebenen
Schemabeispiel gebaut und hielt Azures `lines` für Zeilen; sie sind Zellen,
eine Tabellenzeile kam als sieben Zeilen an. Zweitens trennt Azure
Satzzeichen ab (`No` `.:`), und weder die Geometrie noch der Gesamttext
(der dort selbst ein Leerzeichen trägt) sagen, ob ein Leerzeichen war. Die
Regel ist jetzt: Ein Satzzeichenwort dichter als eine Spalte am vorigen Wort
gehört zu ihm. Drittens der schiefe Scan: Die Oberkante wandert über eine
Tabellenzeile um elf Punkte, die Zeilenbildung nach Oberkante riss die
Tabelle auseinander. Jetzt schließt jedes Wort an seinen linken Nachbarn an;
zwischen Nachbarn bleibt die Abweichung unter vier Punkten. Azures eigene
Winkelangabe (`angle`, minus 0,55 Grad) hätte nicht gereicht, der Scan ist
sichtbar schiefer.

**Was die Testsuite abgefangen hat.** Nichts vor dem Lauf, und das ist die
Lehre: Alle elf Anbietertests waren grün, weil sie dieselbe Annahme trugen
wie der Code. Erst die Bewertung gegen das Golden Set mit echten Antworten
fand die Fehler. Deshalb liegen die Aufzeichnungen jetzt im Repo und
`bewertung --leser azure` ist Teil dessen, was vor einem Commit an
`anbieter.py` laufen muss.

**Zeitschätzung.** Zugang anlegen mit Klickanleitung etwa dreißig Minuten,
Aufzeichnen und Korrektur etwa eine Stunde Agentenzeit. Von Hand geschätzt:
ein halber Tag, davon der größte Teil für das Nachvollziehen, warum eine
Tabelle auf einem schiefen Scan auseinanderfällt. Schätzung, keine Messung.

## 2026-09-12: Stufe 6, erster Teil: die Nachforderung wird ein Vorgang

**Was delegiert wurde.** „Mach mir den Rest“, ohne Nennung eines
Modellanbieters. Daraus die Entscheidung, mit der asynchronen Akte zu
beginnen, weil sie sich ohne Zugänge beweisen lässt: ADR-009, Fristen als
Stammdaten je Akte, Stufen mit Bezug und Vorlauf in den Zuständigkeiten,
zwei reine Funktionen für Abgleich und fällige Stufe, das Schema für Fälle
und Versand, ein Nachforderungs-Workflow mit zwei gebündelten Code-Nodes,
GreenMail als Postfach in beide Richtungen, Runde 8 im Rauchtest.

**Die Entscheidung, an der alles hängt.** Der Abgleich läuft nicht im
Prüf-Workflow, sondern in einem eigenen. Der Prüfpfad bleibt, was er war,
und der Zustand hat genau einen Schreiber. Der Preis ist bekannt und steht
in der ADR: Ein Eingang schließt seinen Fall erst beim nächsten Lauf. Die
zweite Entscheidung: kein erfundenes Datum. Eine Stufe, deren Cut-off die
Akte nicht kennt, ist nicht erreichbar, und das Ergebnis sagt das.

**Was gut lief.** Die reinen Funktionen waren nach fünfzehn Tests fertig,
bevor ein Workflow existierte, und der Workflow hat sie beim ersten Lauf
korrekt aufgerufen: zwei Fälle eröffnet, Stufe leer. Der Bündler hat das
zweite Ziel ohne Umbau der Regelwerkseite gelernt; derselbe Code steht in
zwei Nodes, weil der Workflow dazwischen liest und schreibt und ein
schreibendes CTE seine eigenen Zeilen nicht sieht.

**Was nicht funktionierte.** Zweimal GreenMail, beides Betriebswissen,
nicht Konzept. Erstens hat das Image weder `wget` noch `curl`; der
Healthcheck blieb ewig auf „starting“, `--wait` mit ihm. Es hat `bash`,
und ein Verbindungstest über `/dev/tcp` tut es. Zweitens: Bei abgeschalteter
Authentifizierung legt GreenMail jeden unbekannten Anmeldenamen neu an. Die
Credential trug die Adresse als Anmeldename, der vorangelegte Benutzer
hieß `zollpilot` mit derselben Adresse, der Server warf eine Ausnahme und
schloss die Verbindung. n8n sah nur „Connection closed unexpectedly“; das
GreenMail-Log sagte den Grund. Anmeldename statt Adresse, und der Versand
lief.

**Was die Testsuite abgefangen hat.** Die Handprobe vor dem Rauchtest: Sie
zeigte die eröffneten Fälle und den gescheiterten Versand in
`workflow_fehler`, mit dem Node-Namen. Ohne die Zeile hätte die Suche beim
Mail-Node begonnen statt beim Postfach. Der Beleg-Check verlangt jetzt,
dass `stufe.mjs` keine Uhr enthält; das ist die Zusage aus der ADR als
Gate.

**Zeitschätzung.** Delegiert: knapp zwei Stunden Agentenzeit, davon ein
Drittel an den zwei GreenMail-Eigenheiten. Von Hand geschätzt: drei bis
vier Tage, der größte Teil für das Zustandsmodell und den Beweis über
Zeit. Schätzung, keine Messung. Der Rückweg (Antwort mit Anhang in die
Akte), die Identität am Proxy und der Übersichtsbildschirm stehen noch aus.

## 2026-09-12: Stufe 6, zweiter Teil: der Name am Override ist geprüft

**Was delegiert wurde.** Die Identität aus ADR-009: Basic Auth in nginx,
der geprüfte Benutzername als Header an n8n, der Befund sagt, woher der
Name stammt. Dazu der Rauchtest, der beides zeigt: hinter dem Proxy
`proxy`, direkt am Webhook `angegeben`.

**Die Entscheidung, an der alles hängt.** Ein direkter Aufruf wird nicht
abgewiesen, sondern markiert. Die ADR sagte zuerst „lehnt ab“; das hätte
jeden Aufrufer ohne Proxy, auch den Rauchtest und jede Integration,
gezwungen, einen Header zu setzen, den n8n nicht prüfen kann. Ehrlicher
ist die Markierung: Der Audit-Eintrag sagt, ob der Name geprüft war.

**Was nicht funktionierte.** Zweimal nginx. Erstens kopierte das
Dockerfile die Passwortdatei nicht ins Image; nginx antwortete mit 403 und
schrieb den Grund ins Log, der Rauchtest sah nur „keine Anwendung“.
Zweitens, und das war die eigentliche Lektion: `/wer` gab den Namen mit
`return` zurück, und `return` läuft in nginx vor der Zugriffsprüfung. Der
Pfad war nie geschützt und hat jeden mitgeschickten Namen ungeprüft
zurückgegeben; von Hand sah das nach Erfolg aus. Jetzt liefert ein
Inhaltshandler (`empty_gif`) den Namen im Antwortkopf, und der kommt erst
nach der Anmeldung dran. Ein falsches Passwort bekommt 401, wie es sein
soll.

**Was die Testsuite abgefangen hat.** Den fehlenden Kopiervorgang, beim
ersten Lauf des Rauchtests nach dem Umbau. Die Lücke bei `/wer` hat kein
Test gefunden; sie fiel beim Lesen des nginx-Logs auf, weil der Pfad ohne
Passwortdatei hätte scheitern müssen und es nicht tat. Der Rauchtest prüft
jetzt ausdrücklich, dass ein Aufruf ohne Zugangsdaten 401 bekommt.

**Zeitschätzung.** Delegiert: eine gute halbe Stunde. Von Hand: ein halber
Tag, und die `return`-Falle hätte vermutlich länger überlebt. Schätzung,
keine Messung.

## 2026-09-12: Stufe 6, dritter Teil: eine Antwort findet ihre Akte

**Was delegiert wurde.** Der Rückweg aus ADR-009: eine Mail mit Anhang
wird der Akte zugeordnet und löst eine erneute Prüfung aus. Dafür musste
die Akte erstmals abgelegt werden, das ist ADR-010: Stammdaten, Belege und
Assertions je Prüfung in Postgres, nur anhängend. Dazu der
Posteingang-Workflow mit IMAP-Trigger, die Zusammenführung, die Tabelle
für jede Mail, zugeordnet oder nicht, und Runde 9 im Rauchtest.

**Die Entscheidung, an der alles hängt.** Abgelegt werden Assertions,
nicht Originale. Das reicht für den Rückweg und für einen späteren
Review-Arbeitsplatz mit Fundstelle nach Seite und Box; es reicht nicht,
um die Fundstelle im Bild zu zeigen oder einen anderen Leser über alte
Akten laufen zu lassen. Das steht in der ADR als Grenze und als Bedingung,
unter der Option C dazukommt.

**Was gut lief.** Die Tabellen aus Stufe 1 haben mit zwei Änderungen
getragen: Die Dokumentkennung ist je Akte eindeutig, nicht global, und
Assertions hängen an der Zeile, nicht an der Kennung. Der Prüf-Workflow
legt mit einer einzigen Anweisung ab, `ON CONFLICT DO NOTHING` macht den
zweiten Eingang derselben Datei folgenlos. Der Posteingang hat beim ersten
Lauf funktioniert: Rechnung mit Ursprungserklärung per SMTP an GreenMail,
IMAP-Trigger, Zuordnung über die Aktennummer, Extraktion, Zusammenführung
mit Suffix an den neuen Kennungen, erneute Prüfung, sieben Belege statt
fünf, freigabereif statt blockiert.

**Was nicht funktionierte.** Vor dem Lauf: Das Änderungsskript für die
Workflows klonte den Mail-Node aus dem Prüf-Workflow für den
Alarm-Workflow, und diesen Node hatte der Vormittag gerade entfernt.
Aufgefallen beim Lesen des Skripts, nicht beim Lauf; die zwei bestehenden
Workflows werden jetzt nur noch erzeugt, wenn sie fehlen. Und das
Änderungsskript per Python zu flicken scheiterte an einem Backslash, der
durch zwei Ebenen Zitierung lief; von Hand ging es beim ersten Mal.

**Was die Testsuite abgefangen hat.** Nichts Neues an diesem Teil, und das
ist auffällig: Der erste Lauf war grün. Was der Rauchtest jetzt hält: dass
eine Mail ohne Aktennummer nicht verschwindet, sondern mit Grund in
`mail_eingang` steht. Das ist die harte Grenze aus `CLAUDE.md`, nichts
stillschweigend verwerfen, auf den Kommunikationskanal angewandt.

**Zeitschätzung.** Delegiert: gut eine Stunde. Von Hand: zwei bis drei
Tage, vor allem für das Ablegen der Akte und die Zusammenführung, die
ohne den vorhandenen eigenen Node und den Wiedervorlage-Zugriff auf beide
Ausgänge länger gedauert hätte. Schätzung, keine Messung.

## 2026-09-13: Stufe 6, vierter Teil: der zweite Bildschirm

**Was delegiert wurde.** Die Übersicht aus ADR-009: ein Entwurf als
Dokument zuerst (`docs/entwurf/04-uebersicht.md`), dann ein Lese-Webhook
in n8n, ein Router mit zwei Ansichten, die Anmeldung aus `/wer` in der
Kopfzeile und als Vorgabe beim Übersteuern, der Übersichtsbaustein mit
Zustand, Dienst und Effekt, Tests ohne Browser, axe und Tastatur im
Browser, Runde 3 des Rauchtests über den Proxy.

**Die Entscheidung, an der alles hängt.** Der Titel der Ansicht wandert
aus der Kopfzeile in die Ansicht. Sonst hätte die Navigation die
Kopfzeile höher gemacht, und jede Zeile dort fehlt der Aktenspalte. Der
Höhentest bei 900 px war deshalb dreimal rot, um elf, dann drei Pixel;
grün wurde er, als der Untertitel auf einer Zeile laufen durfte.

**Was nicht funktionierte.** axe meldete auf jeder Ansicht der Prüfakte
denselben Verstoß: Seitenkopf und Sprungmarke lagen außerhalb jeder
Landmarke, weil der Umbau sie zwischen Kopfzeile und `main` gesetzt
hatte. Der Kopf gehört ins `main`, die Sprungmarke an den Anfang der
Seite, wo sie als erster Halt vor der Navigation steht und nur dort
erscheint, wo es ein Ergebnis gibt. Zwei Testerwartungen waren falsch:
Der Testclient wandelt einen leeren Text nicht in ein Blob, und das Wort
des Regelwerks heißt „Blockiert“, nicht „blockiert“.

**Was die Testsuite abgefangen hat.** Den Landmarken-Verstoß in fünf
Ansichten auf einmal, bevor jemand ihn hätte sehen müssen; und den
Höhenverlust, den ein Umbau der Kopfzeile still gekostet hätte.

**Zeitschätzung.** Delegiert: gut eine Stunde. Von Hand: zwei Tage, mit
dem Router, dem zweiten Store-Feature und den Tests. Schätzung, keine
Messung.

## 2026-09-13: Stufe 6, Nachtrag: die Antwort schließt ihren Fall sofort

**Was passierte.** Der erste Durchlauf von Hand, in PowerShell statt Git
Bash. Drei Dinge fielen auf, die der Rauchtest nicht sehen konnte: Die
Anleitung nutzte Zeilenumbrüche mit Backslash, die PowerShell als Operator
liest; das Antwortskript brauchte `node`, das auf dem Pfad der Git Bash
dort fehlte; und die Übersicht zeigte nach der Antwort per Mail eine
freigabereife Akte mit zwei offenen Nachforderungen.

**Die Entscheidung.** Das dritte war kein Fehler, sondern der in ADR-010
notierte Preis: Der Fall schließt beim nächsten Lauf. Auf dem Bildschirm
ist das trotzdem ein Widerspruch, den niemand erklären möchte. Der
Posteingang ruft deshalb nach der erneuten Prüfung den
Nachforderungs-Webhook für seine Akte auf. Der Abgleich bleibt, wo er war,
und hat weiter einen Schreiber; er läuft nur einmal öfter.

**Was nicht funktionierte.** Der Versuch, das Skript mit einem Python-Einzeiler
umzuschreiben, hat die Escape-Sequenzen der MIME-Zeilenenden in echte
Zeilenumbrüche verwandelt. Zurück auf den Stand im Repo, dann mit dem
Werkzeug editiert, das Zeichen für Zeichen ersetzt.

**Zeitschätzung.** Delegiert: eine halbe Stunde. Von Hand: ein Vormittag,
weil man den Widerspruch erst einmal für einen Fehler im Abgleich hält.


## 2026-09-13, Google Document AI als zweiter Anbieter: was zwei Anbieter zeigen, was einer nicht kann

**Was gebaut wurde.** Google Document AI hinter derselben Nahtstelle wie
Azure: Übersetzung, Zugang über ein Dienstkonto, Registry statt fest
verdrahtetem Anbieter, sieben neue Tests, 32 Aufzeichnungen. Ergebnis 100 %
und 8 von 8, gleichauf mit Azure und der Basislinie.

**Warum überhaupt.** Aus einem Grund, der nichts mit Technik zu tun hat: Die
Ausschreibung nennt ABBYY und Google Document AI namentlich. Azure war der
bequemere Weg, ein Schlüssel im Kopfzeilenfeld und eine kostenlose Stufe, und
ich hatte ihn gewählt, ohne den Wortlaut der Anforderung ernst zu nehmen. Das
war der Fehler, und der Nutzer hat ihn benannt. Die Lehre ist nicht „Google
statt Azure", sondern: Wenn eine Anforderung einen Namen nennt, ist der Name
Teil der Anforderung. Am Ende stehen jetzt beide da, was mehr wert ist als
einer, aber die Reihenfolge war falsch herum.

**Was gut lief.** Der Zugang ist von Hand gebaut statt über eine SDK-Kette:
ein JWT mit dem privaten Schlüssel des Dienstkontos signieren und gegen ein
Zugriffstoken tauschen, zwanzig Zeilen mit `cryptography`, das über
pdfplumber ohnehin im Baum liegt. Der Test dazu erzeugt ein eigenes
Schlüsselpaar und prüft die Signatur so, wie Google sie prüft; damit ist die
eine Stelle, an der ich einen dokumentierten Ablauf nachbaue, auch die eine
Stelle mit einem Beweis. Das Aufzeichnen lief ohne Ratenlimit durch, der
Backoff von gestern wurde nicht gebraucht.

**Was nicht funktionierte.** Der erste Vergleichslauf ergab 86,3 % und 7 von
8, und die Fehler waren dieselbe Art wie bei Azure, nur an anderer Stelle.
Google trennt Bindestriche als eigene Marken, aus `MAEU-HH-778812` wurde
`MAEU - HH - 778812`, und damit fielen B/L-Nummer, Rechnungsnummer,
Packstück-IDs und Siegelnummer aus. Ich wollte das zuerst über die Lücke im
Bild lösen, wie bei Azure, und habe dann in die echte Antwort geschaut:
Google trägt an jeder Marke `detectedBreak`, wenn danach ein Zwischenraum
folgt. Der Anbieter sagt also selbst, wo ein Wort endet. Eine Heuristik über
Lücken wäre schlechter gewesen als eine Aussage, die dasteht. Zweitens
umschließt Google ein Wort samt dem folgenden Leerzeichen, sodass sich
benachbarte Umrisse überlappen; die Zeilenbildung verglich rechte gegen linke
Kante und riss `Port of discharge:` auseinander. Jetzt werden linke Kanten
verglichen.

**Der eigene Fehler im Modell.** Übrig blieb der schlechte Scan: acht Felder
der Packstücktabelle fehlten, und QTY-03 sprang an. Ursache war keine
Eigenheit von Google, sondern eine falsche Annahme von mir. Die Zeilenbildung
hatte eine feste Toleranz von viereinhalb Punkten, aber ein schiefes Blatt
lässt die Oberkante mit dem waagerechten Abstand wandern: gemessen 1,3 Grad,
über die Blattbreite mehr als zehn Punkte. In der Kopfzeile steht `Type` bei
Oberkante 259,9 und `Gross` bei 254,9, fünf Punkte, eine Spaltenbreite
auseinander. Die Toleranz wächst jetzt mit dem Abstand zum linken Nachbarn.
Dass Azure dabei unverändert bei 100 % blieb, ist der Beleg, dass hier ein
Modell korrigiert und nicht auf ein Ergebnis hin geschraubt wurde; ein Test
hält die gemessenen Koordinaten fest, damit die Begründung nachprüfbar
bleibt.

**Was die Testsuite abgefangen hat.** Wieder nichts vor dem Lauf, und wieder
aus demselben Grund wie gestern: Das handgeschriebene Beispiel trug dieselbe
Annahme wie der Code, diesmal sogar eine falsche Vorstellung von
`detectedBreak`. Erst die echten Antworten gegen das Golden Set fanden die
Fehler. Das ist jetzt zweimal dasselbe Muster, und es ist die wichtigste
Lehre aus beiden Tagen: Ein Schemabeispiel aus dem Gedächtnis prüft die
eigene Vorstellung, nicht die Wirklichkeit.

**Was auffiel, ohne zu stören.** Google legt jeder Seite das gerenderte
Seitenbild bei, rund 260 KB Base64 je Beleg, eine Kopie des Belegs, den das
Repo schon hat. Das wird vor dem Aufzeichnen entfernt und steht so in der
Doku; alles andere bleibt, auch was die Übersetzung nicht liest.

**Zeitschätzung.** Zugang anlegen mit Klickanleitung etwa dreißig Minuten,
Anschluss und zwei Korrekturrunden etwa anderthalb Stunden Agentenzeit. Von
Hand geschätzt: ein Tag, davon der größte Teil für das Nachvollziehen, warum
eine Nummer mit Bindestrichen auseinanderfällt. Schätzung, keine Messung.

## 2026-09-13: Stufe 3b, der Klassifikationsfallback

**Was entstand.** Ein Modell schlägt einen Belegtyp vor, wenn die Regeln
keinen finden: die Pseudonymisierung, die das Datenschutzdokument seit dem
ersten Tag als Bedingung nennt, eine Nahtstelle zu Anthropic nach dem Muster
der IDP-Anbieter, der Anschluss in `akte.py`, zwanzig Tests und ADR-011.

**Die Entscheidung, an der alles hängt.** Der Vorschlag ist kein Typ. Er
hängt unter `klassifikation.vorschlag` neben dem Dokument, das
`unclassified` bleibt. Der Grund ist die Pflichtmatrix: Sie fragt, ob ein
Beleg eines Typs vorliegt. Ein geratener Typ könnte eine Nachweispflicht
erfüllen und eine Sendung freigeben; dann stünde ein Modell in der
Entscheidungsschicht, und die vierte Regel wäre gebrochen. Der Beleg-Check
prüft diese Grenze jetzt als Zusage, an der Stelle, an der bis heute
"kein Modellaufruf in der Extraktion" stand.

**Was der erste Test gefunden hat.** Der CMR-Frachtbrief, an dem der Fallback
gezeigt werden sollte, wurde von den Regeln als Handelsrechnung eingeordnet:
Feld 5 nennt die beigefügten Dokumente, und dort stand das Wort. Der Fallback
greift nur, wenn die Regeln schweigen, nicht wenn sie sich irren. Das steht
jetzt in ADR-011 unter den Nachteilen und in den offenen Punkten, statt in
einem Testtext versteckt zu werden.

**Was noch fehlt.** Die Aufzeichnung. Ohne Schlüssel gibt es keine echte
Modellantwort im Repo, und der eine Test, der sie prüfen würde, wird
übersprungen statt grün behauptet. Die Mechanik ist bewiesen, die Antwort
nicht.

**Zeitschätzung.** Delegiert: gut eine Stunde. Von Hand: zwei Tage, das
meiste davon für die Pseudonymisierung und die Frage, was ein Vorschlag
eigentlich sein darf.

