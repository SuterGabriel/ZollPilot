# Sendungsakte: automatisierte Vollständigkeits- und Konsistenzprüfung von Zolldokumenten

Proof of Concept, n8n-basiert. Stand der Wissensbasis: September 2026.
Umsetzungsstand und Belege: `README.md`, `docs/ANFORDERUNGEN.md`; was fehlt:
`docs/OFFENE-PUNKTE.md`. Entscheidungen: `DECISIONS.md`.

---

## 1. Worum es geht

Das System verarbeitet keine Dokumente, sondern führt pro Sendung eine **Akte**.
Eingehende Belege sind Behauptungen über die Sendung; die Akte hält den fachlich
geprüften Zustand. Bei jedem Eingang wird neu bewertet, ob die Akte freigabereif ist.

Drei Konstruktionsprinzipien, die alles Weitere bestimmen:

**Nachweis statt Dokument.** Geprüft wird nicht "liegt Beleg X vor", sondern "ist
Datum Y nachgewiesen". Ein Präferenzursprung kann über EUR.1 oder über eine
Ursprungserklärung auf der Rechnung belegt sein; beides erfüllt dieselbe
Anforderung. Das Modell trennt deshalb `required_data`, `required_evidence` und
`required_document_form` (Anknüpfung: Art. 163 UZK).

**Rohwert und Aktenwert getrennt.** `DocumentFieldAssertion` hält, was ein Beleg
sagt (inkl. Seite, Bounding Box, Konfidenz, Extraktionsmethode). `CanonicalFact`
hält den fachlich freigegebenen Aktenwert mit Herkunft und Version. Eine
OCR-Korrektur überschreibt nie die Beweiskette (Aufbewahrung Art. 51 UZK,
§ 147 AO, GoBD).

**Regeln sind Daten, kein Code.** Schwellen (1.000 / 6.000 / 20.000 EUR, 50 t CBAM),
Toleranzen und Rechtsverweise liegen versioniert im Regelkatalog mit
`valid_from` / `valid_to`. Abkommen und Schwellen ändern sich; ein Deployment
darf dafür nicht nötig sein.

---

## 2. Scope des Prototyps

**Im Scope**

| Dimension | Festlegung |
|---|---|
| Sachverhalt | Ausfuhr in ein Drittland |
| Verkehrsträger | Seefracht (Container, FCL) |
| Besonderheit | Präferenzbeanspruchung |
| Belegtypen | Handelsrechnung, Packliste, B/L, Präferenznachweis |
| Regeln | 13 (siehe `rules.yaml`), 6 Pflichteinträge (`pflichtmatrix.yaml`) |
| Nachforderung | Eine Eskalationskette, E-Mail |

**Bewusst außerhalb**

Import, Luft- und Straßenfracht, CBAM, Dual-Use-Screening, ERP-/DMS-Anbindung,
eBL-Plattformen, ATLAS-Statusnachrichten, Kubernetes/CI-CD, kommerzielle
IDP-Produkte (ABBYY, Document AI). Alle sind in Datenmodell und Regelkatalog
vorgesehen, aber nicht implementiert. Das ist eine Aussage, keine Lücke:
"dreizehn von über vierzig Regeln implementiert, Katalog erweiterbar ohne Deployment"
ist stärker als vierzig halbfertige Checks.

---

## 3. Architektur

```
Intake  →  Klassifikation  →  Extraktion  →  Normalisierung
                                                   ↓
                          Sachverhalt bestimmen  →  Pflichtmatrix
                                                   ↓
                                            Regelwerk (hart → weich)
                                                   ↓
                                     Freigabe   |   Nachforderung ↻
```

**Intake.** Mail-Trigger, Anhänge unverändert archivieren, SHA-256 je Datei,
Thread-ID festhalten. Duplikatserkennung über Hash.

**Klassifikation.** Zweistufig: regelbasiert (Keyword- und Layoutmerkmale) mit
LLM-Fallback bei niedriger Konfidenz. Bestimmt Belegtyp, Variante, Draft/Final
sowie House/Master. Zusammengesetzte PDFs werden seitenweise aufgetrennt.

