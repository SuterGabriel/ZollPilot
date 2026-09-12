# ADR-001: Die Akte ist das Objekt — Assertions und Fakten getrennt

- **Status:** angenommen
- **Datum:** 2026-09-12
- **Stufe:** 0

## Kontext

Der naheliegende Entwurf für „Dokumente prüfen“ ist eine Pipeline je Dokument:
PDF rein, Felder raus, Felder prüfen. Er scheitert an drei Stellen, die in der
Zollpraxis Alltag sind.

Erstens kommen Belege in Versionen. Ein Draft-B/L trägt dieselben Felder wie
das finale B/L, und wer sie gleich behandelt, meldet die Anmeldung auf einem
Entwurf an (Art. 15 UZK, `docs/08` zum Vorbehalt). Zweitens widersprechen sich
Belege: Die Packliste nennt einen Container, das B/L einen anderen. Ein Modell,
das „den“ Container speichert, muss sich entscheiden — und verliert, wovon es
abgewichen ist. Drittens ist die Extraktion unsicher. Ein OCR-Wert mit
Konfidenz 0,55 und ein Wert aus dem Textlayer sind nicht dieselbe Sorte
Information, auch wenn beide „MSKU1234565“ lauten.

Dazu kommt die Aufbewahrungspflicht: Die Beweiskette — welches Dokument hat
welchen Wert an welcher Stelle gesagt — muss nach Jahren rekonstruierbar sein
(Art. 51 UZK, § 147 AO, GoBD; alle `TODO-verify`).

## Optionen

**1. Ein Sendungsdatensatz, Felder werden beim Import gesetzt.**
Jede Extraktion schreibt direkt in `shipment.container_id`. Einfach, ein
Objekt, eine Tabelle, jede Regel liest ein Feld. Das ist die Form, die jedes
ERP schon hat, und für ein Demo mit sauberen PDFs reicht sie. Der Preis: Der
letzte Import gewinnt, Widersprüche verschwinden im Überschreiben, und die
Frage „woher kommt dieser Wert“ hat keine Antwort.

**2. Assertions und Fakten getrennt.**
`DocumentFieldAssertion` hält, was ein Beleg sagt: Dokument, Pfad, Wert,
Rohwert, Konfidenz, Seite, Methode. Sie wird nie geändert. `CanonicalFact` ist
eine Ableitung: der Aktenwert je Pfad, mit Herkunft. Regeln lesen Fakten;
wenn ein Fakt fehlt oder unsicher ist, wissen sie, warum.

**3. Event Sourcing über die ganze Akte.**
Jeder Eingang, jede Korrektur, jeder Override ist ein Ereignis; die Akte ist
eine Projektion. Der vollständigste Ansatz, und der einzige, der auch
Overrides und Zeitreisen sauber abbildet. Aber ein Ereignisspeicher mit
Projektionen ist Maschinerie, die vor der ersten Regel steht, und in n8n
ohne eigene Infrastruktur nicht zu Hause.

## Entscheidung

**Option 2.** Erkennbar an `src/akte/aufbau.mjs`: `baueAkte()` nimmt
`dokumente[]` und `assertions[]`, liefert `fakten` und `herkunft`, und lässt
nur Assertions aus Dokumenten mit Status `final` zu Fakten werden. Alles
andere landet in `nicht_final`, damit REF-03 es melden kann. In Postgres sind
das die Tabellen `document_field_assertion` und `canonical_fact`
(`deploy/postgres/init.sql`).

Zwei Folgeentscheidungen sind Teil davon:

- Die Ursprungserklärung auf der Rechnung ist ein **eigener logischer Beleg**
  vom Typ `origin_declaration` mit Verweis auf den Träger. Sonst könnte die
  Pflichtmatrix nicht sagen, dass EUR.1 und Erklärung dieselbe Anforderung
  erfüllen, ohne den Belegtyp „Rechnung“ als Präferenznachweis zuzulassen.
- Sachverhalt und Anmeldung sind Stammdaten der Akte, keine Belegaussagen.
  Sie haben Konfidenz 1 und keine Herkunft.

## Konsequenzen

**Positiv**

- REF-03 ist keine Regel, die man vergessen kann: Der Aufbau selbst lässt
  Drafts nicht durch. Die Regel macht es nur sichtbar.
- Der Konfidenzpfad wird möglich. TRN-01 und TRN-02 können bei einem
  Widerspruch fragen, ob einer der Werte unsicher gelesen wurde, und
  Nachextraktion statt Ablehnung auslösen (ADR-003).
- Widersprüche gehen nicht verloren. Beide Containernummern stehen in den
  Assertions, auch wenn die Akte nur einen Fakt führt.

**Negativ**

- **Zwei Objekte, wo eines gereicht hätte.** Jeder, der die Akte liest, muss
  wissen, dass `fakten` abgeleitet ist. Der Aufbau ist sechzig Zeilen, die es
  in Option 1 nicht gäbe.
- **Konflikte zwischen finalen Dokumenten sind noch nicht modelliert.** Sagen
  zwei finale B/L Verschiedenes, gewinnt derzeit die spätere Assertion —
  stillschweigend. Das ist genau der Fehler, den diese ADR verhindern will,
  und steht als offener Punkt in `docs/OFFENE-PUNKTE.md`.
- **Pfade als Zeichenketten.** `rechnung.positionen.0.hs6` ist ein Vertrag
  ohne Typprüfung. Ein Tippfehler im Pfad ist ein fehlender Fakt, keine
  Fehlermeldung.

## Wann wir anders entscheiden würden

- **Wenn es nur eine Quelle je Feld gäbe** — etwa ein ERP, das die Akte
  bereits konsolidiert liefert. Dann ist Option 1 richtig und diese Trennung
  ein Umweg.
- **Wenn Overrides und Korrekturen zum Kern würden.** Sobald Sachbearbeiter
  regelmäßig Fakten setzen und die Frage „wer hat wann was geändert“ die
  Hauptfrage ist, trägt Option 2 nicht mehr und Option 3 wird fällig.
- **Wenn der Konfliktfall häufig wäre.** Dann braucht `canonical_fact` eine
  echte Auflösungsregel statt „die spätere gewinnt“ — und das ist der Moment,
  in dem sich zeigt, ob diese ADR gehalten hat.
