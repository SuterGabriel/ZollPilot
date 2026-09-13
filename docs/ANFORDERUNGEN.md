# Anforderungs-Mapping

Dieses Dokument ist der Auftraggeber dieses Projekts. Es entstand **vor** dem
Code und wird bei jeder Stufe gegen den Stand des Repos abgeglichen
(`/anforderungs-mapping`). Der Beleg-Check in Hook und CI prüft, dass jeder
Pfad in der Belegspalte existiert.

Die Anforderungen sind das Profil einer Rolle, wie sie der Markt für
n8n-Projekte in Logistik und Zoll ausschreibt: zwei Stellenprofile aus dem
September 2026, sinngemäß zusammengefasst, nicht wörtlich zitiert. Die
Kennungen (M, N, E, A, R) bleiben stabil, damit Belege und Log darauf
verweisen können. Leere Belege sind ehrlich leer.

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
| M1 | Produktionserfahrung mit n8n, Entwicklung und Betrieb | teilweise belegbar | Sieben Workflows als Export in `workflows/` (Prüfung mit zwei Webhooks, Postgres, IF, Respond; Nachforderung mit Zeitplan und Versand; Posteingang per IMAP; Übersicht als Abfrage; Wiederholung gescheiterter Läufe; Fehler-Workflow mit Error Trigger; Alarmannahme), jeder als Bild aus dem laufenden Editor in `docs/prozess/workflows.md`; Betrieb mit `compose.yml` (Healthchecks, idempotenter Import, Execution-Pruning), Monitoring mit Prometheus, Alertmanager und Grafana samt Runbook je Alarm (`docs/BETRIEB.md`), `scripts/rauchtest.sh` in neun Runden gegen das laufende System. Siehe Hinweis unten. |
| M2 | IDP, OCR und Datenextraktion aus Dokumenten | belegt | Extraktionspipeline in `extraktion/` (Python, ADR-005): Textlayer mit Koordinaten oder Tesseract mit Wortkonfidenzen (`extraktion/zollpilot_extraktion/lesen.py`), regelbasierte Klassifikation mit Draft-Erkennung, labelgetriebene Feldextraktion je Belegtyp (`extraktion/zollpilot_extraktion/felder/`), jede Assertion mit Fundstelle, Konfidenz und Methode; fünf Belegtypen inklusive Ausfuhrbegleitdokument mit MRN (`extraktion/zollpilot_extraktion/felder/abd.py`); eine Rechnung als UN/CEFACT-CII-Datensatz in beide Richtungen, gegen das Schema validiert (`extraktion/zollpilot_extraktion/cii.py`, ADR-008); zwei weitere Lesemodule für Google Document AI und Azure Document Intelligence als Vergleichslauf mit Aufzeichnungen statt Zugang (`extraktion/zollpilot_extraktion/anbieter.py`); Anbieterbewertung in `docs/07-idp-ocr.md`; Datenmodell trennt Belegaussage und Aktenwert (`src/akte/aufbau.mjs`, `deploy/postgres/init.sql`); Konfidenzpfad: unsicher gelesene Werte lösen in zehn von vierzehn Regeln Nachextraktion aus statt Ablehnung (`tests/regeln/konfidenzpfad.test.mjs`); Golden Set aus acht Belegsätzen (PDF) in `testdaten/belege/`, Messung Field Exact Match und Entscheidung je Akte gegen `extraktion/basislinie.json` (`docs/EXTRAKTION.md`). **Grenze, offen benannt:** labelgetrieben, eine Layoutfamilie, synthetische Belege. Die Genauigkeit auf echten Scans ist hier nicht messbar (`docs/OFFENE-PUNKTE.md`). |
| M3 | Logistik- und Zollfachlichkeit: Dokumenttypen und Prozesse | belegt | Dokumententypologie mit Feldern und Fehlerquellen in `docs/01-dokumententypologie.md`; Pflichtmatrix, Schwellen und Incoterms in `docs/02-pflichtmatrix.md`; Regelkatalog mit über vierzig Regeln in `docs/03-regelwerk-vollstaendig.md`, davon 14 ausführbar in `rules.yaml`; Prozess, Zuständigkeiten und Fristen in `docs/05-prozess-nachforderung.md`; Regulatorik bis 2028 in `docs/06-regulatorik.md`; Grenzen des eigenen Wissens in `docs/08-known-unknowns.md` |
| M4 | Eigener Code in JavaScript oder Python | belegt | JavaScript: Regelwerk, Validatoren und Normalisierung in `src/` (ohne Framework), 141 Tests in `tests/`, Prüfziffern ISO 6346 und Mod 7 gegen Referenzwerte, eigene Gates in `scripts/` mit Testsuiten. TypeScript: Angular 22 mit ngrx in `oberflaeche/` (strikt getypt), 92 Unit-Tests und 23 Ende-zu-Ende-Tests mit axe; ein eigener n8n-Node mit Credential-Typ in `nodes/n8n-nodes-zollpilot/`, 12 Tests ohne n8n. Python: Extraktionsdienst in `extraktion/` (FastAPI, pdfplumber, Tesseract, lxml) mit 147 Tests, Belegerzeugung `testdaten/erzeuge-belege.py`, Bewertung gegen eine Basislinie, Metriken im Prometheus-Format. Jede Sprache dort, wo ihre Werkzeuge sind, nicht nebeneinander zur Schau. |

