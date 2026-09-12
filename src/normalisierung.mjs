// Normalisierung vor jedem Vergleich (CLAUDE.md, harte Grenze 2). Alle
// Regelvergleiche laufen ausschließlich auf normalisierten Werten. Was hier
// nicht abgedeckt ist — Währungsumrechnung mit Kurs und Kursdatum, UN/LOCODE,
// semantische Ähnlichkeit von Warenbeschreibungen — ist bewusst nicht gebaut
// und steht in docs/OFFENE-PUNKTE.md.

const FLOAT_RESERVE = 1e-9;

const RECHTSFORMEN = [
  'gmbh & co. kg', 'gmbh & co kg', 'gmbh', 'ag', 'kg', 'ohg', 'ug', 'se', 'e.k.', 'ek',
  'ltd', 'ltd.', 'limited', 'inc', 'inc.', 'llc', 'corp', 'corp.', 'co.', 'co', 'plc',
  's.a.', 'sa', 's.r.l.', 'srl', 'b.v.', 'bv', 'n.v.', 'nv', 'sarl', 's.à r.l.', 'sas',
];

/**
 * Firmenname: Rechtsformsuffixe entfernen, Kleinschreibung, Sonderzeichen und
 * Mehrfachleerzeichen reduzieren. Exakte IDs (EORI, USt-IdNr.) haben vor dem
 * Namensvergleich Vorrang — das hier ist die Fuzzy-Stufe, nie allein
 * entscheidend.
 */
export function normalisiereFirmenname(roh) {
  if (!roh) return '';
  let name = String(roh).toLowerCase().replace(/[.,;:()"']/g, ' ').replace(/\s+/g, ' ').trim();
  for (const form of RECHTSFORMEN) {
    const suffix = ` ${form.replace(/[.]/g, '')}`;
    if (name.endsWith(suffix)) name = name.slice(0, -suffix.length).trim();
  }
  return name;
}

/**
 * Betrag aus Belegtext: "1.250,00", "1,250.00", "1250" werden zur Zahl 1250.
 * Entscheidet über das Dezimaltrennzeichen anhand des letzten Trennzeichens.
 */
export function normalisiereBetrag(roh) {
  if (roh === null || roh === undefined || roh === '') return null;
  if (typeof roh === 'number') return roh;
  let text = String(roh).replace(/[^\d,.\-]/g, '');
  if (!/\d/.test(text)) return null;
  const letztesKomma = text.lastIndexOf(',');
  const letzterPunkt = text.lastIndexOf('.');
  if (letztesKomma > letzterPunkt) {
    text = text.replace(/\./g, '').replace(',', '.');
  } else {
    text = text.replace(/,/g, '');
  }
  const zahl = Number(text);
  return Number.isFinite(zahl) ? zahl : null;
}

/** Warencodes auf eine gemeinsame Stellenzahl kürzen; Leerzeichen und Punkte entfernen. */
export function kuerzeWarencode(roh, stellen) {
  if (roh === null || roh === undefined) return null;
  const code = String(roh).replace(/[\s.]/g, '');
  if (!/^[0-9]+$/.test(code)) return null;
  return code.slice(0, stellen);
}

/** Ländercodes: ISO 3166-1 alpha-2, Großschreibung. "EU" ist kein Land (docs/01). */
export function normalisiereLand(roh) {
  if (!roh) return null;
  const land = String(roh).trim().toUpperCase();
  return /^[A-Z]{2}$/.test(land) ? land : null;
}

/** Zwei Zahlen sind gleich, wenn ihr Abstand die Toleranz nicht überschreitet. */
export function gleichBisAuf(a, b, toleranz) {
  if (a === null || b === null || a === undefined || b === undefined) return false;
  // Kleine Reserve gegen Gleitkommarauschen: 100.01 - 100 ist nicht 0.01.
  return Math.abs(a - b) <= toleranz + FLOAT_RESERVE;
}

// Darstellungshelfer. Sie liegen hier und nicht in den Regeln, damit
// src/regeln/ frei von nackten Zahlen bleibt (scripts/regel-check.mjs).
const NACHKOMMASTELLEN_ANTEIL = 4;
const NACHKOMMASTELLEN_PROZENT = 1;
const PROZENT = 100;

/** Anteil (0..1) auf vier Nachkommastellen. */
export function gerundet(anteil) {
  return Number(anteil.toFixed(NACHKOMMASTELLEN_ANTEIL));
}

/** Anteil (0..1) als Prozenttext, z. B. "5.8 %". */
export function prozent(anteil) {
  return `${(anteil * PROZENT).toFixed(NACHKOMMASTELLEN_PROZENT)} %`;
}
