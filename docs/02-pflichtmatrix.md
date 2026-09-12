# 02 — Pflichtdokument-Matrix

**Modellierungsregel:** Unterscheide `required_data`, `required_evidence` und
`required_document_form`. Art. 163 UZK knüpft an erforderliche Unterlagen bzw.
Nachweise an — "Zoll verlangt immer genau dieses PDF" ist zu hart modelliert.

Status: **Z** zwingend · **B** bedingt zwingend · **P** operativ regelmäßig nötig · **–** nicht relevant

## Grundsachverhalte

| Nachweis | Export Drittland | Import Drittland | Innergem. Lieferung | Grundlage |
|---|---|---|---|---|
| Handels-/Proformarechnung | P/B | P/B | Z (USt) | Art. 163 UZK, Art. 145 UZK-IA; §§ 14/14a UStG |
| Packliste | P | P | P | keine generelle Papierpflicht |
| Ausfuhranmeldung / MRN / ABD | Z ab Schwelle | – | – | Art. 263 UZK; Art. 137 UZK-DA |
| Ausgangsvermerk | B (USt-Nachweis) | – | – | § 9 UStDV — **nicht** das ABD |
| Gelangensnachweis | – | – | Z | §§ 17a/17b UStDV, § 6a UStG |
| Einfuhranmeldung | – | Z | – | Art. 158, 162, 201 UZK |
| Zollwertdaten / D.V.1 | – | Z/B ab Schwelle | – | Art. 70–74 UZK; Art. 6 UZK-TDA |
| ENS / ICS2 | – | Z (durch Beförderer) | – | Art. 127 UZK |
| Transportdokument | B je Modus | B je Modus | B | CMR, Montreal, Seefrachtrecht |
| Präferenznachweis | B | B | – | jeweiliges Abkommen |
| Ursprungszeugnis IHK | B | B | – | Art. 60 UZK |
| LE / LLE | B (Vornachweis) | – | B | Art. 61–66 UZK-IA |
| T1 / T2 | B | B | B | Art. 226–236 UZK |
| Genehmigung / Dual-Use | B | B | B | VO 2021/821, AWG/AWV, Embargo-VO |
| Gefahrgut | B | B | B | ADR / IMDG / IATA DGR |
| CBAM | – | B ab Schwelle | – | VO 2023/956 |
| Intrastat | – | – | B ab Schwelle | VO 2019/2152 |

## Verifizierte Schwellen

| Schwelle | Wirkung | Grundlage |
|---|---|---|
| Ausfuhr > 1.000 EUR **oder** > 1.000 kg | elektronische Ausfuhranmeldung (ATLAS-AES) | Art. 137 UZK-DA |
| Ausfuhr ≤ 1.000 EUR und ≤ 1.000 kg | mündliche/konkludente Anmeldung an der Ausgangszollstelle | Art. 137 (1) a UZK-DA, Art. 221 (3) UZK-IA |
| Ausfuhr 1.000–3.000 EUR | einstufiges Verfahren möglich | dt. Dienstvorschrift/VSF |
| Ausfuhr > 3.000 EUR | zweistufiges Verfahren | UZK-Verfahrensregeln |
| Präferenz ≤ 6.000 EUR | Ursprungserklärung ohne Bewilligung (ÜLG: 10.000 EUR) | Art. 61–66 UZK-IA |
| Präferenz > 6.000 EUR | nur Ermächtigter Ausführer, REX oder förmliche EUR.1 | Art. 61–66 UZK-IA |
| Import Zollwert > 20.000 EUR | Zollwertanmeldung D.V.1 (auch bei Teilsendungen desselben Absenders/Empfängers) | Art. 6 UZK-TDA |
| CBAM > 50 t/Jahr | Status "zugelassener CBAM-Anmelder" vor Einfuhr | VO 2023/956 i.d.F. VO 2025/2083 |

**Wichtig:** Die 6.000-EUR-Grenze bezieht sich auf den Wert der Ursprungserzeugnisse,
nicht auf den Rechnungsgesamtwert. Wortlaute und Schwellen sind abkommensspezifisch
und dürfen nicht global hart kodiert werden.

## Ausführerbegriff und EXW-Problematik

