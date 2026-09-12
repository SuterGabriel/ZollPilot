# Entscheidungen

Übersicht über die Architekturentscheidungen dieses Projekts. Die
ausführliche Fassung liegt jeweils in `docs/adr/`.

Eine ADR entsteht im Moment der Entscheidung. Wer sie rückwirkend schreibt,
rekonstruiert Begründungen, die er nie hatte, und das merkt man ihnen an.

| Nr. | Thema | Status | Datum |
|---|---|---|---|
| [ADR-001](docs/adr/ADR-001-akte-statt-dokument.md) | Die Akte ist das Objekt: Assertions und Fakten getrennt, nur finale Belege speisen Fakten | angenommen | 2026-09-12 |
| [ADR-002](docs/adr/ADR-002-regeln-sind-daten.md) | Regeln sind Daten in `rules.yaml`; ein Gate lässt keine nackte Zahl in `src/regeln/` | angenommen | 2026-09-12 |
| [ADR-003](docs/adr/ADR-003-kein-modell-in-der-entscheidung.md) | Kein Modell in der Entscheidungsschicht; Lesefehler vor Fachfehler | angenommen | 2026-09-12 |
| [ADR-004](docs/adr/ADR-004-n8n-orchestriert-src-entscheidet.md) | n8n orchestriert, `src/` entscheidet; der Code-Node ist ein Build-Artefakt aus `src/` | angenommen | 2026-09-12 |
| [ADR-005](docs/adr/ADR-005-extraktion-ocr-vor-modell.md) | Extraktion als eigener Python-Dienst: Textlayer und OCR mit Koordinaten zuerst, ein Vision-Modell nur dahinter und nur pseudonymisiert; Golden Set und Basislinie im Repo | angenommen | 2026-09-12 |
| [ADR-006](docs/adr/ADR-006-oberflaeche-angular-gleiche-herkunft.md) | Die Eingabe bekommt eine Oberfläche: Angular mit ngrx, ausgeliefert von nginx, das `/webhook/` weiterreicht, also gleiche Herkunft statt CORS; Kontrast und axe als Gates | angenommen | 2026-09-12 |
| [ADR-007](docs/adr/ADR-007-uebersteuern-statt-umentscheiden.md) | Ein Mensch übersteuert einen Befund, ändert ihn aber nie: Das Regelergebnis bleibt stehen, die Verantwortung steht daneben. Akte und Belege liegen in Postgres | angenommen | 2026-09-12 |

Vorgesehen, noch nicht entschieden: Intake über Mail (Stufe 2), sekundäre
Extraktion mit Vision-Modell samt Pseudonymisierung (Stufe 3b), echte
Anmeldung statt Namensfeld (Voraussetzung für einen Betrieb, ADR-007),
Betrieb jenseits von Compose. Diese bekommen fortlaufend die nächste freie
Nummer, wenn sie fällig sind.

Reihenfolge, am 2026-09-12 festgelegt: Die Extraktion (Python) kommt vor der
Oberfläche (Angular), weil sie die einzige offene Must-have-Lücke der
Ausschreibung schließt. Eine Oberfläche kommt nur als Review-Arbeitsplatz:
Befund mit Fundstelle sehen, korrigieren, übersteuern mit Name und
Begründung. Kein Dashboard.

## Anforderungen

Der Auftraggeber dieses Projekts ist eine Ausschreibung. Sie ist wörtlich
erfasst in [docs/ANFORDERUNGEN.md](docs/ANFORDERUNGEN.md), inklusive der
Punkte, die ein Portfolio-Projekt grundsätzlich nicht belegen kann.
