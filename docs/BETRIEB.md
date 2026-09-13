# Betrieb und Übergabe

Für Betrieb und Support. Wer diesen Text liest, muss das Regelwerk nicht
verstehen, sondern nur wissen, wo etwas läuft, wo es steht, wenn es nicht läuft, und
was vor einem echten Betrieb noch fehlt.

## Was läuft

Neun Container aus `compose.yml`, fünf für die Akte und vier fürs Hinsehen:

| Dienst | Aufgabe | Port | Gesund, wenn |
|---|---|---|---|
| `postgres` | zwei Datenbanken: `n8n` (Workflows, Ausführungen) und `zollpilot` (Akte, Prüfungen, Fehler) | 5432, nur localhost | `pg_isready` |
| `n8n-import` | läuft einmal beim Start: importiert Credentials und Workflows aus dem Repo, beendet sich | keiner | Exit 0 |
| `n8n` | Orchestrierung: sieben Workflows (Prüfung, Nachforderung, Posteingang, Übersicht, Wiederholung, Fehler, Alarm; als Bild in `docs/prozess/workflows.md`), ein eigener Node für die Extraktion aus `nodes/n8n-nodes-zollpilot/`, der n8n-Editor | 5678, nur localhost | `GET /healthz` antwortet `ok` |
| `extraktion` | Belege (PDF) → Assertions: Textlayer oder Tesseract, Klassifikation, Felder. Entscheidet nichts (ADR-005) | 8765 auf dem Host (nur localhost), 8080 im Compose-Netz | `GET /healthz` antwortet `ok` und sagt, ob OCR verfügbar ist |
| `oberflaeche` | nginx: liefert die Angular-Anwendung aus und reicht `/webhook/` an n8n weiter. Der Einstieg für Menschen (ADR-006) | 8088, nur localhost | `GET /` liefert die Anwendung |
| `greenmail` | das Testpostfach (ADR-009): SMTP für den Versand der Nachforderungen, IMAP für den Eingang, eine Schnittstelle zum Nachsehen | 8025 (Schnittstelle), 3025 (SMTP), 3143 (IMAP), alle nur localhost | `GET /api/service/readiness` |
| `prometheus` | holt alle 15 s die Metriken von n8n, Extraktion und SQL-Exporter ab und wertet die Alarmregeln aus (`deploy/prometheus/`) | 9090, nur localhost | `GET /-/healthy` |
| `alertmanager` | nimmt die Alarme von Prometheus entgegen und liefert sie an n8n, `POST /webhook/alarm` (`deploy/alertmanager/`) | 9093, nur localhost | `GET /-/healthy` |
| `sql-exporter` | macht aus der Prüftabelle die fachlichen Zähler: Freigaben, Befunde je Regel, Fehler, offene Wiedervorlagen (`deploy/sql-exporter/`) | 9399, nur im Compose-Netz | Prometheus meldet `up{job="sql-exporter"}`; kein Healthcheck, das Image hat keine Shell |
| `grafana` | das Dashboard „ZollPilot“, aus dem Repo provisioniert (`deploy/grafana/`). Lesen ohne Anmeldung | 3000, nur localhost | `GET /api/health` |

n8n hängt nicht vom Extraktionsdienst ab: `POST /webhook/akte` läuft ohne
ihn, `POST /webhook/belege` scheitert ohne ihn sichtbar (500, Zeile in
`workflow_fehler` mit Node „Belege extrahieren“, Zeile in `wiedervorlage`).

Das Monitoring ist Zuschauer. Fällt Grafana, Prometheus oder der Exporter
aus, prüft ZollPilot weiter; nur niemand sieht mehr zu. Umgekehrt hängt
kein Prüfpfad an einem der vier.

Der Stand im Repo ist der Stand im System. Wer einen Workflow ändert, ändert
ihn im Repo und importiert neu, nicht umgekehrt.

## Ein Befehl