Der Ausführer muss im Zollgebiet der Union ansässig sein (Art. 170 Abs. 2 UZK,
Art. 1 Nr. 19 UZK-DA). Bei EXW ist der Drittlandskäufer damit **nicht
ausführerfähig**. Lässt sich kein Ausführer ermitteln, bestimmt er sich nach
vertraglicher Vereinbarung. Das ist eine der häufigsten Praxisfallen und ein guter
Kandidat für eine eigene Warnregel.

## Incoterms 2020 — Kostenverantwortung

Elf Klauseln, davon vier nur für See- und Binnenschiffstransport (FAS, FOB, CFR, CIF).
Nur CIF und CIP verpflichten den Verkäufer zur Versicherung (CIF: Mindestdeckung,
CIP: erweitert). Ausfuhrverzollung: Verkäufer bei allen außer EXW. Einfuhrverzollung:
Käufer bei allen außer DDP.

| Klausel | Hauptfracht | Versicherung VK | Gefahrübergang | Aktenwirkung |
|---|---|---|---|---|
| EXW | Käufer | – | ab Werk | Ausführerfähigkeit prüfen, Vorkosten anfordern |
| FCA | Käufer | – | Übergabe an Frachtführer | Übergabeort und Carrier-Nachweis |
| FAS | Käufer | – | längsseits Schiff | nur See |
| FOB | Käufer | – | an Bord | nur See; On-board-Ereignis |
| CFR | Verkäufer | – | an Bord | Hauptfracht im Preis, Risiko früher |
| CIF | Verkäufer | ja (min.) | an Bord | Fracht + Prämie identifizieren |
| CPT | Verkäufer | – | erster Frachtführer | enthaltene Fracht identifizieren |
| CIP | Verkäufer | ja (erweitert) | erster Frachtführer | Versicherungsnachweis |
| DAP | Verkäufer | – | Bestimmungsort | Fracht auf vor/nach EU-Grenze aufteilen |
| DPU | Verkäufer | – | nach Entladung | Entladekosten trennen |
| DDP | Verkäufer | – | inkl. Einfuhrverzollung | EORI/Fiskalvertretung des Verkäufers prüfen |

**Fracht im Zollwert:** Beförderungs- und Versicherungskosten bis zum Ort des
Verbringens sind hinzuzurechnen, soweit nicht im Kaufpreis enthalten
(Art. 71 Abs. 1 lit. e UZK). Nach dem Verbringen anfallende Kosten sind abziehbar,
aber nur bei getrenntem Ausweis (Art. 72 UZK). Bereits im Preis enthaltene Fracht
darf nicht doppelt hinzugerechnet werden (EuGH C-75/20 "Lifosa", 22.04.2021).
Sonderregel Luftfracht: nur Kostenanteil nach Abflugzone (Art. 138 UZK-IA,
Anhang 23-01).

**Incoterms ändern nicht den zollrechtlichen Sachverhalt**, sondern Kosten-, Risiko-
und Abfertigungsverantwortung. Der Zollwert darf nie allein aus der Klausel
abgeleitet werden.

## Praxis vs. Vorschrift

| Thema | Vorschrift | Praxisabweichung |
|---|---|---|
| Packliste | nicht generell vorgeschrieben | Broker behandeln sie als Pflicht |
| HS-Code auf Rechnung | maßgeblich ist die Anmeldung | Lieferanten drucken nur HS-6 oder fremde nationale Codes |
| Incoterm | regelt Parteienpflichten | wird als Zollwertformel missbraucht |
| FOB bei Containern | ICC sieht FCA vor | FOB verbreitet trotz Empfehlung |
| ABD | Begleitdokument | wird als Ausgangsnachweis archiviert |
| A.TR | Statusnachweis | wird als Ursprungszeugnis behandelt |
| Lieferantenerklärung | freiwilliger Vornachweis | Einkauf verlangt sie pauschal |
| Telex Release | Carrier-Prozess | E-Mail-Bitte gilt als Freigabe |
| EORI | Registry-Identifikation | Formatprüfung mit Gültigkeitsprüfung verwechselt |
| eBL | kontrollierbarer Datensatz | PDF-Scan wird "eBL" genannt |