**Extraktion.** Pro Belegtyp ein festes JSON-Schema mit fünf bis acht Feldern.
Werte werden mit Konfidenz und Fundstelle gespeichert, nie nur als Wert.

**Normalisierung.** Währung, Einheiten, Länder, Firmennamen, Orte (UN/LOCODE),
Warencodes, Referenzen. Alle Regelvergleiche laufen ausschließlich auf
normalisierten Werten.

**Sachverhalt und Pflichtmatrix.** Aus Richtung, Verkehrsträger, Incoterm,
Warenart und Präferenzabsicht werden die erwarteten Nachweise instanziiert.

**Regelwerk.** Harte Regeln zuerst; bei Verstoß keine Freigabe. Danach weiche
Regeln als Warnung mit konfigurierbarer Toleranz.

**Freigabe oder Nachforderung.** Nachforderungen adressieren einen konkreten
fehlenden Wert an einen konkreten Verantwortlichen, nie "bitte alle Zollunterlagen".

---

## 4. Datenmodell (Kernobjekte)

| Objekt | Zweck |
|---|---|
| `Shipment` | Akten-ID, Richtung, Sachverhalt, Verkehrsträger, Incoterm, Fristen, Status |
| `Party` | Rolle, Name, Land, EORI, USt-IdNr., REX |
| `GoodsLine` | Beschreibung, Menge, HS/KN/TARIC, Ursprung, Präferenzstatus, Wert, Gewicht |
| `Package` | Packstück-ID, Art, Marks, Maße, Gewicht, enthaltene Positionen |
| `TransportLeg` | Modus, Carrier, POL/POD, Vessel/Voyage, Container, Seal, Termine |
| `Document` | Typ, Variante, Aussteller, Version, Final/Draft, Hash, Quelle |
| `DocumentFieldAssertion` | Dokument, Seite, BBox, Rohwert, Normalwert, Konfidenz, Methode |
| `CanonicalFact` | Freigegebener Aktenwert mit Herkunft, Version, Verantwortlichem |
| `EvidenceLink` | Verbindung Ware ↔ Beleg ↔ Nachweis ↔ Anmeldeposition |
| `RuleResult` | Regelversion, Schweregrad, Eingabewerte, Ergebnis, Begründung, Override |
| `RequestCase` | Fehlendes Feld, Adressat, Frist, Reminder, Eskalation, Antwortstatus |

**Rollenmodellierung:** Verkäufer, Ausführer, Shipper, Consignee, Käufer und
Anmelder sind getrennte Rollen. Ein pauschaler Stringvergleich zwischen
Rechnung und B/L erzeugt bei Streckengeschäften systematisch Fehlalarme.

---

## 5. Validierungsschichten

Reihenfolge ist bewusst: das Billigste und Sicherste zuerst.

**Stufe 1, offline deterministisch.** Vollständig ohne Netz prüfbar und damit
harte Gates: Container-ID (ISO 6346, Modulo 11), AWB-Seriennummer (Modulo 7),
USt-IdNr. DE (Format plus Prüfziffer), Incoterm gegen Wertliste, Summenlogik der
Rechnung, Datumschronologie, Gewichtslogik (brutto ≥ netto > 0).

**Stufe 2, Online-Lookups, nicht blockierend.** EORI (TAXUD EOS), USt-IdNr.
(VIES, § 18e UStG), REX-Portal, UN/LOCODE, TARIC/EZT. Asynchron mit Retry, da die
Verfügbarkeit schwankt. Ein Lookup-Ausfall darf die Akte nicht blockieren.

**Stufe 3, semantisch.** Warenbeschreibung, Layoutvarianten, Feldzuordnung in
Tabellen. Hier arbeitet das Modell, nie allein entscheidend.

**Grundsatz:** Cross-Document-Prüfungen laufen ausschließlich auf normalisierten
Assertions, nie auf LLM-Freitext. Ein Modell darf extrahieren und normalisieren,
aber nicht entscheiden.

---

## 6. Fehlerbehandlung und Betrieb

