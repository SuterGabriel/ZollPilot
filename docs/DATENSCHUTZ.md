# Datenschutz und Testdaten

## Testdaten

**Keine Testdaten aus echten Sendungen.** Alle Akten in `testdaten/akten/`
werden von `testdaten/erzeuge-akten.mjs` erzeugt. Firmen, Nummern, Werte,
Container und Seals sind erfunden; jeder Dokument-Hash beginnt mit
`sha256:synthetisch-`, und ein Test in `tests/testdaten.test.mjs` prüft das.

Die Containernummern sind nach ISO 6346 gültig, weil die Prüfziffernregel
sonst überall anschlägt. Gültig heißt nicht existent: Ob `MSKU1234565` je
gefahren ist, weiß dieses Repo nicht und will es nicht wissen.

Die Belege in `testdaten/belege/` (PDF) erzeugt `testdaten/erzeuge-belege.py`
aus denselben Akten; Adressen, Schiffsname und Unterschriftszeile sind
erfunden, und jede Rechnung sagt das in der Fußzeile.

Der Ausstellername „Maersk Line (synthetisch)“ ist eine Rolle, kein Bezug auf
eine reale Buchung. Die Testfirmen „Nordlicht Maschinenbau GmbH“ und „Aurora
Trading Pte. Ltd.“ sind erfunden; sollte eine gleichnamige Firma existieren,
ist das Zufall und die Namen werden geändert.

## Was in einer Akte steckt

Handelsrechnung, Packliste und B/L enthalten personenbezogene und
geschäftsgeheime Daten: Ansprechpartner, Adressen, EORI- und
Umsatzsteuernummern, Preise, Lieferbeziehungen. Bei Dual-Use-Sendungen kommen
Endverwender dazu. Das ist der Grund, warum `docs/07-idp-ocr.md` für diese
Fälle On-Premise-Verarbeitung als sicherere Wahl nennt.

## Regeln für den Betrieb

**Pseudonymisierung vor jedem Modellaufruf.** Bevor ein Beleg oder ein
Ausschnitt an einen externen Extraktions- oder Sprachdienst geht, werden
Parteien (Name, Adresse, Ansprechpartner, EORI, USt-IdNr., REX) durch
Platzhalter ersetzt, die Zuordnung bleibt lokal. Stufe 3 braucht das noch
nicht: Die Extraktion (ADR-005) liest Textlayer und Tesseract im eigenen
Container, kein Beleg verlässt den Stack. Die Pseudonymisierung ist deshalb
nicht gebaut, und sie entsteht mit dem ersten Modellaufruf, in derselben
ADR, nicht danach (`docs/ARBEITSWEISE.md`, Stufe 3).

**Der Extraktionsdienst protokolliert keinen Belegtext.** Je Anfrage stehen
im Log Akten-ID, Anzahl und Größe der Dateien, Anzahl der Dokumente und
Assertions, Dauer. Rohwerte und Fundstellen liegen nur in der Antwort an
n8n und damit in der Ausführung, die nach 14 Tagen gelöscht wird.

**Fehlerprotokoll ohne Nutzdaten.** Der Fehler-Workflow
(`workflows/zollpilot-fehler.json`) schreibt Workflow, Ausführung, Node und
Meldung nach `workflow_fehler`, nicht die Akte. Wer den Inhalt braucht,
öffnet die Ausführung in n8n, wo der Zugriff geregelt ist.

**Ausführungsdaten werden gelöscht.** `compose.yml` setzt
`EXECUTIONS_DATA_MAX_AGE` auf 14 Tage. Was die Akte dauerhaft braucht, liegt
in `pruefung` und den Aktentabellen, nicht in der Ausführungshistorie.

**Die Wiedervorlage trägt Nutzdaten, absichtlich.** `wiedervorlage.nutzlast`
hält den Rumpf eines gescheiterten Laufs, damit er sich wiederholen lässt,
ohne dass jemand die Belege neu einreicht. Das ist der Zweck der Tabelle und
der Unterschied zu `workflow_fehler`. Dafür gilt dieselbe Frist wie für
Ausführungen: 14 Tage, danach löschen. Der Job dafür ist nicht gebaut
(`docs/BETRIEB.md`, „Was vor einem echten Betrieb fehlt“); bis dahin ist es
ein Handgriff: `delete from wiedervorlage where angelegt_am < now() - interval '14 days'`.

**Die Akte liegt dauerhaft in Postgres, mit Rohwerten.** Seit ADR-010
schreibt jede Prüfung Stammdaten, Belege und Assertions in `shipment`,
`document` und `document_field_assertion`: Parteien, Preise, Nummern, je
Feld mit Rohwert und Fundstelle. Vorher war das nur `pruefung.ergebnis`.
Die Aufbewahrung folgt der Zollpflicht (Art. 51 UZK: drei Jahre; § 147 AO:
zehn), nicht der Frist für Ausführungen. Löschen nach Ablauf ist nicht
gebaut. Die Mails am Eingang werden nicht abgelegt, nur Absender, Betreff
und Zuordnung (`mail_eingang`); die Anhänge liegen im Postfach.

**Metriken tragen keine Belegwerte.** Die Labels der Extraktionsmetriken sind
Belegtyp und Lesemethode, die des SQL-Exporters Regelkennung, Status und
Entscheidung. Kein Aktenzeichen, kein Betrag, kein Name; ein Test in
`extraktion/tests/test_dienst.py` prüft das für die Extraktion.

**Vertraglich zu klären** vor produktivem Einsatz eines externen Anbieters:
Region, Aufbewahrung, Logging, Unterauftragsverarbeiter, Ausschluss von
Modelltraining auf Kundendaten. Offene Frage 10 in `PROJECT.md`.

## Was dieses Repo nicht regelt

Rollen und Rechte in n8n, Verschlüsselung der Datenbank, Zugriff auf die
Originalbelege im Archiv. Das sind Betriebsfragen, siehe `docs/BETRIEB.md`,
Abschnitt „Was vor einem echten Betrieb fehlt“.
