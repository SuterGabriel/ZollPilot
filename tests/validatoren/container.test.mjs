import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buchstabenwert, containerPruefziffer, pruefeContainerId, normalisiereContainerId } from '../../src/validatoren/container.mjs';

test('Buchstabenwerte lassen Vielfache von 11 aus', () => {
  assert.equal(buchstabenwert('A'), 10);
  assert.equal(buchstabenwert('B'), 12);
  assert.equal(buchstabenwert('K'), 21);
  assert.equal(buchstabenwert('L'), 23);
  assert.equal(buchstabenwert('U'), 32);
  assert.equal(buchstabenwert('Z'), 38);
});

test('Referenzbeispiel des Standards: CSQU3054383', () => {
  assert.equal(containerPruefziffer('CSQU305438'), 3);
  assert.deepEqual(pruefeContainerId('CSQU3054383'), { id: 'CSQU3054383', format: true, pruefziffer: true, erwartet: 3 });
});

test('Rest 10 wird als 0 dargestellt', () => {
  // MSKU123457 hat Rest 10 → Prüfziffer 0 (im Generator der Testakten berechnet).
  assert.equal(containerPruefziffer('MSKU123457'), 0);
  assert.equal(pruefeContainerId('MSKU1234570').pruefziffer, true);
});

test('Normalisierung: Leerzeichen, Bindestrich, Kleinschreibung', () => {
  assert.equal(normalisiereContainerId(' msku 123456-5 '), 'MSKU1234565');
  assert.equal(pruefeContainerId('msku 123456-5').pruefziffer, true);
});

test('Formatfehler und Prüfziffernfehler sind getrennte Signale', () => {
  assert.deepEqual(pruefeContainerId('MSK1234565'), { id: 'MSK1234565', format: false, pruefziffer: false, erwartet: null });
  assert.deepEqual(pruefeContainerId('MSKU1234568'), { id: 'MSKU1234568', format: true, pruefziffer: false, erwartet: 5 });
  assert.equal(pruefeContainerId('MSKA1234565').format, false, 'Kategorie muss U, J oder Z sein');
  assert.equal(pruefeContainerId(null).format, false);
});
