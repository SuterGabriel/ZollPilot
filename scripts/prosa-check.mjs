#!/usr/bin/env node
// Prosa-Check
//
// Der Entwicklungslog protokolliert den einzigen handwerklichen Fehler, der
// diesem Repo bisher passiert ist: Dateien entstanden mit `fuer` statt "für",
// die Massenkorrektur ersetzte anschließend einen Bezeichner mit, aus `pruefe`
// wurde `prüfe`. Gefunden beim Nachlesen, nicht durch eine Prüfung.
//
// Dieses Skript ist die fehlende Prüfung.
//
// Die Regel, in zwei Sätzen:
//
//   1. Die verbotenen Formen werden aus dem Repo selbst abgeleitet. Jedes
//      Wort, das irgendwo mit Umlaut geschrieben steht, darf nirgends in
//      ASCII-Umschrift auftauchen — wer "für" schreibt, macht `fuer` falsch.
//   2. Bezeichner sind ausgenommen, weil in Nicht-Markdown-Dateien nur reine
//      Kommentarzeilen geprüft werden. Dort kann kein Bezeichner stehen.
//
// Punkt 2 ist der Grund, warum `pruefe()` in beleg-check.sh und
// `--hitflaeche-min` in tokens.css durchgehen: Beide sind Absicht. Das Glossar
// führt `Pruefergebnis` ausdrücklich als deutschen Bezeichner in ASCII.
//
// Aufruf:
//   node scripts/prosa-check.mjs              das ganze Verzeichnis
//   node scripts/prosa-check.mjs datei ...    nur diese Dateien

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, extname, basename, resolve } from 'node:path';

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..');

// Verzeichnisse, die nie geprüft werden.
const UEBERSPRINGEN = new Set([
  '.git', 'node_modules', 'dist', 'build', 'target', 'out',
  '.angular', '.venv', 'venv', '__pycache__', 'coverage',
]);

// Dateien, deren Prosa geprüft wird. Markdown vollständig, alles andere nur
// in Kommentarzeilen — siehe Kopfkommentar.
const MARKDOWN = new Set(['.md']);
const NUR_KOMMENTARE = new Set([
  '.sh', '.mjs', '.js', '.cjs', '.css', '.yml', '.yaml',
  '.java', '.ts', '.html', '.xml', '.py', '.sql',
]);
const DOTFILES_MIT_KOMMENTAREN = new Set(['.gitignore', '.gitattributes', '.editorconfig']);

// Ausnahmen. Jede einzeln begründet — eine stille Ausnahmeliste wäre eine
// Hintertür, durch die die Regel nach und nach verschwindet.
const AUSNAHMEN = new Map([
  // Funktionsname in beleg-check.sh und Präfix der Regelfunktionen in src/regeln/.
  ['pruefe', 'Funktionsname in beleg-check.sh und in src/regeln/'],
  // Dateinamen und Bezeichner aus rules.yaml, die in Prosa zitiert werden.
  ['praeferenz', 'Bezeichner in Pfaden wie testdaten/akten/praeferenznachweis-fehlt.json'],
  ['praeferenznachweis', 'Bezeichner in Pfaden und Fakten (praeferenznachweis.typ)'],
  // Englischer Fachbegriff auf Frachtpapieren (Gross Weight), kein deutsches Wort.
  ['gross', 'Feldname auf B/L und AWB: Gross Weight'],
  // Verzeichnisname der Angular-Anwendung. Ein Pfad trägt keinen Umlaut, und
  // er steht in Kommentaren, Compose und CI. Die Prosa daneben schreibt
  // weiterhin "Oberfläche" — nur der Pfad ist ausgenommen.
  ['oberflaeche', 'Verzeichnisname im Repo: oberflaeche/'],
]);

