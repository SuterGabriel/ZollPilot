# Offene Punkte

Was ungeklärt oder nicht gebaut ist — inklusive der unbequemen Punkte.
Fachliche Unsicherheiten der Recherche stehen in
[08-known-unknowns.md](08-known-unknowns.md); hier steht, was das Repo
selbst betrifft.

## Die unbequemen zuerst

**Die Extraktion ist nicht gebaut.** Die Ausschreibung nennt IDP/OCR als
Must-have. Dieses Repo hat die Architektur (`07-idp-ocr.md`), das Datenmodell
(Assertions mit Konfidenz und Fundstelle) und den Konfidenzpfad in den Regeln
— aber keinen Code, der aus einem PDF eine Assertion macht. Die Testakten
sind bereits extrahierte Datensätze. Stufe 3 des Plans; bis dahin ist M2 in
`ANFORDERUNGEN.md` „in Arbeit“, nicht „belegt“.

**Es gibt keine PDFs.** `PROJECT.md` verspricht sechs bis acht synthetische
PDFs. Es gibt sieben synthetische Akten als JSON. Die PDFs kommen mit der
Extraktion, weil sie ohne sie nichts prüfen würden.

**Kein Kubernetes.** N1 nennt es. Es gibt Compose mit Healthchecks und einen
CI-Job, der den Stack hochfährt. Ein Chart käme in Stufe 4 — und nur, wenn er
in der CI tatsächlich ausgerollt wird, nicht als Beispiel.

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
- **Wortlaut der Ursprungserklärung (ORG-07)** je Abkommen. Nicht im MVP.
- **Konfidenzschwelle je Feldklasse.** Eine Zahl (0,80) für alle Felder ist
  eine Vereinfachung.
- **Nachextraktion als Prozess.** Der Status existiert, der Weg
  (zweite Engine, Human Review, Rückkehr in die Prüfung) nicht.
- **Ursprungserklärung als eigener Beleg.** ADR-001 modelliert sie als
  logisches Dokument mit Träger. Ob der Klassifikator das zuverlässig aus
  einer Rechnung trennt, entscheidet sich in Stufe 3.
- **Akte auf welcher Ebene?** PO, Rechnung, Container oder MRN — offene
  Frage 2 in `PROJECT.md`. Der Prototyp nimmt eine Rechnung mit einem
  Container an.

## Technisch offen

- **Katalog im Code-Node eingebettet** (ADR-004). Eine Schwellenänderung
  braucht Bundle und Import. Laden aus Postgres zur Laufzeit wäre der nächste
  Schritt.
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
- **Docker in der CI.** Der Job `betrieb` zieht das n8n-Image; auf
  GitHub-Runnern ist Docker vorhanden, die Laufzeit liegt bei zwei bis drei
  Minuten.
- **IDP-Anbieter.** ABBYY oder Document AI brauchen Lizenz oder Projekt; ohne
  bleibt N2 „nicht belegbar“.
