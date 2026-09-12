# Die Oberfläche

Stufe 4: ein Bildschirm, auf dem eine Sachbearbeitung Belege einreicht und
die Entscheidung liest. Angular 22 mit ngrx, ausgeliefert von nginx, das
`/webhook/` an n8n weiterreicht (ADR-006). Dieses Dokument sagt, was sie
tut, wie sie geprüft wird, und was sie nicht kann.

**Die Gestalt folgt dem Entwurf** in [entwurf/](entwurf/): zwei Spalten
(Struktur 1a), Ergebnisblöcke nach Handlungsnähe, Gestaltungstoken aus dem
Mockup. Was davon übernommen wurde und was nicht gebaut werden konnte, steht
in [entwurf/03-abgleich.md](entwurf/03-abgleich.md).

## Der Ablauf

```
Stammdaten eintragen            akte_id, Stichtag, Sachverhalt, Incoterm, Route,
                                Warennummern — vorbelegt mit der Testakte
PDFs ablegen oder auswählen     was kein PDF ist, wird abgelehnt und genannt
"Akte einreichen"
   │  POST /webhook/belege (multipart) an nginx
   │  nginx → n8n → Extraktion (Python) → Node "Akte prüfen" → Postgres
   ▼
Ergebnis                        Entscheidung · erkannte Belege · Hinweise der
                                Extraktion · Nachweispflichten · Regeln ·
                                Nachforderungen mit Adressat und Anschreiben
```

Der Einstieg ist `http://localhost:8088`, sobald `docker compose up -d
--build --wait` durch ist.

## Die Grenze, und wie sie gehalten wird

**Die Oberfläche entscheidet nichts.** Sie kennt keinen Schwellenwert, keine
Regel, keinen Katalog. Was sie zeigt, steht so im Ergebnis: `freigabe`,
je Befund `begruendung`, `konsequenz`, `rechtsgrundlage`,
`rechtsquelle_status` und `regelversion`, je Nachforderung Adressat, Feld,
Widerspruch, akzeptierte Nachweise und Folge.

Das ist keine Absichtserklärung: `scripts/beleg-check.sh` prüft, dass unter
`oberflaeche/src/` weder `rules.yaml` noch `low_confidence_below` vorkommt.
Die einzige Bedingung im Browser ist, ob das Formular abgeschickt werden
darf — Pflichtfeldlogik, keine Fachregel.

## Zustand

| Wo | Was | Warum dort |
|---|---|---|
| ngrx Store | Belege (nur Angaben), Stand, Ergebnis, Zeitpunkt, Entwertung, Fehler | Sammlung mit Hinzufügen und Entfernen, ein asynchroner Vorgang mit drei Ausgängen |
| Reactive Form | die Stammdaten | Ein Formular ist schon eine Zustandsverwaltung; zwei übereinander bringen nur Abgleich |
| `BelegSpeicher` | die `File`-Objekte | `File` ist nicht serialisierbar und gehört nicht in den Store |
| Signals | reine Sichtsachen | Kein Fachzustand |

Die Stände sind eine Zustandsmaschine: `bereit` → `laeuft` → `fertig` oder
`fehler`. Ein neuer Beleg **entwertet** ein altes Ergebnis, statt es zu
löschen: Es bleibt im Zustand, wird aber nicht mehr angezeigt, und die
Oberfläche sagt, dass es eine frühere Entscheidung gab und wann. Wer nur
`null` setzt, nimmt dem Menschen diese Information.

Der Zeitpunkt kommt **mit der Aktion** herein, nicht aus `new Date()` im
Reducer — sonst wäre er nicht ohne Vorkehrung prüfbar.

`app.config.ts` schaltet `strictStateSerializability` und die drei anderen
Laufzeitprüfungen von ngrx ein. Legt jemand ein `File` in den Store, bricht
es sofort — statt dass die Regel im Kommentar verblasst.

## Die 422-Falle

Der Prüf-Workflow antwortet **200 bei `freigabereif` und 422 bei allem
anderen**, in beiden Fällen mit dem vollständigen Ergebnis
(Node-Konventionen im Skill `n8n-code-nodes`). Für den Angular-HttpClient
ist 422 ein Fehler. `akte.dienst.ts` trennt das: 422 mit verwertbarem Körper
ist das Ergebnis, alles andere bleibt ein Fehler. Wer das verwechselt,
verliert genau die Befunde, um die es geht — geprüft in
`akte.dienst.spec.ts`, in beide Richtungen.

## Barrierefreiheit — geprüft, nicht behauptet

`docs/ARBEITSWEISE.md`, Stufe 2, macht axe zur Merge-Bedingung. Eingelöst:

