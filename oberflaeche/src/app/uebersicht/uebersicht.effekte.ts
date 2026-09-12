// Der einzige Ort, an dem die Übersicht etwas nach außen tut: laden.

import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { mapResponse } from '@ngrx/operators';
import { switchMap } from 'rxjs';

import { UebersichtAktionen } from './uebersicht.aktionen';
import { UebersichtDienst, uebersichtFehlermeldung } from './uebersicht.dienst';

export const uebersichtLaden = createEffect(
  (aktionen$ = inject(Actions), dienst = inject(UebersichtDienst)) =>
    aktionen$.pipe(
      ofType(UebersichtAktionen.ladenAngefordert),
      // `switchMap`: Wer zweimal lädt, will das zweite Ergebnis.
      switchMap(() =>
        dienst.laden().pipe(
          mapResponse({
            next: (daten) => UebersichtAktionen.geladen({ daten, zeitpunkt: new Date().toISOString() }),
            error: (fehler: unknown) => UebersichtAktionen.ladenFehlgeschlagen({ meldung: uebersichtFehlermeldung(fehler) }),
          }),
        ),
      ),
    ),
  { functional: true },
);

export const uebersichtEffekte = { uebersichtLaden };
