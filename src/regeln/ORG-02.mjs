// ORG-02 Präferenzursprung deckt Ware.
// Der im Nachweis erklärte Ursprung muss dem Ursprung jeder Rechnungsposition
// entsprechen, und die Position muss im Warenkreis des Nachweises liegen
// (gleiche HS-6). Ein Nachweis für "DE" deckt keine Position mit Ursprung "CN".

import { fakt } from '../akte/aufbau.mjs';
import { normalisiereLand, kuerzeWarencode } from '../normalisierung.mjs';
import { ok, verletzt, nichtPruefbar, fehlend } from './befund.mjs';

export const REGEL_ORG_02 = 'ORG-02';

export function pruefeORG02(akte, regel, defaults, katalog) {
  if (!fakt(akte, 'sachverhalt.praeferenz_beansprucht')) {
    return ok({}, 'Keine Präferenz beansprucht, Regel nicht einschlägig');
  }
  const eingaben = {
    'rechnung.positionen': fakt(akte, 'rechnung.positionen'),
    'praeferenznachweis.ursprung': fakt(akte, 'praeferenznachweis.ursprung'),
    'praeferenznachweis.warenkreis': fakt(akte, 'praeferenznachweis.warenkreis'),
  };
  const offen = fehlend(eingaben);
  if (offen.length > 0) return nichtPruefbar(eingaben, offen, 'Präferenznachweis oder Rechnungspositionen fehlen');

  // Die Stellenzahl des Vergleichs kommt aus CLS-01, damit beide Regeln
  // dieselbe Granularität verwenden.
  const stellen = katalog.regel('CLS-01').parameters.digits;
  const nachweisUrsprung = normalisiereLand(eingaben['praeferenznachweis.ursprung']);
  const warenkreis = new Set(eingaben['praeferenznachweis.warenkreis'].map((w) => kuerzeWarencode(w.hs6, stellen)));

  const widersprueche = [];
  eingaben['rechnung.positionen'].forEach((p, i) => {
    const ursprung = normalisiereLand(p.ursprung);
    if (ursprung !== nachweisUrsprung) {
      widersprueche.push(`Position ${i + 1}: Ursprung ${ursprung ?? 'fehlt'} ≠ Nachweis ${nachweisUrsprung}`);
    }
    if (!warenkreis.has(kuerzeWarencode(p.hs6, stellen))) {
      widersprueche.push(`Position ${i + 1}: HS ${p.hs6} nicht im Warenkreis des Nachweises`);
    }
  });

  if (widersprueche.length === 0) return ok(eingaben, `Nachweis deckt alle Positionen mit Ursprung ${nachweisUrsprung}`);
  return verletzt(eingaben, widersprueche.join('; '));
}
