import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pruefeORG02 } from '../../src/regeln/ORG-02.mjs';
import { akteAus, regel, DEFAULTS, ZUGRIFF } from '../hilfen.mjs';

const R = regel('ORG-02');
const akte = (positionen, nachweis) => akteAus({
  rechnung: { positionen },
  praeferenznachweis: { typ: 'origin_declaration', ursprung: 'DE', warenkreis: [{ pos: 1, hs6: '841330' }], ...nachweis },
});

test('ORG-02 Ursprung und Warenkreis decken die Position', () => {
  assert.equal(pruefeORG02(akte([{ nr: 1, hs6: '841330', ursprung: 'DE' }]), R, DEFAULTS, ZUGRIFF).status, 'ok');
  assert.equal(pruefeORG02(akte([{ nr: 1, hs6: '8413.30.80', ursprung: 'de' }]), R, DEFAULTS, ZUGRIFF).status, 'ok', 'Normalisierung vor Vergleich');
});

test('ORG-02 Ursprungswiderspruch', () => {
  const b = pruefeORG02(akte([{ nr: 1, hs6: '841330', ursprung: 'CN' }]), R, DEFAULTS, ZUGRIFF);
  assert.equal(b.status, 'verletzt');
  assert.match(b.begruendung, /Ursprung CN ≠ Nachweis DE/);
});

test('ORG-02 Position außerhalb des Warenkreises', () => {
  const b = pruefeORG02(akte([{ nr: 1, hs6: '848420', ursprung: 'DE' }]), R, DEFAULTS, ZUGRIFF);
  assert.equal(b.status, 'verletzt');
  assert.match(b.begruendung, /nicht im Warenkreis/);
});

test('ORG-02 ohne Nachweis nicht prüfbar; ohne Präferenzanspruch nicht einschlägig', () => {
  const ohne = akteAus({ rechnung: { positionen: [{ nr: 1, hs6: '841330', ursprung: 'DE' }] } });
  assert.equal(pruefeORG02(ohne, R, DEFAULTS, ZUGRIFF).status, 'nicht_pruefbar');
  const keinAnspruch = akteAus({ rechnung: { positionen: [{ nr: 1, hs6: '841330', ursprung: 'CN' }] }, sachverhalt: { praeferenz_beansprucht: false } });
  assert.equal(pruefeORG02(keinAnspruch, R, DEFAULTS, ZUGRIFF).status, 'ok');
});
