# ADR-002: Regeln sind Daten — und ein Gate hält den Code daran

- **Status:** angenommen
- **Datum:** 2026-09-12
- **Stufe:** 0

## Kontext

Die Regeln dieses Systems stehen und fallen mit Zahlen, die nicht aus dem
Code stammen: 6.000 EUR für die Ursprungserklärung, 8 Stellen für die
Ausfuhr-Warennummer, 10 Prozent Eskalation beim Gewicht. Jede dieser Zahlen
hat eine Quelle, ein Gültigkeitsdatum und — das ist der Punkt — einen
Verifikationsstand. Keine ist gegen die Primärquelle geprüft
(`docs/08-known-unknowns.md`); die Gewichtstoleranz ist gar keine Norm,
sondern Praxisannahme.

Das Vorgängerprojekt hat den Befund geliefert, der hier den Ausschlag gibt:
*Falscher Code fällt im Test auf, falsche Fachlogik nicht.* Ein Test über eine
erfundene Schwelle ist grün. Und ein Agent, der eine Regel implementiert,
setzt die Schwelle ein, die ihm plausibel erscheint — bevor jemand die Quelle
geprüft hat.

Erschwerend: Schwellen ändern sich mit Abkommen und Rechtsständen. Ein
Deployment für eine geänderte Wertgrenze ist im Zollumfeld keine Option, wenn
die Änderung am Montag gilt.

## Optionen

**1. Konstanten im Code mit Fundstelle im Kommentar.**

```js
// Art. 61-66 UZK-IA: Ursprungserklärung bis 6.000 EUR ohne Bewilligung
const SCHWELLE = 6000;
```

Die Quelle steht daneben, nichts ist zu synchronisieren, jeder Leser sieht
Zahl und Grund in einer Zeile. Das ist die Form, die neunzig Prozent aller
Projekte wählen, und sie ist nicht dumm. Ihr Preis: Die Zahl ist unprüfbar an
Ort und Stelle. Ob der Kommentar noch zur Zahl passt, ob die Quelle verifiziert
ist, ob die Regel überhaupt noch gilt — dafür gibt es kein Signal. Und die
Änderung ist ein Deployment.

**2. Katalog in YAML, Code liest Parameter, ein Gate verbietet nackte Zahlen.**
`rules.yaml` trägt je Regel `parameters` oder `tolerance`, `legal_basis`,
`legal_source` und `valid_from`. Die Implementierung bekommt die Regel als
Argument und liest ihre Zahlen daraus. Ein Skript prüft, dass in
`src/regeln/` keine Zahl außer 0, 1 und 2 vorkommt und dass Katalog,
Dokumentation, Implementierung und Test deckungsgleich sind.

**3. Regel-DSL, die vollständig aus Daten ausgewertet wird.**
Etwa JSON-Logic oder eine eigene Ausdruckssprache: Die Regel steht komplett im
Katalog, der Code ist ein Interpreter. Der reinste Ansatz — eine neue Regel ist
dann wirklich nur eine Datenänderung, kein Code. Aber die Regeln hier sind
nicht flach: ORG-02 vergleicht Positionen gegen einen Warenkreis nach
Normalisierung, TRN-02 rechnet eine Prüfziffer und fragt die Konfidenz ab.
Das in eine DSL zu pressen erzeugt entweder eine Sprache, die niemand lesen
kann, oder Ausnahmen, die wieder Code sind.

## Entscheidung

**Option 2.** Erkennbar an:

- `rules.yaml`: 13 Regeln, jede mit `id`, `hardness`, `risk`, `inputs`,
  `assertion`, `legal_basis`, `legal_source`, `consequence`, `valid_from`;
  fachliche Zahlen unter `parameters` oder `tolerance`.
- `src/regeln/<ID>.mjs`: bekommt `(akte, regel, defaults, katalog)` und
  liest jede Zahl aus `regel`. ORG-06 kennt die 6.000 nicht; es kennt
  `regel.parameters.threshold`.
- `scripts/regel-check.mjs`: Pflichtfelder, eindeutige IDs, Wertebereiche,
  `[MVP]`-Markierung in `docs/03` gegen den Katalog in beide Richtungen,
  Implementierung und Test je Regel, keine nackte Zahl. Läuft im Hook und
  in der CI und hat eine eigene Testsuite mit Fixtures.
- `legal_source` ist Pflicht und kennt drei Werte: `verified`, `secondary`,
  `practice`. Heute trägt keine Regel `verified`. Das ist kein Mangel des
  Katalogs, sondern seine wichtigste Aussage.

## Konsequenzen

**Positiv**

- Eine Schwellenänderung ist eine Katalogänderung. Der Test, der die Schwelle
  aus dem Katalog liest, prüft danach automatisch die neue Zahl.
- Der Verifikationsstand ist Teil des Ergebnisses: Jeder Befund trägt
  `rechtsquelle_status`. Ein Sachbearbeiter sieht, dass ORG-06 auf
  Sekundärrecherche steht.
- Der Agentenfehler aus dem Vorgängerprojekt — plausible Zahl ohne Quelle —
  bekommt die CI rot statt eines Review-Kommentars, den niemand schreibt.
- Die Dokumentation kann nicht mehr vom Katalog abweichen. Die erste
  Abweichung wurde am Tag der Entscheidung gefunden: `PROJECT.md` nannte
  zwölf Regeln, der Katalog hatte dreizehn.

**Negativ**

- **0, 1 und 2 sind eine Lücke.** Eine fachliche Zwei — „zwei Originale“ —
  rutscht durch. Ohne die Ausnahme meldet das Gate jede Schleife und jeden
  Index, und ein Gate mit Fehlmeldungen wird abgeschaltet. Der Tausch ist
  bewusst; die Lücke ist als Fixture dokumentiert.
- **Der Literal-Filter ist eine Heuristik.** Zahlen in Zeichenketten, Regex
  und Kommentaren werden ausgeblendet, und die Regex-Erkennung rät anhand des
  vorangehenden Zeichens. Ein Regex nach einem Bezeichner würde als Division
  gelesen. Bisher kein Fall im Repo; die Fixtures halten die bekannten Formen.
- **Darstellung wandert aus den Regeln.** `toFixed(1)` und `* 100` durften
  nicht in QTY-02 bleiben und leben jetzt als `prozent()` in der
  Normalisierung. Das ist richtig, aber es ist Umweg.
- **Der Katalog ist im Code-Node eingebettet** (ADR-004). Für den
  n8n-Workflow ist eine Katalogänderung also doch ein Bundle plus Import.
  Der Anspruch „ohne Deployment“ gilt heute für CLI und Tests, nicht für den
  Workflow.

## Wann wir anders entscheiden würden

- **Wenn die Regeln flach wären.** Nur Schwellenvergleiche auf einzelnen
  Feldern — dann trägt Option 3, und der Interpreter ist fünfzig Zeilen.
- **Wenn die Zahlen verifiziert und stabil wären.** Bei fünf Konstanten mit
  Primärquelle und jahrelanger Gültigkeit ist Option 1 ehrlicher als ein
  Katalog mit Prüfskript.
- **Wenn der Katalog zur Laufzeit geladen würde** — aus Postgres oder über
  HTTP im Workflow. Dann fällt der negative Punkt zum Bundle weg, und die
  Frage, ob der Katalog versioniert und signiert sein muss, wird die neue ADR.
- **Wenn das Gate mehr Fehlmeldungen als Funde liefert.** Dann ist die
  Heuristik falsch kalibriert, und die Antwort ist ein echter Parser, nicht
  eine längere Ausnahmeliste.
