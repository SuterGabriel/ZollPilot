import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pruefeORG06 } from '../../src/regeln/ORG-06.mjs';
import { akteAus, regel, DEFAULTS } from '../hilfen.mjs';

const R = regel('ORG-06');
const schwelle = R.parameters.threshold.value;
const akte = (nachweis, rechnung = { waehrung: 'EUR' }) => akteAus({ rechnung, praeferenznachweis: { typ: 'origin_declaration', ursprung: 'DE', ...nachweis } });

test('ORG-06 Grenzfälle der Schwelle', () => {
  assert.equal(pruefeORG06(akte({ ursprungswert: schwelle, rex_nummer: null }), R, DEFAULTS).status, 'ok', 'genau auf der Schwelle: jeder Ausführer');
  assert.equal(pruefeORG06(akte({ ursprungswert: schwelle + 0.01, rex_nummer: null }), R, DEFAULTS).status, 'verletzt', 'knapp darüber ohne REX');
  assert.equal(pruefeORG06(akte({ ursprungswert: schwelle + 1, rex_nummer: 'DEREX12345678' }), R, DEFAULTS).status, 'ok');
  assert.equal(pruefeORG06(akte({ ursprungswert: schwelle + 1, ermaechtigter_ausfuehrer: 'DE/1234/EA' }), R, DEFAULTS).status, 'ok');
});

test('ORG-06 REX-Nummer im falschen Format', () => {
  const b = pruefeORG06(akte({ ursprungswert: schwelle + 1, rex_nummer: '12345678' }), R, DEFAULTS);
  assert.equal(b.status, 'verletzt');
  assert.match(b.begruendung, /Format/);
});

test('ORG-06 andere Nachweisformen sind nicht betroffen', () => {
  assert.equal(pruefeORG06(akte({ typ: 'eur1', ursprungswert: schwelle * 10 }), R, DEFAULTS).status, 'ok');
});

test('ORG-06 fremde Währung ist nicht prüfbar, weil keine Umrechnung gebaut ist', () => {
  const b = pruefeORG06(akte({ ursprungswert: schwelle + 1 }, { waehrung: 'USD' }), R, DEFAULTS);
  assert.equal(b.status, 'nicht_pruefbar');
});

test('ORG-06 Schwelle kommt aus dem Katalog, nicht aus dem Code', () => {
  const eigene = { ...R, parameters: { threshold: { value: 100, currency: 'EUR' } } };
  assert.equal(pruefeORG06(akte({ ursprungswert: 101, rex_nummer: null }), eigene, DEFAULTS).status, 'verletzt');
});
