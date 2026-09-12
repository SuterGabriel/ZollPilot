#!/usr/bin/env node
// Regel-Check
//
// Die Zusage aus CLAUDE.md lautet: Regeln sind Daten. Schwellen, Toleranzen und
// Rechtsverweise stehen in rules.yaml, nie als Konstante im Code. Dieses
// Skript macht daraus eine Prüfung, die rot wird:
//
//   1. Jede Regel im Katalog trägt die Pflichtfelder (id, name, hardness, risk,
//      inputs, assertion, legal_basis, legal_source, consequence, valid_from),
//      die ID ist eindeutig und die Wertebereiche stimmen.
//   2. Die in docs/03 mit [MVP] markierten Regeln sind genau die im Katalog —
//      in beide Richtungen. Sonst behauptet die Dokumentation etwas anderes
//      als der Katalog.
//   3. Zu jeder Katalogregel existiert src/regeln/<ID>.mjs und
//      tests/regeln/<ID>.test.mjs; und keine Regeldatei existiert ohne Katalog.
//   4. In src/regeln/ steht keine nackte Zahl außer 0, 1 und 2. Jede fachliche
//      Zahl kommt aus `parameters` oder `tolerance` der Regel.
//   5. Die Pflichtmatrix trägt je Eintrag required_data, required_evidence,
//      required_document_form, hardness, legal_basis, legal_source.
//
// Ein Prüfer, der keine Grundlage findet, meldet den Stand — nie Erfolg
// (docs/ARBEITSWEISE.md, Falle 2). Die Funktionen sind exportiert, damit
// scripts/regel-check.test.mjs sie mit Fixtures gegen die bekannten Lücken hält.
//
// Aufruf: node scripts/regel-check.mjs

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename } from 'node:path';
import { parse } from 'yaml';

export const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');

export const PFLICHTFELDER_REGEL = ['id', 'name', 'hardness', 'risk', 'inputs', 'assertion', 'legal_basis', 'legal_source', 'consequence', 'valid_from'];
export const PFLICHTFELDER_PFLICHT = ['id', 'required_data', 'required_evidence', 'required_document_form', 'hardness', 'legal_basis', 'legal_source'];
const HAERTEN = new Set(['hard', 'soft']);
const RISIKEN = new Set(['financial', 'compliance', 'criminal', 'operational', 'data_quality']);
const QUELLENSTATUS = new Set(['verified', 'secondary', 'practice']);
const ID_MUSTER = /^[A-Z]{3}-[0-9]{2}$/;
const DATUM_MUSTER = /^\d{4}-\d{2}-\d{2}$/;
const ERLAUBTE_ZAHLEN = new Set(['0', '1', '2']);
const NICHT_REGELDATEIEN = new Set(['befund.mjs', 'index.mjs']);