// Grundliste für den Fall, dass die richtige Schreibweise im Repo noch nirgends
// vorkommt. Ohne sie greift die Prüfung in einer ganz neuen Datei nicht.
const GRUNDLISTE = [
  'fuer', 'dafuer', 'ueber', 'darueber', 'koennen', 'koennte', 'muessen',
  'waere', 'waeren', 'haette', 'naechste', 'naechsten', 'gehoert', 'moeglich',
  'aendern', 'aenderung', 'pruefen', 'pruefung', 'prueft', 'geprueft',
  'fuehrt', 'fuehren', 'spaeter', 'gemaess', 'groesse', 'groesser',
  'schluessel', 'haeufig', 'waehrend', 'ausserdem', 'zusaetzlich', 'loesung',
  'saetzen', 'erklaerbar', 'begruendung', 'natuerlich', 'tatsaechlich',
  'grundsaetzlich', 'ueblich', 'hoechstens', 'zustaende', 'erfuellt',
  'vertraege', 'zurueck', 'schliesslich', 'massgeblich',
];

/** ä ö ü ß in die Umschrift, die dieses Skript verbietet. */
function umschrift(wort) {
  return wort
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue')
    .toLowerCase();
}

function dateienSammeln(verzeichnis, gesammelt = []) {
  for (const eintrag of readdirSync(verzeichnis)) {
    if (UEBERSPRINGEN.has(eintrag)) continue;
    const pfad = join(verzeichnis, eintrag);
    if (statSync(pfad).isDirectory()) dateienSammeln(pfad, gesammelt);
    else gesammelt.push(pfad);
  }
  return gesammelt;
}

function artDerDatei(pfad) {
  const endung = extname(pfad).toLowerCase();
  if (MARKDOWN.has(endung)) return 'markdown';
  if (NUR_KOMMENTARE.has(endung)) return 'kommentare';
  if (DOTFILES_MIT_KOMMENTAREN.has(basename(pfad))) return 'kommentare';
  return null;
}

/**
 * Maskiert alles, was keine Prosa ist, mit Leerzeichen — Zeilennummern und
 * Spalten bleiben dadurch erhalten. Was übrig bleibt, ist der Text, den ein
 * Mensch liest.
 */
function prosaZeilen(inhalt, art) {
  const zeilen = inhalt.split(/\r?\n/);
  let imCodeblock = false;

  return zeilen.map((zeile) => {
    if (art === 'markdown') {
      if (/^\s*(```|~~~)/.test(zeile)) {
        imCodeblock = !imCodeblock;
        return '';
      }
      if (imCodeblock) return '';
      // Eingerückte Codeblöcke.
      if (/^ {4,}\S/.test(zeile) && !/^\s*[-*+|>]/.test(zeile)) return '';
    } else {
      // Nur reine Kommentarzeilen. Eine Zeile mit Code davor wird verworfen,
      // weil dort ein Bezeichner stehen kann.
      //
      // Eine Zeile, die mit `*` beginnt, ist nur innerhalb eines Blockkommentars
      // Prosa. Außerhalb ist sie eine Fortsetzungszeile mit Multiplikation —
      // `* anfrage.raeume().size()` — und trägt Bezeichner.
      const oeffnet = /^\s*\/\*/.test(zeile);
      const schliesst = /\*\//.test(zeile);
      const sternzeile = /^\s*\*/.test(zeile) && !oeffnet;
      const istProsa = oeffnet || /^\s*(#|\/\/|--)/.test(zeile) || (sternzeile && imCodeblock);
      if (oeffnet && !schliesst) imCodeblock = true;
      if (schliesst) imCodeblock = false;
      if (!istProsa) return '';
    }

    return zeile
      .replace(/`[^`]*`/g, (t) => ' '.repeat(t.length))        // Code im Fließtext
      .replace(/\]\([^)]*\)/g, (t) => ' '.repeat(t.length))    // Verweisziele
      .replace(/https?:\/\/\S+/g, (t) => ' '.repeat(t.length)) // nackte Adressen
      .replace(/--[\w-]+/g, (t) => ' '.repeat(t.length))       // CSS-Token
      .replace(/%\w+%/g, (t) => ' '.repeat(t.length))          // Windows-Variablen
      // Javadoc nennt Bezeichner im Kommentar: `@param begruendung`,
      // `{@code Pruefergebnis}`. Das ist Code in Prosaform, keine Prosa.
      .replace(/\{@\w+\s[^}]*\}/g, (t) => ' '.repeat(t.length))
      .replace(/(@\w+)(\s+)(\S+)/g, (t, tag, luecke, wert) => tag + luecke + ' '.repeat(wert.length));
  });
}

