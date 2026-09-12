import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pruefeAkte } from '../../src/regelwerk.mjs';
import { REGELN } from '../../src/regeln/index.mjs';
import { eingangAus, KATALOG } from '../hilfen.mjs';

test('Das Ergebnis reicht die Fristen der Akte unverändert durch, sonst null', () => {
  const fristen = { customs_cutoff: '2026-09-15T16:00:00+02:00', carrier_cutoff: null, eta: '2026-10-20T08:00:00+02:00' };
  const mit = pruefeAkte({ ...eingangAus({ rechnung: { gesamt: 1 } }), fristen }, KATALOG, REGELN);
  assert.deepEqual(mit.fristen, fristen);
  const ohne = pruefeAkte(eingangAus({ rechnung: { gesamt: 1 } }), KATALOG, REGELN);
  assert.equal(ohne.fristen, null);
});
