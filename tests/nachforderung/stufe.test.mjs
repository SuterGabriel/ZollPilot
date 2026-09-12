import { test } from 'node:test';
import assert from 'node:assert/strict';
import { faelligeStufe, planeVersand, postfach } from '../../src/nachforderung/stufe.mjs';
import { KATALOG } from '../hilfen.mjs';

const Z = KATALOG.zustaendigkeiten;
const FRISTEN = { customs_cutoff: '2026-09-15T16:00:00Z', carrier_cutoff: '2026-09-17T12:00:00Z', eta: '2026-10-20T08:00:00Z' };

test('Katalog: jede Stufe hat bezug und vorlauf_stunden, der Mindestabstand ist eine Zahl', () => {
  for (const s of Z.escalation) {
    assert.ok('bezug' in s, `${s.stufe} ohne bezug`);
    assert.equal(typeof s.vorlauf_stunden, 'number', `${s.stufe} ohne vorlauf_stunden`);
  }
  assert.equal(typeof Z.versand.mindestabstand_stunden, 'number');
});

test('Ein neuer Fall ist sofort fällig: erinnerung_0 braucht keine Frist', () => {
  const e = faelligeStufe({ stufe: null }, {}, Z, '2026-09-12T10:00:00Z');
  assert.equal(e.faellig, true);
  assert.equal(e.stufe, 'erinnerung_0');
});

test('Die nächste Stufe hängt am Cut-off: zu früh nicht fällig, 48 Stunden davor fällig', () => {
  const fall = { stufe: 'erinnerung_0', letzter_versand_am: '2026-09-10T08:00:00Z' };
  const frueh = faelligeStufe(fall, FRISTEN, Z, '2026-09-12T10:00:00Z');
  assert.equal(frueh.faellig, false);
  assert.equal(frueh.stufe, 'erinnerung_1');
  assert.match(frueh.grund, /fällig ab 2026-09-13T16:00:00/);

  const spaet = faelligeStufe(fall, FRISTEN, Z, '2026-09-13T16:00:00Z');
  assert.equal(spaet.faellig, true);
  assert.equal(spaet.stufe, 'erinnerung_1');
  assert.match(spaet.adressat, /Sachbearbeiter/);
});

test('Ohne Cut-off in der Akte ist die Stufe nicht erreichbar, und das steht im Grund', () => {
  const e = faelligeStufe({ stufe: 'erinnerung_0', letzter_versand_am: '2026-09-01T00:00:00Z' }, {}, Z, '2026-12-01T00:00:00Z');
  assert.equal(e.faellig, false);
  assert.match(e.grund, /customs_cutoff nicht in der Akte/);
});

test('Mindestabstand: zwei Stufen an einem Tag gibt es nicht', () => {
  const fall = { stufe: 'erinnerung_0', letzter_versand_am: '2026-09-14T10:00:00Z' };
  const e = faelligeStufe(fall, FRISTEN, Z, '2026-09-14T20:00:00Z');
  assert.equal(e.faellig, false);
  assert.match(e.grund, /Mindestabstand/);
  const morgen = faelligeStufe(fall, FRISTEN, Z, '2026-09-15T10:00:00Z');
  assert.equal(morgen.faellig, true);
});

test('Stop ist die letzte Stufe; danach ist nichts mehr fällig', () => {
  const fall = { stufe: 'eskalation_2', letzter_versand_am: '2026-09-01T00:00:00Z' };
  const stop = faelligeStufe(fall, FRISTEN, Z, '2026-09-17T12:00:00Z');
  assert.equal(stop.faellig, true);
  assert.equal(stop.stufe, 'stop');
  const danach = faelligeStufe({ stufe: 'stop', letzter_versand_am: '2026-09-17T12:00:00Z' }, FRISTEN, Z, '2026-09-30T00:00:00Z');
  assert.equal(danach.faellig, false);
  assert.match(danach.grund, /Letzte Stufe/);
});

test('Unbekannte Stufe und fehlender Zeitpunkt sind Fehler, keine Eskalation', () => {
  assert.equal(faelligeStufe({ stufe: 'erfunden' }, FRISTEN, Z, '2026-09-12T00:00:00Z').faellig, false);
  assert.equal(faelligeStufe({ stufe: null }, FRISTEN, Z, 'kein Datum').faellig, false);
});

test('planeVersand hängt jedem Fall seine Entscheidung an', () => {
  const geplant = planeVersand([{ stufe: null }, { stufe: 'stop', letzter_versand_am: '2026-09-01T00:00:00Z' }], FRISTEN, Z, '2026-09-12T10:00:00Z');
  assert.equal(geplant[0].versand.faellig, true);
  assert.equal(geplant[1].versand.faellig, false);
});

test('Versand kennt die Postfächer: Adressat, Kopie und ab der zweiten Stufe der Stufenadressat', () => {
  assert.equal(postfach('Lieferant/Verkäufer', Z), 'lieferant@zollpilot.test');
  assert.equal(postfach('Unbekannte Rolle', Z), Z.versand.verteiler.standard);
  const [neu] = planeVersand([{ stufe: null, adressat: 'Lieferant/Verkäufer', adressat_kopie: 'Einkauf' }], FRISTEN, Z, '2026-09-12T10:00:00Z');
  assert.deepEqual(neu.versand.an, ['lieferant@zollpilot.test', 'sachbearbeitung@zollpilot.test']);
  const [stufe2] = planeVersand([{ stufe: 'erinnerung_1', letzter_versand_am: '2026-09-13T16:00:00Z', adressat: 'Lieferant/Verkäufer' }], FRISTEN, Z, '2026-09-15T12:00:00Z');
  assert.equal(stufe2.versand.stufe, 'eskalation_1');
  assert.ok(stufe2.versand.an.includes('teamleitung@zollpilot.test'));
});
