// Übersteuern heißt: Verantwortung neben den Befund, nie statt seiner
// (ADR-007). Diese Tests halten genau das fest — ein Befund, der nach der
// Übersteuerung `ok` wäre, wäre der Fehler, den die ADR verhindern soll.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { formfehler, ordneZu, hefteAn, zaehltTrotzUebersteuerung, MINDESTLAENGE_BEGRUENDUNG } from '../src/override.mjs';
import { pruefeAkte, entscheideFreigabe, FREIGABE } from '../src/regelwerk.mjs';
import { REGELN } from '../src/regeln/index.mjs';
import { eingangAus, KATALOG } from './hilfen.mjs';

const FASSUNG = '0.1.0@2026-09-12';
const AKTE_MIT_ABWEICHUNG = new URL('../testdaten/akten/container-abweichung.json', import.meta.url);

function ueber(regel, extra = {}) {
  return {
    regel,
    benutzer: 'G. Suter',
    begruendung: 'Reederei hat den Umlad schriftlich bestätigt, Beleg folgt',
    erzeugt_am: '2026-09-12T10:00:00Z',
    fassung: FASSUNG,
    ...extra,
  };
}

test('Formfehler: alles Nötige da, sonst mit Grund abgelehnt', () => {
  assert.deepEqual(formfehler(ueber('TRN-01')), []);
  assert.deepEqual(formfehler(null), ['kein Objekt']);
  assert.deepEqual(formfehler(ueber('TRN-01', { benutzer: '' })), ['benutzer fehlt']);
  assert.deepEqual(formfehler(ueber('TRN-01', { fassung: undefined })), ['fassung fehlt']);
  assert.deepEqual(formfehler(ueber('TRN-01', { begruendung: 'zu knapp' })),
    [`begruendung braucht mindestens ${MINDESTLAENGE_BEGRUENDUNG} Zeichen`]);
});

test('Die Mindestlänge ist die Grenze, nicht die Schwelle: genau so viel genügt', () => {
  const gerade = 'x'.repeat(MINDESTLAENGE_BEGRUENDUNG);
  assert.deepEqual(formfehler(ueber('TRN-01', { begruendung: gerade })), []);
  assert.equal(formfehler(ueber('TRN-01', { begruendung: gerade.slice(1) })).length, 1);
});

test('Eine Begründung aus lauter Leerzeichen ist keine', () => {
  assert.equal(formfehler(ueber('TRN-01', { begruendung: '              ' })).length, 1);
});

test('Zuordnung: gleiche Fassung gilt, andere Fassung ist verbraucht', () => {
  const alt = ueber('TRN-01', { fassung: '0.0.9@2026-01-01' });
  const neu = ueber('TRN-01');
  const fremd = ueber('VAL-01');
  const { gueltig, verbraucht } = ordneZu([alt, neu, fremd], 'TRN-01', FASSUNG);
  assert.equal(gueltig, neu);
  assert.deepEqual(verbraucht, [alt]);
});

test('Ein formfehlerhafter Override gilt nicht, verschwindet aber nicht', () => {
  const kaputt = ueber('TRN-01', { begruendung: 'passt' });
  const { gueltig, verbraucht } = ordneZu([kaputt], 'TRN-01', FASSUNG);
  assert.equal(gueltig, null);
  assert.deepEqual(verbraucht, [kaputt]);
});

test('hefteAn lässt den Status unberührt und schreibt die Verantwortung daneben', () => {
  const befund = { regel: 'TRN-01', status: 'verletzt', haerte_effektiv: 'hard' };
  const gehaftet = hefteAn(befund, 'TRN-01', FASSUNG, [ueber('TRN-01')]);
  assert.equal(gehaftet.status, 'verletzt');
  assert.equal(gehaftet.uebersteuert_von, 'G. Suter');
  assert.equal(gehaftet.uebersteuert_am, '2026-09-12T10:00:00Z');
  assert.match(gehaftet.uebersteuerungsgrund, /Reederei/);
  assert.equal(befund.uebersteuert_von, undefined, 'der Eingabebefund bleibt unverändert');
});

test('Ohne passenden Override bleibt der Befund derselbe Gegenstand', () => {
  const befund = { regel: 'TRN-01', status: 'verletzt' };
  assert.equal(hefteAn(befund, 'TRN-01', FASSUNG, []), befund);
  assert.equal(hefteAn(befund, 'TRN-01', FASSUNG, [ueber('VAL-01')]), befund);
});

