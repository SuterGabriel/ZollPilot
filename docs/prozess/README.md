# Prozesslandschaft und Datenfluss

Drei Artefakte, die eine Ausschreibung wörtlich verlangt: eine
Prozesslandschaft, ein Datenflussdiagramm, ein Betriebshandbuch. Die ersten
beiden stehen hier, das dritte ist [BETRIEB.md](../BETRIEB.md) mit einem
Runbook je Alarm.

Die Diagramme zeigen den **Zielprozess** aus
[05-prozess-nachforderung.md](../05-prozess-nachforderung.md) und markieren,
was davon gebaut ist. Das ist die Regel dieses Repos: Was noch nicht
existiert, steht als Ziel mit Status da, nicht weggelassen und nicht
behauptet. Gestrichelt ist vorgesehen, durchgezogen ist gebaut und im
Rauchtest bewiesen.

Dieselbe Prozesslandschaft liegt als BPMN 2.0 in
[sendungsakte.bpmn](sendungsakte.bpmn), mit Pool, Rollen als Lanes und
Layout, zum Öffnen in Camunda Modeler oder bpmn.io. Erzeugt aus einer
Beschreibung des Prozesses, nicht gezeichnet; Änderungen gehören in die
Beschreibung.

## Prozesslandschaft

Fünf Rollen, eine Akte. Die Sachbearbeitung Export ist heute der Einstieg;
der Zielprozess beginnt beim Postfach.

```mermaid
flowchart LR
  classDef ziel stroke-dasharray: 6 4,fill:#f2f4f7,color:#545b64
  classDef entscheidung fill:#fff,stroke:#1d4ed8,stroke-width:2px

  subgraph Lieferant["Lieferant / Verkäufer"]
    L1[Rechnung und Packliste ausstellen]
    L2[Präferenznachweis beibringen]
    L3[Fehlenden Wert nachliefern]
  end

  subgraph Spediteur["Spediteur / Carrier"]
    S1[B/L ausstellen: Entwurf, dann final]
  end

  subgraph Sach["Sachbearbeitung Export"]
    M1[E-Mail mit Anhängen]:::ziel
    A1[Stammdaten angeben, Belege einreichen]
    A2{Ergebnis lesen}
    A3[Übersteuern mit Name und Begründung]
    A4[Nachforderung versenden]
  end

  subgraph ZP["ZollPilot"]
    Z1[Lesen: Textlayer oder OCR, Klassifikation, Felder]
    Z2[Akte bauen: nur finale Belege werden Fakten]
    Z3[Pflichtmatrix und Regeln, hart vor weich]:::entscheidung
    Z4[Nachforderung formulieren: Feld, Grund, Adressat]
    Z5[Erinnerung und Eskalation vor Cut-off]
    Z6[Antwort der Akte zuordnen]:::ziel
  end

  subgraph Zoll["Zollvertreter / Zollverwaltung"]
    C1[Ausfuhranmeldung, ABD mit MRN]
  end

  L1 --> A1
  L2 --> A1
  S1 --> A1
  M1 -.-> Z1
  A1 --> Z1 --> Z2 --> Z3 --> A2
  A2 -->|freigabereif| C1
  C1 -->|ABD zurück an die Akte| A1
  A2 -->|nicht freigabereif| Z4
  Z4 --> Z5 --> A4
  A4 --> L3
  L3 -.-> Z6 -.-> Z1
  L3 --> A1
  A2 -->|Befund bleibt verletzt, Verantwortung daneben| A3 --> Z3
```

Was die Linien bedeuten:

