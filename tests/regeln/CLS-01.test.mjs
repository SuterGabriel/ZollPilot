import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pruefeCLS01 } from '../../src/regeln/CLS-01.mjs';
import { akteAus, regel } from '../hilfen.mjs';

const R = regel('CLS-01');

test('CLS-01 gleiche HS-6 auf allen Belegen, auch mit längeren Codes', () => {
  const akte = akteAus({
    rechnung: { positionen: [{ nr: 1, hs6: '84133080' }] },
    packliste: { positionen: [{ nr: 1, hs6: '8413.30' }] },
    praeferenznachweis: { warenkreis: [{ pos: 1, hs6: '841330' }] },
  });
  assert.equal(pruefeCLS01(akte, R).status, 'ok');
});

test('CLS-01 Abweichung auf der Packliste', () => {
  const akte = akteAus({ rechnung: { positionen: [{ nr: 1, hs6: '841330' }] }, packliste: { positionen: [{ nr: 1, hs6: '841350' }] } });
  const b = pruefeCLS01(akte, R);
  assert.equal(b.status, 'verletzt');
  assert.match(b.begruendung, /Packliste 841350/);
});

test('CLS-01 Abweichung im Präferenznachweis', () => {
  const akte = akteAus({ rechnung: { positionen: [{ nr: 1, hs6: '841330' }] }, praeferenznachweis: { warenkreis: [{ pos: 1, hs6: '848420' }] } });
  assert.match(pruefeCLS01(akte, R).begruendung, /Präferenznachweis 848420/);
});

test('CLS-01 fehlender HS-Code auf der Rechnung ist ein Verstoß, fehlende Packliste nicht', () => {
  assert.equal(pruefeCLS01(akteAus({ rechnung: { positionen: [{ nr: 1 }] } }), R).status, 'verletzt');
  assert.equal(pruefeCLS01(akteAus({ rechnung: { positionen: [{ nr: 1, hs6: '841330' }] } }), R).status, 'ok');
  assert.equal(pruefeCLS01(akteAus({ packliste: { positionen: [] } }), R).status, 'nicht_pruefbar');
});
