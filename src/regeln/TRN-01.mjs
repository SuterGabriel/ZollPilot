// TRN-01 Containernummer konsistent über B/L und Packliste.
// Vergleich nach Normalisierung (Leerzeichen, Bindestriche, Groß-/Kleinschreibung).
// Eine Abweichung bezeichnet möglicherweise eine andere physische Sendung —
// oder einen Lesefehler: Stammt einer der Werte mit niedriger Konfidenz aus
// der Extraktion, ist Nachlesen der erste Schritt (OCR-01), nicht die Ablehnung.

import { fakt, konfidenz } from '../akte/aufbau.mjs';
import { normalisiereContainerId } from '../validatoren/container.mjs';
import { ok, verletzt, nichtPruefbar, reExtraction, fehlend } from './befund.mjs';

export const REGEL_TRN_01 = 'TRN-01';

export function pruefeTRN01(akte, regel, defaults) {
  const eingaben = {
    'bill_of_lading.container_id': fakt(akte, 'bill_of_lading.container_id'),
    'packliste.container_id': fakt(akte, 'packliste.container_id'),
  };
  const offen = fehlend(eingaben);
  if (offen.length > 0) return nichtPruefbar(eingaben, offen, 'Containernummer auf B/L oder Packliste fehlt');

  const bl = normalisiereContainerId(eingaben['bill_of_lading.container_id']);
  const pack = normalisiereContainerId(eingaben['packliste.container_id']);
  if (bl === pack) return ok(eingaben, `Container ${bl} auf beiden Belegen`);
  const unsicher = Object.keys(eingaben).filter((pfad) => konfidenz(akte, pfad) < defaults.low_confidence_below);
  if (unsicher.length > 0) {
    return reExtraction(eingaben, unsicher, `B/L nennt ${bl}, Packliste ${pack}, aber Konfidenz unter ${defaults.low_confidence_below}: zuerst nachlesen`);
  }
  return verletzt(eingaben, `B/L nennt ${bl}, Packliste ${pack}`);
}
