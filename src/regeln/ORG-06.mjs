// ORG-06 Wertgrenze Ursprungserklärung.
// Über der Schwelle (rules.yaml parameters.threshold, bezogen auf den Wert der
// Ursprungserzeugnisse, nicht auf den Rechnungsgesamtwert) ist eine
// Ursprungserklärung nur mit REX-Registrierung oder als Ermächtigter Ausführer
// wirksam. Die REX-Nummer wird hier nur strukturell geprüft; die Vergabe
// braucht das REX-Portal (Stufe 2).

import { fakt } from '../akte/aufbau.mjs';
import { formatGueltig } from '../validatoren/formate.mjs';
import { ok, verletzt, nichtPruefbar } from './befund.mjs';

export const REGEL_ORG_06 = 'ORG-06';

const TYP_URSPRUNGSERKLAERUNG = 'origin_declaration';

export function pruefeORG06(akte, regel) {
  const typ = fakt(akte, 'praeferenznachweis.typ');
  if (typ !== TYP_URSPRUNGSERKLAERUNG) {
    return ok({ 'praeferenznachweis.typ': typ }, 'Kein Ursprungserklärungs-Nachweis, Wertgrenze nicht einschlägig');
  }
  const schwelle = regel.parameters.threshold;
  const eingaben = {
    'praeferenznachweis.typ': typ,
    'praeferenznachweis.ursprungswert': fakt(akte, 'praeferenznachweis.ursprungswert'),
    'praeferenznachweis.rex_nummer': fakt(akte, 'praeferenznachweis.rex_nummer') ?? null,
    'praeferenznachweis.ermaechtigter_ausfuehrer': fakt(akte, 'praeferenznachweis.ermaechtigter_ausfuehrer') ?? null,
    schwelle: `${schwelle.value} ${schwelle.currency}`,
  };
  if (eingaben['praeferenznachweis.ursprungswert'] === undefined) {
    return nichtPruefbar(eingaben, ['praeferenznachweis.ursprungswert'], 'Wert der Ursprungserzeugnisse fehlt');
  }
  // Die Währung der Schwelle ist EUR. Eine Umrechnung anderer Währungen ist
  // nicht gebaut (docs/OFFENE-PUNKTE.md); ein anderer Wert ist nicht prüfbar.
  const waehrung = fakt(akte, 'rechnung.waehrung');
  if (waehrung && waehrung !== schwelle.currency) {
    return nichtPruefbar(eingaben, ['rechnung.waehrung'], `Schwelle in ${schwelle.currency}, Rechnung in ${waehrung}: Umrechnung nicht implementiert`);
  }
  if (eingaben['praeferenznachweis.ursprungswert'] <= schwelle.value) {
    return ok(eingaben, 'Ursprungswert unter der Schwelle, jeder Ausführer darf erklären');
  }
  const rex = eingaben['praeferenznachweis.rex_nummer'];
  if (rex && formatGueltig('rex', rex)) return ok(eingaben, `Über der Schwelle, REX ${rex} strukturell gültig`);
  if (eingaben['praeferenznachweis.ermaechtigter_ausfuehrer']) return ok(eingaben, 'Über der Schwelle, Ermächtigter Ausführer erfasst');
  return verletzt(eingaben, rex
    ? `REX-Nummer ${rex} entspricht nicht dem Format`
    : `Ursprungswert über ${schwelle.value} ${schwelle.currency} ohne REX-Nummer oder Ermächtigten Ausführer`);
}
