#!/usr/bin/env bash
# Beleg-Check
#
# Dieses Repo behauptet an mehreren Stellen etwas über die eigene Arbeitsweise.
# Dieses Skript macht aus jeder Behauptung eine Zusage, die kaputtgehen kann.
#
# Es prüft absichtlich nur Existenz und einfache Struktur — keine Qualität.
# Ein Beleg, der fehlt, fällt hier auf. Ein Beleg, der schlecht ist, fällt im
# Review auf. Beides ist besser als eine Behauptung, die niemand prüft.

set -uo pipefail
cd "$(dirname "$0")/.."

fehler=0
ok=0

pruefe() {
  local beschreibung="$1"; shift
  if "$@" >/dev/null 2>&1; then
    printf '  ok    %s\n' "$beschreibung"
    ok=$((ok + 1))
  else
    printf '  FEHLT %s\n' "$beschreibung"
    fehler=$((fehler + 1))
  fi
}

datei() { [[ -f "$1" ]]; }
ordner_nicht_leer() { [[ -d "$1" ]] && [[ -n "$(ls -A "$1" 2>/dev/null)" ]]; }
enthaelt() { grep -q "$2" "$1" 2>/dev/null; }
enthaelt_nicht() { ! grep -q "$2" "$1" 2>/dev/null; }
enthaelt_nicht_rekursiv() { ! grep -rq "$2" "$1" 2>/dev/null; }
hoechstens_zeilen() { [[ "$(wc -l < "$1")" -le "$2" ]]; }
existiert() { [[ -e "$1" ]]; }
mindestens_dateien() { [[ "$(ls -1 "$1"/$2 2>/dev/null | wc -l)" -ge "$3" ]]; }

# Liefert alle Repo-Pfade aus der Belegspalte von docs/ANFORDERUNGEN.md, die
# unbedingt behauptet werden. Zeilen mit `offen`, `zu klären`, `teilweise
# belegbar` oder `nicht belegbar` nennen ein Ziel, keinen Beleg — die dürfen
# auf etwas zeigen, das es noch nicht gibt. `in Arbeit` und `belegt` müssen
# existieren.
behauptete_pfade() {
  grep '^|' docs/ANFORDERUNGEN.md \
    | grep -v '| offen |\|| zu klären |\|| teilweise belegbar |\|| nicht belegbar |' \
    | grep -oE '`[^`]+`' \
    | tr -d '`' \
    | grep -E '/|\.(md|yaml|yml|json|mjs|sh)$' \
    | grep -v '^/' \
    | grep -v '^POST ' \
    | sort -u
}

echo
echo "Beleg-Check"
echo "==========="
echo

echo "Schritt 1 — Anforderungen liegen vor dem Code"
pruefe "docs/ANFORDERUNGEN.md existiert" datei docs/ANFORDERUNGEN.md
pruefe "das Anforderungsprofil ist erfasst, sinngemäß statt wörtlich" enthaelt docs/ANFORDERUNGEN.md "nicht wörtlich zitiert"
pruefe "Must-haves sind erfasst (M1 bis M4)" enthaelt docs/ANFORDERUNGEN.md "| M4 |"
pruefe "die nicht belegbaren Punkte sind benannt" enthaelt docs/ANFORDERUNGEN.md "nicht belegbar"
pruefe "die Grenzen der Extraktion sind benannt (eine Layoutfamilie, synthetisch)" enthaelt docs/ANFORDERUNGEN.md "Layoutfamilie"
pruefe "docs/PRODUKT.md existiert" datei docs/PRODUKT.md

# Die Belegspalte ist der Ort, an dem sich das Mapping selbst überholen kann:
# Ein Pfad wird als Beleg eingetragen, die Datei entsteht nie.
while read -r pfad; do
  [[ -n "$pfad" ]] || continue
  pruefe "Beleg $pfad existiert" existiert "$pfad"
done <<< "$(behauptete_pfade)"

