// Air Waybill: drei Stellen Airline-Präfix, acht Stellen Seriennummer, deren
// letzte die Prüfziffer ist. Die siebenstellige Seriennummer wird durch 7
// geteilt, der Rest ist die achte Ziffer. Der Präfix ist nicht Teil der
// Rechnung (docs/04-stammdaten-formate.md).
//
// Luftfracht liegt außerhalb des MVP-Sachverhalts; der Validator ist trotzdem
// hier, weil er vollständig offline prüfbar ist und das Datenmodell ihn
// vorsieht (docs/01, Air Waybill).

export const AWB_MUSTER = /^[0-9]{3}-?[0-9]{8}$/;

const PRAEFIX_LAENGE = 3;
const SERIE_LAENGE = 7;
const MODUL_AWB = 7;

export function normalisiereAwb(roh) {
  if (roh === null || roh === undefined) return null;
  return String(roh).replace(/[\s-]/g, '');
}

export function pruefeAwb(roh) {
  const awb = normalisiereAwb(roh);
  if (!awb || !/^[0-9]{11}$/.test(awb)) {
    return { awb, format: false, pruefziffer: false, praefix: null, erwartet: null };
  }
  const praefix = awb.slice(0, PRAEFIX_LAENGE);
  const serie = awb.slice(PRAEFIX_LAENGE, PRAEFIX_LAENGE + SERIE_LAENGE);
  const erwartet = Number(serie) % MODUL_AWB;
  const tatsaechlich = Number(awb[PRAEFIX_LAENGE + SERIE_LAENGE]);
  return { awb, format: true, pruefziffer: erwartet === tatsaechlich, praefix, erwartet };
}
