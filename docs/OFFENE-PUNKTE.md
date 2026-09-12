# Offene Punkte

Was ungeklärt oder nicht gebaut ist, inklusive der unbequemen Punkte.
Fachliche Unsicherheiten der Recherche stehen in
[08-known-unknowns.md](08-known-unknowns.md); hier steht, was das Repo
selbst betrifft.

## Die unbequemen zuerst

**Die Extraktion kennt eine Layoutfamilie.** Sie ist gebaut (Stufe 3,
ADR-005): Textlayer oder Tesseract, Klassifikation, Felder, Assertions mit
Fundstelle und Konfidenz, 420 von 420 Feldern auf dem Golden Set. Aber die
Extraktoren suchen Labels und Tabellenköpfe, wie `testdaten/erzeuge-belege.py`
sie rendert. Eine Rechnung eines anderen Ausstellers liefert weniger Felder
Ehrlich als `nicht_pruefbar`, aber oft. Für reale Vielfalt braucht es ein
trainiertes Layoutmodell oder einen Anbieter; die Nahtstelle dafür ist
`lesen.py`, der Vergleichslauf steht in ADR-005.

**Die Messung misst die Pipeline, nicht die Wirklichkeit.** Die PDFs sind aus
dem Golden Set erzeugt. Stempel, Durchschläge, Handschrift, Fax: kein
Testbeleg hat das. Der schlechte Scan ist eine kontrollierte
Verschlechterung, und Tesseract liest ihn richtig; der Konfidenzpfad wird
auf den PDFs nicht ausgelöst, nur in der JSON-Akte (`docs/EXTRAKTION.md`).

**Die Konfidenzschwelle ist eine einzige Zahl.** Der Pfad selbst trägt
inzwischen zehn von dreizehn Regeln (`tests/regeln/konfidenzpfad.test.mjs`);
die drei anderen lesen keine extrahierten Werte. Offen bleibt die
Kalibrierung: 0,80 für eine Containernummer und für einen Betrag ist eine
Vereinfachung, und Tesseract-Konfidenzen sind nicht kalibriert. Je
Feldklasse gegen einen echten Korpus zu bestimmen wäre richtig.

**Kein Kubernetes.** N1 nennt es. Es gibt Compose mit fünf Diensten,
Healthchecks und einen CI-Job, der den Stack baut und hochfährt. Ein Chart
käme in einer eigenen Stufe, und nur, wenn er in der CI tatsächlich ausgerollt wird,
nicht als Beispiel.

**Keine Regel trägt `legal_source: verified`.** Alle Rechtsverweise sind
Sekundärrecherche. Vor produktivem Einsatz gegen EUR-Lex und zoll.de prüfen;
bis dahin ist der Katalog ehrlich markiert.

## Fachlich offen

- **Konflikte zwischen finalen Dokumenten.** Zwei finale B/L mit verschiedenen
  Werten: Heute gewinnt die spätere Assertion stillschweigend. Das
  widerspricht dem Geist von ADR-001 und braucht eine Auflösungsregel
  (Konfliktfakt, Review).
- **Währungsumrechnung.** ORG-06 ist bei Rechnungen in Fremdwährung nicht
  prüfbar. Kurs und Kursdatum nach Art. 53 UZK (`TODO-verify`) sind nicht
  modelliert.
- **MRN-Prüfziffer.** Nur Strukturprüfung. Algorithmus gegen echte MRN testen,
  sonst bleibt es dabei (`08-known-unknowns.md`).
- **UN/LOCODE, EORI, REX, VIES.** Nur Formatprüfung. Die Online-Lookups
  (Stufe 2) sind nicht gebaut; sie dürfen nie blockieren.
- **Wortlaut der Ursprungserklärung (ORG-07)** je Abkommen. Die Extraktion
  erkennt das gemeinsame Gerüst („exporter of the products covered by this
  document“, „preferential origin“), nicht den abkommensgenauen Wortlaut.
- **Der Konfidenzpfad schützt nicht vor einer plausiblen Fehllesung.** Wird
  eine Menge mit hoher Konfidenz falsch gelesen, bleibt der Befund
  `verletzt`, zu Recht, denn das System kann es nicht besser wissen. Der
  Pfad fängt unsichere Lesungen, nicht sichere Irrtümer.
- **Nachextraktion als Prozess.** Der Status existiert, der Weg (zweite
  Engine, Human Review, Rückkehr in die Prüfung) nicht. Stufe 5 hat davon
  nur die eine Hälfte gebaut: Ein Lesefehler lässt sich verantworten, nicht
  beheben. Korrigieren bleibt offen.
- **Ursprungserklärung als eigener Beleg.** Die Extraktion trennt sie aus der
  Rechnung heraus (`felder/ursprungserklaerung.py`) und leitet Ursprungswert
  und Warenkreis aus den Positionen ab. Ob das auf echten Rechnungen hält,
  entscheidet sich mit einem Korpus.
- **„EU“ als Ursprung.** Die Normalisierung reicht „EU“ als Code durch;
  ORG-02 meldet den Widerspruch zum Positionsursprung. Ob eine Erklärung „of
  EU preferential origin“ je Abkommen gilt, ist eine Regelfrage (docs/01).