```bash
cp .env.example .env          # einmalig, Werte prüfen
docker compose up -d --build --wait   # startet alles, wartet auf Health
bash scripts/rauchtest.sh     # schickt die Testakten, prüft die Entscheidungen
```

`--wait` kehrt erst zurück, wenn alle Dienste gesund sind. Beim ersten Start
baut Compose zwei Images: die Extraktion (`extraktion/Dockerfile`, ein bis
zwei Minuten für Tesseract und die Python-Abhängigkeiten) und die Oberfläche
(`oberflaeche/Dockerfile`, Angular-Bau und nginx). Der Rauchtest ist der
Beweis, dass Import, Bundle, Schema, Extraktionsdienst, beide Webhooks und
der Proxy zusammen funktionieren: Runde 1 schickt Akten, Runde 2 schickt
PDFs, Runde 3 eine Akte durch die Oberfläche, Runde 4 übersteuert, Runde 5
lässt einen Lauf scheitern, Runde 6 wiederholt einen gescheiterten Lauf,
Runde 7 fragt das Monitoring, ob es all das gesehen hat.

**Der Einstieg ist `http://localhost:8088`.** Dort reicht die Oberfläche
für Einreichen, Lesen und Übersteuern (`docs/OBERFLAECHE.md`). Sie verlangt
eine Anmeldung: Demo-Zugänge `sachbearbeitung` und `teamleitung`, Passwort
`zollpilot-dev`, aus `deploy/nginx/zollpilot.htpasswd`. nginx reicht den
geprüften Namen als `X-Benutzer` an n8n; er steht dann an jeder
Übersteuerung als `uebersteuert_von` mit `uebersteuert_identitaet: proxy`
(ADR-009). Neuer Zugang: `openssl passwd -apr1` und eine Zeile in der
Datei, dann `docker compose build oberflaeche && docker compose up -d
oberflaeche`.

**Das Dashboard ist `http://localhost:3000`.** Lesen ohne Anmeldung;
ändern kann nur `admin` mit dem Passwort aus `.env`, und die Änderung ist
beim nächsten Start weg, weil das Dashboard aus dem Repo kommt.

n8n selbst: `http://localhost:5678`. Beim ersten Aufruf verlangt n8n die
Anlage eines Owner-Kontos; das lässt sich in 1.114.0 nicht abschalten, der
frühere Schalter `N8N_USER_MANAGEMENT_DISABLED` wirkt nicht mehr. Das Konto
ist rein lokal: Es liegt in der Datenbank `n8n` dieses Stacks, die
E-Mail-Adresse ist ein Anmeldename (kein SMTP, keine Telemetrie,
`N8N_DIAGNOSTICS_ENABLED=false`), und `docker compose down -v` löscht es
wieder. Beliebige Adresse, Passwort mit mindestens acht Zeichen, einer Ziffer
und einem Großbuchstaben.

**Für den Betrieb ist das Konto nicht nötig.** Webhooks, Rauchtest und CI
laufen ohne Anmeldung; die Workflows sind nach dem Start importiert und
aktiv. Das Konto braucht nur, wer die Ausführungen in der Oberfläche ansehen
will.

## Wo etwas steht

**Eine Prüfung finden.** Jede Anfrage an `POST /webhook/akte` landet als Zeile
in `zollpilot.pruefung`:

```bash
docker compose exec postgres psql -U zollpilot -d zollpilot \
  -c "select akte_id, freigabe, befunde_verletzt, geprueft_am from pruefung order by geprueft_am desc limit 20"
```

**Eine Ausführung zu einer Prüfung finden.** Jedes Ergebnis trägt die
Ausführungs-ID von n8n; sie steht auch in der Oberfläche im
Entscheidungsband:

```sql
select akte_id, freigabe, ergebnis->>'ausfuehrung' as ausfuehrung, geprueft_am
from pruefung order by geprueft_am desc limit 20;
```

