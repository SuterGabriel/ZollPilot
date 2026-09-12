# ADR-008: Eine strukturierte Rechnung ist ein Beleg wie jeder andere

- **Status:** angenommen
- **Datum:** 2026-09-12
- **Stufe:** 3

## Kontext

Bis hierher kam jede Rechnung als PDF: Textlayer oder Scan, gelesen mit
Koordinaten und Konfidenz (ADR-005). Immer mehr Rechnungen kommen aber als
Datensatz, in Deutschland seit 2025 verpflichtend im B2B, in der Form
UN/CEFACT Cross Industry Invoice (CII, auch unter ZUGFeRD und Factur-X) oder
UBL. Ein Datensatz hat keine Seiten, keine Bounding Box und keine
Leseunsicherheit. Die Frage ist, wie er in eine Akte kommt, die bisher aus
Belegaussagen mit Fundstelle gebaut ist.

Drei Kräfte ziehen gegeneinander:

- **ADR-001 und ADR-003:** Fakten entstehen nur aus Assertions finaler
  Belege, und jede Assertion trägt Konfidenz und Fundstelle. Der Konfidenzpfad
  reagiert auf sie.
- **Das Regelwerk kennt Pfade, keine Formate.** `rechnung.gesamt` ist
  `rechnung.gesamt`, egal woher. Eine zweite Rechnungsform darf keine zweite
  Regelmenge nach sich ziehen.
- **Ein Datensatz kann falsch sein, ohne falsch gelesen zu sein.** Die
  Unsicherheit verschwindet nicht, sie wechselt die Art: von Lesefehler zu
  Inhaltsfehler.

## Optionen

**1. Die strukturierte Rechnung ist ein eigener Eingang mit eigenem Modell.**
Ein Endpunkt nimmt XML, ein Modul liest es in ein Rechnungsobjekt, und das
Regelwerk bekommt einen zweiten Weg für Rechnungen ohne Belegaussagen. Sauber
getrennt, und nichts am PDF-Weg ändert sich. Aber: Das Regelwerk müsste
wissen, welche Rechnung es vor sich hat, und die Pflichtmatrix, die
Nachforderung und die Ablage bekämen je eine Sonderform. Aus einem Beleg
würden zwei Konzepte.

**2. Die strukturierte Rechnung wird zu einem PDF gerendert und dann gelesen.**
Kein neuer Code jenseits eines Renderers; alles Weitere läuft wie bisher.
Ehrlich gesagt eine Versuchung, weil der Weg bewiesen ist. Aber er erfindet
Unsicherheit, wo keine ist: Ein exakter Wert bekäme eine OCR-Konfidenz und
eine Bounding Box auf einem Blatt, das niemand je gesehen hat. Der
Konfidenzpfad würde auf Zahlen reagieren, die aus dem eigenen Renderer
stammen.

**3. Die strukturierte Rechnung ist ein Beleg wie jeder andere, ohne
Leseunsicherheit.**
Derselbe Eingang wie ein PDF, derselbe Belegtyp `handelsrechnung`, dieselben
Pfade, dieselbe Assertion. Nur die Herkunft ist anders: Methode
`strukturiert`, Konfidenz 1, keine Seite, keine Bounding Box. Das Regelwerk
merkt den Unterschied nicht, und der Konfidenzpfad greift nie, weil nichts
gelesen wurde. Ein Schema entscheidet, was gültig ist; was es nicht
besteht, hängt als `unclassified` mit Hinweis an der Akte.

## Entscheidung

**Option 3.** Erkennbar an:

- `extraktion/zollpilot_extraktion/cii.py`: `lies_cii` liest eine
  CII-Rechnung in dieselben Pfade wie der PDF-Extraktor, `schreibe_cii`
  schreibt die Rechnungsfakten der Akte als CII. Beide Richtungen validieren
  gegen das Schema.
- `extraktion/zollpilot_extraktion/schema/cii/`: die vier XSD-Dateien der
  Version D16B, unverändert, mit Quelle und SHA-256 in `QUELLE.md`. Jeder
  Test validiert mit `lxml` dagegen; ein XML, das durchfällt, wird nicht
  halb gelesen.
