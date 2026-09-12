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
