# Abgleich: Entwurf gegen System

Der Entwurf liegt vor — [Wireframe](wireframe-drei-strukturen.pdf) mit drei
Strukturen und Zustandsreihe, [Mockup](mockup-mit-zustandsblatt.pdf) mit
Zustandsblatt, Fokusblatt und Gestaltungstoken. Die Oberfläche soll danach
ausgerichtet werden.

Dieses Dokument hält fest, **was dabei zu klären ist**, bevor gebaut wird:
Der Entwurf zeigt an mehreren Stellen Dinge, die das System heute nicht
liefert. Das ist kein Vorwurf — ein Entwurf darf weiter denken. Aber
„danach ausrichten" hieße sonst, Tatsachen zu erfinden, und genau das
verbietet dieses Repo an anderer Stelle (CLAUDE.md, harte Grenzen).

Gewählte Struktur: **1a** — Akte links schmal und eingeklappt, Ergebnis
rechts, Ergebnisblöcke nach Handlungsnähe.

## Was sofort übernommen werden kann

Reine Darstellung, keine Änderung an `src/`, keine neue Entscheidung.

| Aus dem Entwurf | Heute |
|---|---|
| Ergebnisblöcke nach Handlungsnähe: Nachforderungen, Regeln, Nachweispflichten, Belege | genau umgekehrt |
| Leere Blöcke als **eine Zeile mit Zähler** („12 ohne Befund", „5 erfüllt") | Absatz „Keine Regel ist verletzt"; die Zahl der geprüften Regeln wird verworfen, obwohl sie vorliegt |
| Stammdaten eingeklappt, Akte als Kontextspalte | elf Felder beherrschen den Bildschirm |
| Vier Unterscheidungen je Entscheidung: Wort, Markenform, Stufenangabe, Balkenstärke — Farbe als fünfte | Wort und Farbe |
| Transportfehler ohne jeden Ergebnisblock, „Dies ist kein Prüfergebnis" | getrennt, aber ohne diese Schärfe |
| Platzhalter an den Stellen der späteren Blöcke, damit nichts springt | kein Ladezustand |
| Veraltetes Ergebnis wird **entwertet** mit Zeitstempel, nicht stillschweigend gelöscht | wird auf `null` gesetzt |
| Sprungmarken im Entscheidungsband | keine |
| `Kopieren` und `Als E-Mail öffnen` am Anschreiben | nur aufklappbar |
| Erfüllte Pflicht nennt den Beleg, der sie erfüllt | liegt als `quelle` im Ergebnis, wird nicht gezeigt |
| Nachforderungen nach Adressat gruppiert (ab zwei Adressaten) | flache Liste |

Der stärkste Gedanke des Entwurfs steht beim Transportfehler: *„Kein
Ergebnisblock wird angezeigt — auch keine leeren. Ein leerer Block hieße
‚nichts offen', und das ist hier nicht bekannt."* Das ist dieselbe
Unterscheidung, die das Regelwerk zwischen `nicht_pruefbar` und `ok` trifft,
angewandt auf die Darstellung.

## Zahlen, die nicht stimmen

Das Mockup markiert sie selbst als ungesichert und bittet um die echten
Werte. Hier sind sie:

| Im Entwurf | Tatsächlich |
|---|---|
| „14 geprüft", „17 geprüft", „12 geprüft" | **13 Regeln** im Katalog |
| „3 erfüllt", „4 erfüllt" | **6 Pflichteinträge** in `pflichtmatrix.yaml` |
| `praeferenznachweis-fehlt`: 2 Regelbefunde offen | **1** (ORG-02), 12 ohne Befund; 1 Pflicht offen, 5 erfüllt |
| `container-abweichung`: | 1 Regelbefund offen (TRN-01), 12 ohne Befund; **0 Pflichten offen**, 6 erfüllt |

**Der Blockiert-Bildschirm ist eine Mischung.** TRN-01 und ORG-02 stehen dort
nebeneinander, aber keine Testakte erzeugt beide gleichzeitig: TRN-01 kommt
aus `container-abweichung`, ORG-02 aus `praeferenznachweis-fehlt`. Für ein
Mockup ist das legitim — es zeigt das Layout mit zwei Befunden. Für die
Umsetzung heißt es: Es gibt keinen Testfall, der diesen Bildschirm erzeugt.
Entweder eine achte Testakte anlegen oder den Bildschirm mit einem der
beiden echten Fälle prüfen.

## Was der Entwurf zeigt, das es nicht gibt

Jede Zeile ist eine Entscheidung, keine Nacharbeit.

### Erfunden — darf so nicht gebaut werden

- **Regel `DOC-03 Transportdokument final`** (nur im Wireframe). Diese
  Kennung existiert nicht. Die Regel für finale Dokumente heißt **`REF-03`**.
  `scripts/regel-check.mjs` würde eine Kennung ablehnen, die nicht im
  Katalog steht — Regel 3 aus CLAUDE.md.