> **Zu M1, offen benannt:** „Produktionserfahrung“ ist eine
> Erfahrungs-, keine Werkzeuganforderung. Dieses Repo zeigt, *wie* n8n
> produktionstauglich eingesetzt wird: Entscheidung außerhalb des Workflows,
> Workflow als Build-Artefakt, Fehlerpfad, Betriebsdokument. Es kann nicht
> ersetzen, einen n8n-Betrieb über Monate mit echtem Ticketaufkommen getragen
> zu haben. Das wird im Gespräch so gesagt.

### Nice-to-have

| # | Anforderung | Status | Beleg im Repo |
|---|---|---|---|
| N1 | Kubernetes, Docker und CI/CD | teilweise belegbar | Docker: `compose.yml` mit zehn Diensten, Healthchecks und Volumes, mehrstufiges `extraktion/Dockerfile` (Basis, Test mit pytest beim Build, Laufzeit ohne Root) und `oberflaeche/Dockerfile` (Bau mit Node, Auslieferung mit nginx); CI/CD: `.github/workflows/ci.yml` mit acht Jobs, darunter die Python-Bewertung gegen eine Basislinie, axe über jede Ansicht der Oberfläche und ein Job, der den Stack baut, hochfährt und den Rauchtest ausführt. **Kubernetes: nichts im Repo**, siehe `docs/OFFENE-PUNKTE.md`. |
| N2 | Gängige IDP-Werkzeuge, etwa ABBYY oder Google Document AI | teilweise belegbar | Zwei gemessene Läufe, **Google Document AI** (Prozessortyp `Document OCR`, API v1, Region eu) und **Azure Document Intelligence** (`prebuilt-read`, API 2024-11-30, Stufe F0): `extraktion/zollpilot_extraktion/anbieter.py` übersetzt beide Antworten in dieselbe Form wie `lesen.py`, alle 32 Testbelege liegen je Anbieter als Aufzeichnung unter `extraktion/tests/fixtures/anbieter/<anbieter>/` im Repo, Tests und Bewertung laufen daraus ohne Zugang; Ergebnis beide Male 570 von 570 Feldern und 8 von 8 Entscheidungen, gleichauf mit der Basislinie (`docs/EXTRAKTION.md`, Vergleichslauf). Der erste Lauf war es bei keinem: Azure startete bei 26,8 %, Google bei 86,3 %, und beide Male lag der Fehler in der Übersetzung, nicht in der Lesung. Korrigiert wurde je eine Stelle in `anbieter.py`; kein Feldextraktor, keine Regel, kein Pfad. Anbieterbewertung in `docs/07-idp-ocr.md`. **Grenze:** Läufe auf synthetischen, digital erzeugten Belegen mit einem Scan; kein Training, keine Stempel, keine Monate mit dem Werkzeug. ABBYY ist Recherche geblieben. |