**OCR-Fehler von Fachfehlern trennen.** Eine gescheiterte Prüfziffer bei niedriger
Konfidenz erzeugt zuerst `re-extraction_required`, nicht sofort eine fachliche
Ablehnung. Sonst blockiert das System korrekte Akten wegen Lesefehlern.

**Retry-Strategie.** Externe Lookups: exponentielles Backoff, drei Versuche, dann
Degradation auf Formatprüfung mit Vermerk. OCR-Dienst: ein Retry, dann Human Review.

**Unbekannter Belegtyp.** Akte nicht blockieren, sondern als `unclassified`
anhängen, Sachbearbeiter benachrichtigen. Stillschweigendes Verwerfen ist der
gefährlichste Fehlerfall.

**Review-Routing nach Risiko, nicht nach Konfidenz.** Jede Regel trägt eine
Konsequenz und eine Risikoklasse. Ein unsicheres Feld ohne wirtschaftliche Folge
geht durch; ein sicheres Feld mit Nacherhebungsrisiko geht in Review.

**Audit.** Für jeden Befund werden Originalbild, Fundstelle, Rohantwort,
Modell- und Promptversion, Regelversion, Normalisierung und Benutzer-Override
gespeichert. Overrides nur mit Begründung und Benutzeridentität.

**Monitoring.** Straight-through-Rate, False-Negative-Rate der harten Regeln,
Klassifikationsgenauigkeit, Extraktionsgenauigkeit je Belegtyp, Alter offener
Nachforderungen.

---

## 7. Metriken

Nicht OCR-Zeichengenauigkeit ist die Leitkennzahl, sondern die **aktenweite
korrekte Entscheidung**. Ein einziger falsch erkannter Betrag, HS-Code oder
Container kann trotz 99 % korrekter Zeichen prozesskritisch sein.

Zu berichten, jeweils getrennt nach Belegtyp und Scanqualität:
Klassifikationsgenauigkeit, Field Exact Match, Line-Item F1,
Straight-through-Rate, False-Negative-Rate harter Regeln, False-Positive-Rate.

Realistische Erwartung aus der Recherche: Feldgenauigkeit bei sauberen digitalen
PDFs 85–95 %, bei Scans mit Stempeln und Handschrift deutlich darunter.
Anbieterangaben von 95 %+ stammen aus kuratierten Testsets und sind nicht
übertragbar.

---

## 8. Testdaten

Sieben synthetische Akten, ausschließlich erfundene Firmen und Werte. Sie
liegen zweimal vor: als bereits extrahierte Datensätze in `testdaten/akten/`
(erzeugt von `testdaten/erzeuge-akten.mjs`, jede mit ihrer erwarteten
Entscheidung, das Golden Set) und als Belege in `testdaten/belege/` (je
Handelsrechnung, Packliste und B/L als PDF, erzeugt daraus von
`testdaten/erzeuge-belege.py`, byteidentisch reproduzierbar). Der schlechte
Scan ist dort ein echtes Bild für Tesseract. Darunter zwingend:

- eine vollständige, widerspruchsfreie Akte (Happy Path)
- eine Akte mit fehlendem Präferenznachweis
- eine Akte mit Ursprungswiderspruch zwischen Rechnung und Nachweis
- eine Akte mit abweichender Containernummer
- ein Draft-B/L, das nicht als finale Quelle verwendet werden darf
- ein schlechter Scan mit Stempel für den Konfidenzpfad

Der Fehlerpfad ist der eigentliche Demo-Inhalt. Ein Flow, der nur den Happy Path
kann, überzeugt niemanden.

---

## 9. Known Unknowns

Bewusst offen gelassen, nicht vergessen:

- **MRN-Prüfziffer.** Länge 18 und Prüfziffer an Stelle 18 sind unstrittig; die
  Positionslogik der Verfahrenskennung wird in Sekundärquellen widersprüchlich
  beschrieben (Position 11–12 vs. 17). Der Algorithmus ist gegen echte MRN zu
  testen; schlägt er fehl, bleibt es bei der Strukturprüfung.
