import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pruefeVAL03 } from '../../src/regeln/VAL-03.mjs';
import { akteAus, DEFAULTS } from '../hilfen.mjs';

const mit = (position) => akteAus({ rechnung: { positionen: [{ nr: 1, einzelpreis: 10, netto: 10 }, { nr: 2, ...position }] } });

test('VAL-03 kostenlose Position braucht Zollwert oder Bewertungsmethode', () => {
  assert.equal(pruefeVAL03(mit({ einzelpreis: 0, netto: 0, zollwert: null, bewertungsmethode: null }), null, DEFAULTS).status, 'verletzt');
  assert.equal(pruefeVAL03(mit({ einzelpreis: 0, netto: 0, zollwert: 12.5 }), null, DEFAULTS).status, 'ok');
  assert.equal(pruefeVAL03(mit({ einzelpreis: 0, netto: 0, bewertungsmethode: 'Art. 74 Abs. 2 lit. a UZK, gleiche Waren' }), null, DEFAULTS).status, 'ok');
  assert.equal(pruefeVAL03(mit({ einzelpreis: 0, netto: 0, zollwert: 0 }), null, DEFAULTS).status, 'verletzt', 'Zollwert 0 ist kein Zollwert');
});

test('VAL-03 bezahlte Positionen sind nicht betroffen', () => {
  assert.equal(pruefeVAL03(mit({ einzelpreis: 0.01, netto: 0.01 }), null, DEFAULTS).status, 'ok');
});

test('VAL-03 meldet die Positionsnummer', () => {
  const b = pruefeVAL03(mit({ einzelpreis: 0, netto: 0 }), null, DEFAULTS);
  assert.match(b.begruendung, /Position\(en\) 2/);
  assert.deepEqual(b.positionen, [1]);
});
