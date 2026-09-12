// Testhelfer: baut aus einem flachen Faktenobjekt einen Akteneingang mit
// finalen Dokumenten und Assertions, damit ein Regeltest drei Zeilen lang ist.

import { ladeKatalog } from '../src/katalog.mjs';
import { baueAkte } from '../src/akte/aufbau.mjs';

export const KATALOG = ladeKatalog();
export const DEFAULTS = KATALOG.regeln.defaults;

const TYPEN = {
  rechnung: 'handelsrechnung',
  packliste: 'packliste',
  bill_of_lading: 'bill_of_lading',
  praeferenznachweis: 'origin_declaration',
};

export function regel(id) {
  return KATALOG.regeln.rules.find((r) => r.id === id);
}

/** Katalogzugriff, wie ihn das Regelwerk an die Regeln reicht. */
export const ZUGRIFF = { ...KATALOG, regel };

/**
 * eingangAus({ rechnung: {...}, packliste: {...} }, { konfidenzen: { pfad: 0.5 }, status: { bill_of_lading: 'draft' }, dokumente: [...], extraktion: {...} })
 */
export function eingangAus(bereiche, optionen = {}) {
  const dokumente = [];
  const assertions = [];
  for (const [bereich, inhalt] of Object.entries(bereiche)) {
    if (bereich === 'sachverhalt' || bereich === 'anmeldung') continue;
    const id = `${bereich.toUpperCase()}-1`;
    const typ = bereich === 'praeferenznachweis' && inhalt?.typ ? inhalt.typ : TYPEN[bereich] ?? bereich;
    dokumente.push({ id, typ, status: optionen.status?.[bereich] ?? 'final', version: 1 });
    const lauf = (wert, pfad) => {
      if (Array.isArray(wert)) wert.forEach((v, i) => lauf(v, `${pfad}.${i}`));
      else if (wert !== null && typeof wert === 'object') Object.entries(wert).forEach(([k, v]) => lauf(v, `${pfad}.${k}`));
      else assertions.push({ dokument: id, pfad, wert, konfidenz: optionen.konfidenzen?.[pfad] ?? 0.99 });
    };
    lauf(inhalt, bereich);
  }
  if (optionen.dokumente) dokumente.push(...optionen.dokumente);
  return {
    akte_id: 'TEST-1',
    stichtag: '2026-09-12',
    sachverhalt: bereiche.sachverhalt ?? { richtung: 'export_third_country', verkehrstraeger: 'sea', praeferenz_beansprucht: true },
    anmeldung: bereiche.anmeldung,
    dokumente,
    assertions,
    // Nur setzen, wenn der Test es verlangt: Eine Akte ohne Extraktion darf
    // das Feld nicht tragen, sonst prüft der Test die Vorgabe nicht mit.
    ...(optionen.extraktion ? { extraktion: optionen.extraktion } : {}),
  };
}

export function akteAus(bereiche, optionen) {
  return baueAkte(eingangAus(bereiche, optionen));
}
