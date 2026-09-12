// Der Zustand der Übersicht: vier Stände, und nur der Effect bewegt sie.
//
//   `bereit` --angefordert--> `laeuft` --geladen--> `fertig`
//                                      --fehlgeschlagen--> `fehler`
//
// Ein Fehler löscht die alten Daten nicht: Was zuletzt geladen war, bleibt
// sichtbar, mit dem Zeitpunkt; die Meldung steht daneben. Eine leere
// Tabelle hieße „nichts offen“, und das ist bei einem Fehler nicht bekannt.
// Reine Funktionen, keine Uhr.

import { createFeature, createReducer, createSelector, on } from '@ngrx/store';

import { UebersichtAktionen } from './uebersicht.aktionen';
import type { Uebersicht } from './uebersicht.modell';

export type UebersichtStand = 'bereit' | 'laeuft' | 'fertig' | 'fehler';

export interface UebersichtZustand {
  stand: UebersichtStand;
  daten: Uebersicht | null;
  geladenAm: string | null;
  fehler: string | null;
}

export const uebersichtAnfang: UebersichtZustand = {
  stand: 'bereit',
  daten: null,
  geladenAm: null,
  fehler: null,
};

export const uebersichtFeature = createFeature({
  name: 'uebersicht',
  reducer: createReducer(
    uebersichtAnfang,
    on(UebersichtAktionen.ladenAngefordert, (zustand) => ({ ...zustand, stand: 'laeuft' as const, fehler: null })),
    on(UebersichtAktionen.geladen, (zustand, { daten, zeitpunkt }) => ({
      ...zustand,
      stand: 'fertig' as const,
      daten,
      geladenAm: zeitpunkt,
      fehler: null,
    })),
    on(UebersichtAktionen.ladenFehlgeschlagen, (zustand, { meldung }) => ({
      ...zustand,
      stand: 'fehler' as const,
      fehler: meldung,
    })),
  ),
});

export const {
  selectStand: selectUebersichtStand,
  selectDaten: selectUebersichtDaten,
  selectGeladenAm: selectUebersichtGeladenAm,
  selectFehler: selectUebersichtFehler,
} = uebersichtFeature;

export const waehleUebersichtLaeuft = createSelector(selectUebersichtStand, (stand) => stand === 'laeuft');
export const waehleAkten = createSelector(selectUebersichtDaten, (daten) => daten?.akten ?? []);
export const waehleUnzugeordnet = createSelector(selectUebersichtDaten, (daten) => daten?.unzugeordnet ?? []);
export const waehleZusammenfassung = createSelector(selectUebersichtDaten, (daten) => daten?.zusammenfassung ?? null);
