# 03 — Regelwerk (vollständig)

Konsolidiert aus drei unabhängigen Recherchen. Die mit **[MVP]** markierten Regeln
sind in `rules.yaml` implementiert; der Rest ist vorgesehen, aber nicht gebaut.

**Bewertungslogik.** Hart = blockiert die Freigabe. Weich = Warnung, menschliche
Bestätigung genügt. Toleranzen sind Konfigurationswerte, keine gesetzlichen
Toleranzen. Alle Vergleiche laufen nach Normalisierung.

## Wert und Zollwert

| ID | Regel | Härte | Grundlage | Konsequenz |
|---|---|---|---|---|
| VAL-01 **[MVP]** | Summe Positionswerte + Zuschläge − Rabatte = Rechnungsendbetrag | hart | Art. 70 UZK | Zollwertbasis unzuverlässig |
| VAL-02 | Angemeldeter Preis = Rechnungsbetrag − Nicht-Warenpositionen ± Gutschriften | hart | Art. 70 UZK | Nacherhebung Art. 105 UZK |
| VAL-03 **[MVP]** | Kostenlose Position hat Zollwert > 0 oder dokumentierte Bewertungsmethode | hart | Art. 74 UZK | keine Freigabe ohne Bewertung |
| VAL-04 | Währung der Anmeldung = Rechnungswährung, sonst Kurs + Kursdatum nachgewiesen | hart | Art. 53 UZK, Art. 146 UZK-IA | falsche Bemessungsgrundlage |
| VAL-05 | Bei EXW/FCA/FAS/FOB: Vorkosten bis EU-Eingangsstelle enthalten oder hinzugerechnet | hart | Art. 71 Abs. 1 lit. e UZK | Zollwert zu niedrig |
| VAL-06 | Bei CPT/CIP/CFR/CIF/DAP/DPU/DDP: enthaltene Fracht nicht nochmals hinzurechnen | hart | EuGH C-75/20 | Doppelzählung |
| VAL-07 | Abzug innergemeinschaftlicher Fracht nur bei getrenntem Ausweis | hart | Art. 72 UZK | Abzug wird versagt |
| VAL-08 | Verbundenheit "ja" + Lizenzgebühr im Vertrag → Hinzurechnung deklariert | weich | Art. 71 Abs. 1 lit. c UZK | Nacherhebung |

## Ursprung und Präferenz

| ID | Regel | Härte | Grundlage | Konsequenz |
|---|---|---|---|---|
| ORG-01 | Nichtpräferenzieller Ursprung je Position = Ursprung im IHK-UZ | hart | Art. 60 UZK | Antidumping, Beschau |
| ORG-02 **[MVP]** | Präferenzursprung gilt für dieselbe Ware, Menge und Tarifposition | hart | Ursprungsprotokoll, Art. 64 UZK | Präferenzverlust, Nacherhebung 3 J. |
| ORG-03 **[MVP]** | A.TR setzt **nicht** den Präferenzursprung | hart | Beschluss 1/2006 EU-TR | unberechtigte Präferenz |
| ORG-04 | Rechnungsdatum im LLE-Gültigkeitszeitraum, Artikel in LLE-Warenliste | hart | Art. 62 UZK-IA | Vornachweis fehlt |
| ORG-05 | LLE-Ursprung und Ländergruppe decken den beabsichtigten Nachweis | hart | Art. 61–66 UZK-IA | "EU origin" ohne Abkommensbezug reicht nicht |
| ORG-06 **[MVP]** | Über 6.000 EUR Ursprungswert nur mit REX/Ermächtigtem Ausführer | hart | Art. 61–66 UZK-IA | Nachweis unwirksam |
| ORG-07 | Wortlaut der Ursprungserklärung zeichengetreu zur Abkommensversion | hart | Ursprungsprotokoll | formell ungültig |
| ORG-08 | Präferenznachweis nur bei bestehendem Abkommen (Lookup) | weich | Abkommensliste | Nachweis wirkungslos |

## Tarif und Klassifikation