/** Entfernt Kommentare, Zeichenketten, Template-Literale und Regex-Literale, erhält Zeilenumbrüche. */
export function ohneLiterale(quelltext) {
  let text = quelltext;
  const leer = (t) => t.replace(/[^\n]/g, ' ');
  text = text.replace(/\/\*[\s\S]*?\*\//g, leer);
  text = text.replace(/(^|[^:])\/\/[^\n]*/g, (t, vor) => vor + leer(t.slice(vor.length)));
  text = text.replace(/`(?:\\[\s\S]|\$\{[^}]*\}|[^`\\])*`/g, leer);
  text = text.replace(/'(?:\\.|[^'\\\n])*'/g, leer);
  text = text.replace(/"(?:\\.|[^"\\\n])*"/g, leer);
  // Regex-Literal: ein Schrägstrich nach Operator, Klammer, Komma oder am
  // Zeilenanfang. Ein Divisionszeichen steht nach einem Wert, nie dort.
  text = text.replace(/(^|[=(,:!&|?{};[\s]|return)\s*\/(?:\\.|\[(?:\\.|[^\]\\\n])*\]|[^/\\\n[])+\/[gimsuy]*/g, (t, vor) => vor + leer(t.slice(vor.length)));
  return text;
}

/** Nackte Zahlen im Code: Zahltoken, die nicht Teil eines Bezeichners sind. */
export function nackteZahlen(quelltext) {
  const befunde = [];
  ohneLiterale(quelltext).split('\n').forEach((zeile, index) => {
    for (const treffer of zeile.matchAll(/(?<![\w.$])\d+(?:\.\d+)?(?![\w.$])/g)) {
      if (ERLAUBTE_ZAHLEN.has(treffer[0])) continue;
      befunde.push({ zeile: index + 1, zahl: treffer[0], text: zeile.trim() });
    }
  });
  return befunde;
}

/** Liest die [MVP]-IDs aus docs/03. */
export function mvpIdsAus(markdown) {
  return new Set([...markdown.matchAll(/\|\s*([A-Z]{3}-\d{2})\s+\*\*\[MVP\]\*\*/g)].map((m) => m[1]));
}

/**
 * Reine Prüfung ohne Dateizugriff. `dateien` beschreibt, welche Regel- und
 * Testdateien existieren und was die Regeldateien enthalten.
 */
export function pruefeKatalog({ regeln, pflichtmatrix, mvpIds, regelDateien, testDateien }) {
  const befunde = [];
  const melde = (art, text) => befunde.push({ art, text });

  const liste = regeln?.rules;
  if (!Array.isArray(liste) || liste.length === 0) {
    melde('FEHLER', 'rules.yaml enthält keine Regeln — keine Grundlage, kein Erfolg');
    return befunde;
  }
  if (!regeln.catalog?.version) melde('FEHLER', 'rules.yaml: catalog.version fehlt');

  const ids = new Set();
  for (const regel of liste) {
    const id = regel.id ?? '(ohne id)';
    for (const feld of PFLICHTFELDER_REGEL) {
      if (regel[feld] === undefined || regel[feld] === null || regel[feld] === '') melde('FEHLER', `${id}: Pflichtfeld ${feld} fehlt`);
    }
    if (regel.id && !ID_MUSTER.test(regel.id)) melde('FEHLER', `${id}: ID entspricht nicht AAA-NN`);
    if (ids.has(regel.id)) melde('FEHLER', `${id}: ID doppelt vergeben`);
    ids.add(regel.id);
    if (regel.hardness && !HAERTEN.has(regel.hardness)) melde('FEHLER', `${id}: hardness ${regel.hardness} unbekannt`);
    if (regel.risk && !RISIKEN.has(regel.risk)) melde('FEHLER', `${id}: risk ${regel.risk} unbekannt`);
    if (regel.legal_source && !QUELLENSTATUS.has(regel.legal_source)) melde('FEHLER', `${id}: legal_source ${regel.legal_source} unbekannt`);
    if (regel.valid_from && !DATUM_MUSTER.test(String(regel.valid_from))) melde('FEHLER', `${id}: valid_from ist kein ISO-Datum`);
    if (regel.valid_to && !DATUM_MUSTER.test(String(regel.valid_to))) melde('FEHLER', `${id}: valid_to ist kein ISO-Datum`);
    if (typeof regel.legal_basis === 'string' && /TODO-verify/.test(regel.legal_basis)) melde('HINWEIS', `${id}: Rechtsgrundlage trägt TODO-verify`);
  }

  // docs/03 gegen Katalog, beide Richtungen.
  for (const id of ids) if (!mvpIds.has(id)) melde('FEHLER', `${id}: im Katalog, aber in docs/03 nicht als [MVP] markiert`);
  for (const id of mvpIds) if (!ids.has(id)) melde('FEHLER', `${id}: in docs/03 als [MVP] markiert, aber nicht im Katalog`);

  // Implementierung und Test je Regel; keine Regeldatei ohne Katalog.
  for (const id of ids) {
    if (!(id in regelDateien)) melde('FEHLER', `${id}: src/regeln/${id}.mjs fehlt`);
    if (!testDateien.has(id)) melde('FEHLER', `${id}: tests/regeln/${id}.test.mjs fehlt`);
  }
  for (const id of Object.keys(regelDateien)) {
    if (!ids.has(id)) melde('FEHLER', `src/regeln/${id}.mjs existiert ohne Katalogregel`);
  }

  // Keine nackte Zahl in einer Regeldatei.
  for (const [id, quelltext] of Object.entries(regelDateien)) {
    for (const z of nackteZahlen(quelltext)) melde('FEHLER', `src/regeln/${id}.mjs:${z.zeile}: nackte Zahl ${z.zahl} — gehört als parameters/tolerance in rules.yaml (${z.text})`);
  }

  // Pflichtmatrix.
  const eintraege = pflichtmatrix?.entries;
  if (!Array.isArray(eintraege) || eintraege.length === 0) {
    melde('FEHLER', 'pflichtmatrix.yaml enthält keine Einträge');
  } else {
    const pflichtIds = new Set();
    for (const e of eintraege) {
      const id = e.id ?? '(ohne id)';
      for (const feld of PFLICHTFELDER_PFLICHT) {
        if (e[feld] === undefined || e[feld] === null || e[feld] === '') melde('FEHLER', `${id}: Pflichtmatrix-Feld ${feld} fehlt`);
      }
      if (pflichtIds.has(e.id)) melde('FEHLER', `${id}: Pflichtmatrix-ID doppelt`);
      pflichtIds.add(e.id);
      if (e.hardness && !HAERTEN.has(e.hardness)) melde('FEHLER', `${id}: hardness ${e.hardness} unbekannt`);
      if (e.legal_source && !QUELLENSTATUS.has(e.legal_source)) melde('FEHLER', `${id}: legal_source ${e.legal_source} unbekannt`);
    }
  }

  return befunde;
}

export function liesRepo(wurzel = WURZEL) {
  const lies = (p) => readFileSync(join(wurzel, p), 'utf8');
  const regelOrdner = join(wurzel, 'src', 'regeln');
  const testOrdner = join(wurzel, 'tests', 'regeln');
  const regelDateien = {};
  if (existsSync(regelOrdner)) {
    for (const datei of readdirSync(regelOrdner)) {
      if (!datei.endsWith('.mjs') || NICHT_REGELDATEIEN.has(datei)) continue;
      regelDateien[basename(datei, '.mjs')] = readFileSync(join(regelOrdner, datei), 'utf8');
    }
  }
  const testDateien = new Set(existsSync(testOrdner)
    ? readdirSync(testOrdner).filter((d) => d.endsWith('.test.mjs')).map((d) => basename(d, '.test.mjs'))
    : []);
  return {
    regeln: parse(lies('rules.yaml')),
    pflichtmatrix: parse(lies('pflichtmatrix.yaml')),
    mvpIds: mvpIdsAus(lies('docs/03-regelwerk-vollstaendig.md')),
    regelDateien,
    testDateien,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const repo = liesRepo();
  const befunde = pruefeKatalog(repo);
  const fehler = befunde.filter((b) => b.art === 'FEHLER');

  console.log('');
  console.log('Regel-Check');
  console.log('===========');
  console.log('');
  console.log(`${repo.regeln.rules?.length ?? 0} Regeln im Katalog, ${repo.mvpIds.size} als [MVP] in docs/03, ${Object.keys(repo.regelDateien).length} Regeldateien, ${repo.testDateien.size} Regeltests, ${repo.pflichtmatrix.entries?.length ?? 0} Pflichteinträge.`);
  console.log('');
  for (const b of befunde) console.log(`  ${b.art.padEnd(7)} ${b.text}`);
  if (fehler.length === 0) {
    console.log(befunde.length > 0 ? '' : 'Keine Befunde.');
    console.log('Katalog, Dokumentation, Implementierung und Tests sind deckungsgleich; keine nackte Zahl in src/regeln/.');
    process.exit(0);
  }
  console.log('');
  console.log(`${fehler.length} Fehler. Regeln sind Daten: Schwellen gehören in rules.yaml, und jede Regel braucht Katalogzeile, Implementierung und Test.`);
  process.exit(1);
}
