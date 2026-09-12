# ADR-004: n8n orchestriert, `src/` entscheidet — der Code-Node ist ein Build-Artefakt

- **Status:** angenommen
- **Datum:** 2026-09-12
- **Stufe:** 1

## Kontext

Die Ausschreibung verlangt produktive n8n-Workflows. n8n ist gut in dem, was
es tut: Auslöser, Verzweigungen, Anbindungen, Wiederholungen, eine
Ausführungsliste, die jemand ansehen kann. Es ist schlecht in dem, was das
Regelwerk braucht: Module, Tests, Versionierung von Logik, Review von
Änderungen als Diff.

Der übliche Weg ist, die Logik in Code-Nodes zu schreiben. Dann lebt sie in
einem JSON-Export, ist nicht testbar außerhalb von n8n, und jede Änderung ist
ein Klick in einer Oberfläche, den niemand reviewt. Zwei Workflows mit
derselben Prüfung haben nach drei Monaten zwei Prüfungen.

Der Code-Node hat außerdem harte Grenzen: kein Dateisystem, keine Module,
externe Pakete nur über eine Umgebungsvariable, die der Betrieb setzen muss.

## Optionen

**1. Logik direkt in Code-Nodes, der Workflow ist die Quelle.**
Alles an einem Ort, in der Oberfläche änderbar, kein Build. Für einen
Workflow mit zwanzig Zeilen Logik die richtige Wahl. Bei dreizehn Regeln,
einer Pflichtmatrix und einem Konfidenzpfad ist der Node ein tausendzeiliges
Textfeld ohne Tests.

**2. Eigenes n8n-Node-Paket (Community Node).**
Ein `n8n-nodes-zollpilot`, installiert im n8n. Sauber, typisiert, mit
eigener Oberfläche im Node. Aber ein npm-Paket mit Build, Veröffentlichung
oder privatem Registry, Installation im Container, Kompatibilität mit
n8n-Versionen — für ein PoC ist das Infrastruktur, die mehr wiegt als die
Fachlogik.

**3. Externer Dienst, n8n ruft ihn per HTTP.**
`src/` läuft als eigener Prozess mit einem Endpunkt; n8n schickt die Akte und
bekommt das Ergebnis. Die klarste Trennung, und der Dienst ist auch ohne n8n
nutzbar. Der Preis: ein zweiter Dienst mit eigenem Betrieb, Deployment,
Healthcheck und Netzwerk. Und die Frage, warum dann überhaupt n8n.

**4. `src/` wird in den Code-Node gebündelt, der Workflow ist ein Artefakt.**
Ein Skript nimmt die ES-Module aus `src/`, entfernt Import und Export, hängt
den Katalog als JSON davor und schreibt das Ergebnis in den Node „Akte
prüfen“. Quelle der Wahrheit bleibt `src/` mit seinen Tests; der Workflow im
Repo ist ein erzeugter Stand, damit ein Import ohne Build geht.

## Entscheidung

**Option 4**, für den Prototyp. Erkennbar an:

- `scripts/n8n-bundle.mjs`: Modulliste in Abhängigkeitsreihenfolge,
  `entmodularisiere()`, Katalog als `const KATALOG = {...}`, Einstieg
  `$input.first().json.body ?? $input.first().json`.
- `npm run bundle:check` im Hook und in der CI: Ist der Node veraltet, ist
  der Lauf rot. Der Workflow kann nicht stillschweigend hinter `src/`
  zurückfallen.
- `tests/` laufen gegen `src/`, der Rauchtest (`scripts/rauchtest.sh`) gegen
  den gebündelten Node im laufenden n8n. Beide müssen dieselbe Entscheidung
  liefern; die Testakten tragen ihre Erwartung selbst.
- Alles außer dem Node „Akte prüfen“ ist Transport: Webhook, Postgres,
  Verzweigung, Antwort. Die Notiz im Workflow sagt das.

Damit das Bündeln trivial bleibt, gelten für `src/` zwei Regeln: Imports nur
aus Geschwistermodulen, keine npm-Abhängigkeit (die YAML-Bibliothek lebt
allein in `src/katalog.mjs`, das nicht gebündelt wird); und global eindeutige
Namen, weil alle Module nach dem Bündeln einen Geltungsbereich teilen.
Die erste Kollision (`MODUL` in zwei Validatoren) fiel beim ersten Bündeln
auf.

## Konsequenzen

**Positiv**

- Eine Prüfung, drei Aufrufwege: Test, CLI, Workflow. Gleicher Code.
- Änderungen an Regeln sind Diffs in `src/` und `rules.yaml`, reviewbar,
  mit Test. Der Workflow-Diff ist erzeugt und interessiert niemanden.
- Kein zweiter Dienst, kein Paket, keine Umgebungsvariable für externe
  Module. `docker compose up` reicht.

**Negativ**

- **Der Workflow ist 57 Kilobyte in einem Textfeld.** Wer ihn in der
  n8n-Oberfläche öffnet, sieht einen Node, den er nicht bearbeiten soll. Die
  Notiz sagt es; verhindern kann sie es nicht. Eine Änderung in der
  Oberfläche wird beim nächsten `bundle` überschrieben — und das ist
  Absicht, aber es überrascht.
- **Der Katalog ist eingebettet.** „Regeln ohne Deployment“ (ADR-002) gilt
  für den Workflow nicht: Eine Schwellenänderung braucht `bundle` und
  Import. Der Weg heraus ist ein Katalog in Postgres oder per HTTP, den der
  Node zur Laufzeit lädt.
- **Der Bündler ist ein eigener Regex-Parser** für Import und Export. Er
  kennt genau die Formen, die `src/` benutzt. Ein mehrzeiliger Import oder
  ein `export default` bricht ihn — sichtbar, weil der Node dann nicht parst
  (`scripts/workflow-check.mjs`), aber trotzdem.
- **Keine npm-Pakete in der Fachlogik.** Wer eine Bibliothek für
  Währungsumrechnung oder UN/LOCODE braucht, muss sie selbst schreiben oder
  Option 2 oder 3 wählen.

## Wann wir anders entscheiden würden

- **Wenn ein zweiter Verbraucher käme** — ein DMS, ein Portal, ein
  Batch-Lauf — der die Prüfung ohne n8n braucht. Dann Option 3, und n8n wird
  ein Aufrufer unter mehreren.
- **Wenn das Bundle Abhängigkeiten bräuchte** oder die Nodegröße zum
  Problem würde. Dann Option 2, mit dem Paket als Build-Ziel derselben
  `src/`.
- **Wenn der Katalog täglich wechselte.** Dann ist das Einbetten der Engpass,
  und der Node lädt den Katalog zur Laufzeit — die Bündelung von `src/`
  bliebe.
- **Wenn das Team n8n als Quelle wollte.** Es gibt Organisationen, in denen
  die Oberfläche der Ort ist, an dem Fachleute Regeln pflegen. Dann ist
  Option 1 richtig, und die Antwort auf „wie testen wir das“ ist eine andere
  ADR.
