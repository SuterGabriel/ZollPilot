import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pruefeQTY02 } from '../../src/regeln/QTY-02.mjs';
import { akteAus, regel, DEFAULTS } from '../hilfen.mjs';

const R = regel('QTY-02');
const mit = (packliste, bl) => akteAus({ packliste: { brutto_gesamt_kg: packliste }, bill_of_lading: { brutto_kg: bl } });

test('QTY-02 Toleranz ist das Größere aus 2 kg und 1 %', () => {
  assert.equal(pruefeQTY02(mit(100, 102), R, DEFAULTS).status, 'ok', '2 kg absolut bei kleiner Sendung');
  assert.equal(pruefeQTY02(mit(100, 102.5), R, DEFAULTS).status, 'verletzt');
  assert.equal(pruefeQTY02(mit(1000, 1010), R, DEFAULTS).status, 'ok', '1 % bei großer Sendung');
  assert.equal(pruefeQTY02(mit(1000, 1010.5), R, DEFAULTS).status, 'verletzt');
});

test('QTY-02 bleibt weich unterhalb der Eskalationsschwelle, wird hart darüber', () => {
  const weich = pruefeQTY02(mit(1000, 1050), R, DEFAULTS);
  assert.equal(weich.status, 'verletzt');
  assert.equal(weich.haerte_effektiv, 'soft');
  const hart = pruefeQTY02(mit(1000, 1100), R, DEFAULTS);
  assert.equal(hart.haerte_effektiv, 'hard', 'genau 10 % ist hart');
  assert.match(hart.begruendung, /Eskalationsschwelle/);
});

test('QTY-02 Toleranz kommt aus dem Katalog', () => {
  const streng = { ...R, tolerance: { relative: 0, absolute_kg: 0 } };
  assert.equal(pruefeQTY02(mit(100, 100.1), streng, DEFAULTS).status, 'verletzt');
});

test('QTY-02 fehlendes B/L-Gewicht nicht prüfbar', () => {
  assert.equal(pruefeQTY02(akteAus({ packliste: { brutto_gesamt_kg: 100 } }), R, DEFAULTS).status, 'nicht_pruefbar');
});
