// Der Zustand der Einreichung als Zustandsmaschine.
//
// Vier Stände, und nur der Effect bewegt sie weiter:
//
//   `bereit` --Eingereicht--> `laeuft` --beantwortet--> `fertig`
//                                      --fehlgeschlagen--> `fehler`
//
// Reine Funktionen, ohne Angular und ohne HttpClient — deshalb ist der
// Zustand ohne Browser prüfbar (akte.reducer.spec.ts).

import { createFeature, createReducer, createSelector, on } from '@ngrx/store';

import { AkteAktionen } from './akte.aktionen';
import type { Beleg, Befund, Pruefergebnis } from './akte.modell';

export type Stand = 'bereit' | 'laeuft' | 'fertig' | 'fehler';

export interface AkteZustand {
  belege: Beleg[];
  abgelehnt: string[];
  stand: Stand;
  ergebnis: Pruefergebnis | null;
  fehler: string | null;
}

export const anfangszustand: AkteZustand = {
  belege: [],
  abgelehnt: [],
  stand: 'bereit',
  ergebnis: null,
  fehler: null,
};

export const akteFeature = createFeature({
  name: 'akte',
  reducer: createReducer(
    anfangszustand,
    on(AkteAktionen.belegeHinzugefuegt, (zustand, { belege }) => ({
      ...zustand,
      // Ein neuer Beleg macht ein altes Ergebnis ungültig: Es gehörte zu
      // einer anderen Zusammenstellung.
      belege: [...zustand.belege, ...belege],
      abgelehnt: [],
      stand: 'bereit' as const,
      ergebnis: null,
      fehler: null,
    })),
    on(AkteAktionen.belegeAbgelehnt, (zustand, { namen }) => ({ ...zustand, abgelehnt: namen })),
    on(AkteAktionen.belegEntfernt, (zustand, { id }) => ({
      ...zustand,
      belege: zustand.belege.filter((beleg) => beleg.id !== id),
      stand: 'bereit' as const,
      ergebnis: null,
      fehler: null,
    })),
    on(AkteAktionen.eingereicht, (zustand) => ({ ...zustand, stand: 'laeuft' as const, fehler: null })),
    on(AkteAktionen.einreichungBeantwortet, (zustand, { ergebnis }) => ({
      ...zustand,
      stand: 'fertig' as const,
      ergebnis,
      fehler: null,
    })),
    on(AkteAktionen.einreichungFehlgeschlagen, (zustand, { meldung }) => ({
      ...zustand,
      stand: 'fehler' as const,
      ergebnis: null,
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
 * Befunde, die keine `ok` sind — in der Reihenfolge, die das Regelwerk
 * geliefert hat (hart vor weich). Hier wird nicht bewertet, nur gefiltert.
 */
export const waehleOffeneBefunde = createSelector(
  selectErgebnis,
  (ergebnis): Befund[] => (ergebnis?.befunde ?? []).filter((befund) => befund.status !== 'ok'),
);

export const waehleOffenePflicht = createSelector(selectErgebnis, (ergebnis) =>
  (ergebnis?.pflichtmatrix.befunde ?? []).filter((befund) => befund.status !== 'ok'),
);

export const waehleNachforderungen = createSelector(selectErgebnis, (ergebnis) => ergebnis?.nachforderungen ?? []);

export const waehleDokumente = createSelector(selectErgebnis, (ergebnis) => ergebnis?.dokumente ?? []);

/**
 * Alles, was die Extraktion nicht lesen oder nicht einordnen konnte.
 * CLAUDE.md, harte Grenze 2: Das wird gemeldet, nie verworfen.
 */
export const waehleExtraktionshinweise = createSelector(
  selectErgebnis,
  (ergebnis) => ergebnis?.extraktion?.hinweise ?? [],
);
