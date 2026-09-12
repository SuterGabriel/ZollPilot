import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gleicheAb, STATUS_ERLEDIGT, STATUS_OFFEN } from '../../src/nachforderung/abgleich.mjs';

const JETZT = '2026-09-12T10:00:00Z';
const neu = (grund, feld, extra = {}) => ({
  grund, feld, betreff: `Betreff ${grund}`, text: `Text ${grund}`,
  adressat: { primaer: 'Lieferant/Verkäufer', sekundaer: 'Einkauf' }, ...extra,
});
const offen = (grund, feld, extra = {}) => ({
  id: 1, akte_id: 'ZP-1', grund, feld, status: STATUS_OFFEN, stufe: 'erinnerung_0',
  letzter_versand_am: '2026-09-10T08:00:00Z', eroeffnet_am: '2026-09-10T08:00:00Z', ...extra,
});

test('Ein neuer Fall wird eröffnet, ohne Stufe, mit Zeitpunkt und Adressat', () => {
  const { eroeffnen, behalten, schliessen } = gleicheAb([], [neu('PFL-05', 'praeferenznachweis.ursprung')], JETZT);
  assert.equal(eroeffnen.length, 1);
  assert.equal(behalten.length, 0);
  assert.equal(schliessen.length, 0);
  assert.equal(eroeffnen[0].stufe, null);
  assert.equal(eroeffnen[0].status, STATUS_OFFEN);
  assert.equal(eroeffnen[0].eroeffnet_am, JETZT);
  assert.equal(eroeffnen[0].adressat, 'Lieferant/Verkäufer');
  assert.equal(eroeffnen[0].adressat_kopie, 'Einkauf');
});

test('Derselbe Fall bleibt derselbe Fall: keine zweite Eröffnung, Stufe und Versanddatum bleiben', () => {
  const bestehend = offen('PFL-05', 'praeferenznachweis.ursprung');
  const { eroeffnen, behalten, schliessen } = gleicheAb([bestehend], [neu('PFL-05', 'praeferenznachweis.ursprung', { text: 'neuer Text' })], JETZT);
  assert.equal(eroeffnen.length, 0);
  assert.equal(schliessen.length, 0);
  assert.equal(behalten.length, 1);
  assert.equal(behalten[0].stufe, 'erinnerung_0');
  assert.equal(behalten[0].letzter_versand_am, '2026-09-10T08:00:00Z');
  assert.equal(behalten[0].text, 'neuer Text', 'die Begründung darf mit der neuen Prüfung mitgehen');
});

test('Ein Fall, den die neue Prüfung nicht mehr nennt, ist erledigt', () => {
  const bestehend = offen('ORG-02', 'praeferenznachweis.ursprung');
  const { schliessen } = gleicheAb([bestehend], [], JETZT);
  assert.equal(schliessen.length, 1);
  assert.equal(schliessen[0].status, STATUS_ERLEDIGT);
  assert.equal(schliessen[0].geschlossen_am, JETZT);
  assert.equal(schliessen[0].id, 1, 'die Zeile wird geschlossen, nicht ersetzt');
});

test('Grund und Feld bilden den Schlüssel: gleicher Grund, anderes Feld ist ein anderer Fall', () => {
  const bestehend = offen('QTY-01', 'rechnung.positionen.0.menge');
  const { eroeffnen, schliessen } = gleicheAb([bestehend], [neu('QTY-01', 'rechnung.positionen.1.menge')], JETZT);
  assert.equal(eroeffnen.length, 1);
  assert.equal(schliessen.length, 1);
});

test('Leere Eingaben sind erlaubt und ergeben nichts', () => {
  assert.deepEqual(gleicheAb(undefined, undefined, JETZT), { eroeffnen: [], behalten: [], schliessen: [] });
});