echo
echo "Schritt 2 — Entscheidungen sind dokumentiert"
pruefe "DECISIONS.md existiert" datei DECISIONS.md
pruefe "mindestens eine ADR existiert" ordner_nicht_leer docs/adr
for adr in docs/adr/ADR-*.md; do
  [[ -e "$adr" ]] || continue
  pruefe "$(basename "$adr"): Abschnitt 'Wann wir anders entscheiden würden'" enthaelt "$adr" "Wann wir anders entscheiden"
  pruefe "$(basename "$adr"): Abschnitt 'Optionen'" enthaelt "$adr" "## Optionen"
  pruefe "$(basename "$adr"): Abschnitt 'Konsequenzen'" enthaelt "$adr" "## Konsequenzen"
  pruefe "$(basename "$adr"): in DECISIONS.md verlinkt" enthaelt DECISIONS.md "$(basename "$adr")"
done

echo
echo "Schritt 3 — Regeln und Skills liegen im Repo, nicht global"
pruefe "CLAUDE.md existiert" datei CLAUDE.md
pruefe "CLAUDE.md bleibt auf einer Bildschirmseite (max. 60 Zeilen)" hoechstens_zeilen CLAUDE.md 60
for skill in zoll-domain n8n-code-nodes adr extraktion oberflaeche; do
  pruefe "Skill $skill hat eine SKILL.md" datei ".claude/skills/$skill/SKILL.md"
  pruefe "Skill $skill steht in CLAUDE.md" enthaelt CLAUDE.md "\`$skill\`"
done
for command in regel adr akte-pruefen anforderungs-mapping; do
  pruefe "Command /$command liegt im Repo" datei ".claude/commands/$command.md"
done
pruefe "Subagents liegen im Repo" ordner_nicht_leer .claude/agents
pruefe "Claude-Hook ist verdrahtet" enthaelt .claude/settings.json "prosa-nach-schreiben"
pruefe "Claude-Hook liegt im Repo" datei .claude/hooks/prosa-nach-schreiben.mjs

echo
echo "Schritt 4 — die Gates laufen auch vor dem Commit"
pruefe "Git-Hook liegt im Repo" datei .githooks/pre-commit
pruefe "Einrichtung ist mitgeliefert" datei scripts/hooks-installieren.sh
pruefe "Prosa-Check liegt im Repo" datei scripts/prosa-check.mjs
pruefe "Verweis-Check liegt im Repo" datei scripts/link-check.mjs
pruefe "Regel-Check liegt im Repo" datei scripts/regel-check.mjs
pruefe "Regel-Check hat eine Testsuite" datei scripts/regel-check.test.mjs
pruefe "Fixture: nackte Zahl" datei scripts/fixtures/regel-check/NackteZahl.mjs
pruefe "Fixture: nur Literale" datei scripts/fixtures/regel-check/NurLiterale.mjs
pruefe "Fixture: die erlaubte Lücke 0/1/2" datei scripts/fixtures/regel-check/NullEinsZwei.mjs
pruefe "Workflow-Check liegt im Repo" datei scripts/workflow-check.mjs
pruefe "Kontrast-Check liegt im Repo" datei scripts/kontrast-check.mjs
pruefe "Kontrast-Check hat eine Testsuite" datei scripts/kontrast-check.test.mjs
pruefe "docs/PIPELINE.md existiert" datei docs/PIPELINE.md
pruefe "PIPELINE.md sagt, was nicht geprüft wird" enthaelt docs/PIPELINE.md "## Was die Pipeline nicht prüft"
pruefe "CI existiert" datei .github/workflows/ci.yml
for job in belege dokumente regeln tests workflows extraktion oberflaeche betrieb; do
  pruefe "CI hat den Job $job" enthaelt .github/workflows/ci.yml "  $job:"
done