test('Ein verbrauchter Override wird gemeldet, wirkt aber nicht', () => {
  const alt = ueber('TRN-01', { fassung: '0.0.9@2026-01-01' });
  const gehaftet = hefteAn({ regel: 'TRN-01', status: 'verletzt' }, 'TRN-01', FASSUNG, [alt]);
  assert.equal(gehaftet.uebersteuert_von, undefined);
  assert.deepEqual(gehaftet.uebersteuerung_verbraucht, [{ benutzer: 'G. Suter', fassung: '0.0.9@2026-01-01', erzeugt_am: '2026-09-12T10:00:00Z' }]);
  assert.equal(zaehltTrotzUebersteuerung(gehaftet), true);
});

test('entscheideFreigabe: ohne Kennzeichen zählt der übersteuerte Befund weiter', () => {
  const befunde = [{ haerte_effektiv: 'hard', status: 'verletzt', uebersteuert_von: 'G. Suter' }];
  const pm = { befunde: [] };
  assert.equal(entscheideFreigabe(befunde, pm), FREIGABE.BLOCKIERT);
  assert.equal(entscheideFreigabe(befunde, pm, true), FREIGABE.FREIGABEREIF);
});

test('Ein übersteuerter Pflichteintrag hebt die Blockade nur in der zweiten Entscheidung auf', () => {
  const pm = { befunde: [{ status: 'fehlt', haerte: 'hard', uebersteuert_von: 'G. Suter' }] };
  assert.equal(entscheideFreigabe([], pm), FREIGABE.BLOCKIERT);
  assert.equal(entscheideFreigabe([], pm, true), FREIGABE.FREIGABEREIF);
});

test('Ein Lesefehler bleibt stehen, solange er nicht selbst übersteuert ist', () => {
  const befunde = [
    { haerte_effektiv: 'hard', status: 'verletzt', uebersteuert_von: 'G. Suter' },
    { haerte_effektiv: 'soft', status: 're_extraction_required' },
  ];
  assert.equal(entscheideFreigabe(befunde, { befunde: [] }, true), FREIGABE.NACHEXTRAKTION);
});

test('Ohne Overrides trägt das Ergebnis beide Entscheidungen gleich', () => {
  const ergebnis = pruefeAkte(eingangAus({ rechnung: { gesamt: 1 } }), KATALOG, REGELN);
  assert.equal(ergebnis.freigabe, ergebnis.freigabe_nach_override);
  assert.deepEqual(ergebnis.uebersteuerungen, { angewandt: [], verbraucht: [] });
});

test('Ganze Akte: die Übersteuerung von TRN-01 löst die Blockade, ohne den Befund zu ändern', () => {
  const eingang = JSON.parse(readFileSync(AKTE_MIT_ABWEICHUNG, 'utf8'));
  assert.equal(pruefeAkte(eingang, KATALOG, REGELN).freigabe, FREIGABE.BLOCKIERT);

  const mit = pruefeAkte({ ...eingang, overrides: [ueber('TRN-01')] }, KATALOG, REGELN);
  const trn = mit.befunde.find((b) => b.regel === 'TRN-01');
  assert.equal(trn.status, 'verletzt', 'der Befund bleibt, was das Regelwerk gesagt hat');
  assert.equal(trn.uebersteuert_von, 'G. Suter');
  assert.equal(mit.freigabe, FREIGABE.BLOCKIERT, 'die Regelentscheidung ändert sich nie');
  assert.notEqual(mit.freigabe_nach_override, FREIGABE.BLOCKIERT);
  assert.deepEqual(mit.uebersteuerungen.angewandt.map((u) => u.kennung), ['TRN-01']);
});

test('Ganze Akte: ein Override zur falschen Fassung wirkt nicht und wird gemeldet', () => {
  const eingang = JSON.parse(readFileSync(AKTE_MIT_ABWEICHUNG, 'utf8'));
  const mit = pruefeAkte({ ...eingang, overrides: [ueber('TRN-01', { fassung: '0.0.9@2026-01-01' })] }, KATALOG, REGELN);
  assert.equal(mit.freigabe_nach_override, FREIGABE.BLOCKIERT);
  assert.deepEqual(mit.uebersteuerungen.angewandt, []);
  assert.deepEqual(mit.uebersteuerungen.verbraucht.map((u) => u.kennung), ['TRN-01']);
});

test('Ganze Akte: ein Pflichteintrag lässt sich über seine Kennung übersteuern', () => {
  const eingang = eingangAus({ rechnung: { gesamt: 1 } }, {
    overrides: [ueber('PFL-02', { begruendung: 'Nachweis liegt der Zollstelle bereits vor' })],
  });
  const ergebnis = pruefeAkte(eingang, KATALOG, REGELN);
  const pfl = ergebnis.pflichtmatrix.befunde.find((b) => b.id === 'PFL-02');
  assert.equal(pfl.status, 'fehlt');
  assert.equal(pfl.uebersteuert_von, 'G. Suter');
  assert.deepEqual(ergebnis.uebersteuerungen.angewandt.map((u) => u.kennung), ['PFL-02']);
});
