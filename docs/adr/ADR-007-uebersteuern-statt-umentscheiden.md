# ADR-007: Ein Mensch übersteuert, das Regelwerk entscheidet um nichts

- **Status:** angenommen
- **Datum:** 2026-09-12
- **Stufe:** 5

## Kontext

Nach Stufe 4 kann jemand Belege einreichen und die Entscheidung lesen. Was
er nicht kann: eingreifen. Ein Befund steht da, und der einzige Ausweg ist,
den Beleg zu korrigieren und neu einzureichen. Drei Dinge fehlen, und sie
hängen zusammen:

- **Übersteuern.** Die Tabelle `override` liegt seit Stufe 1 im Schema, mit
  `benutzer NOT NULL` und `CHECK (length(begruendung) > 10)`. Sie ist leer,
  und nichts schreibt hinein.
- **Die Fundstelle.** Jede Assertion trägt Seite und Bounding Box. Die
  Oberfläche zeigt weder das PDF noch die Markierung darin. Damit ist
  `re_extraction_required` eine Aufforderung ohne Werkzeug: „lies nach" —
  wo?
- **Die Akte über die Zeit.** Es gibt keine Aktenidentität. Ein zweiter
  Beleg zur selben Sendung beginnt einen neuen Vorgang; eine Akte von
  gestern lässt sich nicht öffnen.

Dazu kommt eine Frage, die dieses Repo an anderer Stelle bereits beantwortet
hat und die hier unter Druck gerät: **Darf ein Mensch eine Entscheidung des
Regelwerks ändern?** ADR-003 verbietet Modellen die Entscheidungsschicht,
weil jede Entscheidung Jahre später mit Eingabewerten, Regel und
Regelversion begründbar sein muss. Ein Mensch ist kein Modell — aber wenn
sein Eingriff den Befund überschreibt, ist dieselbe Nachvollziehbarkeit
verloren: In der Akte stünde dann `ok`, wo das Regelwerk `verletzt` gesagt
hat, und niemand sähe den Unterschied.

Und eine dritte Kraft: **Es gibt keine Anmeldung.** `override.benutzer` ist
`NOT NULL`. Woher kommt der Name?

## Optionen

### Was ein Override mit dem Befund macht

**1. Der Override ändert den Befundstatus.**
Der Mensch sagt „das ist in Ordnung", `verletzt` wird zu `ok`, die Akte ist
freigabereif. Für die Sachbearbeitung die erwartete Bedienung, und die
Oberfläche wird einfach: ein Status je Regel, fertig. Der Preis ist der
Verlust der Beweiskette. Drei Jahre später steht in `pruefung` ein Ergebnis,
das das Regelwerk so nie geliefert hat — und die Frage „welche Regel galt
und was sagte sie" ist nicht mehr beantwortbar.

**2. Der Override ist eine zweite Ebene über dem unveränderten Befund.**
Das Regelwerk sagt weiter `verletzt`. Daneben steht: *Person X hat am
Datum Y mit Begründung Z entschieden, die Akte trotzdem freizugeben.* Die
Freigabe ist damit ein eigener Vorgang mit eigenem Verantwortlichen, nicht
eine umgeschriebene Maschinenaussage. Teurer in der Darstellung — zwei
Ebenen wollen gezeigt werden —, und die Sachbearbeitung sieht einen roten
Befund, der trotzdem nicht blockiert.

**3. Kein Override, nur Korrektur der Eingabe.**
Wer meint, das System irre sich, korrigiert den Wert (etwa eine falsch
gelesene Containernummer) und lässt neu prüfen. Sauber und ohne zweite
Ebene. Deckt aber nur den Lesefehler ab, nicht den Fall „die Regel greift
hier fachlich nicht, und ich verantworte das" — und genau der ist der
Grund, warum die Tabelle existiert.

### Woher der Benutzer kommt

**a. Echte Anmeldung.** Richtig, und eine eigene Stufe: Identitätsanbieter,
Rollen, Sitzungen, und die Frage, wer das im Zielsystem betreibt.

**b. Ein Namensfeld, das die Person ausfüllt.** Ehrlich schwach — jeder kann
jeden Namen eintippen —, aber es erfüllt, was die Tabelle verlangt, und es
ist nicht *falsch*: Es behauptet keine Authentifizierung.

**c. Der n8n-Benutzer.** Es gibt genau einen Owner, und die Oberfläche kennt
ihn nicht. Untauglich.

### Wo die Akte lebt

**A. Weiter zustandslos**, die Oberfläche hält alles im Browser. Ein
Neuladen verliert die Akte, ein Kollege kann sie nicht öffnen.

**B. Die Akte liegt in Postgres** — Sendung, Dokumente, Assertions, Fakten,
Prüfungen —, und die Oberfläche lädt sie über eine Kennung. Die Tabellen
dafür existieren seit Stufe 1 und sind leer.

## Entscheidung

**Option 2, b und B.**

### Der Override überschreibt nichts

Das Regelergebnis bleibt, was das Regelwerk gesagt hat. Der Override ist ein
eigener Satz daneben:

- `src/regelwerk.mjs` bekommt die vorhandenen Overrides als Eingabe und
  liefert zusätzlich `freigabe_nach_override` — die Entscheidung **unter
  Berücksichtigung** menschlicher Verantwortung. `freigabe` selbst ändert
  sich nie.
- Jeder Befund trägt `uebersteuert_von`, `uebersteuert_am`,
  `uebersteuerungsgrund`, wenn einer vorliegt. Sein `status` bleibt
  `verletzt`.
- Die Oberfläche zeigt beides: den Befund in seiner Farbe **und** darunter,
  wer ihn verantwortet hat. Ein übersteuerter Befund verschwindet nicht.
