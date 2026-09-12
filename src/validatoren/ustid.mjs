// Deutsche USt-IdNr.: "DE" und neun Ziffern, die neunte ist die Prüfziffer nach
// ISO/IEC 7064 MOD 11,10. Offline berechenbar, aber nur über Sekundärquellen
// belegt (docs/08-known-unknowns.md). Bei kritischer Anwendung zusätzlich VIES
// bzw. qualifizierte Bestätigung nach § 18e UStG — das ist Stufe 2 und läuft
// nie blockierend.

export const USTID_DE_MUSTER = /^DE[0-9]{9}$/;

const ZIFFERN_OHNE_PRUEFZIFFER = 8;
const MOD_10 = 10;
const MOD_11 = 11;

export function normalisiereUstId(roh) {
  if (roh === null || roh === undefined) return null;
  return String(roh).toUpperCase().replace(/[\s.-]/g, '');
}

/** MOD 11,10 über die ersten acht Ziffern. */
export function ustIdPruefziffer(ziffern) {
  let produkt = MOD_10;
  for (const zeichen of ziffern.slice(0, ZIFFERN_OHNE_PRUEFZIFFER)) {
    let summe = (Number(zeichen) + produkt) % MOD_10;
    if (summe === 0) summe = MOD_10;
    produkt = (2 * summe) % MOD_11;
  }
  const pruef = MOD_11 - produkt;
  return pruef === MOD_10 ? 0 : pruef;
}

export function pruefeUstIdDe(roh) {
  const id = normalisiereUstId(roh);
  if (!id || !USTID_DE_MUSTER.test(id)) {
    return { id, format: false, pruefziffer: false, erwartet: null };
  }
  const ziffern = id.slice(2);
  const erwartet = ustIdPruefziffer(ziffern);
  const tatsaechlich = Number(ziffern[ZIFFERN_OHNE_PRUEFZIFFER]);
  return { id, format: true, pruefziffer: erwartet === tatsaechlich, erwartet };
}
