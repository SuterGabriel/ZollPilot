# Anforderungs-Mapping

Dieses Dokument ist der Auftraggeber dieses Projekts. Es entstand **vor** dem
Code und wird bei jeder Stufe gegen den Stand des Repos abgeglichen
(`/anforderungs-mapping`). Der Beleg-Check in Hook und CI prüft, dass jeder
Pfad in der Belegspalte existiert.

Die Anforderungen sind aus zwei Stellenprofilen des Marktes für n8n-Projekte
in Logistik und Zoll sinngemäß zusammengefasst, nicht wörtlich zitiert. Die
Kennungen bleiben stabil. Leere Belege sind ehrlich leer.

**Legende Status:** `offen` = noch nichts im Repo · `in Arbeit` = angefangen ·
`belegt` = im Repo nachprüfbar · `teilweise belegbar` = das Repo zeigt die
Arbeitsweise, nicht die Jahre, mit Hinweis, was fehlt · `nicht belegbar` = durch
ein Portfolio-Projekt grundsätzlich nicht nachweisbar, wird offen angesprochen ·
`zu klären` = formale Anforderung außerhalb des Repos.

---

## Profil A: n8n-Workflows für Dokumentenprozesse in Logistik und Zoll

### Aufgabe

Produktive n8n-Workflows für Dokumentenprozesse in Logistik und Zoll
aufbauen, IDP- und OCR-Komponenten anbinden und einen stabilen Betrieb mit
Monitoring sicherstellen. Erwartete Ergebnisse: produktionstaugliche
n8n-Flows mit Integrationen, eine IDP-Pipeline mit Grundqualitätssicherung
und Validierung, eine Kurzdokumentation mit Übergabe an Betrieb und Support.

### Must-have

| # | Anforderung | Status | Beleg im Repo |
|---|---|---|---|
| M1 | Produktionserfahrung mit n8n, Entwicklung und Betrieb | teilweise belegbar | Vier Workflows als Export in `workflows/` (Prüfung mit zwei Webhooks, Postgres, IF, Respond; Fehler-Workflow mit Error Trigger; Wiederholung gescheiterter Läufe; Alarmannahme); Betrieb mit `compose.yml` (Healthchecks, idempotenter Import, Execution-Pruning), Monitoring mit Prometheus, Alertmanager und Grafana samt Runbook je Alarm (`docs/BETRIEB.md`), `scripts/rauchtest.sh` in sieben Runden gegen das laufende System. Siehe Hinweis unten. |
| M2 | IDP, OCR und Datenextraktion aus Dokumenten | belegt | Extraktionspipeline in `extraktion/` (Python, ADR-005): Textlayer mit Koordinaten oder Tesseract mit Wortkonfidenzen (`extraktion/zollpilot_extraktion/lesen.py`), regelbasierte Klassifikation mit Draft-Erkennung, labelgetriebene Feldextraktion je Belegtyp (`extraktion/zollpilot_extraktion/felder/`), jede Assertion mit Fundstelle, Konfidenz und Methode; Anbieterbewertung in `docs/07-idp-ocr.md`; Datenmodell trennt Belegaussage und Aktenwert (`src/akte/aufbau.mjs`, `deploy/postgres/init.sql`); Konfidenzpfad: Prüfziffernfehler bei niedriger Konfidenz löst Nachextraktion aus (`src/regeln/TRN-02.mjs`); Golden Set aus sieben Belegsätzen (PDF) in `testdaten/belege/`, Messung Field Exact Match und Entscheidung je Akte gegen `extraktion/basislinie.json` (`docs/EXTRAKTION.md`). **Grenze, offen benannt:** labelgetrieben, eine Layoutfamilie, synthetische Belege. Die Genauigkeit auf echten Scans ist hier nicht messbar (`docs/OFFENE-PUNKTE.md`). |
| M3 | Logistik- und Zollfachlichkeit: Dokumenttypen und Prozesse | belegt | Dokumententypologie mit Feldern und Fehlerquellen in `docs/01-dokumententypologie.md`; Pflichtmatrix, Schwellen und Incoterms in `docs/02-pflichtmatrix.md`; Regelkatalog mit über vierzig Regeln in `docs/03-regelwerk-vollstaendig.md`, davon 13 ausführbar in `rules.yaml`; Prozess, Zuständigkeiten und Fristen in `docs/05-prozess-nachforderung.md`; Regulatorik bis 2028 in `docs/06-regulatorik.md`; Grenzen des eigenen Wissens in `docs/08-known-unknowns.md` |
| M4 | Eigener Code in JavaScript oder Python | belegt | JavaScript: Regelwerk, Validatoren und Normalisierung in `src/` (ohne Framework), 89 Tests in `tests/`, Prüfziffern ISO 6346 und Mod 7 gegen Referenzwerte, eigene Gates in `scripts/` mit Testsuiten. TypeScript: Angular 22 mit ngrx in `oberflaeche/` (strikt getypt), 43 Unit-Tests und 10 Ende-zu-Ende-Tests mit axe. Python: Extraktionsdienst in `extraktion/` (FastAPI, pdfplumber, Tesseract) mit 98 Tests, Belegerzeugung `testdaten/erzeuge-belege.py`, Bewertung gegen eine Basislinie. Jede Sprache dort, wo ihre Werkzeuge sind, nicht nebeneinander zur Schau. |

