# 01 — Dokumententypologie

Stand September 2026. Rechtsverweise aus Sekundärrecherche, Vorbehalt siehe `08-known-unknowns.md`.

Kennzeichnung: **rechtlich** = aufgrund Zoll-, Außenwirtschafts-, Steuer- oder
Transportrecht erforderlich. **operativ** = praktisch regelmäßig nötig, aber nicht
als eigenständiges Dokument vorgeschrieben.

## Handels- und Packbelege

### Handelsrechnung
Zweck: Grundlage der Zollwertermittlung nach Transaktionswertmethode (Art. 70 UZK),
Unterlage zur Anmeldung (Art. 163 UZK, Art. 145 UZK-IA). Aussteller: Verkäufer.
Status: bei Kaufgeschäft faktisch zwingend.

Pflichtfelder: Verkäufer/Käufer/Lieferempfänger mit Anschrift, Rechnungsnummer und
-datum, Warenpositionen, Menge und Einheit, Einzel- und Gesamtpreis, Währung,
Ursprungsland je Position, Incoterm plus benannter Ort, Rabatte, Fracht- und
Versicherungsanteil, Zahlungsbedingungen, Referenzen. HS-Code ist branchenüblich,
nicht vorgeschrieben; für die Ausfuhranmeldung muss die 8-stellige KN ableitbar sein.

Fehlerquellen: Sammelbegriffe wie "parts"; fehlende Währung; Incoterm ohne Ort oder
Jahrgang; Ursprung nur auf Kopfebene statt je Position; "EU" statt Mitgliedstaat;
Summenfehler; Gutschriften nicht berücksichtigt; Frachtanteil nicht getrennt
ausgewiesen (verhindert Abzug nach Art. 72 UZK); Käufer mit Lieferempfänger verwechselt.

### Proforma-Rechnung
Bewertungs- und Versandbeleg ohne Zahlungsanspruch, für Muster, Reparaturen,
kostenlose Ersatzteile, Rückwaren. Vermerk "nur zu Zollzwecken — kein
Zahlungsanspruch" bzw. "value for customs purposes only". Ersetzt die Handelsrechnung
nur bei Nicht-Kaufgeschäften; Zollwert folgt dann Art. 74 UZK (Folgemethoden).

Fehlerquellen: Proforma trotz erfolgtem Verkauf; symbolischer Wert von 1 EUR; keine
Bewertungsgrundlage; Widerspruch zu Bestellung oder Zahlung.

### Packliste
Verknüpft Artikel mit Packstücken. Kein eigenständiges Zolldokument, operativ
unverzichtbar für den Abgleich von Colli und Gewichten gegen das Frachtpapier.
Die Anmeldung verlangt Packstückzahl, Rohmasse und Eigenmasse als Datenelemente.

Felder: Packstück-ID, Packart, Marks & Numbers, Artikel und Mengen je Packstück,
Netto- und Bruttogewicht, Maße, Volumen, Paletten- und Kartonzahl, Rechnungs- und
Bestellreferenz.

Fehlerquellen: Brutto und netto vertauscht; Palette und Kartons doppelt gezählt;
Maßeinheiten fehlen; nach Umpacken nicht aktualisiert.

## Transportdokumente

### Original Bill of Lading (OBL)
Empfangsbestätigung, Beförderungsvertrag und bei Order-B/L übertragbares
Traditionspapier (§§ 513 ff. HGB). Aussteller: Carrier, Agent oder NVOCC.
Auslieferung nur gegen Vorlage eines Originals.

Felder: B/L-Nummer, Shipper, Consignee oder "to order", Notify Party, Carrier,
Vessel/Voyage, Port of Loading/Discharge, Place of Receipt/Delivery, Container- und
Seal-Nummer, Packages, Description, Gross Weight, Freight prepaid/collect, Anzahl
Originale, On-board-Datum.

