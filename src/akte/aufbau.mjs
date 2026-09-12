// Aufbau der Akte aus Assertions (CLAUDE.md, Prinzip 2).
//
// Eingang: eine Sendung mit `dokumente[]` und `assertions[]`. Jede Assertion
// ist, was ein Beleg sagt: Dokument, Pfad, Wert, Rohwert, Konfidenz, Fundstelle.
// Ausgang: dieselbe Sendung plus `fakten` (der Aktenwert je Pfad) und
// `herkunft` (welches Dokument mit welcher Konfidenz den Fakt gesetzt hat).
//
// Zwei Zusagen, die REF-03 und OCR-01 tragen:
//   1. Nur Assertions aus Dokumenten mit status "final" werden zu Fakten. Alle
//      anderen landen in `nicht_final`, damit REF-03 sie melden kann.
//   2. Assertions werden nie verändert. `fakten` ist eine Ableitung; die
//      Beweiskette bleibt in `assertions` rekonstruierbar.

export const DOKUMENT_FINAL = 'final';

/** Setzt einen Wert unter einem Punktpfad. Numerische Segmente erzeugen Arrays. */
export function setzePfad(ziel, pfad, wert) {
  const teile = pfad.split('.');
  let aktuell = ziel;
  for (let i = 0; i < teile.length - 1; i += 1) {
    const teil = teile[i];
    const naechsterIstIndex = /^[0-9]+$/.test(teile[i + 1]);
    if (aktuell[teil] === undefined) aktuell[teil] = naechsterIstIndex ? [] : {};
    aktuell = aktuell[teil];
  }
  aktuell[teile[teile.length - 1]] = wert;
  return ziel;
}

/** Liest einen Wert unter einem Punktpfad; undefined, wenn der Pfad nicht existiert. */
export function liesPfad(quelle, pfad) {
  if (!quelle || !pfad) return undefined;
  return pfad.split('.').reduce((akt, teil) => (akt === undefined || akt === null ? undefined : akt[teil]), quelle);
}

export function baueAkte(eingang) {
  const dokumente = new Map((eingang.dokumente || []).map((d) => [d.id, d]));
  const fakten = {};
  const herkunft = {};
  const nichtFinal = [];
  const unbekannteDokumente = [];

  for (const assertion of eingang.assertions || []) {
    const dokument = dokumente.get(assertion.dokument);
    if (!dokument) {
      unbekannteDokumente.push(assertion);
      continue;
    }
    if (dokument.status !== DOKUMENT_FINAL) {
      nichtFinal.push({ ...assertion, dokument_status: dokument.status, dokument_typ: dokument.typ });
      continue;
    }
    setzePfad(fakten, assertion.pfad, assertion.wert);
    herkunft[assertion.pfad] = {
      dokument: dokument.id,
      dokument_typ: dokument.typ,
      konfidenz: assertion.konfidenz ?? 1,
      seite: assertion.seite ?? null,
      methode: assertion.methode ?? null,
    };
  }

  // Sachverhalt und Anmeldung sind keine Belegaussagen, sondern Stammdaten der
  // Akte. Sie liegen direkt am Eingang und werden als Fakten übernommen.
  if (eingang.sachverhalt) fakten.sachverhalt = eingang.sachverhalt;
  if (eingang.anmeldung) fakten.anmeldung = eingang.anmeldung;

  return {
    ...eingang,
    fakten,
    herkunft,
    nicht_final: nichtFinal,
    unbekannte_dokumente: unbekannteDokumente,
  };
}

/** Aktenwert unter einem Pfad. */
export function fakt(akte, pfad) {
  return liesPfad(akte.fakten, pfad);
}

/** Konfidenz, mit der ein Fakt extrahiert wurde; 1, wenn er kein Extraktionsergebnis ist. */
export function konfidenz(akte, pfad) {
  return akte.herkunft?.[pfad]?.konfidenz ?? 1;
}

/** Alle Dokumente eines Typs, optional nur finale. */
export function dokumenteVomTyp(akte, typ, nurFinal = false) {
  return (akte.dokumente || []).filter((d) => d.typ === typ && (!nurFinal || d.status === DOKUMENT_FINAL));
}
