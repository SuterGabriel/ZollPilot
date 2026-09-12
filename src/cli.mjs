#!/usr/bin/env node
// Prüft eine Akte von der Kommandozeile. Dieselbe Funktion wie im n8n-Workflow.
//
//   node src/cli.mjs testdaten/akten/happy-path.json
//   node src/cli.mjs testdaten/akten/*.json --json

import { readFileSync } from 'node:fs';
import { ladeKatalog } from './katalog.mjs';
import { pruefeAkte } from './regelwerk.mjs';
import { REGELN } from './regeln/index.mjs';

const argumente = process.argv.slice(2);
const alsJson = argumente.includes('--json');
const dateien = argumente.filter((a) => !a.startsWith('--'));

if (dateien.length === 0) {
  console.error('Aufruf: node src/cli.mjs <akte.json> [...] [--json]');
  process.exit(2);
}

const katalog = ladeKatalog();
let blockiert = 0;

for (const datei of dateien) {
  const eingang = JSON.parse(readFileSync(datei, 'utf8'));
  const ergebnis = pruefeAkte(eingang, katalog, REGELN);
  if (ergebnis.freigabe === 'blockiert') blockiert += 1;

  if (alsJson) {
    console.log(JSON.stringify(ergebnis, null, 2));
    continue;
  }

  console.log('');
  console.log(`Akte ${ergebnis.akte_id}  —  ${ergebnis.freigabe.toUpperCase()}  (Katalog ${ergebnis.katalog_version}, Stichtag ${ergebnis.stichtag})`);
  console.log('='.repeat(72));
  for (const b of ergebnis.pflichtmatrix.befunde) {
    console.log(`  ${b.status === 'ok' ? 'ok      ' : 'FEHLT   '} ${b.id}  ${b.begruendung}`);
  }
  for (const b of ergebnis.befunde) {
    const marke = { ok: 'ok      ', verletzt: b.haerte_effektiv === 'hard' ? 'BLOCK   ' : 'WARNUNG ', nicht_pruefbar: 'OFFEN   ', re_extraction_required: 'NACHLESE' }[b.status];
    console.log(`  ${marke} ${b.regel}  ${b.begruendung}`);
  }
  if (ergebnis.nachforderungen.length > 0) {
    console.log('');
    console.log(`  ${ergebnis.nachforderungen.length} Nachforderung(en):`);
    for (const n of ergebnis.nachforderungen) {
      console.log(`    → ${n.adressat.primaer}: ${n.feld}  [${n.grund}]`);
    }
  }
}

process.exit(blockiert > 0 ? 1 : 0);