echo
echo "Die vier Regeln aus CLAUDE.md haben ein Gegenstück"
# Regel 1: Nachweis statt Dokument
pruefe "Pflichtmatrix trennt required_data / required_evidence / required_document_form" enthaelt pflichtmatrix.yaml "required_document_form"
pruefe "Pflichtmatrix wird geprüft" datei tests/pflichtmatrix.test.mjs
# Regel 2: Rohwert und Aktenwert getrennt
pruefe "Aktenaufbau lässt nur finale Belege zu Fakten werden" enthaelt src/akte/aufbau.mjs "DOKUMENT_FINAL"
pruefe "Assertion und Fakt sind getrennte Tabellen" enthaelt deploy/postgres/init.sql "CREATE TABLE canonical_fact"
pruefe "ADR-001 begründet die Trennung" datei docs/adr/ADR-001-akte-statt-dokument.md
# Regel 3: Regeln sind Daten
pruefe "Regelkatalog existiert" datei rules.yaml
pruefe "Katalog trägt valid_from" enthaelt rules.yaml "valid_from:"
pruefe "Katalog trägt den Verifikationsstand" enthaelt rules.yaml "legal_source:"
pruefe "ADR-002 begründet das Gate" datei docs/adr/ADR-002-regeln-sind-daten.md
# Regel 4: Kein Modell in der Entscheidung
pruefe "Regelwerk importiert kein Modell und keinen HTTP-Client" enthaelt_nicht src/regelwerk.mjs "fetch\|openai\|anthropic\|http"
pruefe "Konfidenzschwelle steht im Katalog" enthaelt rules.yaml "low_confidence_below"
pruefe "Lesefehler vor Fachfehler ist getestet" enthaelt tests/regeln/TRN-02.test.mjs "re_extraction_required"
pruefe "ADR-003 begründet die Grenze" datei docs/adr/ADR-003-kein-modell-in-der-entscheidung.md

echo
echo "Stufe 1 — der Kern"
pruefe "Regelregister existiert" datei src/regeln/index.mjs
pruefe "Container-Prüfziffer gegen Referenzwert des Standards" enthaelt tests/validatoren/container.test.mjs "CSQU3054383"
pruefe "USt-IdNr. gegen externes Beispiel" enthaelt tests/validatoren/kennungen.test.mjs "DE136695976"
pruefe "Nachforderung nennt Feld, Grund, Nachweise, Folge" enthaelt src/nachforderung.mjs "Akzeptierte Nachweise"
pruefe "Zuständigkeiten sind Daten" datei zustaendigkeiten.yaml
pruefe "Testakten werden erzeugt, nicht gesammelt" datei testdaten/erzeuge-akten.mjs
pruefe "mindestens sechs Testakten" mindestens_dateien testdaten/akten "*.json" 6
pruefe "Testakten tragen ihre Erwartung" enthaelt testdaten/akten/happy-path.json '"erwartung"'
pruefe "Testakten sind synthetisch markiert" enthaelt testdaten/akten/happy-path.json "sha256:synthetisch-"
pruefe "CLI existiert" datei src/cli.mjs

echo
echo "n8n — Workflow ist Artefakt, src/ ist Quelle (ADR-004)"
pruefe "ADR-004 existiert" datei docs/adr/ADR-004-n8n-orchestriert-src-entscheidet.md
pruefe "Bündler existiert" datei scripts/n8n-bundle.mjs
pruefe "Prüf-Workflow existiert" datei workflows/zollpilot-akte-pruefen.json
pruefe "Fehler-Workflow existiert" datei workflows/zollpilot-fehler.json
pruefe "Code-Node ist generiert, nicht von Hand" enthaelt workflows/zollpilot-akte-pruefen.json "GENERIERT von scripts/n8n-bundle.mjs"
pruefe "Prüf-Workflow nennt den Fehler-Workflow" enthaelt workflows/zollpilot-akte-pruefen.json '"errorWorkflow": "zollpilot-fehler"'
pruefe "Alarm-Mail ist bewusst deaktiviert, nicht vergessen" enthaelt workflows/zollpilot-alarm.json "Absichtlich deaktiviert"
pruefe "Ein gescheiterter Lauf antwortet, statt 200 mit leerem Rumpf zu liefern" enthaelt workflows/zollpilot-akte-pruefen.json "Antwort: Lauf gescheitert"
pruefe "Der Fehlerzweig haelt den Fehler selbst fest" enthaelt workflows/zollpilot-akte-pruefen.json "Fehler festhalten"
pruefe "Der Rauchtest prueft den gescheiterten Lauf mit" enthaelt scripts/rauchtest.sh "Runde 5"
pruefe "Metriken zaehlen Ausfuehrungen, nicht nur Prozessdaten" enthaelt compose.yml "N8N_METRICS_INCLUDE_MESSAGE_EVENT_BUS_METRICS"