### Erwartete Ergebnisse (was das Projekt abbildet)

| # | Ergebnis | Status | Abbildung im Projekt |
|---|---|---|---|
| E1 | Produktionstaugliche n8n-Flows mit Integrationen | in Arbeit | `workflows/zollpilot-akte-pruefen.json` mit zwei Eingängen (Akte als Assertions, Belege als PDF), Prüfung, Postgres, Verzweigung, Antwort/Nachforderung; `workflows/zollpilot-fehler.json`; Integrationen: Postgres angebunden, Extraktionsdienst per HTTP angebunden (`docs/EXTRAKTION.md`), Oberfläche über einen nginx-Proxy derselben Herkunft (`docs/OBERFLAECHE.md`), Post in beide Richtungen über GreenMail: `workflows/zollpilot-nachforderung.json` versendet, `workflows/zollpilot-eingang.json` liest per IMAP und führt Antworten in die abgelegte Akte zurück (ADR-009, ADR-010). Offen: DMS/ERP. |
| E2 | Eine IDP-Pipeline mit Grundqualitätssicherung und Validierung | belegt | Pipeline: Lesen, Klassifikation, Extraktion, Normalisierung in `extraktion/`; Validierung: `src/regelwerk.mjs`, `rules.yaml`, `pflichtmatrix.yaml`, Konfidenzpfad. Grund-QA: Field Exact Match je Belegtyp und Entscheidung je Akte gegen das Golden Set, mit Basislinie im Repo und als CI-Job (`docs/EXTRAKTION.md`, `docs/PIPELINE.md`). Auf synthetischen Belegen; siehe M2. |
| E3 | Eine Kurzdokumentation mit Übergabe an Betrieb und Support | belegt | `docs/BETRIEB.md` (Start, Stopp, Logs, Datenbank, Re-Import, Fehlertabelle, Runbook je Alarm, was vor echtem Betrieb fehlt); `docs/prozess/systemlandschaft.md`; `README.md` als Einstieg; die Projektdokumentation als PDF in `docs/projektdokumentation/` |

Formale Punkte wie Start, Laufzeit, Einsatzort und Vertragsart liegen
außerhalb des Repos und stehen hier nicht.

---

## Profil B: technische Projektsteuerung für n8n-Workflows und Prozessdigitalisierung

Dieselbe Rolle, ausführlicher beschrieben: Wo das erste Profil vier
Must-haves nennt, nennt dieses acht Aufgabenblöcke und sechs Anforderungen.
Was oben belegt ist, wird hier nicht wiederholt, sondern verwiesen. Die
Zeilen mit `offen` sind der Arbeitsplan; ihre Belegspalte nennt Pfade, die
es noch nicht gibt, und der Beleg-Check lässt das für diesen Status zu.

### Aufgabenblöcke

Verlangt wird das vollständige Lebenszyklus-Management der Workflows: vom
Entwurf über Entwicklung und Betrieb bis zur Weiterentwicklung.

