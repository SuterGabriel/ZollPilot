#!/usr/bin/env node
// Workflow-Check
//
// n8n meldet einen kaputten Workflow erst beim Import. Dieses Skript prüft
// vorher, was sich ohne n8n prüfen lässt: gültiges JSON, jeder Node hat Name,
// Typ, Version und Position, Namen sind eindeutig, jede Verbindung zeigt auf
// einen existierenden Node, kein Node trägt ein Geheimnis, und der gebündelte
// Code-Node lässt sich zumindest parsen.
//
// Dazu eine Frage an die Dokumentation: Zu jedem Workflow muss ein Bild in
// docs/bilder/ liegen (`node scripts/bilder-ziehen.mjs`). Sonst kommt ein
// achter Workflow dazu, die Doku zeigt weiter sieben, und niemand merkt es.
//
// Aufruf: node scripts/workflow-check.mjs

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..');
const ordner = join(wurzel, 'workflows');
const VERDAECHTIG = /(password|passwort|secret|api[_-]?key|token)["']?\s*:\s*["'][^"']{4,}/i;
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

let fehler = 0;
const melde = (datei, text) => { console.log(`  FEHLER ${datei}: ${text}`); fehler += 1; };

console.log('');
console.log('Workflow-Check');
console.log('==============');
console.log('');

const dateien = readdirSync(ordner).filter((d) => d.endsWith('.json'));
if (dateien.length === 0) {
  console.log('  FEHLER keine Workflows unter workflows/ — keine Grundlage, kein Erfolg');
  process.exit(1);
}

for (const datei of dateien) {
  let workflow;
  try {
    workflow = JSON.parse(readFileSync(join(ordner, datei), 'utf8'));
  } catch (e) {
    melde(datei, `kein gültiges JSON (${e.message})`);
    continue;
  }
  if (!workflow.name) melde(datei, 'name fehlt');
  if (!Array.isArray(workflow.nodes) || workflow.nodes.length === 0) {
    melde(datei, 'keine Nodes');
    continue;
  }
  const namen = new Set();
  for (const node of workflow.nodes) {
    for (const feld of ['name', 'type', 'typeVersion', 'position', 'parameters']) {
      if (node[feld] === undefined) melde(datei, `Node ${node.name ?? '?'}: ${feld} fehlt`);
    }
    if (namen.has(node.name)) melde(datei, `Node-Name doppelt: ${node.name}`);
    namen.add(node.name);
    const text = JSON.stringify(node.parameters ?? {});
    if (VERDAECHTIG.test(text)) melde(datei, `Node ${node.name}: sieht nach einem Geheimnis in den Parametern aus`);
    if (node.type === 'n8n-nodes-base.code' && node.parameters?.jsCode) {
      try {
        // Nur Syntax. $input und $json gibt es außerhalb von n8n nicht. Der
        // Code-Node läuft in n8n als async-Funktion; ein `await` auf oberster
        // Ebene ist dort erlaubt und muss hier parsen.
        new AsyncFunction('$input', '$json', '$', node.parameters.jsCode); // eslint-disable-line no-new-func
      } catch (e) {
        melde(datei, `Node ${node.name}: Code-Node parst nicht (${e.message})`);
      }
    }
  }
  for (const [von, ausgaenge] of Object.entries(workflow.connections ?? {})) {
    if (!namen.has(von)) melde(datei, `Verbindung von unbekanntem Node ${von}`);
    for (const liste of Object.values(ausgaenge)) {
      for (const ausgang of liste) {
        for (const ziel of ausgang ?? []) {
          if (!namen.has(ziel.node)) melde(datei, `Verbindung ${von} → unbekannter Node ${ziel.node}`);
        }
      }
    }
  }
  if (workflow.id && !existsSync(join(wurzel, 'docs', 'bilder', `workflow-${workflow.id}.png`))) {
    melde(datei, `kein Bild docs/bilder/workflow-${workflow.id}.png (node scripts/bilder-ziehen.mjs)`);
  }
  console.log(`  ok     ${datei}: ${workflow.nodes.length} Nodes, ${Object.keys(workflow.connections ?? {}).length} Verbindungsquellen`);
}

console.log('');
if (fehler > 0) {
  console.log(`${fehler} Fehler in ${dateien.length} Workflow-Dateien.`);
  process.exit(1);
}
console.log(`${dateien.length} Workflow-Dateien strukturell in Ordnung.`);
