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

**Kein Kubernetes.** N1 nennt es. Es gibt Compose mit zehn Diensten,
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

- **Der Klassifikationsfallback hilft nur beim Schweigen, nicht beim Irrtum.**
  Ein Modell schlägt einen Belegtyp vor, wenn die Regeln keinen finden
  (ADR-011). Klassifizieren die Regeln falsch, greift er nicht: Ein
  CMR-Frachtbrief, der das Wort Handelsrechnung enthält, wird zur
  Handelsrechnung und kommt nie beim Modell an. Ein zweiter Pfad über niedrige
  Konfidenz statt nur über `unclassified` wäre die Antwort und ist nicht
  gebaut.
- **Die Pseudonymisierung ist musterbasiert.** Sie fängt Firmen mit
  Rechtsform, Anschriften, Kennnummern und beschriftete Parteifelder. Ein
  ungewöhnlicher Name ohne Rechtsform und ohne Anschrift kann durchrutschen.
  Vor echten Belegen gehört sie gegen einen echten Belegmix gemessen
  (`docs/DATENSCHUTZ.md`).
- **Katalog im Code-Node eingebettet** (ADR-004). Eine Schwellenänderung
  braucht Bundle und Import. Laden aus Postgres zur Laufzeit wäre der nächste
  Schritt.
- **Assertions werden abgelegt, Originale nicht.** Seit ADR-010 schreibt
  jede Prüfung Stammdaten, Belege und Assertions nach Postgres, nur
  anhängend. Die PDFs selbst bleiben draußen: Kein Review-Arbeitsplatz
  kann die Fundstelle im Bild zeigen, keine erneute Extraktion mit einem
  anderen Leser ist auf abgelegte Akten möglich. Und wie lange die
  Aktendaten bleiben, ist eine Betriebsfrage (`DATENSCHUTZ.md`).
- **Zwei finale Belege desselben Typs** entstehen jetzt öfter: Ein
  Eingang mit einer neuen Fassung der Rechnung steht neben der alten. Die
  spätere Assertion gewinnt stillschweigend; die Konfliktregel aus dem
  Abschnitt oben wird damit dringender.
- **Zusammengesetzte PDFs.** Ein PDF ist ein Beleg. Rechnung und Packliste in
  einer Datei werden nicht aufgetrennt (PROJECT.md verlangt es).
- **Base64 durch n8n.** Die PDFs gehen als Base64 im JSON vom Code-Node zum
  Dienst. Bei vielen großen Scans ist das Arbeitsspeicher; ein Multipart-Weg
  oder Objektspeicher wäre der nächste Schritt.
- **Extraktionsdienst ohne Auth und Limits.** Antwortet jedem im
  Compose-Netz, bis 50 Dateien je Anfrage, kein Größenlimit.
- **Der Verteiler ist eine Demo-Tabelle.** Rolle zu Postfach steht in
  `zustaendigkeiten.yaml` und zeigt auf GreenMail. Wer beim Kunden hinter
  „Lieferant/Verkäufer“ steht, ist Stammdatenpflege je Sendung, die es
  nicht gibt; bis dahin bekommt jede Rolle ein festes Postfach.
- **Der Mail-Eingang kennt nur die Aktennummer.** Eine Antwort findet ihre
  Akte über `ZP-JJJJ-NNNN` in Betreff oder Text (ADR-010). Antwortet ein
  Lieferant ohne die Nummer, steht die Mail als unzugeordnet in
  `mail_eingang`, und den Bildschirm, um sie von Hand zuzuordnen, gibt es
  nicht. Eine Zuordnung über Rechnungs- oder Containernummer gegen die
  abgelegten Assertions wäre eine Regel und gehörte nach `src/`.
- **Kein Eingang über die Erstanlage.** Der Posteingang ergänzt eine Akte,
  die schon geprüft wurde. Eine Sendung, deren erste Belege per Mail
  kommen, hat keine Stammdaten; sie landet als unzugeordnet.
- **Eine Stufe je Lauf, ein Lauf je Tag.** Der Nachforderungs-Workflow
  klettert höchstens eine Eskalationsstufe pro Tag. Wer nach einem
  Wochenende zwei Stufen versäumt hat, holt sie an zwei Tagen nach, nicht
  an einem. Das ist Absicht (Mindestabstand), aber nicht jedermanns.
- **Erledigt nur nach Mail oder um 07:00.** Eine Antwort per Mail stößt
  den Abgleich ihrer Akte sofort an; eine Einreichung über die Oberfläche
  oder den Webhook nicht. Wer dort einen Beleg nachreicht, sieht die
  Nachforderung bis zum nächsten Lauf offen (ADR-009, Option A wäre die
  andere Wahl).
- **Der Override kennt jetzt einen geprüften Namen, aber nur hinter dem
  Proxy.** nginx meldet an und reicht den Benutzernamen weiter; der Befund
  trägt `uebersteuert_identitaet: proxy` (ADR-009). Wer den Webhook direkt
  aufruft, bekommt `angegeben`, und n8n selbst prüft den Header nicht: Wer
  Port 5678 erreicht, kann ihn setzen. Vor einem Betrieb muss n8n nur über
  den Proxy erreichbar sein, und Basic Auth ist kein Benutzerverzeichnis:
  keine Rollen, kein Passwortwechsel, keine Abmeldung.
