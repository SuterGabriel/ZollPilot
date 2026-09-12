// QTY-02 Bruttogewicht Packliste gegen B/L.
// Weiche Regel: Warnung, wenn die Abweichung die Toleranz überschreitet
// (max aus relativ und absolut, rules.yaml). Ab escalate_to_hard_at wird sie
// hart. Es gibt keine gesetzliche EU-Zolltoleranz; die Werte sind
// Praxisannahmen (source_type practice).

import { fakt } from '../akte/aufbau.mjs';
import { ok, verletzt, nichtPruefbar, fehlend } from './befund.mjs';
import { prozent, gerundet } from '../normalisierung.mjs';

export const REGEL_QTY_02 = 'QTY-02';

export function pruefeQTY02(akte, regel) {
  const eingaben = {
    'packliste.brutto_gesamt_kg': fakt(akte, 'packliste.brutto_gesamt_kg'),
    'bill_of_lading.brutto_kg': fakt(akte, 'bill_of_lading.brutto_kg'),
  };
  const offen = fehlend(eingaben);
  if (offen.length > 0) return nichtPruefbar(eingaben, offen, 'Bruttogewicht auf Packliste oder B/L fehlt');

  const packliste = eingaben['packliste.brutto_gesamt_kg'];
  const bl = eingaben['bill_of_lading.brutto_kg'];
  const differenz = Math.abs(packliste - bl);
  const relativ = packliste > 0 ? differenz / packliste : Infinity;
  const toleranz = Math.max(regel.tolerance.absolute_kg, regel.tolerance.relative * packliste);
  eingaben.differenz_kg = differenz;
  eingaben.differenz_relativ = gerundet(relativ);
  eingaben.toleranz_kg = toleranz;

  if (differenz <= toleranz) return ok(eingaben, `Abweichung ${differenz} kg innerhalb ${toleranz} kg`);

  const eskaliert = relativ >= regel.escalate_to_hard_at.relative;
  return verletzt(
    eingaben,
    `Abweichung ${differenz} kg (${prozent(relativ)}) über Toleranz ${toleranz} kg${eskaliert ? ', über Eskalationsschwelle: hart' : ''}`,
    { haerte_effektiv: eskaliert ? 'hard' : 'soft' },
  );
}
