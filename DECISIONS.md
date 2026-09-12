# Entscheidungen

Übersicht über die Architekturentscheidungen dieses Projekts. Die
ausführliche Fassung liegt jeweils in `docs/adr/`.

Eine ADR entsteht im Moment der Entscheidung. Wer sie rückwirkend schreibt,
rekonstruiert Begründungen, die er nie hatte — und das merkt man ihnen an.

| Nr. | Thema | Status | Datum |
|---|---|---|---|
| [ADR-001](docs/adr/ADR-001-akte-statt-dokument.md) | Die Akte ist das Objekt: Assertions und Fakten getrennt, nur finale Belege speisen Fakten | angenommen | 2026-09-12 |
| [ADR-002](docs/adr/ADR-002-regeln-sind-daten.md) | Regeln sind Daten in `rules.yaml`; ein Gate lässt keine nackte Zahl in `src/regeln/` | angenommen | 2026-09-12 |
| [ADR-003](docs/adr/ADR-003-kein-modell-in-der-entscheidung.md) | Kein Modell in der Entscheidungsschicht; Lesefehler vor Fachfehler | angenommen | 2026-09-12 |
| [ADR-004](docs/adr/ADR-004-n8n-orchestriert-src-entscheidet.md) | n8n orchestriert, `src/` entscheidet; der Code-Node ist ein Build-Artefakt aus `src/` | angenommen | 2026-09-12 |

Vorgesehen, noch nicht entschieden: Extraktionsarchitektur (Stufe 3, OCR vor
Vision-Modell, Pseudonymisierung), Intake über Mail (Stufe 2), Betrieb jenseits
von Compose (Stufe 4). Diese bekommen fortlaufend die nächste freie Nummer,
wenn sie fällig sind.

## Anforderungen

Der Auftraggeber dieses Projekts ist eine Ausschreibung. Sie ist wörtlich
erfasst in [docs/ANFORDERUNGEN.md](docs/ANFORDERUNGEN.md), inklusive der
Punkte, die ein Portfolio-Projekt grundsätzlich nicht belegen kann.
