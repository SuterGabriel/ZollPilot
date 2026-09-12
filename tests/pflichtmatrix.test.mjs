import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pruefePflichtmatrix } from '../src/pflichtmatrix.mjs';
import { akteAus, KATALOG } from './hilfen.mjs';

const M = KATALOG.pflichtmatrix;
const befund = (ergebnis, id) => ergebnis.befunde.find((b) => b.id === id);

test('Pflichtmatrix: EUR.1 und Ursprungserklärung erfüllen dieselbe Anforderung', () => {
  const eur1 = akteAus({ praeferenznachweis: { typ: 'eur1', ursprung: 'DE' } });
  const erklaerung = akteAus({ praeferenznachweis: { typ: 'origin_declaration', ursprung: 'DE' } });
  assert.equal(befund(pruefePflichtmatrix(eur1, M), 'PFL-05').status, 'ok');
  assert.equal(befund(pruefePflichtmatrix(erklaerung, M), 'PFL-05').status, 'ok');
});

test('Pflichtmatrix: A.TR ist kein zugelassener Nachweis für den Präferenzursprung', () => {
  const atr = akteAus({ praeferenznachweis: { typ: 'atr', ursprung: 'TR' } });
  const b = befund(pruefePflichtmatrix(atr, M), 'PFL-05');
  assert.equal(b.status, 'falscher_nachweis');
});

test('Pflichtmatrix: ohne Präferenzanspruch entfällt PFL-05', () => {
  const akte = akteAus({ sachverhalt: { richtung: 'export_third_country', verkehrstraeger: 'sea', praeferenz_beansprucht: false } });
  const ergebnis = pruefePflichtmatrix(akte, M);
  assert.equal(ergebnis.anwendbar, false, 'die MVP-Matrix gilt nur mit Präferenzanspruch');
});

test('Pflichtmatrix: fehlender Wert ist ein Befund mit akzeptierten Nachweisen', () => {
  const b = befund(pruefePflichtmatrix(akteAus({}), M), 'PFL-04');
  assert.equal(b.status, 'fehlt');
  assert.deepEqual(b.akzeptierte_nachweise, ['bill_of_lading', 'sea_waybill']);
});

test('Pflichtmatrix: Stammdaten brauchen keine Belegherkunft', () => {
  const akte = akteAus({ sachverhalt: { richtung: 'export_third_country', verkehrstraeger: 'sea', praeferenz_beansprucht: true, incoterm: { code: 'FOB' } } });
  assert.equal(befund(pruefePflichtmatrix(akte, M), 'PFL-06').status, 'ok');
});
