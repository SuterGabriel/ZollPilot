// Testsuite des Kontrast-Gates. Ein Prüfer, der keine Grundlage findet, meldet
// den Stand — nie Erfolg (docs/ARBEITSWEISE.md, Falle 2). Die Referenzwerte
// stammen aus der WCAG-Definition beziehungsweise aus bekannten Paaren, nicht
// aus dem eigenen Code (Entwicklungslog 2026-09-12).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { kanaele, verhaeltnis, lieseTokens, lieseAnweisungen, pruefe } from './kontrast-check.mjs';

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..');
const NACHKOMMASTELLEN = 2;
const rund = (zahl) => Number(zahl.toFixed(NACHKOMMASTELLEN));

test('Kurzschreibweise, Langschreibweise und Alpha werden gelesen', () => {
  assert.deepEqual(kanaele('#fff'), [255, 255, 255]);
  assert.deepEqual(kanaele('#ffffff'), [255, 255, 255]);
  assert.deepEqual(kanaele('#ffffff80'), [255, 255, 255]);
  assert.deepEqual(kanaele('#16191d'), [22, 25, 29]);
  assert.throws(() => kanaele('#12345'), /nicht lesbar/);
});

test('Referenzwerte aus der WCAG-Definition', () => {
  // Schwarz auf Weiß ist der Höchstwert 21:1, gleiche Farbe ist 1:1.
  assert.equal(rund(verhaeltnis('#000000', '#ffffff')), 21);
  assert.equal(rund(verhaeltnis('#ffffff', '#ffffff')), 1);
  // Die Reihenfolge darf das Ergebnis nicht ändern.
  assert.equal(verhaeltnis('#000000', '#ffffff'), verhaeltnis('#ffffff', '#000000'));
  // Mittelgrau #767676 auf Weiß ist der bekannte Grenzfall von AA (4.5:1).
  assert.ok(rund(verhaeltnis('#767676', '#ffffff')) >= 4.5);
  assert.ok(rund(verhaeltnis('#777777', '#ffffff')) < 4.5);
});

test('Tokens und Anweisungen werden aus der Datei gelesen', () => {
  const css = `:root {\n  --a: #000000;\n  --b: #ffffff;\n}\n/* @kontrast --a auf --b mindestens 4.5 */\n`;
  assert.deepEqual([...lieseTokens(css).entries()], [['--a', '#000000'], ['--b', '#ffffff']]);
  assert.deepEqual(lieseAnweisungen(css), [{ vordergrund: '--a', hintergrund: '--b', mindestens: 4.5 }]);
});

test('Ohne Anweisung ist der Lauf rot, nicht grün', () => {
  const { fehler, geprueft, zeilen } = pruefe(':root { --a: #000000; }');
  assert.equal(geprueft, 0);
  assert.equal(fehler, 1);
  assert.match(zeilen[0], /keine @kontrast-Anweisung/);
});

test('Ein unbekanntes Token ist ein Fehler, keine stille Auslassung', () => {
  const { fehler, zeilen } = pruefe(':root { --a: #000000; }\n/* @kontrast --a auf --fehlt mindestens 4.5 */');
  assert.equal(fehler, 1);
  assert.match(zeilen[0], /--fehlt ist kein Token/);
});

test('Ein zu schwaches Paar wird rot, ein ausreichendes grün', () => {
  const css = ':root { --hell: #999999; --grund: #ffffff; }';
  assert.equal(pruefe(`${css}\n/* @kontrast --hell auf --grund mindestens 4.5 */`).fehler, 1);
  assert.equal(pruefe(`${css}\n/* @kontrast --hell auf --grund mindestens 2 */`).fehler, 0);
});

test('Die echte Stildatei besteht den Check', () => {
  const css = readFileSync(join(wurzel, 'oberflaeche', 'src', 'styles.css'), 'utf8');
  const { fehler, geprueft, zeilen } = pruefe(css);
  assert.ok(geprueft >= 8, `zu wenige Farbpaare geprüft: ${geprueft}`);
  assert.equal(fehler, 0, zeilen.filter((z) => z.startsWith('  ROT')).join('\n'));
});