- **Fristen als Datum und Uhrzeit** („bis 11.09.2026, 16:00 Uhr",
  „Cut-off 15.09.2026, 16:00"). `zustaendigkeiten.yaml` modelliert Eskalation
  **bewusst als relative Ereignisse** — „vor internem Customs Cut-off" —,
  weil `docs/05-prozess-nachforderung.md` festhält, dass es keine allgemein
  verbindliche Branchenfrist gibt. Eine Uhrzeit im Bildschirm wäre eine
  erfundene Tatsache. Entweder eine Frist je Akte modellieren (echtes
  Merkmal, eigene Entscheidung) oder die relative Formulierung zeigen.
- **`Vorgang req_8f21c`** — gibt es nicht. **Aber die Idee ist gut:** n8n hat
  eine Ausführungs-ID, und der Fehler-Workflow schreibt sie bereits nach
  `workflow_fehler`. Sie in die Antwort zu legen und anzuzeigen ist billig
  und macht Support-Fälle nachvollziehbar.
- **`Prüfer M. Reinhardt`** in der Kopfzeile — es gibt keine Anmeldung und
  keinen Benutzer. Das Mockup weist es selbst als gesetzt aus.

### Braucht eine Architekturentscheidung

- **Fortschritt („Schritt 2 von 3: Extraktion") und `Abbrechen`.** Der
  Webhook ist synchron (`responseMode: responseNode`): eine Anfrage, eine
  Antwort. Fortschritt bräuchte einen Auftragsspeicher und einen zweiten
  Endpunkt zum Abfragen — eigene ADR.
- **`Vorschau der Extraktion` vor dem Einreichen** (nur im ersten Durchgang
  des Mockups, 1b). Nicht möglich: Die Extraktion läuft serverseitig beim
  Einreichen. Der zweite Durchgang ersetzt das korrekt durch Platzhalter.

### Neue Fachfunktionen, nicht Darstellung

- **`Akte freigeben`.** Das System sagt, **ob** eine Akte freigabereif ist;
  es hält keine Freigabe fest. Eine Schaltfläche dafür wäre ein neues
  Merkmal mit Benutzer, Zeitpunkt und Ablage — nah am Override-Pfad aus
  Stufe 5.
- **`Nachforderung senden`.** Der E-Mail-Node ist bewusst deaktiviert, es
  gibt kein SMTP und die Adressaten sind Rollen, keine Postfächer
  (`docs/BETRIEB.md`). `Als E-Mail öffnen` über `mailto:` geht sofort,
  Senden nicht.
- **`Text bearbeiten`** am Anschreiben. Machbar und unkritisch — ein
  Anschreiben ist Ausgang, kein Fakt. Braucht aber einen Ort, an dem die
  Änderung bleibt.
- **`Prüfbericht als PDF`.** Nicht gebaut.
- **`Erneut prüfen`.** Machbar, aber die Dateien werden heute beim
  Zurücksetzen aus dem `BelegSpeicher` gelöscht.
- **Hinweis je Beleg wie „Gewichte unscharf gelesen".** Wir haben Konfidenz
  je Assertion, rollen sie aber nicht je Dokument zusammen. Ableitbar.

### Ein Fund am falschen Ort

Das Anschreiben im **Wireframe** ist umgeschrieben: Fließtext statt unseres
Formulars („Benötigt: - Dokument/Feld: …"). Es liest sich besser. Aber der
Text entsteht in `src/nachforderung.mjs`, also in der Entscheidungsschicht —
das ist eine `src/`-Änderung mit Tests, keine Aufgabe der Oberfläche. Das
Mockup übernimmt richtigerweise wieder den echten Text.

## Gestaltungstoken

Das Mockup liefert sie vollständig mit gerechnetem Kontrast je Paar und
begründet, warum Haarlinien unter 3:1 bleiben dürfen (daneben steht immer
ein Träger, der die Grenze führt; WCAG 1.4.11 nimmt gesperrte
Bedienelemente aus). Das ist prüfbar — `scripts/kontrast-check.mjs` rechnet
jede `@kontrast`-Anweisung nach, sobald die Token in `styles.css` stehen.

Zwei Punkte mit Preis:

- **Atkinson Hyperlegible und Source Code Pro** sind beide frei lizenziert
  (SIL OFL). Sie müssten mitgeliefert werden — heute nutzt die Oberfläche
  Systemschriften und lädt null Byte. Zwei Familien in je zwei Schnitten
  liegen bei etwa 150 bis 250 kB. Die Begründung im Mockup ist stark
  (1/l/I und 0/O bei 12 px, geschlitzte Null, gleiche Laufweite für
  Containernummern), der Preis ist es auch.
- **Radius 0 px überall** und Schriftgröße 12,5 px für den Rechtsverweis —
  beides bewusst gesetzt, beides eine Abkehr vom heutigen Stand.

## Was als Nächstes zu entscheiden ist

1. Übernehmen wir die Struktur 1a mit den elf sofort möglichen Punkten? *(Empfehlung: ja)*
2. Wird die Ausführungs-ID in die Antwort gelegt? *(Empfehlung: ja, billig)*
3. Wird eine Frist je Akte modelliert — oder zeigt die Oberfläche die relative Formulierung? *(Empfehlung: relativ, bis der Auftraggeber eine Frist nennt)*
4. Kommen Fortschritt und Abbrechen? *(Empfehlung: nein, eigene ADR, nicht jetzt)*
5. Kommt `Akte freigeben` — und damit der Einstieg in Stufe 5?
6. Werden die Schriften mitgeliefert?