- **Verbrauchte Overrides erreichen den Betrieb, nicht die Fachseite.** Eine
  Katalogänderung entwertet sie richtigerweise. Seit dem Monitoring gibt es
  dafür einen Alarm (`ZollPilotOverrideVerbraucht`), aber er feuert erst,
  wenn die Akte erneut geprüft wird, und er endet in einer Tabelle. Wer die
  Akte verantwortet hat, erfährt es weiterhin nur, wenn jemand nachsieht.
- **Die Oberfläche zeigt keine Fundstelle.** Jede Assertion trägt Seite und
  Bounding Box; das PDF wird nicht angezeigt und nichts darin markiert. Ohne
  das bleibt `re_extraction_required` eine Aufforderung ohne Werkzeug.
- **Die Oberfläche hinter Basic Auth, ohne TLS.** Wer Port 8088 erreicht,
  braucht Zugangsdaten aus `deploy/nginx/zollpilot.htpasswd`; die stehen im
  Repo, weil es Demo-Werte sind. Ohne TLS gehen sie im Klartext über die
  Leitung. Auf localhost ist das egal, außerhalb ein Blocker.
- **Kein Bildschirmleser-Test.** axe läuft über jede Ansicht und findet
  keinen Verstoß, aber automatische Prüfung deckt nur einen Teil der
  WCAG-Kriterien ab. Ob die Reihenfolge Sinn ergibt, sagt nur ein Mensch mit
  einem Bildschirmleser.
- **Ein Browser in den Ende-zu-Ende-Läufen.** Chromium. Firefox und WebKit
  laufen nicht mit.
- **Kein Mensch am Ende des Alarms.** Prometheus wertet aus, der
  Alertmanager liefert, n8n schreibt die Zeile, Grafana zeigt sie. Der
  Versand-Node ist deaktiviert wie der für Nachforderungen. Ein Alarm ist
  damit eine Zeile, die jemand lesen muss (`BETRIEB.md`).
- **Die Wiedervorlage wird nicht aufgeräumt.** `wiedervorlage.nutzlast`
  trägt Aktendaten; die Frist von 14 Tagen steht in `DATENSCHUTZ.md`, der
  Job, der sie durchsetzt, nicht im Repo.
- **Wiederholen heißt nicht korrigieren.** `POST /webhook/wiederholen`
  schickt denselben Rumpf noch einmal. Das hilft, wenn ein Dienst weg war;
  es hilft nicht, wenn der Rumpf selbst falsch ist. Ein Lauf, der am
  Verpacken der Belege scheitert, ist `nicht_wiederholbar` und braucht eine
  neue Einreichung.
- **Der eigene Node hängt an der Installationsart.** Aus dem
  Erweiterungsverzeichnis geladen heißt sein Typ `CUSTOM.zollPilotExtraktion`,
  als Community-Paket installiert `n8n-nodes-zollpilot.zollPilotExtraktion`.
  Der Workflow-Export nennt den ersten Namen; wer das Paket per npm
  installiert, muss den Typ im Export ändern. Ein Import-Skript, das das
  umschreibt, ist nicht gebaut.
- **Der eigene Node lädt Belege als Base64 in den Speicher.** Wie der
  Code-Node vorher; ein Stream-Weg zum Dienst wäre der nächste Schritt.
- **Der Bündler ist ein Regex-Parser.** Kennt genau die Import-/Exportformen
  aus `src/`. Ein `export default` bricht ihn sichtbar.
- **`regel-check` erkennt Regex-Literale heuristisch.** Ein Regex direkt nach
  einem Bezeichner würde als Division gelesen. Bisher kein Fall.

## Braucht Zugänge

- **Die CI ist seit Lauf 15 gesehen, und grün.** Am 12.09.2026 liefen alle
  acht Jobs auf einem GitHub-Läufer durch, zuletzt für `a9fc079`, darunter
  der Stack-Job mit Monitoring, Wiedervorlage und eigenem Node in 153
  Sekunden. Davor war die Oberfläche zweimal rot: Chromium auf Linux
  rendert sieben Pixel höher als auf Windows, und die Aktenspalte bekam bei
  900 px einen Rollbalken. Kein Gate im Repo kann den Zustand der CI
  prüfen; wer das wissen will, sieht unter *Actions* nach.
- **Docker in der CI.** Der Job `betrieb` baut Extraktion und Oberfläche und
  zieht das n8n-Image; auf GitHub-Runnern ist Docker vorhanden, die Laufzeit
  liegt bei fünf bis acht Minuten.
- **IDP-Anbieter: gemessen, aber nur einer und nur synthetisch.** Der
  Vergleichslauf aus ADR-005 ist gezogen: Azure Document Intelligence liest
  alle 32 Testbelege aus aufgezeichneten Antworten zu 100 Prozent und
  entscheidet 8 von 8 wie die Basislinie (`docs/EXTRAKTION.md`). Das sagt:
  Die Nahtstelle hält, und auf digital erzeugten Belegen zieht ein Anbieter
  höchstens gleich. Es sagt nicht, wie er auf Stempeln, Durchschlägen und
  fremden Layouts liest; dafür fehlt weiterhin ein Korpus. Ändert sich ein
  Testbeleg, ist seine Aufzeichnung verwaist und muss mit einem Schlüssel
  neu gezogen werden. Google Document AI und ABBYY bleiben Recherche.
