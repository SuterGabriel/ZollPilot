# Anforderungs-Mapping

Dieses Dokument ist der Auftraggeber dieses Projekts. Es entstand **vor** dem
Code und wird bei jeder Stufe gegen den Stand des Repos abgeglichen
(`/anforderungs-mapping`). Der Beleg-Check in Hook und CI prüft, dass jeder
Pfad in der Belegspalte existiert.

Jede Zeile stammt wörtlich aus der Ausschreibung. Leere Belege sind ehrlich
leer.

**Legende Status:** `offen` = noch nichts im Repo · `in Arbeit` = angefangen ·
`belegt` = im Repo nachprüfbar · `teilweise belegbar` = das Repo zeigt die
Arbeitsweise, nicht die Jahre — mit Hinweis, was fehlt · `nicht belegbar` = durch
ein Portfolio-Projekt grundsätzlich nicht nachweisbar, wird offen angesprochen ·
`zu klären` = formale Anforderung außerhalb des Repos.

---

## Ausschreibung: n8n-Workflows für Dokumentenprozesse in Logistik und Zoll

Start asap · Dauer 9 Monate+ · Einsatzort Großraum Stuttgart / remote ·
Stand der Ausschreibung: September 2026

### Aufgabe (wörtlich)

> Sie bauen produktive n8n‑Workflows zur Automatisierung von
> Dokumentenprozessen in der Logistik-/Zollumgebung auf, integrieren
> IDP/OCR‑Komponenten und stellen einen stabilen Betrieb mit Monitoring
> sicher. Als Ergebnis liefern Sie produktionstaugliche n8n‑Flows inkl.
> Integrationen, eine IDP‑Pipeline mit Grund‑QA/Validierung sowie eine
> Kurz‑Dokumentation mit Übergabe an Betrieb/Support.

### Must-have

| # | Anforderung (wörtlich) | Status | Beleg im Repo |
|---|---|---|---|
| M1 | Nachgewiesene Produktionserfahrung mit n8n (Entwicklung und Betrieb) | teilweise belegbar | Zwei Workflows als Export in `workflows/` (Prüfung mit Webhook, Postgres, IF, Respond; Fehler-Workflow mit Error Trigger); Betrieb mit `compose.yml` (Healthchecks, idempotenter Import, Metriken, Execution-Pruning), `scripts/rauchtest.sh` gegen das laufende System, Übergabe in `docs/BETRIEB.md`. Siehe Hinweis unten. |
| M2 | Erfahrung mit IDP/OCR und Datenextraktion aus Dokumenten | belegt | Extraktionspipeline in `extraktion/` (Python, ADR-005): Textlayer mit Koordinaten oder Tesseract mit Wortkonfidenzen (`extraktion/zollpilot_extraktion/lesen.py`), regelbasierte Klassifikation mit Draft-Erkennung, labelgetriebene Feldextraktion je Belegtyp (`extraktion/zollpilot_extraktion/felder/`), jede Assertion mit Fundstelle, Konfidenz und Methode; Anbieterbewertung in `docs/07-idp-ocr.md`; Datenmodell trennt Belegaussage und Aktenwert (`src/akte/aufbau.mjs`, `deploy/postgres/init.sql`); Konfidenzpfad: Prüfziffernfehler bei niedriger Konfidenz löst Nachextraktion aus (`src/regeln/TRN-02.mjs`); Golden Set aus sieben Belegsätzen (PDF) in `testdaten/belege/`, Messung Field Exact Match und Entscheidung je Akte gegen `extraktion/basislinie.json` (`docs/EXTRAKTION.md`). **Grenze, offen benannt:** labelgetrieben, eine Layoutfamilie, synthetische Belege — Genauigkeit auf echten Scans ist hier nicht messbar (`docs/OFFENE-PUNKTE.md`). |
| M3 | Erfahrung im Logistik-/Zollumfeld (Dokumenttypen & Prozesse) | belegt | Dokumententypologie mit Feldern und Fehlerquellen in `docs/01-dokumententypologie.md`; Pflichtmatrix, Schwellen und Incoterms in `docs/02-pflichtmatrix.md`; Regelkatalog mit über vierzig Regeln in `docs/03-regelwerk-vollstaendig.md`, davon 13 ausführbar in `rules.yaml`; Prozess, Zuständigkeiten und Fristen in `docs/05-prozess-nachforderung.md`; Regulatorik bis 2028 in `docs/06-regulatorik.md`; Grenzen des eigenen Wissens in `docs/08-known-unknowns.md` |
| M4 | Custom Code Knowhow mit JavaScript oder Python | belegt | JavaScript: Regelwerk, Validatoren und Normalisierung in `src/` (ohne Framework), 89 Tests in `tests/` mit Grenzfällen je Regel, Prüfziffern ISO 6346 und Mod 7 gegen Referenzwerte in `tests/validatoren/container.test.mjs`, eigene Gates in `scripts/` mit Testsuite `scripts/regel-check.test.mjs`. Python: Extraktionsdienst in `extraktion/` (FastAPI, pdfplumber, Tesseract) mit 98 Tests in `extraktion/tests/`, Belegerzeugung `testdaten/erzeuge-belege.py`, Bewertung `extraktion/zollpilot_extraktion/bewertung.py`. Beide Sprachen dort, wo ihre Werkzeuge sind — nicht nebeneinander zur Schau. |