| # | Aufgabe | Status | Beleg im Repo |
|---|---|---|---|
| A1 | Entwicklung in n8n von Anfang bis Ende: Architektur, Konzeption, eigene Nodes und Code, produktives Deployment hochverfügbarer Flows für komplexe Dokumentenketten | teilweise belegbar | Architektur und Konzeption: `DECISIONS.md`, ADR-004 (n8n orchestriert, `src/` entscheidet). Custom Code: der Code-Node ist ein Build-Artefakt aus `src/` (`scripts/n8n-bundle.mjs`). Node-Entwicklung: ein eigener Node in TypeScript mit eigenem Credential-Typ in `nodes/n8n-nodes-zollpilot/`, im Prüf-Workflow im Einsatz, mit Tests ohne n8n und einem CI-Schritt, der `dist/` aus den Quellen nachbaut. Deployment: `compose.yml` mit idempotentem Import, der Node wird als Erweiterungsverzeichnis eingehängt. **Fehlt:** Hochverfügbarkeit im Sinn von Queue-Modus und Workern; es läuft ein n8n-Prozess (`docs/BETRIEB.md`). |
| A2 | Intelligente Dokumentenverarbeitung: KI- und regelbasierte Klassifikation von Verschiffungs-, Transport- und Zolldokumenten, etwa B/L, CMR, Handelsrechnung, Ursprungszeugnis, ABD | teilweise belegbar | Regelbasierte Klassifikation mit Draft-Erkennung in `extraktion/zollpilot_extraktion/klassifikation.py` für Handelsrechnung, Proformarechnung, Packliste, B/L, Sea Waybill, A.TR, Ursprungserklärung und Ausfuhrbegleitdokument (ABD mit MRN, `extraktion/zollpilot_extraktion/felder/abd.py`, Regel CUS-05, Pflicht PFL-07, achte Testakte); Typologie aller genannten Belege inklusive CMR in `docs/01-dokumententypologie.md`. KI-Klassifikation als Fallback: Schweigen die Regeln, schlägt ein Modell einen Typ aus einer geschlossenen Liste vor, hinter der Pseudonymisierung (`extraktion/zollpilot_extraktion/pseudonymisierung.py`, Parteien, Anschriften, EORI, USt-IdNr., REX) und aus einer Aufzeichnung im Repo, damit die CI ohne Schlüssel und ohne Netz grün wird (`extraktion/zollpilot_extraktion/modell.py`, ADR-011). Der Vorschlag ist nie der Typ: Das Dokument bleibt `unclassified`, der Vorschlag hängt mit Modell, Konfidenz und Begründung daneben, und der Beleg-Check hält diese Grenze fest. Gezeigt am CMR-Frachtbrief, den die Merkmalsliste nicht kennt (`extraktion/tests/test_modell.py`). **Fehlt:** CMR in der regelbasierten Klassifikation; der Fallback greift nur, wenn die Regeln schweigen, nicht wenn sie sich irren. |
| A3 | Automatisierte Vollständigkeits- und Konsistenzprüfung: Validierungslogik, die je Zollsachverhalt prüft, ob alle nötigen Dokumente vorliegen und inhaltlich übereinstimmen | belegt | Vollständigkeit als Nachweis statt Dokument: `pflichtmatrix.yaml`, `src/pflichtmatrix.mjs`. Konsistenz: 14 Regeln aus `rules.yaml` in `src/regeln/`, Cross-Document-Abgleich von Container, Ursprung, Mengen, Gewichten, Warennummern und Summen zwischen Rechnung, Packliste, B/L und Ausfuhrbegleitdokument (`src/regeln/CUS-05.mjs`), hart vor weich, in `src/regelwerk.mjs`; Grenzfälle je Regel in `tests/regeln/`. Sachverhaltsbezug über Richtung, Verkehrsträger, Incoterm und Präferenzabsicht (`docs/02-pflichtmatrix.md`). |
| A4 | Automatisierter Nachforderungsprozess mit Mahnwesen: ausgelöste Folge-Workflows, die Nachforderungen und Erinnerungen an Partner und Lieferanten versenden | belegt | Die Nachforderung als Vorgang (ADR-009): je fehlendem Wert ein Fall in `request_case` mit Grund, Feld, Adressat, Stufe und Versanddatum; `workflows/zollpilot-nachforderung.json` läuft täglich und auf Zuruf, gleicht die letzte Prüfung mit den offenen Fällen ab (`src/nachforderung/abgleich.mjs`: eröffnen, behalten, erledigen, idempotent bei erneutem Eingang), stellt Stufen fällig (`src/nachforderung/stufe.mjs`: relativ zu den Cut-offs der Akte, mit Vorlauf und Mindestabstand aus `zustaendigkeiten.yaml`, nie ein erfundenes Datum), versendet per SMTP an das Postfach des Adressaten und hält jeden Versand in `request_versand` fest. Text und Adressat kommen aus `src/nachforderung.mjs`. Bewiesen in `scripts/rauchtest.sh`, Runde 8: erste Erinnerung sofort, zweite Stufe 48 Stunden vor dem Zoll-Cut-off, erledigt nach Eingang des Nachweises, Mails im Postfach. **Grenze:** Verteiler und Postfach sind Demo (GreenMail), ein echtes Postfach geht über `.env`; der Rückweg einer Antwort in die Akte ist seit ADR-010 gebaut (siehe A6). |
| A5 | Datenextraktion mit Qualitätssicherung: strukturierte Daten aus unstrukturierten Dokumenten über Parser, Regex, OCR und KI-Nodes, mit Plausibilitäts- und Regelprüfung | teilweise belegbar | Parser und Regex: labelgetriebene Feldextraktion je Belegtyp in `extraktion/zollpilot_extraktion/felder/`; OCR: Tesseract mit Wortkonfidenzen in `extraktion/zollpilot_extraktion/lesen.py`; QA: Field Exact Match und Entscheidung je Akte gegen `extraktion/basislinie.json`, Plausibilität und Regeln wie A3. **Fehlt:** ein KI-Node im Workflow selbst; das Modell sitzt hinter der Extraktion als Vorschlag zum Belegtyp (A2, ADR-011), nie an einem Feldwert. |
| A6 | Integration und Routing über mehrere Systeme: REST, Webhooks und Datenbanken, Ablage in Zielsystemen wie DMS oder ERP, Weiterleitung an externe Partner wie Speditionen und Zollagenturen | teilweise belegbar | Webhooks: zwei Eingänge (`workflows/zollpilot-akte-pruefen.json`); REST: Aufruf des Extraktionsdienstes per HTTP; Datenbank: Postgres mit Fachschema (`deploy/postgres/init.sql`); Oberfläche über nginx-Proxy derselben Herkunft (`deploy/nginx/zollpilot.conf`). Dispatching: Nachforderungen adressieren Rollen (Spediteur, Zollvertreter, Lieferant) in `zustaendigkeiten.yaml`. Mail als Ausgang (Nachforderungen per SMTP) und als Eingang (`workflows/zollpilot-eingang.json`: IMAP-Trigger, Zuordnung über die Aktennummer, Anhänge an die Extraktion, Zusammenführung mit der abgelegten Akte, erneute Prüfung; unzugeordnete Mails in `mail_eingang`). Bewiesen in `scripts/rauchtest.sh`, Runde 9. **Fehlt:** DMS- und ERP-Ablage und das Dispatching an Speditionen und Zollagenturen; ein Ausgangsadapter mit Dateiablage als Referenz ist vorgesehen (`docs/OFFENE-PUNKTE.md`). |
| A7 | Prozessdokumentation | belegt | Prozesslandschaft mit fünf Rollen und Status je Schritt (gebaut, vorgesehen) in `docs/prozess/README.md`, dieselbe als BPMN 2.0 mit Lanes und Layout in `docs/prozess/sendungsakte.bpmn`; Datenfluss über alle Schichten bis ins Monitoring ebenda; Betriebshandbuch mit Runbook je Alarm in `docs/BETRIEB.md`; Fachprozess, Zuständigkeiten und Fristen in `docs/05-prozess-nachforderung.md`; Nutzersicht in `docs/PRODUKT.md`. Jedes Dokument sagt, was es nicht abdeckt. |
| A8 | Betrieb und Lebenszyklus: laufendes Monitoring, Incident Management, Fehleranalyse und Leistungsoptimierung der produktiven Flows | belegt | Monitoring: Prometheus, Alertmanager, SQL-Exporter und Grafana als Dienste in `compose.yml`, Konfiguration unter `deploy/prometheus/`, `deploy/alertmanager/`, `deploy/sql-exporter/`, `deploy/grafana/`; drei Metrikquellen (n8n-Ereigniszähler, Extraktionsmetriken in `extraktion/zollpilot_extraktion/metriken.py`, fachliche Zähler aus der Prüftabelle), Dashboard aus dem Repo provisioniert. Incident Management: elf Alarmregeln mit Schweregrad, jede mit Runbook in `docs/BETRIEB.md` (ein Gate prüft das), Alarme landen über `workflows/zollpilot-alarm.json` als Zeile in Postgres; gescheiterte Läufe werden mit Rumpf in `wiedervorlage` abgelegt und über `workflows/zollpilot-wiederholen.json` wiederholt. Fehleranalyse: Ausführungs-ID in jeder Antwort, `workflow_fehler`, Sicht `rule_result`. Performance: Dauer p50/p95 und Anteil OCR je Stunde im Dashboard, Alarm bei p95 über 60 s. Bewiesen durch `scripts/rauchtest.sh`, Runden 6 und 7, im CI-Job `betrieb`. **Grenze:** kein Mensch am Ende des Alarms, kein SMTP; Prometheus und Grafana ohne Redundanz (`docs/OFFENE-PUNKTE.md`). Hochverfügbarkeit im Sinn von Queue-Modus und Workern: nicht gebaut, siehe A1. |