> **Zu M1, offen benannt:** „Produktionserfahrung“ ist eine
> Erfahrungs-, keine Werkzeuganforderung. Dieses Repo zeigt, *wie* n8n
> produktionstauglich eingesetzt wird: Entscheidung außerhalb des Workflows,
> Workflow als Build-Artefakt, Fehlerpfad, Betriebsdokument. Es kann nicht
> ersetzen, einen n8n-Betrieb über Monate mit echtem Ticketaufkommen getragen
> zu haben. Das wird im Gespräch so gesagt.

### Nice-to-have

| # | Anforderung | Status | Beleg im Repo |
|---|---|---|---|
| N1 | Kubernetes, Docker und CI/CD | teilweise belegbar | Docker: `compose.yml` mit fünf Diensten, Healthchecks und Volumes, mehrstufiges `extraktion/Dockerfile` (Basis, Test mit pytest beim Build, Laufzeit ohne Root) und `oberflaeche/Dockerfile` (Bau mit Node, Auslieferung mit nginx); CI/CD: `.github/workflows/ci.yml` mit acht Jobs, darunter die Python-Bewertung gegen eine Basislinie, axe über jede Ansicht der Oberfläche und ein Job, der den Stack baut, hochfährt und den Rauchtest ausführt. **Kubernetes: nichts im Repo**, siehe `docs/OFFENE-PUNKTE.md`. |
| N2 | Gängige IDP-Werkzeuge, etwa ABBYY oder Google Document AI | nicht belegbar | Vergleich der Anbieter nach Tabellen, Stempeln, Training, Hosting und Rolle in `docs/07-idp-ocr.md`. Die Nahtstelle ist gebaut: Ein Anbieter ersetzt `extraktion/zollpilot_extraktion/lesen.py` (Wörter mit Koordinaten und Konfidenz) und liefert dieselbe Assertion. Aber Tesseract ist kein gängiges IDP-Tool im Sinne des Anforderungsprofils. Ohne Lizenz beziehungsweise Projektzugang lässt sich kein Aufruf im Repo zeigen; die Bewertung ist Recherche, nicht Erfahrung. |

### Erwartete Ergebnisse (was das Projekt abbildet)

| # | Ergebnis | Status | Abbildung im Projekt |
|---|---|---|---|
| E1 | Produktionstaugliche n8n-Flows mit Integrationen | in Arbeit | `workflows/zollpilot-akte-pruefen.json` mit zwei Eingängen (Akte als Assertions, Belege als PDF), Prüfung, Postgres, Verzweigung, Antwort/Nachforderung; `workflows/zollpilot-fehler.json`; Integrationen: Postgres angebunden, Extraktionsdienst per HTTP angebunden (`docs/EXTRAKTION.md`), Oberfläche über einen nginx-Proxy derselben Herkunft (`docs/OBERFLAECHE.md`), E-Mail-Node vorbereitet und bewusst deaktiviert (`docs/BETRIEB.md`). Offen: Mail-Intake, DMS/ERP. |
| E2 | Eine IDP-Pipeline mit Grundqualitätssicherung und Validierung | belegt | Pipeline: Lesen, Klassifikation, Extraktion, Normalisierung in `extraktion/`; Validierung: `src/regelwerk.mjs`, `rules.yaml`, `pflichtmatrix.yaml`, Konfidenzpfad. Grund-QA: Field Exact Match je Belegtyp und Entscheidung je Akte gegen das Golden Set, mit Basislinie im Repo und als CI-Job (`docs/EXTRAKTION.md`, `docs/PIPELINE.md`). Auf synthetischen Belegen; siehe M2. |
| E3 | Eine Kurzdokumentation mit Übergabe an Betrieb und Support | belegt | `docs/BETRIEB.md` (Start, Stopp, Logs, Datenbank, Re-Import, Fehlertabelle, was vor echtem Betrieb fehlt); `README.md` als Einstieg |

### Formal