Damit lässt sich die Ausführung in n8n unter *Executions* öffnen, mit
Eingabe und Ausgabe je Node. Nach 14 Tagen ist sie gelöscht
(`EXECUTIONS_DATA_MAX_AGE`); die Prüfung selbst bleibt.

Die Sicht `rule_result` zerlegt das Ergebnis je Regel:

```sql
select regel, status, count(*) from rule_result group by 1, 2 order by 1, 2;
```

**Einen Fehler finden.** Schlägt ein Workflow fehl, schreibt der
Fehler-Workflow eine Zeile nach `workflow_fehler` mit Workflow, Ausführung,
Node und Meldung, ohne Aktendaten:

```sql
select aufgetreten_am, workflow_name, node_name, meldung from workflow_fehler order by 1 desc limit 20;
```

Die Ausführung selbst, mit Eingabe und Ausgabe je Node, liegt in n8n unter
*Executions*. Ausführungen werden nach 14 Tagen gelöscht
(`EXECUTIONS_DATA_MAX_AGE`); was bleiben soll, steht in `pruefung`.

**Logs.**

```bash
docker compose logs -f n8n
docker compose logs n8n-import     # wenn Workflows fehlen
docker compose logs -f extraktion  # je Anfrage: Akten-ID, Dateien, Dauer, nie Belegtext
```

**Drei Antworten, drei Bedeutungen.** Der Webhook unterscheidet sie, und ein
Aufrufer darf sich darauf verlassen:

| Code | Bedeutung |
|---|---|
| 200 | geprüft und freigabereif, unter Berücksichtigung der Übersteuerungen (ADR-007) |
| 422 | geprüft, nicht freigabereif. Kein Fehler: Der Rumpf trägt das vollständige Ergebnis |
| 500 | **nicht geprüft.** Der Lauf ist gescheitert. Der Rumpf nennt die Ausführungs-ID, ob der Lauf wiederholbar ist, und sonst nichts |

Der Fehlerzweig ist der Grund für den dritten Fall. Ohne ihn endet ein
abgestürzter Lauf mit 200 und leerem Rumpf; der Aufrufer könnte „freigabereif"
nicht von „abgestürzt" unterscheiden. `scripts/rauchtest.sh`, Runde 5, prüft
das bei jedem Lauf.

**Einen gescheiterten Lauf wiederholen.** Der Fehlerzweig legt neben der
Zeile in `workflow_fehler` eine Zeile in `wiedervorlage` ab: welcher Eingang
lief und was erneut hinein müsste. Wer die Ursache behoben hat, muss die
Belege nicht noch einmal suchen:

```bash
curl -X POST -H 'Content-Type: application/json' \
  -d '{"execution_id":"1234"}' http://localhost:5678/webhook/wiederholen
```

Antwort 200 mit dem Ergebnis des wiederholten Laufs (`ergebnis.freigabe`),
404 wenn zu dieser Ausführung nichts offen ist. Die Zeile wechselt auf
`erledigt`, oder auf `erneut_gescheitert`, wenn auch der zweite Lauf
scheitert; der hat dann seine eigene Zeile. Offene Zeilen:

```sql
select execution_id, eingang, akte_id, status, angelegt_am from wiedervorlage where status = 'offen';
```

`nutzlast` in dieser Tabelle trägt Aktendaten, anders als `workflow_fehler`.
Das ist ihr Zweck und der Grund für die Aufbewahrungsregel in
`docs/DATENSCHUTZ.md`. `scripts/rauchtest.sh`, Runde 6, hält den
Extraktionsdienst an, reicht ein, bringt ihn zurück und wiederholt.

## Alarme