> **Zu M1, offen benannt:** „Nachgewiesene Produktionserfahrung“ ist eine
> Erfahrungs-, keine Werkzeuganforderung. Dieses Repo zeigt, *wie* n8n
> produktionstauglich eingesetzt wird — Entscheidung außerhalb des Workflows,
> Workflow als Build-Artefakt, Fehlerpfad, Betriebsdokument. Es kann nicht
> ersetzen, einen n8n-Betrieb über Monate mit echtem Ticketaufkommen getragen
> zu haben. Das wird im Gespräch so gesagt.

### Nice-to-have

| # | Anforderung (wörtlich) | Status | Beleg im Repo |
|---|---|---|---|
| N1 | Knowhow mit Kubernetes, Docker und CI/CD | teilweise belegbar | Docker: `compose.yml` mit vier Diensten, Healthchecks und Volumes, mehrstufiges `extraktion/Dockerfile` (Basis, Test mit pytest beim Build, Laufzeit ohne Root); CI/CD: `.github/workflows/ci.yml` mit sieben Jobs, darunter die Python-Bewertung gegen eine Basislinie und ein Job, der den Stack baut, hochfährt und den Rauchtest mit Akten und PDFs ausführt. **Kubernetes: nichts im Repo**, siehe `docs/OFFENE-PUNKTE.md`. |
| N2 | Erfahrung mit gängigen IDP-Tools (z.B. ABBYY oder Google Document AI) | nicht belegbar | Vergleich der Anbieter nach Tabellen, Stempeln, Training, Hosting und Rolle in `docs/07-idp-ocr.md`. Die Nahtstelle ist gebaut — ein Anbieter ersetzt `extraktion/zollpilot_extraktion/lesen.py` (Wörter mit Koordinaten und Konfidenz) und liefert dieselbe Assertion —, aber Tesseract ist kein gängiges IDP-Tool im Sinne der Ausschreibung. Ohne Lizenz beziehungsweise Projektzugang lässt sich kein Aufruf im Repo zeigen; die Bewertung ist Recherche, nicht Erfahrung. |

### Ergebnisse aus der Ausschreibung (was das Projekt abbildet)

| # | Ergebnis (wörtlich) | Status | Abbildung im Projekt |
|---|---|---|---|
| E1 | produktionstaugliche n8n‑Flows inkl. Integrationen | in Arbeit | `workflows/zollpilot-akte-pruefen.json` mit zwei Eingängen (Akte als Assertions, Belege als PDF), Prüfung, Postgres, Verzweigung, Antwort/Nachforderung; `workflows/zollpilot-fehler.json`; Integrationen: Postgres angebunden, Extraktionsdienst per HTTP angebunden (`docs/EXTRAKTION.md`), E-Mail-Node vorbereitet und bewusst deaktiviert (`docs/BETRIEB.md`). Offen: Mail-Intake, DMS/ERP. |
| E2 | eine IDP‑Pipeline mit Grund‑QA/Validierung | belegt | Pipeline: Lesen, Klassifikation, Extraktion, Normalisierung in `extraktion/`; Validierung: `src/regelwerk.mjs`, `rules.yaml`, `pflichtmatrix.yaml`, Konfidenzpfad. Grund-QA: Field Exact Match je Belegtyp und Entscheidung je Akte gegen das Golden Set, mit Basislinie im Repo und als CI-Job (`docs/EXTRAKTION.md`, `docs/PIPELINE.md`). Auf synthetischen Belegen; siehe M2. |
| E3 | eine Kurz‑Dokumentation mit Übergabe an Betrieb/Support | belegt | `docs/BETRIEB.md` (Start, Stopp, Logs, Datenbank, Re-Import, Fehlertabelle, was vor echtem Betrieb fehlt); `README.md` als Einstieg |

### Formal

| # | Anforderung | Status | Anmerkung |
|---|---|---|---|
| F1 | Start: asap | zu klären | außerhalb des Repos |
| F2 | Dauer: 9 Monate+ | zu klären | außerhalb des Repos |
| F3 | Einsatzort: GR Stuttgart / remote | zu klären | außerhalb des Repos |

---

## Was dieses Repo grundsätzlich nicht belegen kann

- **Jahre.** Produktionserfahrung (M1) ist Zeit unter Last. Ein Repo zeigt Arbeitsweise.
- **Fremde Werkzeuge ohne Zugang.** ABBYY und Document AI (N2) brauchen Lizenz oder Projekt.
- **Echte Dokumente.** Alle Testdaten sind synthetisch (`docs/DATENSCHUTZ.md`). Die
  Extraktion kennt eine Layoutfamilie — die, die `testdaten/erzeuge-belege.py`
  rendert. Die Genauigkeit auf echten Scans, Stempeln und fremden Layouts kann
  hier nicht gemessen werden; die Bewertung misst die Pipeline, nicht die
  Wirklichkeit (ADR-005).
- **Verifizierte Rechtsverweise.** Alle Artikel stammen aus Sekundärrecherche
  (`docs/08-known-unknowns.md`) und tragen im Katalog `legal_source: secondary`
  oder `practice`. Keine Regel trägt `verified`.
