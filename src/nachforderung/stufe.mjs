// Welche Eskalationsstufe ist für einen offenen Fall fällig (ADR-009).
//
// Die Stufen stehen in `zustaendigkeiten.yaml`, jede mit `bezug` (welcher
// Cut-off der Akte) und `vorlauf_stunden`. Die Cut-offs stehen in der Akte
// unter `fristen`. Fehlt ein Cut-off, ist die Stufe nicht erreichbar, und
// das Ergebnis sagt warum; ein Datum wird nie erfunden.
//
// Eine Stufe je Lauf, und zwischen zwei Versendungen an denselben Fall
// mindestens `versand.mindestabstand_stunden`. Reine Funktion, der
// Zeitpunkt kommt herein.

export const STUFE_STOP = 'stop';

const MILLISEKUNDEN_JE_STUNDE = 3_600_000;

function stunden(h) {
  return Number(h ?? 0) * MILLISEKUNDEN_JE_STUNDE;
}

function zeit(iso) {
  const t = Date.parse(iso ?? '');
  return Number.isNaN(t) ? null : t;
}

/**
 * @param {object} fall   { stufe: zuletzt versandte Stufe oder null, letzter_versand_am }
 * @param {object} fristen { customs_cutoff, carrier_cutoff, eta }, alle optional, ISO
 * @param {object} `zustaendigkeiten` Katalog mit `escalation[]` und `versand`
 * @param {string} jetzt  ISO-Zeitpunkt
 * @returns `{ faellig, stufe, grund, adressat? }`
 */
export function faelligeStufe(fall, fristen, zustaendigkeiten, jetzt) {
  const stufen = zustaendigkeiten.escalation ?? [];
  const t = zeit(jetzt);
  if (t === null) return { faellig: false, stufe: null, grund: 'Zeitpunkt fehlt oder ist kein Datum' };

  const index = fall?.stufe ? stufen.findIndex((s) => s.stufe === fall.stufe) : -1;
  if (fall?.stufe && index < 0) return { faellig: false, stufe: null, grund: `Stufe ${fall.stufe} steht nicht im Katalog` };
  const naechste = stufen[index + 1];
  if (!naechste) return { faellig: false, stufe: null, grund: `Letzte Stufe ${fall.stufe} ist erreicht` };

  const abstand = stunden(zustaendigkeiten.versand?.mindestabstand_stunden);
  const zuletzt = zeit(fall?.letzter_versand_am);
  if (zuletzt !== null && t - zuletzt < abstand) {
    return { faellig: false, stufe: naechste.stufe, grund: `Mindestabstand von ${zustaendigkeiten.versand?.mindestabstand_stunden ?? 0} Stunden seit dem letzten Versand nicht erreicht` };
  }

  if (!naechste.bezug) {
    return { faellig: true, stufe: naechste.stufe, grund: naechste.zeitpunkt, adressat: naechste.adressat };
  }

  const cutoff = zeit(fristen?.[naechste.bezug]);
  if (cutoff === null) {
    return { faellig: false, stufe: naechste.stufe, grund: `Frist ${naechste.bezug} nicht in der Akte; Stufe ${naechste.stufe} ist ohne sie nicht erreichbar` };
  }
  const faelligAb = cutoff - stunden(naechste.vorlauf_stunden);
  if (t >= faelligAb) {
    return { faellig: true, stufe: naechste.stufe, grund: `${naechste.zeitpunkt}: ${naechste.bezug} ${fristen[naechste.bezug]}, Vorlauf ${naechste.vorlauf_stunden} h`, adressat: naechste.adressat };
  }
  return { faellig: false, stufe: naechste.stufe, grund: `${naechste.stufe} wird fällig ab ${new Date(faelligAb).toISOString()}` };
}

/**
 * Rolle zu Postfach, aus `versand.verteiler`. Unbekannte Rollen gehen an den
 * Standard, damit keine Nachforderung im Nichts endet; welche Rolle das
 * war, steht daneben.
 */
export function postfach(rolle, zustaendigkeiten) {
  const verteiler = zustaendigkeiten.versand?.verteiler ?? {};
  return verteiler[rolle] ?? verteiler.standard ?? null;
}

/**
 * Der ganze Lauf für eine Akte: Abgleich ist Sache von abgleich.mjs, hier
 * bekommt jeder offene oder neu eröffnete Fall seine fällige Stufe und die
 * Postfächer, an die sie geht: Adressat des Falls, Kopie, und ab der
 * zweiten Stufe zusätzlich der Adressat der Stufe.
 */
export function planeVersand(faelle, fristen, zustaendigkeiten, jetzt) {
  return faelle.map((fall) => {
    const entscheidung = faelligeStufe(fall, fristen, zustaendigkeiten, jetzt);
    if (!entscheidung.faellig) return { ...fall, versand: entscheidung };
    const rollen = [fall.adressat, fall.adressat_kopie, entscheidung.adressat === 'primaer' ? null : entscheidung.adressat]
      .filter(Boolean);
    const an = [...new Set(rollen.map((r) => postfach(r, zustaendigkeiten)).filter(Boolean))];
    // Betreff und Text der Stufe entstehen hier, nicht im Workflow: Was in
    // der Mail steht, ist eine Aussage des Regelwerks über die Akte.
    const betreff = `[${entscheidung.stufe}] ${fall.betreff ?? `Nachforderung ${fall.grund}`}`;
    const text = `${fall.text ?? ''}\n\nStufe: ${entscheidung.stufe} (${entscheidung.grund})`;
    return { ...fall, versand: { ...entscheidung, rollen, an, betreff, text } };
  });
}
