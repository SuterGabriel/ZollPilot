// Ereignisse der Übersicht. Wie bei der Akte: was passiert ist, nicht was zu
// tun ist.

import { createActionGroup, emptyProps, props } from '@ngrx/store';

import type { Uebersicht } from './uebersicht.modell';

export const UebersichtAktionen = createActionGroup({
  source: 'Uebersicht',
  events: {
    'Laden angefordert': emptyProps(),
    // Der Zeitpunkt kommt mit der Aktion herein; der Reducer hat keine Uhr.
    Geladen: props<{ daten: Uebersicht; zeitpunkt: string }>(),
    'Laden fehlgeschlagen': props<{ meldung: string }>(),
  },
});