- **Ausfuhrfrist 150 Tage.** Als eigenständige UZK-DA/IA-Frist nicht
  verifizierbar. Belastbar ist das Suchverfahren nach Art. 335 UZK-IA.
- **Gültigkeitsdauer von Präferenznachweisen.** Abkommensabhängig; für die
  konkret abgedeckten Abkommen im jeweiligen Ursprungsprotokoll nachzuschlagen.
- **Wortlaut der Ursprungserklärung.** Existiert je Abkommen individuell, ist
  aus zoll.de / WUP-Online zu ziehen.
- **Gewichtstoleranzen.** Es gibt keine gesetzliche EU-Zolltoleranz. Der Startwert
  im Katalog ist Praxisannahme und als solche gekennzeichnet.
- **Demurrage- und Detention-Sätze, Cut-off-Zeiten.** Reederei- und
  buchungsindividuell, zu parametrisieren.
- **USt-IdNr.-Prüfalgorithmus (MOD 11,10).** Nur über Sekundärquellen belegt.
- **EU-Zollreform.** Politisch geeinigt, noch nicht im Amtsblatt. Zeitplan
  (E-Commerce 2028, Öffnung 2031, verpflichtend 2034) aus Ratspressemitteilung.

Alle Rechtsverweise im Regelkatalog sind vor produktivem Einsatz gegen
konsolidierte EUR-Lex-Fassungen und zoll.de zu verifizieren.

---

## 10. Regulatorischer Ausblick

Was das Datenmodell bis 2028 beeinflusst:

- **ICS2 R3** (See seit 06/2024, Straße und Schiene seit 09/2025) verlangt
  HS-6 und Beteiligtendaten bereits vor Verladung. Konsistenz muss früher
  hergestellt sein, nicht erst vor der Zollanmeldung.
- **ATLAS 10.2 / AES-P1** (Echtbetrieb seit 28.02.2026): MRN als primäre
  Registriernummer, zentrale Zollabwicklung bei der Einfuhr. Wo möglich sollte
  die AES-Nachricht die Quelle sein, nicht der PDF-Druck des ABD.
- **eFTI** (Vollanwendung ab 09.07.2027): maschinenlesbarer Frachtdatensatz.
  Der gemeinsame eFTI-Datensatz ist ein sinnvoller Zielschema-Kandidat.
- **eBL / DCSA**: Plattformübergreifender Austausch seit 2026 möglich. B/L wird
  schrittweise vom PDF zum API-Datensatz. Das Modell braucht dafür `issued`,
  `controller`, `endorsed`, `surrendered`, nicht nur `document_file`.
- **CBAM** seit 01.01.2026 in der Definitivphase mit 50-t-Schwelle.
- **EU Customs Data Hub**: für B2B-See- und LKW-Verkehr vor 2028 keine
  unmittelbare Umstellung; Datenmodell sollte auf UZK-Anhang-B-Datenelemente
  abbilden statt auf Formulare, damit die spätere Anbindung kein Rewrite wird.

---

## 11. Offene fachliche Fragen an den Auftraggeber

1. Soll nur die Freigabereife geprüft oder auch die Anmeldung erzeugt werden?
2. Auf welcher Ebene wird die Akte geführt: PO, Rechnung, House Shipment, Container oder MRN?
3. Wie werden Teilsendungen, Sammelcontainer und Rechnungen mit mehreren MRN modelliert?
4. Woher kommt die Wahrheit für den HS-Code, und wer gewinnt bei Konflikt?
5. Wer verantwortet fachlich Einreihung, Ursprung und Zollwert?
6. Welche Präferenzabkommen deckt der MVP ab, und in welcher Regelversion?
7. Welche Felder dürfen automatisch korrigiert werden, welche brauchen Vier-Augen-Prinzip?
8. Welche Toleranzen gibt der Zollverantwortliche frei, und wie wird das dokumentiert?
9. Welche Fehlerrate ist für MRN, EORI, Betrag, HS-Code, Ursprung und Container akzeptabel?
10. Welche Daten dürfen an Cloud-IDP- oder Vision-LLM-Anbieter, in welcher Region, mit welcher Aufbewahrung und welchem Ausschluss von Modelltraining?
