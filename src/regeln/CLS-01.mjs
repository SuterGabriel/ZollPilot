// CLS-01 HS-6 konsistent über alle Belege.
// Rechnung, Packliste und Präferenznachweis müssen je Position dieselben
// ersten Stellen tragen (parameters.digits). Ursprungsregeln sind HS-basiert;
// eine Abweichung ist ein Tarifierungsstreit, bevor er entsteht.

import { fakt } from '../akte/aufbau.mjs';
import { kuerzeWarencode } from '../normalisierung.mjs';
import { ok, verletzt, nichtPruefbar } from './befund.mjs';

export const REGEL_CLS_01 = 'CLS-01';

export function pruefeCLS01(akte, regel) {
  const stellen = regel.parameters.digits;
  const rechnung = fakt(akte, 'rechnung.positionen');
  if (!rechnung) return nichtPruefbar({}, ['rechnung.positionen'], 'Rechnungspositionen fehlen');

  const packliste = fakt(akte, 'packliste.positionen') ?? [];
  const warenkreis = fakt(akte, 'praeferenznachweis.warenkreis') ?? [];
  const eingaben = { stellen, positionen: rechnung.length };
  const abweichungen = [];

  rechnung.forEach((p, i) => {
    const referenz = kuerzeWarencode(p.hs6, stellen);
    if (!referenz) {
      abweichungen.push(`Position ${i + 1}: HS-Code auf der Rechnung fehlt`);
      return;
    }
    const pack = packliste.find((q) => q.nr === p.nr);
    if (pack?.hs6 && kuerzeWarencode(pack.hs6, stellen) !== referenz) {
      abweichungen.push(`Position ${i + 1}: Rechnung ${referenz} ≠ Packliste ${kuerzeWarencode(pack.hs6, stellen)}`);
    }
    const nachweis = warenkreis.find((w) => w.pos === p.nr);
    if (nachweis?.hs6 && kuerzeWarencode(nachweis.hs6, stellen) !== referenz) {
      abweichungen.push(`Position ${i + 1}: Rechnung ${referenz} ≠ Präferenznachweis ${kuerzeWarencode(nachweis.hs6, stellen)}`);
    }
  });

  if (abweichungen.length === 0) return ok(eingaben, `HS-${stellen} über alle Belege identisch`);
  return verletzt(eingaben, abweichungen.join('; '));
}
