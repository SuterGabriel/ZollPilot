import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pruefeVAL01 } from '../../src/regeln/VAL-01.mjs';
import { akteAus, regel, DEFAULTS } from '../hilfen.mjs';

const R = regel('VAL-01');
const rechnung = (gesamt, extra = {}) => ({
  rechnung: { positionen: [{ nr: 1, netto: 100 }, { nr: 2, netto: 250.5 }], zuschlaege: 20, rabatte: 5.5, gesamt, ...extra },
});

test('VAL-01 Grenzfälle der Toleranz', () => {
  assert.equal(pruefeVAL01(akteAus(rechnung(365)), R, DEFAULTS).status, 'ok');
  assert.equal(pruefeVAL01(akteAus(rechnung(365.01)), R, DEFAULTS).status, 'ok', 'genau auf der Toleranz');
  assert.equal(pruefeVAL01(akteAus(rechnung(365.02)), R, DEFAULTS).status, 'verletzt', 'knapp darüber');
  assert.equal(pruefeVAL01(akteAus(rechnung(400)), R, DEFAULTS).status, 'verletzt');
});

test('VAL-01 ohne Zuschläge und Rabatte gilt 0', () => {
  const akte = akteAus({ rechnung: { positionen: [{ nr: 1, netto: 10 }], gesamt: 10 } });
  assert.equal(pruefeVAL01(akte, R, DEFAULTS).status, 'ok');
});

test('VAL-01 fehlender Endbetrag ist nicht prüfbar, kein Verstoß', () => {
  const b = pruefeVAL01(akteAus({ rechnung: { positionen: [{ nr: 1, netto: 10 }] } }), R, DEFAULTS);
  assert.equal(b.status, 'nicht_pruefbar');
  assert.deepEqual(b.fehlende_pfade, ['rechnung.gesamt']);
});

test('VAL-01 Summenfehler bei niedriger Konfidenz ist zuerst ein Lesefehler', () => {
  const akte = akteAus(rechnung(395), { konfidenzen: { 'rechnung.gesamt': 0.6 } });
  const b = pruefeVAL01(akte, R, DEFAULTS);
  assert.equal(b.status, 're_extraction_required');
  assert.deepEqual(b.nachzulesende_pfade, ['rechnung.gesamt']);
});
