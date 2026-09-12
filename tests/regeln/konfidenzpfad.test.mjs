// Lesefehler vor Fachfehler, über alle Regeln hinweg.
//
// CLAUDE.md, harte Grenze 3: Ein Befund, der auf unsicher gelesenen Werten
// beruht, ist zuerst ein Lesefehler. Bis Stufe 3 kannten nur TRN-01, TRN-02
// und VAL-01 diesen Pfad — eine falsch gelesene Menge blockierte die Akte
// fachlich. Diese Suite hält fest, welche Regeln ihn tragen und welche
// nicht, und warum.
//
// Der Aufbau ist überall gleich: derselbe Verstoß zweimal, einmal mit hoher
// und einmal mit niedriger Konfidenz auf dem Wert, auf dem der Befund
// beruht. Hohe Konfidenz muss `verletzt` ergeben, niedrige
// `re_extraction_required`.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { pruefeCLS01 } from '../../src/regeln/CLS-01.mjs';
import { pruefeCLS02 } from '../../src/regeln/CLS-02.mjs';
import { pruefeORG02 } from '../../src/regeln/ORG-02.mjs';
import { pruefeORG06 } from '../../src/regeln/ORG-06.mjs';
import { pruefeQTY01 } from '../../src/regeln/QTY-01.mjs';
import { pruefeQTY02 } from '../../src/regeln/QTY-02.mjs';
import { pruefeQTY03 } from '../../src/regeln/QTY-03.mjs';
import { pruefeREF03 } from '../../src/regeln/REF-03.mjs';
import { pruefeVAL03 } from '../../src/regeln/VAL-03.mjs';
import { unsicherGelesen } from '../../src/regeln/befund.mjs';
import { akteAus, regel, DEFAULTS, ZUGRIFF } from '../hilfen.mjs';

/** Unterhalb der Katalogschwelle — der Wert gilt als unsicher gelesen. */
const UNSICHER = DEFAULTS.low_confidence_below / 2;

/**
 * Prüft beide Richtungen einer Regel mit demselben Verstoß.
 * `bereiche` beschreibt die Akte, `pfad` den Wert, der unsicher gelesen wird.
 */
function beideRichtungen(name, pruefer, bereiche, pfad, argumente = []) {
  test(`${name}: hohe Konfidenz verletzt, niedrige verlangt Nachlesen`, () => {
    const sicher = pruefer(akteAus(bereiche), ...argumente);
    assert.equal(sicher.status, 'verletzt', `${name} sollte bei sicherer Lesung verletzt sein`);

    const unsicher = pruefer(akteAus(bereiche, { konfidenzen: { [pfad]: UNSICHER } }), ...argumente);
    assert.equal(
      unsicher.status,
      're_extraction_required',
      `${name} sollte bei unsicherer Lesung von ${pfad} nachlesen lassen, nicht ablehnen`,
    );
    assert.ok(unsicher.nachzulesende_pfade.includes(pfad), `${name} muss ${pfad} als nachzulesen nennen`);
    assert.match(unsicher.begruendung, /zuerst nachlesen/);
  });
}

beideRichtungen(
  'QTY-01 Menge',
  pruefeQTY01,
  { rechnung: { positionen: [{ nr: 1, menge: 12 }] }, packliste: { positionen: [{ nr: 1, menge: 11 }] } },
  'packliste.positionen.0.menge',
  [null, DEFAULTS],
);

beideRichtungen(
  'QTY-02 Bruttogewicht',
  pruefeQTY02,
  { packliste: { brutto_gesamt_kg: 1000 }, bill_of_lading: { brutto_kg: 1050 } },
  'bill_of_lading.brutto_kg',
  [regel('QTY-02'), DEFAULTS],
);

beideRichtungen(
  'QTY-03 Gewichtslogik',
  pruefeQTY03,
  { packliste: { packstuecke: [{ id: 'P1', brutto_kg: 9, netto_kg: 10 }] } },
  'packliste.packstuecke.0.brutto_kg',
  [null, DEFAULTS],
);

