// Das Gate wird selbst getestet. Ein Gate, das nichts meldet, sieht aus wie ein
// Gate, das zufrieden ist (docs/ARBEITSWEISE.md, Teil 4). Die Fixtures unter
// scripts/fixtures/regel-check/ sind die Fälle, die stumm bleiben könnten.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pruefeKatalog, nackteZahlen, ohneLiterale, mvpIdsAus, liesRepo, WURZEL } from './regel-check.mjs';

const fixture = (name) => readFileSync(join(WURZEL, 'scripts', 'fixtures', 'regel-check', name), 'utf8');
const fehler = (befunde) => befunde.filter((b) => b.art === 'FEHLER').map((b) => b.text);

const regel = (id, extra = {}) => ({
  id, name: id, hardness: 'hard', risk: 'financial', inputs: ['x'], assertion: 'x', legal_basis: 'Art. 1', legal_source: 'secondary', consequence: 'y', valid_from: '2026-09-12', ...extra,
});
const pflicht = { entries: [{ id: 'PFL-01', required_data: 'x', required_evidence: ['a'], required_document_form: 'none', hardness: 'hard', legal_basis: 'z', legal_source: 'secondary' }] };
const sauber = {
  regeln: { catalog: { version: '1' }, rules: [regel('VAL-01')] },
  pflichtmatrix: pflicht,
  mvpIds: new Set(['VAL-01']),
  regelDateien: { 'VAL-01': 'export function pruefeVAL01() { return 1; }' },
  testDateien: new Set(['VAL-01']),
};

test('Ein sauberer Stand hat keine Fehler', () => {
  assert.deepEqual(fehler(pruefeKatalog(sauber)), []);
});

test('Leerer Katalog ist ein Fehler, kein Erfolg', () => {
  const b = pruefeKatalog({ ...sauber, regeln: { catalog: { version: '1' }, rules: [] } });
  assert.match(fehler(b)[0], /keine Grundlage, kein Erfolg/);
});

test('Fehlendes Pflichtfeld, doppelte ID, falscher Wertebereich', () => {
  const kaputt = { ...sauber, regeln: { catalog: { version: '1' }, rules: [regel('VAL-01', { legal_source: undefined }), regel('VAL-01', { risk: 'egal' })] } };
  const f = fehler(pruefeKatalog(kaputt));
  assert.ok(f.some((t) => /Pflichtfeld legal_source fehlt/.test(t)));
  assert.ok(f.some((t) => /ID doppelt/.test(t)));
  assert.ok(f.some((t) => /risk egal unbekannt/.test(t)));
});

test('docs/03 und Katalog müssen in beide Richtungen übereinstimmen', () => {
  const f1 = fehler(pruefeKatalog({ ...sauber, mvpIds: new Set() }));
  assert.ok(f1.some((t) => /nicht als \[MVP\] markiert/.test(t)));
  const f2 = fehler(pruefeKatalog({ ...sauber, mvpIds: new Set(['VAL-01', 'VAL-02']) }));
  assert.ok(f2.some((t) => /VAL-02: in docs\/03 als \[MVP\] markiert, aber nicht im Katalog/.test(t)));
});

test('Regel ohne Implementierung, ohne Test, und Datei ohne Katalog', () => {
  assert.ok(fehler(pruefeKatalog({ ...sauber, regelDateien: {} })).some((t) => /src\/regeln\/VAL-01.mjs fehlt/.test(t)));
  assert.ok(fehler(pruefeKatalog({ ...sauber, testDateien: new Set() })).some((t) => /tests\/regeln\/VAL-01.test.mjs fehlt/.test(t)));
  const fremd = { ...sauber, regelDateien: { ...sauber.regelDateien, 'VAL-09': 'x' } };
  assert.ok(fehler(pruefeKatalog(fremd)).some((t) => /VAL-09.mjs existiert ohne Katalogregel/.test(t)));
});

test('Fixture: nackte Schwelle im Regelcode wird gefunden', () => {
  const z = nackteZahlen(fixture('NackteZahl.mjs'));
  assert.deepEqual(z.map((x) => x.zahl), ['6000', '0.1']);
});

test('Fixture: Zahlen in Regex, Strings, Templates und Kommentaren sind keine nackten Zahlen', () => {
  assert.deepEqual(nackteZahlen(fixture('NurLiterale.mjs')), []);
});

test('Fixture: 0, 1 und 2 sind erlaubt — bewusste Lücke, siehe ADR-002', () => {
  assert.deepEqual(nackteZahlen(fixture('NullEinsZwei.mjs')), []);
});

test('ohneLiterale erhält Zeilennummern', () => {
  const text = "const a = 'x\\'y';\n// 42\nconst b = /[0-9]{3}/; const c = 7;";
  const bereinigt = ohneLiterale(text);
  assert.equal(bereinigt.split('\n').length, 3);
  assert.deepEqual(nackteZahlen(text).map((z) => [z.zeile, z.zahl]), [[3, '7']]);
});

test('Division wird nicht als Regex gelesen', () => {
  assert.deepEqual(nackteZahlen('const x = summe / anzahl; const y = a / 3;').map((z) => z.zahl), ['3']);
});

test('mvpIdsAus liest nur markierte Zeilen', () => {
  const md = '| VAL-01 **[MVP]** | a |\n| VAL-02 | b |\n| ORG-06 **[MVP]** | c |';
  assert.deepEqual([...mvpIdsAus(md)].sort(), ['ORG-06', 'VAL-01']);
});

test('Das echte Repo besteht den Check', () => {
  assert.deepEqual(fehler(pruefeKatalog(liesRepo())), []);
});
