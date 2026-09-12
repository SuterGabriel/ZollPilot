// Override: Verantwortung neben dem Befund, nie statt seiner (ADR-007).
//
// Ein Mensch kann entscheiden, eine Akte trotz eines Befundes freizugeben.
// Er ändert damit **nicht**, was das Regelwerk gesagt hat — der Befund bleibt
// `verletzt`, und daneben steht, wer die Freigabe verantwortet und warum.
// Auf die Frage nach drei Jahren („welche Regel galt, was sagte sie, wer hat
// sie übersteuert") antwortet dann eine Abfrage statt einer Rekonstruktion.
//
// Ein Override gilt für **eine Kennung in einer Akte zu einer Fassung**.
// Ändert sich der Katalog, ist er verbraucht: Die Person hat eine andere
// Regel verantwortet als die, die jetzt gilt. Das ist unbequem und richtig —
// genau darüber entscheidet eine Zollprüfung.
//
// Die Form entspricht der Tabelle `override` in deploy/postgres/init.sql:
//   `{ regel, benutzer, begruendung, erzeugt_am, fassung }`
// `fassung` ist die Regel- beziehungsweise Pflichtversion, gegen die
// entschieden wurde.

export const ANGEWANDT = 'angewandt';
export const VERBRAUCHT = 'verbraucht';

/** Die kürzeste Begründung, die noch eine ist — wie der CHECK in der Tabelle. */
export const MINDESTLAENGE_BEGRUENDUNG = 11;

/**
 * Prüft die Form eines Overrides. Was hier durchfällt, hätte die Datenbank
 * ohnehin abgelehnt; die Prüfung steht hier, damit ein Aufrufer den Grund
 * erfährt statt eines Constraint-Fehlers.
 */
export function formfehler(override) {
  const fehler = [];
  if (!override || typeof override !== 'object') return ['kein Objekt'];
  if (!override.regel) fehler.push('regel fehlt');
  if (!override.benutzer) fehler.push('benutzer fehlt');
  if (!override.fassung) fehler.push('fassung fehlt');
  if (!override.begruendung || String(override.begruendung).trim().length < MINDESTLAENGE_BEGRUENDUNG) {
    fehler.push(`begruendung braucht mindestens ${MINDESTLAENGE_BEGRUENDUNG} Zeichen`);
  }
  return fehler;
}

/**
 * Ordnet die Overrides einer Kennung zu.
 *
 * Liefert den gültigen (gleiche Fassung) und die verbrauchten (andere
 * Fassung). Verbrauchte verschwinden nicht: Sie werden gemeldet, damit
 * sichtbar bleibt, dass jemand einmal entschieden hat und die Entscheidung
 * durch eine Katalogänderung hinfällig wurde.
 */
export function ordneZu(overrides, kennung, fassung) {
  const eigene = (overrides ?? []).filter((o) => o && o.regel === kennung);
  const gueltig = eigene.find((o) => o.fassung === fassung && formfehler(o).length === 0) ?? null;
  const verbraucht = eigene.filter((o) => o !== gueltig);
  return { gueltig, verbraucht };
}

/**
 * Hängt die Übersteuerung an einen Befund. Der Status bleibt unberührt —
 * das ist der ganze Punkt dieser ADR.
 */
export function hefteAn(befund, kennung, fassung, overrides) {
  const { gueltig, verbraucht } = ordneZu(overrides, kennung, fassung);
  if (!gueltig && verbraucht.length === 0) return befund;
  return {
    ...befund,
    ...(gueltig
      ? {
          uebersteuert_von: gueltig.benutzer,
          uebersteuert_am: gueltig.erzeugt_am ?? null,
          uebersteuerungsgrund: gueltig.begruendung,
          // Woher der Name stammt (ADR-009): `proxy`, wenn nginx ihn geprüft
          // und als Header mitgegeben hat; sonst `angegeben`, also getippt.
          // Ein Audit-Eintrag ohne diese Angabe wäre eine Behauptung.
          uebersteuert_identitaet: gueltig.identitaet ?? 'angegeben',
        }
      : {}),
    ...(verbraucht.length > 0
      ? {
          uebersteuerung_verbraucht: verbraucht.map((o) => ({
            benutzer: o.benutzer,
            fassung: o.fassung,
            erzeugt_am: o.erzeugt_am ?? null,
          })),
        }
      : {}),
  };
}

/** Ob ein Befund für die Freigabe zählt, wenn Übersteuerungen berücksichtigt werden. */
export function zaehltTrotzUebersteuerung(befund) {
  return !befund.uebersteuert_von;
}
