// Der Zustand der Einreichung als Zustandsmaschine.
//
// Vier Stände, und nur der Effect bewegt sie weiter:
//
//   `bereit` --Eingereicht--> `laeuft` --beantwortet--> `fertig`
//                                      --fehlgeschlagen--> `fehler`
//
// Ein fünfter Fall liegt quer dazu: Ändern sich die Belege, nachdem ein
// Ergebnis vorlag, wird es **entwertet, nicht gelöscht** (Entwurf, Zustand
// 10). Wer nur `null` setzt, nimmt dem Menschen die Information, dass es
// eine frühere Entscheidung gab.
//
// Reine Funktionen, ohne Angular und ohne Uhr — der Zeitpunkt kommt mit der
// Aktion herein, nicht aus `new Date()` im Reducer.

import { createFeature, createReducer, createSelector, on } from '@ngrx/store';

import { AkteAktionen } from './akte.aktionen';
import type { Beleg, Befund, Nachforderung, Pflichtbefund, Pruefergebnis, Stammdaten, Uebersteuerung } from './akte.modell';

export type Stand = 'bereit' | 'laeuft' | 'fertig' | 'fehler';

export interface AkteZustand {
  belege: Beleg[];
  abgelehnt: string[];
  stand: Stand;
  ergebnis: Pruefergebnis | null;
  /** Wann das Ergebnis kam, als ISO-Zeichenkette. */
  gepruefetAm: string | null;
  /** Die Belege haben sich seit dem Ergebnis geändert; es gilt nicht mehr. */
  veraltet: boolean;
  /**
   * Die menschlichen Entscheidungen zu dieser Akte (ADR-007). Sie gehen als
   * Eingabe in die nächste Prüfung; die Oberfläche rechnet mit ihnen nicht.
   */
  uebersteuerungen: Uebersteuerung[];
  /**
   * Die zuletzt eingereichten Stammdaten. Ohne sie könnte eine Übersteuerung
   * keine neue Prüfung auslösen — sie wären in der Komponente gefangen.
   */
  stammdaten: Stammdaten | null;
  fehler: string | null;
}

export const anfangszustand: AkteZustand = {
  belege: [],
  abgelehnt: [],
  stand: 'bereit',
  ergebnis: null,
  gepruefetAm: null,
  veraltet: false,
  uebersteuerungen: [],
  stammdaten: null,
  fehler: null,
};

/** Ein Ergebnis, das vorlag, gilt nach einer Belegänderung nicht mehr. */
function entwerte(zustand: AkteZustand): Pick<AkteZustand, 'stand' | 'veraltet' | 'fehler'> {
  return { stand: 'bereit', veraltet: zustand.ergebnis !== null, fehler: null };
}

export const akteFeature = createFeature({
  name: 'akte',
  reducer: createReducer(
    anfangszustand,
    on(AkteAktionen.belegeHinzugefuegt, (zustand, { belege }) => ({
      ...zustand,
      ...entwerte(zustand),
      belege: [...zustand.belege, ...belege],
      abgelehnt: [],
    })),
    on(AkteAktionen.belegeAbgelehnt, (zustand, { namen }) => ({ ...zustand, abgelehnt: namen })),
    on(AkteAktionen.belegEntfernt, (zustand, { id }) => ({
      ...zustand,
      ...entwerte(zustand),
      belege: zustand.belege.filter((beleg) => beleg.id !== id),
    })),
    on(AkteAktionen.eingereicht, (zustand, { stammdaten }) => ({
      ...zustand,
      stand: 'laeuft' as const,
      stammdaten,
      fehler: null,
    })),
    // Eine Übersteuerung ersetzt die vorherige zur selben Kennung: Wer seine
    // Begründung ändert, hat eine Entscheidung, nicht zwei.
    on(AkteAktionen.befundUebersteuert, (zustand, { uebersteuerung }) => ({
      ...zustand,
      stand: 'laeuft' as const,
      uebersteuerungen: [
        ...zustand.uebersteuerungen.filter((u) => u.regel !== uebersteuerung.regel),
        uebersteuerung,
      ],
      fehler: null,
    })),
    on(AkteAktionen.uebersteuerungZurueckgenommen, (zustand, { regel }) => ({
      ...zustand,
      stand: 'laeuft' as const,
      uebersteuerungen: zustand.uebersteuerungen.filter((u) => u.regel !== regel),
      fehler: null,
    })),
    on(AkteAktionen.einreichungBeantwortet, (zustand, { ergebnis, zeitpunkt }) => ({
      ...zustand,
      stand: 'fertig' as const,
      ergebnis,
      gepruefetAm: zeitpunkt,
      veraltet: false,
      fehler: null,
    })),
    on(AkteAktionen.einreichungFehlgeschlagen, (zustand, { meldung }) => ({
      ...zustand,
      stand: 'fehler' as const,
      // Das Ergebnis bleibt nicht stehen: Ein Transportfehler ist kein
      // Prüfergebnis, und ein alter Befund daneben wäre irreführend.
      ergebnis: null,
      gepruefetAm: null,
      veraltet: false,
      fehler: meldung,
    })),
    on(AkteAktionen.neuBegonnen, () => anfangszustand),
  ),
});

