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
| M2 | Erfahrung mit IDP/OCR und Datenextraktion aus Dokumenten | in Arbeit | Architektur und Anbieterbewertung in `docs/07-idp-ocr.md`; das Datenmodell trennt Belegaussage und Aktenwert (`src/akte/aufbau.mjs`, Tabellen `document_field_assertion` und `canonical_fact` in `deploy/postgres/init.sql`); Konfidenzpfad implementiert: Prüfziffernfehler bei niedriger Konfidenz löst Nachextraktion aus, nicht Ablehnung (`src/regeln/TRN-02.mjs`, Testakte `testdaten/akten/schlechter-scan.json`). **Die Extraktion selbst ist noch nicht gebaut**, siehe `docs/OFFENE-PUNKTE.md`. |
| M3 | Erfahrung im Logistik-/Zollumfeld (Dokumenttypen & Prozesse) | belegt | Dokumententypologie mit Feldern und Fehlerquellen in `docs/01-dokumententypologie.md`; Pflichtmatrix, Schwellen und Incoterms in `docs/02-pflichtmatrix.md`; Regelkatalog mit über vierzig Regeln in `docs/03-regelwerk-vollstaendig.md`, davon 13 ausführbar in `rules.yaml`; Prozess, Zuständigkeiten und Fristen in `docs/05-prozess-nachforderung.md`; Regulatorik bis 2028 in `docs/06-regulatorik.md`; Grenzen des eigenen Wissens in `docs/08-known-unknowns.md` |
| M4 | Custom Code Knowhow mit JavaScript oder Python | belegt | Regelwerk, Validatoren und Normalisierung in `src/` (JavaScript, ohne Framework); 89 Tests in `tests/` mit Grenzfällen je Regel; Prüfziffern ISO 6346 und Mod 7 gegen Referenzwerte in `tests/validatoren/container.test.mjs`; eigene Gates in `scripts/` mit eigener Testsuite `scripts/regel-check.test.mjs` |

> **Zu M1, offen benannt:** „Nachgewiesene Produktionserfahrung“ ist eine
> Erfahrungs-, keine Werkzeuganforderung. Dieses Repo zeigt, *wie* n8n
> produktionstauglich eingesetzt wird — Entscheidung außerhalb des Workflows,
> Workflow als Build-Artefakt, Fehlerpfad, Betriebsdokument. Es kann nicht
> ersetzen, einen n8n-Betrieb über Monate mit echtem Ticketaufkommen getragen
> zu haben. Das wird im Gespräch so gesagt.

### Nice-to-have

| # | Anforderung (wörtlich) | Status | Beleg im Repo |
|---|---|---|---|
| N1 | Knowhow mit Kubernetes, Docker und CI/CD | teilweise belegbar | Docker: `compose.yml` mit drei Diensten, Healthchecks und Volumes; CI/CD: `.github/workflows/ci.yml` mit sechs Jobs, darunter ein Job, der den Stack hochfährt und den Rauchtest ausführt. **Kubernetes: nichts im Repo**, siehe `docs/OFFENE-PUNKTE.md`. |
| N2 | Erfahrung mit gängigen IDP-Tools (z.B. ABBYY oder Google Document AI) | nicht belegbar | Vergleich der Anbieter nach Tabellen, Stempeln, Training, Hosting und Rolle in `docs/07-idp-ocr.md`. Ohne Lizenz beziehungsweise Projektzugang lässt sich kein Aufruf im Repo zeigen; die Bewertung ist Recherche, nicht Erfahrung. |

### Ergebnisse aus der Ausschreibung (was das Projekt abbildet)

| # | Ergebnis (wörtlich) | Status | Abbildung im Projekt |
|---|---|---|---|
| E1 | produktionstaugliche n8n‑Flows inkl. Integrationen | in Arbeit | `workflows/zollpilot-akte-pruefen.json` (Webhook → Prüfung → Postgres → Verzweigung → Antwort/Nachforderung), `workflows/zollpilot-fehler.json`; Integrationen: Postgres angebunden, E-Mail-Node vorbereitet und bewusst deaktiviert (`docs/BETRIEB.md`). Offen: Mail-Intake, DMS/ERP. |
| E2 | eine IDP‑Pipeline mit Grund‑QA/Validierung | in Arbeit | Validierung steht: `src/regelwerk.mjs`, `rules.yaml`, `pflichtmatrix.yaml`, Konfidenzpfad; Pipeline-Architektur in `docs/07-idp-ocr.md`. Extraktion und Klassifikation offen. |
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
  Extraktionsgenauigkeit auf echten Scans kann hier nicht gemessen werden.
- **Verifizierte Rechtsverweise.** Alle Artikel stammen aus Sekundärrecherche
  (`docs/08-known-unknowns.md`) und tragen im Katalog `legal_source: secondary`
  oder `practice`. Keine Regel trägt `verified`.