| # | Anforderung | Status | Anmerkung |
|---|---|---|---|

---

## Profil B: technische Projektsteuerung für n8n-Workflows und Prozessdigitalisierung

Dieselbe Rolle, ausführlicher beschrieben: Wo das erste Profil vier
Must-haves nennt, nennt dieses acht Aufgabenblöcke und sechs Anforderungen.
Was oben belegt ist, wird hier nicht wiederholt, sondern verwiesen. Die
Zeilen mit `offen` sind der Arbeitsplan; ihre Belegspalte nennt Pfade, die
es noch nicht gibt, und der Beleg-Check lässt das für diesen Status zu.

### Aufgabenstellung

Verlangt wird das vollständige Lebenszyklus-Management der Workflows: vom
Entwurf über Entwicklung und Betrieb bis zur Weiterentwicklung.

### Aufgabenblöcke

| # | Aufgabe | Status | Beleg im Repo |
|---|---|---|---|
| A1 | Entwicklung in n8n von Anfang bis Ende: Architektur, Konzeption, eigene Nodes und Code, produktives Deployment hochverfügbarer Flows für komplexe Dokumentenketten | teilweise belegbar | Architektur und Konzeption: `DECISIONS.md`, ADR-004 (n8n orchestriert, `src/` entscheidet). Custom Code: der Code-Node ist ein Build-Artefakt aus `src/` (`scripts/n8n-bundle.mjs`). Deployment: `compose.yml` mit idempotentem Import. **Fehlt:** ein eigener Node als npm-Paket (Node-Entwicklung im engen Sinn), vorgesehen unter `nodes/`; Hochverfügbarkeit ist ein n8n-Prozess ohne Queue-Modus (`docs/BETRIEB.md`). |
| A2 | Intelligente Dokumentenverarbeitung: KI- und regelbasierte Klassifikation von Verschiffungs-, Transport- und Zolldokumenten, etwa B/L, CMR, Handelsrechnung, Ursprungszeugnis, ABD | teilweise belegbar | Regelbasierte Klassifikation mit Draft-Erkennung in `extraktion/zollpilot_extraktion/klassifikation.py` für Handelsrechnung, Proformarechnung, Packliste, B/L, Sea Waybill, A.TR und Ursprungserklärung; Typologie aller genannten Belege inklusive CMR und ABD in `docs/01-dokumententypologie.md`. **Fehlt:** ABD und CMR in der Klassifikation (ABD in Arbeit auf dem Branch `extraktion`); KI-Klassifikation als Fallback bei niedriger Konfidenz, mit Pseudonymisierung, ist Stufe 3b (`DECISIONS.md`) und nicht gebaut. |
| A3 | Automatisierte Vollständigkeits- und Konsistenzprüfung: Validierungslogik, die je Zollsachverhalt prüft, ob alle nötigen Dokumente vorliegen und inhaltlich übereinstimmen | belegt | Vollständigkeit als Nachweis statt Dokument: `pflichtmatrix.yaml`, `src/pflichtmatrix.mjs`. Konsistenz: 13 Regeln aus `rules.yaml` in `src/regeln/`, Cross-Document-Abgleich von Container, Ursprung, Mengen, Gewichten, Warennummern und Summen, hart vor weich, in `src/regelwerk.mjs`; Grenzfälle je Regel in `tests/regeln/`. Sachverhaltsbezug über Richtung, Verkehrsträger, Incoterm und Präferenzabsicht (`docs/02-pflichtmatrix.md`). |
| A4 | Automatisierter Nachforderungsprozess mit Mahnwesen: ausgelöste Folge-Workflows, die Nachforderungen und Erinnerungen an Partner und Lieferanten versenden | teilweise belegbar | Die Nachforderung selbst ist gebaut: je fehlendem Wert Feld, Grund, akzeptierte Nachweise, Adressat und Folge (`src/nachforderung.mjs`), Adressaten und fünf Eskalationsstufen als Daten in `zustaendigkeiten.yaml`, Prozess in `docs/05-prozess-nachforderung.md`; der Versand-Node im Workflow ist vorbereitet und bewusst deaktiviert; die Tabelle `request_case` existiert im Schema. **Fehlt:** der Zustand über die Zeit (offene Nachforderungen, Stufe, letzter Versand), ein zeitgesteuerter Workflow, der fällige Stufen versendet, Idempotenz bei erneutem Eingang, und der Rückweg einer Antwort in die Akte. Vorgesehen als eigene Stufe mit ADR (`docs/OFFENE-PUNKTE.md`). |
| A5 | Datenextraktion mit Qualitätssicherung: strukturierte Daten aus unstrukturierten Dokumenten über Parser, Regex, OCR und KI-Nodes, mit Plausibilitäts- und Regelprüfung | teilweise belegbar | Parser und Regex: labelgetriebene Feldextraktion je Belegtyp in `extraktion/zollpilot_extraktion/felder/`; OCR: Tesseract mit Wortkonfidenzen in `extraktion/zollpilot_extraktion/lesen.py`; QA: Field Exact Match und Entscheidung je Akte gegen `extraktion/basislinie.json`, Plausibilität und Regeln wie A3. **Fehlt:** AI-Nodes; kein Modell ist angebunden (siehe A2 und R6). |
| A6 | Integration und Routing über mehrere Systeme: REST, Webhooks und Datenbanken, Ablage in Zielsystemen wie DMS oder ERP, Weiterleitung an externe Partner wie Speditionen und Zollagenturen | teilweise belegbar | Webhooks: zwei Eingänge (`workflows/zollpilot-akte-pruefen.json`); REST: Aufruf des Extraktionsdienstes per HTTP; Datenbank: Postgres mit Fachschema (`deploy/postgres/init.sql`); Oberfläche über nginx-Proxy derselben Herkunft (`deploy/nginx/zollpilot.conf`). Dispatching: Nachforderungen adressieren Rollen (Spediteur, Zollvertreter, Lieferant) in `zustaendigkeiten.yaml`. **Fehlt:** DMS- und ERP-Ablage, Mail als Eingang und Ausgang; ein Ausgangsadapter mit Dateiablage als Referenz ist vorgesehen (`docs/OFFENE-PUNKTE.md`). |
| A7 | Prozessdokumentation | teilweise belegbar | Prozess und Zuständigkeiten in `docs/05-prozess-nachforderung.md`, Nutzersicht in `docs/PRODUKT.md`, Betrieb in `docs/BETRIEB.md`, Datenfluss als Textgrafik in `README.md`. **Fehlt:** die Form, die R4 verlangt: Prozesslandschaft als BPMN, Datenflussdiagramm, Betriebshandbuch mit Runbooks je Alarm. |
| A8 | Betrieb und Lebenszyklus: laufendes Monitoring, Incident Management, Fehleranalyse und Leistungsoptimierung der produktiven Flows | belegt | Monitoring: Prometheus, Alertmanager, SQL-Exporter und Grafana als Dienste in `compose.yml`, Konfiguration unter `deploy/prometheus/`, `deploy/alertmanager/`, `deploy/sql-exporter/`, `deploy/grafana/`; drei Metrikquellen (n8n-Ereigniszähler, Extraktionsmetriken in `extraktion/zollpilot_extraktion/metriken.py`, fachliche Zähler aus der Prüftabelle), Dashboard aus dem Repo provisioniert. Incident Management: elf Alarmregeln mit Schweregrad, jede mit Runbook in `docs/BETRIEB.md` (ein Gate prüft das), Alarme landen über `workflows/zollpilot-alarm.json` als Zeile in Postgres; gescheiterte Läufe werden mit Rumpf in `wiedervorlage` abgelegt und über `workflows/zollpilot-wiederholen.json` wiederholt. Fehleranalyse: Ausführungs-ID in jeder Antwort, `workflow_fehler`, Sicht `rule_result`. Performance: Dauer p50/p95 und Anteil OCR je Stunde im Dashboard, Alarm bei p95 über 60 s. Bewiesen durch `scripts/rauchtest.sh`, Runden 6 und 7, im CI-Job `betrieb`. **Grenze:** kein Mensch am Ende des Alarms, kein SMTP; Prometheus und Grafana ohne Redundanz (`docs/OFFENE-PUNKTE.md`). Hochverfügbarkeit im Sinn von Queue-Modus und Workern: nicht gebaut, siehe A1. |

