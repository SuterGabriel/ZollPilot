import { type ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { provideStore } from '@ngrx/store';

import { akteEffekte } from './akte/akte.effekte';
import { akteFeature } from './akte/akte.reducer';
import { routes } from './app.routes';
import { uebersichtEffekte } from './uebersicht/uebersicht.effekte';
import { uebersichtFeature } from './uebersicht/uebersicht.reducer';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
    // `anchorScrolling`, damit die Sprungmarke „Zum Ergebnis springen“ mit
    // dem Router weiter zum Fragment führt.
    provideRouter(routes, withInMemoryScrolling({ anchorScrolling: 'enabled' })),
    provideStore(
      { [akteFeature.name]: akteFeature.reducer, [uebersichtFeature.name]: uebersichtFeature.reducer },
      {
        // Die Regeln, die ADR-006 über den Store aufstellt, werden hier
        // durchgesetzt statt behauptet. `strictStateSerializability` bricht,
        // sobald jemand ein `File` in den Store legt. Genau deshalb gibt es
        // den BelegSpeicher.
        runtimeChecks: {
          strictStateImmutability: true,
          strictActionImmutability: true,
          strictStateSerializability: true,
          strictActionSerializability: true,
        },
      },
    ),
    provideEffects(akteEffekte, uebersichtEffekte),
  ],
};
