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

## Der zweite Eingang: Belege

`POST /webhook/belege` (Multipart: Formularfeld `akte` mit den Stammdaten
als JSON, dazu PDFs; oder JSON mit `dateien[]`, so wiederholt die
Wiedervorlage) → Code-Node „Belege verpacken“ → eigener Node „Belege
extrahieren“ (`CUSTOM.zollPilotExtraktion` aus `nodes/n8n-nodes-zollpilot/`,
Adresse in der Credential „ZollPilot Extraktion“, Dienst aus `compose.yml`,
ADR-005) → derselbe Node „Akte prüfen“. Regeln dafür:

- **Der Code-Node vor dem Dienst ist Transport.** Er wandelt Binärdaten in
  das JSON des Dienstes (`{akte, dateien: [{name, inhalt_base64}]}`). Welche
  Datei welcher Beleg ist, entscheidet der Dienst, nicht der Node.
- **HTTP-Request-Nodes und eigene Nodes nur für Dienste, die etwas
  *liefern*** — Extraktion, Lookups (Stufe 2). Nie für eine Entscheidung:
  Die kommt aus dem Bundle.
- **Der eigene Node trägt keinen Fachparameter.** Quelle der Belege,
  Stammdatenfeld, Zeitlimit: Transport. Belegtyp oder Konfidenzschwelle
  wären Fachlogik im Workflow ohne Test; der Node-Test lehnt solche
  Parameter ab. Adresse und Token stehen in der Credential
  (`deploy/n8n/credentials.json`), nie im Workflow.
- **Der eigene Node importiert `n8n-workflow` nur als Typ.** Im
  Erweiterungsverzeichnis (`N8N_CUSTOM_EXTENSIONS`) löst `require` das
  Paket nicht auf; ein Test prüft `dist/` darauf. `dist/` wird committet
  wie der Code-Node, die CI baut nach und vergleicht.
- **`await` ist im Code-Node erlaubt** (n8n führt ihn als async-Funktion
  aus); `scripts/workflow-check.mjs` parst entsprechend. Binärdaten über
  `this.helpers.getBinaryDataBuffer(index, schluessel)` lesen, nicht über
  `.data` — das ist im Task-Runner-Modus nicht garantiert Base64.
- **Ein Ausfall des Dienstes ist ein sichtbarer Fehler** (500,
  `workflow_fehler`), keine leere Akte. Kein `continueOnFail` an diesem Node.

## Vorgänger im Code-Node lesen

Drei Eigenheiten, die jede eine Sitzung gekostet haben (Entwicklungslog,
12.09.2026, Monitoring):

- **`$('Node').first()` wirft nicht, wenn der Node nicht gelaufen ist.** Es
  gibt `undefined` zurück; `.json` darauf ist der Absturz. Jeden Zugriff auf
  einen Vorgänger, der nicht sicher gelaufen ist, abfangen.
- **`isExecuted` gibt es nur in Ausdrücken.** Im Code-Node darauf zu bauen,
  liefert stillschweigend das Falsche. Ob ein Node lief, sagt der
  abgefangene Zugriff auf seine Ausgabe.
- **Fehlerausgang ist Ausgang 1.** Ein Node mit `continueErrorOutput`, dessen
  Fehlerzweig genommen wurde, hat seine Daten unter `.first(1)`, nicht unter
  `.first()`. Wer beide Fälle braucht, liest beide Ausgänge.

Das Muster steht im Node „Wiedervorlage vorbereiten“ des Prüf-Workflows:
eine Funktion `ausgabe(name)`, die Ausgang 0 und 1 versucht und sonst `null`
liefert.

## Wiedervorlage und Alarm

Der Fehlerzweig legt neben `workflow_fehler` eine Zeile in `wiedervorlage`
ab: Eingang und Rumpf, damit `zollpilot-wiederholen` den Lauf über denselben
Webhook wiederholen kann. Dafür nimmt „Belege verpacken“ auch JSON mit
`dateien[]` entgegen, nicht nur Multipart. `zollpilot-alarm` nimmt den
Alertmanager entgegen und schreibt nach `alarm`. Beide Workflows entscheiden
nichts; `compose.yml` aktiviert sie beim Import.

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