echo
echo "Stufe 3 — Extraktion: OCR mit Koordinaten vor Vision-Modell (ADR-005)"
pruefe "ADR-005 existiert" datei docs/adr/ADR-005-extraktion-ocr-vor-modell.md
pruefe "Python-Projekt mit festgeschriebenen Abhängigkeiten" datei extraktion/uv.lock
pruefe "Schicht Lesen liefert Konfidenz je Wort" enthaelt extraktion/zollpilot_extraktion/lesen.py "konfidenz=konf"
pruefe "Schicht Klassifikation verwirft nichts" enthaelt extraktion/zollpilot_extraktion/klassifikation.py "TYP_UNCLASSIFIED"
pruefe "Jede Assertion trägt Fundstelle und Methode" enthaelt extraktion/zollpilot_extraktion/assertion.py "bbox"
pruefe "Die Extraktion entscheidet nichts: kein Katalog, keine Regel" enthaelt_nicht extraktion/zollpilot_extraktion/akte.py "rules.yaml\|freigabe"
pruefe "Kein Modellaufruf in der Extraktion" enthaelt_nicht_rekursiv extraktion/zollpilot_extraktion "openai\|anthropic\|gemini\|vision_llm("
pruefe "Extraktion hat eine Testsuite" ordner_nicht_leer extraktion/tests
pruefe "Belege werden erzeugt, nicht gesammelt" datei testdaten/erzeuge-belege.py
pruefe "mindestens sechs Belegordner" mindestens_dateien testdaten/belege "*/akte.json" 6
pruefe "Belegordner tragen die erwarteten Assertions" datei testdaten/belege/happy-path/erwartet.json
pruefe "Basislinie der Bewertung liegt im Repo" datei extraktion/basislinie.json
pruefe "Bewertung meldet eine fehlende Basislinie" enthaelt extraktion/zollpilot_extraktion/bewertung.py "KEINE BASISLINIE"
pruefe "Dockerfile existiert" datei extraktion/Dockerfile
pruefe "Dienst in Compose" enthaelt compose.yml "  extraktion:"
pruefe "Workflow hat den Belege-Eingang" enthaelt workflows/zollpilot-akte-pruefen.json '"path": "belege"'
pruefe "Workflow ruft den Dienst über den eigenen Node, entscheidet nicht selbst" enthaelt workflows/zollpilot-akte-pruefen.json "CUSTOM.zollPilotExtraktion"
pruefe "Adresse des Dienstes steht in der Credential, nicht im Workflow" enthaelt deploy/n8n/credentials.json "extraktion:8080"
pruefe "Rauchtest schickt PDFs" enthaelt scripts/rauchtest.sh "webhook/belege"
pruefe "docs/EXTRAKTION.md existiert" datei docs/EXTRAKTION.md
pruefe "EXTRAKTION.md sagt, was die Messung nicht misst" enthaelt docs/EXTRAKTION.md "## Was die Messung nicht misst"

