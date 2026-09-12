import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pruefeAkte, regelGiltAm, entscheideFreigabe, FREIGABE } from '../src/regelwerk.mjs';
import { REGELN } from '../src/regeln/index.mjs';
import { eingangAus, KATALOG } from './hilfen.mjs';

test('Jede Katalogregel hat eine Implementierung und umgekehrt', () => {
  const katalog = KATALOG.regeln.rules.map((r) => r.id).sort();
  const register = Object.keys(REGELN).sort();
  assert.deepEqual(register, katalog);
});

test('regelGiltAm: valid_from inklusiv, valid_to exklusiv', () => {
  const r = { valid_from: '2026-09-12', valid_to: '2027-01-01' };
  assert.equal(regelGiltAm(r, '2026-09-11'), false);
  assert.equal(regelGiltAm(r, '2026-09-12'), true);
  assert.equal(regelGiltAm(r, '2026-12-31'), true);
  assert.equal(regelGiltAm(r, '2027-01-01'), false);
  assert.equal(regelGiltAm({ valid_from: '2026-09-12' }, '2099-01-01'), true);
});

test('Freigabeentscheidung: hart blockiert, Nachextraktion vor Warnung, weich warnt', () => {
  const pm = { befunde: [] };
  assert.equal(entscheideFreigabe([], pm), FREIGABE.FREIGABEREIF);
  assert.equal(entscheideFreigabe([{ haerte_effektiv: 'soft', status: 'verletzt' }], pm), FREIGABE.MIT_WARNUNGEN);
  assert.equal(entscheideFreigabe([{ haerte_effektiv: 'hard', status: 'verletzt' }], pm), FREIGABE.BLOCKIERT);
  assert.equal(entscheideFreigabe([{ haerte_effektiv: 'hard', status: 'nicht_pruefbar' }], pm), FREIGABE.BLOCKIERT);
  assert.equal(entscheideFreigabe([{ haerte_effektiv: 'hard', status: 're_extraction_required' }], pm), FREIGABE.NACHEXTRAKTION);
  assert.equal(entscheideFreigabe([], { befunde: [{ status: 'fehlt', haerte: 'hard' }] }), FREIGABE.BLOCKIERT);
  assert.equal(entscheideFreigabe([], { befunde: [{ status: 'fehlt', haerte: 'soft' }] }), FREIGABE.MIT_WARNUNGEN);
});

test('Harte Regeln laufen vor weichen; Ergebnis trägt Regelversion und Rechtsquelle', () => {
  const ergebnis = pruefeAkte(eingangAus({ rechnung: { gesamt: 1 } }), KATALOG, REGELN);
  const haerten = ergebnis.befunde.map((b) => b.haerte);
  const ersterWeicher = haerten.indexOf('soft');
  assert.ok(ersterWeicher > 0);
  assert.ok(haerten.slice(ersterWeicher).every((h) => h === 'soft'));
  assert.match(ergebnis.befunde[0].regelversion, /^0\.1\.0@2026-09-12$/);
  assert.ok(['verified', 'secondary', 'practice'].includes(ergebnis.befunde[0].rechtsquelle_status));
});

test('Regel vor ihrem Gültigkeitsbeginn wird nicht angewendet', () => {
  const ergebnis = pruefeAkte({ ...eingangAus({ rechnung: { gesamt: 1 } }), stichtag: '2020-01-01' }, KATALOG, REGELN);
  assert.equal(ergebnis.befunde.length, 0);
});

test('Unbekannte Belegtypen werden gemeldet, nicht verworfen', () => {
  const eingang = eingangAus({ rechnung: { gesamt: 1 } }, { dokumente: [{ id: 'X-1', typ: 'unclassified', status: 'final' }] });
  const ergebnis = pruefeAkte(eingang, KATALOG, REGELN);
  assert.deepEqual(ergebnis.nicht_klassifiziert, ['X-1']);
});

test('Nachforderungen adressieren den Dateninhaber des fehlenden Feldes', () => {
  const ergebnis = pruefeAkte(eingangAus({ rechnung: { gesamt: 1 } }), KATALOG, REGELN);
  const bl = ergebnis.nachforderungen.find((n) => n.feld === 'bill_of_lading.container_id');
  assert.ok(bl);
  assert.equal(bl.adressat.primaer, 'Seefrachtspediteur/Carrier');
  assert.match(bl.text, /ACTION REQUIRED/);
  assert.match(bl.text, /Akzeptierte Nachweise: bill_of_lading, sea_waybill/);
});

test('Das Ergebnis trägt die Belege der Akte, damit sichtbar wird, was erkannt wurde', () => {
  const eingang = eingangAus({ rechnung: { gesamt: 1 } }, {
    dokumente: [{ id: 'UNK-1', typ: 'unclassified', status: 'final', datei: 'lieferschein.pdf', hinweis: 'Belegtyp nicht erkannt' }],
    extraktion: { version: '0.1.0', ocr: '5.5.0', belege: 4, hinweise: ['lieferschein.pdf: Belegtyp nicht erkannt'] },
  });
  const ergebnis = pruefeAkte(eingang, KATALOG, REGELN);
  const unbekannt = ergebnis.dokumente.find((d) => d.id === 'UNK-1');
  assert.equal(unbekannt.hinweis, 'Belegtyp nicht erkannt');
  assert.equal(unbekannt.datei, 'lieferschein.pdf');
  assert.deepEqual(ergebnis.extraktion.hinweise, ['lieferschein.pdf: Belegtyp nicht erkannt']);
});

test('Ohne Extraktion bleibt das Feld null statt zu fehlen', () => {
  const ergebnis = pruefeAkte(eingangAus({ rechnung: { gesamt: 1 } }), KATALOG, REGELN);
  assert.equal(ergebnis.extraktion, null);
  assert.ok(Array.isArray(ergebnis.dokumente));
});