### Anforderungen

| # | Anforderung | Status | Beleg im Repo |
|---|---|---|---|
| R1 | n8n-Expertise: Praxiserfahrung mit n8n oder vergleichbaren Plattformen im produktiven Einsatz, mit Setup, eigenen Code-Nodes in JavaScript, TypeScript oder Python, Fehlerbehandlung, Versionierung und Betrieb | teilweise belegbar | Wie M1 oben: Setup (`compose.yml`), Custom Code in JavaScript (`scripts/n8n-bundle.mjs`, Code-Nodes im Workflow) und ein eigener Node in TypeScript (`nodes/n8n-nodes-zollpilot/`), Fehlerbehandlung (Fehler-Workflow, Fehlerzweig, drei Antwortcodes, Wiedervorlage), Versionierung (Workflows als Export im Repo, Bundle-Check und Node-Nachbau in der CI), Betrieb mit Monitoring (`docs/BETRIEB.md`). Die Jahre im Unternehmenseinsatz kann ein Repo nicht zeigen; siehe Hinweis zu M1. |
| R2 | Digitalisierungsprojekte | teilweise belegbar | Dieses Projekt, und das Vorgängerprojekt, aus dem `docs/ARBEITSWEISE.md` abgeleitet ist. Mehr als zwei Projekte kann dieses Repo nicht zeigen. |
| R3 | Prozessverständnis in Zoll und Logistik: Dokumenttypen und Abläufe der internationalen Logistik, Verschiffung, Import und Export, Zollabwicklung | belegt | Wie M3 oben: `docs/01-dokumententypologie.md` bis `docs/08-known-unknowns.md`. Die praktische Erfahrung ist eine Erfahrungsanforderung wie M1. |
| R4 | Dokumentationskompetenz: klare, strukturierte Prozesslandschaften, Datenflussdiagramme und Betriebshandbücher | belegt | Die drei genannten Artefakte: Prozesslandschaft und Datenflussdiagramm in `docs/prozess/README.md` (gerendert im Repo) und `docs/prozess/sendungsakte.bpmn` (BPMN 2.0), Betriebshandbuch `docs/BETRIEB.md` mit Runbook je Alarm; dazu die technische Seite derselben Sache, `docs/prozess/systemlandschaft.md` (zehn Container mit Ports, Volumes und Datenwegen) und `docs/prozess/workflows.md` (alle sieben Workflows als Bild aus dem laufenden Editor, gezogen mit `scripts/bilder-ziehen.mjs`, ein Gate meldet ein fehlendes Bild); dazu zwölf Dokumente unter `docs/`, jedes mit einem Abschnitt, was es nicht abdeckt, und ein Gate, das jeden genannten Beleg auf Existenz prüft (`scripts/beleg-check.sh`). |
| R5 | Schnittstellen und Data Engineering: REST, Webhooks, JSON- und XML-Strukturen, gängige OCR- und IDP-Lösungen | teilweise belegbar | REST, Webhooks und JSON: wie A6; die Akte als JSON-Vertrag zwischen Extraktion, Regelwerk und Oberfläche (`src/akte/aufbau.mjs`). XML: UN/CEFACT Cross Industry Invoice D16B als Eingang und Ausgang, gegen das mitgelieferte Schema validiert (`extraktion/zollpilot_extraktion/cii.py`, `extraktion/zollpilot_extraktion/schema/cii/QUELLE.md`, ADR-008); eine XML-Rechnung ist ein Beleg ohne Leseunsicherheit und läuft durch dieselbe Kette. OCR und IDP: Tesseract mit Wortkonfidenzen, dazu Google Document AI und Azure Document Intelligence als zweiter und dritter Leser hinter derselben Nahtstelle, beide gemessen auf allen 32 Testbelegen (siehe N2). **Grenze:** wie N2, Läufe auf synthetischen Belegen. |
| R6 | Sicherer Umgang mit generativer KI: aktuelle Modelle und Assistenzwerkzeuge, Prompt-Entwicklung, Integration von KI-Nodes und APIs in Workflows | teilweise belegbar | Prompt-Entwicklung: die Skills, Commands, Subagents und Hooks in `.claude/` sind versionierte Prompts mit Prüfung (`docs/PIPELINE.md`); die Entwurfsprompts für Wireframe und Mockup in `docs/entwurf/`; der KI-Einsatz in der Entwicklung ist Sitzung für Sitzung protokolliert, inklusive der Fehler (`docs/ENTWICKLUNGSLOG.md`). Integration eines Modells: der Klassifikationsfallback (A2, ADR-011) ruft Claude Haiku über die Anthropic-Schnittstelle, hinter der Pseudonymisierung und nur aus Aufzeichnungen im Repo. **Fehlt:** ein KI-Node im n8n-Workflow selbst. Das ist konsequent nach ADR-003, aber es ist eine Abwesenheit. |

