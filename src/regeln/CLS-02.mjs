// CLS-02 Stellenzahl Warennummer.
// Ausfuhr: 8 Stellen (KN). Einfuhr Deutschland: 11 Stellen (EZT). Die Zahlen
// stehen in rules.yaml unter parameters.length_by_direction.

import { fakt } from '../akte/aufbau.mjs';
import { ok, verletzt, nichtPruefbar } from './befund.mjs';

export const REGEL_CLS_02 = 'CLS-02';

export function pruefeCLS02(akte, regel) {
  const richtung = fakt(akte, 'anmeldung.richtung');
  const warennummern = fakt(akte, 'anmeldung.warennummern');
  const eingaben = { 'anmeldung.richtung': richtung, 'anmeldung.warennummern': warennummern };
  if (!richtung || !warennummern) {
    return nichtPruefbar(eingaben, [!richtung && 'anmeldung.richtung', !warennummern && 'anmeldung.warennummern'].filter(Boolean), 'Anmeldedaten fehlen');
  }
  const erwartet = regel.parameters.length_by_direction[richtung];
  if (erwartet === undefined) return nichtPruefbar(eingaben, [], `Keine Stellenzahl für Richtung ${richtung} hinterlegt`);

  const falsch = warennummern.filter((n) => String(n).replace(/\s/g, '').length !== erwartet || !/^[0-9]+$/.test(String(n).replace(/\s/g, '')));
  if (falsch.length === 0) return ok(eingaben, `Alle Warennummern ${erwartet}-stellig`);
  return verletzt(eingaben, `Warennummer(n) ${falsch.join(', ')} nicht ${erwartet}-stellig für ${richtung}`);
}