echo
echo "Stufe 4 — die Oberfläche: barrierefrei geprüft, nicht behauptet (ADR-006)"
pruefe "ADR-006 existiert" datei docs/adr/ADR-006-oberflaeche-angular-gleiche-herkunft.md
pruefe "Angular-Projekt existiert" datei oberflaeche/angular.json
pruefe "TypeScript laeuft strikt" enthaelt oberflaeche/tsconfig.json '"strict": true'
pruefe "Zustand mit ngrx, nicht in der Komponente" datei oberflaeche/src/app/akte/akte.reducer.ts
pruefe "Dateien liegen nicht im Store" enthaelt oberflaeche/src/app/app.config.ts "strictStateSerializability"
pruefe "Die Oberfläche kennt keine Fachregel" enthaelt_nicht_rekursiv oberflaeche/src "rules.yaml\\|low_confidence_below"
pruefe "422 wird als Ergebnis behandelt, nicht als Fehler" enthaelt oberflaeche/src/app/akte/akte.dienst.spec.ts "behandelt 422 als Ergebnis"
pruefe "Gestaltungstoken erklären ihren Kontrast" enthaelt oberflaeche/src/styles.css "@kontrast"
pruefe "axe läuft über jede Ansicht" enthaelt oberflaeche/e2e/barrierefreiheit.spec.ts "AxeBuilder"
pruefe "Tastaturbedienung ist geprüft" enthaelt oberflaeche/e2e/barrierefreiheit.spec.ts "ohne Zeigegerät"
pruefe "nginx-Konfiguration liegt im Repo" datei deploy/nginx/zollpilot.conf
pruefe "Gleiche Herkunft statt CORS" enthaelt deploy/nginx/zollpilot.conf "proxy_pass http://n8n:5678/webhook/"
pruefe "Oberfläche in Compose" enthaelt compose.yml "  oberflaeche:"
pruefe "Rauchtest prüft die Oberfläche" enthaelt scripts/rauchtest.sh "Proxy der Oberfläche"
pruefe "docs/OBERFLAECHE.md existiert" datei docs/OBERFLAECHE.md
pruefe "OBERFLAECHE.md sagt, was sie nicht kann" enthaelt docs/OBERFLAECHE.md "## Was sie nicht kann"

echo
echo "Betrieb — angewendet, nicht als Beispiel abgelegt"
pruefe "Ein Befehl für alles" datei compose.yml
pruefe "Healthcheck für n8n" enthaelt compose.yml "/healthz"
pruefe "Import läuft im Stack, nicht von Hand" enthaelt compose.yml "n8n import:workflow"
pruefe "Metriken sind eingeschaltet" enthaelt compose.yml "N8N_METRICS"
pruefe "Schema liegt im Repo" datei deploy/postgres/init.sql
pruefe "Fehlertabelle existiert" enthaelt deploy/postgres/init.sql "CREATE TABLE workflow_fehler"
pruefe "Rauchtest existiert" datei scripts/rauchtest.sh
pruefe "Rauchtest läuft in der CI" enthaelt .github/workflows/ci.yml "scripts/rauchtest.sh"
pruefe "Übergabe an Betrieb existiert" datei docs/BETRIEB.md
pruefe "BETRIEB.md sagt, was fehlt" enthaelt docs/BETRIEB.md "## Was vor einem echten Betrieb fehlt"
pruefe "Beispiel-Umgebung ohne echte Geheimnisse" datei .env.example
pruefe ".env ist ignoriert" enthaelt .gitignore "^.env$"

echo
echo "Node-Entwicklung — ein eigener Node, gebaut und geprüft"
pruefe "Paket existiert" datei nodes/n8n-nodes-zollpilot/package.json
pruefe "Node-Quelle in TypeScript" datei nodes/n8n-nodes-zollpilot/nodes/ZollPilotExtraktion/ZollPilotExtraktion.node.ts
pruefe "Credential-Typ in TypeScript" datei nodes/n8n-nodes-zollpilot/credentials/ZollPilotExtraktionApi.credentials.ts
pruefe "Gebauter Node liegt im Repo (compose.yml hängt ihn ein)" datei nodes/n8n-nodes-zollpilot/dist/nodes/ZollPilotExtraktion/ZollPilotExtraktion.node.js
pruefe "Node hat eine Testsuite ohne n8n" datei nodes/n8n-nodes-zollpilot/test/ZollPilotExtraktion.test.mjs
pruefe "Node trägt keinen Fachparameter" enthaelt nodes/n8n-nodes-zollpilot/test/ZollPilotExtraktion.test.mjs "gehört nicht in den Node"
pruefe "n8n lädt das Erweiterungsverzeichnis" enthaelt compose.yml "N8N_CUSTOM_EXTENSIONS"
pruefe "CI baut den Node aus den Quellen nach" enthaelt .github/workflows/ci.yml "n8n-nodes-zollpilot"

