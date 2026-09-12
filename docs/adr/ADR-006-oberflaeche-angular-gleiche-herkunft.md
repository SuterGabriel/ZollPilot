# ADR-006: Die Eingabe bekommt eine Oberfläche — Angular mit ngrx, gleiche Herkunft über einen Proxy

- **Status:** angenommen
- **Datum:** 2026-09-12
- **Stufe:** 4

## Kontext

Nach Stufe 3 kann das System aus PDFs eine Entscheidung machen. Der Weg
dorthin ist `curl` mit drei `-F`-Argumenten oder `scripts/rauchtest.sh`. Wer
das System vorführt, zeigt eine Kommandozeile — und wer es benutzen soll,
die Sachbearbeitung Export aus `docs/PRODUKT.md`, kann es nicht.

`docs/PRODUKT.md` führte „keine Oberfläche“ bisher als bewusste Grenze, mit
einem guten Grund: Unklar ist, **wer die Akte führt** (PO, Rechnung,
Container oder MRN — offene Frage 2). Dieser Grund trägt weiter für den
Review-Arbeitsplatz, der Befunde korrigiert und übersteuert: Der braucht ein
Aktenobjekt mit Identität über die Zeit. Er trägt **nicht** für die Eingabe.
Belege einreichen und die Entscheidung lesen ist ein Vorgang ohne Gedächtnis:
Stammdaten eintragen, PDFs ablegen, absenden, Ergebnis lesen. Die Frage, auf
welcher Ebene die Akte geführt wird, stellt sich dabei nicht.

Zwei Fragen sind zu entscheiden, bevor eine Zeile entsteht.

**Wie kommt der Browser an n8n?** Der Prüf-Workflow antwortet auf
`POST /webhook/belege`. Ein Browser, der von einer anderen Herkunft kommt,
braucht CORS. Im ausgelieferten Webhook-Node von n8n 1.114.0 gibt es
dafür nichts: keine Option `allowedOrigins`, kein
`Access-Control-Allow-Origin` im gesamten Node-Verzeichnis (nachgesehen im
laufenden Container, nicht in der Dokumentation).

**Welche Zustandsverwaltung?** Das Anforderungsprofil verlangt sie nicht; das Ziel
ist, dass die Oberfläche die Trennung des Systems nicht aufweicht. Sie darf
nichts entscheiden — kein Schwellenwert, keine Regel, keine Bewertung eines
Befundes im Browser.

## Optionen

**Anbindung 1 — Browser direkt an n8n, CORS am Webhook.**
Kein zusätzlicher Dienst, die Oberfläche wäre eine reine Datei-Sammlung, die
man irgendwo ablegt. Scheitert an n8n selbst: Der Webhook-Node kennt die
Option nicht. Man müsste n8n hinter einen Proxy stellen, der die Kopfzeilen
ergänzt — dann hat man den Proxy, aber auch noch CORS. Und der Browser
kennte die Adresse von n8n, das man in einem echten Betrieb nie
veröffentlichen würde.

**Anbindung 2 — Proxy nur im Angular-Dev-Server.**
`ng serve` kann `/webhook` weiterleiten, das ist eine Zeile. Für die
Entwicklung die richtige Antwort, und sie kostet nichts. Sie beantwortet aber
nicht, was im Stack passiert: Dort läge die gebaute App irgendwo, und die
Frage käme unverändert zurück. Ein Prototyp, der nur im Dev-Server läuft,
belegt den Betrieb nicht.

**Anbindung 3 — ein nginx, der die App ausliefert und `/webhook/` weiterreicht.**
Gleiche Herkunft, damit kein CORS, kein Preflight, keine Option im Workflow.
Der Browser erfährt die Adresse von n8n nie. Der Preis: ein fünfter
Container und eine Konfigurationsdatei, die niemand testet, bis sie kaputt
ist.

**Zustand 1 — Signals im Komponenten-Store.**
Angular 22 ist zonenlos, Signals sind der Normalfall. Für ein Formular mit
einer Dateiliste und einem Ergebnis reicht das vollständig und ist deutlich
weniger Code. Ehrlich betrachtet die angemessene Wahl für genau diesen
Bildschirm.

**Zustand 2 — ngrx Store und Effects.**
Mehr Gerüst: Aktionen, Reducer, Selektoren, ein Effect für das Absenden.
Dafür ist der Ablauf als Zustandsmaschine sichtbar (`bereit`, `laeuft`,
`fertig`, `fehler`), das Absenden ist ein Effect mit drei Ausgängen statt
eines `subscribe` in der Komponente, und der Zustand ist ohne Oberfläche
testbar.

**Zustand 3 — nur HttpClient, Zustand in der Komponente.**
Am wenigsten Code. Vermischt Transport, Zustand und Darstellung in einer
Klasse; der erste Zusatzfall (zweiter Bildschirm, Wiederholung nach Fehler)
bricht sie auf.

## Entscheidung

**Anbindung 3 und Zustand 2.** Erkennbar an:

- `oberflaeche/` — Angular 22, zonenlos, Signals für die Sicht, ngrx für die
  Fachdaten. `oberflaeche/src/app/akte/` trägt Aktionen, Reducer, Selektoren
  und den Effect; die Komponenten lesen ausschließlich über Selektoren.