Prometheus holt die Metriken ab (`http://localhost:9090`), wertet
`deploy/prometheus/alarme.yml` aus und übergibt an den Alertmanager
(`http://localhost:9093`). Der liefert an n8n, `POST /webhook/alarm`, und
der Workflow `zollpilot-alarm` schreibt jeden Alarm als Zeile nach `alarm`,
mit Beginn und Ende. Grafana (`http://localhost:3000`) zeigt beides, die
Zähler und die Alarme. `scripts/rauchtest.sh`, Runde 7, prüft, dass die
Zahlen des Laufs dort ankommen.

**Woher die Zahlen kommen.** Drei Quellen, weil keine allein reicht:

- **n8n** zählt Läufe je Workflow (`n8n_workflow_started_total`,
  `n8n_workflow_success_total`, `n8n_workflow_failed_total`). Erst
  `N8N_METRICS_INCLUDE_MESSAGE_EVENT_BUS_METRICS=true` erzeugt sie; ohne den
  Schalter stehen unter `/metrics` nur CPU, Heap und Eventloop. Ein vom
  Fehlerzweig behandelter Fehler zählt hier als Erfolg.
- **Die Extraktion** zählt selbst (`GET :8765/metrics`): Anfragen, Dauer,
  Belege je Typ und Lesemethode, Konfidenz je Assertion. Kein Belegtext.
- **Der SQL-Exporter** liest die Prüftabelle: Prüfungen je Entscheidung,
  Befunde je Regel und Status, Fehler aus `workflow_fehler`, offene
  Wiedervorlagen, verbrauchte Übersteuerungen. Der Code-Node kann nichts
  exportieren; die Tabelle ist ohnehin der Ort der Wahrheit.

**Die Alarme und ihre Handgriffe.** Jeder Alarm aus `alarme.yml` steht hier
mit dem, was zu tun ist. Ein Alarm ohne Handgriff wäre Lärm.

| Alarm | Schwere | Heißt | Prüfen | Handgriff |
|---|---|---|---|---|
| `ZollPilotN8nNichtErreichbar` | kritisch | Kein Webhook nimmt an | `docker compose ps n8n`, `docker compose logs n8n` | `docker compose up -d n8n`. Kommt n8n nicht hoch, Postgres prüfen; Datenbank `n8n` ist seine |
| `ZollPilotExtraktionNichtErreichbar` | kritisch | `/webhook/belege` scheitert, `/webhook/akte` läuft | `docker compose ps extraktion`, `docker compose logs extraktion` | `docker compose up -d extraktion`. Danach die offenen Wiedervorlagen wiederholen (oben) |
| `ZollPilotLaufGescheitert` | kritisch | Mindestens ein Lauf ist in 15 Minuten gescheitert | `select * from workflow_fehler order by aufgetreten_am desc limit 5` | Ursache beheben (Node und Meldung stehen in der Zeile), dann `POST /webhook/wiederholen` je `execution_id` |
| `ZollPilotSqlExporterNichtErreichbar` | warnung | Alle `zollpilot_*`-Zähler sind blind | `docker compose logs sql-exporter`; meist die Verbindung zu Postgres | `docker compose up -d sql-exporter`. Passwort in `.env` und `compose.yml` müssen übereinstimmen |
| `ZollPilotOhneOcr` | warnung | Scans werden `unclassified` | `curl localhost:8765/healthz` zeigt `ocr.verfuegbar: false` | `docker compose build extraktion && docker compose up -d extraktion` |
| `ZollPilotWiedervorlageOffen` | warnung | Gescheiterte Läufe warten seit 30 Minuten | `select * from wiedervorlage where status = 'offen'` | Je Zeile `POST /webhook/wiederholen`. Bleibt sie `erneut_gescheitert`, ist die Ursache nicht behoben. Kann der Rumpf nie durchlaufen (kaputte Einreichung): `update wiedervorlage set status = 'verworfen' where id = …`, mit Grund im Ticket |
| `ZollPilotKeinEingang` | warnung | Seit 24 Stunden keine Prüfung | Ist das plausibel (Wochenende, Feiertag)? Sonst: erreicht der Aufrufer den Webhook? | Von außen eine Testakte schicken (`scripts/rauchtest.sh` oder eine Akte aus `testdaten/akten/`). Das Fenster ist ein Betriebsparameter in `alarme.yml` |
| `ZollPilotExtraktionLangsam` | warnung | p95 über 60 s, der Proxy bricht bei 180 s ab | Dashboard „Belege je Lesemethode“: mehr OCR? Größere Dateien? | Kurzfristig nichts kaputt. Mittelfristig: mehr CPU für den Container, oder Scans vorab verkleinern |
| `ZollPilotNachextraktionHaeufig` | hinweis | Über 20 % der Befunde verlangen Nachextraktion | Dashboard „Lesefehler je Regel“: welches Feld? Konfidenz p10 nach Methode | Kein Betriebsfehler. Fachseite informieren: schlechte Scans oder ein fremdes Layout (`docs/EXTRAKTION.md`) |
| `ZollPilotOverrideVerbraucht` | hinweis | Eine Übersteuerung galt für eine andere Katalogfassung | `select * from override_wirkung where not gewirkt` | Fachseite informieren. Wer die Akte weiter verantworten will, übersteuert erneut, gegen die neue Fassung (ADR-007) |
| `ZollPilotPostgresVerbindungenKnapp` | warnung | Über 80 % von `max_connections` belegt | `select application_name, count(*) from pg_stat_activity group by 1` | n8n hält Verbindungen; `docker compose restart n8n` gibt sie frei. Dauerhaft: `max_connections` in Postgres erhöhen |

