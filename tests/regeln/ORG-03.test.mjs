import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pruefeORG03 } from '../../src/regeln/ORG-03.mjs';
import { akteAus } from '../hilfen.mjs';

test('ORG-03 A.TR als Präferenznachweis erfasst ist ein Verstoß', () => {
  const akte = akteAus({ praeferenznachweis: { typ: 'atr', ursprung: 'TR' } });
  assert.equal(pruefeORG03(akte).status, 'verletzt');
});

test('ORG-03 nur A.TR in der Akte bei Präferenzanspruch', () => {
  const akte = akteAus({ rechnung: { gesamt: 1 } }, { dokumente: [{ id: 'ATR-1', typ: 'atr', status: 'final' }] });
  const b = pruefeORG03(akte);
  assert.equal(b.status, 'verletzt');
  assert.equal(b.eingaben.atr_vorhanden, true);
});

test('ORG-03 A.TR neben einem echten Nachweis ist in Ordnung', () => {
  const akte = akteAus({ praeferenznachweis: { typ: 'eur1', ursprung: 'DE' } }, { dokumente: [{ id: 'ATR-1', typ: 'atr', status: 'final' }] });
  assert.equal(pruefeORG03(akte).status, 'ok');
});

test('ORG-03 ohne A.TR nichts zu melden', () => {
  assert.equal(pruefeORG03(akteAus({ rechnung: { gesamt: 1 } })).status, 'ok');
});