Fehlerquellen: Draft statt finaler Fassung; falsches Consignee; Originalsatz
unvollständig; fehlendes Indossament; Container nach Rollover geändert; House-B/L mit
Master-B/L verwechselt; "said to contain" / "shipper's load and count" (Angaben
ungeprüft); Gewicht abweichend durch VGM.

### Sea Waybill
Nicht übertragbar, kein Warenwertpapier. Auslieferung an namentlich benannten
Empfänger ohne Originalvorlage. Wird von Akkreditiven regelmäßig nicht akzeptiert.

### Telex Release / Surrender
Kein eigener B/L-Typ, sondern Freigabeverfahren nach Rückgabe aller Originale.
Bezieht sich ausschließlich auf Original-/Negotiable-B/L, nicht auf Waybills.

Fehlerquellen: "telex requested" wird als erfolgte Freigabe interpretiert; nicht alle
Originale surrendered; Gebühren offen; Destination-Sperre.

### CMR-Frachtbrief
Beweisurkunde des Straßenbeförderungsvertrags (CMR-Übk. Art. 4–9). Ein vom
Auftraggeber unterzeichneter Frachtbrief mit Empfangsbestätigung ist als
Versendungsbeleg für den Gelangensnachweis anerkannt (§ 17b Abs. 3 S. 1 Nr. 3 UStDV).
Der Frachtbrief ist keine Wirksamkeitsvoraussetzung des Vertrags.

Felder 1–24: Absender, Empfänger, Frachtführer, Übernahme- und Auslieferungsort,
Übernahmedatum, beigefügte Dokumente, Colli und Zeichen, Warenbezeichnung,
Bruttogewicht, Kosten, Zollinstruktionen, Vorbehalte, Unterschriften 22/23/24.

Fehlerquellen: **Feld 24 fehlt → kein Gelangensnachweis → Umsatzsteuerrisiko**;
Abholadresse statt rechtlichem Absender; Unterfrachtführer fehlt; Gewicht geschätzt;
Tauschpaletten als Frachtstücke gezählt; handschriftliche Änderungen.

### Air Waybill (MAWB/HAWB)
Luftfrachtvertrag nach Montrealer Übereinkommen Art. 4/5; Mindestangaben sind
Abgangs- und Bestimmungsort sowie Gewicht. Elektronischer Datensatz kann das Papier
ersetzen. 11-stellige Nummer: 3 Airline-Präfix + 8 Seriennummer inkl. Prüfziffer.

Fehlerquellen: HAWB statt MAWB extrahiert; Pieces über House- und Masterebene
vermischt; Chargeable statt Gross Weight verglichen; Carrier-Präfix verloren.

## Zoll- und Ursprungsbelege

### Ausfuhrbegleitdokument (ABD) mit MRN
Lesbare Darstellung ausgewählter Daten einer überlassenen elektronischen
Ausfuhranmeldung, erzeugt über ATLAS/AES. Trägt die 18-stellige MRN in Klarschrift
und als Barcode. **Das ABD ist nicht der Ausgangsvermerk.**

Fehlerquellen: ABD wird als Ausgangsnachweis archiviert (Umsatzsteuerrisiko nach
§ 9 UStDV); MRN OCR-fehlerhaft; Ausgangszollstelle passt nicht zur Route.

### Einfuhrabgabenbescheid
Mitteilung der Zollschuld (Art. 102 UZK), Grundlage des Vorsteuerabzugs bei EUSt.
Fehlerquellen: mehrere Bescheide je Sendung; Anmelder ≠ tatsächlicher Importeur bei
DDP oder indirekter Vertretung.

### Zollwertanmeldung D.V.1
Deklaration wertbeeinflussender Angaben, Hinzurechnungen und Abzüge (Art. 71/72 UZK),
Verbundenheit der Parteien. Heute weitgehend Datensatz in ATLAS statt Formular.
Fehlerquellen: Frachtaufteilung intra/extra EU nicht belegt; Lizenzgebühren vergessen;
Doppelzählung von Fracht.