**Wer den Alarm bekommt.** Eine Tabelle und ein Dashboard, kein Mensch. Der
Versand-Node im Alarm-Workflow ist vorbereitet und deaktiviert, aus
demselben Grund wie bei den Nachforderungen: kein SMTP im Demo-Betrieb. Vor
einem echten Betrieb: SMTP-Zugang hinterlegen, Node aktivieren, Empfänger
je Schweregrad im Alertmanager eintragen (`route` in `alertmanager.yml`).

## Was Support tun kann

| Situation | Handgriff |
|---|---|
| Webhook antwortet 404 | Workflow nicht aktiv. In n8n prüfen; sonst `docker compose restart n8n-import n8n` |
| Antwort 422 | Kein Fehler. Die Akte ist nicht freigabereif; das Ergebnis im Body sagt, warum und wer nachliefern muss |
| Antwort 500 | Zeile in `workflow_fehler` lesen, Ausführung in n8n öffnen. Sagt der Rumpf `wiederholbar: true`: Ursache beheben, dann `POST /webhook/wiederholen` mit der Ausführungs-ID |
| Ein Alarm feuert | Tabelle oben: Alarmname, Prüfen, Handgriff. Der Alarm steht auch in `alarm` und im Dashboard |
| Nachforderungen sofort versenden statt morgen früh | `curl -X POST -H 'Content-Type: application/json' -d '{"akte_id":"ZP-2026-0002"}' localhost:5678/webhook/nachforderungen`; ohne `akte_id` für alle Akten. Was versandt wurde: `select * from request_versand order by versandt_am desc` |
| Nachsehen, was im Testpostfach liegt | `curl localhost:8025/api/user/lieferant@zollpilot.test/messages`; die Postfächer stehen in `compose.yml` unter `greenmail` |
| Eine Antwort per Mail von Hand nachstellen | `bash scripts/antwort-per-mail.sh ZP-2026-0002 testdaten/belege/happy-path/handelsrechnung.pdf` schickt sie an das Eingangspostfach; ohne Argumente eine Mail ohne Aktennummer. Danach `select akte_id, zugeordnet, grund, freigabe from mail_eingang order by id desc limit 3` |
| Eine Antwort per Mail ist nicht angekommen | `select * from mail_eingang order by empfangen_am desc limit 10`: steht sie mit `zugeordnet = false`, sagt `grund`, warum (keine Aktennummer, keine Anhänge, Akte nie geprüft). Steht sie gar nicht: `docker compose logs n8n \| grep -i imap`; das Postfach ist `eingang@zollpilot.test` |
| Eine Akte nachlesen, wie sie abgelegt ist | `select dokument_id, typ, status, quelle, eingegangen_am from document where akte_id = '…'`; die Werte je Feld in `document_field_assertion` (ADR-010) |
| Eine Nachforderung schließt sich nicht, obwohl der Beleg da ist | Erledigt wird im Nachforderungs-Workflow (ADR-009): täglich um 07:00, nach jeder zugeordneten Antwort per Mail für deren Akte, oder von Hand über den Webhook oben. Bleibt sie offen, vermisst die letzte Prüfung den Wert noch: `select ergebnis->'nachforderungen' from pruefung where akte_id = '…' order by geprueft_am desc limit 1` |
| Dashboard zeigt keine Zahlen | `docker compose ps sql-exporter prometheus`; unter `http://localhost:9090/targets` muss jedes Ziel `UP` sein |
| Schema in `deploy/postgres/init.sql` geändert | Läuft nur beim ersten Start: `docker compose down -v && docker compose up -d --wait`. Löscht beide Datenbanken |
| Postgres-Node rot, Antwort trotzdem da | Absicht: `onError: continueRegularOutput`. Die Antwort an den Aufrufer ist wichtiger als die Ablage. Fehler steht in `workflow_fehler` |
| Regel oder Schwelle ändern | Nicht in n8n. `rules.yaml` ändern, `npm test`, `npm run bundle`, committen, `docker compose restart n8n-import n8n` |
| 500 auf `/webhook/belege`, `workflow_fehler` nennt „Belege extrahieren“ | Extraktionsdienst nicht erreichbar: `docker compose ps extraktion`, `docker compose logs extraktion`, dann `docker compose up -d extraktion` |
| Akte meldet `unclassified` mit Hinweis „OCR nicht verfügbar“ | `curl localhost:8765/healthz` zeigt `ocr.verfuegbar: false`: Image ohne Tesseract, neu bauen mit `docker compose build extraktion` |
| Akte meldet `unclassified` mit „Belegtyp nicht erkannt“ | Kein Fehler des Betriebs. Der Beleg ist an der Akte, die Sachbearbeitung sieht ihn in `extraktion.hinweise`; die Extraktion kennt eine Layoutfamilie (`docs/EXTRAKTION.md`) |
| Extraktion ändern | `extraktion/` ändern, `uv run pytest`, Bewertung gegen die Basislinie, dann `docker compose build extraktion && docker compose up -d extraktion` |
| Extraktionsdienst läuft woanders | Die Adresse steht in der Credential „ZollPilot Extraktion“ (`deploy/n8n/credentials.json`), nicht im Workflow: dort ändern, `docker compose restart n8n-import n8n`. Ein Token in derselben Credential geht als Bearer mit |
| Node „Belege extrahieren“ fehlt nach dem Import („Unrecognized node type“) | n8n findet das Erweiterungsverzeichnis nicht: `N8N_CUSTOM_EXTENSIONS=/custom` und der Mount von `nodes/n8n-nodes-zollpilot/dist` müssen bei `n8n` **und** `n8n-import` stehen. `docker compose logs n8n \| grep -i custom` |
| Eigenen Node ändern | `nodes/n8n-nodes-zollpilot/` ändern, `npm run build`, `npm test`, `dist/` mit committen (die CI vergleicht), dann `docker compose restart n8n-import n8n` |
| Oberfläche zeigt 502 beim Einreichen | nginx erreicht n8n nicht: `docker compose ps n8n`, `docker compose logs oberflaeche` |
| Oberfläche zeigt 413 | Die Belege überschreiten `client_max_body_size` (32 MB) in `deploy/nginx/zollpilot.conf` |
| Oberfläche ändern | `oberflaeche/` ändern, `npm test`, `npm run e2e`, `node scripts/kontrast-check.mjs`, dann `docker compose build oberflaeche && docker compose up -d oberflaeche` |
| Workflow im n8n-Editor geändert | Wird beim nächsten Import überschrieben. Änderungen gehören ins Repo (ADR-004) |
| Alles zurücksetzen | `docker compose down -v` löscht beide Datenbanken |

