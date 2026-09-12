import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pruefeCLS02 } from '../../src/regeln/CLS-02.mjs';
import { akteAus, regel } from '../hilfen.mjs';

const R = regel('CLS-02');
const mit = (anmeldung) => akteAus({ anmeldung });

test('CLS-02 Ausfuhr verlangt acht Stellen', () => {
  assert.equal(pruefeCLS02(mit({ richtung: 'export', warennummern: ['84133080'] }), R).status, 'ok');
  assert.equal(pruefeCLS02(mit({ richtung: 'export', warennummern: ['841330'] }), R).status, 'verletzt', 'HS-6 reicht nicht');
  assert.equal(pruefeCLS02(mit({ richtung: 'export', warennummern: ['8413308000'] }), R).status, 'verletzt', 'TARIC-10 ist zu lang');
  assert.equal(pruefeCLS02(mit({ richtung: 'export', warennummern: ['8413 3080'] }), R).status, 'ok', 'Leerzeichen werden entfernt');
});

test('CLS-02 Einfuhr DE verlangt elf Stellen', () => {
  assert.equal(pruefeCLS02(mit({ richtung: 'import_de', warennummern: ['84133080000'] }), R).status, 'ok');
  assert.equal(pruefeCLS02(mit({ richtung: 'import_de', warennummern: ['84133080'] }), R).status, 'verletzt');
});

test('CLS-02 unbekannte Richtung oder fehlende Anmeldung sind nicht prüfbar', () => {
  assert.equal(pruefeCLS02(mit({ richtung: 'transit', warennummern: ['1'] }), R).status, 'nicht_pruefbar');
  assert.equal(pruefeCLS02(akteAus({}), R).status, 'nicht_pruefbar');
});
