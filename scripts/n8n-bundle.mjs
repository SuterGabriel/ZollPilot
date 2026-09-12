#!/usr/bin/env node
// n8n-Bundle
//
// Der Code-Node in n8n hat kein Dateisystem und keine Module. Damit das
// Regelwerk trotzdem nur einmal existiert, wird src/ hier zu einem einzigen
// Skript gebündelt und in Code-Nodes der Workflows geschrieben. Der Katalog
// (`rules.yaml`, `pflichtmatrix.yaml`, `zustaendigkeiten.yaml`) wird als JSON
// eingebettet.
//
// Zwei Ziele (ADR-004, ADR-009):
//   „Akte prüfen“ in `zollpilot-akte-pruefen.json`: das ganze Regelwerk.
//   „Nachforderungen entscheiden“ und „Versand planen“ in
//   `zollpilot-nachforderung.json`: Abgleich und Eskalationsstufe, derselbe
//   Code in zwei Nodes, weil der Workflow dazwischen liest und schreibt.
//
// Quelle der Wahrheit bleibt src/ und die YAML-Dateien. Der Workflow ist ein
// Build-Artefakt, das mit committet wird, damit ein Import ohne Build geht.
// `--check` stellt in Hook und CI sicher, dass es nicht veraltet ist.
//
// Aufruf:
//   node scripts/n8n-bundle.mjs           schreibt die Workflows neu
//   node scripts/n8n-bundle.mjs --check   nur vergleichen, Exit 1 wenn veraltet

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parse } from 'yaml';

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..');

// Reihenfolge ist Abhängigkeitsreihenfolge: Ein Modul darf nur nutzen, was
// über ihm steht. src/katalog.mjs und src/cli.mjs sind bewusst nicht dabei.
const MODULE_REGELWERK = [
  'src/normalisierung.mjs',
  'src/validatoren/container.mjs',
  'src/validatoren/awb.mjs',
  'src/validatoren/ustid.mjs',
  'src/validatoren/formate.mjs',
  'src/akte/aufbau.mjs',
  'src/regeln/befund.mjs',
  'src/regeln/VAL-01.mjs',
  'src/regeln/VAL-03.mjs',
  'src/regeln/ORG-02.mjs',
  'src/regeln/ORG-03.mjs',
  'src/regeln/ORG-06.mjs',
  'src/regeln/CLS-01.mjs',
  'src/regeln/CLS-02.mjs',
  'src/regeln/QTY-01.mjs',
  'src/regeln/QTY-02.mjs',
  'src/regeln/QTY-03.mjs',
  'src/regeln/TRN-01.mjs',
  'src/regeln/TRN-02.mjs',
  'src/regeln/REF-03.mjs',
  'src/regeln/CUS-05.mjs',
  'src/regeln/index.mjs',
  'src/pflichtmatrix.mjs',
  'src/override.mjs',
  'src/nachforderung.mjs',
  'src/regelwerk.mjs',
];

const MODULE_NACHFORDERUNG = [
  'src/nachforderung/abgleich.mjs',
  'src/nachforderung/stufe.mjs',
];

const EINSTIEG_REGELWERK = [
  '// ---- n8n-Einstieg ----',
  '// Der Webhook liefert { headers, params, query, body }; ein Vorgänger-Node kann',
  '// die Akte auch direkt als json liefern.',
  'const roh = $input.first().json;',
  'const eingang = roh.body ?? roh;',
  '',
  '// Identität (ADR-009): Hinter dem Proxy kommt der geprüfte Benutzername als',
  '// Header X-Benutzer und ersetzt den getippten Namen jeder Übersteuerung.',
  '// Ohne Proxy bleibt der Name eine Angabe, und der Befund sagt das. Das ist',
  '// Transport: Wer angemeldet ist, weiß nur diese Schicht.',
  "const kopf = roh.headers ?? {};",
  "const benutzerGeprueft = kopf['x-benutzer'] || kopf['X-Benutzer'] || null;",
  'if (Array.isArray(eingang.overrides)) {',
  "  eingang.overrides = eingang.overrides.map((o) => ({ ...o, benutzer: benutzerGeprueft ?? o.benutzer, identitaet: benutzerGeprueft ? 'proxy' : 'angegeben' }));",
  '}',
  'const ergebnis = pruefeAkte(eingang, KATALOG, REGELN);',
  '',
  '// Die Ausführungs-ID gehört nicht in die Entscheidung, sondern an sie:',
  '// Mit ihr findet der Betrieb die Ausführung in n8n wieder, mit Eingabe und',
  '// Ausgabe je Node. Sie entsteht im Transport und wird deshalb hier',
  '// angehängt, nicht in src/regelwerk.mjs (ADR-004).',
  "ergebnis.ausfuehrung = typeof $execution === 'undefined' ? null : ($execution.id ?? null);",
  'return [{ json: ergebnis }];',
];

