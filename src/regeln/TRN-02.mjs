// TRN-02 Container-Prüfziffer ISO 6346.
// Prüfziffernfehler sind zuerst Lesefehler (CLAUDE.md, harte Grenze 3). Liegt
// die Extraktionskonfidenz des Wertes unter defaults.low_confidence_below, wird
// re_extraction_required gesetzt statt fachlich abgelehnt. Bei hoher Konfidenz
// ist es ein echter Dokumentfehler.

import { fakt, konfidenz } from '../akte/aufbau.mjs';
import { pruefeContainerId } from '../validatoren/container.mjs';
import { ok, verletzt, nichtPruefbar, reExtraction } from './befund.mjs';

export const REGEL_TRN_02 = 'TRN-02';

const PFADE = ['bill_of_lading.container_id', 'packliste.container_id'];

export function pruefeTRN02(akte, regel, defaults) {
  const eingaben = {};
  const fehlerhaft = [];
  const unsicher = [];
  let geprueft = 0;

  for (const pfad of PFADE) {
    const wert = fakt(akte, pfad);
    if (wert === undefined || wert === null) continue;
    geprueft += 1;
    const ergebnis = pruefeContainerId(wert);
    eingaben[pfad] = { wert, ...ergebnis, konfidenz: konfidenz(akte, pfad) };
    if (ergebnis.format && ergebnis.pruefziffer) continue;
    if (konfidenz(akte, pfad) < defaults.low_confidence_below) unsicher.push(pfad);
    else fehlerhaft.push(`${pfad}: ${ergebnis.id} (${ergebnis.format ? `Prüfziffer erwartet ${ergebnis.erwartet}` : 'Format ungültig'})`);
  }

  if (geprueft === 0) return nichtPruefbar(eingaben, PFADE, 'Keine Containernummer in der Akte');
  if (unsicher.length > 0) {
    return reExtraction(eingaben, unsicher, `Prüfziffer falsch bei Konfidenz unter ${defaults.low_confidence_below}: Nachextraktion vor fachlicher Ablehnung`);
  }
  if (fehlerhaft.length > 0) return verletzt(eingaben, fehlerhaft.join('; '));
  return ok(eingaben, 'Prüfziffer ISO 6346 gültig');
}