echo
echo "Monitoring — abgeholt, nicht nur angeboten"
pruefe "Prometheus-Konfiguration liegt im Repo" datei deploy/prometheus/prometheus.yml
pruefe "Alarmregeln liegen im Repo" datei deploy/prometheus/alarme.yml
pruefe "Alertmanager liefert an n8n" enthaelt deploy/alertmanager/alertmanager.yml "webhook/alarm"
pruefe "Fachliche Zähler kommen aus der Prüftabelle" enthaelt deploy/sql-exporter/zollpilot.collector.yml "zollpilot_befunde_total"
pruefe "Dashboard ist provisioniert, nicht geklickt" datei deploy/grafana/dashboards/zollpilot.json
pruefe "Extraktion bietet /metrics an" enthaelt extraktion/zollpilot_extraktion/dienst.py "generate_latest"
pruefe "Metriken der Extraktion sind getestet" enthaelt extraktion/tests/test_dienst.py "zollpilot_extraktion_dokumente_total"
pruefe "Alle vier Dienste in Compose" enthaelt compose.yml "  grafana:"
pruefe "Alarm-Workflow existiert" datei workflows/zollpilot-alarm.json
pruefe "Wiederholungs-Workflow existiert" datei workflows/zollpilot-wiederholen.json
pruefe "Fehlerzweig legt die Wiedervorlage ab" enthaelt workflows/zollpilot-akte-pruefen.json "Wiedervorlage ablegen"
pruefe "Tabellen wiedervorlage und alarm im Schema" enthaelt deploy/postgres/init.sql "CREATE TABLE alarm"
pruefe "Rauchtest wiederholt einen gescheiterten Lauf" enthaelt scripts/rauchtest.sh "Runde 6"
pruefe "Rauchtest fragt das Monitoring" enthaelt scripts/rauchtest.sh "Runde 7"
pruefe "Wiedervorlage ist im Datenschutz benannt" enthaelt docs/DATENSCHUTZ.md "wiedervorlage.nutzlast"
# Jeder Alarm braucht einen Handgriff: Der Name aus alarme.yml muss in der
# Betriebsdoku stehen. Ein Alarm ohne Runbook ist Lärm.
for alarm in $(grep -oE '^\s*- alert: [A-Za-z0-9]+' deploy/prometheus/alarme.yml | awk '{print $3}'); do
  pruefe "Runbook für $alarm in BETRIEB.md" enthaelt docs/BETRIEB.md "$alarm"
done

