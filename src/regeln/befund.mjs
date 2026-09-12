// Einheitliche Form eines Regelergebnisses. Jede Regel in src/regeln/ gibt
// genau das zurück; das Regelwerk ergänzt Regelversion, Härte und Risiko aus
// dem Katalog.
//
// status:
//   ok                      Zusage hält
//   verletzt                Zusage gebrochen — bei harten Regeln keine Freigabe
//   `nicht_pruefbar`        ein Eingabewert fehlt; das ist ein Nachforderungsfall
//   re_extraction_required  Prüfziffern- oder Summenfehler bei niedriger
//                           Konfidenz: zuerst Lesefehler, nicht Fachfehler

import { konfidenz } from '../akte/aufbau.mjs';

export const STATUS = Object.freeze({
  OK: 'ok',
  VERLETZT: 'verletzt',
  NICHT_PRUEFBAR: 'nicht_pruefbar',
  RE_EXTRACTION: 're_extraction_required',
});

export function ok(eingaben, begruendung) {
  return { status: STATUS.OK, eingaben, begruendung };
}

export function verletzt(eingaben, begruendung, extra = {}) {
  return { status: STATUS.VERLETZT, eingaben, begruendung, ...extra };
}

export function nichtPruefbar(eingaben, fehlendePfade, begruendung) {
  return { status: STATUS.NICHT_PRUEFBAR, eingaben, fehlende_pfade: fehlendePfade, begruendung };
}

export function reExtraction(eingaben, pfade, begruendung) {
  return { status: STATUS.RE_EXTRACTION, eingaben, nachzulesende_pfade: pfade, begruendung };
}

/** Liefert die fehlenden Pfade, damit eine Regel mit einem Aufruf entscheiden kann, ob sie prüfbar ist. */
export function fehlend(eingaben) {
  return Object.entries(eingaben)
    .filter(([, wert]) => wert === undefined || wert === null)
    .map(([pfad]) => pfad);
}

/** Welche der beteiligten Werte unter der Konfidenzschwelle gelesen wurden. */
export function unsicherGelesen(akte, pfade, defaults) {
  return pfade.filter((pfad) => konfidenz(akte, pfad) < defaults.low_confidence_below);
}

/**
 * Ein Verstoß — es sei denn, er beruht auf unsicher gelesenen Werten.
 *
 * CLAUDE.md, harte Grenze 3: Prüfziffern-, Summen- und Vergleichsfehler sind
 * auf einem Scan meistens Lesefehler und selten Dokumentfehler. Liegt die
 * Extraktionskonfidenz eines beteiligten Wertes unter
 * `defaults.low_confidence_below`, ist das Ergebnis
 * `re_extraction_required` statt `verletzt`: nachlesen vor ablehnen.
 *
 * `pfade` sind die Faktenpfade, auf denen der Vergleich beruht — nur sie,
 * nicht alle Eingaben der Regel. Ein unsicher gelesenes Feld, das am Befund
 * nicht beteiligt war, darf die Ablehnung nicht aufheben.
 */
export function verletztWennSicher(akte, pfade, defaults, eingaben, begruendung, extra = {}) {
  const unsicher = unsicherGelesen(akte, pfade, defaults);
  if (unsicher.length === 0) return verletzt(eingaben, begruendung, extra);
  return reExtraction(
    eingaben,
    unsicher,
    `${begruendung} — Konfidenz unter ${defaults.low_confidence_below}: zuerst nachlesen`,
  );
}
