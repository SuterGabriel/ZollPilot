// Abgleich der Nachforderungen mit ihrem Zustand (ADR-009).
//
// Eingang: die offenen Fälle aus `request_case` und die Nachforderungen der
// letzten Prüfung. Ausgang: was eröffnet wird, was bestehen bleibt, was
// erledigt ist. Der Schlüssel eines Falls ist Grund und Feld; derselbe
// fehlende Wert bleibt derselbe Fall, auch wenn die Akte dreimal geprüft
// wird. Das ist die Idempotenz: Ein erneuter Eingang eröffnet keinen zweiten
// Fall und setzt keine Stufe zurück.
//
// Reine Funktion. Der Zeitpunkt kommt als Parameter, wie überall in src/.

export const STATUS_OFFEN = 'offen';
export const STATUS_ERLEDIGT = 'erledigt';

export function fallSchluessel(fall) {
  return `${fall.grund}|${fall.feld}`;
}

/**
 * @param {Array} offene   Zeilen aus request_case mit status offen
 * @param {Array} neue     ergebnis.nachforderungen der letzten Prüfung
 * @param {string} zeitpunkt ISO-Zeitpunkt des Abgleichs
 */
export function gleicheAb(offene, neue, zeitpunkt) {
  const offenNach = new Map((offene ?? []).map((f) => [fallSchluessel(f), f]));
  const neuNach = new Map((neue ?? []).map((n) => [fallSchluessel(n), n]));

  const eroeffnen = [];
  const behalten = [];
  for (const [schluessel, n] of neuNach) {
    const bestehend = offenNach.get(schluessel);
    if (bestehend) {
      // Der Text darf sich ändern (neue Begründung nach erneuter Prüfung),
      // die Stufe und das Versanddatum bleiben: Es ist derselbe Fall.
      behalten.push({ ...bestehend, betreff: n.betreff, text: n.text, adressat: n.adressat.primaer, adressat_kopie: n.adressat.sekundaer ?? null });
    } else {
      eroeffnen.push({
        grund: n.grund,
        feld: n.feld,
        adressat: n.adressat.primaer,
        adressat_kopie: n.adressat.sekundaer ?? null,
        betreff: n.betreff,
        text: n.text,
        stufe: null,
        status: STATUS_OFFEN,
        eroeffnet_am: zeitpunkt,
      });
    }
  }

  const schliessen = [];
  for (const [schluessel, f] of offenNach) {
    if (!neuNach.has(schluessel)) schliessen.push({ ...f, status: STATUS_ERLEDIGT, geschlossen_am: zeitpunkt });
  }

  return { eroeffnen, behalten, schliessen };
}
