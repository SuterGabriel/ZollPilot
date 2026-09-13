# ZollPilot, einfach erklärt

Diese Seite erklärt, was ZollPilot tut, ohne Fachbegriffe aus der
Softwareentwicklung. Wer die technische Fassung sucht: `README.md` und
`docs/PRODUKT.md`.

## Das Problem

Wer Waren ins Ausland verschickt, schickt Papiere mit. Eine Handelsrechnung,
eine Packliste, ein Frachtpapier, oft ein Ursprungsnachweis, dazu die
Ausfuhranmeldung. Diese Belege kommen von verschiedenen Absendern, über
mehrere Wochen, in beliebiger Reihenfolge, manche zuerst als Entwurf und
später in der endgültigen Fassung.

Irgendwann, meist kurz vor dem Abgabeschluss beim Zoll oder bei der Reederei,
muss jemand sagen können: Ist diese Sendung vollständig und stimmt alles
zusammen. Heute macht das ein Mensch, mit einer Tabelle, dem Postfach und
Erfahrung.

Ein übersehener Widerspruch ist teuer. Steht auf dem Frachtpapier eine andere
Containernummer als auf der Packliste, bezeichnet die Anmeldung womöglich eine
andere Sendung als die, die verladen wird. Fehlt der Ursprungsnachweis, wird
die Zollpräferenz gestrichen, und der Zoll kann bis zu drei Jahre rückwirkend
nachfordern.

## Die Idee

ZollPilot verarbeitet keine Dokumente, sondern führt pro Sendung eine **Akte**.

Der Unterschied klingt klein und ist der Kern. Ein System, das Dokumente
verarbeitet, fragt: Liegt die Rechnung vor. Ein System, das eine Akte führt,
fragt: Ist der Rechnungsbetrag nachgewiesen, und sagen zwei Belege dasselbe.
Ein Beleg ist damit keine Wahrheit, sondern eine Behauptung mit einer Quelle.
Die Akte hält fest, was daraus gesichert ist, und was noch fehlt.

## Wie es abläuft

**1. Belege gehen ein.** Über eine Weboberfläche, per E-Mail oder aus einem
anderen System. Eine Antwort per Mail findet ihre Akte selbst, über die
Sendungsnummer im Betreff.

**2. Die Belege werden gelesen.** Aus jedem PDF werden Werte gezogen, jeder
mit seiner Fundstelle: Seite, Stelle auf der Seite, und wie sicher die
Erkennung war. Wer später fragt, woher eine Zahl kommt, bekommt die Antwort.

**3. Die Akte wird geprüft.** Feste Regeln rechnen nach. Ergibt die Summe der
Positionen den Rechnungsbetrag. Stimmt die Prüfziffer der Containernummer.
Steht auf allen Belegen dieselbe Warennummer. Deckt der Ursprungsnachweis die
Ware, für die die Präferenz beansprucht wird. Ist die Anmeldung dieselbe
Sendung, die verladen wird.

**4. Es gibt ein Ergebnis.** Entweder freigabereif, oder blockiert, und dann
mit einer Begründung je Regel: welches Feld, welcher Widerspruch, welche
Folge. Fehlt etwas, entsteht daraus ein fertiges Anschreiben an die
zuständige Stelle, mit Frist. Kommt keine Antwort, erinnert das System
selbstständig, und zwar gestaffelt: erst freundlich, dann vor dem Abgabe-
schluss beim Zoll, dann an die Teamleitung.

## Ein Beispiel

Eine Sendung nach Singapur, mit Präferenz. Der Ursprungsnachweis fehlt.

Das System blockiert die Akte und schreibt dem Lieferanten: welches Feld
fehlt, warum es gebraucht wird, welche Nachweise akzeptiert werden, was
passiert, wenn nichts kommt.

Der Lieferant antwortet und hängt seine Rechnung an, auf der die
Ursprungserklärung steht. Das System ordnet die Mail der Akte zu, liest den
neuen Beleg, prüft die ganze Akte noch einmal und schließt die offenen
Nachforderungen. Die Akte ist freigabereif.

Dabei saß niemand am Bildschirm.

## Was ZollPilot anders macht

**Geprüft wird die Angabe, nicht das Papier.** Die Frage lautet nie "liegt
Beleg X vor", sondern "ist Angabe Y nachgewiesen". Ein Ursprungsnachweis kann
ein eigenes Formular sein oder eine Erklärung auf der Rechnung. Beides zählt.

**Was ein Beleg sagt, wird nie überschrieben.** Kommt eine neue Fassung, steht
sie daneben, nicht darüber. Auch nach Jahren lässt sich zeigen, welcher Beleg
was behauptet hat.

**Die Regeln stehen in einer Tabelle, nicht im Programm.** Jede Regel trägt
ihre Schwelle, ihre Rechtsgrundlage und ein Datum, ab dem sie gilt. Bei einer
Prüfung in drei Jahren ist die Frage nicht, was das System heute tut, sondern
was damals galt. Diese Frage kann es beantworten.

**Über die Freigabe entscheidet kein KI-Modell.** Künstliche Intelligenz liest
Belege und schlägt vor, welche Art von Dokument vorliegt, wenn die Regeln es
nicht erkennen. Die Entscheidung selbst trifft ein Programm, das nachrechenbar
ist und bei gleichen Eingaben immer gleich antwortet. Ein Vorschlag aus einem
Modell wird nie stillschweigend zur Tatsache; er steht als Vorschlag daneben,
und ein Mensch nimmt ihn an oder nicht.

## Was es bewusst nicht tut

- Es gibt keine Zollanmeldung ab und ersetzt keine Zollsoftware. Es prüft, was
  vor der Anmeldung stimmen muss.
- Es entscheidet nicht im Zweifel. Ist ein Wert schlecht lesbar, meldet es
  einen Lesefehler und verlangt eine zweite Lesung, statt eine Sendung wegen
  eines Erkennungsfehlers abzulehnen.
- Es wirft nichts still weg. Ein Beleg, den es nicht einordnen kann, bleibt an
  der Akte und wird gemeldet.
- Ein Mensch kann eine Regel übersteuern. Dann wird festgehalten, wer das war,
  wann, mit welcher Begründung, und ob der Name geprüft oder nur eingetippt
  war.

## Wo es steht

ZollPilot ist ein Prototyp und deckt einen Fall vollständig ab: Ausfuhr in ein
Drittland, Seefracht im ganzen Container, Präferenz beansprucht. Lieber ein
Ablauf, der zu Ende gedacht ist, als vierzig halbfertige Prüfungen.

Alle Testdaten sind erfunden. Es sind nie echte Sendungsdaten im Spiel. Alle
Rechtsverweise stammen aus zweiter Hand und sind vor einem echten Einsatz zu
prüfen; wo etwas unsicher ist, steht das ausdrücklich dabei.
