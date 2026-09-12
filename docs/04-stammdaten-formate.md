# 04 — Stammdaten, Formate, Prüfziffern

Diese Datei ist die Referenz für alle deterministischen Validatoren. Sie gehört
zur Stufe 1 der Validierung und ist ohne Netzzugriff ausführbar, soweit angegeben.

## Übersicht

| Kennung | Aufbau | Prüfziffer | Offline prüfbar | Online-Lookup |
|---|---|---|---|---|
| EORI | ISO-Ländercode (2) + bis 15 alphanumerisch | nein | nur Format | EU EORI Validation (TAXUD EOS) |
| EORI DE | `DE` + nationaler numerischer Teil | nein | nur Format | dito |
| MRN | 18 Zeichen, Prüfziffer an Stelle 18 | ja | Format sicher, Algorithmus **ungeklärt** | — |
| HS | 6 Stellen | nein | Format | Nomenklatur je Jahr |
| KN | 8 Stellen (EU, Ausfuhr) | nein | Format | Gültigkeit zum Anmeldedatum |
| TARIC | 10 Stellen | nein | Format | TARIC/DDS2 |
| EZT DE Einfuhr | 11 Stellen + 4-stellige Zusatzcodes | nein | Format | EZT-online |
| USt-IdNr. DE | `DE` + 9 Ziffern | ja (MOD 11,10) | Format + Prüfziffer | VIES, § 18e UStG (BZSt) |
| REX | Ländercode + `REX` + Kennung | nein | nur Format | EU REX-Portal |
| UN/LOCODE | 2 ISO-Land + 3 Zeichen (Buchst. oder Ziffern 2–9) | nein | Format | UNECE-Codeliste |
| Container | 3 Owner + Kategorie (U/J/Z) + 6 Ziffern + Prüfziffer | ja (Mod 11) | **vollständig** | BIC-Owner-Register |
| AWB | 3 Airline-Präfix + 8 Seriennummer inkl. Prüfziffer | ja (Mod 7) | **vollständig** | Tracking |
| Incoterm | Wertliste, 11 Codes | — | Enum + Ort Pflicht | — |
| B/L-, Rechnungs-, Seal-Nr. | kein Standard | — | nur Existenz/Konsistenz | — |

**Merksatz:** Vollständig offline verifizierbar sind nur AWB (Mod 7), Container
(Mod 11) und USt-IdNr. TARIC, REX und UN/LOCODE haben keine Prüfziffer und
brauchen zwingend einen Online-Lookup für die Gültigkeit. Ein Regex beweist beim
EORI nur das Format, nie die Vergabe.

## Regex-Vorfilter

```
EORI            ^[A-Z]{2}[A-Z0-9]{1,15}$
MRN             ^[0-9]{2}[A-Z]{2}[A-Z0-9]{13}[A-Z0-9]$
HS              ^[0-9]{6}$
KN              ^[0-9]{8}$
TARIC           ^[0-9]{10}$
EZT Einfuhr DE  ^[0-9]{11}$
USt-IdNr. DE    ^DE[0-9]{9}$
REX             ^[A-Z]{2}REX[A-Z0-9]+$
UN/LOCODE       ^[A-Z]{2}[A-Z2-9]{3}$
Container       ^[A-Z]{3}[UJZ][0-9]{7}$
AWB             ^[0-9]{3}-?[0-9]{8}$
Incoterm        ^(EXW|FCA|CPT|CIP|DAP|DPU|DDP|FAS|FOB|CFR|CIF)$
```

## Container-Prüfziffer (ISO 6346, Modulo 11)

1. Buchstabenwerte: `A = 10`, danach fortlaufend unter Auslassung der Vielfachen
   von 11. Also `B = 12`, `C = 13`, … `Z = 38`.
2. Die ersten zehn Zeichen von links mit `2^0` bis `2^9` gewichten.
3. Produkte summieren, Modulo 11 rechnen.
4. Rest 10 wird als `0` dargestellt.

Die Prüfziffer erkennt Übertragungs- und Lesefehler. Sie beweist weder Eigentum
noch operativen Status des Containers. Owner-Code separat gegen das BIC-Register.

## AWB-Prüfziffer (Modulo 7)

Die siebenstellige Seriennummer wird durch 7 geteilt; der Rest (0–6) ist die achte
Ziffer. Der dreistellige Airline-Präfix ist nicht Teil der Rechnung.

## USt-IdNr. DE

Format `DE` + 9 Ziffern, Prüfziffer an der 11. Stelle nach ISO/IEC 7064 MOD 11,10.
Der Algorithmus ist offline berechenbar, stammt aber aus Sekundärquellen — bei
kritischer Anwendung zusätzlich VIES bzw. qualifizierte Bestätigung nach § 18e UStG.

## MRN

Länge 18 und Prüfziffer an Stelle 18 sind unstrittig. Die Positionslogik wird in
Sekundärquellen widersprüchlich beschrieben: Stellen 1–2 Jahr, 3–4 Länderkennung,
danach Zollstellennummer und laufende Kennung; die Verfahrenskennung wird mal an
Position 11–12, mal an Position 17 verortet. Auch das Prüfziffernverfahren wird
teils als ISO-6346-Verfahren angegeben, teils offen gelassen.

**Vorgehen:** Strukturprüfung implementieren, Prüfziffernalgorithmus gegen echte
MRN testen. Besteht er den Test nicht, bleibt es bei der Strukturprüfung — als
bewusste, dokumentierte Entscheidung. Siehe `08-known-unknowns.md`.

## Incoterms als Datenmodell

Nur den Drei-Buchstaben-Code zu speichern reicht nicht:

```
incoterm.code
incoterm.named_place_raw
incoterm.named_place_unlocode
incoterm.edition            = 2020
incoterm.freight_in_invoice
incoterm.insurance_in_invoice
incoterm.unloading_in_invoice
incoterm.import_duties_in_invoice
```

Ein Datensatz `FOB`, `DAP` oder `FCA` ohne benannten Ort und ohne Edition löst
mindestens eine Warnung aus.

## Normalisierung vor jedem Vergleich

Währung (ISO 4217 + Kurs + Kursdatum), Einheiten (SI, Stückzahlen), Länder
(ISO 3166-1 alpha-2), Orte (UN/LOCODE), Firmennamen (Rechtsformsuffixe entfernen,
Case, Sonderzeichen, dann Exact-ID vor Fuzzy-Name), Dezimaltrennzeichen,
Datumsformate, Warencodes (auf gemeinsame Stellenzahl kürzen).
