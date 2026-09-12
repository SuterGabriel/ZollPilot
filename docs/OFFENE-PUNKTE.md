# Offene Punkte

Was ungeklärt oder nicht gebaut ist — inklusive der unbequemen Punkte.
Fachliche Unsicherheiten der Recherche stehen in
[08-known-unknowns.md](08-known-unknowns.md); hier steht, was das Repo
selbst betrifft.

## Die unbequemen zuerst

**Die Extraktion kennt eine Layoutfamilie.** Sie ist gebaut (Stufe 3,
ADR-005): Textlayer oder Tesseract, Klassifikation, Felder, Assertions mit
Fundstelle und Konfidenz, 420 von 420 Feldern auf dem Golden Set. Aber die
Extraktoren suchen Labels und Tabellenköpfe, wie `testdaten/erzeuge-belege.py`
sie rendert. Eine Rechnung eines anderen Ausstellers liefert weniger Felder
— ehrlich als `nicht_pruefbar`, aber oft. Für reale Vielfalt braucht es ein
trainiertes Layoutmodell oder einen Anbieter; die Nahtstelle dafür ist
`lesen.py`, der Vergleichslauf steht in ADR-005.

**Die Messung misst die Pipeline, nicht die Wirklichkeit.** Die PDFs sind aus
dem Golden Set erzeugt. Stempel, Durchschläge, Handschrift, Fax: kein
Testbeleg hat das. Der schlechte Scan ist eine kontrollierte
Verschlechterung, und Tesseract liest ihn richtig — der Konfidenzpfad wird
auf den PDFs nicht ausgelöst, nur in der JSON-Akte (`docs/EXTRAKTION.md`).

**Der Konfidenzpfad deckt nur Prüfziffern und Summen.** TRN-01, TRN-02 und
VAL-01 fragen die Konfidenz. QTY-01 (Mengen), QTY-03 (Gewichte), CLS-01
(HS-Codes) und ORG-02 (Ursprung) sagen bei einem Lesefehler `verletzt`. Ein
schlechter Scan mit einer falsch gelesenen Menge blockiert die Akte
fachlich, statt Nachextraktion zu verlangen. Das ist eine Lücke in ADR-003,
nicht in der Extraktion — und der nächste Regelkatalog-Eintrag.

**Kein Kubernetes.** N1 nennt es. Es gibt Compose mit vier Diensten,
Healthchecks und einen CI-Job, der den Stack baut und hochfährt. Ein Chart
käme in Stufe 4 — und nur, wenn er in der CI tatsächlich ausgerollt wird,
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
- **Konfidenzschwelle je Feldklasse.** Eine Zahl (0,80) für alle Felder ist
  eine Vereinfachung, und Tesseract-Konfidenzen sind nicht kalibriert.
- **Nachextraktion als Prozess.** Der Status existiert, der Weg
  (zweite Engine, Human Review, Rückkehr in die Prüfung) nicht. Das ist der
  Review-Arbeitsplatz aus Stufe 4 (`DECISIONS.md`).
- **Ursprungserklärung als eigener Beleg.** Die Extraktion trennt sie aus der
  Rechnung heraus (`felder/ursprungserklaerung.py`) und leitet Ursprungswert
  und Warenkreis aus den Positionen ab. Ob das auf echten Rechnungen hält,
  entscheidet sich mit einem Korpus.
- **„EU“ als Ursprung.** Die Normalisierung reicht „EU“ als Code durch;
  ORG-02 meldet den Widerspruch zum Positionsursprung. Ob eine Erklärung „of
  EU preferential origin“ je Abkommen gilt, ist eine Regelfrage (docs/01).
- **Akte auf welcher Ebene?** PO, Rechnung, Container oder MRN — offene
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
- **Kein Override-Pfad.** Die Tabelle existiert, der Workflow nicht.
- **Kein Monitoring jenseits des Metrik-Endpunkts.** Prometheus, Grafana,
  Alarme: nicht im Repo (`BETRIEB.md`).
- **Der Bündler ist ein Regex-Parser.** Kennt genau die Import-/Exportformen
  aus `src/`. Ein `export default` bricht ihn sichtbar.
- **`regel-check` erkennt Regex-Literale heuristisch.** Ein Regex direkt nach
  einem Bezeichner würde als Division gelesen. Bisher kein Fall.

## Braucht Zugänge

- **GitHub-Remote.** Das Repo ist lokal; das private Remote legt der Autor
  an (`gh repo create`).
- **Docker in der CI.** Der Job `betrieb` baut das Extraktions-Image und zieht
  das n8n-Image; auf GitHub-Runnern ist Docker vorhanden, die Laufzeit liegt
  bei drei bis fünf Minuten.
- **IDP-Anbieter.** Document AI oder ABBYY brauchen Projekt oder Lizenz. Der
  Vergleichslauf gegen Tesseract auf den synthetischen Belegen (ADR-005)
  wäre der schnellste Weg zu N2 — und die erste echte Zahl hinter der
  Anbieterbewertung in `07-idp-ocr.md`.
