import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pruefeAwb } from '../../src/validatoren/awb.mjs';
import { pruefeUstIdDe, ustIdPruefziffer } from '../../src/validatoren/ustid.mjs';
import { formatGueltig, pruefeIncoterm, INCOTERMS_2020 } from '../../src/validatoren/formate.mjs';

test('AWB: Seriennummer modulo 7 ergibt die achte Ziffer', () => {
  // 1234567 mod 7 = 5
  assert.equal(pruefeAwb('020-12345675').pruefziffer, true);
  assert.equal(pruefeAwb('02012345675').praefix, '020');
  assert.equal(pruefeAwb('020-12345670').pruefziffer, false);
  assert.equal(pruefeAwb('20-12345675').format, false);
});

test('USt-IdNr. DE: MOD 11,10 gegen ein bekanntes Beispiel', () => {
  assert.equal(pruefeUstIdDe('DE136695976').pruefziffer, true);
  assert.equal(pruefeUstIdDe('DE 136 695 976').pruefziffer, true, 'Leerzeichen werden normalisiert');
  assert.equal(pruefeUstIdDe('DE123456789').pruefziffer, false);
  assert.equal(pruefeUstIdDe('ATU12345678').format, false, 'nur das deutsche Format');
  assert.equal(ustIdPruefziffer('13669597'), 6);
});

test('Formate: Regex beweist nur das Format', () => {
  assert.equal(formatGueltig('eori', 'DE123456789012345'), true);
  assert.equal(formatGueltig('eori', 'de123'), false);
  assert.equal(formatGueltig('mrn', '26DE123456789012A5'), true);
  assert.equal(formatGueltig('mrn', '26DE1234'), false);
  assert.equal(formatGueltig('rex', 'DEREX12345678'), true);
  assert.equal(formatGueltig('rex', 'REX12345'), false);
  assert.equal(formatGueltig('unlocode', 'DEHAM'), true);
  assert.equal(formatGueltig('unlocode', 'DEHA1'), false, 'Ziffer 1 ist im UN/LOCODE nicht erlaubt');
  assert.equal(formatGueltig('kn8', '84133080'), true);
  assert.throws(() => formatGueltig('gibtEsNicht', 'x'));
});

test('Incoterm: elf Klauseln, Ort und Edition sind Pflichtangaben mit Warnung', () => {
  assert.equal(INCOTERMS_2020.length, 11);
  assert.deepEqual(pruefeIncoterm({ code: 'FOB', named_place: 'DEHAM', edition: 2020 }).warnungen, []);
  assert.equal(pruefeIncoterm({ code: 'FOB', named_place: 'DEHAM', edition: 2020 }).nurSee, true);
  assert.deepEqual(pruefeIncoterm({ code: 'DAP' }).warnungen, ['benannter Ort fehlt', 'Edition fehlt (erwartet 2020)']);
  assert.equal(pruefeIncoterm({ code: 'DAF' }).gueltig, false, 'DAF gibt es seit 2010 nicht mehr');
  assert.equal(pruefeIncoterm(null).gueltig, false);
});