## Post an ein echtes Postfach

Im Demo-Betrieb geht jede Mail an GreenMail und keine nach draußen. Wer
sehen will, wie eine Nachforderung in einem echten Postfach ankommt, setzt
in `.env` die Zugangsdaten seines Mailanbieters und eine Umleitung
(Vorlage in `.env.example`):

```
ZOLLPILOT_SMTP_HOST=smtpauths.bluewin.ch
ZOLLPILOT_SMTP_PORT=465
ZOLLPILOT_SMTP_USER=name@bluewin.ch
ZOLLPILOT_SMTP_PASSWORT=…
ZOLLPILOT_SMTP_SICHER=true
ZOLLPILOT_SMTP_OHNE_STARTTLS=false
ZOLLPILOT_ABSENDER=name@bluewin.ch
ZOLLPILOT_POST_UMLEITEN_AN=name@bluewin.ch
```

Dann `docker compose up -d n8n`. Die SMTP-Credential in `credentials.json`
trägt bewusst keine Daten: n8n füllt eine Überschreibung nur in Felder, die
leer sind (`applyOverwrite` in `credentials-overwrites.js`). Server, Konto und
Absender kommen deshalb ausschließlich aus `CREDENTIALS_OVERWRITE_DATA` in
`compose.yml`, das ohne `.env` auf GreenMail zeigt. Das Passwort steht damit
nur in `.env`, die nicht im Repo liegt. Stünden die Werte in
`credentials.json`, ginge jede Mail weiter an GreenMail, und zwar ohne
Fehlermeldung: GreenMail nimmt jede Adresse an und legt für sie ein Postfach
an. Wer prüfen will, wohin eine Mail wirklich ging, sieht dort nach:
`curl -s http://localhost:8025/api/user/<adresse>/messages`. Die Umleitung schickt jede Nachforderung an genau diese eine Adresse,
gleich an welche Rolle sie gerichtet war. In `request_versand` steht
weiterhin der Adressat aus dem Verteiler, nicht die Umleitung: Der Vorgang
bleibt derselbe, nur der Briefkasten ist ein anderer. Der Rückweg per Antwort
braucht zusätzlich ein IMAP-Postfach, das der Posteingang abfragt; das ist
nicht vorgesehen und bleibt bei GreenMail.