const EINSTIEG_NACHFORDERUNG = [
  '// ---- n8n-Einstieg ----',
  '// Ein Item je Akte, zwei Phasen desselben Codes (ADR-009):',
  '//   phase "abgleichen": { akte_id, nachforderungen, offene, jetzt? }',
  '//     → was eröffnet, behalten, erledigt wird',
  '//   phase "planen":     { akte_id, fristen, faelle, jetzt? }',
  '//     → je Fall die fällige Stufe mit Adresse oder der Grund, warum nicht',
  '// Der Zeitpunkt kommt aus dem Item (Rauchtest, Betrieb) oder aus dem',
  '// Transport; in src/ gibt es keine Uhr.',
  'return $input.all().map((item) => {',
  '  const e = item.json;',
  "  const jetzt = e.jetzt ?? new Date().toISOString();",
  "  if (e.phase === 'planen') {",
  '    const geplant = planeVersand(e.faelle ?? [], e.fristen ?? {}, KATALOG.zustaendigkeiten, jetzt);',
  "    return { json: { akte_id: e.akte_id, jetzt, phase: 'planen', versenden: geplant.filter((f) => f.versand.faellig), wartend: geplant.filter((f) => !f.versand.faellig) } };",
  '  }',
  '  const { eroeffnen, behalten, schliessen } = gleicheAb(e.offene ?? [], e.nachforderungen ?? [], jetzt);',
  "  return { json: { akte_id: e.akte_id, pruefung_id: e.pruefung_id ?? null, fristen: e.fristen ?? {}, jetzt, phase: 'abgleichen', eroeffnen, behalten, schliessen } };",
  '});',
];

const ZIELE = [
  {
    workflow: 'workflows/zollpilot-akte-pruefen.json',
    nodes: ['Akte prüfen'],
    module: MODULE_REGELWERK,
    katalog: ['regeln', 'pflichtmatrix', 'zustaendigkeiten'],
    einstieg: EINSTIEG_REGELWERK,
  },
  {
    workflow: 'workflows/zollpilot-nachforderung.json',
    nodes: ['Nachforderungen entscheiden', 'Versand planen'],
    module: MODULE_NACHFORDERUNG,
    katalog: ['zustaendigkeiten'],
    einstieg: EINSTIEG_NACHFORDERUNG,
  },
];

/** ESM-Syntax entfernen: Imports fallen weg, `export` wird zur normalen Deklaration. */
export function entmodularisiere(quelltext, pfad) {
  return quelltext
    .replace(/^import\s[^;]*;\s*$/gm, '')
    .replace(/^export\s*\{[^}]*\};\s*$/gm, '')
    .replace(/^export\s+(const|function|let|class)\b/gm, '$1')
    .replace(/^#!.*$/m, '')
    .replace(/^/, `// ---- ${pfad} ----\n`);
}

const KATALOGDATEIEN = { regeln: 'rules.yaml', pflichtmatrix: 'pflichtmatrix.yaml', zustaendigkeiten: 'zustaendigkeiten.yaml' };

export function erzeugeCode(ziel = ZIELE[0]) {
  const lies = (p) => readFileSync(join(wurzel, p), 'utf8');
  const katalog = Object.fromEntries(ziel.katalog.map((k) => [k, parse(lies(KATALOGDATEIEN[k]))]));
  const regeln = parse(lies(KATALOGDATEIEN.regeln));
  const module = ziel.module.map((p) => entmodularisiere(lies(p), p)).join('\n');
  return [
    '// GENERIERT von scripts/n8n-bundle.mjs — nicht von Hand ändern.',
    `// Quelle: ${ziel.module.length} Module aus src/ und ${ziel.katalog.map((k) => KATALOGDATEIEN[k]).join(', ')}.`,
    `// Katalogversion ${regeln.catalog.version}, gültig ab ${regeln.catalog.valid_from}.`,
    '',
    `const KATALOG = ${JSON.stringify(katalog)};`,
    '',
    module,
    '',
    ...ziel.einstieg,
    '',
  ].join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const nurPruefen = process.argv.includes('--check');
  let veraltet = 0;
  for (const ziel of ZIELE) {
    const pfad = join(wurzel, ziel.workflow);
    const workflow = JSON.parse(readFileSync(pfad, 'utf8'));
    const code = erzeugeCode(ziel);
    let geschrieben = false;
    for (const name of ziel.nodes) {
      const node = workflow.nodes.find((n) => n.name === name);
      if (!node) {
        console.error(`Node "${name}" nicht in ${ziel.workflow}`);
        process.exit(1);
      }
      if (nurPruefen) {
        if (node.parameters.jsCode === code) {
          console.log(`Bundle ist aktuell (${code.length} Zeichen im Node "${name}").`);
        } else {
          console.error(`Der Code-Node "${name}" in ${ziel.workflow} ist veraltet. src/ oder der Katalog haben sich geändert: npm run bundle`);
          veraltet += 1;
        }
        continue;
      }
      node.parameters.jsCode = code;
      geschrieben = true;
      console.log(`Workflow geschrieben: ${code.length} Zeichen im Node "${name}".`);
    }
    if (geschrieben) writeFileSync(pfad, `${JSON.stringify(workflow, null, 2)}\n`);
  }
  process.exit(veraltet > 0 ? 1 : 0);
}