| Linie | Stand | Beleg |
|---|---|---|
| Belege einreichen, lesen, Akte bauen, prüfen, Ergebnis lesen | gebaut | `scripts/rauchtest.sh`, Runden 1 bis 3 |
| Übersteuern | gebaut | Runde 4, ADR-007 |
| Nachforderung formulieren | gebaut | `src/nachforderung.mjs`; der Text steht im Ergebnis und in der Oberfläche |
| ABD zurück an die Akte | gebaut auf dem Branch `extraktion` | Belegtyp ABD, Regel CUS-05, Pflicht PFL-07 |
| E-Mail als Eingang | vorgesehen | `docs/OFFENE-PUNKTE.md`, „Kein Mail-Intake“ |
| Nachforderung versenden, Erinnerung, Eskalation | gebaut | Runde 8, ADR-009: Fälle in `request_case`, Stufen relativ zu den Cut-offs der Akte, Versand an das Postfach, festgehalten in `request_versand` |
| Antwort der Akte zuordnen | vorgesehen | der Rückweg aus `docs/OFFENE-PUNKTE.md` |

## Datenfluss

Von der Datei zur Entscheidung, und von der Entscheidung zu denen, die
hinsehen. Das Monitoring ist Zuschauer: Kein Pfeil führt von dort zurück
in die Akte.

```mermaid
flowchart TB
  classDef speicher fill:#f2f4f7,stroke:#545b64
  classDef ziel stroke-dasharray: 6 4,fill:#f2f4f7,color:#545b64
  classDef entscheidung fill:#fff,stroke:#1d4ed8,stroke-width:2px

  PDF[Belege als PDF]
  VOR[Akte als JSON von einem Vorsystem]
  BR[Browser]

  subgraph n8n["n8n: orchestriert, entscheidet nichts"]
    W2[/webhook/belege/]
    W1[/webhook/akte/]
    EN[eigener Node: Belege extrahieren]
    CN[Code-Node: Bundle aus src/ und Katalog]:::entscheidung
    WF[Fehlerzweig: workflow_fehler, wiedervorlage]
    WW[/webhook/wiederholen/]
    WA[/webhook/alarm/]
    MAIL[E-Mail-Node, deaktiviert]:::ziel
  end

  subgraph EX["extraktion/: liest und behauptet"]
    E1[Textlayer mit Koordinaten, sonst Tesseract mit Wortkonfidenz]
    E2[Klassifikation, Felder je Belegtyp]
    E3[Assertions: Wert, Rohwert, Seite, Box, Konfidenz, Methode]
  end

  subgraph SRC["src/: entscheidet, deterministisch"]
    K1[aufbau.mjs: Fakten nur aus finalen Belegen]
    K2[pflichtmatrix.yaml: Nachweis statt Dokument]
    K3[rules.yaml, 13 Regeln: hart vor weich, Lesefehler vor Fachfehler]
    K4[override.mjs: verantworten, nicht umentscheiden]
    K5[nachforderung.mjs: Feld, Grund, Adressat aus zustaendigkeiten.yaml]
  end

  PG[(Postgres zollpilot: pruefung, override, wiedervorlage, alarm)]:::speicher
  UI[oberflaeche/ Angular hinter nginx, gleiche Herkunft]

  subgraph MON["Monitoring: Zuschauer"]
    SQ[SQL-Exporter: Freigaben, Befunde je Regel, Fehler, Wiedervorlagen]
    PR[Prometheus: elf Alarmregeln]
    AM[Alertmanager]
    GR[Grafana: Dashboard aus dem Repo]
  end

  BR --> UI --> W2
  PDF --> W2 --> EN --> E1 --> E2 --> E3 --> CN
  VOR --> W1 --> CN
  CN --> K1 --> K2 --> K3 --> K4 --> K5
  K5 -->|Ergebnis: Entscheidung, Befunde, Nachforderungen| PG
  K5 -->|200 / 422| UI
  K5 -.-> MAIL
  EN -.->|Dienst weg| WF
  CN -.->|Absturz| WF
  WF --> PG
  WW -->|Rumpf erneut an denselben Eingang| W2
  PG --> SQ --> PR
  EX -->|/metrics| PR
  n8n -->|/metrics| PR
  PR --> AM --> WA --> PG
  PR --> GR
```

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
