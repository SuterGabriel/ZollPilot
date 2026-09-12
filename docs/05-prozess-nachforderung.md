# 05 — Prozess, Nachforderung, Fristen

## Zielprozess

1. **Intake** — E-Mail und Anhänge unverändert archivieren, Datei-Hash, Thread-ID.
2. **Klassifikation** — Belegtyp, Variante, Draft/Final, House/Master, Version.
3. **Extraktion** — Werte mit Seite, Bounding Box, Rohtext, Konfidenz.
4. **Normalisierung** — Währungen, Einheiten, Länder, Parteien, Orte, Codes.
5. **Sachverhalt** — Richtung, Verkehrsträger, Route, Verfahren, Incoterm, Präferenzabsicht.
6. **Pflichtmatrix** — erwartete Daten, Nachweise und Dokumentformen instanziieren.
7. **Konsistenzprüfung** — harte Regeln zuerst, danach weiche.
8. **Nachforderung** — konkretes fehlendes Feld an den verantwortlichen Dateninhaber.
9. **Eskalation** — ereignisbezogen, nicht nur nach Kalendertagen.
10. **Freigabe** — erst nach Auflösung aller harten Findings; Override nur mit
    Begründung und Benutzeridentität.

## Zuständigkeiten

| Fehlende Information | Primärkontakt | Sekundär | Auslöser |
|---|---|---|---|
| Rechnung, Preise, Ursprung, Artikelbeschreibung | Lieferant/Verkäufer | Einkauf | Bestellung bestätigt |
| Packliste, Gewichte, Maße | Lieferant/Packbetrieb | Spediteur/Lager | Ware gepackt |
| B/L, Sea Waybill, Release-Status | Seefrachtspediteur/Carrier | Shipper | SI-Cut-off / On-board |
| CMR, Fahrzeug, Übernahmedatum | Frachtführer/Spediteur | Versandlager | vor Abholung |
| MAWB/HAWB | Luftfrachtspediteur/Airline | Lieferant | Cargo acceptance |
| Frachtkostenaufteilung | Spediteur/Carrier | Einkauf | vor Einfuhranmeldung |
| Präferenznachweis | Exporteur/Lieferant | Ursprungsstelle | vor Ausfuhr |
| LE / LLE | Lieferant | Ursprungsmanagement | vor eigener Erklärung |
| Genehmigung / Dual-Use | Exportkontrolle | Vertrieb, BAFA-Prozess | vor Vertragsfreigabe **und** vor Versand |
| MRN, ABD, T1/T2 | Zollvertreter/Spediteur | interne Zollabteilung | nach Überlassung |
| Telex Release | Shipper/Carrier | Consignee | nach Zahlung, vor Ankunft |

## Eskalationsmodell

Es gibt **keine universell verbindliche Branchenfrist**. Cut-offs hängen von Hafen,
Carrier, Verkehrsträger, Verfahren, Ware und Vertrag ab. Fristen deshalb als
relative Ereignisse modellieren, nicht als Kalendertage.

| Stufe | Zeitpunkt (konfigurierbar) | Aktion |
|---|---|---|
| Erinnerung 0 | sofort nach Feststellung | präzise Anforderung mit Sendungsreferenz und fehlendem Feld |
| Erinnerung 1 | vor internem Customs Cut-off | Absender + operativer Sachbearbeiter |
| Eskalation 1 | vor Carrier-/Terminal-Cut-off | Teamleitung, Kostenrisiko benennen |
| Eskalation 2 | vor ETA/Abholung/Abflug | Einkauf, Logistikleitung, Zollverantwortlicher |
| Stop / No-go | Cut-off erreicht | Anmeldung, Verladung oder Freigabe blockieren |
| Incident | Kosten oder Rechtsverstoß eingetreten | Schadenscode, Root Cause, Rückstellung |

Branchenübliche Orientierung (Praxis, nicht kodifiziert): Seefracht-Import
Dokumente 3–5 Werktage vor ETA; Export-Dokumentations-Cut-off 24–72 h vor
VGM-/Cargo-Cut-off; bei LKW muss das ABD vor Abholung vorliegen. Typischer
Eskalationsrhythmus sofort → 24 h → 48 h → 72 h.

## Textstruktur einer Nachforderung

```
Betreff: ACTION REQUIRED – fehlender Nachweis – Shipment <ID> – Frist <Zeit>

Benötigt:
- Dokument/Feld:
- Betroffene Warenposition:
- Grund der Anforderung:
- Gefundener Widerspruch:
- Akzeptierte Nachweise:
- Operative Frist:
- Folge bei Fristüberschreitung:

Referenzen: Invoice / PO / B-L-AWB-CMR / Container / MRN
```

Eine generische Bitte um "alle Zollunterlagen" ist zu vermeiden. Das System muss
sagen, welcher Wert auf welcher Position fehlt und warum der vorhandene Beleg nicht
genügt.

## Normfristen

| Frist | Wert | Grundlage |
|---|---|---|
| Vorübergehende Verwahrung | 90 Tage ab Gestellung, keine Verlängerung | Art. 149 UZK; danach Zollschuld Art. 79 UZK |
| Versandverfahren T1 | von der Abgangsstelle gesetzt, typisch 5–8 Tage | Art. 297 UZK-IA |
| Nacherhebung / Mitteilung | 3 Jahre, 10 Jahre bei strafbarer Handlung | Art. 103 UZK, § 169 ff. AO |
| Buchmäßige Erfassung | — | Art. 105 UZK |
| Erstattung bei nachgereichtem Präferenznachweis | 3 Jahre | Art. 116/117, 121 UZK |
| Offene Ausfuhrvorgänge | Suchverfahren | Art. 335 UZK-IA |
| Aufbewahrung | 3 Jahre (Zoll), 10 Jahre (AO) | Art. 51 UZK, § 147 AO |

**Achtung:** Die häufig genannte "Ausfuhrfrist 150 Tage" ließ sich nicht als
eigenständige UZK-DA/IA-Frist verifizieren. Belastbar ist nur das Suchverfahren
nach Art. 335 UZK-IA.

## Kostenfolgen verspäteter Unterlagen

- **Demurrage** — Standzeitkosten für Container innerhalb Terminal/Hafen/Depot nach
  Ablauf der Free Time.
- **Detention** — Kosten für verspätete Rückgabe des Equipments außerhalb des Terminals.
- **Storage** — zusätzliche Terminal- oder Lagerkosten neben Demurrage.
- Free Times typisch 3–7 Tage, Tagessätze gestaffelt steigend, Reefer deutlich
  höher. **Reederei-, land- und equipmentabhängig, laufend revidiert — im System
  parametrisieren, nie hart kodieren.**
- **Umsatzsteuer:** fehlender Ausgangsvermerk oder fehlende Gelangensbestätigung
  macht die Lieferung steuerpflichtig. 19 % auf den Nettobetrag, beim Kunden
  praktisch nicht mehr eintreibbar. Das ist der wirtschaftlich härteste Einzelfall.
- **Präferenz:** fehlender oder ungültiger Nachweis → Regelzollsatz; nachträgliche
  Ausstellung nur nach den Regeln des Abkommens.
- **Versandverfahren:** Fristüberschreitung löst Such- und Erhebungsverfahren sowie
  Inanspruchnahme der Sicherheit aus.
- **Cargo Release:** fehlendes OBL/Surrender oder falsches Consignee blockiert die
  Warenfreigabe.
