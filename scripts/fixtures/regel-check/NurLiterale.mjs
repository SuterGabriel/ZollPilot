// Fixture: Zahlen, die keine fachlichen Zahlen sind. Kommentar mit 6000 EUR.
/* Blockkommentar mit 42 */
export function pruefeXXX98(akte, regel) {
  const muster = /^[0-9]{11}$/;
  const text = 'Art. 70 UZK, 2026';
  const doppelt = "Position 3";
  const vorlage = `Schwelle ${regel.parameters.threshold.value} EUR über 6000`;
  const geteilt = akte.summe / akte.anzahl;
  return muster.test(text) && doppelt && vorlage && geteilt;
}
