// Regex-Vorfilter für Kennungen (docs/04-stammdaten-formate.md). Ein Regex
// beweist nur das Format, nie die Vergabe. Für EORI, REX, UN/LOCODE und TARIC
// braucht die Gültigkeit zwingend einen Online-Lookup (Stufe 2, nicht
// blockierend). Die MRN-Prüfziffer ist bewusst nicht implementiert, siehe
// docs/08-known-unknowns.md: Strukturprüfung ja, Algorithmus ungeklärt.

export const FORMATE = Object.freeze({
  eori: /^[A-Z]{2}[A-Z0-9]{1,15}$/,
  mrn: /^[0-9]{2}[A-Z]{2}[A-Z0-9]{13}[A-Z0-9]$/,
  hs6: /^[0-9]{6}$/,
  kn8: /^[0-9]{8}$/,
  taric10: /^[0-9]{10}$/,
  ezt11: /^[0-9]{11}$/,
  ustid_de: /^DE[0-9]{9}$/,
  rex: /^[A-Z]{2}REX[A-Z0-9]+$/,
  unlocode: /^[A-Z]{2}[A-Z2-9]{3}$/,
  container: /^[A-Z]{3}[UJZ][0-9]{7}$/,
  awb: /^[0-9]{3}-?[0-9]{8}$/,
});

export const INCOTERMS_2020 = Object.freeze([
  'EXW', 'FCA', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP', 'FAS', 'FOB', 'CFR', 'CIF',
]);

/** Klauseln, die nur für See- und Binnenschiffstransport vorgesehen sind. */
export const INCOTERMS_NUR_SEE = Object.freeze(['FAS', 'FOB', 'CFR', 'CIF']);

export function formatGueltig(art, wert) {
  const muster = FORMATE[art];
  if (!muster) throw new Error(`Unbekannte Kennungsart: ${art}`);
  if (wert === null || wert === undefined) return false;
  return muster.test(String(wert));
}

/**
 * Ein Incoterm ohne benannten Ort ist unvollständig. Das ist eine Warnung, keine
 * Blockade (docs/04, "Incoterms als Datenmodell").
 */
export function pruefeIncoterm(incoterm) {
  if (!incoterm || !incoterm.code) return { gueltig: false, warnungen: ['Incoterm fehlt'] };
  const code = String(incoterm.code).toUpperCase();
  const warnungen = [];
  if (!INCOTERMS_2020.includes(code)) return { gueltig: false, warnungen: [`Unbekannte Klausel ${code}`] };
  if (!incoterm.named_place) warnungen.push('benannter Ort fehlt');
  if (!incoterm.edition) warnungen.push('Edition fehlt (erwartet 2020)');
  return { gueltig: true, code, nurSee: INCOTERMS_NUR_SEE.includes(code), warnungen };
}
