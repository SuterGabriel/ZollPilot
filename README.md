# ZollPilot

[Deutsche Fassung](README.de.md)

Automated completeness and consistency checks for customs and shipping
documents. The system does not process documents; it keeps one **case file**
per shipment. Documents are claims, the case file holds the verified state. A
Python extraction service reads the documents and asserts; n8n orchestrates; a
deterministic rule engine in JavaScript decides; an Angular front end shows the
result and decides nothing.

One page without jargon (German):
[docs/OHNE-FACHBEGRIFFE.md](docs/OHNE-FACHBEGRIFFE.md).

Portfolio project built against a requirements profile of the kind the market
advertises for n8n projects in logistics and customs. The profile is in
[docs/ANFORDERUNGEN.md](docs/ANFORDERUNGEN.md), point by point with an evidence
column and with what a repository cannot prove.

Documentation, identifiers and commit messages are in German. This page is the
English entry point.

## Status

As of 12 September 2026, stages 0 to 4 of the plan in
[docs/ARBEITSWEISE.md](docs/ARBEITSWEISE.md).

| What | Status |
|---|---|
| Scenario | Export to a third country, sea freight FCL, preferential origin claimed |
| Rules | 14 executable in [rules.yaml](rules.yaml), more than 40 in the catalogue [docs/03](docs/03-regelwerk-vollstaendig.md) |
| Mandatory data matrix | 7 entries in [pflichtmatrix.yaml](pflichtmatrix.yaml): evidence instead of document, including the MRN from the export accompanying document |
| Extraction (IDP/OCR) | Python service in [extraktion/](extraktion/): text layer with coordinates or Tesseract with word confidences, classification, fields per document type (commercial invoice, packing list, B/L, origin declaration, export accompanying document), every assertion with its source location (ADR-005). An invoice as UN/CEFACT CII XML runs through the same chain as a document without reading uncertainty, validated against the schema in both directions (ADR-008). Two further readers, Google Document AI and Azure Document Intelligence, read the same 32 documents from recorded responses: 570 of 570 fields and 8 of 8 decisions each, level with Tesseract. **One layout family, synthetic documents.** What that means: [docs/EXTRAKTION.md](docs/EXTRAKTION.md) |
| Front end | Angular 22 with ngrx in [oberflaeche/](oberflaeche/): submit documents, read the decision with a reason per rule, override (ADR-006, ADR-007); behind the proxy login, with the verified name (ADR-009); plus the overview of all case files with open requests and unassigned mail ([`docs/entwurf/04-uebersicht.md`](docs/entwurf/04-uebersicht.md)). Contrast recalculated, axe over every view: [docs/OBERFLAECHE.md](docs/OBERFLAECHE.md) |
| Tests | 125 in JavaScript (check digits against reference values, edge cases per rule, confidence path), 165 in Python (normalisation, classification, tables, CII against schema, vendor readers, pseudonymisation and classification fallback, end to end on the PDFs), 92 + 23 in TypeScript (state, service, rendering; axe, keyboard, no scrollbar), 12 for the custom n8n node |
| Test data | 8 synthetic case files as JSON, the same 8 as document sets (PDF, each with an export accompanying document) in [testdaten/belege/](testdaten/belege/), generated and byte-identically reproducible; the bad scan is a real image for Tesseract |
| Measurement | Field exact match per document type and decision per case file against the golden set, baseline in [extraktion/basislinie.json](extraktion/basislinie.json), run as a CI job |
| n8n | 7 workflows as export (check with two entry points, error, retry, alert, requests for missing data, inbox, read overview); the code nodes are bundled from `src/` (ADR-004); a custom node in TypeScript with a credential type in [nodes/](nodes/n8n-nodes-zollpilot/) calls the extraction, 12 tests without n8n |
| Inbox | A reply with an attachment finds its case file through the case number (ADR-010): IMAP trigger, extraction of the new documents only, merge with the stored case file, re-check. Without a number the mail is stored in Postgres as unassigned. Smoke test round 9 |
| Stored case file | Every check stores master data, documents and assertions in Postgres, append only, each document unique by identifier and hash (ADR-010). Not the originals |
| Requests for missing data | A process, not a text (ADR-009): one case per missing value with escalation level and send date, reconciled daily or on demand, levels relative to the case file cut-offs from [`zustaendigkeiten.yaml`](zustaendigkeiten.yaml), sent via SMTP to a test mailbox, every send recorded. Smoke test round 8 plays through three days |
| Operations | `compose.yml` with ten services: Postgres, import, n8n, extraction service, nginx, GreenMail, Prometheus, Alertmanager, SQL exporter, Grafana ([system landscape](docs/prozess/systemlandschaft.md)); smoke test in nine rounds against the running stack: case files, PDFs, front end, override, failed run, retry, monitoring, requests, inbox |
| Monitoring | Prometheus, Alertmanager, SQL exporter and Grafana in the same stack: domain counters from the check table (releases, findings per rule, re-extraction), reading metrics of the extraction, eleven alert rules with a runbook per alert, alerts land via n8n as a row in Postgres; failed runs can be retried via `POST /webhook/wiederholen`. [docs/BETRIEB.md](docs/BETRIEB.md) |
| Legal references | Secondary research, no rule is marked `verified` ([docs/08](docs/08-known-unknowns.md)) |

