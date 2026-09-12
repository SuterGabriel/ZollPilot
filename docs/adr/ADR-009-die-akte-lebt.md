# ADR-009: Die Akte lebt: Nachforderungen mit Zustand, Fristen als Ereignisse je Akte, Post in beide Richtungen, Identität beim Übersteuern

- **Status:** angenommen
- **Datum:** 2026-09-12
- **Stufe:** 6, die asynchrone Akte

## Kontext

Bis Stufe 5 ist ZollPilot ein synchroner Prüfaufruf: Belege rein, in
derselben Antwort die Entscheidung und die formulierten Nachforderungen.
Danach weiß das System nichts mehr. Wer eine Nachforderung versendet hat,
wann die Antwort kam und ob nach dem Cut-off eskaliert werden muss, steht
nirgends. Beide Ausschreibungen verlangen genau das: „getriggerte
Follow-up-Workflows zum automatischen Versand von Dokumentennachforderungen
und Mahnungen“, und der Zielprozess in `docs/05` beginnt bei der E-Mail.

Vier Kräfte wirken gegeneinander:

- **Regeln sind Daten** (ADR-002) und **n8n entscheidet nicht** (ADR-004).
  Welche Stufe fällig ist, ist eine Entscheidung; sie darf nicht in einem
  Ausdruck im Workflow stehen und nicht in SQL.
- **Es gibt keine verbindliche Branchenfrist** (`docs/05`). Der Entwurf der
  Oberfläche zeigte Uhrzeiten, und der Abgleich hat sie als erfundene
  Tatsachen verworfen. Ein System, das mahnt, braucht trotzdem einen
  Zeitpunkt.
- **Die Beweiskette** (ADR-001, ADR-007). Eine Nachforderung, die
  verschickt wurde, ist ein Vorgang mit Datum und Adressat, den eine
  Zollprüfung nach drei Jahren sehen will. Er darf nicht in der
  n8n-Ausführung liegen, die nach 14 Tagen weg ist.
- **Ohne Identität ist ein Override eine Behauptung.** Das Namensfeld beim
  Übersteuern prüft niemand (`docs/OFFENE-PUNKTE.md`). Sobald das System
  von sich aus Post verschickt, wird das vom Schönheitsfehler zum
  Betriebsrisiko.

## Optionen

**A. Der Prüf-Workflow führt den Zustand mit.** Vor jeder Prüfung liest er
die offenen Fälle, der Code-Node gleicht ab, danach schreibt er. Vorteil:
Ein Eingang schließt seine Nachforderung im selben Lauf, ohne Verzögerung.
Nachteil: Der Hauptpfad bekommt zwei Datenbankzugriffe mehr und wird von
der Tabelle abhängig; ein Datenbankfehler würde dann die Prüfung berühren,
die heute ohne Datenbank antworten kann.

**B. Ein eigener Workflow gleicht ab und versendet.** Zeitgesteuert und
über einen Webhook auslösbar. Er liest die letzte Prüfung je Akte und die
offenen Fälle, ein Code-Node aus `src/` entscheidet, welche Fälle neu
sind, welche erledigt und welche Stufe fällig ist; Postgres- und
Mail-Nodes führen aus. Vorteil: Der Prüfpfad bleibt unberührt, der Zustand
hat genau einen Schreiber, und die Entscheidung ist eine reine Funktion
mit Tests. Nachteil: Eine erledigte Nachforderung schließt erst beim
nächsten Lauf, nicht im Moment des Eingangs.

**C. Fristen als Kalendertage in der Regeldatei.** „Erinnerung nach 24
Stunden, Mahnung nach 72.“ Vorteil: einfach, ohne Stammdaten. Nachteil:
Das widerspricht `docs/05`, wonach Fristen an Cut-offs hängen, die je
Hafen, Carrier und Vertrag anders sind. Eine Mahnung drei Tage nach
Feststellung ist bei einer Sendung mit ETA in sechs Wochen Unsinn.

**D. Fristen als Stammdaten je Akte, Stufen als relative Ereignisse.** Die
Akte nennt ihre Cut-offs (Zoll, Carrier, ETA), die Stufen in
`zustaendigkeiten.yaml` nennen, auf welchen Cut-off sie sich beziehen und
mit welchem Vorlauf. Fehlt der Cut-off in der Akte, ist die Stufe nicht
erreichbar, und das System sagt das, statt ein Datum zu erfinden.
Vorteil: nichts wird geraten, die Zahlen sind Daten. Nachteil: Wer die
Cut-offs nicht pflegt, bekommt nur die erste Erinnerung.

