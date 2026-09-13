# ADR-011: Das Modell schlägt einen Belegtyp vor, es setzt ihn nicht

- **Status:** angenommen
- **Datum:** 2026-09-13
- **Stufe:** 3b, der Klassifikationsfallback

## Kontext

Die Klassifikation ist regelbasiert: Merkmale mit Gewichten je Belegtyp,
Schwelle bei zwei Punkten (`extraktion/zollpilot_extraktion/klassifikation.py`).
Das ist schnell, nachvollziehbar und auf dem Golden Set fehlerfrei. Es kennt
aber nur, was jemand aufgeschrieben hat. Ein CMR-Frachtbrief ist in
`docs/01-dokumententypologie.md` beschrieben und steht in keiner
Merkmalsliste; er bleibt `unclassified`, hängt an der Akte und wird gemeldet.

Beide Ausschreibungen verlangen ausdrücklich "KI- und regelbasierte
Klassifikation", und `PROJECT.md` sagt seit dem ersten Tag "regelbasiert mit
LLM-Fallback bei niedriger Konfidenz". Der Fallback war nie gebaut.

Drei Kräfte ziehen gegeneinander. Die vierte Projektregel verbietet ein
Modell in der Entscheidungsschicht. Der Datenschutz verlangt Pseudonymisierung
vor jedem Modellaufruf (`docs/DATENSCHUTZ.md`), und zwar in derselben
Entscheidung, nicht danach. Und die Beweisbarkeit verlangt, dass die CI ohne
Schlüssel, ohne Netz und ohne Kosten grün wird.

## Optionen

**A: Keinen Fallback bauen.** Ein unbekannter Beleg bleibt unbekannt und wird
gemeldet. Das ist ehrlich, kostet nichts und hat keine Angriffsfläche. Der
Vorteil ist echt: Jede Aussage der Extraktion bliebe deterministisch und
ohne externe Abhängigkeit. Der Preis ist, dass eine benannte Fähigkeit
unbelegt bleibt und ein Prüfer bei jedem unbekannten Beleg bei null anfängt.

**B: Das Modell klassifiziert und setzt den Typ.** Der Beleg bekommt seinen
Typ, die Feldextraktion läuft, die Akte ist vollständig. Bequem, und für
einen reinen Durchsatz die naheliegende Wahl. Aber der Typ ist die Eingabe
der Pflichtmatrix: `required_evidence` fragt, ob ein Beleg dieses Typs
vorliegt. Ein falsch geratener Typ könnte eine Nachweispflicht erfüllen und
eine Sendung freigeben. Damit stünde ein Modell in der Entscheidungsschicht.

**C: Das Modell schlägt vor, ein Mensch entscheidet.** Der Typ bleibt
`unclassified`; daneben hängt ein Vorschlag mit Modellname, Konfidenz und
Begründung. Die Akte bleibt blockiert wie zuvor, aber der Prüfer liest
"vermutlich ein CMR, weil Überschrift und Artikelverweis" statt "unbekannt".

## Entscheidung

Option C. Erkennbar an `extraktion/zollpilot_extraktion/modell.py` (die
Nahtstelle, geschlossene Typenauswahl, geprüfte Antwort),
`extraktion/zollpilot_extraktion/pseudonymisierung.py` (Parteien raus vor dem
Aufruf) und dem Feld `klassifikation.vorschlag` am Dokument, das der Typ
nicht ist. `extraktion/tests/test_modell.py` hält die Grenze fest: Der
Vorschlag steht da, der Typ bleibt `unclassified`.

Wie bei den IDP-Anbietern liegt jede Antwort als Aufzeichnung im Repo
(`extraktion/tests/fixtures/modell/`). Ohne `ZOLLPILOT_MODELL_AUFZEICHNEN`
ruft der Fallback nie, er liest nur. Modell ist Claude Haiku 4.5 über die
Messages-Schnittstelle von Anthropic; der Schlüssel steht ausschließlich in
`.env`.

## Konsequenzen

Positiv:

- Die Pseudonymisierung ist gebaut, wie im Datenschutzdokument seit Beginn
  angekündigt, und sie ist einzeln geprüft: keine Partei geht hinaus, kein
  Merkmal geht verloren.
- Die CI bleibt grün ohne Schlüssel und ohne Netz, weil die Aufzeichnung im
  Repo liegt. Derselbe Beweis läuft auf jeder Maschine.
- Ein unbekannter Beleg ist nicht mehr eine Sackgasse, sondern eine Frage mit
  Vorschlag.
- Die vierte Regel bleibt unangetastet und wird an dieser Stelle sogar
  schärfer sichtbar als vorher.

Negativ:

- **Der Fallback hilft nur, wenn die Regeln schweigen, nicht wenn sie sich
  irren.** Ein CMR, der eine Handelsrechnung erwähnt, wird von den Regeln als
  Handelsrechnung klassifiziert und erreicht den Fallback nie. Das ist beim
  Schreiben des ersten Tests aufgefallen und bleibt offen.
- Die Pseudonymisierung arbeitet mit Mustern. Sie fängt Firmen mit
  Rechtsform, Anschriften, Kennnummern und beschriftete Parteifelder. Ein
  ungewöhnlicher Name ohne Rechtsform und ohne Anschrift kann durchrutschen.
  Das ist eine Minderung, keine Garantie.
- Eine Aufzeichnung ist eine Momentaufnahme. Ein neueres Modell antwortet
  vielleicht anders; der Test prüft dann die Aufzeichnung, nicht das Modell.
- Ein externer Dienst mehr, ein Geheimnis mehr, eine Rechnung mehr.
- Der Vorschlag braucht einen Menschen. Nichts läuft dadurch automatisch
  durch, und das ist Absicht.

## Wann wir anders entscheiden würden

- Wenn die Pflichtmatrix je einen vorgeschlagenen Typ als Nachweis annehmen
  soll, ist diese Entscheidung falsch. Dann steht die vierte Regel zur
  Debatte, nicht dieser Fallback.
- Wenn der Belegmix schmal und stabil ist, sind mehr Merkmale oder ein
  trainierter Klassifikator billiger, schneller und ohne externen Dienst.
- Wenn Belege das Haus nicht verlassen dürfen, auch nicht pseudonymisiert,
  dann ein lokales Modell oder gar keines.
- Wenn die Extraktion einmal Felder statt nur Typen vom Modell lesen soll,
  ist das eine neue Entscheidung: Ein vorgeschlagener Wert ist etwas anderes
  als ein vorgeschlagener Typ, weil er in eine Regel fließt.
