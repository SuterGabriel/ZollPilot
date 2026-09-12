# 07 — IDP- und OCR-Landschaft

## Begriffsklärung

**OCR** ist die unterste Schicht: aus Pixeln werden Zeichen mit Koordinaten und
Konfidenz. OCR weiß nicht, dass `DEHAM` ein Verladehafen ist.

**IDP** (Intelligent Document Processing) ist die gesamte Kette: Vorverarbeitung,
Klassifikation, Extraktion, Normalisierung, Validierung, Human-in-the-Loop. Ein
Prozessbegriff, kein Modellbegriff.

## Empfohlene Architektur

1. **Deterministische Vorverarbeitung** — Rotation, Deskew, Denoising, Kontrast,
   Barcode-/QR-Erkennung, Prüfung auf vorhandenen PDF-Textlayer. Digital erzeugte
   PDFs brauchen kein OCR; das zu erkennen spart Kosten und Fehler.
2. **Klassifikation** — auf Datei- und Seitenebene; zusammengesetzte PDFs auftrennen.
3. **Primäre Extraktion** — spezialisierter Parser oder trainiertes Layoutmodell,
   liefert Koordinaten und Konfidenz.
4. **Sekundäre Extraktion** — Vision-LLM nur für unklare Felder, Tabellenzuordnung
   und semantische Normalisierung.
5. **Deterministische Validatoren** — Summen, Regex, ISO 6346, AWB-Mod-7,
   Datumslogik, Währung, Referenzen (siehe `04-stammdaten-formate.md`).
6. **Cross-Document-Reasoning** — ausschließlich auf normalisierten Assertions,
   nie auf LLM-Freitext.
7. **Human Review** — nach Schweregrad, Konfidenz und wirtschaftlichem Risiko.
8. **Audit** — Originalbild, Bounding Box, Rohantwort, Modellversion, Promptversion,
   Normalisierung, Benutzer-Override.

**Wirtschaftlich wichtigster Hebel:** OCR und Feldextraktion trennen. Gebündelte
Produkte sind um ein Vielfaches teurer als die Kombination aus günstigem OCR und
eigener Extraktionslogik.

## Der Konfidenz-Fallstrick

Vision-LLMs liefern **keine kalibrierten Konfidenzen und keine Koordinaten**. Ein
Modell, das auf einem schlechten CMR-Scan eine Containernummer halluziniert, meldet
nicht, dass es geraten hat. Der Ersatz dafür sind Prüfziffern, Summenlogik und
Cross-Document-Abgleich. Das ist der Grund, warum TRN-02 und VAL-01 im Regelkatalog
stehen.

## Anbieter

| Lösung | Tabellen | Handschrift/Stempel | Training | Hosting | Rolle |
|---|---|---|---|---|---|
| ABBYY (Vantage, FlexiCapture) | stark, regelbasiert konfigurierbar | ICR gut, Stempel mäßig | hoch, aber Skills vorhanden | on-prem und EU-Cloud | Enterprise-Pipeline mit auditierbarer Extraktion; erste Wahl bei Dual-Use-/Sanktionsdaten |
| Google Document AI | gut (Layout Parser, Custom Extractor) | Handschrift gut, Stempel schwach | ~10–50 Beispiele | EU-Region wählbar | skalierbare API-Extraktion |
| Azure Document Intelligence | gut, Confidence je Feld | Handschrift gut, Stempel via Custom Neural | ab wenigen Beispielen | EU-Regionen | Microsoft-Stacks |
| AWS Textract | solide Forms/Tables/Queries | Handschrift gut, Stempel schwach | kaum | eu-central-1 | serverlose AWS-Pipeline |
| Tesseract | schwach | kaum | Fine-Tuning aufwendig | beliebig | Baseline, Textlayer, on-prem |
| PaddleOCR | gut, Tabellenerkennung vorhanden | mittel | mittel | beliebig | anpassbare OSS-Pipeline |
| docTR | mittel | mittel | mittel | beliebig | Python-/DL-Integration |
| Vision-LLM | sehr gut bei Layoutverständnis, schwach bei langen Zahlentabellen | semantisch gut, Zeichenebene unzuverlässig | Prompt + Schema | anbieterabhängig | Fallback, Klassifikation, Normalisierung |

## Genauigkeit realistisch einschätzen

Es existiert **kein unabhängiger Benchmark auf einem Zolldokumentkorpus**. Alle
Anbieterzahlen stammen aus kuratierten Testsets. Eine behauptete "95 % Accuracy"
kann Zeichen-, Wort-, Feld- oder dokumentweite Genauigkeit meinen.

Erfahrungswerte: Zeichengenauigkeit bei sauberem Druck über 99 %. Feldgenauigkeit
bei Rechnungen ohne Training 85–92 %. Bei Scans mit Stempeln, Durchschlägen (CMR)
und Handschrift fällt sie auf 60–80 %. Akademische Benchmarks (OmniDocBench, DocVQA,
FUNSD, CORD, SROIE) messen generische Aufgaben und sind nur begrenzt übertragbar.

## Kennzahlen

| Kennzahl | Definition | Zweck |
|---|---|---|
| Document Classification Accuracy | korrekt klassifiziert / alle | Routing und Pflichtmatrix |
| Field Exact Match | exakt richtige normalisierte Werte / erwartete Felder | IDs, Codes, Beträge, Daten |
| Character Error Rate | Zeichenfehler / Referenztext | OCR-Baseline |
| Line-item F1 | erkannte Tabellenzeilen und Zellzuordnungen | Rechnung, Packliste |
| Straight-through Rate | automatisch freigegebene Akten / alle | Wirtschaftlichkeit |
| False-negative Rate harter Regeln | übersehene echte Fehler / alle echten Fehler | Risikosteuerung |
| False-positive Rate | unnötig blockierte korrekte Akten | operative Belastung |
| Calibration Error | Konfidenz vs. tatsächliche Trefferquote | Review-Routing |

**Leitkennzahl ist nicht die OCR-Zeichengenauigkeit, sondern die aktenweite korrekte
Entscheidung.** Ein einziger falsch erkannter Betrag, HS-Code, MRN-Zeichen oder
Container kann trotz 99 % korrekter Zeichen prozesskritisch sein.

Berichtet wird auf einem eigenen Golden Set, getrennt nach Belegtyp und Variante,
Scanqualität (digital / Scan / Foto / Fax), Sprache, Tabellen-, Stempel- und
Handschriftanteil, Carrier bzw. Lieferant, Feldklasse und Automatisierungsgrad.

## Datenschutz

Azure, Google und AWS bieten EU-Regionen; ABBYY und die Open-Source-Varianten
erlauben vollständige On-Premise-Verarbeitung. Für Dual-Use- und personenbezogene
Sendungsdaten ist on-prem die sicherere Wahl. Vertraglich zu klären: Region,
Retention, Logging, Unterauftragsverarbeiter und Ausschluss von Modelltraining auf
Kundendaten.

## Entscheidungspunkte

- Produktive Extraktionsgenauigkeit unter 85 % auf realen Belegen → ABBYY on-prem
  oder Vision-LLM-Ensemble evaluieren.
- eBL-Anteil der Reedereien über 50 % → API-basierte B/L-Aufnahme statt OCR priorisieren.
- CBAM-Warengruppen über 50 t/Jahr → eigener Pflichtzweig.
