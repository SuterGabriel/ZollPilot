# ADR-010: Die Akte wird abgelegt: Dokumente und Assertions je Prüfung in Postgres, ein Eingang ergänzt sie

- **Status:** angenommen
- **Datum:** 2026-09-12
- **Stufe:** 6, die asynchrone Akte, zweite Hälfte

## Kontext

Bis hierher hält ZollPilot die Akte nur in der Antwort: `pruefung.ergebnis`
trägt die Entscheidung und die erkannten Belege, aber nicht, was die Belege
gesagt haben. Die Assertions liegen in der n8n-Ausführung, und die ist nach
14 Tagen weg. Solange jede Einreichung alle Belege mitbringt, stört das
nicht.

Der Rückweg aus ADR-009 stört sich daran. Eine Antwort auf eine
Nachforderung bringt genau einen Beleg, den fehlenden. Um daraus eine
Entscheidung zu machen, muss das System die anderen Belege der Akte noch
kennen. Und `docs/OFFENE-PUNKTE.md` sagt seit Stufe 5, dass ein
Review-Arbeitsplatz ohne abgelegte Assertions keine Fundstelle zeigen
kann.

Die Tabellen dafür stehen seit Stufe 1 im Schema (`document`,
`document_field_assertion`, `shipment`, PROJECT.md Abschnitt 4). Niemand
schreibt hinein.

## Optionen

**A. Nichts ablegen, jede Antwort muss alle Belege mitbringen.** Vorteil:
kein Zustand, keine Aufbewahrungsfrage, keine doppelten Dokumente. Nachteil:
Der Zielprozess funktioniert so nicht. Ein Lieferant schickt den
Präferenznachweis, nicht den ganzen Satz.

**B. Dokumente und Assertions je Prüfung ablegen, nur anhängen.** Jede
Prüfung schreibt ihre Stammdaten in `shipment` und ihre Belege mit
Assertions in die zwei Tabellen; ein Beleg mit bekanntem Hash wird nicht
noch einmal abgelegt. Ein Eingang lädt die Akte, extrahiert nur die neuen
Belege, hängt sie an und lässt alles zusammen erneut prüfen. Vorteil: Die
Beweiskette liegt dauerhaft dort, wo `pruefung` schon liegt, mit
derselben Zusage aus ADR-001, dass nichts überschrieben wird. Nachteil:
Aktendaten wachsen in Postgres, und die Frage, wie lange sie bleiben, wird
zur Betriebsfrage.

**C. Die Belege selbst ablegen, als Dateien.** Vorteil: Ein
Review-Arbeitsplatz könnte die Fundstelle im PDF zeigen, und eine erneute
Extraktion mit einem besseren Leser wäre möglich. Nachteil: Objektspeicher,
Aufbewahrung von Originalen mit allem, was darin steht, Zugriffsschutz. Das
ist eine eigene Stufe.

## Entscheidung

B. C bleibt vorgesehen. Erkennbar im Repo an:

- `deploy/postgres/init.sql`: `shipment` trägt die Stammdaten als JSON,
  `document` ist je Akte eindeutig über Kennung und über Hash,
  `document_field_assertion` hängt an der Dokumentzeile. `mail_eingang`
  hält jede Mail fest, zugeordnet oder nicht.
- Der Prüf-Workflow legt nach jeder Prüfung ab („Akte ablegen“), mit
  `ON CONFLICT DO NOTHING`: ein zweiter Eingang derselben Datei ändert
  nichts, eine Korrektur ist ein neues Dokument.
- `workflows/zollpilot-eingang.json`: IMAP-Trigger, Aktennummer aus Betreff
  oder Text, Anhänge an die Extraktion, Zusammenführung mit der abgelegten
  Akte, erneute Prüfung über denselben Webhook wie jede Einreichung.
- Neue Belege eines Eingangs bekommen die Kennung mit Suffix `-E<n>`, damit
  sie neben den alten stehen; welche Aussage gilt, entscheidet das
  Regelwerk wie bisher.

## Konsequenzen

Positiv:

- Der Rückweg ist ein Weg: Antwort mit Anhang, Zuordnung, Prüfung, und die
  Nachforderung schließt beim nächsten Lauf.
- Eine Mail ohne erkennbare Akte verschwindet nicht; sie steht in
  `mail_eingang` mit Grund, wie ein unklassifizierter Beleg an der Akte.
- Ein Review-Arbeitsplatz hat jetzt, was er braucht: je Feld die Fundstelle
  mit Seite und Box, dauerhaft.

Negativ:

- **Aktendaten in Postgres, dauerhaft.** Preise, Parteien, Nummern. Bisher
  war das nur `pruefung.ergebnis`; jetzt sind es auch die Rohwerte je Feld.
  Die Aufbewahrung folgt der Zollpflicht (Art. 51 UZK), nicht der
  Ausführungsfrist; `docs/DATENSCHUTZ.md` sagt das.
- **Zwei finale Rechnungen.** Ein Eingang mit einer neuen Fassung der
  Rechnung erzeugt zwei finale Belege desselben Typs; die spätere Assertion
  gewinnt stillschweigend (offen seit Stufe 1). Das war schon vorher wahr,
  wird aber jetzt häufiger.
- **Die Aktennummer muss in der Mail stehen.** Betreff oder Text, im
  Format der Akte. Ohne sie ist die Mail unzugeordnet, und ein Mensch muss
  sie zuordnen; dafür gibt es noch keinen Bildschirm.
- **Keine Originale.** Die PDFs selbst werden nicht abgelegt. Eine erneute
  Extraktion mit einem anderen Leser ist auf abgelegte Akten nicht
  möglich.

## Wann wir anders entscheiden würden

- Sobald ein Review-Arbeitsplatz die Fundstelle im Beleg zeigen soll, kommt
  C dazu: Objektspeicher für die Originale, mit Zugriffsschutz und
  Aufbewahrungsregel.
- Verlangt der Auftraggeber, dass Aktendaten nach Abschluss der Sendung
  aus der Datenbank verschwinden, wird die Ablage zeitlich begrenzt und die
  Beweiskette wandert ins Archiv.
- Kommt die Aktennummer nicht zuverlässig in den Mails an, braucht die
  Zuordnung mehr als ein Muster: Referenzen wie Rechnungs- oder
  Containernummer gegen die abgelegten Assertions. Das wäre eine
  Zuordnungsregel und gehörte nach `src/`.