### Anforderungen

| # | Anforderung | Status | Beleg im Repo |
|---|---|---|---|
| R1 | n8n-Expertise: Praxiserfahrung mit n8n oder vergleichbaren Plattformen im produktiven Einsatz, mit Setup, eigenen Code-Nodes in JavaScript, TypeScript oder Python, Fehlerbehandlung, Versionierung und Betrieb | teilweise belegbar | Wie M1 oben: Setup (`compose.yml`), Custom Code (`scripts/n8n-bundle.mjs`, Code-Nodes im Workflow), Fehlerbehandlung (Fehler-Workflow, Fehlerzweig, drei Antwortcodes), Versionierung (Workflows als Export im Repo, Bundle-Check in der CI), Betrieb (`docs/BETRIEB.md`). Die Jahre im Unternehmenseinsatz kann ein Repo nicht zeigen; siehe Hinweis zu M1. |
| R2 | Digitalisierungsprojekte | teilweise belegbar | Dieses Projekt, und das Vorgängerprojekt, aus dem `docs/ARBEITSWEISE.md` abgeleitet ist. Mehr als zwei Projekte kann dieses Repo nicht zeigen. |
| R3 | Prozessverständnis in Zoll und Logistik: Dokumenttypen und Abläufe der internationalen Logistik, Verschiffung, Import und Export, Zollabwicklung | belegt | Wie M3 oben: `docs/01-dokumententypologie.md` bis `docs/08-known-unknowns.md`. Die praktische Erfahrung ist eine Erfahrungsanforderung wie M1. |
| R4 | Dokumentationskompetenz: klare, strukturierte Prozesslandschaften, Datenflussdiagramme und Betriebshandbücher | teilweise belegbar | Elf Dokumente unter `docs/`, jedes mit einem Abschnitt, was es nicht abdeckt; Betriebshandbuch in Prosa (`docs/BETRIEB.md`). **Fehlt:** die drei genannten Artefakte in ihrer Form, siehe A7. Vorgesehen unter `docs/prozess/`. |
| R5 | Schnittstellen und Data Engineering: REST, Webhooks, JSON- und XML-Strukturen, gängige OCR- und IDP-Lösungen | teilweise belegbar | REST, Webhooks und JSON: wie A6; die Akte als JSON-Vertrag zwischen Extraktion, Regelwerk und Oberfläche (`src/akte/aufbau.mjs`). OCR: Tesseract. **Fehlt:** XML; keine Schnittstelle liest oder schreibt XML (in Arbeit auf dem Branch `extraktion`: UN/CEFACT CII als Ein- und Ausgang). Gängige IDP-Lösungen: wie N2 oben, nicht belegbar ohne Lizenz; Vergleichslauf in Arbeit. |
| R6 | Sicherer Umgang mit generativer KI: aktuelle Modelle und Assistenzwerkzeuge, Prompt-Entwicklung, Integration von KI-Nodes und APIs in Workflows | teilweise belegbar | Prompt-Entwicklung: die Skills, Commands, Subagents und Hooks in `.claude/` sind versionierte Prompts mit Prüfung (`docs/PIPELINE.md`); die Entwurfsprompts für Wireframe und Mockup in `docs/entwurf/`; der KI-Einsatz in der Entwicklung ist Sitzung für Sitzung protokolliert, inklusive der Fehler (`docs/ENTWICKLUNGSLOG.md`). **Fehlt:** ein AI-Node in einem Workflow. Das ist konsequent nach ADR-003, aber es ist eine Abwesenheit; die vorgesehene Stelle ist der Klassifikationsfallback (A2), pseudonymisiert nach `docs/DATENSCHUTZ.md`. |

