import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pruefeTRN02 } from '../../src/regeln/TRN-02.mjs';
import { akteAus, regel, DEFAULTS } from '../hilfen.mjs';

const R = regel('TRN-02');

test('TRN-02 gültige Prüfziffer auf beiden Belegen', () => {
  const akte = akteAus({ bill_of_lading: { container_id: 'MSKU1234565' }, packliste: { container_id: 'HLXU8765430' } });
  assert.equal(pruefeTRN02(akte, R, DEFAULTS).status, 'ok');
});

test('TRN-02 falsche Prüfziffer bei hoher Konfidenz ist ein Dokumentfehler', () => {
  const akte = akteAus({ packliste: { container_id: 'MSKU1234568' } });
  const b = pruefeTRN02(akte, R, DEFAULTS);
  assert.equal(b.status, 'verletzt');
  assert.match(b.begruendung, /erwartet 5/);
});

test('TRN-02 falsche Prüfziffer bei niedriger Konfidenz verlangt Nachextraktion', () => {
  const akte = akteAus({ packliste: { container_id: 'MSKU1234568' } }, { konfidenzen: { 'packliste.container_id': 0.55 } });
  const b = pruefeTRN02(akte, R, DEFAULTS);
  assert.equal(b.status, 're_extraction_required');
  assert.deepEqual(b.nachzulesende_pfade, ['packliste.container_id']);
});

test('TRN-02 Konfidenz genau auf der Schwelle gilt als sicher', () => {
  const akte = akteAus({ packliste: { container_id: 'MSKU1234568' } }, { konfidenzen: { 'packliste.container_id': DEFAULTS.low_confidence_below } });
  assert.equal(pruefeTRN02(akte, R, DEFAULTS).status, 'verletzt');
});

test('TRN-02 Formatfehler wird als solcher benannt', () => {
  const b = pruefeTRN02(akteAus({ packliste: { container_id: 'MSK-12345' } }), R, DEFAULTS);
  assert.equal(b.status, 'verletzt');
  assert.match(b.begruendung, /Format ungültig/);
});

test('TRN-02 ohne Containernummer nicht prüfbar', () => {
  assert.equal(pruefeTRN02(akteAus({}), R, DEFAULTS).status, 'nicht_pruefbar');
});
