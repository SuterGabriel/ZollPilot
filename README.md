# ZollPilot

Automatisierte Vollständigkeits- und Konsistenzprüfung von Zoll- und
Versanddokumenten. Das System verarbeitet keine Dokumente, sondern führt pro
Sendung eine **Akte**: Belege sind Behauptungen, die Akte hält den geprüften
Zustand. n8n orchestriert; ein deterministisches Regelwerk in JavaScript
entscheidet.

Portfolio-Projekt zu einem Anforderungsprofil (n8n-Workflows für Dokumentenprozesse
in Logistik und Zoll). Das Anforderungsprofil steht in
[docs/ANFORDERUNGEN.md](docs/ANFORDERUNGEN.md), mit Belegspalte und mit den
Punkten, die ein Repo nicht belegen kann.

## Stand

Stand 12. September 2026, Stufen 0 und 1 des Plans in
[docs/ARBEITSWEISE.md](docs/ARBEITSWEISE.md).

| Was | Stand |
|---|---|
| Sachverhalt | Ausfuhr Drittland, Seefracht FCL, Präferenz beansprucht |
| Regeln | 13 ausführbar in [rules.yaml](rules.yaml), über 40 im Katalog [docs/03](docs/03-regelwerk-vollstaendig.md) |
| Pflichtmatrix | 6 Einträge in [pflichtmatrix.yaml](pflichtmatrix.yaml): Nachweis statt Dokument |
| Tests | 89, darunter Prüfziffern gegen Referenzwerte und Grenzfälle je Regel |
| Testakten | 7 synthetische, jede mit erwarteter Entscheidung, Fehlerpfad im Vordergrund |
| n8n | 2 Workflows als Export; der Code-Node ist aus `src/` gebündelt (ADR-004) |
| Betrieb | `compose.yml` mit Postgres, Import und n8n; Rauchtest gegen den laufenden Stack |
| Extraktion (IDP/OCR) | **nicht gebaut** — Architektur und Datenmodell stehen, Engine fehlt ([docs/OFFENE-PUNKTE.md](docs/OFFENE-PUNKTE.md)) |
| Rechtsverweise | Sekundärrecherche, keine Regel trägt `verified` ([docs/08](docs/08-known-unknowns.md)) |

## Schnellstart

```bash
npm ci
npm test                                      # 89 Tests
node src/cli.mjs testdaten/akten/*.json       # sieben Akten, sieben Entscheidungen
npm run check                                 # Belege, Prosa, Verweise, Regeln
```

Mit Docker:

```bash
cp .env.example .env
docker compose up -d --wait
bash scripts/rauchtest.sh                     # Akten über den echten Webhook
```

Dann `http://localhost:5678` für n8n; Prüfungen liegen in Postgres, Tabelle
`pruefung`. Übergabe an Betrieb: [docs/BETRIEB.md](docs/BETRIEB.md).

## Wie es funktioniert

```
Akte (Dokumente + Assertions)
   │  src/akte/aufbau.mjs        nur finale Belege werden Fakten (ADR-001)
   ▼
Pflichtmatrix                     welche Daten müssen nachgewiesen sein
   │  pflichtmatrix.yaml
   ▼
Regeln, hart vor weich            jede Zahl aus rules.yaml (ADR-002)
   │  src/regeln/*.mjs             Lesefehler vor Fachfehler (ADR-003)
   ▼
Entscheidung + Nachforderungen    an den Dateninhaber, je Feld
   │  src/regelwerk.mjs, src/nachforderung.mjs
   ▼
n8n: Webhook → Code-Node → Postgres → Antwort
      workflows/zollpilot-akte-pruefen.json    Build-Artefakt aus src/ (ADR-004)
```

## Wegweiser

| Datei | Inhalt |
|---|---|
| [CLAUDE.md](CLAUDE.md) | die vier Regeln, harte Grenzen, Skills |
| [PROJECT.md](PROJECT.md) | Scope, Architektur, Datenmodell, Metriken, offene Fragen an den Auftraggeber |
| [DECISIONS.md](DECISIONS.md) | Übersicht der ADRs |
| [docs/PRODUKT.md](docs/PRODUKT.md) | Nutzersicht und Ablauf, was bewusst nicht gebaut wird |
| [docs/PIPELINE.md](docs/PIPELINE.md) | Hook, Agenten-Hook, CI, und was nicht geprüft wird |
| [docs/BETRIEB.md](docs/BETRIEB.md) | Start, Stopp, Logs, Fehler, was vor echtem Betrieb fehlt |
| [docs/ENTWICKLUNGSLOG.md](docs/ENTWICKLUNGSLOG.md) | KI-Einsatz, ehrlich, inklusive der Fehler |
| [docs/01](docs/01-dokumententypologie.md) bis [docs/08](docs/08-known-unknowns.md) | Fachliche Wissensbasis |

## Was dieses Repo nicht belegen kann

Jahre im n8n-Betrieb, Erfahrung mit ABBYY oder Document AI ohne Lizenz,
Extraktionsgenauigkeit auf echten Scans, verifizierte Rechtsverweise. Steht
ausführlich in [docs/ANFORDERUNGEN.md](docs/ANFORDERUNGEN.md), Abschnitt
„Was dieses Repo grundsätzlich nicht belegen kann“.