### Formal

| # | Anforderung | Status | Anmerkung |
|---|---|---|---|
| F6 | Sprachkenntnisse: deutsch | belegt | Jedes Dokument, jeder Commit, jeder Node-Name in diesem Repo. |

### Was beide Profile gemeinsam offen lassen

Drei Punkte stehen in beiden und sind in keiner belegt: ein gängiges
IDP-Werkzeug (N2, R5); die Jahre im Betrieb (M1, R1); und ein Prozess, der
bei E-Mail beginnt statt am Webhook (A4, A6, E1). Das Monitoring, das
beide verlangen (A8, „stabiler Betrieb mit Monitoring“), ist seit dem
12. September 2026 gebaut. Die Reihenfolge für den Rest steht in
`DECISIONS.md`.

---

## Was dieses Repo grundsätzlich nicht belegen kann

- **Jahre.** Produktionserfahrung (M1) ist Zeit unter Last. Ein Repo zeigt Arbeitsweise.
- **Fremde Werkzeuge ohne Zugang.** ABBYY und Document AI (N2) brauchen Lizenz oder Projekt.
- **Echte Dokumente.** Alle Testdaten sind synthetisch (`docs/DATENSCHUTZ.md`). Die
  Extraktion kennt eine Layoutfamilie, nämlich die, die `testdaten/erzeuge-belege.py`
  rendert. Die Genauigkeit auf echten Scans, Stempeln und fremden Layouts kann
  hier nicht gemessen werden; die Bewertung misst die Pipeline, nicht die
  Wirklichkeit (ADR-005).
- **Verifizierte Rechtsverweise.** Alle Artikel stammen aus Sekundärrecherche
  (`docs/08-known-unknowns.md`) und tragen im Katalog `legal_source: secondary`
  oder `practice`. Keine Regel trägt `verified`.
