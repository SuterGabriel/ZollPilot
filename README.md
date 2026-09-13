# ZollPilot

Automatisierte Vollständigkeits- und Konsistenzprüfung von Zoll- und
Versanddokumenten. Das System verarbeitet keine Dokumente, sondern führt pro
Sendung eine **Akte**: Belege sind Behauptungen, die Akte hält den geprüften
Zustand. Eine Extraktion in Python liest die Belege und behauptet; n8n
orchestriert; ein deterministisches Regelwerk in JavaScript entscheidet; eine
Oberfläche in Angular zeigt das Ergebnis und entscheidet nichts.

Portfolio-Projekt zu einem Anforderungsprofil (n8n-Workflows für Dokumentenprozesse
in Logistik und Zoll). Das Anforderungsprofil steht in
[docs/ANFORDERUNGEN.md](docs/ANFORDERUNGEN.md), mit Belegspalte und mit den
Punkten, die ein Repo nicht belegen kann.

## Stand

Stand 12. September 2026, Stufen 0 bis 4 des Plans in
[docs/ARBEITSWEISE.md](docs/ARBEITSWEISE.md).

| Was | Stand |
|---|---|
| Sachverhalt | Ausfuhr Drittland, Seefracht FCL, Präferenz beansprucht |
| Regeln | 14 ausführbar in [rules.yaml](rules.yaml), über 40 im Katalog [docs/03](docs/03-regelwerk-vollstaendig.md) |
| Pflichtmatrix | 7 Einträge in [pflichtmatrix.yaml](pflichtmatrix.yaml): Nachweis statt Dokument, darunter die MRN aus dem Ausfuhrbegleitdokument |
| Extraktion (IDP/OCR) | Python-Dienst in [extraktion/](extraktion/): Textlayer mit Koordinaten oder Tesseract mit Wortkonfidenzen, Klassifikation, Felder je Belegtyp (Handelsrechnung, Packliste, B/L, Ursprungserklärung, Ausfuhrbegleitdokument), jede Assertion mit Fundstelle (ADR-005). Eine Rechnung als UN/CEFACT-CII-XML läuft als Beleg ohne Leseunsicherheit durch dieselbe Kette, in beide Richtungen gegen das Schema validiert (ADR-008). Zwei weitere Lesemodule, Google Document AI und Azure Document Intelligence, lesen dieselben 32 Belege aus aufgezeichneten Antworten: je 570 von 570 Feldern und 8 von 8 Entscheidungen, gleichauf mit Tesseract. **Eine Layoutfamilie, synthetische Belege.** Was das heißt: [docs/EXTRAKTION.md](docs/EXTRAKTION.md) |
| Oberfläche | Angular 22 mit ngrx in [oberflaeche/](oberflaeche/): Belege einreichen, Entscheidung mit Begründung je Regel lesen, übersteuern (ADR-006, ADR-007); hinter der Anmeldung des Proxys, mit dem geprüften Namen (ADR-009); dazu die Übersicht aller Akten mit offenen Nachforderungen und unzugeordneter Post ([`docs/entwurf/04-uebersicht.md`](docs/entwurf/04-uebersicht.md)). Kontrast nachgerechnet, axe über jede Ansicht: [docs/OBERFLAECHE.md](docs/OBERFLAECHE.md) |
| Tests | 125 in JavaScript (Prüfziffern gegen Referenzwerte, Grenzfälle je Regel, Konfidenzpfad), 134 in Python (Normalisierung, Klassifikation, Tabellen, CII gegen Schema, Anbieterleser, Ende zu Ende auf den PDFs), 92 + 23 in TypeScript (Zustand, Dienst, Darstellung; axe, Tastatur, kein Rollbalken), 12 für den eigenen n8n-Node |
| Testdaten | 8 synthetische Akten als JSON, dieselben 8 als Belegsätze (PDF, je mit Ausfuhrbegleitdokument) in [testdaten/belege/](testdaten/belege/), erzeugt und byteidentisch reproduzierbar; der schlechte Scan ist ein echtes Bild für Tesseract |
| Messung | Field Exact Match je Belegtyp und Entscheidung je Akte gegen das Golden Set, Basislinie in [extraktion/basislinie.json](extraktion/basislinie.json), als CI-Job |
| n8n | 7 Workflows als Export (Prüfung mit zwei Eingängen, Fehler, Wiederholung, Alarm, Nachforderungen, Posteingang, Übersicht lesen); die Code-Nodes sind aus `src/` gebündelt (ADR-004); ein eigener Node in TypeScript mit Credential-Typ in [nodes/](nodes/n8n-nodes-zollpilot/) ruft die Extraktion, 12 Tests ohne n8n |
| Posteingang | Eine Antwort mit Anhang findet ihre Akte über die Aktennummer (ADR-010): IMAP-Trigger, Extraktion nur der neuen Belege, Zusammenführung mit der abgelegten Akte, erneute Prüfung. Ohne Nummer steht die Mail als unzugeordnet in Postgres. Rauchtest Runde 9 |
| Abgelegte Akte | Jede Prüfung legt Stammdaten, Belege und Assertions in Postgres ab, nur anhängend, je Beleg eindeutig über Kennung und Hash (ADR-010). Die Originale nicht |
| Nachforderung | Ein Vorgang, kein Text (ADR-009): je fehlendem Wert ein Fall mit Stufe und Versanddatum, täglich oder auf Zuruf abgeglichen, Stufen relativ zu den Cut-offs der Akte aus [`zustaendigkeiten.yaml`](zustaendigkeiten.yaml), Versand per SMTP an ein Testpostfach, jeder Versand festgehalten. Rauchtest Runde 8 spielt drei Tage durch |
| Betrieb | `compose.yml` mit zehn Diensten: Postgres, Import, n8n, Extraktionsdienst, nginx, GreenMail, Prometheus, Alertmanager, SQL-Exporter, Grafana ([Systemlandschaft](docs/prozess/systemlandschaft.md)); Rauchtest in neun Runden gegen den laufenden Stack: Akten, PDFs, Oberfläche, Übersteuerung, gescheiterter Lauf, Wiederholung, Monitoring, Nachforderung, Posteingang |
| Monitoring | Prometheus, Alertmanager, SQL-Exporter und Grafana im selben Stack: fachliche Zähler aus der Prüftabelle (Freigaben, Befunde je Regel, Nachextraktion), Lesemetriken der Extraktion, elf Alarmregeln mit Runbook je Alarm, Alarme landen über n8n als Zeile in Postgres; gescheiterte Läufe lassen sich über `POST /webhook/wiederholen` wiederholen. [docs/BETRIEB.md](docs/BETRIEB.md) |
| Rechtsverweise | Sekundärrecherche, keine Regel trägt `verified` ([docs/08](docs/08-known-unknowns.md)) |

