// CUS-05: Das Ausfuhrbegleitdokument muss dieselbe Sendung beschreiben wie
// Rechnung und Packliste. Grenzfälle vor der Implementierung aufgeschrieben
// (Command /regel): gleiche Ware auf HS-6 bei achtstelliger KN, abweichende
// Warennummer, abweichender Container, Position nur auf einer Seite, fehlende
// Eingabe, unsichere Lesung.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pruefeCUS05 } from '../../src/regeln/CUS-05.mjs';
import { akteAus, regel, DEFAULTS } from '../hilfen.mjs';

const R = regel('CUS-05');

const RECHNUNG = { positionen: [{ nr: 1, hs6: '841330' }, { nr: 2, hs6: '848420' }] };
const PACKLISTE = { container_id: 'MSKU1234565' };
const ABD = {
  mrn: '26DE5100001234567A',
  container_id: 'MSKU 123456-5',
  positionen: [{ nr: 1, warennummer: '84133080' }, { nr: 2, warennummer: '84842000' }],
};

test('CUS-05 KN-8 auf dem ABD deckt HS-6 der Rechnung, Container nach Normalisierung gleich', () => {
  const b = pruefeCUS05(akteAus({ rechnung: RECHNUNG, packliste: PACKLISTE, abd: ABD }), R, DEFAULTS);
  assert.equal(b.status, 'ok');
  assert.match(b.begruendung, /2 Positionen/);
});

test('CUS-05 abweichende Warennummer auf dem ABD', () => {
  const abd = { ...ABD, positionen: [{ nr: 1, warennummer: '84133080' }, { nr: 2, warennummer: '84841000' }] };
  const b = pruefeCUS05(akteAus({ rechnung: RECHNUNG, packliste: PACKLISTE, abd }), R, DEFAULTS);
  assert.equal(b.status, 'verletzt');
  assert.match(b.begruendung, /Position 2: Rechnung 848420, ABD 848410/);
});

test('CUS-05 abweichender Container zwischen ABD und Packliste', () => {
  const abd = { ...ABD, container_id: 'HLXU8765430' };
  const b = pruefeCUS05(akteAus({ rechnung: RECHNUNG, packliste: PACKLISTE, abd }), R, DEFAULTS);
  assert.equal(b.status, 'verletzt');
  assert.match(b.begruendung, /Container: ABD HLXU8765430, Packliste MSKU1234565/);
});

test('CUS-05 eine Position, die nur auf einer Seite steht, ist eine Abweichung', () => {
  const nurAbd = { ...ABD, positionen: [...ABD.positionen, { nr: 3, warennummer: '848420' }] };
  assert.match(pruefeCUS05(akteAus({ rechnung: RECHNUNG, packliste: PACKLISTE, abd: nurAbd }), R, DEFAULTS).begruendung, /Position 3 nur im ABD/);
  const nurRechnung = { ...ABD, positionen: [ABD.positionen[0]] };
  assert.match(pruefeCUS05(akteAus({ rechnung: RECHNUNG, packliste: PACKLISTE, abd: nurRechnung }), R, DEFAULTS).begruendung, /Position 2 nur auf der Rechnung/);
});

test('CUS-05 ohne ABD nicht prüfbar, ohne Rechnung nicht prüfbar', () => {
  const ohneAbd = pruefeCUS05(akteAus({ rechnung: RECHNUNG, packliste: PACKLISTE }), R, DEFAULTS);
  assert.equal(ohneAbd.status, 'nicht_pruefbar');
  assert.deepEqual(ohneAbd.fehlende_pfade, ['abd.positionen', 'abd.container_id']);
  assert.equal(pruefeCUS05(akteAus({ abd: ABD }), R, DEFAULTS).status, 'nicht_pruefbar');
});

test('CUS-05 ohne Packliste wird nur die Ware verglichen', () => {
  const b = pruefeCUS05(akteAus({ rechnung: RECHNUNG, abd: ABD }), R, DEFAULTS);
  assert.equal(b.status, 'ok');
  assert.match(b.begruendung, /Container nicht vergleichbar/);
});

test('CUS-05 unsicher gelesene Warennummer verlangt Nachlesen statt Ablehnung', () => {
  const abd = { ...ABD, positionen: [{ nr: 1, warennummer: '84133080' }, { nr: 2, warennummer: '84841000' }] };
  const b = pruefeCUS05(
    akteAus({ rechnung: RECHNUNG, packliste: PACKLISTE, abd }, { konfidenzen: { 'abd.positionen.1.warennummer': DEFAULTS.low_confidence_below / 2 } }),
    R,
    DEFAULTS,
  );
  assert.equal(b.status, 're_extraction_required');
  assert.deepEqual(b.nachzulesende_pfade, ['abd.positionen.1.warennummer']);
});
