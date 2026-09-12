import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baueAkte, setzePfad, liesPfad, fakt, konfidenz } from '../src/akte/aufbau.mjs';

test('setzePfad und liesPfad: Punktpfade mit Arrays', () => {
  const ziel = {};
  setzePfad(ziel, 'rechnung.positionen.0.menge', 12);
  setzePfad(ziel, 'rechnung.positionen.1.menge', 3);
  setzePfad(ziel, 'rechnung.gesamt', 100);
  assert.deepEqual(ziel, { rechnung: { positionen: [{ menge: 12 }, { menge: 3 }], gesamt: 100 } });
  assert.equal(liesPfad(ziel, 'rechnung.positionen.1.menge'), 3);
  assert.equal(liesPfad(ziel, 'rechnung.nix.da'), undefined);
});

test('Nur finale Dokumente werden zu Fakten; Drafts bleiben Assertions', () => {
  const akte = baueAkte({
    dokumente: [
      { id: 'BL-DRAFT', typ: 'bill_of_lading', status: 'draft' },
      { id: 'BL-FINAL', typ: 'bill_of_lading', status: 'final' },
    ],
    assertions: [
      { dokument: 'BL-DRAFT', pfad: 'bill_of_lading.container_id', wert: 'DRAFT0000000', konfidenz: 0.9 },
      { dokument: 'BL-FINAL', pfad: 'bill_of_lading.container_id', wert: 'MSKU1234565', konfidenz: 0.7 },
      { dokument: 'UNBEKANNT', pfad: 'x.y', wert: 1 },
    ],
  });
  assert.equal(fakt(akte, 'bill_of_lading.container_id'), 'MSKU1234565');
  assert.equal(konfidenz(akte, 'bill_of_lading.container_id'), 0.7);
  assert.equal(akte.herkunft['bill_of_lading.container_id'].dokument, 'BL-FINAL');
  assert.equal(akte.nicht_final.length, 1);
  assert.equal(akte.nicht_final[0].dokument_status, 'draft');
  assert.equal(akte.unbekannte_dokumente.length, 1, 'nichts stillschweigend verwerfen');
  assert.equal(akte.assertions.length, 3, 'Assertions bleiben unverändert');
});

test('Konfidenz ohne Herkunft ist 1 (Stammdatum, kein Extraktionsergebnis)', () => {
  const akte = baueAkte({ sachverhalt: { richtung: 'export_third_country' }, dokumente: [], assertions: [] });
  assert.equal(fakt(akte, 'sachverhalt.richtung'), 'export_third_country');
  assert.equal(konfidenz(akte, 'sachverhalt.richtung'), 1);
});