| ID | Regel | Härte | Grundlage | Konsequenz |
|---|---|---|---|---|
| CLS-01 **[MVP]** | HS-6 identisch über Rechnung, Ursprungspapier, Genehmigung, Anmeldung | hart | Ursprungsregeln sind HS-basiert | Nacherhebung, Präferenzverlust |
| CLS-02 **[MVP]** | Ausfuhr 8-stellig (KN), Einfuhr DE 11-stellig (EZT) | hart | zoll.de | Maßnahmenermittlung unmöglich |
| CLS-03 | HS-6 des Lieferanten darf auf 8/10/11 erweitert werden bei gleichem Präfix | weich | Praxis | nationale Untergliederung separat klassifizieren |
| CLS-04 | Freitextbeschreibung stützt Material, Funktion und Typ des Codes semantisch | weich | Art. 15 UZK | Beschau, Fehlklassifikation |
| CLS-05 | Genehmigung deckt Tarifcode, Menge, Wert, Empfänger und Land der Position | hart | VO 2021/821 | Straftat § 18 AWG |

## Menge, Gewicht, Packstücke

| ID | Regel | Härte | Grundlage | Konsequenz |
|---|---|---|---|---|
| QTY-01 **[MVP]** | Rechnungsmenge = Packlistensumme abzüglich dokumentierter Backorders | hart | Konsistenz der Anmeldedaten | beeinflusst Wert, Ursprung, Lizenzmenge |
| QTY-02 **[MVP]** | Bruttogewicht Packliste ≈ Frachtpapier (Toleranz konfigurierbar) | weich, hart ab 10 % | keine gesetzliche Toleranz; VGM nach SOLAS VI/2 | Rückfrage beim Verlader |
| QTY-03 **[MVP]** | Brutto ≥ netto > 0 je Packstück und gesamt | hart | Logik | Rohmasse unbrauchbar |
| QTY-04 | Colli im Frachtbrief = äußere Handling Units, nicht Summe aller Innenkartons | weich | Verpackungsebenen | Klärung der Hierarchie |
| QTY-05 | Gefahrgutmenge und Verpackungsart aus Packliste und DGD ableitbar | hart | IMDG/ADR/IATA | Beförderungsverbot |
| QTY-06 | Eigenmasse Anmeldung = Nettogewicht Packliste (Toleranz) | weich | Statistik | Rückfrage |

## Parteien und Identifikatoren

| ID | Regel | Härte | Grundlage | Konsequenz |
|---|---|---|---|---|
| PTY-01 | Verkäufer, Ausführer, Shipper, Consignee, Käufer, Anmelder als getrennte Rollen | hart (Modellregel) | Art. 18, 170 UZK | pauschaler Stringvergleich erzeugt Fehlalarme bei Streckengeschäften |
| PTY-02 | Name, Land und Unternehmens-ID je Rolle konsistent; Adressabweichung zulässig | hart (Identität) / weich (Adresse) | Stammdaten | falsche Vertretung, Statusfehler |
| PTY-03 | EORI strukturell gültig **und** im EU-Service aktiv | hart | Art. 9 UZK | Anmeldung nicht durchführbar |
| PTY-04 | EORI-Ländercode ≠ Sitzland ist zulässig, aber meldepflichtig | weich | Registrierung in anderem MS möglich | Warnung |
| PTY-05 | USt-IdNr. des Erwerbers in VIES gültig, Land ≠ DE | hart | § 6a UStG | Steuerfreiheit versagt |
| PTY-06 | Ausführer muss EU-ansässig sein (EXW-Falle) | hart | Art. 170 Abs. 2 UZK, Art. 1 Nr. 19 UZK-DA | Anmeldung unzulässig |

## Transport

| ID | Regel | Härte | Grundlage | Konsequenz |
|---|---|---|---|---|
| TRN-01 **[MVP]** | Container-ID identisch über B/L, Packliste, T1, Terminalmeldung | hart | Gestellung | ggf. andere physische Sendung |
| TRN-02 **[MVP]** | Container-ID besteht ISO-6346-Prüfziffer | hart (technisch) | ISO 6346 | OCR-Nachprüfung auslösen |
| TRN-03 | Seal-Nummer konsistent oder dokumentierter Seal-Change | hart bei Zollverschluss | Verschlusssicherheit | Manipulationsverdacht |
| TRN-04 | Orte auf UN/LOCODE normalisiert, Route plausibel | weich | UNECE | Rückfrage |
| TRN-05 | Sea Waybill und Order-B/L nicht gleichzeitig als Release-Strategie | hart | unterschiedliche Freigabemechanismen | Freigabe scheitert |
| TRN-06 | Telex Release nur bei `obl_issued` + `surrender_confirmed` + Carrier-Bestätigung | hart | Carrier-Prozess | Demurrage |
| TRN-07 | MAWB-Pieces und -Gewicht = Summe der HAWBs | weich, hart ohne Zuordnung | Konsolidierung | House/Master nicht vermischen |
| TRN-08 | Freight prepaid/collect konsistent mit Incoterm | weich | Plausibilität | Zollwertprüfung |

