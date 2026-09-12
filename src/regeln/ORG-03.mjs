// ORG-03 A.TR ist kein Ursprungsnachweis.
// Die A.TR belegt den Freiverkehr in der Zollunion EU–Türkei, nicht den
// Ursprung. Wird Präferenz beansprucht und der einzige "Nachweis" ist eine
// A.TR, oder der Präferenznachweis trägt selbst den Typ atr, ist das der
// häufigste fachliche Denkfehler bei Nicht-Zöllnern (docs/01).

import { fakt, dokumenteVomTyp } from '../akte/aufbau.mjs';
import { ok, verletzt } from './befund.mjs';

export const REGEL_ORG_03 = 'ORG-03';

const TYP_ATR = 'atr';

export function pruefeORG03(akte) {
  const atr = dokumenteVomTyp(akte, TYP_ATR);
  const typ = fakt(akte, 'praeferenznachweis.typ');
  const beansprucht = Boolean(fakt(akte, 'sachverhalt.praeferenz_beansprucht'));
  const eingaben = { atr_vorhanden: atr.length > 0, 'praeferenznachweis.typ': typ, praeferenz_beansprucht: beansprucht };

  if (typ === TYP_ATR) {
    return verletzt(eingaben, 'Der Präferenznachweis ist als A.TR erfasst; A.TR ist ein Freiverkehrs-, kein Ursprungsnachweis');
  }
  if (beansprucht && atr.length > 0 && !typ) {
    return verletzt(eingaben, 'Präferenz beansprucht, aber nur eine A.TR liegt vor — sie setzt keinen Präferenzursprung');
  }
  return ok(eingaben, atr.length > 0 ? 'A.TR liegt vor, setzt aber keinen Ursprung' : 'Keine A.TR in der Akte');
}