## Schnellstart

```bash
npm ci
npm test                                      # 141 Tests
node src/cli.mjs testdaten/akten/*.json       # acht Akten, acht Entscheidungen
npm run check                                 # Belege, Prosa, Verweise, Regeln
```

Extraktion (Python 3.12+, [uv](https://docs.astral.sh/uv/)):

```bash
cd extraktion && uv sync
uv run pytest                                            # 147 Tests; OCR-Tests ohne Tesseract übersprungen
uv run python -m zollpilot_extraktion --ordner ../testdaten/belege/happy-path   # PDF → Akte
uv run python -m zollpilot_extraktion.bewertung          # gegen die Basislinie
uv run python -m zollpilot_extraktion.anbieter stand     # Vergleichslauf: was aufgezeichnet ist
```

Eigener n8n-Node (TypeScript):

```bash
cd nodes/n8n-nodes-zollpilot && npm ci
npm run build && npm test                     # 12 Tests, ohne n8n
```

Oberfläche (Angular 22, ngrx):

```bash
cd oberflaeche && npm ci
npm test                                      # 92 Tests
npm run e2e:install && npm run e2e            # 23 Tests, darunter axe über jede Ansicht
node ../scripts/kontrast-check.mjs            # 11 Farbpaare nachgerechnet
```

Alles zusammen (baut Extraktion und Oberfläche):

```bash
cp .env.example .env
docker compose up -d --build --wait
bash scripts/rauchtest.sh                     # Akten, PDFs und ein Lauf durch die Oberfläche
```

Dann **`http://localhost:8088`** für die Oberfläche, `http://localhost:3000`
für das Dashboard und `http://localhost:5678` für n8n; Prüfungen liegen in
Postgres, Tabelle `pruefung`. Übergabe an Betrieb:
[docs/BETRIEB.md](docs/BETRIEB.md).

## Wie es funktioniert

```
Belege (PDF)                                  Akte (Dokumente + Assertions)
   │  extraktion/  Textlayer oder OCR,           │  von einem anderen System
   │               Klassifikation, Felder        │
   │               → Assertions mit Konfidenz    │
   │               und Fundstelle (ADR-005)      │
   └──────────────────────┬───────────────────────┘
                          ▼
   src/akte/aufbau.mjs        nur finale Belege werden Fakten (ADR-001)
                          ▼
   Pflichtmatrix              welche Daten müssen nachgewiesen sein
                          ▼
   Regeln, hart vor weich     jede Zahl aus rules.yaml (ADR-002),
   src/regeln/*.mjs           Lesefehler vor Fachfehler (ADR-003)
                          ▼
   Entscheidung + Nachforderungen    an den Dateninhaber, je Feld
                          ▼
   n8n: Webhook → [Extraktion per HTTP] → Code-Node → Postgres → Antwort
        workflows/zollpilot-akte-pruefen.json    Build-Artefakt aus src/ (ADR-004)

   Browser → nginx → /webhook/ → n8n          gleiche Herkunft, kein CORS (ADR-006)
        oberflaeche/                              zeigt das Ergebnis, entscheidet nichts

   Prometheus ← n8n, Extraktion, SQL-Exporter (Prüftabelle)   Zuschauer, keine Abhängigkeit
        → Alertmanager → n8n /webhook/alarm → Tabelle `alarm` → Grafana
```

## Wegweiser

| Datei | Inhalt |
|---|---|
| [CLAUDE.md](CLAUDE.md) | die vier Regeln, harte Grenzen, Skills |
| [PROJECT.md](PROJECT.md) | Scope, Architektur, Datenmodell, Metriken, offene Fragen an den Auftraggeber |
| [DECISIONS.md](DECISIONS.md) | Übersicht der ADRs, Reihenfolge der nächsten Stufen |
| [docs/PRODUKT.md](docs/PRODUKT.md) | Nutzersicht und Ablauf, was bewusst nicht gebaut wird |
| [docs/EXTRAKTION.md](docs/EXTRAKTION.md) | die Extraktion: Schichten, Konfidenz, Messung, Grenzen |
| [docs/OBERFLAECHE.md](docs/OBERFLAECHE.md) | die Oberfläche: Zustand, die 422-Falle, Barrierefreiheit, was sie nicht kann |
| [docs/entwurf/](docs/entwurf/) | Prompts für Wireframe und Mockup, der Entwurf, an dem die Oberfläche ausgerichtet wird |
| [docs/prozess/](docs/prozess/) | Prozesslandschaft mit Status je Schritt, Datenfluss bis ins Monitoring, dieselbe Landschaft als BPMN 2.0; dazu [Systemlandschaft](docs/prozess/systemlandschaft.md) mit Containern und Ports und [die sieben Workflows als Bild](docs/prozess/workflows.md) |
| [docs/PIPELINE.md](docs/PIPELINE.md) | Hook, Agenten-Hook, CI, und was nicht geprüft wird |
| [docs/BETRIEB.md](docs/BETRIEB.md) | Start, Stopp, Logs, Fehler, was vor echtem Betrieb fehlt |
| [docs/ENTWICKLUNGSLOG.md](docs/ENTWICKLUNGSLOG.md) | KI-Einsatz, ehrlich, inklusive der Fehler |
| [docs/01](docs/01-dokumententypologie.md) bis [docs/08](docs/08-known-unknowns.md) | Fachliche Wissensbasis |

## Was dieses Repo nicht belegen kann

Jahre im n8n-Betrieb, mehr als einen gemessenen Lauf mit einem
IDP-Anbieter (Azure, synthetische Belege; ABBYY und Document AI nur
Recherche), Extraktionsgenauigkeit auf echten Scans und fremden Layouts,
verifizierte Rechtsverweise. Steht ausführlich in
[docs/ANFORDERUNGEN.md](docs/ANFORDERUNGEN.md), Abschnitt
„Was dieses Repo grundsätzlich nicht belegen kann“.
