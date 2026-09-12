#!/usr/bin/env node
// n8n-Bundle
//
// Der Code-Node in n8n hat kein Dateisystem und keine Module. Damit das
// Regelwerk trotzdem nur einmal existiert, wird src/ hier zu einem einzigen
// Skript gebündelt und in den Code-Node "Akte prüfen" des Workflows
// geschrieben. Der Katalog (`rules.yaml`, `pflichtmatrix.yaml`,
// `zustaendigkeiten.yaml`) wird als JSON eingebettet.
//
// Quelle der Wahrheit bleibt src/ und die YAML-Dateien. Der Workflow ist ein
// Build-Artefakt, das mit committet wird, damit ein Import ohne Build geht.
// `--check` stellt in Hook und CI sicher, dass es nicht veraltet ist
// (ADR-004).
//
// Aufruf:
//   node scripts/n8n-bundle.mjs           schreibt den Workflow neu
//   node scripts/n8n-bundle.mjs --check   nur vergleichen, Exit 1 wenn veraltet

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parse } from 'yaml';

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOW = join(wurzel, 'workflows', 'zollpilot-akte-pruefen.json');
const NODE_NAME = 'Akte prüfen';

// Reihenfolge ist Abhängigkeitsreihenfolge: Ein Modul darf nur nutzen, was
// über ihm steht. src/katalog.mjs und src/cli.mjs sind bewusst nicht dabei.
const MODULE = [
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

/** ESM-Syntax entfernen: Imports fallen weg, `export` wird zur normalen Deklaration. */
export function entmodularisiere(quelltext, pfad) {
  return quelltext
    .replace(/^import\s[^;]*;\s*$/gm, '')
    .replace(/^export\s*\{[^}]*\};\s*$/gm, '')
    .replace(/^export\s+(const|function|let|class)\b/gm, '$1')
    .replace(/^#!.*$/m, '')
    .replace(/^/, `// ---- ${pfad} ----\n`);
}

export function erzeugeCode() {
  const lies = (p) => readFileSync(join(wurzel, p), 'utf8');
  const katalog = {
    regeln: parse(lies('rules.yaml')),
    pflichtmatrix: parse(lies('pflichtmatrix.yaml')),
    zustaendigkeiten: parse(lies('zustaendigkeiten.yaml')),
  };
  const module = MODULE.map((p) => entmodularisiere(lies(p), p)).join('\n');
  return [
    '// GENERIERT von scripts/n8n-bundle.mjs — nicht von Hand ändern.',
    '// Quelle: src/ und rules.yaml, pflichtmatrix.yaml, zustaendigkeiten.yaml.',
    `// Katalogversion ${katalog.regeln.catalog.version}, gültig ab ${katalog.regeln.catalog.valid_from}.`,
    '',
    `const KATALOG = ${JSON.stringify(katalog)};`,
    '',
    module,
    '',
    '// ---- n8n-Einstieg ----',
    '// Der Webhook liefert { headers, params, query, body }; ein Vorgänger-Node kann',
    '// die Akte auch direkt als json liefern.',
    'const eingang = $input.first().json.body ?? $input.first().json;',
    'const ergebnis = pruefeAkte(eingang, KATALOG, REGELN);',
    '',
    '// Die Ausführungs-ID gehört nicht in die Entscheidung, sondern an sie:',
    '// Mit ihr findet der Betrieb die Ausführung in n8n wieder, mit Eingabe und',
    '// Ausgabe je Node. Sie entsteht im Transport und wird deshalb hier',
    '// angehängt, nicht in src/regelwerk.mjs (ADR-004).',
    "ergebnis.ausfuehrung = typeof $execution === 'undefined' ? null : ($execution.id ?? null);",
    'return [{ json: ergebnis }];',
    '',
  ].join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const nurPruefen = process.argv.includes('--check');
  const workflow = JSON.parse(readFileSync(WORKFLOW, 'utf8'));
  const node = workflow.nodes.find((n) => n.name === NODE_NAME);
  if (!node) {
    console.error(`Node "${NODE_NAME}" nicht in ${WORKFLOW}`);
    process.exit(1);
  }
  const code = erzeugeCode();
  if (nurPruefen) {
    if (node.parameters.jsCode === code) {
      console.log(`Bundle ist aktuell (${code.length} Zeichen im Node "${NODE_NAME}").`);
      process.exit(0);
    }
    console.error('Der Code-Node im Workflow ist veraltet. src/ oder der Katalog haben sich geändert: npm run bundle');
    process.exit(1);
  }
  node.parameters.jsCode = code;
  writeFileSync(WORKFLOW, `${JSON.stringify(workflow, null, 2)}\n`);
  console.log(`Workflow geschrieben: ${code.length} Zeichen im Node "${NODE_NAME}".`);
}
