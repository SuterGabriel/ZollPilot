// VAL-03 Kostenlose Position hat Zollwert.
// "No charge" heißt nicht "kein Zollwert". Eine Position mit Einzelpreis 0
// braucht einen Zollwert größer 0 oder eine dokumentierte Bewertungsmethode
// (Folgemethoden nach Art. 74 UZK, Verweis aus rules.yaml).

import { fakt } from '../akte/aufbau.mjs';
import { ok, nichtPruefbar, verletztWennSicher } from './befund.mjs';

export const REGEL_VAL_03 = 'VAL-03';

export function pruefeVAL03(akte, regel, defaults) {
  const positionen = fakt(akte, 'rechnung.positionen');
  if (!positionen) return nichtPruefbar({}, ['rechnung.positionen'], 'Rechnungspositionen fehlen');

  const unbewertet = positionen
    .map((p, i) => ({ index: i, ...p }))
    .filter((p) => p.einzelpreis === 0)
    .filter((p) => !(p.zollwert > 0) && !p.bewertungsmethode);

  const eingaben = { kostenlose_positionen: positionen.filter((p) => p.einzelpreis === 0).length };
  if (unbewertet.length === 0) return ok(eingaben, 'Jede kostenlose Position ist bewertet');
  // Ein als 0 gelesener Einzelpreis kann ein Lesefehler sein; dann ist die
  // Position gar nicht kostenlos und die Regel nicht einschlägig.
  const beteiligt = unbewertet.flatMap((p) => [
    `rechnung.positionen.${p.index}.einzelpreis`,
    `rechnung.positionen.${p.index}.zollwert`,
  ]);
  return verletztWennSicher(
    akte,
    beteiligt,
    defaults,
    eingaben,
    `Position(en) ${unbewertet.map((p) => p.index + 1).join(', ')} mit Preis 0 ohne Zollwert und ohne Bewertungsmethode`,
    { positionen: unbewertet.map((p) => p.index) },
  );
}