export const {
  name: akteMerkmalName,
  reducer: akteReducer,
  selectBelege,
  selectAbgelehnt,
  selectStand,
  selectErgebnis,
  selectGepruefetAm,
  selectVeraltet,
  selectUebersteuerungen,
  selectStammdaten,
  selectFehler,
} = akteFeature;

export const waehleBelegIds = createSelector(selectBelege, (belege) => belege.map((beleg) => beleg.id));

export const waehleLaeuft = createSelector(selectStand, (stand) => stand === 'laeuft');

/** Absenden ist möglich, sobald mindestens ein Beleg vorliegt und nichts läuft. */
export const waehleEinreichbar = createSelector(
  selectBelege,
  selectStand,
  (belege, stand) => belege.length > 0 && stand !== 'laeuft',
);

/**
 * Ein Ergebnis wird nur gezeigt, wenn es noch gilt. Ein entwertetes bleibt
 * im Zustand — die Oberfläche sagt, dass es eines gab, zeigt es aber nicht.
 */
export const waehleGueltigesErgebnis = createSelector(selectErgebnis, selectStand, selectVeraltet, (ergebnis, stand, veraltet) =>
  stand === 'fertig' && !veraltet ? ergebnis : null,
);

export const waehleEntwertet = createSelector(
  selectErgebnis,
  selectVeraltet,
  selectGepruefetAm,
  (ergebnis, veraltet, zeitpunkt) => (veraltet && ergebnis ? { freigabe: ergebnis.freigabe, zeitpunkt } : null),
);

/**
 * Befunde, die keine `ok` sind — in der Reihenfolge, die das Regelwerk
 * geliefert hat (hart vor weich). Hier wird nicht bewertet, nur gefiltert.
 */
export const waehleOffeneBefunde = createSelector(
  waehleGueltigesErgebnis,
  (ergebnis): Befund[] => (ergebnis?.befunde ?? []).filter((befund) => befund.status !== 'ok'),
);

export const waehleOffenePflicht = createSelector(waehleGueltigesErgebnis, (ergebnis) =>
  (ergebnis?.pflichtmatrix.befunde ?? []).filter((befund) => befund.status !== 'ok'),
);

/**
 * Die erfüllten Pflichten mit dem Beleg, der sie erfüllt. Für die Lesung
 * Monate später: Welcher Beleg hat welchen Nachweis erbracht.
 */
export const waehleErfuelltePflicht = createSelector(waehleGueltigesErgebnis, (ergebnis): Pflichtbefund[] =>
  (ergebnis?.pflichtmatrix.befunde ?? []).filter((befund) => befund.status === 'ok'),
);

/** Wie viele Regeln geprüft wurden und wie viele davon offen sind. */
export const waehleRegelBilanz = createSelector(waehleGueltigesErgebnis, (ergebnis) => {
  const alle = ergebnis?.befunde ?? [];
  const offen = alle.filter((befund) => befund.status !== 'ok').length;
  return { gesamt: alle.length, offen, ohneBefund: alle.length - offen };
});

