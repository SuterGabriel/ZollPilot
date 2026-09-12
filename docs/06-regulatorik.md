# 06 — Regulatorischer Horizont

Stand September 2026. Zeitpläne können sich ändern; alle Angaben mit Datum prüfen.

## ATLAS / AES

Release 10.2 im Echtbetrieb seit 28.02.2026 (Migrationswochenende 26.–28.02.2026).
Kernneuerungen: zentrale Zollabwicklung bei der Einfuhr (CCI) und Umstellung auf die
MRN als primäre Registriernummer. Im Export gilt ausschließlich AES-P1; Legacy-
ECS-P2-Nachrichten werden abgelehnt. AES–NCTS-Verknüpfung mit automatischem
"previous document"-Abgleich seit 16.05.2026.

**Architekturfolge:** Wo möglich die AES-Nachricht als Quelle nehmen, nicht den
PDF-Druck des ABD. Verfahrensversion, Nachrichtentyp und Gültigkeitszeitraum
konfigurierbar halten, nie Releasenummern statisch mit Dokumentpflichten koppeln.

## ICS2

Release 3 ausgerollt: Seefracht seit 03.06.2024, Straße und Schiene seit 01.09.2025
(Deutschland über EKS, plus elf weitere Staaten). ICS1 abgelöst, letzte nationale
Übergangsfristen Anfang 2026 ausgelaufen. ENS-Datenanforderungen nach Anhang B
UZK-DA/IA, darunter mindestens 6-stellige HS-Codes und eine akzeptable
Warenbeschreibung. DCSA Bill of Lading 3.0 ergänzt über 190 Shipping-Instruction-
Attribute zur ICS2-Unterstützung.

**Architekturfolge:** Konsistenz muss **vor der Verladung** hergestellt sein, nicht
erst vor der Zollanmeldung. Das zieht die Regeln CLS-01, CUS-04 und PTY-02 im
Prozess nach vorn.

## eFTI

VO (EU) 2020/1056, formal in Kraft seit 21.08.2024, Vollanwendung ab **09.07.2027**:
Behörden müssen dann Informationen über zertifizierte eFTI-Plattformen akzeptieren.
Gemeinsamer Datensatz per DelVO (EU) 2024/2024, Zugangsregeln per DVO (EU) 2024/1942.
Erste nationale Piloten ab 2026.

Die Verordnung verpflichtet Unternehmen **nicht** zur ausschließlich elektronischen
Übermittlung; sie schafft einen Behörden-Akzeptanzrahmen. Ein eCMR kann ab 2027 im
Kontrollfall nur vorgewiesen werden, wenn die Daten über eine eFTI-Plattform
bereitstehen.

**Architekturfolge:** Der eFTI-Datensatz ist der beste verfügbare Kandidat für ein
Zielschema der Transportdaten in der Sendungsakte.

## eBL, MLETR, DCSA

MLETR (UNCITRAL 2017) schafft funktionale Äquivalenz elektronischer übertragbarer
Dokumente über Integrität und exklusive Kontrolle. **Deutschland hat MLETR nicht
umgesetzt**; das Traditionspapierproblem (§ 513 HGB) ist offen. UK, Frankreich und
Singapur sind weiter.

Fünf Plattformen (CargoX, edoxOnline, TradeGo, WaveBL, eTEU) haben den DCSA
Interoperability Annex v.2 mit IGP&I-Zulassung umgesetzt (Stand 04.06.2026), womit
plattformübergreifender Austausch erstmals möglich ist. Die neun DCSA-Mitgliedscarrier
haben sich zu 50 % eBL bis 2027 und 100 % bis 2030 verpflichtet.

**Architekturfolge:** Bis 2028 laufen Papier-OBL, plattformgebundenes eBL, Sea
Waybill und Surrender parallel. Das Modell braucht `issued`, `controller`,
`transferred`, `endorsed`, `surrendered`, `amended`, `voided` und `platform` —
nicht nur `document_file`. Ein PDF-Scan eines OBL ist **kein** eBL.

## EU-Zollreform

Politische Einigung Rat/Parlament am 26.03.2026. Neue EU-Zollbehörde EUCA mit Sitz
in Lille. Laut Ratspressemitteilung wird der EU Customs Data Hub am **01.07.2028**
für E-Commerce operativ, optionale Nutzung durch andere Wirtschaftsbeteiligte ab
2031, vollständige Erfassung aller Warenbewegungen bis **01.03.2034**.

**Noch nicht im Amtsblatt veröffentlicht**, Detailrechtsakte fehlen, förmliche
Verabschiedung ausstehend. Die Quellen weichen beim Startdatum einzelner
EUCA-Tätigkeiten voneinander ab (2027 vs. 01.07.2028). Im Gespräch nur den groben
Korridor nennen.

**Architekturfolge:** Das Datenmodell sollte auf UZK-Anhang-B-Datenelemente abbilden
statt auf Formulare, damit die spätere Anbindung kein Rewrite wird.

## CBAM

Definitivphase seit 01.01.2026 (Ablösung der Übergangsphase 10/2023–12/2025).
De-minimis-Schwelle von 50 t pro Jahr, eingefügt durch die Omnibus-I-VO
(EU) 2025/2083 — befreit nach Kommissionsangabe rund 90 % der Importeure bei 99 %
Emissionsabdeckung. Erste jährliche CBAM-Erklärung bis 30.09.2027 für 2026;
Zertifikatskauf über das zentrale Register ab Februar 2027. CBAM-Faktor 2026: 2,5 %.
Deutscher Zugang seit 26.02.2026 nur über das Zoll-Portal.

**Architekturfolge:** Neue Pflichtdaten für betroffene Warengruppen (eingebettete
Emissionen, Anmelderstatus). Für den Export-MVP nicht relevant, im Modell aber als
Zweig vorzusehen.

## E-Commerce-Sofortmaßnahme

Wegfall der 150-EUR-Freigrenze mit 3-EUR-Pauschale seit 01.07.2026. Für B2B-See-
und LKW-Verkehr Randthema.

## Gesamtwirkung bis 2028

Dokumente bleiben relevant, aber strukturierte Ereignisse und Statusnachrichten
werden zur gleichwertigen Evidenzklasse. Jede regulatorische Regel braucht deshalb
`valid_from`, `valid_to`, `jurisdiction`, `procedure`, `mode`, `agreement_id` und
`source_version`.
