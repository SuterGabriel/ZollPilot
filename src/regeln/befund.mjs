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
