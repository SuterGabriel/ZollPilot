// Was in dieser Oberfläche geschehen kann. Die Namen sagen, was passiert ist,
// nicht was zu tun ist — eine Aktion ist ein Ereignis, kein Befehl.

import { createActionGroup, emptyProps, props } from '@ngrx/store';

import type { Beleg, Pruefergebnis, Stammdaten } from './akte.modell';

export const AkteAktionen = createActionGroup({
  source: 'Akte',
  events: {
    'Belege hinzugefuegt': props<{ belege: Beleg[] }>(),
    'Beleg entfernt': props<{ id: string }>(),
    'Belege abgelehnt': props<{ namen: string[] }>(),
    Eingereicht: props<{ stammdaten: Stammdaten }>(),
    'Einreichung beantwortet': props<{ ergebnis: Pruefergebnis }>(),
    'Einreichung fehlgeschlagen': props<{ meldung: string }>(),
    'Neu begonnen': emptyProps(),
  },
});
