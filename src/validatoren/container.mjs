// Container-Kennung nach ISO 6346: drei Buchstaben Eigner, ein Kategoriebuchstabe
// (U, J oder Z), sechs Ziffern Seriennummer, eine Prüfziffer. Vollständig offline
// prüfbar (docs/04-stammdaten-formate.md). Die Prüfziffer erkennt Lese- und
// Übertragungsfehler; sie beweist weder Eigentum noch Status des Containers.
//
// Die Zahlen hier sind technische Konstanten des Standards, keine fachlichen
// Schwellen. Deshalb liegen sie im Validator, nicht in rules.yaml.

export const CONTAINER_MUSTER = /^[A-Z]{3}[UJZ][0-9]{7}$/;

const LAENGE_OHNE_PRUEFZIFFER = 10;
const MODUL_ISO6346 = 11;
const BUCHSTABEN_START = 10; // A = 10
const ASCII_A = 65;

/** Entfernt Leerzeichen, Bindestriche und Kleinschreibung: "MSKU 123456-5" wird "MSKU1234565". */
export function normalisiereContainerId(roh) {
  if (roh === null || roh === undefined) return null;
  return String(roh).toUpperCase().replace(/[\s-]/g, '');
}

/**
 * Buchstabenwert nach ISO 6346: A = 10, danach fortlaufend unter Auslassung der
 * Vielfachen von 11. Also B = 12, C = 13, K = 21, L = 23, U = 32, Z = 38.
 */
export function buchstabenwert(zeichen) {
  const index = zeichen.charCodeAt(0) - ASCII_A;
  // Zählen statt rechnen: Von A an hochzählen und jedes Vielfache von 11
  // überspringen. Eine geschlossene Formel war beim ersten Versuch bei L falsch
  // (22 statt 23) — die Schleife ist in zwei Sätzen erklärbar, die Formel nicht.
  let wert = BUCHSTABEN_START;
  for (let i = 0; i < index; i += 1) {
    wert += 1;
    if (wert % MODUL_ISO6346 === 0) wert += 1;
  }
  return wert;
}

/** Berechnet die Prüfziffer für die ersten zehn Zeichen. Rest 10 wird als 0 dargestellt. */
export function containerPruefziffer(id) {
  const kopf = normalisiereContainerId(id).slice(0, LAENGE_OHNE_PRUEFZIFFER);
  if (!/^[A-Z]{4}[0-9]{6}$/.test(kopf)) return null;
  let summe = 0;
  for (let i = 0; i < LAENGE_OHNE_PRUEFZIFFER; i += 1) {
    const zeichen = kopf[i];
    const wert = /[A-Z]/.test(zeichen) ? buchstabenwert(zeichen) : Number(zeichen);
    summe += wert * 2 ** i;
  }
  return (summe % MODUL_ISO6346) % 10;
}

/**
 * Ergebnis der Strukturprüfung. `format` sagt, ob die Kennung überhaupt wie
 * eine Containernummer aussieht; `pruefziffer` sagt, ob die letzte Stelle
 * stimmt. Beides getrennt, weil ein Formatfehler ein anderes Signal ist als ein
 * Prüfziffernfehler.
 */
export function pruefeContainerId(roh) {
  const id = normalisiereContainerId(roh);
  if (!id || !CONTAINER_MUSTER.test(id)) {
    return { id, format: false, pruefziffer: false, erwartet: null };
  }
  const erwartet = containerPruefziffer(id);
  const tatsaechlich = Number(id[LAENGE_OHNE_PRUEFZIFFER]);
  return { id, format: true, pruefziffer: erwartet === tatsaechlich, erwartet };
}