Wann eine Mail kommt, entscheidet `zustaendigkeiten.yaml`, nicht der Kalender
des Betriebs: `erinnerung_0` sofort beim ersten Lauf nach der Feststellung,
jede weitere Stufe erst, wenn ihr Cut-off aus der Akte minus Vorlauf erreicht
ist, und zwischen zwei Versendungen an denselben Fall mindestens
`versand.mindestabstand_stunden`. Der Lauf ist täglich um 07:00, nach jeder
zugeordneten Antwort per Mail, oder von Hand über den Webhook (Tabelle oben).
Wer nicht auf den Kalender warten will, gibt dem Webhook ein `jetzt` mit.

## Geheimnisse

`.env` und `deploy/n8n/credentials.json` tragen Entwicklungswerte, die im Repo
stehen. Das ist für den lokalen Demo-Betrieb Absicht und für alles andere
falsch. Vor einem Betrieb außerhalb der eigenen Maschine: Passwort und
`N8N_ENCRYPTION_KEY` ersetzen, `credentials.json` aus einem Secret-Store
erzeugen statt committen. Der Encryption Key darf nach dem ersten Start nie
mehr wechseln, sonst sind alle Credentials in n8n unlesbar.

## Was vor einem echten Betrieb fehlt

Ehrlich aufgeschrieben, damit die Übergabe keine Überraschung wird:

- **Kein Mensch am Ende des Alarms.** Prometheus wertet aus, der
  Alertmanager liefert, n8n schreibt die Zeile, Grafana zeigt sie. Geweckt
  wird niemand: Der Versand-Node ist deaktiviert. Nötig: SMTP oder ein
  Pager-Dienst als Empfänger im Alertmanager, und eine Bereitschaft, die
  die Runbooks oben kennt.
- **Das Monitoring läuft ohne Anmeldung und ohne Redundanz.** Grafana ist
  für jeden auf localhost lesbar, Prometheus und Alertmanager sind einzelne
  Container ohne Sicherung ihrer Daten. Für eine Demo richtig, für einen
  Betrieb nicht.
- **Die Wiedervorlage wächst.** `wiedervorlage.nutzlast` trägt Aktendaten und
  wird nicht automatisch gelöscht. Nötig: dieselbe Frist wie für
  Ausführungen (14 Tage), als Job oder als Aufgabe des Alarm-Workflows.
- **Keine Sicherung.** Postgres-Volume ohne Backup. Nötig: `pg_dump` nach Plan,
  Wiederherstellung einmal geprobt.
- **Kein TLS, und Basic Auth ist kein Benutzerverzeichnis.** Die Oberfläche
  verlangt eine Anmeldung, aber die Zugangsdaten gehen unverschlüsselt über
  die Leitung, es gibt keine Rollen, keinen Passwortwechsel, keine
  Abmeldung. Und n8n prüft den Header `X-Benutzer` nicht selbst: Wer Port
  5678 direkt erreicht, kann ihn setzen. Vor jedem Betrieb außerhalb der
  eigenen Maschine: TLS am Proxy, n8n nur über den Proxy erreichbar, OIDC
  statt Passwortdatei. Die Nahtstelle bleibt der eine Header.
- **Ein n8n-Prozess.** Kein Queue-Modus, keine Worker. Reicht für Dutzende
  Akten am Tag, nicht für Tausende.
- **Kein Kubernetes.** Compose ist Entwicklung und Demo. Ein Chart wäre Stufe 4
  und nur dann ehrlich, wenn er in der CI ausgerollt wird.
- **Post läuft über ein Testpostfach.** GreenMail nimmt an, was der
  Nachforderungs-Workflow schickt, liefert dem Posteingang, was als
  Antwort kommt, und vergisst beides beim Neustart. Nötig: die SMTP- und
  IMAP-Credentials des Kunden in `deploy/n8n/credentials.json` und der
  echte Verteiler in `zustaendigkeiten.yaml`.
- **Aktendaten bleiben, bis jemand löscht.** Seit ADR-010 liegt jede
  geprüfte Akte mit Rohwerten in Postgres. Eine Löschregel nach Ablauf der
  Aufbewahrung gibt es nicht (`docs/DATENSCHUTZ.md`).
- **Keine Rollen in n8n.** Ein Owner, keine Trennung zwischen Betrieb und
  Fachseite.
- **Extraktionsdienst ohne Authentifizierung und ohne Begrenzung.** Er
  antwortet jedem im Compose-Netz, nimmt bis zu 50 Dateien je Anfrage und
  kennt kein Größenlimit. Die PDFs gehen als Base64 durch den Code-Node von
  n8n; bei vielen großen Scans ist das Arbeitsspeicher, keine Streams.
- **OCR-Konfidenzen sind nicht kalibriert.** Die Schwelle 0,80 im Katalog
  ist eine Konvention, kein gemessener Wert (ADR-005).

Was davon zuerst kommt, entscheidet der Auftraggeber; die Reihenfolge oben ist
die Empfehlung.