**E. Mail: ein Fake-SMTP oder ein Postfach mit beiden Richtungen.** Mailpit
fängt Mails ab und zeigt sie, kann aber nicht als Postfach dienen. GreenMail
bietet SMTP und IMAP und eine Abfrageschnittstelle, sodass derselbe Dienst
den Versand aufnimmt und den Eingang liefert. Vorteil von GreenMail: der
Rückweg lässt sich im selben Rauchtest beweisen. Nachteil: ein Java-Dienst
mehr im Stack.

**F. Identität: Anmeldung in der Oberfläche oder am Proxy.** Ein Login in
Angular mit Token ist die Lösung, die ein Produkt hätte. Basic Auth in
nginx, der den Benutzernamen als Header an n8n weiterreicht, ist die
Lösung, die in einer Stunde steht und im Audit denselben Wert hat: Der
Name im Override ist dann von nginx geprüft, nicht getippt.

## Entscheidung

B, D, E mit GreenMail, F mit nginx. Erkennbar im Repo an:

- `zustaendigkeiten.yaml`: jede Stufe trägt `bezug` (welcher Cut-off) und
  `vorlauf_stunden`; die Zahlen sind als Praxisannahme markiert.
- Die Akte trägt `fristen` als Stammdaten: `customs_cutoff`,
  `carrier_cutoff`, `eta`, alle optional.
- `src/nachforderung/abgleich.mjs` (offen, neu, erledigt) und
  `src/nachforderung/stufe.mjs` (welche Stufe ist fällig): reine
  Funktionen, der Zeitpunkt kommt als Parameter, keine Uhr im Code.
- Tabelle `request_case` mit Stufe, Versanddatum, Schließdatum und dem
  Text, der tatsächlich versandt wurde.
- `workflows/zollpilot-nachforderung.json`: Zeitplan und Webhook, liest,
  entscheidet im gebündelten Code-Node, schreibt, versendet.
- `greenmail` in `compose.yml`, SMTP für den Versand, IMAP für den Eingang.
- `deploy/nginx/`: Basic Auth mit Passwortdatei, Benutzername als Header
  `X-Benutzer`. Der Code-Node ersetzt damit den getippten Namen jeder
  Übersteuerung und vermerkt am Befund `uebersteuert_identitaet: proxy`;
  ohne Header bleibt der Name eine Angabe und heißt so (`angegeben`). Ein
  Aufrufer direkt am Webhook wird nicht abgewiesen, aber sein Override
  trägt sichtbar keine geprüfte Identität.

## Konsequenzen

Positiv:

- Eine Nachforderung ist ein Vorgang mit Beginn, Stufe, Versand und Ende,
  in einer Tabelle, die eine Zollprüfung lesen kann.
- Keine erfundene Frist. Was die Akte nicht weiß, mahnt das System nicht.
- Der Prüfpfad bleibt, was er war; die Wiedervorlage und der Fehlerzweig
  gelten unverändert.
- Der Rückweg, eine Antwort mit Anhang, die die Akte erneut prüft, läuft
  über denselben Eingang wie jede Einreichung.

Negativ:

- **Verzögerung.** Ein Eingang schließt seine Nachforderung erst beim
  nächsten Lauf des Nachforderungs-Workflows. Für die Demo löst der
  Rauchtest ihn über den Webhook aus; im Betrieb ist der Zeitplan die
  Wahrheit.
- **Zwei Bündel.** Der Bündler erzeugt jetzt zwei Code-Nodes aus `src/`.
  Der Check in Hook und CI prüft beide; wer einen vergisst, sieht es dort.
- **Basic Auth ist kein Benutzerverzeichnis.** Rollen, Passwortwechsel,
  Abmeldung: nichts davon. Beim Kunden tritt OIDC an die Stelle; die
  Nahtstelle ist der eine Header.
- **GreenMail ist ein Testpostfach.** Es bewahrt nichts über einen
  Neustart hinaus. Der Beweis gilt dem Weg, nicht dem Postfach.
- **Stammdatenpflege.** Drei Datumsfelder mehr je Akte. Wer sie nicht
  füllt, bekommt eine Erinnerung und sonst nichts, und das steht dann so
  im Ergebnis.

## Wann wir anders entscheiden würden

- Verlangt der Auftraggeber, dass ein Eingang seine Nachforderung im selben
  Augenblick schließt, kommt der Abgleich in den Prüf-Workflow (Option A).
  Der Preis ist die Abhängigkeit des Prüfpfads von der Tabelle.
- Nennt ein Vertrag feste Fristen in Tagen, wird `bezug` je Stufe auf ein
  festes Datum umgestellt, und Option C ist dann kein Widerspruch mehr,
  sondern Vertragsinhalt.
- Sobald ein echtes Postfach angebunden ist, verschwindet GreenMail; der
  IMAP-Trigger und der SMTP-Node bleiben, nur die Zugangsdaten wechseln.
- Sobald es mehr als eine Rolle gibt, die übersteuern darf, reicht der
  Header nicht mehr; dann OIDC am Proxy und die Rolle im Token.
