import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pruefeTRN01 } from '../../src/regeln/TRN-01.mjs';
import { akteAus, regel, DEFAULTS } from '../hilfen.mjs';

const R = regel('TRN-01');
const mit = (bl, pack, konfidenzen) => akteAus({ bill_of_lading: { container_id: bl }, packliste: { container_id: pack } }, { konfidenzen });

test('TRN-01 identisch nach Normalisierung', () => {
  assert.equal(pruefeTRN01(mit('MSKU1234565', 'msku 123456-5'), R, DEFAULTS).status, 'ok');
});

test('TRN-01 verschiedene Container sind ein harter Verstoß', () => {
  const b = pruefeTRN01(mit('MSKU1234565', 'HLXU8765430'), R, DEFAULTS);
  assert.equal(b.status, 'verletzt');
  assert.match(b.begruendung, /B\/L nennt MSKU1234565, Packliste HLXU8765430/);
});

test('TRN-01 Abweichung bei niedriger Konfidenz ist zuerst ein Lesefehler', () => {
  const b = pruefeTRN01(mit('MSKU1234565', 'MSKU1234568', { 'packliste.container_id': 0.5 }), R, DEFAULTS);
  assert.equal(b.status, 're_extraction_required');
  assert.deepEqual(b.nachzulesende_pfade, ['packliste.container_id']);
});

test('TRN-01 fehlende Angabe nicht prüfbar', () => {
  assert.equal(pruefeTRN01(akteAus({ bill_of_lading: { container_id: 'MSKU1234565' } }), R, DEFAULTS).status, 'nicht_pruefbar');
});
