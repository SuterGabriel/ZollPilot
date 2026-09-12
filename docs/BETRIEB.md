# Betrieb und Übergabe

Für Betrieb und Support. Wer diesen Text liest, muss das Regelwerk nicht
verstehen — nur wissen, wo etwas läuft, wo es steht, wenn es nicht läuft, und
was vor einem echten Betrieb noch fehlt.

## Was läuft

Drei Container aus `compose.yml`:

| Dienst | Aufgabe | Port | Gesund, wenn |
|---|---|---|---|
| `postgres` | zwei Datenbanken: `n8n` (Workflows, Ausführungen) und `zollpilot` (Akte, Prüfungen, Fehler) | 5432, nur localhost | `pg_isready` |
| `n8n-import` | läuft einmal beim Start: importiert Credentials und Workflows aus dem Repo, beendet sich | — | Exit 0 |
| `n8n` | Orchestrierung, Webhook, Oberfläche | 5678, nur localhost | `GET /healthz` antwortet `ok` |

Der Stand im Repo ist der Stand im System. Wer einen Workflow ändert, ändert
ihn im Repo und importiert neu — nicht umgekehrt.

## Ein Befehl

```bash
cp .env.example .env          # einmalig, Werte prüfen
docker compose up -d --wait   # startet alles, wartet auf Health
bash scripts/rauchtest.sh     # schickt die Testakten, prüft die Entscheidungen
```

`--wait` kehrt erst zurück, wenn n8n gesund ist. Der Rauchtest ist der
Beweis, dass Import, Bundle, Schema und Webhook zusammen funktionieren.

Oberfläche: `http://localhost:5678`. Beim ersten Start legt n8n einen
Owner an; die Workflows sind bereits importiert und aktiv.

## Wo etwas steht

**Eine Prüfung finden.** Jede Anfrage an `POST /webhook/akte` landet als Zeile
in `zollpilot.pruefung`:

```bash
docker compose exec postgres psql -U zollpilot -d zollpilot \
  -c "select akte_id, freigabe, befunde_verletzt, geprueft_am from pruefung order by geprueft_am desc limit 20"
```

Die Sicht `rule_result` zerlegt das Ergebnis je Regel:

```sql
select regel, status, count(*) from rule_result group by 1, 2 order by 1, 2;
```

**Einen Fehler finden.** Schlägt ein Workflow fehl, schreibt der
Fehler-Workflow eine Zeile nach `workflow_fehler` mit Workflow, Ausführung,
Node und Meldung — ohne Aktendaten:

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
```

**Metriken.** `GET http://localhost:5678/metrics` liefert
Prometheus-Format (`N8N_METRICS=true`): Ausführungen je Workflow und Status,
Warteschlange, Prozessdaten. Ein Prometheus, der das abholt, ist nicht Teil
dieses Repos.

## Was Support tun kann

| Situation | Handgriff |
|---|---|
| Webhook antwortet 404 | Workflow nicht aktiv. In n8n prüfen; sonst `docker compose restart n8n-import n8n` |
| Antwort 422 | Kein Fehler. Die Akte ist nicht freigabereif; das Ergebnis im Body sagt, warum und wer nachliefern muss |
| Antwort 500 | Zeile in `workflow_fehler` lesen, Ausführung in n8n öffnen |
| Postgres-Node rot, Antwort trotzdem da | Absicht: `onError: continueRegularOutput`. Die Antwort an den Aufrufer ist wichtiger als die Ablage. Fehler steht in `workflow_fehler` |
| Regel oder Schwelle ändern | Nicht in n8n. `rules.yaml` ändern, `npm test`, `npm run bundle`, committen, `docker compose restart n8n-import n8n` |
| Workflow in der Oberfläche geändert | Wird beim nächsten Import überschrieben. Änderungen gehören ins Repo (ADR-004) |
| Alles zurücksetzen | `docker compose down -v` löscht beide Datenbanken |

## Geheimnisse

`.env` und `deploy/n8n/credentials.json` tragen Entwicklungswerte, die im Repo
stehen. Das ist für den lokalen Demo-Betrieb Absicht und für alles andere
falsch. Vor einem Betrieb außerhalb der eigenen Maschine: Passwort und
`N8N_ENCRYPTION_KEY` ersetzen, `credentials.json` aus einem Secret-Store
erzeugen statt committen. Der Encryption Key darf nach dem ersten Start nie
mehr wechseln, sonst sind alle Credentials in n8n unlesbar.

## Was vor einem echten Betrieb fehlt

Ehrlich aufgeschrieben, damit die Übergabe keine Überraschung wird:

- **Kein Monitoring, kein Alarm.** Der Metrik-Endpunkt existiert; niemand
  liest ihn. Nötig: Prometheus oder gleichwertig, Alarm auf
  `workflow_fehler`-Zuwachs und auf ausbleibende Prüfungen.
- **Keine Sicherung.** Postgres-Volume ohne Backup. Nötig: `pg_dump` nach Plan,
  Wiederherstellung einmal geprobt.
- **Kein TLS, kein Reverse Proxy, keine Authentifizierung am Webhook.** Ports
  sind auf localhost gebunden; mehr nicht.
- **Ein n8n-Prozess.** Kein Queue-Modus, keine Worker. Reicht für Dutzende
  Akten am Tag, nicht für Tausende.
- **Kein Kubernetes.** Compose ist Entwicklung und Demo. Ein Chart wäre Stufe 4
  und nur dann ehrlich, wenn er in der CI ausgerollt wird.
- **Kein Mail-Intake, kein Versand.** Der E-Mail-Node ist deaktiviert; der
  Zielprozess beginnt beim Postfach, der Prototyp am Webhook.
- **Keine Rollen in n8n.** Ein Owner, keine Trennung zwischen Betrieb und
  Fachseite.

Was davon zuerst kommt, entscheidet der Auftraggeber; die Reihenfolge oben ist
die Empfehlung.
