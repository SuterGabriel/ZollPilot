import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pruefeQTY01 } from '../../src/regeln/QTY-01.mjs';
import { akteAus, DEFAULTS } from '../hilfen.mjs';

const mit = (rechnung, packliste, backorders) => akteAus({
  rechnung: { positionen: rechnung },
  packliste: { positionen: packliste, ...(backorders ? { backorders } : {}) },
});

test('QTY-01 Stückware ohne Toleranz', () => {
  assert.equal(pruefeQTY01(mit([{ nr: 1, menge: 12 }], [{ nr: 1, menge: 12 }]), null, DEFAULTS).status, 'ok');
  assert.equal(pruefeQTY01(mit([{ nr: 1, menge: 12 }], [{ nr: 1, menge: 11 }]), null, DEFAULTS).status, 'verletzt');
});

test('QTY-01 dokumentierte Backorder erklärt die Differenz', () => {
  assert.equal(pruefeQTY01(mit([{ nr: 1, menge: 10 }], [{ nr: 1, menge: 12 }], [{ nr: 1, menge: 2 }]), null, DEFAULTS).status, 'ok');
  assert.equal(pruefeQTY01(mit([{ nr: 1, menge: 10 }], [{ nr: 1, menge: 12 }], [{ nr: 1, menge: 1 }]), null, DEFAULTS).status, 'verletzt');
});

test('QTY-01 Position fehlt in der Packliste', () => {
  const b = pruefeQTY01(mit([{ nr: 1, menge: 1 }, { nr: 2, menge: 1 }], [{ nr: 1, menge: 1 }]), null, DEFAULTS);
  assert.equal(b.status, 'verletzt');
  assert.match(b.begruendung, /Position 2 fehlt/);
});

test('QTY-01 ohne Packliste nicht prüfbar', () => {
  assert.equal(pruefeQTY01(akteAus({ rechnung: { positionen: [{ nr: 1, menge: 1 }] } }), null, DEFAULTS).status, 'nicht_pruefbar');
});