beideRichtungen(
  'CLS-01 HS-Code',
  pruefeCLS01,
  { rechnung: { positionen: [{ nr: 1, hs6: '841330' }] }, packliste: { positionen: [{ nr: 1, hs6: '841350' }] } },
  'packliste.positionen.0.hs6',
  [regel('CLS-01'), DEFAULTS],
);

beideRichtungen(
  'ORG-02 Ursprung',
  pruefeORG02,
  {
    rechnung: { positionen: [{ nr: 1, hs6: '841330', ursprung: 'CN' }] },
    praeferenznachweis: { typ: 'origin_declaration', ursprung: 'DE', warenkreis: [{ pos: 1, hs6: '841330' }] },
  },
  'rechnung.positionen.0.ursprung',
  [regel('ORG-02'), DEFAULTS, ZUGRIFF],
);

beideRichtungen(
  'ORG-06 Wertgrenze',
  pruefeORG06,
  {
    rechnung: { waehrung: 'EUR' },
    praeferenznachweis: { typ: 'origin_declaration', ursprungswert: 6001, rex_nummer: null },
  },
  'praeferenznachweis.ursprungswert',
  [regel('ORG-06'), DEFAULTS],
);

beideRichtungen(
  'VAL-03 kostenlose Position',
  pruefeVAL03,
  { rechnung: { positionen: [{ nr: 1, einzelpreis: 0, netto: 0, zollwert: null, bewertungsmethode: null }] } },
  'rechnung.positionen.0.einzelpreis',
  [null, DEFAULTS],
);

test('Ein unsicherer Wert, der am Befund nicht beteiligt war, hebt die Ablehnung nicht auf', () => {
  // QTY-01 vergleicht Mengen. Eine unsicher gelesene Warennummer daneben ist
  // für diesen Befund gleichgültig — sonst könnte ein einziges schlecht
  // gelesenes Feld jede Ablehnung der Akte entwerten.
  const bereiche = {
    rechnung: { positionen: [{ nr: 1, menge: 12, hs6: '841330' }] },
    packliste: { positionen: [{ nr: 1, menge: 11, hs6: '841330' }] },
  };
  const akte = akteAus(bereiche, { konfidenzen: { 'rechnung.positionen.0.hs6': UNSICHER } });
  assert.equal(pruefeQTY01(akte, null, DEFAULTS).status, 'verletzt');
});

test('unsicherGelesen liefert genau die Pfade unter der Schwelle', () => {
  const akte = akteAus(
    { rechnung: { positionen: [{ nr: 1, menge: 1, hs6: '841330' }] } },
    { konfidenzen: { 'rechnung.positionen.0.menge': UNSICHER } },
  );
  const pfade = ['rechnung.positionen.0.menge', 'rechnung.positionen.0.hs6'];
  assert.deepEqual(unsicherGelesen(akte, pfade, DEFAULTS), ['rechnung.positionen.0.menge']);
  // Genau auf der Schwelle gilt als sicher: `<` und nicht `<=`.
  const genau = akteAus(
    { rechnung: { positionen: [{ nr: 1, menge: 1 }] } },
    { konfidenzen: { 'rechnung.positionen.0.menge': DEFAULTS.low_confidence_below } },
  );
  assert.deepEqual(unsicherGelesen(genau, ['rechnung.positionen.0.menge'], DEFAULTS), []);
});

test('Drei Regeln tragen den Pfad bewusst nicht — ihre Eingaben kommen nicht aus der Extraktion', () => {
  // CLS-02 liest `anmeldung.*` — Stammdaten, die ein Mensch eingibt.
  const cls02 = pruefeCLS02(
    akteAus({ anmeldung: { richtung: 'export', warennummern: ['8413'] } }, {}),
    regel('CLS-02'),
    DEFAULTS,
  );
  assert.equal(cls02.status, 'verletzt');

  // REF-03 liest den Dokumentstatus, keinen extrahierten Feldwert.
  const ref03 = pruefeREF03(
    akteAus({ bill_of_lading: { container_id: 'MSKU1234565' } }, { status: { bill_of_lading: 'draft' } }),
  );
  assert.equal(ref03.status, 'verletzt');
});
