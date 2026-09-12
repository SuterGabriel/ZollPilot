// CLS-01 HS-6 konsistent über alle Belege.
// Rechnung, Packliste und Präferenznachweis müssen je Position dieselben
// ersten Stellen tragen (parameters.digits). Ursprungsregeln sind HS-basiert;
// eine Abweichung ist ein Tarifierungsstreit, bevor er entsteht.
//
// Ein falsch gelesener HS-Code sieht wie eine Abweichung aus. Deshalb der
// Konfidenzpfad (CLAUDE.md, harte Grenze 3).

import { fakt } from '../akte/aufbau.mjs';
import { kuerzeWarencode } from '../normalisierung.mjs';
import { ok, nichtPruefbar, verletztWennSicher } from './befund.mjs';

export const REGEL_CLS_01 = 'CLS-01';

export function pruefeCLS01(akte, regel, defaults) {
  const stellen = regel.parameters.digits;
  const rechnung = fakt(akte, 'rechnung.positionen');
  if (!rechnung) return nichtPruefbar({}, ['rechnung.positionen'], 'Rechnungspositionen fehlen');

  const packliste = fakt(akte, 'packliste.positionen') ?? [];
  const warenkreis = fakt(akte, 'praeferenznachweis.warenkreis') ?? [];
  const eingaben = { stellen, positionen: rechnung.length };
  const abweichungen = [];
  const beteiligt = [];

  rechnung.forEach((p, i) => {
    const referenz = kuerzeWarencode(p.hs6, stellen);
    if (!referenz) {
      abweichungen.push(`Position ${i + 1}: HS-Code auf der Rechnung fehlt`);
      beteiligt.push(`rechnung.positionen.${i}.hs6`);
      return;
    }
    const packIndex = packliste.findIndex((q) => q.nr === p.nr);
    const pack = packliste[packIndex];
    if (pack?.hs6 && kuerzeWarencode(pack.hs6, stellen) !== referenz) {
      abweichungen.push(`Position ${i + 1}: Rechnung ${referenz} ≠ Packliste ${kuerzeWarencode(pack.hs6, stellen)}`);
      beteiligt.push(`rechnung.positionen.${i}.hs6`, `packliste.positionen.${packIndex}.hs6`);
    }
    const nachweisIndex = warenkreis.findIndex((w) => w.pos === p.nr);
    const nachweis = warenkreis[nachweisIndex];
    if (nachweis?.hs6 && kuerzeWarencode(nachweis.hs6, stellen) !== referenz) {
      abweichungen.push(`Position ${i + 1}: Rechnung ${referenz} ≠ Präferenznachweis ${kuerzeWarencode(nachweis.hs6, stellen)}`);
      beteiligt.push(`rechnung.positionen.${i}.hs6`, `praeferenznachweis.warenkreis.${nachweisIndex}.hs6`);
    }
  });

  if (abweichungen.length === 0) return ok(eingaben, `HS-${stellen} über alle Belege identisch`);
  return verletztWennSicher(akte, beteiligt, defaults, eingaben, abweichungen.join('; '));
}
