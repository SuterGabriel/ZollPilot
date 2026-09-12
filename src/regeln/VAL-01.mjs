// VAL-01 Rechnungssumme schlüssig.
// Summe der Positionsnetto plus Zuschläge minus Rabatte muss den Endbetrag
// ergeben. Toleranz kommt aus rules.yaml (tolerance.amount), nicht von hier.
// Ein Summenfehler bei niedriger Konfidenz ist zuerst ein Lesefehler (OCR-01).

import { fakt, konfidenz } from '../akte/aufbau.mjs';
import { gleichBisAuf } from '../normalisierung.mjs';
import { ok, verletzt, nichtPruefbar, reExtraction, fehlend } from './befund.mjs';

export const REGEL_VAL_01 = 'VAL-01';

export function pruefeVAL01(akte, regel, defaults) {
  const positionen = fakt(akte, 'rechnung.positionen');
  const eingaben = {
    'rechnung.positionen': positionen,
    'rechnung.zuschlaege': fakt(akte, 'rechnung.zuschlaege') ?? 0,
    'rechnung.rabatte': fakt(akte, 'rechnung.rabatte') ?? 0,
    'rechnung.gesamt': fakt(akte, 'rechnung.gesamt'),
  };
  const offen = fehlend(eingaben);
  if (offen.length > 0) return nichtPruefbar(eingaben, offen, 'Rechnungspositionen oder Endbetrag fehlen');

  const summe = positionen.reduce((s, p) => s + (p.netto ?? 0), 0)
    + eingaben['rechnung.zuschlaege'] - eingaben['rechnung.rabatte'];
  const gesamt = eingaben['rechnung.gesamt'];
  eingaben.berechnet = summe;

  if (gleichBisAuf(summe, gesamt, regel.tolerance.amount)) {
    return ok(eingaben, `Summe ${summe} entspricht Endbetrag ${gesamt}`);
  }

  const schwelle = defaults.low_confidence_below;
  const unsicher = ['rechnung.gesamt', ...positionen.map((_, i) => `rechnung.positionen.${i}.netto`)]
    .filter((pfad) => konfidenz(akte, pfad) < schwelle);
  if (unsicher.length > 0) {
    return reExtraction(eingaben, unsicher, `Summe ${summe} ≠ Endbetrag ${gesamt}, aber Konfidenz unter ${schwelle}: zuerst nachlesen`);
  }
  return verletzt(eingaben, `Summe der Positionen ${summe} ≠ Endbetrag ${gesamt}`);
}