### Sprache

Beide Profile verlangen Deutsch. Jedes Dokument, jeder Commit und jeder
Node-Name in diesem Repo ist deutsch.

### Was beide Profile gemeinsam offen lassen

Ein Punkt steht in beiden und ist in keiner belegt: die Jahre im Betrieb
(M1, R1). Der Prozess beginnt seit ADR-010 auch bei der E-Mail, für
Antworten auf Nachforderungen; die Erstanlage einer Sendung per Mail
bleibt offen (A4, A6, E1). Das gängige IDP-Werkzeug (N2, R5) ist mit zwei
gemessenen Läufen teilweise belegt: Azure Document Intelligence am Abend des
12. September 2026, Google Document AI in der Nacht darauf, beide gleichauf
mit der Basislinie. Das Monitoring, das beide verlangen (A8,
„stabiler Betrieb mit Monitoring“), ist seit demselben Tag gebaut, ebenso
der eigene Node (A1), die Prozessdokumentation (A7, R4), XML (R5) und das
ABD (A2). Die Reihenfolge für den Rest steht in `DECISIONS.md`.

---

## Was dieses Repo grundsätzlich nicht belegen kann

- **Jahre.** Produktionserfahrung (M1) ist Zeit unter Last. Ein Repo zeigt Arbeitsweise.
- **Fremde Werkzeuge ohne Zugang.** ABBYY (N2) braucht eine Lizenz; Google und Azure sind gemessen.
- **Echte Dokumente.** Alle Testdaten sind synthetisch (`docs/DATENSCHUTZ.md`). Die
  Extraktion kennt eine Layoutfamilie, nämlich die, die `testdaten/erzeuge-belege.py`
  rendert. Die Genauigkeit auf echten Scans, Stempeln und fremden Layouts kann
  hier nicht gemessen werden; die Bewertung misst die Pipeline, nicht die
  Wirklichkeit (ADR-005).
- **Verifizierte Rechtsverweise.** Alle Artikel stammen aus Sekundärrecherche
  (`docs/08-known-unknowns.md`) und tragen im Katalog `legal_source: secondary`
  oder `practice`. Keine Regel trägt `verified`.
