// Die sieben Akten aus testdaten/akten/ sind der Demo-Inhalt. Jede trägt ihre
// Erwartung im Feld `erwartung`; dieser Test hält Generator, Regelwerk und
// Erwartung zusammen. Ändert sich eine Regel, fällt es hier auf.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pruefeAkte } from '../src/regelwerk.mjs';
import { REGELN } from '../src/regeln/index.mjs';
import { KATALOG } from './hilfen.mjs';
import { WURZEL } from '../src/katalog.mjs';

const ordner = join(WURZEL, 'testdaten', 'akten');
const dateien = readdirSync(ordner).filter((d) => d.endsWith('.json'));

test('Es gibt mindestens die sechs Pflichtakten aus PROJECT.md', () => {
  for (const name of ['happy-path', 'praeferenznachweis-fehlt', 'ursprungswiderspruch', 'container-abweichung', 'draft-bl', 'schlechter-scan']) {
    assert.ok(dateien.includes(`${name}.json`), `${name}.json fehlt`);
  }
});

for (const datei of dateien) {
  test(`Akte ${datei} liefert die erwartete Entscheidung`, () => {
    const eingang = JSON.parse(readFileSync(join(ordner, datei), 'utf8'));
    const ergebnis = pruefeAkte(eingang, KATALOG, REGELN);
    assert.equal(ergebnis.freigabe, eingang.erwartung.freigabe, ergebnis.befunde.filter((b) => b.status !== 'ok').map((b) => `${b.regel}: ${b.begruendung}`).join('\n'));

    const gemeldet = ergebnis.befunde.filter((b) => b.status !== 'ok').map((b) => b.regel).sort();
    assert.deepEqual(gemeldet, [...eingang.erwartung.regeln].sort());

    const pflicht = ergebnis.pflichtmatrix.befunde.filter((b) => b.status !== 'ok').map((b) => b.id).sort();
    assert.deepEqual(pflicht, [...(eingang.erwartung.pflicht ?? [])].sort());
  });
}

test('Testdaten enthalten keine echten Firmen: alle Hashes sind als synthetisch markiert', () => {
  for (const datei of dateien) {
    const eingang = JSON.parse(readFileSync(join(ordner, datei), 'utf8'));
    for (const d of eingang.dokumente) assert.match(d.hash, /^sha256:synthetisch-/);
  }
});