- Ein Override gilt für **eine Regel in einer Akte zu einer Regelversion**.
  Ändert sich der Katalog, ist er verbraucht: Die Person hat eine andere
  Regel verantwortet als die, die jetzt gilt.
- Der Statuscode des Webhooks folgt `freigabe_nach_override`, nicht
  `freigabe`. Das ist keine Ausnahme von der Regel oben, sondern ihre
  Anwendung: Der Rumpf trägt beide Sätze unverändert, der Statuscode sagt
  dem Aufrufer nur, was er tun soll. Ohne Übersteuerung sind beide gleich,
  und 200 heißt weiterhin freigabereif.

Der letzte Punkt ist der wichtigste und der unbequemste. Er bedeutet, dass
eine Katalogänderung alte Freigaben aufhebt — richtig so, denn genau
darüber entscheidet eine Zollprüfung.

### Der Benutzer ist ein Name, keine Identität

Ein Pflichtfeld „Ihr Name" neben der Begründung. Die Oberfläche sagt
ausdrücklich, dass das keine Anmeldung ist, `docs/BETRIEB.md` führt es unter
„was vor einem echten Betrieb fehlt", und die Spalte heißt weiterhin
`benutzer`. Wer das für einen Betrieb hält, hat nicht gelesen.

### Die Akte liegt in Postgres

Der Workflow schreibt künftig nicht nur `pruefung`, sondern auch
`shipment`, `document` und `document_field_assertion` — die Tabellen, die
seit Stufe 1 leer stehen. Damit lässt sich eine Akte über ihre Kennung
öffnen, ihre Befunde mit Fundstelle anzeigen und ein Override daran hängen.

Die **Belege selbst** (die PDFs) kommen dazu: ohne sie keine Fundstelle im
Bild. Sie liegen als `bytea` in `document`, nicht im Dateisystem — ein
Volume mehr wäre ein Zustand mehr, den `docker compose down -v` anders
behandelt als die Datenbank. Für Dutzende Akten am Tag trägt das; für einen
echten Betrieb gehört ein Objektspeicher davor, und das steht in den
offenen Punkten.

## Konsequenzen

**Positiv**

- Die Beweiskette bleibt vollständig. Auf die Frage „welche Regel galt, was
  sagte sie, wer hat sie übersteuert und warum" antwortet eine einzige
  Abfrage — und die Antwort ist nicht rekonstruiert, sondern gespeichert.
- Die Trennung aus ADR-003 hält auch unter menschlichem Eingriff. Das
  Regelwerk bleibt eine reine Funktion; ein Override ist ein Datum, das
  hineingeht, kein Eingriff in die Auswertung.
- `re_extraction_required` bekommt endlich sein Werkzeug: Die Fundstelle
  führt zur Stelle im Beleg, an der nachzulesen ist.
- Die ngrx-Wette aus ADR-006 geht auf: Jetzt gibt es Sammlungen mit
  Verlauf, mehrere Ansichten auf denselben Daten und optimistische Updates.

**Negativ**

- **Zwei Ebenen sind schwerer zu lesen als eine.** Ein roter Befund, der
  nicht blockiert, braucht Erklärung. Wer das Muster nicht kennt, hält es
  für einen Fehler.
- **Das Namensfeld ist eine Schwäche, die wie ein Merkmal aussieht.** Ein
  Override mit erfundenem Namen ist im Audit wertlos, und nichts hindert
  daran. Das ist vertretbar, solange es dabeisteht — und wird sofort
  unvertretbar, wenn jemand das System außerhalb einer Demo betreibt.
- **PDFs in Postgres.** `bytea` ist der bequeme, nicht der richtige Ort.
  Eine Akte mit fünf Scans belegt schnell zweistellige Megabyte, und
  `pg_dump` trägt sie mit.
- **Verbrauchte Overrides bei Katalogänderung** sind fachlich richtig und
  betrieblich unangenehm: Eine Schwellenänderung kann eine Reihe
  freigegebener Akten wieder öffnen. Ohne Benachrichtigung merkt das
  niemand — und die gibt es nicht.
- **Der Workflow schreibt mehr und wird langsamer.** Vier Tabellen statt
  einer, plus die Belege. Der Postgres-Node steht weiter auf
  `continueRegularOutput`: Die Antwort an den Aufrufer ist wichtiger als
  die Ablage — aber jetzt bedeutet ein Schreibfehler, dass die Akte später
  nicht mehr zu öffnen ist.

## Wann wir anders entscheiden würden

- **Mit einer echten Anmeldung.** Dann ist der Benutzer keine Eingabe mehr,
  sondern eine Zusicherung, und das Namensfeld verschwindet. Die Struktur
  des Overrides bliebe unverändert — nur seine Glaubwürdigkeit stiege.
- **Wenn das Zielsystem ein führendes Aktensystem hätte** (ERP, DMS). Dann
  liegt die Akte dort, nicht in unserem Postgres, und diese ADR beschreibt
  eine Zwischenschicht, die es nicht geben sollte.
- **Wenn Overrides massenhaft aufträten.** Muss jemand jede zweite Akte
  übersteuern, ist nicht der Mensch das Problem, sondern die Regel. Dann
  gehört die Häufigkeit je Regel in die Auswertung (`rule_result` kann
  das), und die Antwort ist eine Katalogänderung, keine bessere
  Übersteuerungsmaske.
- **Wenn die Beweiskette anders gesichert wäre**, etwa durch ein
  unveränderliches Ereignisprotokoll. Dann dürfte der Befund ruhig
  überschrieben werden, weil der ursprüngliche Stand woanders steht.