## Referenzen, Versionen, Zeit

| ID | Regel | Härte | Grundlage | Konsequenz |
|---|---|---|---|---|
| REF-01 | Rechnungs-, Bestell-, Transport- und MRN-Referenzen bilden einen zusammenhängenden Graphen | weich, hart bei Mehrdeutigkeit | Zuordnung | falsche Sendung |
| REF-02 | Chronologie: Bestellung → Rechnung/Packliste → Übernahme/On-board → Anmeldung → Ausgang | weich | Kausalkette | Prüfung bei finalem B/L vor On-board |
| REF-03 **[MVP]** | Nur als final klassifizierte Versionen speisen kanonische Fakten | hart | Art. 15 UZK | Draft als Anmeldegrundlage |
| TIM-01 | Lizenz, Präferenznachweis, LLE, Bewilligung am Anmeldedatum gültig | hart | jeweilige Gültigkeitsregel | Ware nicht gedeckt |
| DUP-01 | Hash-, Rechnungsnummer-, Betrags- und Datumsabgleich verhindert Doppelverwendung | hart bei Einfuhrwerten | Zollwert | Abgabenduplizierung |

## Zollverfahren und Status

| ID | Regel | Härte | Grundlage | Konsequenz |
|---|---|---|---|---|
| CUS-01 | MRN identisch über ABD, Statusnachricht, Ausgangsvermerk, Akte | hart | Vorgangsidentität | falscher Zollvorgang |
| CUS-02 | Status wird aus der Systemnachricht übernommen, nicht aus dem Vorhandensein eines PDFs | hart | ABD ≠ Ausgangsvermerk | Umsatzsteuerrisiko § 9 UStDV |
| CUS-03 | Verfahren und wirtschaftlicher Zweck kompatibel (Verkauf, Reparatur, Rückware, Wiederausfuhr) | hart | Verfahrensrecht | falsche Abgaben, Bewilligungspflicht |
| CUS-04 | ENS/ICS2-Daten konsistent zu Rechnung und B/L (HS-6, Parteien, Container) | hart | Art. 127 UZK | ENS-Zurückweisung, Verladeverbot |
| CUS-05 **[MVP]** | Ausfuhrbegleitdokument deckt Rechnung und Packliste: Warennummer auf HS-6 je Position, Container identisch | hart | Art. 263 UZK; Vorgangsidentität | angemeldet ist ein anderer Zollvorgang als verladen wird, Beschau |

## Technische Meta-Regel

| ID | Regel | Härte | Zweck |
|---|---|---|---|
| OCR-01 | Prüfziffern- oder Summenfehler bei niedriger Konfidenz → `re_extraction_required` statt fachlicher Ablehnung | weich (technisch) | trennt Lesefehler von echten Dokumentfehlern |

## Toleranzprofil (Startwerte, keine Normen)

| Feld | Startwert | Hinweis |
|---|---|---|
| Geldbetrag im selben Dokument | 0,01 je Rundungsebene | Summenlogik |
| Rechnung gegen Anmeldung | keine pauschale Toleranz | Differenz muss übergeleitet werden |
| Bruttogewicht Packliste ↔ Frachtbrief | max(2 kg, 1 %) Warnung, 10 % Block | nach Carrier kalibrieren |
| Mengen | 0 bei Stückware | Lizenz- und Präferenzmengen strenger |
| Firmenname | Exact-ID + Fuzzy-Name | EORI/USt-ID haben Vorrang |
| Warenbeschreibung | semantische Ähnlichkeit + Pflichtattribute | nie allein per Embedding blockieren |
