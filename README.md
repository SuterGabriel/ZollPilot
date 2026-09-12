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
| Regeln | 13 ausführbar in [rules.yaml](rules.yaml), über 40 im Katalog [docs/03](docs/03-regelwerk-vollstaendig.md) |
| Pflichtmatrix | 6 Einträge in [pflichtmatrix.yaml](pflichtmatrix.yaml): Nachweis statt Dokument |
| Extraktion (IDP/OCR) | Python-Dienst in [extraktion/](extraktion/): Textlayer mit Koordinaten oder Tesseract mit Wortkonfidenzen, Klassifikation, Felder je Belegtyp, jede Assertion mit Fundstelle (ADR-005). **Eine Layoutfamilie, synthetische Belege.** Was das heißt: [docs/EXTRAKTION.md](docs/EXTRAKTION.md) |
| Oberfläche | Angular 22 mit ngrx in [oberflaeche/](oberflaeche/): Belege einreichen, Entscheidung mit Begründung je Regel lesen (ADR-006). Kontrast nachgerechnet, axe über jede Ansicht: [docs/OBERFLAECHE.md](docs/OBERFLAECHE.md) |
| Tests | 91 in JavaScript (Prüfziffern gegen Referenzwerte, Grenzfälle je Regel), 98 in Python (Normalisierung, Klassifikation, Tabellen, Ende zu Ende auf den PDFs), 43 + 10 in TypeScript (Zustand, Dienst, Darstellung; axe und Tastatur) |
| Testdaten | 7 synthetische Akten als JSON, dieselben 7 als Belegsätze (PDF) in [testdaten/belege/](testdaten/belege/), erzeugt und byteidentisch reproduzierbar; der schlechte Scan ist ein echtes Bild für Tesseract |
| Messung | Field Exact Match je Belegtyp und Entscheidung je Akte gegen das Golden Set, Basislinie in [extraktion/basislinie.json](extraktion/basislinie.json), als CI-Job |
| n8n | 2 Workflows als Export; ein Prüf-Workflow mit zwei Eingängen (Akte, Belege); der Code-Node ist aus `src/` gebündelt (ADR-004) |
| Betrieb | `compose.yml` mit Postgres, Import, n8n, Extraktionsdienst und nginx; Rauchtest gegen den laufenden Stack mit Akten, PDFs und einem Lauf durch die Oberfläche |
| Rechtsverweise | Sekundärrecherche, keine Regel trägt `verified` ([docs/08](docs/08-known-unknowns.md)) |

## Schnellstart

```bash
npm ci
npm test                                      # 91 Tests
node src/cli.mjs testdaten/akten/*.json       # sieben Akten, sieben Entscheidungen
npm run check                                 # Belege, Prosa, Verweise, Regeln
```

Extraktion (Python 3.12+, [uv](https://docs.astral.sh/uv/)):

```bash
cd extraktion && uv sync
uv run pytest                                            # 98 Tests; OCR-Tests ohne Tesseract übersprungen
uv run python -m zollpilot_extraktion --ordner ../testdaten/belege/happy-path   # PDF → Akte
uv run python -m zollpilot_extraktion.bewertung          # gegen die Basislinie
```

Oberfläche (Angular 22, ngrx):

```bash
cd oberflaeche && npm ci
npm test                                      # 43 Tests
npm run e2e:install && npm run e2e            # 10 Tests, davon 5 axe-Durchläufe
node ../scripts/kontrast-check.mjs            # 11 Farbpaare nachgerechnet
```

Alles zusammen (baut Extraktion und Oberfläche):

```bash
cp .env.example .env
docker compose up -d --build --wait
bash scripts/rauchtest.sh                     # Akten, PDFs und ein Lauf durch die Oberfläche
```

Dann **`http://localhost:8088`** für die Oberfläche und
`http://localhost:5678` für n8n; Prüfungen liegen in Postgres, Tabelle
`pruefung`. Übergabe an Betrieb: [docs/BETRIEB.md](docs/BETRIEB.md).

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
| [docs/PIPELINE.md](docs/PIPELINE.md) | Hook, Agenten-Hook, CI, und was nicht geprüft wird |
| [docs/BETRIEB.md](docs/BETRIEB.md) | Start, Stopp, Logs, Fehler, was vor echtem Betrieb fehlt |
| [docs/ENTWICKLUNGSLOG.md](docs/ENTWICKLUNGSLOG.md) | KI-Einsatz, ehrlich, inklusive der Fehler |
| [docs/01](docs/01-dokumententypologie.md) bis [docs/08](docs/08-known-unknowns.md) | Fachliche Wissensbasis |

## Was dieses Repo nicht belegen kann

Jahre im n8n-Betrieb, Erfahrung mit ABBYY oder Document AI ohne Lizenz,
Extraktionsgenauigkeit auf echten Scans und fremden Layouts, verifizierte
Rechtsverweise. Steht ausführlich in
[docs/ANFORDERUNGEN.md](docs/ANFORDERUNGEN.md), Abschnitt
„Was dieses Repo grundsätzlich nicht belegen kann“.
