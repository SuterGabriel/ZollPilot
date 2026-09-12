import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pruefeQTY03 } from '../../src/regeln/QTY-03.mjs';
import { akteAus } from '../hilfen.mjs';

const mit = (packstuecke, brutto_gesamt_kg) => akteAus({ packliste: { packstuecke, ...(brutto_gesamt_kg !== undefined ? { brutto_gesamt_kg } : {}) } });

test('QTY-03 brutto ≥ netto > 0', () => {
  assert.equal(pruefeQTY03(mit([{ id: 'P1', brutto_kg: 10, netto_kg: 9 }])).status, 'ok');
  assert.equal(pruefeQTY03(mit([{ id: 'P1', brutto_kg: 10, netto_kg: 10 }])).status, 'ok', 'gleich ist erlaubt');
  assert.equal(pruefeQTY03(mit([{ id: 'P1', brutto_kg: 9, netto_kg: 10 }])).status, 'verletzt', 'vertauscht');
  assert.equal(pruefeQTY03(mit([{ id: 'P1', brutto_kg: 10, netto_kg: 0 }])).status, 'verletzt', 'netto 0');
  assert.equal(pruefeQTY03(mit([{ id: 'P1', brutto_kg: 10 }])).status, 'verletzt', 'netto fehlt');
});

test('QTY-03 Packstücksumme darf das Gesamtbrutto nicht übersteigen', () => {
  assert.equal(pruefeQTY03(mit([{ id: 'P1', brutto_kg: 10, netto_kg: 9 }, { id: 'P2', brutto_kg: 10, netto_kg: 9 }], 20)).status, 'ok');
  assert.equal(pruefeQTY03(mit([{ id: 'P1', brutto_kg: 10, netto_kg: 9 }, { id: 'P2', brutto_kg: 10, netto_kg: 9 }], 19)).status, 'verletzt');
});

test('QTY-03 ohne Packstücke nicht prüfbar', () => {
  assert.equal(pruefeQTY03(akteAus({})).status, 'nicht_pruefbar');
});
