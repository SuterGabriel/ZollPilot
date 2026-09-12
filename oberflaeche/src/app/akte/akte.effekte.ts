// Der einzige Ort, an dem diese Oberfläche etwas nach außen tut.
//
// Die Komponente sagt nur, dass eingereicht wurde; welche Dateien dazu
// gehören, liest der Effect aus dem Zustand und dem Belegspeicher. Damit
// kennt die Komponente den Transport nicht und der Transport die Komponente
// nicht.

import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { concatLatestFrom, mapResponse } from '@ngrx/operators';
import { Store } from '@ngrx/store';
import { switchMap } from 'rxjs';

import { AkteAktionen } from './akte.aktionen';
import { AkteDienst, fehlermeldung } from './akte.dienst';
import { waehleBelegIds } from './akte.reducer';
import { BelegSpeicher } from './akte.speicher';

export const einreichen = createEffect(
  (
    aktionen$ = inject(Actions),
    store = inject(Store),
    dienst = inject(AkteDienst),
    speicher = inject(BelegSpeicher),
  ) =>
    aktionen$.pipe(
      ofType(AkteAktionen.eingereicht),
      concatLatestFrom(() => store.select(waehleBelegIds)),
      // `switchMap`, nicht `concatMap`: Wer zweimal absendet, will das
      // zweite Ergebnis. Die erste Anfrage wird abgebrochen.
      switchMap(([{ stammdaten }, ids]) =>
        dienst.einreichen(stammdaten, speicher.dateien(ids)).pipe(
          mapResponse({
            next: (ergebnis) =>
              AkteAktionen.einreichungBeantwortet({ ergebnis, zeitpunkt: new Date().toISOString() }),
            error: (fehler: unknown) => AkteAktionen.einreichungFehlgeschlagen({ meldung: fehlermeldung(fehler) }),
          }),
        ),
      ),
    ),
  { functional: true },
);

/** Ein neuer Vorgang lässt keine Datei des alten zurück. */
export const aufraeumen = createEffect(
  (aktionen$ = inject(Actions), speicher = inject(BelegSpeicher)) =>
    aktionen$.pipe(
      ofType(AkteAktionen.neuBegonnen),
      // Kein Rückgabewert: Dieser Effect löst keine weitere Aktion aus.
      switchMap(async () => speicher.leeren()),
    ),
  { functional: true, dispatch: false },
);

export const akteEffekte = { einreichen, aufraeumen };
