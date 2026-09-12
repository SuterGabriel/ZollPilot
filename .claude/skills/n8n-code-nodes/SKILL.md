---
name: n8n-code-nodes
description: Hausstil für n8n in ZollPilot - was in den Workflow gehört und was in src/, wie der Code-Node aus src/ gebündelt wird, Namensregeln für bündelbare Module, Node-Konventionen, Fehlerpfad, Geheimnisse. Nutze diesen Skill immer, wenn ein Workflow unter workflows/ angelegt oder geändert wird, wenn src/ um ein Modul wächst, wenn compose.yml oder der Import betroffen sind, und bei jeder Frage, ob etwas in n8n oder in src/ gebaut werden soll.
---

# n8n in ZollPilot

## Die Grenze

**n8n orchestriert, `src/` entscheidet** (ADR-004). Im Workflow steht
Transport: auslösen, ablegen, verzweigen, antworten, benachrichtigen. Jede
Fachentscheidung — ob eine Akte freigabereif ist, welche Regel verletzt ist,
wer nachliefern muss — steht in `src/` und hat einen Test.

Die Probe: *Könnte diese Zeile falsch sein, ohne dass ein Test rot wird?*
Wenn ja, gehört sie nach `src/`.

Was im Workflow erlaubt ist: Umformen von Ergebnissen in Items (je
Nachforderung ein Item), Ausdrücke für Spaltenzuordnung, Verzweigung auf
einen Statuswert. Was nicht: Schwellen, Vergleiche von Belegwerten,
Zeichenkettenlogik über Fachfelder.

## Der gebündelte Code-Node

`scripts/n8n-bundle.mjs` erzeugt den Node „Akte prüfen“ aus `src/` und dem
Katalog. Regeln für Module, die gebündelt werden:

- **Imports nur aus Geschwistermodulen**, keine npm-Pakete, kein `node:fs`.
  Die YAML-Bibliothek lebt allein in `src/katalog.mjs`, das nicht gebündelt
  wird.
- **Global eindeutige Namen.** Nach dem Bündeln teilen alle Module einen
  Geltungsbereich. `MODUL` in zwei Validatoren war die erste Kollision.
  Konstanten mit Kontext benennen: `MODUL_ISO6346`, `MODUL_AWB`.
- **Nur `export const`, `export function`, einzeilige Imports.** Der Bündler
  ist ein Regex-Parser und kennt genau diese Formen. Kein `export default`,
  kein mehrzeiliger Import.
- **Neues Modul → in die Liste `MODULE` im Bündler**, in
  Abhängigkeitsreihenfolge. Sonst fehlt es im Node, und der Workflow-Check
  meldet erst beim Parsen, dass eine Funktion nicht definiert ist.

Nach jeder Änderung an `src/` oder den YAML-Dateien: `npm run bundle`. Der
Hook und die CI prüfen mit `--check`, ob das passiert ist.

Der Einstieg im Node: `$input.first().json.body ?? $input.first().json` —
der Webhook liefert `{headers, params, query, body}`, ein anderer Vorgänger
liefert die Akte direkt.

## Node-Konventionen

- **Namen auf Deutsch, als Handlung oder Frage:** „Akte prüfen“, „Ergebnis
  speichern“, „Freigabereif?“, „Antwort: freigegeben“. Der Name ist die
  Adresse in Ausdrücken (`$('Akte prüfen').first().json`); Umbenennen bricht
  Ausdrücke.
- **Feste IDs im Workflow-JSON** (`"id": "zollpilot-akte-pruefen"`), damit
  der Import ersetzt statt dupliziert und `errorWorkflow` darauf zeigen kann.
- **`notes` am Node**, wenn etwas nicht offensichtlich ist — warum ein Node
  deaktiviert ist, warum `onError: continueRegularOutput`.
- **Eine Sticky Note je Workflow**, die sagt, wo die Entscheidung liegt.
- **Deaktivieren statt löschen**, wenn ein Node im Zielsystem gebraucht wird,
  im Demo aber nicht laufen kann (E-Mail ohne SMTP). Mit `notes`, warum.
- **Antwortcodes:** 200 freigabereif, 422 alles andere — in beiden Fällen
  das vollständige Ergebnis im Body. Der Aufrufer soll nicht raten.

## Fehlerpfad

Jeder Workflow trägt `settings.errorWorkflow: "zollpilot-fehler"`. Der
Fehler-Workflow reduziert das Fehlerobjekt auf Workflow, Ausführung, Node,
Meldung und schreibt es nach `workflow_fehler` — **ohne Aktendaten**
(`docs/DATENSCHUTZ.md`).

Der Fehler-Workflow wird **nicht aktiviert**. Ein Error Trigger startet über
die Einstellung der anderen Workflows; n8n verweigert die Aktivierung eines
Workflows ohne Trigger-Node. `compose.yml` aktiviert deshalb gezielt nur den
Prüf-Workflow.

Ablage-Nodes bekommen `onError: continueRegularOutput`: Die Antwort an den
Aufrufer ist wichtiger als die Ablage; der Fehler landet trotzdem in der
Tabelle.

## Import und Betrieb

Der Import läuft im Stack (`n8n-import` in `compose.yml`): Credentials, dann
Workflows, dann Aktivierung per `n8n update:workflow --id=... --active=true`.
Der Import deaktiviert jeden Workflow („Remember to activate later“); ohne
den dritten Schritt antwortet der Webhook mit 404. Aktivierung greift nur,
wenn n8n danach startet — deshalb `depends_on` mit
`service_completed_successfully`.

Geheimnisse: nie in Node-Parametern. `scripts/workflow-check.mjs` sucht
danach. Credentials kommen aus `deploy/n8n/credentials.json` (Demo-Werte)
beziehungsweise aus einem Secret-Store.

## Was sich ohne n8n prüfen lässt

`scripts/workflow-check.mjs`: JSON, Pflichtfelder je Node, eindeutige
Namen, Verbindungen, keine Geheimnisse, Code-Nodes parsen. Was es nicht
prüft: ob n8n den Node-Typ in dieser Version kennt. Das prüft der Import im
CI-Job `betrieb`, und `scripts/rauchtest.sh` prüft, ob die Entscheidung über
den Webhook dieselbe ist wie im Test.