echo
echo "Stufe 6 — die Akte lebt: Nachforderung als Vorgang (ADR-009)"
pruefe "ADR-009 existiert" datei docs/adr/ADR-009-die-akte-lebt.md
pruefe "Stufen tragen bezug und vorlauf, keine Kalendertage" enthaelt zustaendigkeiten.yaml "vorlauf_stunden:"
pruefe "Verteiler ist Daten, als Demo markiert" enthaelt zustaendigkeiten.yaml "verteiler:"
pruefe "Abgleich ist eine reine Funktion" datei src/nachforderung/abgleich.mjs
pruefe "Stufe ist eine reine Funktion ohne Uhr" enthaelt_nicht src/nachforderung/stufe.mjs "new Date()"
pruefe "Abgleich und Stufe sind getestet" datei tests/nachforderung/stufe.test.mjs
pruefe "Nachforderungs-Workflow existiert" datei workflows/zollpilot-nachforderung.json
pruefe "Workflow entscheidet im Bundle aus src/" enthaelt workflows/zollpilot-nachforderung.json "GENERIERT von scripts/n8n-bundle.mjs"
pruefe "Workflow versendet wirklich (SMTP an GreenMail)" enthaelt workflows/zollpilot-nachforderung.json '"type": "n8n-nodes-base.emailSend"'
pruefe "Versand wird festgehalten" enthaelt deploy/postgres/init.sql "CREATE TABLE request_versand"
pruefe "Postfach im Stack" enthaelt compose.yml "  greenmail:"
pruefe "Rauchtest spielt den Vorgang durch" enthaelt scripts/rauchtest.sh "Runde 8"
pruefe "Die Oberfläche verlangt eine Anmeldung" enthaelt deploy/nginx/zollpilot.conf "auth_basic_user_file"
pruefe "Passwortdatei liegt im Repo (Demo-Werte)" datei deploy/nginx/zollpilot.htpasswd
pruefe "Der geprüfte Name geht als Header an n8n" enthaelt deploy/nginx/zollpilot.conf "X-Benutzer"
pruefe "Der Befund sagt, woher der Name stammt" enthaelt src/override.mjs "uebersteuert_identitaet"
pruefe "Rauchtest prüft Anmeldung und Herkunft des Namens" enthaelt scripts/rauchtest.sh "Identität des Übersteuernden"

echo
echo "Prozessdokumentation — Landschaft, Datenfluss, Handbuch"
pruefe "Prozesslandschaft und Datenfluss liegen im Repo" datei docs/prozess/README.md
pruefe "Prozesslandschaft ist gerendert (Mermaid), nicht nur beschrieben" enthaelt docs/prozess/README.md '```mermaid'
pruefe "Prozesslandschaft sagt, was vorgesehen und nicht gebaut ist" enthaelt docs/prozess/README.md "vorgesehen"
pruefe "Dieselbe Landschaft als BPMN 2.0" datei docs/prozess/sendungsakte.bpmn
pruefe "BPMN trägt Lanes und Layout" enthaelt docs/prozess/sendungsakte.bpmn "BPNMShape\|BPMNShape"
pruefe "Betriebshandbuch hat je Alarm einen Handgriff" enthaelt docs/BETRIEB.md "## Alarme"

echo
echo "Schritt 6 — der KI-Einsatz wird protokolliert"
pruefe "docs/ENTWICKLUNGSLOG.md existiert" datei docs/ENTWICKLUNGSLOG.md
pruefe "das Log hat das Pflichtfeld 'Was nicht funktionierte'" enthaelt docs/ENTWICKLUNGSLOG.md "Was nicht funktionierte"
pruefe "docs/OFFENE-PUNKTE.md existiert" datei docs/OFFENE-PUNKTE.md
pruefe "der Bauplan liegt im Repo" datei docs/ARBEITSWEISE.md

echo
echo "Datenschutz"
pruefe "docs/DATENSCHUTZ.md existiert" datei docs/DATENSCHUTZ.md
pruefe "Fehler-Workflow protokolliert keine Nutzdaten" enthaelt workflows/zollpilot-fehler.json "Keine Nutzdaten der"
pruefe "Ausführungsdaten werden gelöscht" enthaelt compose.yml "EXECUTIONS_DATA_MAX_AGE"

echo
echo "-----------"
printf '%d Belege vorhanden, %d fehlen.\n' "$ok" "$fehler"
echo

if [[ "$fehler" -gt 0 ]]; then
  cat <<'HINWEIS'
Ein Beleg fehlt. Das ist der Sinn dieses Jobs: Dieses Repo behauptet eine
Arbeitsweise, und die Behauptung soll kaputtgehen, wenn sie nicht mehr stimmt.

Entweder den Beleg nachliefern — oder die Behauptung streichen.
HINWEIS
  exit 1
fi

echo "Alle Belege vorhanden."