### Ursprungszeugnis (IHK)
Nichtpräferenzieller Ursprung nach Art. 60 UZK, ausgestellt von der IHK auf Antrag.
Kein Zollvorteil; relevant für Akkreditive, handelspolitische Maßnahmen,
Antidumping, Kontingente. Die IHK darf keinen präziseren Ursprung bescheinigen als
der Vornachweis trägt.

### EUR.1 / EUR-MED
Förmlicher, zollamtlich bestätigter Präferenznachweis nach dem jeweiligen Abkommen.
Fehlerquellen: nachträgliche Ausstellung nicht vermerkt; falsches Abkommensschema;
Ursprungsangabe "EU" vs. Mitgliedstaat je nach Abkommen.

### Ursprungserklärung auf der Rechnung / REX
Nicht-förmlicher Präferenznachweis durch den Ausführer. Bis 6.000 EUR durch jeden
Ausführer, darüber nur als Ermächtigter Ausführer oder mit REX-Registrierung.
**REX ist ein Registrierungsstatus, nicht selbst der Nachweis.**
Die Wertgrenze bezieht sich auf den Wert der Ursprungserzeugnisse, nicht auf den
Rechnungsgesamtwert.

Fehlerquellen: falscher oder paraphrasierter Wortlaut; alte Abkommensfassung;
REX-Nummer fehlt oberhalb der Schwelle; Erklärung auf Proforma.

### A.TR
Freiverkehrsnachweis in der Zollunion EU–Türkei. **Kein Ursprungsnachweis.**
Für Agrar- und EGKS-Waren gilt stattdessen EUR.1.

### Lieferantenerklärung (LE) und Langzeit-LE (LLE)
Vornachweis des präferenziellen Ursprungs in der Lieferkette (Art. 61–66 UZK-IA,
Anhänge 22-15 bis 22-18). Freiwillig, aber faktisch Voraussetzung für eigene
Präferenznachweise. Wird dem Zoll nicht vorgelegt, aber bei Prüfung (INF 4) fällig.

Fehlerquellen: abgelaufene LLE; Rechnung außerhalb des Deckungszeitraums; Ware nicht
eindeutig zuordenbar; pauschal "EU origin" ohne Abkommensbezug; Stückliste geändert.

### Versandbegleitdokument T1/T2 (NCTS)
T1 für Nicht-Unionsware unter Aussetzung der Abgaben, T2 für Unionsware in
einschlägigen Konstellationen (Art. 226/227 UZK). MRN als Bezugsnummer.
Fehlerquellen: Frist überschritten; Verschluss ≠ Container-Seal; Verfahren nicht
beendet → Zollschuld nach Art. 79 UZK.

### Gefahrgutdokumentation
See: IMDG-Code 5.4 (Multimodal Dangerous Goods Form, Container Packing Certificate).
Straße: ADR 5.4.1 Beförderungspapier. Luft: IATA Shipper's Declaration.
Felder: UN-Nummer, Proper Shipping Name, Klasse, Verpackungsgruppe, Menge,
Verpackungsart, Marine Pollutant, Flammpunkt, Notfallkontakt, Unterschrift.
Fehlerquellen: Handelsname statt Proper Shipping Name; Netto/Brutto vertauscht;
Limited Quantity nicht kenntlich; ADR-Daten ungeprüft für Seefracht übernommen.

### Genehmigungen und Dual-Use
VO (EU) 2021/821 Anhang I, nationale Ausfuhrliste, Sanktionsrecht. Aussteller
typischerweise BAFA. Unterlagencodes in ATLAS. **Dual-Use-Pflichten lassen sich nicht
allein aus HS/TARIC ableiten** — technische Klassifikation, Endverwendung, Empfänger
und Catch-all bleiben fachliche Prüfschritte.
Fehlerquellen: Lizenz abgelaufen; falscher Endverwender; Restmenge überschritten;
Endverbleibserklärung fehlt.
