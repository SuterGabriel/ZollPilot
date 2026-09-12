#!/usr/bin/env node
// Prüft eine gerade geschriebene Datei sofort auf ausgeschriebene Umlaute.
//
// Warum das zusätzlich zum Git-Hook existiert: Der Fehler, den der
// Entwicklungslog protokolliert, ist ein Agenten-Fehler. Ein Agent schrieb
// `fuer` statt "für", und die Korrektur per Wörterbuch beschädigte danach einen
// Bezeichner. Zwischen dem Schreiben und dem Commit liegen oft zwanzig weitere
// Änderungen — bis der Git-Hook anschlägt, ist die Ursache aus dem Blick.
//
// Dieser Hook meldet den Fehler in der Sekunde, in der er entsteht, und zwar an
// den Agenten selbst. Exit-Code 2 heißt für Claude Code: nachbessern.
//
// Verdrahtet in .claude/settings.json als PostToolUse auf Write und Edit.

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

let eingabe = '';
process.stdin.setEncoding('utf8');
for await (const teil of process.stdin) eingabe += teil;

let datei;
try {
  datei = JSON.parse(eingabe)?.tool_input?.file_path;
} catch {
  process.exit(0); // Kein verwertbares Ereignis. Ein Hook, der bei
                   // Unklarheit blockiert, wird abgeschaltet.
}

if (!datei) process.exit(0);

const ergebnis = spawnSync(
  process.execPath,
  [join(wurzel, 'scripts', 'prosa-check.mjs'), datei],
  { cwd: wurzel, encoding: 'utf8' },
);

if (ergebnis.status === 0) process.exit(0);

// Die Datei wurde bereits geschrieben. Der Hinweis geht an den Agenten, damit
// er sie korrigiert, bevor er weiterarbeitet.
console.error(
  'Der Prosa-Check meldet ausgeschriebene Umlaute in der gerade geschriebenen '
  + 'Datei:\n\n'
  + (ergebnis.stdout || '').trim()
  + '\n\nKorrigiere nur die genannten Stellen einzeln. Nicht per Suchen-und-'
  + 'Ersetzen über die Datei: Genau so wurde aus `pruefe` einmal `prüfe`. '
  + 'Ist die Stelle ein Bezeichner oder ein Zitat, gehört sie in Backticks.',
);
process.exit(2);
