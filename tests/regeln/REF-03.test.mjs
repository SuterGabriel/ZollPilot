import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pruefeREF03 } from '../../src/regeln/REF-03.mjs';
import { akteAus } from '../hilfen.mjs';

test('REF-03 nur ein Draft-B/L: Verstoß, und seine Werte sind keine Fakten', () => {
  const akte = akteAus({ bill_of_lading: { container_id: 'MSKU1234565' } }, { status: { bill_of_lading: 'draft' } });
  const b = pruefeREF03(akte);
  assert.equal(b.status, 'verletzt');
  assert.match(b.begruendung, /bill_of_lading \(BILL_OF_LADING-1, Status draft\)/);
  assert.equal(akte.fakten.bill_of_lading, undefined);
});

test('REF-03 Draft neben finaler Fassung ist in Ordnung', () => {
  const akte = akteAus({ bill_of_lading: { container_id: 'MSKU1234565' } }, {
    dokumente: [{ id: 'BL-DRAFT', typ: 'bill_of_lading', status: 'draft' }],
  });
  akte.nicht_final.push({ dokument: 'BL-DRAFT', dokument_typ: 'bill_of_lading', dokument_status: 'draft', pfad: 'bill_of_lading.container_id', wert: 'X' });
  const b = pruefeREF03(akte);
  assert.equal(b.status, 'ok');
  assert.equal(b.eingaben.assertions_nicht_final, 1);
});

test('REF-03 ohne Drafts nichts zu melden', () => {
  assert.equal(pruefeREF03(akteAus({ rechnung: { gesamt: 1 } })).status, 'ok');
});
