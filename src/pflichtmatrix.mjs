// Pflichtmatrix: welche Daten müssen nachgewiesen sein, und durch welche Belege.
// Instanziiert aus pflichtmatrix.yaml für den Sachverhalt der Akte.
//
// Ein Eintrag ist erfüllt, wenn der Fakt existiert UND aus einem finalen
// Dokument eines zugelassenen Typs stammt. Das ist Prinzip 1 (Nachweis statt
// Dokument): EUR.1 und Ursprungserklärung erfüllen dieselbe Anforderung.

import { fakt, liesPfad } from './akte/aufbau.mjs';

/** Wertet die einfache Bedingung "pfad == literal" aus; ohne Bedingung gilt der Eintrag. */
function bedingungErfuellt(akte, bedingung) {
  if (!bedingung) return true;
  const treffer = /^([\w.]+)\s*==\s*(\S+)$/.exec(bedingung);
  if (!treffer) throw new Error(`Bedingung nicht lesbar: ${bedingung}`);
  const [, pfad, literal] = treffer;
  const wert = fakt(akte, pfad);
  const erwartet = literal === 'true' ? true : literal === 'false' ? false : literal;
  return wert === erwartet;
}

function scopePasst(scope, sachverhalt) {
  if (!scope) return true;
  return (!scope.direction || scope.direction === sachverhalt?.richtung)
    && (!scope.mode || scope.mode === sachverhalt?.verkehrstraeger)
    && (scope.preference_claimed === undefined || scope.preference_claimed === Boolean(sachverhalt?.praeferenz_beansprucht));
}

export function pruefePflichtmatrix(akte, matrix) {
  const sachverhalt = fakt(akte, 'sachverhalt');
  if (!scopePasst(matrix.scope, sachverhalt)) {
    return { anwendbar: false, befunde: [], grund: `Pflichtmatrix ${matrix.version} deckt diesen Sachverhalt nicht` };
  }

  const befunde = [];
  for (const eintrag of matrix.entries) {
    if (!bedingungErfuellt(akte, eintrag.condition)) continue;

    const wert = fakt(akte, eintrag.required_data);
    const herkunft = akte.herkunft?.[eintrag.required_data];
    const basis = {
      id: eintrag.id,
      required_data: eintrag.required_data,
      label: eintrag.label,
      haerte: eintrag.hardness,
      akzeptierte_nachweise: eintrag.required_evidence,
      rechtsgrundlage: eintrag.legal_basis,
    };

    // Stammdaten (sachverhalt.*) haben keine Belegherkunft; ihr Vorhandensein genügt.
    const istStammdatum = eintrag.required_data.startsWith('sachverhalt.') || eintrag.required_data.startsWith('anmeldung.');
    if (wert === undefined || wert === null || wert === '') {
      befunde.push({ ...basis, status: 'fehlt', begruendung: `${eintrag.label}: kein Nachweis in der Akte` });
      continue;
    }
    if (!istStammdatum && herkunft && !eintrag.required_evidence.includes(herkunft.dokument_typ)) {
      befunde.push({
        ...basis,
        status: 'falscher_nachweis',
        begruendung: `${eintrag.label}: stammt aus ${herkunft.dokument_typ}, zugelassen sind ${eintrag.required_evidence.join(', ')}`,
      });
      continue;
    }
    befunde.push({ ...basis, status: 'ok', quelle: herkunft?.dokument ?? 'stammdaten', begruendung: `${eintrag.label} nachgewiesen` });
  }
  return { anwendbar: true, befunde };
}

// liesPfad wird hier nur re-exportiert, damit Aufrufer die Pflichtmatrix ohne
// zweiten Import erweitern können.
export { liesPfad };