- `akte.py` erkennt CII am Inhalt, nicht am Dateinamen, und nimmt es über
  dieselben Eingänge entgegen. `dienst.py` bekommt eine Route für die
  Gegenrichtung (`POST /extraktion/akte/cii`).
- Methode `strukturiert` mit Konfidenz 1 und ohne Fundstelle. Das ist eine
  Aussage, nicht eine Lücke: Es gibt keine Stelle im Bild, an der man
  nachlesen könnte.
- `tests/test_cii.py`: die Rundreise. Rechnungsfakten der Golden-Set-Akte
  als CII schreiben, über `extrahiere_akte` lesen, gegen `erwartet.json`
  derselben Akte vergleichen. Die Rechnung als Datensatz hängt an derselben
  Messlatte wie die Rechnung als PDF.

## Konsequenzen

**Positiv**

- Eine Rechnung, zwei Herkünfte, ein Regelwerk. Kein Pfad, keine Regel, kein
  Pflichteintrag musste die Form kennen.
- Die Datenschutzlage bleibt: Das XML wird lokal gelesen, nichts verlässt
  den Stack. Ein Datensatz braucht keine OCR und keinen Anbieter.
- Die Gegenrichtung ist da. Wer die geprüfte Rechnung als Datensatz an ein
  Zoll- oder ERP-System weitergeben will, bekommt ein schemagültiges CII,
  nicht ein Ad-hoc-JSON.

**Negativ**

- **Konfidenz 1 heißt nicht richtig.** Ein Datensatz mit falscher Warennummer
  trägt sie mit voller Sicherheit. Der Konfidenzpfad hilft dann nicht, und
  ein Verstoß ist sofort ein Fachfehler. Das ist korrekt, aber wer bisher
  „nachlesen" als Puffer kannte, verliert ihn hier.
- **Nur der Kern ist abgebildet.** Kopf, Parteien mit Land und EORI,
  Positionen, Zuschläge, Rabatte, Endbetrag. Steuer, Zahlung, Lieferung und
  Referenzen werden weder gelesen noch geschrieben. Wer sie braucht,
  erweitert `cii.py`, nicht das Regelwerk.
- **Die Ursprungserklärung bleibt beim PDF.** CII hat für den Erklärungstext
  keinen eigenen Platz; eine CII-Rechnung liefert deshalb keinen
  Präferenznachweis, und PFL-05 meldet ihn als fehlend. Das ist richtig
  (der Nachweis muss anders kommen), aber es überrascht.
- **UBL ist nicht dabei.** Die zweite verbreitete Syntax bräuchte ein zweites
  Lese- und Schreibmodul. Die Entscheidung gilt für beide; gebaut ist eine.
- **Ein neues Schema im Repo.** 144 KB XSD, die niemand hier pflegt. Die
  Version D16B ist stabil, aber ein Wechsel auf eine neuere Fassung ist eine
  eigene Aufgabe.

## Wann wir anders entscheiden würden

- **Wenn der Datensatz mehr weiß als die Akte.** Trägt eine strukturierte
  Rechnung Steuer, Zahlungsbedingungen oder Referenzen, die das Regelwerk
  eines Tages prüft, wächst der Kern in `cii.py`. Bleibt das bei drei
  Feldern, bleibt es Option 3; wird daraus ein eigenes Fachmodell mit
  eigenen Regeln, war Option 1 doch die richtige.
- **Wenn strukturierte Rechnungen die Mehrheit sind.** Dann ist der
  PDF-Extraktor der Sonderfall, und die Bewertung müsste die Rundreise als
  Basislinie führen, nicht als Zusatz.
- **Wenn ein Datensatz mit Bild kommt (ZUGFeRD, Factur-X).** Dann gibt es
  beides: das XML mit Konfidenz 1 und das PDF mit Fundstelle. Welche
  Herkunft den Fakt setzt, wenn sie sich widersprechen, ist heute nicht
  entschieden; `aufbau.mjs` nimmt die letzte finale Assertion. Das wäre eine
  eigene ADR.