export const waehlePflichtBilanz = createSelector(waehleGueltigesErgebnis, (ergebnis) => {
  const alle = ergebnis?.pflichtmatrix.befunde ?? [];
  const offen = alle.filter((befund) => befund.status !== 'ok').length;
  return { gesamt: alle.length, offen, erfuellt: alle.length - offen };
});

export const waehleNachforderungen = createSelector(waehleGueltigesErgebnis, (ergebnis) => ergebnis?.nachforderungen ?? []);

export interface Adressatengruppe {
  primaer: string;
  sekundaer: string | null;
  faelle: Nachforderung[];
}

/**
 * Nachforderungen nach Adressat, weil die reale Handlung eine Nachricht je
 * Empfänger ist (Entwurf 1b). Bei nur einem Adressaten wäre die Gliederung
 * eine leere Hülle — dann liefert der Selektor eine einzige Gruppe, und die
 * Darstellung lässt die Überschrift weg.
 */
export const waehleNachforderungenNachAdressat = createSelector(
  waehleNachforderungen,
  (faelle): Adressatengruppe[] => {
    const gruppen = new Map<string, Adressatengruppe>();
    for (const fall of faelle) {
      const schluessel = fall.adressat.primaer;
      const gruppe = gruppen.get(schluessel);
      if (gruppe) gruppe.faelle.push(fall);
      else gruppen.set(schluessel, { primaer: schluessel, sekundaer: fall.adressat.sekundaer, faelle: [fall] });
    }
    return [...gruppen.values()];
  },
);

export const waehleMehrereAdressaten = createSelector(
  waehleNachforderungenNachAdressat,
  (gruppen) => gruppen.length > 1,
);

/**
 * Die beiden Entscheidungen, wenn sie auseinandergehen (ADR-007).
 *
 * Liefert `null`, solange niemand übersteuert hat — dann gibt es nichts zu
 * erklären. Geht es auseinander, muss die Oberfläche beides zeigen: Ein
 * roter Befund, der nicht blockiert, sieht sonst wie ein Fehler aus.
 */
export const waehleFreigabeUnterschied = createSelector(waehleGueltigesErgebnis, (ergebnis) =>
  ergebnis && ergebnis.freigabe !== ergebnis.freigabe_nach_override
    ? { ohne: ergebnis.freigabe, mit: ergebnis.freigabe_nach_override }
    : null,
);

/**
 * Der Name aus der zuletzt eingetragenen Übersteuerung, zur Vorbelegung.
 *
 * Das ist eine Bequemlichkeit, keine Anmeldung: Wer hier steht, hat es
 * selbst getippt. ADR-007 sagt das ausdrücklich — ein Override mit
 * erfundenem Namen ist im Audit wertlos, und nichts hindert daran.
 */
export const waehleLetzterBenutzer = createSelector(
  selectUebersteuerungen,
  (uebersteuerungen) => uebersteuerungen.at(-1)?.benutzer ?? '',
);

/** Die Befunde, die ein Mensch verantwortet hat. Ihr Status bleibt `verletzt`. */
export const waehleUebersteuerteBefunde = createSelector(
  waehleGueltigesErgebnis,
  (ergebnis): Befund[] => (ergebnis?.befunde ?? []).filter((befund) => befund.uebersteuert_von),
);

/**
 * Übersteuerungen, die durch eine Katalogänderung hinfällig wurden. Sie
 * verschwinden nicht: Sie sind der Nachweis, dass einmal jemand entschieden
 * hat — und die Aufforderung, erneut zu entscheiden.
 */
export const waehleVerbrauchteUebersteuerungen = createSelector(
  waehleGueltigesErgebnis,
  (ergebnis) => ergebnis?.uebersteuerungen.verbraucht ?? [],
);

export const waehleDokumente = createSelector(waehleGueltigesErgebnis, (ergebnis) => ergebnis?.dokumente ?? []);

/**
 * Alles, was die Extraktion nicht lesen oder nicht einordnen konnte.
 * CLAUDE.md, harte Grenze 2: Das wird gemeldet, nie verworfen.
 */
export const waehleExtraktionshinweise = createSelector(
  waehleGueltigesErgebnis,
  (ergebnis) => ergebnis?.extraktion?.hinweise ?? [],
);
