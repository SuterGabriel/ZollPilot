# ADR-003: Kein Modell in der Entscheidungsschicht — Lesefehler vor Fachfehler

- **Status:** angenommen
- **Datum:** 2026-09-12
- **Stufe:** 0 (gilt ab der ersten Regel, obwohl die Extraktion erst in Stufe 3 kommt)

## Kontext

Ein Vision-Modell kann heute ein CMR lesen, eine Rechnung in Positionen
zerlegen und auf die Frage „passt das B/L zur Packliste?“ eine plausible
Antwort geben. Die Versuchung ist, genau das zu bauen: Dokumente rein,
Modell fragen, Antwort als Freigabe.

Drei Eigenschaften der Domäne sprechen dagegen. Erstens sind die Folgen
asymmetrisch: Eine übersehene fehlende Ursprungserklärung kostet drei Jahre
Nacherhebung, eine überflüssige Rückfrage kostet eine E-Mail. Zweitens muss
jede Entscheidung Jahre später begründbar sein — mit Eingabewerten, Regel und
Regelversion, nicht mit „das Modell fand es unauffällig“. Drittens liefern
Vision-Modelle keine kalibrierten Konfidenzen und keine Koordinaten
(`docs/07-idp-ocr.md`): Ein Modell, das auf einem schlechten Scan eine
Containernummer halluziniert, meldet nicht, dass es geraten hat.

Gleichzeitig ist die Gegenposition — alles deterministisch — an einer Stelle
naiv: Ein Prüfziffernfehler ist auf einem Scan meistens ein Lesefehler und
selten ein Dokumentfehler. Ein System, das jede falsch gelesene Prüfziffer
fachlich ablehnt, blockiert korrekte Akten wegen OCR.

## Optionen

**1. Das Modell entscheidet, Regeln sind Prompts.**
Schnell gebaut, erstaunlich gut auf sauberen Belegen, und die Erklärung
kommt in natürlicher Sprache mit. Für einen Demo-Flow, der nur den Happy Path
zeigen soll, die beste Wahl. Unbrauchbar, sobald jemand fragt, warum die
Akte vom 3. März freigegeben wurde und welche Regelversion galt.

**2. Hybrid: Das Modell entscheidet, deterministische Regeln sind das Netz.**
Das Modell bewertet, harte Regeln blockieren zusätzlich. Klingt nach dem
Besten aus beiden Welten. Praktisch entstehen zwei Entscheidungsinstanzen mit
zwei Erklärungen, und im Streitfall gewinnt die, die der Sachbearbeiter
zuerst gelesen hat. Die Verantwortung ist geteilt und damit bei niemandem.

**3. Deterministisch entscheiden, Modelle davor — mit Konfidenzpfad.**
Modelle extrahieren, klassifizieren und normalisieren. Sie liefern Assertions
mit Konfidenz. Die Entscheidung läuft ausschließlich in `src/regelwerk.mjs`
auf normalisierten Fakten. Der Konfidenzpfad ist die Brücke: Schlägt eine
Prüfziffer oder Summe fehl und der Wert stammt mit niedriger Konfidenz aus
der Extraktion, ist das Ergebnis `re_extraction_required` — nicht
`verletzt`.

## Entscheidung

**Option 3.** Erkennbar an:

- `src/regelwerk.mjs` importiert kein Modell und keinen HTTP-Client. Die
  Funktion `pruefeAkte(eingang, katalog, register)` ist rein.
- `rules.yaml` → `defaults.low_confidence_below: 0.80`. TRN-02, TRN-01 und
  VAL-01 fragen `konfidenz(akte, pfad)` und liefern
  `re_extraction_required` unterhalb der Schwelle. Der Freigabestatus
  `nachextraktion_erforderlich` steht vor `blockiert` in der Entscheidung.
- Testakte `schlechter-scan.json`: Containernummer mit Konfidenz 0,55 und
  falscher Prüfziffer → Nachextraktion, keine Blockade.
- Jeder Befund trägt `eingaben`, `regelversion`, `begruendung`. Das ist die
  Form, die in Postgres als `rule_result` liegt.

Was Modelle dürfen, steht in der Pipeline (`docs/07`): Klassifikation bei
niedriger regelbasierter Konfidenz, Feldzuordnung in Tabellen, semantische
Normalisierung. Was sie nie dürfen: einen Fakt setzen, ohne dass eine
Assertion mit Konfidenz dahintersteht, und eine Regel auswerten.

## Konsequenzen

**Positiv**

- Jede Entscheidung ist reproduzierbar: gleiche Assertions, gleicher
  Katalog, gleiches Ergebnis. Der Rauchtest gegen das laufende System prüft
  genau das.
- Der Konfidenzpfad verhindert den häufigsten Fehlalarm. Ohne ihn wäre die
  False-Positive-Rate der harten Regeln an der Scanqualität gekoppelt.
- Die Extraktion ist austauschbar. ABBYY, Document AI oder ein Vision-Modell
  liefern dieselbe Form (Assertion mit Konfidenz), und kein Regeltest muss sich
  ändern.

**Negativ**

- **Semantische Prüfungen fehlen.** Ob „Hydraulikpumpe“ zu HS 8413 passt
  (CLS-04), kann keine deterministische Regel sagen. Diese Regeln bleiben
  weich und werden, wenn überhaupt, als Warnung mit Modellunterstützung
  gebaut — nie als Blockade.
- **Die Konfidenzschwelle ist eine einzige Zahl für alle Felder.** 0,80 für
  eine Containernummer und für einen Betrag ist eine Vereinfachung; je
  Feldklasse kalibriert wäre richtig. Steht in `docs/OFFENE-PUNKTE.md`.
- **Nachextraktion ist ein Zustand ohne Prozess.** Was passiert, wenn die
  zweite Extraktion dieselbe Konfidenz liefert? Heute: Human Review, aber der
  Weg dorthin ist nicht gebaut.
- **Der Konfidenzpfad braucht echte Konfidenzen.** Von einem Vision-Modell
  kommen keine; dann ist die Schwelle wirkungslos und jeder Fehler ein
  Fachfehler. Das ist ein Argument für OCR mit Koordinaten als primäre
  Extraktion (`docs/07`), nicht gegen diese ADR.

## Wann wir anders entscheiden würden

- **Wenn die Entscheidung keine Rechtsfolge hätte.** Ein Vorschlagssystem,
  das nur sortiert, welche Akte ein Mensch zuerst ansieht, dürfte ein Modell
  entscheiden lassen.
- **Wenn kalibrierte Konfidenzen und Fundstellen vom Modell kämen.** Dann
  wäre der Unterschied zwischen OCR und Modell in der Extraktion aufgehoben —
  die Entscheidungsschicht bliebe trotzdem deterministisch.
- **Wenn sich zeigte, dass die weichen semantischen Regeln den größten
  Nutzen tragen.** Dann müsste die Frage neu gestellt werden, ob eine
  Modellwarnung eine Freigabe verzögern darf. Die Antwort wäre eine eigene
  ADR, keine Aufweichung dieser.