- **Akte auf welcher Ebene?** PO, Rechnung, Container oder MRN? Offene
  Frage 2 in `PROJECT.md`. Der Prototyp nimmt eine Rechnung mit einem
  Container an.

## Technisch offen

- **Katalog im Code-Node eingebettet** (ADR-004). Eine Schwellenänderung
  braucht Bundle und Import. Laden aus Postgres zur Laufzeit wäre der nächste
  Schritt.
- **Assertions werden nicht abgelegt.** `document_field_assertion` und
  `canonical_fact` existieren als Tabellen; der Workflow schreibt nur
  `pruefung`. Die Fundstellen liegen in der Ausführung, die nach 14 Tagen
  gelöscht wird. Für den Review-Arbeitsplatz muss das anders sein.
- **Zusammengesetzte PDFs.** Ein PDF ist ein Beleg. Rechnung und Packliste in
  einer Datei werden nicht aufgetrennt (PROJECT.md verlangt es).
- **Base64 durch n8n.** Die PDFs gehen als Base64 im JSON vom Code-Node zum
  Dienst. Bei vielen großen Scans ist das Arbeitsspeicher; ein Multipart-Weg
  oder Objektspeicher wäre der nächste Schritt.
- **Extraktionsdienst ohne Auth und Limits.** Antwortet jedem im
  Compose-Netz, bis 50 Dateien je Anfrage, kein Größenlimit.
- **E-Mail-Node deaktiviert.** Kein SMTP im Demo-Betrieb; die Adressaten
  sind Rollen. Rolle zu Verteiler ist Stammdatenpflege, die es nicht gibt.
- **Kein Mail-Intake.** Der Zielprozess beginnt mit E-Mail und Anhängen
  (`05-prozess-nachforderung.md`). Der Prototyp beginnt am Webhook.
- **Eskalation ist Daten, nicht Prozess.** `zustaendigkeiten.yaml` kennt die
  Stufen; niemand löst sie zeitgesteuert aus.
- **Der Override kennt keinen Menschen, nur ein Namensfeld.** Der Pfad ist
  gebaut (Stufe 5, ADR-007): übersteuern, erneut prüfen, beides ablegen. Wer
  aber den Namen tippt, prüft niemand. Ohne Anmeldung ist jeder Override im
  Audit eine Behauptung, und das ist der Blocker vor jedem Betrieb, nicht
  ein Schönheitsfehler.
- **Verbrauchte Overrides benachrichtigen niemanden.** Eine Katalogänderung
  entwertet sie richtigerweise. Wer davon erfährt, ist nicht gebaut: Die
  Akte müsste erneut geprüft werden, damit es überhaupt auffällt.
- **Die Oberfläche zeigt keine Fundstelle.** Jede Assertion trägt Seite und
  Bounding Box; das PDF wird nicht angezeigt und nichts darin markiert. Ohne
  das bleibt `re_extraction_required` eine Aufforderung ohne Werkzeug.
- **Die Oberfläche ohne Anmeldung.** Wer Port 8088 erreicht, kann Akten
  einreichen. Für den Webhook galt das schon; eine Oberfläche macht es
  einladend.
- **Kein Bildschirmleser-Test.** axe läuft über jede Ansicht und findet
  keinen Verstoß, aber automatische Prüfung deckt nur einen Teil der
  WCAG-Kriterien ab. Ob die Reihenfolge Sinn ergibt, sagt nur ein Mensch mit
  einem Bildschirmleser.
- **Ein Browser in den Ende-zu-Ende-Läufen.** Chromium. Firefox und WebKit
  laufen nicht mit.
- **Kein Monitoring jenseits des Metrik-Endpunkts.** Prometheus, Grafana,
  Alarme: nicht im Repo (`BETRIEB.md`).
- **Der Bündler ist ein Regex-Parser.** Kennt genau die Import-/Exportformen
  aus `src/`. Ein `export default` bricht ihn sichtbar.
- **`regel-check` erkennt Regex-Literale heuristisch.** Ein Regex direkt nach
  einem Bezeichner würde als Division gelesen. Bisher kein Fall.

## Braucht Zugänge

- **Das Ergebnis der CI ist noch nicht gesehen.** Stufe 3 und 4 wurden am
  12.09.2026 gepusht (`1938b3b..bc9639f`, neun Commits); davor war die CI
  für sie nie gelaufen. Ob die Jobs `extraktion`, `oberflaeche` und der
  erweiterte `betrieb` auf einem Runner grün sind, steht unter *Actions* im
  Repo; lokal sind sie nachgestellt, und das ist nicht dasselbe. Kein Gate kann
  das prüfen: Der Beleg-Check liest das Dateisystem, nicht den Zustand der
  CI.
- **Docker in der CI.** Der Job `betrieb` baut Extraktion und Oberfläche und
  zieht das n8n-Image; auf GitHub-Runnern ist Docker vorhanden, die Laufzeit
  liegt bei fünf bis acht Minuten.
- **IDP-Anbieter.** Document AI oder ABBYY brauchen Projekt oder Lizenz. Der
  Vergleichslauf gegen Tesseract auf den synthetischen Belegen (ADR-005)
  wäre der schnellste Weg zu N2, und die erste echte Zahl hinter der
  Anbieterbewertung in `07-idp-ocr.md`.