- **Die Oberfläche entscheidet nichts.** Sie kennt keinen Schwellenwert und
  keine Regel. Was sie anzeigt, steht im Ergebnis, das der Webhook liefert:
  `freigabe`, `befunde[]` mit `begruendung` und `rechtsquelle_status`,
  `pflichtmatrix.befunde[]`, `nachforderungen[]`, `extraktion.hinweise[]`.
  Die einzige Bedingung im Browser ist, ob das Formular abgeschickt werden
  darf — und die ist Pflichtfeld-Logik, keine Fachregel.
- `deploy/nginx/zollpilot.conf`, Dienst `oberflaeche` in `compose.yml`:
  statische Dateien unter `/`, `location /webhook/` an `n8n:5678`.
  Der Browser spricht nur mit `localhost:8088`.
- Barrierefreiheit als Bedingung, nicht als Absicht
  (`docs/ARBEITSWEISE.md`, Stufe 2): Gestaltungstoken mit dem
  Kontrastverhältnis als Kommentar neben der Farbe,
  `scripts/kontrast-check.mjs` rechnet sie nach, und
  `oberflaeche/e2e/` prüft jede Ansicht mit axe.

Zu ngrx, offen gesagt: Für diesen einen Bildschirm wäre Zustand 1 die
sparsamere Wahl, und das bleibt wahr. Die Entscheidung fällt für ngrx, weil
drei Dinge zusammenkommen — die Belegliste ist eine Sammlung mit Hinzufügen
und Entfernen, das Absenden ist ein asynchroner Vorgang mit drei Ausgängen,
und der Review-Arbeitsplatz (Stufe 5) bringt Übersteuerung, Nachextraktion
und mehrere Ansichten auf denselben Daten. Wer das später nachrüstet, baut
den Zustand um; wer es jetzt setzt, nicht.

## Konsequenzen

**Positiv**

- Das System ist ohne Kommandozeile vorführbar: Stammdaten, drei PDFs, ein
  Klick, und die Entscheidung steht mit Begründung je Regel und den
  Nachforderungen samt Adressat da.
- Die Trennung bleibt sichtbar, weil die Oberfläche sie nicht brechen kann:
  Sie hat keinen Katalog. Ein Befund, den sie zeigt, ist der Befund aus
  `src/regeln/`, mit Regelversion und Verifikationsstand der Rechtsgrundlage.
- Gleiche Herkunft heißt: kein CORS, keine Preflight-Anfragen, keine Option
  im Workflow, die eine Frontend-Sorge in die Orchestrierung trägt.
- Der Zustand ist ohne Browser testbar. Reducer und Selektoren sind reine
  Funktionen, der Effect wird mit einem gefälschten HttpClient geprüft.

**Negativ**

- **ngrx ist mehr Gerüst, als dieser Bildschirm braucht.** Vier Dateien und
  ein Effect für ein Formular. Das ist eine Wette auf Stufe 5; geht die nicht
  auf, bleibt Aufwand ohne Gegenwert stehen.
- **Ein fünfter Container, und eine nginx-Konfiguration ohne eigenen Test.**
  Der Rauchtest prüft, dass die Oberfläche ausgeliefert wird und der Proxy
  eine Akte durchreicht — mehr nicht. Kopfzeilengrößen, Zeitüberschreitungen
  und Obergrenzen für Dateigrößen fallen erst im Betrieb auf.
- **Keine Anmeldung.** Wer den Port erreicht, kann Akten einreichen. Das
  gilt schon für den Webhook (`docs/BETRIEB.md`), aber eine Oberfläche macht
  es einladend. Vor jedem Betrieb außerhalb der eigenen Maschine ist das ein
  Blocker, kein Schönheitsfehler.
- **Die PDFs liegen im Arbeitsspeicher des Browsers**, gehen als Multipart
  an nginx, von dort an n8n, und dort als Base64 weiter an die Extraktion.
  Drei Kopien derselben Datei. Für Dutzende Akten am Tag trägt das; für
  Stapel mit hundert Seiten nicht.
- **Die Oberfläche zeigt einen Vorgang, keine Akte.** Nach dem Absenden ist
  das Ergebnis da; ein zweiter Beleg zur selben Sendung beginnt einen neuen
  Vorgang, weil es keine Aktenidentität gibt. Genau die offene Frage 2 —
  sie ist nicht gelöst, nur umgangen.

## Wann wir anders entscheiden würden

- **Wenn die Oberfläche in ein bestehendes Portal käme.** Dann liefert nicht
  nginx die Dateien aus, und die gleiche Herkunft muss dort hergestellt
  werden — die Entscheidung „kein CORS im Workflow“ bliebe, ihre Umsetzung
  nicht.
- **Wenn es bei diesem einen Bildschirm bliebe.** Käme Stufe 5 nicht, wäre
  ngrx nachträglich falsch, und der Zustand gehörte in Signals. Das ist in
  einem halben Tag rückgängig zu machen, solange die Komponenten nur über
  Selektoren lesen — deshalb lesen sie nur über Selektoren.
- **Wenn die Akte live mitlaufen müsste.** Mehrere Belege über Tage, Stand
  serverseitig: Dann ist das Formular der falsche Rahmen, und es braucht
  eine Aktenansicht mit Abgleich statt eines Vorgangs.
- **Wenn ein Mandant oder eine Anmeldung dazukommt.** Dann ist die Frage
  nicht mehr, wie der Browser an n8n kommt, sondern wer er ist — und das
  ist eine eigene ADR vor dieser.
