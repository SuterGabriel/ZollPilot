# Prozesslandschaft und Datenfluss

Drei Artefakte, die das Anforderungsprofil beim Namen nennt: eine
Prozesslandschaft, ein Datenflussdiagramm, ein Betriebshandbuch. Die ersten
beiden stehen hier, das dritte ist [BETRIEB.md](../BETRIEB.md) mit einem
Runbook je Alarm.

Daneben liegen zwei Seiten, die dasselbe von der technischen Seite zeigen:
[systemlandschaft.md](systemlandschaft.md) mit Containern, Ports und
Datenwegen, und [workflows.md](workflows.md) mit allen sieben Workflows als
Bild aus dem laufenden Editor. Die Prozesssicht sagt, wer was tut; die
beiden sagen, worauf es läuft.

Die Diagramme zeigen den **Zielprozess** aus
[05-prozess-nachforderung.md](../05-prozess-nachforderung.md). Die Regel
dieses Repos gilt auch hier: Was noch nicht existiert, stünde als vorgesehen
mit Status da, nicht weggelassen und nicht behauptet. Heute ist jede Linie
der Landschaft gebaut und im Rauchtest bewiesen; die Tabelle unter dem Bild
nennt je Linie die Runde. Einzig der Mailversand im Alarm-Workflow ist
abgeschaltet, weil es in der Entwicklung niemanden zu wecken gibt.

Die Bilder auf dieser Seite sind aus Quelldateien gezeichnet, nicht von Hand:
die Prozesslandschaft aus [sendungsakte.bpmn](sendungsakte.bpmn) (BPMN 2.0,
zum Öffnen in Camunda Modeler oder bpmn.io), der Datenfluss aus
[datenfluss.dot](datenfluss.dot) (Graphviz). `node scripts/diagramme-zeichnen.mjs`
zeichnet sie nach `docs/bilder/`, und `npm run check` schlägt an, wenn ein Bild
nicht mehr zu seiner Quelle passt. Wer etwas ändern will, ändert die Quelle.

## Prozesslandschaft

Fünf Rollen, eine Akte. Die Sachbearbeitung Export ist der Einstieg; eine
Antwort per E-Mail findet ihre Akte über das Aktenzeichen und läuft denselben
Weg noch einmal.

![Prozesslandschaft als BPMN: fünf Bahnen für Lieferant, Spediteur, Sachbearbeitung Export, ZollPilot und Zoll; von der angelegten Sendung über Lesen, Akte bauen und die Frage freigabereif zur Ausfuhranmeldung oder zur Nachforderung mit Erinnerung, Versand und Antwort](../bilder/prozesslandschaft.svg)

Was die Linien bedeuten:

| Linie | Stand | Beleg |
|---|---|---|
| Belege einreichen, lesen, Akte bauen, prüfen, Ergebnis lesen | gebaut | `scripts/rauchtest.sh`, Runden 1 bis 3 |
| Übersteuern | gebaut | Runde 4, ADR-007 |
| Nachforderung formulieren | gebaut | `src/nachforderung.mjs`; der Text steht im Ergebnis und in der Oberfläche |
| ABD zurück an die Akte | gebaut | Belegtyp ABD, Regel CUS-05, Pflicht PFL-07 |
| E-Mail als Eingang, Antwort der Akte zuordnen | gebaut | Runde 9, ADR-010: Aktennummer aus Betreff oder Text, Anhänge extrahiert, an die abgelegte Akte gehängt, erneut geprüft; ohne Nummer steht die Mail in `mail_eingang` |
| Nachforderung versenden, Erinnerung, Eskalation | gebaut | Runde 8, ADR-009: Fälle in `request_case`, Stufen relativ zu den Cut-offs der Akte, Versand an das Postfach, festgehalten in `request_versand` |

## Datenfluss

Von der Datei zur Entscheidung, und von der Entscheidung zu denen, die
hinsehen. Das Monitoring ist Zuschauer: Kein Pfeil führt von dort zurück
in die Akte.

![Datenfluss: vier Eingänge oben, n8n als Orchestrierung, die Extraktion als Spalte links, der Code-Node und darunter die Entscheidungskette aus src/, dann Postgres, Oberfläche, Nachforderung und Postfach; das Monitoring hängt unten an Postgres und hat keinen Pfeil zurück](../bilder/datenfluss.svg)

Drei Zusagen, die das Bild zeigt:

- **Ein Modell steht nie rechts von der Extraktion.** Die Assertions
  tragen Konfidenz; alles danach ist deterministisch (ADR-003).
- **Der Code-Node ist ein Build-Artefakt.** Was in `src/` steht, steht im
  Node, und `scripts/n8n-bundle.mjs --check` hält das (ADR-004).
- **Das Monitoring liest, es schreibt nicht in die Akte.** Der einzige
  Rückweg ist der Alarm als Zeile in `alarm`, und die liest niemand
  automatisch.

## Betriebshandbuch

[BETRIEB.md](../BETRIEB.md): was läuft, ein Befehl, wo etwas steht, elf
Alarme mit Prüfen und Handgriff, was Support tun kann, Geheimnisse, und
was vor einem echten Betrieb fehlt.

## Was diese Diagramme nicht sind

Kein Ist-Prozess eines Kunden. Die Rollen und Auslöser stammen aus der
Recherche in `docs/05`, nicht aus einer Aufnahme vor Ort. Welche Ebene die
Akte hat (Bestellung, Rechnung, Container, MRN) und wer bei Konflikten
gewinnt, sind offene Fragen an den Auftraggeber (`PROJECT.md`, Abschnitt
11). Ein Diagramm, das das schon wüsste, würde raten.
