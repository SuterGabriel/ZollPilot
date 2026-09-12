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
pruefe "die Ausschreibung ist wörtlich erfasst" enthaelt docs/ANFORDERUNGEN.md "produktive n8n"
pruefe "Must-haves sind erfasst (M1 bis M4)" enthaelt docs/ANFORDERUNGEN.md "| M4 |"
pruefe "die nicht belegbaren Punkte sind benannt" enthaelt docs/ANFORDERUNGEN.md "nicht belegbar"
pruefe "die Extraktion wird nicht als gebaut behauptet" enthaelt docs/ANFORDERUNGEN.md "noch nicht gebaut"
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
for skill in zoll-domain n8n-code-nodes adr; do
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
pruefe "docs/PIPELINE.md existiert" datei docs/PIPELINE.md
pruefe "PIPELINE.md sagt, was nicht geprüft wird" enthaelt docs/PIPELINE.md "## Was die Pipeline nicht prüft"
pruefe "CI existiert" datei .github/workflows/ci.yml
for job in belege dokumente regeln tests workflows betrieb; do
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
pruefe "E-Mail-Node ist bewusst deaktiviert, nicht vergessen" enthaelt workflows/zollpilot-akte-pruefen.json "Absichtlich deaktiviert"

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
