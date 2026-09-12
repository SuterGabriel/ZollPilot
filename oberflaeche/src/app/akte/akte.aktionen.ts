// Was in dieser Oberfläche geschehen kann. Die Namen sagen, was passiert ist,
// nicht was zu tun ist. Eine Aktion ist ein Ereignis, kein Befehl.

import { createActionGroup, emptyProps, props } from '@ngrx/store';

import type { Beleg, Pruefergebnis, Stammdaten, Uebersteuerung } from './akte.modell';

export const AkteAktionen = createActionGroup({
  source: 'Akte',
  events: {
    'Belege hinzugefuegt': props<{ belege: Beleg[] }>(),
    'Beleg entfernt': props<{ id: string }>(),
    'Belege abgelehnt': props<{ namen: string[] }>(),
    Eingereicht: props<{ stammdaten: Stammdaten }>(),
    // Der Zeitpunkt kommt mit der Aktion herein, damit der Reducer keine Uhr
    // braucht und ohne Vorkehrung prüfbar bleibt.
    'Einreichung beantwortet': props<{ ergebnis: Pruefergebnis; zeitpunkt: string }>(),
    'Einreichung fehlgeschlagen': props<{ meldung: string }>(),
    // Ein Mensch verantwortet einen Befund (ADR-007). Die Akte wird danach
    // erneut geprüft; die Übersteuerung ist eine Eingabe des Regelwerks,
    // kein Eingriff in ein vorhandenes Ergebnis.
    'Befund uebersteuert': props<{ uebersteuerung: Uebersteuerung }>(),
    'Uebersteuerung zurueckgenommen': props<{ regel: string }>(),
    'Neu begonnen': emptyProps(),
  },
});
