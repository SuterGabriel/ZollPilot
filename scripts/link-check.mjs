#!/usr/bin/env node
// Verweis-Check
//
// Der Beleg-Check prüft die Belegspalte in docs/ANFORDERUNGEN.md. Alle anderen
// Verweise im Repo sind ungeprüft — die Wegweiser-Tabelle im README, der Sprung
// aus PRODUKT.md nach ../CLAUDE.md, die drei Ebenen aus einem Skill nach
// docs/adr/. Ein Verweis bricht nicht beim Schreiben, sondern bei der ersten
// Umbenennung, und dann bemerkt ihn niemand: Niemand liest eine Tabelle gegen
// den Verzeichnisbaum.
//
// Geprüft werden ausschließlich Markdown-Verweise der Form [Text](Ziel).
// Pfade in Backticks werden bewusst nicht geprüft: Die Skills und Commands
// nennen dort absichtlich Pfade, die es noch nicht gibt — `domain/regel/`,
// `evals/run.py`. Ein Verweis in Klammern ist eine Zusage für jetzt, ein Pfad
// in Backticks kann eine Ansage für später sein.
//
// Aufruf:
//   node scripts/link-check.mjs              alle Markdown-Dateien
//   node scripts/link-check.mjs datei ...    nur diese

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve, extname } from 'node:path';

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..');

const UEBERSPRINGEN = new Set([
  '.git', 'node_modules', 'dist', 'build', 'target', 'out',
  '.angular', '.venv', 'venv', '__pycache__', 'coverage',
]);

function markdownSammeln(verzeichnis, gesammelt = []) {
  for (const eintrag of readdirSync(verzeichnis)) {
    if (UEBERSPRINGEN.has(eintrag)) continue;
    const pfad = join(verzeichnis, eintrag);
    if (statSync(pfad).isDirectory()) markdownSammeln(pfad, gesammelt);
    else if (extname(pfad).toLowerCase() === '.md') gesammelt.push(pfad);
  }
  return gesammelt;
}

/** Blendet Codeblöcke aus, erhält aber die Zeilennummern. */
function ohneCode(inhalt) {
  let imCodeblock = false;
  return inhalt.split(/\r?\n/).map((zeile) => {
    if (/^\s*(```|~~~)/.test(zeile)) {
      imCodeblock = !imCodeblock;
      return '';
    }
    if (imCodeblock) return '';
    return zeile.replace(/`[^`]*`/g, (t) => ' '.repeat(t.length));
  });
}

const argumente = process.argv.slice(2);
const dateien = argumente.length > 0
  ? argumente.map((p) => resolve(p)).filter((p) => extname(p).toLowerCase() === '.md')
  : markdownSammeln(wurzel);

console.log('');
console.log('Verweis-Check');
console.log('=============');
console.log('');

const befunde = [];
let geprueft = 0;
let extern = 0;

for (const pfad of dateien) {
  let inhalt;
  try {
    inhalt = readFileSync(pfad, 'utf8');
  } catch {
    continue;
  }

  ohneCode(inhalt).forEach((zeile, index) => {
    // `[` in der Klasse ausgeschlossen: Ohne das kann eine Zeile mit vielen
    // offenen Klammern mehrfach von vorn durchlaufen werden.
    for (const treffer of zeile.matchAll(/\[[^[\]]*\]\(([^)]+)\)/g)) {
      const ziel = treffer[1].trim();

      // Nach außen zeigende Verweise kann dieses Skript nicht prüfen, ohne
      // ins Netz zu greifen. Das gehört nicht in einen Commit-Hook.
      if (/^(https?:|mailto:|#)/.test(ziel)) {
        extern += 1;
        continue;
      }

      const ohneFragment = ziel.split('#')[0];
      if (!ohneFragment) {
        extern += 1;
        continue;
      }

      geprueft += 1;
      const aufgeloest = resolve(dirname(pfad), decodeURIComponent(ohneFragment));
      if (!existsSync(aufgeloest)) {
        befunde.push({
          datei: relative(wurzel, pfad).replace(/\\/g, '/'),
          zeile: index + 1,
          ziel,
        });
      }
    }
  });
}

console.log(`${dateien.length} Dateien, ${geprueft} Verweise ins Repo, ${extern} nach außen.`);
console.log('');

if (befunde.length === 0) {
  console.log(`Alle ${geprueft} Verweise ins Repo lösen auf.`);
  process.exit(0);
}

for (const { datei, zeile, ziel } of befunde) {
  console.log(`  TOT   ${`${datei}:${zeile}`.padEnd(42)} ${ziel}`);
}

console.log('');
console.log('-------------');
console.log(`${befunde.length} von ${geprueft} Verweisen zeigen ins Leere.`);
console.log('');
console.log('Entweder das Ziel ist umbenannt und der Verweis zieht nach — oder der');
console.log('Verweis behauptet etwas, das es nicht gibt. Soll er auf etwas zeigen,');
console.log('das erst noch entsteht, gehört der Pfad in Backticks statt in Klammern.');
process.exit(1);