## Quick start

```bash
npm ci
npm test                                      # 141 tests
node src/cli.mjs testdaten/akten/*.json       # eight case files, eight decisions
npm run check                                 # evidence, prose, links, rules
```

Extraction (Python 3.12+, [uv](https://docs.astral.sh/uv/)):

```bash
cd extraktion && uv sync
uv run pytest                                            # 165 tests; OCR tests skipped without Tesseract
uv run python -m zollpilot_extraktion --ordner ../testdaten/belege/happy-path   # PDF → case file
uv run python -m zollpilot_extraktion.bewertung          # against the baseline
uv run python -m zollpilot_extraktion.anbieter stand     # vendor comparison: what is recorded
```

Custom n8n node (TypeScript):

```bash
cd nodes/n8n-nodes-zollpilot && npm ci
npm run build && npm test                     # 12 tests, without n8n
```

Front end (Angular 22, ngrx):

```bash
cd oberflaeche && npm ci
npm test                                      # 92 tests
npm run e2e:install && npm run e2e            # 23 tests, including axe over every view
node ../scripts/kontrast-check.mjs            # 11 colour pairs recalculated
```

Everything together (builds extraction and front end):

```bash
cp .env.example .env
docker compose up -d --build --wait
bash scripts/rauchtest.sh                     # case files, PDFs and one run through the front end
```

Then **`http://localhost:8088`** for the front end, `http://localhost:3000`
for the dashboard and `http://localhost:5678` for n8n; checks are stored in
Postgres, table `pruefung`. Handover to operations:
[docs/BETRIEB.md](docs/BETRIEB.md).

## How it works

```
Documents (PDF)                               Case file (documents + assertions)
   │  extraktion/  text layer or OCR,            │  from another system
   │               classification, fields        │
   │               → assertions with confidence  │
   │               and source location (ADR-005) │
   └──────────────────────┬───────────────────────┘
                          ▼
   src/akte/aufbau.mjs        only final documents become facts (ADR-001)
                          ▼
   Mandatory data matrix      which data must be evidenced
                          ▼
   Rules, hard before soft    every number from rules.yaml (ADR-002),
   src/regeln/*.mjs           reading error before domain error (ADR-003)
                          ▼
   Decision + requests        to the data owner, per field
                          ▼
   n8n: webhook → [extraction via HTTP] → code node → Postgres → response
        workflows/zollpilot-akte-pruefen.json    build artefact from src/ (ADR-004)

   Browser → nginx → /webhook/ → n8n          same origin, no CORS (ADR-006)
        oberflaeche/                              shows the result, decides nothing

   Prometheus ← n8n, extraction, SQL exporter (check table)   observer, no dependency
        → Alertmanager → n8n /webhook/alarm → table `alarm` → Grafana
```

## Where to look

| File | Contents |
|---|---|
| [CLAUDE.md](CLAUDE.md) | the four rules, hard limits, skills |
| [PROJECT.md](PROJECT.md) | scope, architecture, data model, metrics, open questions for the client |
| [DECISIONS.md](DECISIONS.md) | overview of the ADRs, order of the next stages |
| [docs/PRODUKT.md](docs/PRODUKT.md) | user view and flow, what is deliberately not built |
| [docs/EXTRAKTION.md](docs/EXTRAKTION.md) | the extraction: layers, confidence, measurement, limits |
| [docs/OBERFLAECHE.md](docs/OBERFLAECHE.md) | the front end: state, the 422 trap, accessibility, what it cannot do |
| [docs/entwurf/](docs/entwurf/) | prompts for wireframe and mockup, the design the front end is aligned to |
| [docs/prozess/](docs/prozess/) | process landscape with status per step, data flow into monitoring, the same landscape as BPMN 2.0; plus [system landscape](docs/prozess/systemlandschaft.md) with containers and ports and [the seven workflows as a picture](docs/prozess/workflows.md) |
| [docs/PIPELINE.md](docs/PIPELINE.md) | hook, agent hook, CI, and what is not checked |
| [docs/BETRIEB.md](docs/BETRIEB.md) | start, stop, logs, errors, what is missing before real operations |
| [docs/ENTWICKLUNGSLOG.md](docs/ENTWICKLUNGSLOG.md) | AI usage, honestly, including the mistakes |
| [docs/01](docs/01-dokumententypologie.md) to [docs/08](docs/08-known-unknowns.md) | domain knowledge base |

## What this repository cannot prove

Years of n8n operations, more than one measured run with an IDP vendor
(Azure, synthetic documents; ABBYY and Document AI research only), extraction
accuracy on real scans and unfamiliar layouts, verified legal references. Set
out in full in [docs/ANFORDERUNGEN.md](docs/ANFORDERUNGEN.md), section
„Was dieses Repo grundsätzlich nicht belegen kann“.