// ---------------------------------------------------------------------------

const argumente = process.argv.slice(2);
const alleDateien = dateienSammeln(wurzel);

// Schritt 1: das Umlaut-Vokabular des Repos einsammeln.
const verboten = new Map();
for (const wort of GRUNDLISTE) verboten.set(wort, 'Grundliste');

for (const pfad of alleDateien) {
  if (!artDerDatei(pfad)) continue;
  let inhalt;
  try {
    inhalt = readFileSync(pfad, 'utf8');
  } catch {
    continue;
  }
  // Erst alle Wörter, dann die mit Umlaut - zwei einfache Schritte statt eines
  // Musters mit überlappenden Klassen, das bei langen Wörtern quadratisch wird.
  for (const [treffer] of inhalt.matchAll(/[\wäöüßÄÖÜ]+/g)) {
    if (!/[äöüßÄÖÜ]/.test(treffer)) continue;
    if (treffer.length < 4) continue;
    const form = umschrift(treffer);
    if (!verboten.has(form)) verboten.set(form, treffer);
  }
}

for (const ausnahme of AUSNAHMEN.keys()) verboten.delete(ausnahme);

// Schritt 2: prüfen.
const zuPruefen = argumente.length > 0
  ? argumente.map((p) => resolve(p)).filter((p) => artDerDatei(p))
  : alleDateien.filter((p) => artDerDatei(p));

console.log('');
console.log('Prosa-Check');
console.log('===========');
console.log('');
console.log(`${verboten.size} verbotene Umschriften, ${zuPruefen.length} Dateien.`);
console.log('');

const befunde = [];

for (const pfad of zuPruefen) {
  let inhalt;
  try {
    inhalt = readFileSync(pfad, 'utf8');
  } catch {
    continue;
  }
  const art = artDerDatei(pfad);
  const zeilen = prosaZeilen(inhalt, art);

  zeilen.forEach((zeile, index) => {
    if (!zeile.trim()) return;
    for (const [wort] of zeile.matchAll(/[A-Za-z]{4,}/g)) {
      const klein = wort.toLowerCase();
      if (!verboten.has(klein)) continue;
      befunde.push({
        datei: relative(wurzel, pfad).replace(/\\/g, '/'),
        zeile: index + 1,
        wort,
        richtig: verboten.get(klein),
      });
    }
  });
}

if (befunde.length === 0) {
  console.log(`Keine ausgeschriebenen Umlaute in Prosa. ${zuPruefen.length} Dateien geprüft.`);
  process.exit(0);
}

for (const { datei, zeile, wort, richtig } of befunde) {
  const ort = `${datei}:${zeile}`.padEnd(46);
  const hinweis = richtig === 'Grundliste' ? '(Grundliste)' : `richtig: ${richtig}`;
  console.log(`  UMSCHRIFT ${ort} ${wort}  ${hinweis}`);
}

console.log('');
console.log('--------------');
console.log(befunde.length === 1
  ? '1 ausgeschriebener Umlaut in Prosa.'
  : `${befunde.length} ausgeschriebene Umlaute in Prosa.`);
console.log('');
console.log('Umlaute gehören als Umlaute geschrieben. Ist die Stelle ein Bezeichner');
console.log('oder ein Zitat, gehört sie in Backticks — dann liest dieses Skript sie');
console.log('als Code und nicht als Prosa.');
console.log('');
console.log('Nicht per Suchen-und-Ersetzen über das ganze Repo korrigieren: Genau');
console.log('so wurde aus `pruefe` einmal `prüfe`. Siehe docs/ENTWICKLUNGSLOG.md.');
process.exit(1);
