# 08 — Known Unknowns und Quellenkonflikte

Diese Liste gehört in die Projektdokumentation, nicht in den Anhang. Ein Prototyp,
der seine Annahmegrenzen benennt, ist belastbarer als einer, der Vollständigkeit
behauptet.

## Genereller Vorbehalt

Alle Rechtsverweise in `docs/` stammen aus Sekundärrecherche über drei unabhängige
Durchläufe. Vor produktivem Einsatz sind sie gegen die konsolidierten EUR-Lex-
Fassungen (VO (EU) 952/2013 UZK, 2015/2446 UZK-DA, 2015/2447 UZK-IA, 2016/341
UZK-TDA) und zoll.de zu verifizieren. **Niemals Artikelnummern erfinden** — im
Zweifel `TODO-verify` setzen.

## Offene Punkte

**MRN-Struktur und Prüfziffer.** Länge 18 und Prüfziffer an Stelle 18 sind
unstrittig. Die Position der Verfahrenskennung wird widersprüchlich angegeben
(Position 11–12 vs. 17). Das Prüfziffernverfahren wird teils als ISO-6346-Verfahren
beschrieben, teils offen gelassen; auch der zulässige Zeichenvorrat der letzten
Stelle wird unterschiedlich angegeben (`[0-9]` vs. `[A-Z0-9]`).
→ Algorithmus implementieren, gegen echte MRN testen, bei Fehlschlag auf
Strukturprüfung zurückfallen und das dokumentieren.

**Ausfuhrfrist 150 Tage.** Nicht als eigenständige UZK-DA/IA-Frist verifizierbar.
Belastbar ist ausschließlich das Suchverfahren nach Art. 335 UZK-IA.

**Gültigkeitsdauer von Präferenznachweisen.** Eine Quelle nennt "meist 12 Monate",
eine andere abkommensabhängige Werte. Für die konkret abgedeckten Abkommen im
jeweiligen Ursprungsprotokoll nachschlagen, nicht generalisieren.

**Wortlaut der Ursprungserklärung.** Existiert pro Abkommen individuell (EU-Korea,
EU-Japan, EU-UK TCA, PEM, CETA, APS …). Für Regel ORG-07 aus zoll.de bzw.
WUP-Online zu ziehen.

**REX-Struktur.** Bestätigt ist nur der zweistellige Ländercode am Anfang. Die
Gesamtlänge stammt aus Sekundärquellen.

**USt-IdNr.-DE-Prüfalgorithmus.** MOD 11,10 nach ISO/IEC 7064 ist offline
berechenbar, aber nur über Sekundärquellen belegt; keine prominente BZSt-
Spezifikation gefunden.

**Zollwertanmeldung D.V.1.** Die genaue heutige Umsetzung in den einzelnen
ATLAS-Einfuhrverfahren (separates Formular vs. Datensatz) ist nicht gegen eine
aktuelle Verfahrensanweisung geprüft.

**Vereinfachungsschwellen bei der Ausfuhr.** Die Wert- und Massegrenzen sind
belegt, aber Ausnahmen für genehmigungspflichtige, verbrauchsteuerpflichtige oder
besonders geregelte Waren sind entscheidend. Nicht als isolierte harte Regel anwenden.

**Gewichts- und Colli-Toleranzen.** Es gibt keine gesetzliche EU-Zolltoleranz. Die
Startwerte in `rules.yaml` sind Praxisannahmen und als `source_type: practice`
gekennzeichnet. Real gelten Reederei- und Terminalkonditionen.

**Demurrage, Detention, Cut-offs.** Reederei-, hafen-, equipment- und
buchungsindividuell, laufend revidiert. Keine belastbare allgemeine Branchenzahl.
Im System parametrisieren.

**EU-Zollreform.** Politisch geeinigt, nicht im Amtsblatt. Die Daten 01.07.2028
(E-Commerce), 2031 (optionale Nutzung) und 01.03.2034 (Vollausrollung) stammen aus
einer Ratspressemitteilung. Zum EUCA-Start gibt es abweichende Angaben (2027 vs.
01.07.2028).

**ATLAS-Releasestände.** Release 10.2 seit 28.02.2026 ist belegt; die vollständigen
Übergangsfristen je Verfahren sind nicht durchgängig verifiziert. Releasenummern
nicht statisch mit Dokumentpflichten koppeln.

**eBL-Rechtslage in Deutschland.** Aus der MLETR-Nichtumsetzung allein lässt sich
die Rechtswirkung nicht ableiten; Rechtswahl, HGB, Plattformregeln,
Carrier-Bedingungen und Anerkennung im Zielstaat sind einzeln zu prüfen.

**Dual-Use.** Genehmigungspflichten lassen sich nicht aus HS/TARIC ableiten.
Technische Klassifikation, Endverwendung, Empfänger und Catch-all bleiben
fachliche Prüfschritte. Welche Abkommen REX vs. Ermächtigten Ausführer verlangen,
ändert sich mit neuen Freihandelsabkommen.

**IDP-Benchmarks und Preise.** Kein unabhängiger Benchmark auf Zoll- und
Frachtdokumenten. Anbieterpreise ändern sich laufend; die Werte in `07-idp-ocr.md`
sind Größenordnungen.

**Pflichtfelder einer EU-Handelsrechnung.** Eine allgemeingültige Liste wäre zu
pauschal — umsatzsteuerliche, zollwertbezogene, präferenzielle, ziellandspezifische
und produktspezifische Anforderungen überschneiden sich.

## Widersprüche zwischen den Recherchen

| Thema | Quelle A | Quelle B | Auflösung |
|---|---|---|---|
| MRN-Prüfziffer | ISO-6346-Verfahren, letzte Stelle numerisch | Verfahren offen, letzte Stelle alphanumerisch | empirisch testen |
| EUCA-Start | 01.07.2028 | einzelne Tätigkeiten ab 2027 | Korridor nennen, Rechtstext abwarten |
| Präferenzgültigkeit | meist 12 Monate | abkommensabhängig | je Abkommen prüfen |
| Schwellenwerte generell | als Parameter modellieren, nicht nennen | konkret beziffert | Werte als versionierte Stammdaten |