| Zusage | Prüfung | Stand |
|---|---|---|
| Kontrast der Gestaltungstoken | `scripts/kontrast-check.mjs` rechnet jede `@kontrast`-Anweisung in `styles.css` nach WCAG 2.1 nach | 13 Farbpaare, alle halten. Die Werte stammen aus dem Mockup und wurden unabhängig nachgerechnet — alle vierzehn stimmten |
| Keine axe-Verstöße | `oberflaeche/e2e/` über leeres Formular, Formular mit Belegen, Ergebnis freigabereif, Ergebnis blockiert, entwertetes Ergebnis, Fehlerfall | 6 Durchläufe, 0 Verstöße |
| Vier Unterscheidungen vor der Farbe | Wort, Markenform (Scheibe, Raute, offener Ring, Quadrat), Balkenstärke (4 px, 4 px gestrichelt, 6 px), dann Farbe | im Zustandsband |
| Tastaturbedienung | Sprungmarke als erster Halt, Belege ohne Zeigegerät wählen und entfernen | im selben Lauf |
| Fokusverwaltung | nach dem Absenden auf die Überschrift des Ergebnisses | im selben Lauf |
| Beschriftungen | ein Test geht alle Eingaben durch und verlangt `label[for]` | `einreichung.spec.ts` |

Farbe trägt nie allein: Jede Entscheidung steht auch als Text da, und der
farbige Balken hat eine zweite, nicht farbige Spur.

Ein Thema, hell. Kein dunkles Gegenstück — das wären doppelt so viele
Farbpaare, und eine Zusage, die niemand prüft, ist schlechter als keine.

## Laufen lassen

```bash
cd oberflaeche && npm ci
npm start                 # Entwicklung auf 4200; /webhook/ ist dabei nicht erreichbar
npm test                  # 54 Tests: Zustand, Dienst, Komponenten
npm run e2e:install       # einmalig: Chromium für Playwright
npm run e2e               # 12 Tests, davon 6 axe-Durchläufe
npm run build
node ../scripts/kontrast-check.mjs
```

Im Stack (mit Webhook):

```bash
docker compose up -d --build --wait
bash scripts/rauchtest.sh     # Runde 3 schickt eine Akte durch den Proxy
```

## Was sie nicht kann

- **Sie führt keine Akte, sondern einen Vorgang.** Nach dem Absenden steht
  das Ergebnis; ein zweiter Beleg zur selben Sendung beginnt einen neuen
  Vorgang. Es gibt keine Aktenidentität über die Zeit — das ist offene
  Frage 2 in `PROJECT.md`, umgangen und nicht gelöst.
- **Kein Übersteuern, kein Korrigieren.** Man sieht einen Befund, aber man
  kann ihn nicht mit Name und Begründung übersteuern und keinen falsch
  gelesenen Wert richtigstellen. Die Tabelle `override` existiert, der Weg
  dorthin nicht. Das ist der Review-Arbeitsplatz, Stufe 5.
- **Keine Fundstelle am Beleg.** Jede Assertion trägt Seite und Bounding
  Box, aber die Oberfläche zeigt das PDF nicht an und markiert nichts
  darin. Ohne das bleibt "nachlesen" eine Aufforderung ohne Werkzeug.
- **Keine Anmeldung.** Wer den Port erreicht, kann einreichen. Vor jedem
  Betrieb außerhalb der eigenen Maschine ein Blocker, kein
  Schönheitsfehler.
- **Keine Übersicht.** Es gibt keine Liste früherer Prüfungen; die liegen in
  Postgres (`pruefung`, Sicht `rule_result`) und werden dort abgefragt.
- **Ein Sachverhalt.** Richtung und Verkehrsträger lassen sich umstellen,
  aber der Katalog deckt nur Ausfuhr/Seefracht. Wer etwas anderes wählt,
  bekommt die ehrliche Antwort des Regelwerks: Die Pflichtmatrix deckt
  diesen Sachverhalt nicht — geprüft werden dann nur die Regeln.
- **Nur Deutsch.** Keine Übersetzung, kein `i18n`.
- **Keine eigenen Schriften.** Der Entwurf wählt Atkinson Hyperlegible und
  Source Code Pro mit guter Begründung (1/l/I und 0/O bei 12 px, geschlitzte
  Null, gleiche Laufweite für Containernummern). Sie stehen in der
  Schriftkette an erster Stelle, sind aber **nicht mitgeliefert** — offene
  Frage 6 in `entwurf/03-abgleich.md`. Ohne sie greift die Systemschrift.
- **Kein Fortschritt und kein Abbrechen** während der Prüfung. Der Webhook
  ist synchron; mehr braucht eine eigene Entscheidung.
- **Drei Kopien jeder Datei** auf dem Weg: Browser, nginx, n8n als Base64.
  Für Dutzende Akten am Tag trägt das, für Stapel mit hundert Seiten nicht.
